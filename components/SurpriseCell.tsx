import { formatPct } from "@/lib/format";

export function SurpriseCell({ value, bold = false }: { value: number | null; bold?: boolean }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const color =
    value > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : value < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-slate-400";
  return <span className={`${color} ${bold ? "font-semibold" : ""}`}>{formatPct(value)}</span>;
}

export function ComparisonCell({
  actual,
  estimate,
  format,
}: {
  actual: number | null;
  estimate: number | null;
  format: (n: number | null | undefined) => string;
}) {
  if (actual == null) return <span className="text-slate-400">—</span>;
  if (estimate == null) return <span>{format(actual)}</span>;
  const color =
    actual >= estimate
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return <span className={color}>{format(actual)}</span>;
}
