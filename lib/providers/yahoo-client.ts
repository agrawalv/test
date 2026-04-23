import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3 requires instantiation (no longer a singleton default).
// Share one instance per process so the crumb/cookie cache is reused.
let client: InstanceType<typeof YahooFinance> | null = null;

export function getYahoo(): InstanceType<typeof YahooFinance> {
  if (!client) client = new YahooFinance();
  return client;
}
