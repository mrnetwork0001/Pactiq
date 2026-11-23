import { ImageResponse } from "next/og";
import { connection, NextRequest } from "next/server";
import { isAddress, type Address } from "viem";
import { fetchSquad, fetchUserProfile } from "@/lib/pactiq";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAsset } from "@/lib/assets";
import { BADGE_TIERS, CATEGORY_LABELS } from "@/lib/types";
import { activeChain } from "@/lib/chain";

const PAPER = "#f2ede3";
const CARD = "#fbf8f2";
const INK = "#17140f";
const INK2 = "#4b453b";
const INK3 = "#847c6e";
const RULE = "#d6ccb9";
const SEAL = "#d13c1f";
const KEPT = "#1d6a46";
const GOLD = "#9c6f12";
const SIZE = { width: 1200, height: 630 };

// ---------------------------------------------------------------- fonts
// Satori needs TTF/OTF; Google Fonts serves TTF to clients that don't advertise woff2 support.
type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" | "italic" };
let fontsPromise: Promise<Font[]> | null = null;

async function googleFont(family: string, spec: string): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${spec}&display=swap`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family}`);
  return (await fetch(url)).arrayBuffer();
}

function loadFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([
    googleFont("Fraunces", "wght@600").then((data): Font => ({ name: "Fraunces", data, weight: 600, style: "normal" })),
    googleFont("Fraunces", "ital,wght@1,400").then((data): Font => ({ name: "Fraunces", data, weight: 400, style: "italic" })),
    googleFont("IBM+Plex+Mono", "wght@400").then((data): Font => ({ name: "Plex Mono", data, weight: 400, style: "normal" })),
  ]).catch((e) => {
    console.error("card fonts unavailable, using default", e);
    fontsPromise = null;
    return [];
  });
  return fontsPromise;
}

// ---------------------------------------------------------------- pieces

function scallop(cx: number, cy: number, r: number, bumps: number, depth: number) {
  const pts: string[] = [];
  const steps = bumps * 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r - depth * (0.5 - 0.5 * Math.cos(a * bumps));
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}
const SEAL_PATH = scallop(50, 50, 48, 18, 4);

const kicker = { fontFamily: "Plex Mono", fontSize: 20, letterSpacing: 3, textTransform: "uppercase" as const, color: INK3 };

/** The Pactiq logo (same drawing as Mark in components/ui.tsx). */
function FlameMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <clipPath id="flame">
        <path d="M54 3C60 22 85 36 85 62a35 35 0 0 1-70 0C15 50 23 41 31 33.5C31.500 41 36 46.500 43.500 47C41 32 46 15 54 3Z" />
      </clipPath>
      <g clipPath="url(#flame)">
        <rect y="0" width="100" height="27" fill="#9c6f12" />
        <rect y="30" width="100" height="9.5" fill="#d13c1f" />
        <rect y="42.5" width="100" height="9.5" fill="#d13c1f" />
        <rect y="55" width="100" height="9.5" fill="#d13c1f" />
        <rect y="67.5" width="100" height="9.5" fill="#17140f" />
        <rect y="80" width="100" height="8.5" fill="#17140f" />
        <rect y="91.5" width="100" height="9" fill="#17140f" />
      </g>
    </svg>
  );
}

function SealMark({ size, color = SEAL, label }: { size: number; color?: string; label?: string }) {
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <path d={SEAL_PATH} fill={color} />
        <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        {!label && <path d="M33 51l11 11 24-25" fill="none" stroke={CARD} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {label && <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: size * 0.34, color: CARD }}>{label}</div>}
    </div>
  );
}

function Frame({ children, tag }: { children: React.ReactNode; tag: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 28, fontFamily: "Fraunces" }}>
      <div style={{ flex: 1, display: "flex", border: `4px solid ${INK}`, padding: 6 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: `1.5px solid ${INK}`,
            background: CARD,
            padding: "40px 52px",
            color: INK,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <FlameMark size={52} />
              <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
                Pactiq
              </div>
            </div>
            <div style={{ ...kicker, display: "flex" }}>{tag}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Fig({ label, value, color = INK }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", paddingRight: 36, marginRight: 36, borderRight: `1.5px solid ${RULE}` }}>
      <div style={{ ...kicker, fontSize: 17, display: "flex" }}>{label}</div>
      <div style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 44, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const headers = (maxAge: number) => ({ "cache-control": `public, max-age=${maxAge}` });

// ---------------------------------------------------------------- route

/** GET /api/card?address=0x… (certificate) or /api/card?squad=3 (charter) → 1200×630 share image. */
export async function GET(req: NextRequest) {
  await connection();
  const q = req.nextUrl.searchParams;
  const address = q.get("address");
  const squadId = Number(q.get("squad"));
  const fonts = await loadFonts();
  const opts = (maxAge: number) => ({ ...SIZE, fonts, headers: headers(maxAge) });

  try {
    if (address && isAddress(address)) {
      const p = await fetchUserProfile(address as Address);
      const name = p.qieId || shortAddress(address);
      return new ImageResponse(
        (
          <Frame tag="Certificate of discipline">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 46, fontStyle: "italic", fontWeight: 400, color: INK2 }}>{name}</div>
                <div style={{ display: "flex", fontSize: 190, fontWeight: 600, lineHeight: 1, letterSpacing: -6, marginTop: 6 }}>{p.score}</div>
                <div style={{ display: "flex", fontSize: 34, fontStyle: "italic", fontWeight: 400, color: INK2, marginTop: 6 }}>Proof-of-Human score</div>
              </div>
              <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
                {BADGE_TIERS.map((t) =>
                  p.badges & t.bit ? (
                    <SealMark key={t.bit} size={104} color={t.color} label={String(t.days)} />
                  ) : (
                    <div
                      key={t.bit}
                      style={{
                        display: "flex",
                        width: 104,
                        height: 104,
                        borderRadius: 52,
                        border: `3px dashed ${RULE}`,
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 34,
                        color: INK3,
                      }}
                    >
                      {t.days}
                    </div>
                  )
                )}
              </div>
            </div>
            <div style={{ display: "flex", borderTop: `2px solid ${INK}`, paddingTop: 18 }}>
              <Fig label="Check-ins" value={String(p.totalCheckIns)} color={KEPT} />
              <Fig label="Best streak" value={`${p.bestStreak}d`} color={SEAL} />
              <Fig label="Pacts kept" value={String(p.completedPacts)} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ ...kicker, fontSize: 17, display: "flex" }}>Staked on</div>
                <div style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 44, marginTop: 4 }}>{activeChain.name.replace("QIE ", "QIE·")}</div>
              </div>
            </div>
          </Frame>
        ),
        opts(300)
      );
    }

    if (Number.isSafeInteger(squadId) && squadId > 0) {
      const s = await fetchSquad(squadId);
      if (!s) return new Response("Not found", { status: 404 });
      const pot = s.finalized ? s.bonusPerFinisher : s.sponsorPool;
      return new ImageResponse(
        (
          <Frame tag={s.sponsor ? `Sponsored by ${s.sponsor}` : "You're invited"}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ ...kicker, display: "flex", color: SEAL }}>
                Squad charter Nº {s.id} · {CATEGORY_LABELS[s.category]} · {s.totalDays} days
              </div>
              <div style={{ display: "flex", fontSize: 84, fontWeight: 600, lineHeight: 1.02, letterSpacing: -2, marginTop: 14, maxWidth: 1000 }}>
                {s.title}
              </div>
              <div style={{ display: "flex", fontSize: 34, fontStyle: "italic", fontWeight: 400, color: INK2, marginTop: 14 }}>
                Commit together. Quitters pay the finishers.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `2px solid ${INK}`, paddingTop: 18 }}>
              <div style={{ display: "flex" }}>
                <Fig label="Stake / day" value={formatAsset(s.dailyStake, assetOf(s.asset))} />
                <Fig label="Seats" value={`${s.memberCount}/${s.maxMembers}`} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ ...kicker, fontSize: 17, display: "flex", color: GOLD }}>{s.finalized ? "Bonus each" : "Prize pot"}</div>
                <div style={{ display: "flex", fontSize: 76, fontWeight: 600, color: GOLD, lineHeight: 1 }}>{formatAsset(pot, assetOf(s.asset))}</div>
              </div>
            </div>
          </Frame>
        ),
        opts(300)
      );
    }

    return new ImageResponse(
      (
        <Frame tag={`Proof-of-discipline on ${activeChain.name}`}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 600, lineHeight: 0.98, letterSpacing: -3 }}>Make a pact with yourself.</div>
            <div style={{ display: "flex", fontSize: 104, fontStyle: "italic", fontWeight: 400, lineHeight: 1.05, letterSpacing: -2, color: SEAL }}>
              Put money on it.
            </div>
          </div>
          <div style={{ ...kicker, display: "flex", fontSize: 22 }}>AI-witnessed daily check-ins · squads · soulbound streak seals</div>
        </Frame>
      ),
      opts(3600)
    );
  } catch (err) {
    console.error(err);
    return new Response("Card unavailable", { status: 502 });
  }
}
