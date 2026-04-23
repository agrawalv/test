import type { Suggestion } from "@/lib/providers/types";

const styles: Record<Suggestion, string> = {
  BUY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  SELL: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
  AVOID: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  WATCH: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export function SuggestionPill({ suggestion, reason }: { suggestion: Suggestion; reason?: string }) {
  return (
    <span
      title={reason}
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${styles[suggestion]}`}
    >
      {suggestion}
    </span>
  );
}
