import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API });

export async function createChat(sessionId) {
  const { data } = await http.post("/chats", { session_id: sessionId });
  return data;
}

export async function listChats(sessionId, q = "") {
  const { data } = await http.get("/chats", {
    params: { session_id: sessionId, q: q || undefined },
  });
  return data;
}

export async function getChat(chatId) {
  const { data } = await http.get(`/chats/${chatId}`);
  return data;
}

export async function deleteChat(chatId) {
  const { data } = await http.delete(`/chats/${chatId}`);
  return data;
}

export async function uploadFile(sessionId, file) {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("file", file);
  const { data } = await http.post("/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Stream assistant response using fetch + ReadableStream (SSE).
 * onDelta(text) is called with each token chunk; returns full text on done.
 */
export async function streamMessage({
  chatId,
  sessionId,
  message,
  attachments = [],
  onDelta,
  onError,
  signal,
}) {
  const resp = await fetch(`${API}/message/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      session_id: sessionId,
      message,
      attachments,
    }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const msg = await resp.text().catch(() => "");
    throw new Error(`Stream failed: ${resp.status} ${msg}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const evt of events) {
      const lines = evt.split("\n");
      let dataLines = [];
      let eventName = "message";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
      }
      const dataStr = dataLines.join("\n");
      if (eventName === "error") {
        let msg = dataStr;
        try { msg = JSON.parse(dataStr).error || msg; } catch (_e) { /* raw */ }
        onError?.(msg);
        continue;
      }
      if (eventName === "done") return full;
      // Message event: {t: "chunk text"}
      let chunk = "";
      try {
        chunk = JSON.parse(dataStr).t || "";
      } catch (_e) {
        chunk = dataStr;
      }
      if (chunk) {
        full += chunk;
        onDelta?.(chunk);
      }
    }
  }
  return full;
}
