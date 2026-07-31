import { Scale } from "lucide-react";
import { motion } from "framer-motion";

const PROMPTS = [
  {
    title: "Explain IPC §420",
    body: "Explain the Indian Penal Code Section 420 (cheating) with examples and punishment.",
  },
  {
    title: "Tenant rights in Mumbai",
    body: "What are my rights as a tenant in Mumbai under the Maharashtra Rent Control Act?",
  },
  {
    title: "Draft a consumer complaint",
    body: "Draft a consumer complaint for a defective smartphone purchased 3 months ago.",
  },
  {
    title: "RTI application guide",
    body: "How do I file an RTI application to the Municipal Corporation? Include the fee and format.",
  },
];

export default function EmptyState({ onPrompt, disabled }) {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-10 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10 md:mb-14"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#111413] border border-[#D4AF37]/30 mb-5 shadow-[0_0_60px_rgba(212,175,55,0.15)]">
          <Scale className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.8} />
        </div>
        <h2 className="font-serif-jn text-4xl md:text-5xl lg:text-6xl text-[#EAEAEA]">
          How can <span className="text-[#D4AF37]">JanNyaya</span> assist you today?
        </h2>
        <p className="text-sm md:text-base text-[#8B9B96] mt-4 max-w-xl mx-auto">
          Ask about Indian laws, draft legal notices, analyse documents, or
          understand your rights — grounded in the IPC, Constitution & landmark
          rulings.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROMPTS.map((p, i) => (
          <motion.button
            key={p.title}
            data-testid="suggested-prompt-card"
            disabled={disabled}
            onClick={() => onPrompt(p.body)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
            className="text-left p-4 rounded-lg border border-[#242E2A] bg-[#111413]/60 hover:bg-[#1A201E] hover:border-[#D4AF37]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="text-[#EAEAEA] font-medium text-sm mb-1 group-hover:text-[#D4AF37] transition-colors">
              {p.title}
            </div>
            <div className="text-xs text-[#8B9B96] leading-relaxed line-clamp-2">
              {p.body}
            </div>
          </motion.button>
        ))}
      </div>

      <p className="text-[11px] text-[#8B9B96]/80 text-center mt-10 leading-relaxed">
        JanNyaya provides general legal information, not professional legal
        advice. For binding matters, consult a licensed advocate.
      </p>
    </div>
  );
}
