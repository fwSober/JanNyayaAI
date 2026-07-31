import { useState } from "react";
import { Plus, Search, Trash2, Scale, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

function groupChats(chats) {
  const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  const now = Date.now();
  for (const c of chats) {
    const t = new Date(c.updated_at || c.created_at).getTime();
    const diffH = (now - t) / 36e5;
    if (diffH < 24) groups.Today.push(c);
    else if (diffH < 48) groups.Yesterday.push(c);
    else if (diffH < 24 * 7) groups["Previous 7 days"].push(c);
    else groups.Older.push(c);
  }
  return groups;
}

export default function Sidebar({
  chats,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  onSearch,
  open,
  onClose,
}) {
  const [q, setQ] = useState("");
  const groups = groupChats(chats);

  const submitSearch = (val) => {
    setQ(val);
    onSearch(val);
  };

  return (
    <aside
      data-testid="sidebar"
      className={`fixed md:relative z-40 md:z-auto top-0 left-0 h-full md:h-auto w-[280px] shrink-0 bg-[#0B0F0D] border-r border-[#242E2A] flex flex-col transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Brand + New Chat */}
      <div className="px-4 pt-5 pb-3 border-b border-[#242E2A]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#D4AF37] to-[#8a6d15] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.25)]">
            <Scale className="w-4 h-4 text-[#0A0B0E]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-serif-jn text-xl leading-none text-[#D4AF37]">
              JanNyaya
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[#8B9B96]">
              AI Legal Assistant
            </div>
          </div>
        </div>

        <button
          data-testid="new-chat-button"
          onClick={onNewChat}
          className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md border border-[#D4AF37]/40 text-[#EAEAEA] hover:bg-[#1A201E] hover:border-[#D4AF37] transition-colors group"
        >
          <Plus className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">New Chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B9B96]" />
          <input
            data-testid="search-input"
            value={q}
            onChange={(e) => submitSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full h-9 pl-9 pr-3 bg-[#1A201E] border border-[#242E2A] rounded-md text-sm placeholder:text-[#8B9B96] focus:outline-none focus:border-[#D4AF37]/60"
          />
        </div>
      </div>

      {/* Chat list */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4" data-testid="chat-list">
        {chats.length === 0 && (
          <div className="text-center text-xs text-[#8B9B96] mt-8 px-6">
            No conversations yet. Start a new chat to begin.
          </div>
        )}
        {Object.entries(groups).map(([label, list]) =>
          list.length ? (
            <div key={label} className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-[#8B9B96] px-3 py-1.5">
                {label}
              </div>
              {list.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-[#1A201E] hover:translate-x-1 transition-all ${
                    activeId === c.id ? "bg-[#1A201E]" : ""
                  }`}
                  onClick={() => onSelect(c.id)}
                  data-testid="chat-list-item"
                >
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeId === c.id ? "text-[#D4AF37]" : "text-[#8B9B96]"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      activeId === c.id ? "text-[#EAEAEA]" : "text-[#EAEAEA]/85"
                    }`}
                  >
                    {c.title}
                  </span>
                  <button
                    data-testid="delete-chat-button"
                    aria-label="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[#8B9B96] hover:text-[#FF6B6B] transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : null
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#242E2A] text-[11px] text-[#8B9B96] flex items-center justify-between">
        <span data-testid="anon-session-badge">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4AF37] mr-1.5 align-middle" />
          Anonymous Session
        </span>
        <span className="opacity-70">v0.1</span>
      </div>

      {/* Close on mobile */}
      <button
        className="md:hidden absolute top-3 right-3 text-[#8B9B96] hover:text-[#EAEAEA]"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        ✕
      </button>
    </aside>
  );
}
