# Earnings Tracker

A simple Next.js 14 web app that shows companies reporting earnings by day, compares actual vs. estimated EPS/revenue, displays post-earnings price reactions, and emits a naive rule-based day-trade suggestion per ticker.

**Disclaimer:** This is not financial advice. Suggestions are rule-based heuristics, not predictions.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Server-side fetch + in-memory + disk cache (`.cache/`)
- Providers: Finnhub (primary), Financial Modeling Prep (fallback). Swap via `DATA_PROVIDER`.

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set your API key
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DATA_PROVIDER` | `finnhub` | `finnhub` or `fmp` |
| `FINNHUB_API_KEY` | — | Required if provider is `finnhub` |
| `FMP_API_KEY` | — | Required if provider is `fmp` |
| `CACHE_TTL_TODAY_MIN` | `15` | Cache TTL for today's earnings (minutes) |
| `CACHE_TTL_PAST_HOURS` | `24` | Cache TTL for past dates (hours) |
| `CACHE_TTL_FUTURE_HOURS` | `1` | Cache TTL for future dates (hours) |

The app fails loudly with a clear error if no API key is set.

## Routes

- `/` — earnings for a selected day (default: today). `?date=YYYY-MM-DD` to deep-link.
- `/range` — 30 days past + 30 days future grouped by date.
- `GET /api/earnings?date=YYYY-MM-DD` — JSON for one day.
- `GET /api/earnings/range?from=...&to=...` — count per day in a range.

## Keyboard

- `←` / `→` — previous / next day
- `t` — jump to today

## Suggestion rules

Evaluated in order, server-side, once actuals are known:

1. **BUY** — EPS surprise ≥ +5% AND revenue surprise ≥ +2% AND price move < +3%
2. **SELL** — (EPS surprise ≤ -5% OR revenue surprise ≤ -3%) AND price move > -2%
3. **AVOID** — |EPS surprise| < 2% AND |price move| > 5%
4. **WATCH** — otherwise (also the default for upcoming earnings)
