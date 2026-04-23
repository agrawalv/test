import type { PriceReaction, Provider, RawEarnings, ReportTime } from "./types";
import { addDays, previousTradingDay, nextTradingDay } from "../date";

const BASE = "https://financialmodelingprep.com/api/v3";

type FmpCalendarEntry = {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  time: string; // "bmo" | "amc" | ""
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding?: string;
  updatedFromDate?: string;
};

type FmpHistorical = {
  historical: { date: string; close: number }[];
};

function mapHour(time: string): ReportTime {
  const t = (time ?? "").toLowerCase();
  if (t === "bmo") return "BMO";
  if (t === "amc") return "AMC";
  if (t === "dmh") return "DMH";
  return "UNKNOWN";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FMP request failed ${res.status} ${res.statusText}: ${url.replace(/apikey=[^&]+/, "apikey=***")}`);
  }
  return res.json() as Promise<T>;
}

function fiscalPeriodFromDate(reportDate: string): string {
  const d = new Date(reportDate + "T00:00:00Z");
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year}`;
}

export function createFmpProvider(): Provider {
  const apikey = process.env.FMP_API_KEY;
  if (!apikey) {
    throw new Error(
      "FMP_API_KEY is not set. Add it to .env.local or switch DATA_PROVIDER.",
    );
  }

  return {
    name: "fmp",

    async getEarningsForDate(date: string): Promise<RawEarnings[]> {
      const url = `${BASE}/earning_calendar?from=${date}&to=${date}&apikey=${apikey}`;
      const data = await fetchJson<FmpCalendarEntry[]>(url);
      return data.map((e) => ({
        symbol: e.symbol,
        companyName: e.symbol,
        reportDate: e.date,
        reportTime: mapHour(e.time),
        fiscalPeriod: fiscalPeriodFromDate(e.date),
        marketCap: null,
        epsEstimate: e.epsEstimated,
        revenueEstimate: e.revenueEstimated,
        epsActual: e.eps,
        revenueActual: e.revenue,
      }));
    },

    async getPriceReaction(symbol, reportDate, reportTime): Promise<PriceReaction> {
      const beforeDate = reportTime === "BMO" ? previousTradingDay(reportDate) : reportDate;
      const afterDate = reportTime === "BMO" ? reportDate : nextTradingDay(reportDate);

      const fromDate = addDays(beforeDate, -5);
      const toDate = addDays(afterDate, 5);

      try {
        const url = `${BASE}/historical-price-full/${encodeURIComponent(symbol)}?from=${fromDate}&to=${toDate}&apikey=${apikey}`;
        const data = await fetchJson<FmpHistorical>(url);
        const history = data.historical ?? [];
        if (history.length === 0) return { priceBefore: null, priceAfter: null, priceChangePct: null };

        const byDate = new Map<string, number>();
        for (const h of history) byDate.set(h.date, h.close);

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
    },
  };
}
