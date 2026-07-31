import { useEffect, useRef } from "react";
import MessageBubble from "@/components/MessageBubble";
import { motion } from "framer-motion";

export default function ChatWindow({ messages, streaming, streamingText }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const showTypingBubble = streaming && !streamingText;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6 md:py-10 space-y-6">
      {messages.map((m, i) => (
        <motion.div
          key={m.id || i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
        >
          <MessageBubble message={m} />
        </motion.div>
      ))}

      {streamingText && (
        <MessageBubble
          message={{ role: "assistant", content: streamingText }}
          streaming
        />
      )}

      {showTypingBubble && (
        <div
          className="flex gap-3 items-start"
          data-testid="typing-indicator"
        >
          <div className="w-8 h-8 rounded-full bg-[#1A201E] border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
            <span className="font-serif-jn text-sm text-[#D4AF37]">Jn</span>
          </div>
          <div className="rounded-2xl px-4 py-3 bg-[#111413] border border-[#242E2A]">
            <div className="flex items-center gap-1">
              <span className="jn-dot" />
              <span className="jn-dot" />
              <span className="jn-dot" />
              <span className="text-xs text-[#8B9B96] ml-2">
                JanNyaya is thinking…
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
