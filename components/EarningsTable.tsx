"use client";

import { Fragment, useMemo, useState } from "react";
import type { EarningsRow } from "@/lib/providers/types";
import { SuggestionPill } from "./SuggestionPill";
import { SurpriseCell, ComparisonCell } from "./SurpriseCell";
import { WhenBadge } from "./WhenBadge";
import { formatCompactUSD, formatNum, formatPct, formatPrice, truncate } from "@/lib/format";

type SortKey =
  | "symbol"
  | "companyName"
  | "reportTime"
  | "epsEstimate"
  | "epsActual"
  | "epsSurprisePct"
  | "revenueEstimate"
  | "revenueActual"
  | "revenueSurprisePct"
  | "priceBefore"
  | "priceAfter"
  | "priceChangePct"
  | "suggestion";

type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; align?: "right" | "left" }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "companyName", label: "Company" },
  { key: "reportTime", label: "When" },
  { key: "epsEstimate", label: "EPS Est.", align: "right" },
  { key: "epsActual", label: "EPS Actual", align: "right" },
  { key: "epsSurprisePct", label: "EPS Surp.", align: "right" },
  { key: "revenueEstimate", label: "Rev Est.", align: "right" },
  { key: "revenueActual", label: "Rev Actual", align: "right" },
  { key: "revenueSurprisePct", label: "Rev Surp.", align: "right" },
  { key: "priceBefore", label: "Price Before", align: "right" },
  { key: "priceAfter", label: "Price After", align: "right" },
  { key: "priceChangePct", label: "Move %", align: "right" },
  { key: "suggestion", label: "Suggestion" },
];

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function EarningsTable({ rows }: { rows: EarningsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const v = cmp(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? v : -v;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "priceChangePct" || key === "epsSurprisePct" ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const headers = [
      "Symbol",
      "Company",
      "When",
      "Fiscal",
      "EPS Est",
      "EPS Actual",
      "EPS Surprise %",
      "Rev Est",
      "Rev Actual",
      "Rev Surprise %",
      "Price Before",
      "Price After",
      "Move %",
      "Suggestion",
      "Reason",
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const r of sorted) {
      lines.push(
        [
          r.symbol,
          r.companyName,
          r.reportTime,
          r.fiscalPeriod,
          r.epsEstimate ?? "",
          r.epsActual ?? "",
          r.epsSurprisePct ?? "",
          r.revenueEstimate ?? "",
          r.revenueActual ?? "",
          r.revenueSurprisePct ?? "",
          r.priceBefore ?? "",
          r.priceAfter ?? "",
          r.priceChangePct ?? "",
          r.suggestion,
          r.suggestionReason,
        ]
          .map((v) => esc(String(v)))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-6 py-16 text-center text-slate-500 dark:border-slate-800 dark:text-slate-400">
        No earnings scheduled for this date.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter by symbol or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {sorted.length} {sorted.length === 1 ? "company" : "companies"}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${c.align === "right" ? "text-right" : "text-left"}`}
                  onClick={() => onHeaderClick(c.key)}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
            {sorted.map((r) => {
              const isOpen = expanded === r.symbol;
              return (
                <Fragment key={r.symbol}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.symbol)}
                    className="cursor-pointer odd:bg-white even:bg-slate-50/50 hover:bg-slate-100 dark:odd:bg-slate-950 dark:even:bg-slate-900/40 dark:hover:bg-slate-800/60"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold">{r.symbol}</td>
                    <td className="whitespace-nowrap px-3 py-1.5" title={r.companyName}>
                      {truncate(r.companyName, 28)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <WhenBadge time={r.reportTime} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      {formatNum(r.epsEstimate, 2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      <ComparisonCell actual={r.epsActual} estimate={r.epsEstimate} format={(n) => formatNum(n, 2)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      <SurpriseCell value={r.epsSurprisePct} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      {formatCompactUSD(r.revenueEstimate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      <ComparisonCell actual={r.revenueActual} estimate={r.revenueEstimate} format={formatCompactUSD} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      <SurpriseCell value={r.revenueSurprisePct} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      {formatPrice(r.priceBefore)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      {formatPrice(r.priceAfter)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">
                      <SurpriseCell value={r.priceChangePct} bold />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <SuggestionPill suggestion={r.suggestion} reason={r.suggestionReason} />
                    </td>
                    <td
                      className="max-w-[28ch] truncate px-3 py-1.5 text-slate-500 dark:text-slate-400"
                      title={r.notes ?? r.suggestionReason}
                    >
                      {r.notes ?? r.suggestionReason}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                      <td colSpan={COLS.length + 1} className="px-6 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-3">
                          <div>
                            <span className="font-semibold">Fiscal period: </span>
                            {r.fiscalPeriod || "—"}
                          </div>
                          <div>
                            <span className="font-semibold">Suggestion: </span>
                            {r.suggestion} — {r.suggestionReason}
                          </div>
                          <div>
                            <span className="font-semibold">Move %: </span>
                            {formatPct(r.priceChangePct)}
                          </div>
                          {r.notes && (
                            <div className="md:col-span-3">
                              <span className="font-semibold">Notes: </span>
                              {r.notes}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
