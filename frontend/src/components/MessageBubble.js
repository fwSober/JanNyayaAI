import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileText, ImageIcon } from "lucide-react";

export default function MessageBubble({ message, streaming = false }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div
        className="flex justify-end"
        data-testid="message-bubble-user"
      >
        <div className="max-w-[80%]">
          {message.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
              {message.attachments.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1A201E] border border-[#242E2A] text-xs text-[#EAEAEA]/90"
                >
                  {a.kind === "image" ? (
                    <ImageIcon className="w-3 h-3 text-[#D4AF37]" />
                  ) : (
                    <FileText className="w-3 h-3 text-[#D4AF37]" />
                  )}
                  <span className="truncate max-w-[180px]">{a.name}</span>
                </span>
              ))}
            </div>
          )}
          <div
            className="rounded-2xl rounded-br-md px-4 py-2.5 bg-[#1A201E] border border-[#242E2A] text-[#EAEAEA] text-[0.95rem] whitespace-pre-wrap break-words"
          >
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start" data-testid="message-bubble-ai">
      <div className="w-8 h-8 rounded-full bg-[#1A201E] border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
        <span className="font-serif-jn text-sm text-[#D4AF37] leading-none">
          Jn
        </span>
      </div>
      <div className="flex-1 min-w-0 jn-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {message.content || ""}
        </ReactMarkdown>
        {streaming && <span className="jn-caret" />}
      </div>
    </div>
  );
}
