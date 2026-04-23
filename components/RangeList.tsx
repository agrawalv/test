"use client";

import Link from "next/link";
import { useState } from "react";
import { formatShort, formatHuman } from "@/lib/date";

type Item = { date: string; count: number };

export function RangeList({ today, items }: { today: string; items: Item[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const past = items.filter((i) => i.date < today);
  const upcoming = items.filter((i) => i.date >= today);

  function section(title: string, group: Item[]) {
    return (
      <div>
        <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {group.map((d) => {
            const isOpen = open[d.date];
            const highlight = d.date === today ? "bg-slate-50 dark:bg-slate-900" : "";
            return (
              <li key={d.date} className={highlight}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [d.date]: !o[d.date] }))}
                  className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-24 font-mono text-sm">{formatShort(d.date)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatHuman(d.date)}</span>
                    {d.date === today && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                        TODAY
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {d.count} {d.count === 1 ? "company" : "companies"}
                    </span>
                    <Link
                      href={`/?date=${d.date}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Open →
                    </Link>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {d.count === 0
                      ? "No earnings reported for this date."
                      : `Click “Open” to see the ${d.count} companies reporting on ${formatHuman(d.date)}.`}
                  </div>
                )}
              </li>
            );
          })}
          {group.length === 0 && (
            <li className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">No dates in range.</li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {section("Upcoming", upcoming)}
      {section("Past", [...past].reverse())}
    </div>
  );
}
