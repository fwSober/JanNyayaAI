import { useRef, useState } from "react";
import { Paperclip, ArrowUp, Square, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

export default function ChatInput({ onSend, onUpload, sending, onStop }) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]); // {name, kind, extracted_text}
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 15 MB`);
        continue;
      }
      setUploading(true);
      try {
        const res = await onUpload(f);
        setAttachments((prev) => [
          ...prev,
          {
            name: res.name,
            kind: res.kind,
            extracted_text: res.extracted_text || "",
          },
        ]);
      } catch {
        // toast already shown
      } finally {
        setUploading(false);
      }
    }
  };

  const removeAtt = (i) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = () => {
    if (sending) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    onSend(text, attachments);
    setValue("");
    setAttachments([]);
    // reset textarea height
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (e) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="border-t border-[#242E2A] bg-[#0A0B0E]/80 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-3 md:py-4">
        {attachments.length > 0 && (
          <div
            className="flex flex-wrap gap-2 mb-2"
            data-testid="attachment-chips"
          >
            {attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md bg-[#1A201E] border border-[#242E2A] text-xs"
              >
                {a.kind === "image" ? (
                  <ImageIcon className="w-3 h-3 text-[#D4AF37]" />
                ) : (
                  <FileText className="w-3 h-3 text-[#D4AF37]" />
                )}
                <span className="truncate max-w-[160px]">{a.name}</span>
                <button
                  onClick={() => removeAtt(i)}
                  className="ml-1 text-[#8B9B96] hover:text-[#FF6B6B]"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-[#111413] border border-[#242E2A] rounded-2xl px-3 py-2 focus-within:border-[#D4AF37]/50 transition-colors">
          <button
            data-testid="file-upload-button"
            onClick={handlePickFile}
            disabled={uploading || sending}
            className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md text-[#8B9B96] hover:text-[#D4AF37] hover:bg-[#1A201E] transition-colors disabled:opacity-50"
            aria-label="Attach PDF or image"
            title="Attach PDF or image"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={handleFile}
            className="hidden"
            data-testid="file-input"
          />

          <textarea
            data-testid="chat-input-textarea"
            ref={taRef}
            rows={1}
            value={value}
            onChange={autoGrow}
            onKeyDown={onKeyDown}
            placeholder="Ask JanNyaya about Indian law…  (Shift+Enter for new line)"
            className="flex-1 bg-transparent resize-none outline-none text-[#EAEAEA] placeholder:text-[#8B9B96] text-[0.95rem] leading-6 py-1.5 max-h-[200px]"
            disabled={sending}
          />

          {sending ? (
            <button
              data-testid="stop-button"
              onClick={onStop}
              className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md bg-[#1A201E] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#242E2A] transition-colors"
              aria-label="Stop generation"
              title="Stop"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              data-testid="send-message-button"
              onClick={submit}
              disabled={!value.trim() && attachments.length === 0}
              className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md bg-[#D4AF37] text-[#0A0B0E] hover:bg-[#E5C158] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
              title="Send"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <p className="text-[10px] text-[#8B9B96] text-center mt-2">
          JanNyaya can make mistakes. Verify important legal information with a
          qualified advocate.
        </p>
      </div>
    </div>
  );
}
