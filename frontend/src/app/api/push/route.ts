import { NextRequest, NextResponse } from "next/server";
import { HttpError, takeAttempt } from "@/lib/server/verifier";
import { parseSubscription, pushConfigured, removeSubscription, saveSubscription, vapidPublicKey } from "@/lib/server/push";

const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

function fail(err: unknown) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  return NextResponse.json({ error: err instanceof Error && status !== 500 ? err.message : "Couldn't update reminders." }, { status });
}

/** GET /api/push → whether closed-app reminders are available, and the key browsers subscribe with. */
export async function GET() {
  return NextResponse.json({ enabled: pushConfigured(), publicKey: pushConfigured() ? vapidPublicKey() : null }, { headers: { "cache-control": "no-store" } });
}

/** POST /api/push { wallet, subscription } → remind this device about that wallet's open check-ins. */
export async function POST(req: NextRequest) {
  try {
    if (!pushConfigured()) throw new HttpError(503, "Reminders aren't configured on this deployment.");
    await takeAttempt(`push:${ip(req)}`, 30, 3600);
    const body = await req.json().catch(() => null);
    const sub = parseSubscription(body?.wallet, body?.subscription);
    if (!sub) throw new HttpError(400, "Invalid push subscription.");
    await saveSubscription(sub);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

/** DELETE /api/push { endpoint } → stop reminding this device. */
export async function DELETE(req: NextRequest) {
  try {
    await takeAttempt(`push:${ip(req)}`, 30, 3600);
    const body = await req.json().catch(() => null);
    if (typeof body?.endpoint !== "string" || body.endpoint.length > 1024) throw new HttpError(400, "Invalid endpoint.");
    await removeSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
