import Link from "next/link";
import { Header } from "@/components/Header";
import { Disclaimer } from "@/components/Disclaimer";
import { DatePicker } from "@/components/DatePicker";
import { EarningsTable } from "@/components/EarningsTable";
import { getEarningsForDate } from "@/lib/earnings";
import { todayIso } from "@/lib/date";
import { formatRelativeTime } from "@/lib/format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { date?: string };
};

export default async function Page({ searchParams }: PageProps) {
  const raw = searchParams.date;
  const date = raw && DATE_RE.test(raw) ? raw : todayIso();

  let body: React.ReactNode;
  let updatedLabel: string | null = null;

  try {
    const result = await getEarningsForDate(date);
    updatedLabel = `Updated ${formatRelativeTime(result.fetchedAt)} · ${result.provider}${result.stale ? " (stale)" : ""}`;
    body = <EarningsTable rows={result.rows} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    body = (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        <p className="font-semibold">Couldn&apos;t load earnings.</p>
        <p className="mt-1 font-mono text-xs">{message}</p>
        <p className="mt-3 text-xs">
          Set <code className="font-mono">DATA_PROVIDER</code> and the matching API key in{" "}
          <code className="font-mono">.env.local</code>, then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <>
      <Header updatedLabel={updatedLabel} />
      <Disclaimer />
      <main className="mx-auto max-w-[1400px] px-4 pb-16">
        <div className="flex items-center justify-between">
          <DatePicker date={date} />
          <Link
            href="/range"
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            View 30-day range →
          </Link>
        </div>
        {body}
      </main>
    </>
  );
}
