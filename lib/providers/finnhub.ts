import type { PriceReaction, Provider, RawEarnings, ReportTime } from "./types";
import { addDays, previousTradingDay, nextTradingDay, isoDate } from "../date";

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

type FinnhubProfile = { name?: string };

type FinnhubCandle = {
  c: number[];
  t: number[];
  s: "ok" | "no_data";
};

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
    throw new Error(`Finnhub request failed ${res.status} ${res.statusText}: ${url.replace(/token=[^&]+/, "token=***")}`);
  }
  return res.json() as Promise<T>;
}

const profileCache = new Map<string, string>();

async function getCompanyName(symbol: string, token: string): Promise<string> {
  if (profileCache.has(symbol)) return profileCache.get(symbol)!;
  try {
    const p = await fetchJson<FinnhubProfile>(`${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`);
    const name = p.name ?? symbol;
    profileCache.set(symbol, name);
    return name;
  } catch {
    return symbol;
  }
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
      const url = `${BASE}/calendar/earnings?from=${date}&to=${date}&token=${token}`;
      const data = await fetchJson<FinnhubCalendarResponse>(url);
      const entries = data.earningsCalendar ?? [];

      // Enrich sequentially with a tiny delay so we don't hammer the free tier.
      const rows: RawEarnings[] = [];
      const batchSize = 10;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const resolved = await Promise.all(
          batch.map(async (e) => {
            const companyName = await getCompanyName(e.symbol, token);
            const fiscalPeriod = e.quarter && e.year ? `Q${e.quarter} ${e.year}` : "";
            return {
              symbol: e.symbol,
              companyName,
              reportDate: e.date,
              reportTime: mapHour(e.hour),
              fiscalPeriod,
              epsEstimate: e.epsEstimate,
              revenueEstimate: e.revenueEstimate,
              epsActual: e.epsActual,
              revenueActual: e.revenueActual,
            } satisfies RawEarnings;
          }),
        );
        rows.push(...resolved);
        if (i + batchSize < entries.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      return rows;
    },

    async getPriceReaction(symbol, reportDate, reportTime): Promise<PriceReaction> {
      // Determine which dates to use:
      // BMO: priceBefore = close on reportDate-1, priceAfter = close on reportDate
      // AMC/DMH/UNKNOWN: priceBefore = close on reportDate, priceAfter = close on next trading day
      const beforeDate = reportTime === "BMO" ? previousTradingDay(reportDate) : reportDate;
      const afterDate = reportTime === "BMO" ? reportDate : nextTradingDay(reportDate);

      const fromTs = Math.floor(new Date(addDays(beforeDate, -2) + "T00:00:00Z").getTime() / 1000);
      const toTs = Math.floor(new Date(addDays(afterDate, 2) + "T23:59:59Z").getTime() / 1000);

      try {
        const url = `${BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromTs}&to=${toTs}&token=${token}`;
        const c = await fetchJson<FinnhubCandle>(url);
        if (c.s !== "ok" || !c.t?.length) return { priceBefore: null, priceAfter: null, priceChangePct: null };

        const byDate = new Map<string, number>();
        for (let i = 0; i < c.t.length; i++) {
          const d = isoDate(new Date(c.t[i] * 1000));
          byDate.set(d, c.c[i]);
        }

        const pickOnOrBefore = (d: string): number | null => {
          let cur = d;
          for (let i = 0; i < 7; i++) {
            if (byDate.has(cur)) return byDate.get(cur)!;
            cur = addDays(cur, -1);
          }
          return null;
        };
        const pickOnOrAfter = (d: string): number | null => {
          let cur = d;
          for (let i = 0; i < 7; i++) {
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
