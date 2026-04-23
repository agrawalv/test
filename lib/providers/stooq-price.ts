import { addDays } from "../date";
import type { PriceReaction, ReportTime } from "./types";
import { pickPriceReaction } from "./yahoo-price";

// Stooq hands out end-of-day CSVs with no API key, no crumb dance, and —
// in practice — no rate limiting. A nice stable fallback to Yahoo's chart
// endpoint, which keeps changing its auth rules.
//
// Symbol convention: lowercase, dots become dashes ("BRK.B" -> "brk-b"),
// US tickers need the ".us" suffix. Finnhub's space-delimited preferred
// format ("PCG PR A") isn't translatable — skip the same way Yahoo does.
export function isStooqQueryable(symbol: string): boolean {
  return !/\s/.test(symbol);
}

function stooqSymbol(symbol: string): string {
  return symbol.toLowerCase().replace(/\./g, "-") + ".us";
}

function compact(date: string): string {
  return date.replace(/-/g, "");
}

function parseCsv(text: string): { date: Date; close: number }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  // Invalid tickers get a plaintext "No data" body, not a non-2xx status.
  if (!lines[0].toLowerCase().startsWith("date")) return [];
  const out: { date: Date; close: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;
    const d = new Date(cols[0] + "T00:00:00Z");
    const close = Number(cols[4]);
    if (!isFinite(close) || isNaN(d.getTime())) continue;
    out.push({ date: d, close });
  }
  return out;
}

export async function stooqPriceReaction(
  symbol: string,
  reportDate: string,
  reportTime: ReportTime,
): Promise<PriceReaction> {
  if (!isStooqQueryable(symbol)) {
    return { priceBefore: null, priceAfter: null, priceChangePct: null };
  }
  const d1 = compact(addDays(reportDate, -10));
  const d2 = compact(addDays(reportDate, 10));
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol(symbol)}&i=d&d1=${d1}&d2=${d2}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { priceBefore: null, priceAfter: null, priceChangePct: null };
    }
    const text = await res.text();
    const quotes = parseCsv(text);
    const reaction = pickPriceReaction(quotes, reportDate, reportTime);
    if (reaction.priceBefore != null || reaction.priceAfter != null) {
      return { ...reaction, source: "stooq" };
    }
    return reaction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.info(`[stooq] ${symbol} ${reportDate}: ${msg}`);
    return { priceBefore: null, priceAfter: null, priceChangePct: null };
  }
}
