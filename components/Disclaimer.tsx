"use client";

import { useEffect, useState } from "react";

const KEY = "disclaimer-dismissed-v1";

export function Disclaimer() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    try {
      setShown(localStorage.getItem(KEY) !== "1");
    } catch {
      setShown(true);
    }
  }, []);

  if (!shown) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 text-xs">
        <p>
          <strong>Not financial advice.</strong> Suggestions are rule-based heuristics, not predictions.
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              // ignore
            }
            setShown(false);
          }}
          className="rounded border border-amber-300 px-2 py-0.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
