export type ReportTime = "BMO" | "AMC" | "DMH" | "UNKNOWN";

export type Suggestion = "BUY" | "SELL" | "AVOID" | "WATCH";

export type EarningsRow = {
  symbol: string;
  companyName: string;
  reportDate: string;
  reportTime: ReportTime;
  fiscalPeriod: string;

  epsEstimate: number | null;
  revenueEstimate: number | null;

  epsActual: number | null;
  revenueActual: number | null;
  epsSurprisePct: number | null;
  revenueSurprisePct: number | null;

  priceBefore: number | null;
  priceAfter: number | null;
  priceChangePct: number | null;

  suggestion: Suggestion;
  suggestionReason: string;
  notes: string | null;
};

export type RawEarnings = Omit<
  EarningsRow,
  | "epsSurprisePct"
  | "revenueSurprisePct"
  | "priceBefore"
  | "priceAfter"
  | "priceChangePct"
  | "suggestion"
  | "suggestionReason"
  | "notes"
> & {
  notes?: string | null;
};

export type PriceReaction = {
  priceBefore: number | null;
  priceAfter: number | null;
  priceChangePct: number | null;
};

export interface Provider {
  name: string;
  getEarningsForDate(date: string): Promise<RawEarnings[]>;
  getPriceReaction(symbol: string, reportDate: string, reportTime: ReportTime): Promise<PriceReaction>;
}
