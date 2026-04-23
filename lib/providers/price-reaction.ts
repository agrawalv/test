import type { PriceReaction, ReportTime } from "./types";
import { stooqPriceReaction } from "./stooq-price";
import { yahooPriceReaction } from "./yahoo-price";

// Try Stooq first — no API key, no crumb, stable. Fall back to Yahoo only
// when Stooq doesn't know the ticker (common for very recent IPOs or
// non-US listings). The first source to return an actual price wins.
export async function getPriceReactionBlended(
  symbol: string,
  reportDate: string,
  reportTime: ReportTime,
): Promise<PriceReaction> {
  const stooq = await stooqPriceReaction(symbol, reportDate, reportTime);
  if (stooq.priceBefore != null || stooq.priceAfter != null) return stooq;
  return yahooPriceReaction(symbol, reportDate, reportTime);
}
