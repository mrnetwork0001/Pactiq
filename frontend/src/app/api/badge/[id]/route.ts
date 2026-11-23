import { connection, NextRequest, NextResponse } from "next/server";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import { PACTIQ_ABI } from "@/lib/pactiqAbi";
import { BADGES_ABI } from "@/lib/badgesAbi";
import { publicClient } from "@/lib/pactiq";
import { BADGE_TIERS } from "@/lib/types";
import { appUrl, profileUrl } from "@/lib/share";

/** GET /api/badge/1 → ERC-721 metadata for soulbound badge #1 (PactiqBadges.tokenURI points here). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = BigInt((await params).id.replace(/\D/g, "") || "0");
  if (!CONTRACT_ADDRESS || id === 0n) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const badges = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: PACTIQ_ABI, functionName: "badges" });
    const [owner, tier] = await Promise.all([
      publicClient.readContract({ address: badges, abi: BADGES_ABI, functionName: "ownerOf", args: [id] }),
      publicClient.readContract({ address: badges, abi: BADGES_ABI, functionName: "tierOf", args: [id] }),
    ]);
    const t = BADGE_TIERS[tier] ?? BADGE_TIERS[0];
    return NextResponse.json(
      {
        name: `${t.name} #${id}`,
        description: `Soulbound Pactiq badge: a ${t.days}-day streak of AI-verified daily check-ins, staked on QIE. Non-transferable.`,
        image: `${appUrl()}/badges/tier-${tier}.svg`,
        external_url: profileUrl(owner),
        attributes: [
          { trait_type: "Tier", value: t.name },
          { trait_type: "Streak days", value: t.days, display_type: "number" },
          { trait_type: "Soulbound", value: "Yes" },
        ],
      },
      { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } }
    );
  } catch {
    return NextResponse.json({ error: "Badge not found" }, { status: 404 });
  }
}
