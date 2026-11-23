import { connection, NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { fetchUserProfile } from "@/lib/pactiq";
import { CONTRACT_ADDRESS, activeChain } from "@/lib/chain";
import { BADGE_TIERS } from "@/lib/types";

const CORS = { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" };

/**
 * GET /api/score/0x… — Proof-of-Human score as JSON for off-chain integrators
 * (bots, allowlists, airdrop scripts). On-chain integrators should call
 * PactiqVault.isVerifiedHuman(user, minScore) directly.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid address" }, { status: 400, headers: CORS });
  const min = Number(req.nextUrl.searchParams.get("min") ?? "200");
  try {
    const p = await fetchUserProfile(address as Address);
    return NextResponse.json(
      {
        address,
        chainId: activeChain.id,
        contract: CONTRACT_ADDRESS,
        score: p.score,
        verifiedHuman: p.score >= min && p.totalCheckIns > 0,
        threshold: min,
        checkIns: p.totalCheckIns,
        completedPacts: p.completedPacts,
        failedPacts: p.failedPacts,
        bestStreak: p.bestStreak,
        firstActivity: p.firstActivity || null,
        badges: BADGE_TIERS.filter((t) => p.badges & t.bit).map((t) => t.name),
        qieId: p.qieId || null,
      },
      { headers: CORS }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not read reputation" }, { status: 502, headers: CORS });
  }
}
