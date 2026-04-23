import type { EarningsRow, Suggestion } from "./providers/types";

export type SuggestionOutput = {
  suggestion: Suggestion;
  suggestionReason: string;
  notes: string | null;
};

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function computeSuggestion(
  row: Pick<
    EarningsRow,
    | "epsEstimate"
    | "epsActual"
    | "revenueEstimate"
    | "revenueActual"
    | "epsSurprisePct"
    | "revenueSurprisePct"
    | "priceChangePct"
  >,
): SuggestionOutput {
  const hasActuals = row.epsActual != null || row.revenueActual != null;
  if (!hasActuals) {
    return {
      suggestion: "WATCH",
      suggestionReason: "Awaiting results",
      notes: null,
    };
  }

  const eps = row.epsSurprisePct;
  const rev = row.revenueSurprisePct;
  const move = row.priceChangePct;

  const epsTxt = fmtPct(eps);
  const revTxt = fmtPct(rev);
  const moveTxt = fmtPct(move);

  // Rule 1: BUY — beat on both, price hasn't priced it in
  if (
    eps != null &&
    rev != null &&
    move != null &&
    eps >= 5 &&
    rev >= 2 &&
    move < 3
  ) {
    return {
      suggestion: "BUY",
      suggestionReason: `Beat EPS ${epsTxt}, revenue ${revTxt}, price only ${moveTxt} — room to run`,
      notes: describe(eps, rev, move),
    };
  }

  // Rule 2: SELL — big miss, stock hasn't dropped enough
  if (
    ((eps != null && eps <= -5) || (rev != null && rev <= -3)) &&
    move != null &&
    move > -2
  ) {
    return {
      suggestion: "SELL",
      suggestionReason: `Miss (EPS ${epsTxt}, rev ${revTxt}) but stock only ${moveTxt} — downside left`,
      notes: describe(eps, rev, move),
    };
  }

  // Rule 3: AVOID — noisy reaction, unclear signal
  if (
    eps != null &&
    move != null &&
    Math.abs(eps) < 2 &&
    Math.abs(move) > 5
  ) {
    return {
      suggestion: "AVOID",
      suggestionReason: `EPS near estimate (${epsTxt}) but price moved ${moveTxt} — noisy`,
      notes: describe(eps, rev, move),
    };
  }

  return {
    suggestion: "WATCH",
    suggestionReason: `EPS ${epsTxt}, revenue ${revTxt}, price ${moveTxt}`,
    notes: describe(eps, rev, move),
  };
}

function describe(
  eps: number | null,
  rev: number | null,
  move: number | null,
): string {
  const parts: string[] = [];
  if (eps != null) parts.push(`${eps >= 0 ? "Beat" : "Missed"} EPS ${fmtPct(eps)}`);
  if (rev != null) parts.push(`${rev >= 0 ? "beat" : "missed"} revenue ${fmtPct(rev)}`);
  if (move != null) parts.push(`price ${fmtPct(move)}`);
  return parts.join("; ");
}

export function computeSurprisePct(actual: number | null, estimate: number | null): number | null {
  if (actual == null || estimate == null || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}
