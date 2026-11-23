import { NextRequest, NextResponse } from "next/server";
import {
  HttpError,
  assertEligible,
  challengeCode,
  demoJudgement,
  aiVerifierConfigured,
  demoVerifierEnabled,
  judgePhoto,
  parseIds,
  signAttestation,
  takeAttempt,
} from "@/lib/server/verifier";
import type { VerifyProofResponse } from "@/lib/types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/verify-proof
 * body: { pactId, dayIndex, userAddress, image: "data:image/jpeg;base64,…" }
 *
 * 1. Check on-chain that the pact belongs to the user and the day is open.
 * 2. Ask the vision model whether the photo is genuine proof containing today's code.
 * 3. If approved, sign an attestation the contract will accept for exactly this pact/day/user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new HttpError(400, "Invalid JSON body");
    });
    const { pactId, day, user } = parseIds(body?.pactId, body?.dayIndex, body?.userAddress);

    const match = typeof body?.image === "string" ? body.image.match(/^data:([\w/+.-]+);base64,(.+)$/) : null;
    if (!match) throw new HttpError(400, "A photo is required (data URL).");
    const [, mime, base64] = match;
    if (!ALLOWED_MIME.has(mime)) throw new HttpError(415, "Use a JPEG, PNG or WebP photo.");
    const imageBytes = new Uint8Array(Buffer.from(base64, "base64"));
    if (imageBytes.length < 1_000) throw new HttpError(400, "Photo is empty or too small.");
    if (imageBytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Photo is too large (max 4 MB).");

    const pact = await assertEligible(pactId, day, user);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    await takeAttempt(`ip:${ip}`, 60, 3600);
    const attemptsLeft = await takeAttempt(`pact:${pactId}:${day}`);

    const code = challengeCode(pactId, day, user);
    // A real AI verifier always wins; the demo verifier is only a fallback off mainnet.
    const judgement =
      aiVerifierConfigured() || !demoVerifierEnabled()
        ? await judgePhoto({ mime, base64 }, { title: pact.title, category: pact.category, code })
        : demoJudgement(code);

    const response: VerifyProofResponse = {
      verified: judgement.approved,
      verifier: judgement.verifier,
      confidence: judgement.confidence,
      reasoning: judgement.reasoning,
      detectedFeatures: judgement.detectedFeatures,
      checks: {
        codeVisible: judgement.codeVisible,
        activityMatches: judgement.activityMatches,
        appearsAuthentic: judgement.appearsAuthentic,
      },
      attemptsLeft,
    };

    if (judgement.approved) {
      const { proofHash, signature } = await signAttestation(pactId, day, user, imageBytes);
      response.proofHash = proofHash;
      response.signature = signature;
    }

    return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Internal error";
    if (status === 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}
