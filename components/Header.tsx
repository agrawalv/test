"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Header({ updatedLabel }: { updatedLabel?: string | null }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
    setIsDark(next);
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-baseline gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Earnings Tracker
          </Link>
          <nav className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-100">
              Day
            </Link>
            <Link href="/range" className="hover:text-slate-900 dark:hover:text-slate-100">
              Month
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {updatedLabel && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{updatedLabel}</span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Toggle theme"
          >
            {isDark ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
