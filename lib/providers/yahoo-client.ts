import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3 requires instantiation (no longer a singleton default).
// Share one instance per process so the crumb/cookie cache is reused.
let client: InstanceType<typeof YahooFinance> | null = null;

export function getYahoo(): InstanceType<typeof YahooFinance> {
  if (!client) {
    client = new YahooFinance({
      suppressNotices: ["yahooSurvey"],
    });
  }
  return client;
}

// Yahoo uses hyphenated/dotted class suffixes for preferred stocks (e.g.
// "CMS-PB" or "BRK.B"), whereas Finnhub emits them with spaces ("CMS PR B").
// Without a reliable translation table, skip these so we don't spam the
// log with "No data found" warnings for symbols Yahoo could never match.
export function isYahooQueryable(symbol: string): boolean {
  return !/\s/.test(symbol);
}
