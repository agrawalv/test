import Link from "next/link";
import { Header } from "@/components/Header";
import { Disclaimer } from "@/components/Disclaimer";
import { RangeList } from "@/components/RangeList";
import { addDays, todayIso } from "@/lib/date";
import { getEarningsForDate } from "@/lib/earnings";

export const dynamic = "force-dynamic";

export default async function RangePage() {
  const today = todayIso();
  const from = addDays(today, -30);
  const to = addDays(today, 30);

  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }

  let items: { date: string; count: number }[] = [];
  let error: string | null = null;

  try {
    // Sequential to respect rate limits; cache will make repeat loads fast.
    for (const d of dates) {
      const r = await getEarningsForDate(d);
      items.push({ date: d, count: r.rows.length });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <Header />
      <Disclaimer />
      <main className="mx-auto max-w-[1400px] px-4 pb-16">
        <div className="flex items-center justify-between py-3">
          <div>
            <h1 className="text-lg font-semibold">30-day range</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {from} to {to}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← Back to day view
          </Link>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            <p className="font-semibold">Couldn&apos;t load range.</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
          </div>
        ) : (
          <RangeList today={today} items={items} />
        )}
      </main>
    </>
  );
}
