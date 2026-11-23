import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { pushConfigured, sendDueReminders } from "@/lib/server/push";

export const maxDuration = 60;

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * GET /api/push/cron?within=4   (Authorization: Bearer $CRON_SECRET)
 *
 * Sends a reminder for every subscribed pact whose open check-in closes within `within` hours
 * (default 4, max 36). Call it hourly from any scheduler; if yours only runs daily, use within=24.
 */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push is not configured." }, { status: 503 });
  const within = Math.min(36, Math.max(1, Number(req.nextUrl.searchParams.get("within")) || 4));
  try {
    return NextResponse.json({ ok: true, within, ...(await sendDueReminders(within)) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
