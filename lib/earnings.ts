import type { EarningsRow, Provider, RawEarnings } from "./providers/types";
import { todayIso } from "./date";
import { computeSuggestion, computeSurprisePct } from "./suggestion";
import { readCache, writeCache, type CacheResult } from "./cache";

export type EarningsFetchResult = {
  date: string;
  rows: EarningsRow[];
  fetchedAt: number;
  provider: string;
  fromCache: boolean;
  stale: boolean;
};

async function enrich(raw: RawEarnings[], date: string, provider: Provider): Promise<EarningsRow[]> {
  const today = todayIso();
  const isPast = date < today;

  const batchSize = 10;
  const out: EarningsRow[] = [];

  for (let i = 0; i < raw.length; i += batchSize) {
    const batch = raw.slice(i, i + batchSize);
    const resolved = await Promise.all(
      batch.map(async (r) => {
        const epsSurprisePct = computeSurprisePct(r.epsActual, r.epsEstimate);
        const revenueSurprisePct = computeSurprisePct(r.revenueActual, r.revenueEstimate);

        let priceBefore: number | null = null;
        let priceAfter: number | null = null;
        let priceChangePct: number | null = null;

        if (isPast && (r.epsActual != null || r.revenueActual != null)) {
          const reaction = await provider.getPriceReaction(r.symbol, r.reportDate, r.reportTime);
          priceBefore = reaction.priceBefore;
          priceAfter = reaction.priceAfter;
          priceChangePct = reaction.priceChangePct;
        }

        const s = computeSuggestion({
          epsEstimate: r.epsEstimate,
          epsActual: r.epsActual,
          revenueEstimate: r.revenueEstimate,
          revenueActual: r.revenueActual,
          epsSurprisePct,
          revenueSurprisePct,
          priceChangePct,
        });

        const row: EarningsRow = {
          symbol: r.symbol,
          companyName: r.companyName,
          reportDate: r.reportDate,
          reportTime: r.reportTime,
          fiscalPeriod: r.fiscalPeriod,
          epsEstimate: r.epsEstimate,
          revenueEstimate: r.revenueEstimate,
          epsActual: r.epsActual,
          revenueActual: r.revenueActual,
          epsSurprisePct,
          revenueSurprisePct,
          priceBefore,
          priceAfter,
          priceChangePct,
          suggestion: s.suggestion,
          suggestionReason: s.suggestionReason,
          notes: s.notes,
        };
        return row;
      }),
    );
    out.push(...resolved);
    if (i + batchSize < raw.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

export async function getEarningsForDate(date: string): Promise<EarningsFetchResult> {
  const { getProvider } = await import("./providers");
  const provider = getProvider();
  const cacheKey = `earnings_${provider.name}_${date}`;

  const cached = (await readCache<EarningsRow[]>(cacheKey, date)) as CacheResult<EarningsRow[]> | null;
  if (cached && !cached.stale) {
    return {
      date,
      rows: cached.data,
      fetchedAt: cached.fetchedAt,
      provider: provider.name,
      fromCache: true,
      stale: false,
    };
  }

  try {
    const raw = await provider.getEarningsForDate(date);
    const rows = await enrich(raw, date, provider);
    const fetchedAt = await writeCache(cacheKey, rows);
    return { date, rows, fetchedAt, provider: provider.name, fromCache: false, stale: false };
  } catch (err) {
    if (cached) {
      return {
        date,
        rows: cached.data,
        fetchedAt: cached.fetchedAt,
        provider: provider.name,
        fromCache: true,
        stale: true,
      };
    }
    throw err;
  }
}
