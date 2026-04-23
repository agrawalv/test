// Anonymous Yahoo Finance quote lookup for profile fields (market cap + name).
//
// The v7/finance/quote endpoint became crumb-gated in 2024 for most clients, so
// we treat this as best-effort: success fills gaps, any failure is swallowed
// and the caller just keeps whatever it had.

export type YahooProfile = { name?: string; marketCap?: number };

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: Array<{
      symbol: string;
      longName?: string;
      shortName?: string;
      marketCap?: number;
    }>;
  };
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function yahooQuoteInfo(symbols: string[]): Promise<Map<string, YahooProfile>> {
  const out = new Map<string, YahooProfile>();
  if (symbols.length === 0) return out;

  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += 50) batches.push(symbols.slice(i, i + 50));

  for (const batch of batches) {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(batch.join(","))}`;
      const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as YahooQuoteResponse;
      for (const r of data.quoteResponse?.result ?? []) {
        out.set(r.symbol, {
          name: r.longName ?? r.shortName,
          marketCap: typeof r.marketCap === "number" && r.marketCap > 0 ? r.marketCap : undefined,
        });
      }
    } catch {
      // best-effort; ignore and continue with next batch
    }
  }

  return out;
}
