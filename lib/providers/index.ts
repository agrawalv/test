import type { Provider } from "./types";
import { createFinnhubProvider } from "./finnhub";
import { createFmpProvider } from "./fmp";

export function getProvider(): Provider {
  const name = (process.env.DATA_PROVIDER ?? "finnhub").toLowerCase();
  switch (name) {
    case "finnhub":
      return createFinnhubProvider();
    case "fmp":
      return createFmpProvider();
    default:
      throw new Error(`Unknown DATA_PROVIDER "${name}". Use "finnhub" or "fmp".`);
  }
}

export type { Provider };
