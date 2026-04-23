import { addDays, isoDate, nextTradingDay, previousTradingDay } from "../date";
import type { PriceReaction, ReportTime } from "./types";
import { getYahoo, isYahooQueryable } from "./yahoo-client";

type DailyQuote = { date: Date | null | undefined; close: number | null | undefined };

// Pure function: given a list of daily closes and the report context, compute
// before/after prices and the % move. Exported so it can be unit-tested
// without touching the network.
export function pickPriceReaction(
  quotes: DailyQuote[],
  reportDate: string,
  reportTime: ReportTime,
): PriceReaction {
  if (!quotes.length) return { priceBefore: null, priceAfter: null, priceChangePct: null };

  const byDate = new Map<string, number>();
  for (const q of quotes) {
    if (q.close == null || q.date == null) continue;
    byDate.set(isoDate(new Date(q.date)), q.close);
  }

  const beforeDate = reportTime === "BMO" ? previousTradingDay(reportDate) : reportDate;
  const afterDate = reportTime === "BMO" ? reportDate : nextTradingDay(reportDate);

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
}

export async function yahooPriceReaction(
  symbol: string,
  reportDate: string,
  reportTime: ReportTime,
): Promise<PriceReaction> {
  if (!isYahooQueryable(symbol)) {
    return { priceBefore: null, priceAfter: null, priceChangePct: null };
  }
  const beforeDate = reportTime === "BMO" ? previousTradingDay(reportDate) : reportDate;
  const afterDate = reportTime === "BMO" ? reportDate : nextTradingDay(reportDate);

  const period1 = new Date(addDays(beforeDate, -7) + "T00:00:00Z");
  const period2 = new Date(addDays(afterDate, 7) + "T23:59:59Z");

  try {
    const result = await getYahoo().chart(symbol, {
      period1,
      period2,
      interval: "1d",
    });
    const quotes = (result.quotes ?? []) as DailyQuote[];
    return pickPriceReaction(quotes, reportDate, reportTime);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // "No data found, symbol may be delisted" is genuine upstream truth for
    // acquired/delisted tickers — demote to a single-line info, not a warn.
    if (msg.includes("No data found")) {
      console.info(`[yahoo-price] ${symbol}: delisted or no data`);
    } else {
      console.warn(`[yahoo-price] ${symbol} ${reportDate}: ${msg}`);
    }
    return { priceBefore: null, priceAfter: null, priceChangePct: null };
  }
}
