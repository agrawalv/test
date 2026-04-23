import { NextResponse } from "next/server";
import { addDays } from "@/lib/date";
import { getEarningsForDate } from "@/lib/earnings";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "Missing or malformed ?from=YYYY-MM-DD&to=YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json({ error: "from must be ≤ to" }, { status: 400 });
  }

  try {
    const days: { date: string; count: number }[] = [];
    let cur = from;
    const dates: string[] = [];
    while (cur <= to) {
      dates.push(cur);
      cur = addDays(cur, 1);
    }

    // fetch sequentially with a small gap to be kind to upstream rate limits
    for (const d of dates) {
      const r = await getEarningsForDate(d);
      days.push({ date: d, count: r.rows.length });
    }

    return NextResponse.json({ from, to, days });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
