import { getYahoo, isYahooQueryable } from "./yahoo-client";

export type YahooProfile = { name?: string; marketCap?: number };

// Batch fetch via yahoo-finance2. Internally the package handles the crumb +
// cookie dance that the raw v7/quote endpoint now requires. We still split
// into smaller chunks so a single bad symbol doesn't poison the whole batch
// and to stay within Yahoo's per-URL length ceiling.
export async function yahooQuoteInfo(symbols: string[]): Promise<Map<string, YahooProfile>> {
  const out = new Map<string, YahooProfile>();
  const queryable = symbols.filter(isYahooQueryable);
  if (queryable.length === 0) return out;

  const chunkSize = 40;
  const chunks: string[][] = [];
  for (let i = 0; i < queryable.length; i += chunkSize) {
    chunks.push(queryable.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    try {
      const results = await getYahoo().quote(chunk, {}, { validateResult: false });
      const arr = Array.isArray(results) ? results : [results];
      for (const r of arr) {
        if (!r?.symbol) continue;
        out.set(r.symbol, {
          name: r.longName ?? r.shortName,
          marketCap:
            typeof r.marketCap === "number" && r.marketCap > 0
              ? r.marketCap
              : undefined,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[yahoo-quote] batch of ${chunk.length} failed: ${msg}`);
    }
  }

  return out;
}
