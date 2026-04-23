export function formatCompactUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

export function formatPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function formatRelativeTime(ts: number): string {
  const delta = Math.floor((Date.now() - ts) / 1000);
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  const mins = Math.floor(delta / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
