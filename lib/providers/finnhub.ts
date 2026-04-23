import type { PriceReaction, Provider, RawEarnings, ReportTime } from "./types";
import { getPriceReactionBlended } from "./price-reaction";

const BASE = "https://finnhub.io/api/v1";

type FinnhubCalendarEntry = {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
};

type FinnhubCalendarResponse = { earningsCalendar: FinnhubCalendarEntry[] };

function mapHour(hour: string): ReportTime {
  const h = (hour ?? "").toLowerCase();
  if (h === "bmo" || h === "bm") return "BMO";
  if (h === "amc" || h === "am") return "AMC";
  if (h === "dmh") return "DMH";
  return "UNKNOWN";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Finnhub request failed ${res.status} ${res.statusText}: ${url.replace(/token=[^&]+/, "token=***")}`,
    );
  }
  return res.json() as Promise<T>;
}

export function createFinnhubProvider(): Provider {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error(
      "FINNHUB_API_KEY is not set. Add it to .env.local or switch DATA_PROVIDER.",
    );
  }

  return {
    name: "finnhub",

    async getEarningsForDate(date: string): Promise<RawEarnings[]> {
      // One request to get the whole day's calendar. Company name + market cap
      // are left to the Yahoo quote enricher in lib/earnings.ts because hitting
      // /stock/profile2 for 100+ symbols in a day blows past the free-tier
      // 60 req/min limit and silently drops every row's marketCap to null.
      const url = `${BASE}/calendar/earnings?from=${date}&to=${date}&token=${token}`;
      const data = await fetchJson<FinnhubCalendarResponse>(url);
      const entries = data.earningsCalendar ?? [];

      return entries.map((e) => {
        const fiscalPeriod = e.quarter && e.year ? `Q${e.quarter} ${e.year}` : "";
        return {
          symbol: e.symbol,
          companyName: e.symbol,
          reportDate: e.date,
          reportTime: mapHour(e.hour),
          fiscalPeriod,
          marketCap: null,
          epsEstimate: e.epsEstimate,
          revenueEstimate: e.revenueEstimate,
          epsActual: e.epsActual,
          revenueActual: e.revenueActual,
        } satisfies RawEarnings;
      });
    },

    // Finnhub's /stock/candle is premium-only on free tier. Stooq's keyless
    // CSV endpoint is primary; Yahoo (via yahoo-finance2 which handles the
    // crumb) is a fallback for tickers Stooq doesn't cover.
    async getPriceReaction(symbol, reportDate, reportTime): Promise<PriceReaction> {
      return getPriceReactionBlended(symbol, reportDate, reportTime);
    },
  };
}
