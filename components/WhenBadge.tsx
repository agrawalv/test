import type { ReportTime } from "@/lib/providers/types";

const labels: Record<ReportTime, string> = {
  BMO: "BMO",
  AMC: "AMC",
  DMH: "DMH",
  UNKNOWN: "—",
};

const styles: Record<ReportTime, string> = {
  BMO: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  AMC: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  DMH: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  UNKNOWN: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function WhenBadge({ time }: { time: ReportTime }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[time]}`}>
      {labels[time]}
    </span>
  );
}
