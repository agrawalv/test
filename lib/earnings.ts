import type { EarningsRow, Provider, RawEarnings } from "./providers/types";
import { todayIso } from "./date";
import { computeSuggestion, computeSurprisePct } from "./suggestion";
import { readCache, writeCache, type CacheResult } from "./cache";

export type EarningsFetchResult = {
  date: string;
  rows: EarningsRow[];
  fetchedAt: number;
  provider: string;
  sources: string[];
  fromCache: boolean;
  stale: boolean;
};

// Merge two calendar lists by symbol. Primary wins on any non-null field;
// secondary fills in whatever's missing.
function mergeCalendars(primary: RawEarnings[], secondary: RawEarnings[]): RawEarnings[] {
  const bySymbol = new Map<string, RawEarnings>();
  for (const r of secondary) bySymbol.set(r.symbol, r);

  const seen = new Set<string>();
  const out: RawEarnings[] = [];
  for (const p of primary) {
    seen.add(p.symbol);
    const s = bySymbol.get(p.symbol);
    if (!s) {
      out.push(p);
      continue;
    }
    out.push({
      ...p,
      companyName:
        p.companyName && p.companyName !== p.symbol
          ? p.companyName
          : (s.companyName && s.companyName !== s.symbol ? s.companyName : p.companyName),
      fiscalPeriod: p.fiscalPeriod || s.fiscalPeriod,
      reportTime: p.reportTime !== "UNKNOWN" ? p.reportTime : s.reportTime,
      marketCap: p.marketCap ?? s.marketCap,
      epsEstimate: p.epsEstimate ?? s.epsEstimate,
      revenueEstimate: p.revenueEstimate ?? s.revenueEstimate,
      epsActual: p.epsActual ?? s.epsActual,
      revenueActual: p.revenueActual ?? s.revenueActual,
    });
  }
  // Secondary-only symbols are ignored — primary defines "who reports today".
  // If you'd rather union, uncomment:
  // for (const s of secondary) if (!seen.has(s.symbol)) out.push(s);
  return out;
}

async function enrichYahooProfiles(
  rows: RawEarnings[],
): Promise<{ rows: RawEarnings[]; contributed: boolean }> {
  const need = rows.filter((r) => r.marketCap == null || r.companyName === r.symbol);
  if (need.length === 0) return { rows, contributed: false };
  try {
    const { yahooQuoteInfo } = await import("./providers/yahoo-quote");
    const info = await yahooQuoteInfo(need.map((r) => r.symbol));
    if (info.size === 0) return { rows, contributed: false };
    let contributed = false;
    const merged = rows.map((r) => {
      const y = info.get(r.symbol);
      if (!y) return r;
      const nextName =
        r.companyName && r.companyName !== r.symbol
          ? r.companyName
          : (y.name ?? r.companyName);
      const nextMarketCap = r.marketCap ?? y.marketCap ?? null;
      if (nextName !== r.companyName || nextMarketCap !== r.marketCap) {
        contributed = true;
      }
      return { ...r, companyName: nextName, marketCap: nextMarketCap };
    });
    return { rows: merged, contributed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[yahoo-quote] enrichment failed: ${msg}`);
    return { rows, contributed: false };
  }
}

async function enrich(
  raw: RawEarnings[],
  date: string,
  provider: Provider,
): Promise<EarningsRow[]> {
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

        if (isPast) {
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
          marketCap: r.marketCap,
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

  out.sort((a, b) => {
    const am = a.marketCap;
    const bm = b.marketCap;
    if (am != null && bm != null && am !== bm) return bm - am;
    if (am != null && bm == null) return -1;
    if (am == null && bm != null) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
  return out;
}

export async function getEarningsForDate(date: string): Promise<EarningsFetchResult> {
  const { getProvider, getSecondaryProvider } = await import("./providers");
  const provider = getProvider();
  const secondary = getSecondaryProvider();
  const cacheKey = `earnings_${provider.name}${secondary ? `_${secondary.name}` : ""}_${date}`;

  const cached = (await readCache<{
    rows: EarningsRow[];
    sources: string[];
  }>(cacheKey, date)) as CacheResult<{ rows: EarningsRow[]; sources: string[] }> | null;
  if (cached && !cached.stale) {
    return {
      date,
      rows: cached.data.rows,
      fetchedAt: cached.fetchedAt,
      provider: provider.name,
      sources: cached.data.sources ?? [provider.name],
      fromCache: true,
      stale: false,
    };
  }

  try {
    const sources: string[] = [provider.name];
    let raw = await provider.getEarningsForDate(date);

    if (secondary) {
      try {
        const supplement = await secondary.getEarningsForDate(date);
        raw = mergeCalendars(raw, supplement);
        sources.push(secondary.name);
      } catch {
        // secondary is optional — don't fail the request if it errors
      }
    }

    const yahooResult = await enrichYahooProfiles(raw);
    raw = yahooResult.rows;
    const yahooHelped = yahooResult.contributed;

    const enriched = await enrich(raw, date, provider);

    // Tag yahoo as a source only when it actually contributed — either a
    // profile field got filled, or at least one past-date price came back.
    const yahooPricesLanded = enriched.some((r) => r.priceBefore != null || r.priceAfter != null);
    if (yahooHelped || yahooPricesLanded) sources.push("yahoo");

    const rows = enriched;
    const fetchedAt = await writeCache(cacheKey, { rows, sources });
    return {
      date,
      rows,
      fetchedAt,
      provider: provider.name,
      sources,
      fromCache: false,
      stale: false,
    };
  } catch (err) {
    if (cached) {
      return {
        date,
        rows: cached.data.rows,
        fetchedAt: cached.fetchedAt,
        provider: provider.name,
        sources: cached.data.sources ?? [provider.name],
        fromCache: true,
        stale: true,
      };
    }
    throw err;
  }
}
