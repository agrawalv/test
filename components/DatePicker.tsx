"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { addDays, formatHuman, todayIso } from "@/lib/date";

export function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  const today = todayIso();

  function go(d: string) {
    const url = d === today ? "/" : `/?date=${d}`;
    router.push(url);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(addDays(date, -1));
      else if (e.key === "ArrowRight") go(addDays(date, 1));
      else if (e.key.toLowerCase() === "t") go(today);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tab: "past" | "today" | "upcoming" =
    date < today ? "past" : date === today ? "today" : "upcoming";

  function tabClass(name: "past" | "today" | "upcoming") {
    const active = name === tab;
    return [
      "px-3 py-1 text-sm rounded-md",
      active
        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
    ].join(" ");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => go(addDays(date, -1))}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          aria-label="Next day"
          onClick={() => go(addDays(date, 1))}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => go(today)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Today
        </button>
        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
          {formatHuman(date)}
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => go(addDays(today, -1))}
          className={tabClass("past")}
        >
          Past
        </button>
        <button
          type="button"
          onClick={() => go(today)}
          className={tabClass("today")}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => go(addDays(today, 1))}
          className={tabClass("upcoming")}
        >
          Upcoming
        </button>
      </div>
    </div>
  );
}
