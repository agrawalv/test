import { addDays, isoDate, nextTradingDay, previousTradingDay } from "../date";
import type { PriceReaction, ReportTime } from "./types";

type YahooChart = {
  chart: {
    result:
      | {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[]
      | null;
    error: unknown;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Yahoo rejects some default fetch UAs
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Yahoo request failed ${res.status}`);
  return (await res.json()) as T;
}

export async function yahooPriceReaction(
  symbol: string,
  reportDate: string,
  reportTime: ReportTime,
): Promise<PriceReaction> {
  const beforeDate = reportTime === "BMO" ? previousTradingDay(reportDate) : reportDate;
  const afterDate = reportTime === "BMO" ? reportDate : nextTradingDay(reportDate);

  const fromSec = Math.floor(new Date(addDays(beforeDate, -7) + "T00:00:00Z").getTime() / 1000);
  const toSec = Math.floor(new Date(addDays(afterDate, 7) + "T23:59:59Z").getTime() / 1000);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${fromSec}&period2=${toSec}&interval=1d&events=history`;
    const data = await fetchJson<YahooChart>(url);
    const result = data.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    if (ts.length === 0) return { priceBefore: null, priceAfter: null, priceChangePct: null };

    const byDate = new Map<string, number>();
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null) continue;
      byDate.set(isoDate(new Date(ts[i] * 1000)), c);
    }

    const pickOnOrBefore = (d: string): number | null => {
      let cur = d;
      for (let i = 0; i < 10; i++) {
        if (byDate.has(cur)) return byDate.get(cur)!;
        cur = addDays(cur, -1);
      }
      return null;
    };
    const pickOnOrAfter = (d: string): number | null => {
      let cur = d;
      for (let i = 0; i < 10; i++) {
        if (byDate.has(cur)) return byDate.get(cur)!;
        cur = addDays(cur, 1);
      }
      return null;
    };

    const priceBefore = pickOnOrBefore(beforeDate);
    const priceAfter = pickOnOrAfter(afterDate);
    const priceChangePct =
      priceBefore != null && priceAfter != null && priceBefore !== 0
        ? ((priceAfter - priceBefore) / priceBefore) * 100
        : null;
    return { priceBefore, priceAfter, priceChangePct };
  } catch {
    return { priceBefore: null, priceAfter: null, priceChangePct: null };
  }
}
