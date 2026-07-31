import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import EmptyState from "@/components/EmptyState";
import ChatInput from "@/components/ChatInput";
import { getSessionId } from "@/lib/session";
import {
  createChat,
  listChats,
  getChat,
  deleteChat,
  streamMessage,
  uploadFile,
} from "@/lib/api";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const sessionId = useMemo(() => getSessionId(), []);

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // {id, title, messages}
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const abortRef = useRef(null);

  const refreshList = useCallback(
    async (q = "") => {
      try {
        const list = await listChats(sessionId, q);
        setChats(list);
        return list;
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    [sessionId]
  );

  // Initial load
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Load selected chat
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!chatId) {
        setActiveChat(null);
        return;
      }
      setLoadingChat(true);
      try {
        const c = await getChat(chatId);
        if (!cancel) setActiveChat(c);
      } catch (e) {
        toast.error("Chat not found");
        navigate("/");
      } finally {
        if (!cancel) setLoadingChat(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [chatId, navigate]);

  const handleNewChat = () => {
    navigate("/");
    setSidebarOpen(false);
  };

  const handleSelect = (id) => {
    navigate(`/c/${id}`);
    setSidebarOpen(false);
  };

  const handleDelete = async (id) => {
    await deleteChat(id);
    toast.success("Chat deleted");
    await refreshList(searchQ);
    if (chatId === id) navigate("/");
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    await refreshList(q);
  };

  const handleUpload = async (file) => {
    try {
      const res = await uploadFile(sessionId, file);
      toast.success(`Attached: ${res.name}`);
      return res; // {file_id, name, kind, extracted_text, ...}
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload failed";
      toast.error(msg);
      throw e;
    }
  };

  const handleSend = async (text, attachments) => {
    if (!text.trim() && attachments.length === 0) return;
    setSending(true);
    setStreamingText("");

    // Ensure we have a chat
    let currentId = chatId;
    let current = activeChat;
    if (!currentId) {
      const created = await createChat(sessionId);
      currentId = created.id;
      current = { ...created, messages: [] };
      navigate(`/c/${currentId}`, { replace: true });
      setActiveChat(current);
    }

    // Optimistically append user message
    const userAttachmentsMeta = attachments.map((a) => ({
      name: a.name,
      kind: a.kind,
    }));
    const userMsg = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachments: userAttachmentsMeta,
      created_at: new Date().toISOString(),
    };
    setActiveChat((c) => ({
      ...(c || current),
      messages: [...((c || current).messages || []), userMsg],
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamMessage({
        chatId: currentId,
        sessionId,
        message: text,
        attachments,
        signal: controller.signal,
        onDelta: (chunk) => setStreamingText((s) => s + chunk),
        onError: (err) => toast.error(err || "Stream error"),
      });
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message || "Failed to send");
    } finally {
      // Refresh authoritative chat state from server
      try {
        const refreshed = await getChat(currentId);
        setActiveChat(refreshed);
      } catch (_err) {
        /* non-fatal — leave optimistic state */
      }
      setStreamingText("");
      setSending(false);
      abortRef.current = null;
      refreshList(searchQ);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const isEmpty = !activeChat || (activeChat.messages || []).length === 0;

  return (
    <div className="h-screen w-full flex bg-[#0A0B0E] text-[#EAEAEA] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        chats={chats}
        activeId={chatId}
        onNewChat={handleNewChat}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onSearch={handleSearch}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top bar */}
        <header
          className="flex items-center gap-3 px-4 py-3 border-b border-[#242E2A] bg-[#0A0B0E]/70 backdrop-blur-xl sticky top-0 z-20"
          data-testid="chat-header"
        >
          <button
            data-testid="sidebar-toggle"
            aria-label="Toggle sidebar"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-[#242E2A] hover:bg-[#1A201E] transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif-jn text-2xl truncate">
              {activeChat?.title || "JanNyaya"}
            </h1>
            <p className="text-xs text-[#8B9B96] hidden sm:block">
              AI Legal Assistant · Indian Law · Anonymous Session
            </p>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isEmpty ? (
            <EmptyState
              onPrompt={(p) => handleSend(p, [])}
              disabled={sending || loadingChat}
            />
          ) : (
            <ChatWindow
              messages={activeChat.messages}
              streaming={sending}
              streamingText={streamingText}
            />
          )}
        </div>

        {/* Composer */}
        <ChatInput
          onSend={handleSend}
          onUpload={handleUpload}
          sending={sending}
          onStop={stopStreaming}
        />
      </main>
    </div>
  );
}
