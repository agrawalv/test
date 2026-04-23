import { NextResponse } from "next/server";
import { getEarningsForDate } from "@/lib/earnings";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Missing or malformed ?date=YYYY-MM-DD" },
      { status: 400 },
    );
  }
  try {
    const result = await getEarningsForDate(date);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
