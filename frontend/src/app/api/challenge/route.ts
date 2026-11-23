import { connection, NextRequest, NextResponse } from "next/server";
import { HttpError, assertEligible, challengeCode, parseIds } from "@/lib/server/verifier";
import type { ChallengeResponse } from "@/lib/types";

/** GET /api/challenge?pactId=1&dayIndex=3&userAddress=0x… → today's anti-spoof code. */
export async function GET(req: NextRequest) {
  await connection(); // always run at request time; never prerender
  try {
    const q = req.nextUrl.searchParams;
    const { pactId, day, user } = parseIds(q.get("pactId"), q.get("dayIndex"), q.get("userAddress"));
    const pact = await assertEligible(pactId, day, user);
    const code = challengeCode(pactId, day, user);
    const body: ChallengeResponse = {
      code,
      closesAt: pact.closesAt,
      instruction: `Write ${code} on a piece of paper or a sticky note and take a photo that shows it together with your activity.`,
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Internal error";
    if (status === 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}
