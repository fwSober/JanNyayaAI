"""JanNyaya - AI Legal Assistant (Indian law focus)
FastAPI backend: chat, file analysis, conversation persistence.
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import io
import base64
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict
from pypdf import PdfReader

from emergentintegrations.llm.chat import (
    LlmChat,
    UserMessage,
    TextDelta,
    StreamDone,
    FileContentWithMimeType,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ------- Config -------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Claude Sonnet 4.5 for chat (Indian law expertise). Gemini for file/image analysis.
CHAT_PROVIDER = "anthropic"
CHAT_MODEL = "claude-sonnet-4-5-20250929"
FILE_PROVIDER = "gemini"
FILE_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = """You are JanNyaya, a knowledgeable AI legal assistant specialising in Indian law.

Your expertise covers:
- Indian Penal Code (IPC), Bharatiya Nyaya Sanhita (BNS), CrPC, CPC, Constitution of India
- Consumer Protection Act, RTI Act, Motor Vehicles Act, IT Act
- Tenancy and property law, family law (Hindu, Muslim, Christian personal laws)
- Labour law, taxation basics (GST, Income Tax), corporate law
- Filing procedures in Indian courts, drafting notices, petitions and complaints

Guidelines when responding:
1. Use clear headings and bullet points. Format responses in Markdown.
2. Always cite specific sections/articles when applicable (e.g. "IPC §420", "Article 21").
3. Provide practical next steps the user can take (e.g. where to file, documents needed).
4. Include a short "Disclaimer" line at the end for complex legal matters recommending consultation with a licensed advocate.
5. If the question is outside Indian legal context, still help but note the jurisdictional context.
6. Be concise but thorough. Prefer structured answers over long paragraphs."""


# ------- DB -------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ------- App -------
app = FastAPI(title="JanNyaya API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("jannyaya")


# ------- Models -------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # "user" | "assistant"
    content: str
    attachments: List[dict] = Field(default_factory=list)  # [{name, kind}]
    created_at: str = Field(default_factory=now_iso)


class Chat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    title: str = "New chat"
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
    messages: List[Message] = Field(default_factory=list)


class CreateChatReq(BaseModel):
    session_id: str


class SendMessageReq(BaseModel):
    chat_id: str
    session_id: str
    message: str
    attachments: List[dict] = Field(default_factory=list)
    # attachment shape: {name, kind: "pdf"|"image", extracted_text?, image_b64?, mime?}


# ------- Helpers -------
def make_title(text: str) -> str:
    t = re.sub(r"\s+", " ", text.strip())
    return (t[:50] + "…") if len(t) > 50 else (t or "New chat")


async def extract_pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = []
        for i, page in enumerate(reader.pages[:50]):  # cap at 50 pages
            pages.append(page.extract_text() or "")
        text = "\n\n".join(pages).strip()
        # limit total chars sent as context
        return text[:20000]
    except Exception as e:
        logger.exception("pdf extract failed: %s", e)
        return ""


async def describe_image_via_gemini(file_path: Path, prompt_hint: str = "") -> str:
    """Use Gemini vision to OCR + describe a legal image/document."""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"img-{uuid.uuid4()}",
            system_message="You are a legal document OCR and analysis assistant. Extract all readable text and describe the visual content accurately.",
        ).with_model(FILE_PROVIDER, FILE_MODEL)
        img = FileContentWithMimeType(
            file_path=str(file_path),
            mime_type="image/jpeg" if file_path.suffix.lower() in [".jpg", ".jpeg"] else "image/png",
        )
        prompt = (
            "Extract ALL text visible in this image verbatim (OCR). "
            "Then briefly describe non-text visual elements (stamps, signatures, seals, tables). "
            f"{prompt_hint}"
        )
        parts: List[str] = []
        async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=[img])):
            if isinstance(ev, TextDelta):
                parts.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        return ("".join(parts)).strip()[:20000]
    except Exception as e:
        logger.exception("gemini image describe failed: %s", e)
        return ""


def build_context_from_attachments(attachments: List[dict]) -> str:
    """Compose an in-message context block from uploaded file text."""
    if not attachments:
        return ""
    blocks = []
    for att in attachments:
        name = att.get("name", "file")
        kind = att.get("kind", "file")
        text = att.get("extracted_text", "") or ""
        if not text:
            continue
        blocks.append(f"--- Attached {kind.upper()}: {name} ---\n{text}\n--- end of {name} ---")
    if not blocks:
        return ""
    return "The user attached the following document(s). Use them as primary context.\n\n" + "\n\n".join(blocks)


# ------- Routes -------
@api_router.get("/")
async def root():
    return {"app": "JanNyaya", "status": "ok"}


@api_router.post("/chats", response_model=Chat)
async def create_chat(req: CreateChatReq):
    chat = Chat(session_id=req.session_id)
    await db.chats.insert_one(chat.model_dump())
    return chat


@api_router.get("/chats", response_model=List[Chat])
async def list_chats(session_id: str, q: Optional[str] = None):
    query: dict = {"session_id": session_id}
    if q:
        # Search title or any message content (case-insensitive)
        safe = re.escape(q)
        query["$or"] = [
            {"title": {"$regex": safe, "$options": "i"}},
            {"messages.content": {"$regex": safe, "$options": "i"}},
        ]
    docs = await db.chats.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [Chat(**d) for d in docs]


@api_router.get("/chats/{chat_id}", response_model=Chat)
async def get_chat(chat_id: str):
    doc = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Chat not found")
    return Chat(**doc)


@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    r = await db.chats.delete_one({"id": chat_id})
    return {"deleted": r.deleted_count}


@api_router.post("/upload")
async def upload_file(session_id: str = Form(...), file: UploadFile = File(...)):
    """Extract text from uploaded PDF/image and return preview + extracted text."""
    if not file.filename:
        raise HTTPException(400, "Missing filename")
    ext = Path(file.filename).suffix.lower()
    kind: str
    if ext == ".pdf":
        kind = "pdf"
    elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
        kind = "image"
    else:
        raise HTTPException(400, "Only PDF and image files are supported in Phase 1")

    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 15 MB)")

    file_id = str(uuid.uuid4())
    sess_dir = UPLOAD_DIR / session_id
    sess_dir.mkdir(parents=True, exist_ok=True)
    fpath = sess_dir / f"{file_id}{ext}"
    fpath.write_bytes(data)

    extracted = ""
    if kind == "pdf":
        extracted = await extract_pdf_text(data)
    else:
        extracted = await describe_image_via_gemini(fpath)

    return {
        "file_id": file_id,
        "name": file.filename,
        "kind": kind,
        "size": len(data),
        "extracted_text": extracted,
        "preview": extracted[:400],
    }


@api_router.post("/message/stream")
async def stream_message(req: SendMessageReq):
    """Send a user message and stream the assistant response (SSE)."""
    chat_doc = await db.chats.find_one({"id": req.chat_id}, {"_id": 0})
    if not chat_doc:
        raise HTTPException(404, "Chat not found")
    chat = Chat(**chat_doc)

    # Persist user message
    user_msg = Message(role="user", content=req.message, attachments=req.attachments)
    chat.messages.append(user_msg)

    # If it's the first user message, set the title
    if chat.title == "New chat":
        chat.title = make_title(req.message)

    # Build history for LLM (rebuild session each call is fine — we send full history)
    llm = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.chat_id,
        system_message=SYSTEM_PROMPT,
    ).with_model(CHAT_PROVIDER, CHAT_MODEL)

    # Send prior history via successive user/assistant turns is not directly supported
    # in a single call; instead we compose a single message that includes prior turns
    # as transcript context, plus the current user message with attachment context.
    prior = chat.messages[:-1]
    transcript = ""
    if prior:
        lines = []
        for m in prior[-20:]:  # cap context
            role = "User" if m.role == "user" else "Assistant"
            lines.append(f"{role}: {m.content}")
        transcript = "Prior conversation for context:\n" + "\n\n".join(lines) + "\n\n"

    attach_ctx = build_context_from_attachments(req.attachments)
    composed = ""
    if transcript:
        composed += transcript
    if attach_ctx:
        composed += attach_ctx + "\n\n"
    composed += f"Current user question: {req.message}"

    async def event_gen():
        import json as _json
        collected: List[str] = []
        try:
            async for ev in llm.stream_message(UserMessage(text=composed)):
                if isinstance(ev, TextDelta):
                    collected.append(ev.content)
                    # JSON-encode chunk to preserve whitespace/newlines exactly
                    yield f"data: {_json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.exception("LLM stream error: %s", e)
            yield f"event: error\ndata: {_json.dumps({'error': str(e)[:200]})}\n\n"
        finally:
            # Persist assistant response
            assistant_text = "".join(collected).strip() or "I apologise — I couldn't generate a response. Please try again."
            asst_msg = Message(role="assistant", content=assistant_text)
            chat.messages.append(asst_msg)
            chat.updated_at = now_iso()
            await db.chats.replace_one({"id": chat.id}, chat.model_dump())
            yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
