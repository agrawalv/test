import type { Provider } from "./types";
import { createFinnhubProvider } from "./finnhub";
import { createFmpProvider } from "./fmp";

function primaryName(): "finnhub" | "fmp" {
  const n = (process.env.DATA_PROVIDER ?? "finnhub").toLowerCase();
  if (n === "finnhub" || n === "fmp") return n;
  throw new Error(`Unknown DATA_PROVIDER "${n}". Use "finnhub" or "fmp".`);
}

export function getProvider(): Provider {
  switch (primaryName()) {
    case "finnhub":
      return createFinnhubProvider();
    case "fmp":
      return createFmpProvider();
  }
}

// Returns the "other" provider if its API key is present. Used as a secondary
// source to fill gaps (missing EPS/revenue estimates/actuals) in the primary
// calendar. Returns null when the secondary key is unset or construction fails.
export function getSecondaryProvider(): Provider | null {
  const primary = primaryName();
  try {
    if (primary === "finnhub" && process.env.FMP_API_KEY) return createFmpProvider();
    if (primary === "fmp" && process.env.FINNHUB_API_KEY) return createFinnhubProvider();
  } catch {
    return null;
  }
  return null;
}

export type { Provider };
