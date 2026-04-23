import type { PriceReaction, Provider, RawEarnings, ReportTime } from "./types";
import { yahooPriceReaction } from "./yahoo-price";

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

type FinnhubProfile = {
  name?: string;
  // Finnhub returns market cap in millions of USD
  marketCapitalization?: number;
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
    throw new Error(
      `Finnhub request failed ${res.status} ${res.statusText}: ${url.replace(/token=[^&]+/, "token=***")}`,
    );
  }
  return res.json() as Promise<T>;
}

type ProfileInfo = { name: string; marketCap: number | null };
const profileCache = new Map<string, ProfileInfo>();

async function getProfile(symbol: string, token: string): Promise<ProfileInfo> {
  if (profileCache.has(symbol)) return profileCache.get(symbol)!;
  try {
    const p = await fetchJson<FinnhubProfile>(
      `${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`,
    );
    const info: ProfileInfo = {
      name: p.name ?? symbol,
      marketCap:
        typeof p.marketCapitalization === "number" && p.marketCapitalization > 0
          ? p.marketCapitalization * 1_000_000
          : null,
    };
    profileCache.set(symbol, info);
    return info;
  } catch {
    const fallback: ProfileInfo = { name: symbol, marketCap: null };
    profileCache.set(symbol, fallback);
    return fallback;
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

      const rows: RawEarnings[] = [];
      const batchSize = 10;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const resolved = await Promise.all(
          batch.map(async (e) => {
            const profile = await getProfile(e.symbol, token);
            const fiscalPeriod = e.quarter && e.year ? `Q${e.quarter} ${e.year}` : "";
            return {
              symbol: e.symbol,
              companyName: profile.name,
              reportDate: e.date,
              reportTime: mapHour(e.hour),
              fiscalPeriod,
              marketCap: profile.marketCap,
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

    // Finnhub's /stock/candle is premium-only on free tier. Use Yahoo Finance's
    // public chart endpoint for the before/after closes instead.
    async getPriceReaction(symbol, reportDate, reportTime): Promise<PriceReaction> {
      return yahooPriceReaction(symbol, reportDate, reportTime);
    },
  };
}
