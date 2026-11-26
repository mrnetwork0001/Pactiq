import React, { useId } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { scene, wordAt } from "../timing";
import { C, TONE, display, mono, sans, serif, type Tone } from "../theme";
import { clamp, expo, pop } from "../ui/motion";
import onchain from "../../data/onchain.json";

/** Scene-local frame and word cues: rel("word", n) is when the nth "word" is spoken, scene-local. */
export function useCue(id: string) {
  const s = scene(id);
  const f = useCurrentFrame();
  const rel = (w: string, n = 0) => wordAt(id, w, n) - s.from;
  return { s, f, rel, dur: s.durationInFrames };
}

export const Fill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <AbsoluteFill style={{ background: TONE[tone].bg, fontFamily: sans, color: TONE[tone].ink, overflow: "hidden" }}>{children}</AbsoluteFill>
);

export const Kicker: React.FC<{ children: React.ReactNode; tone?: Tone; size?: number; style?: React.CSSProperties }> = ({ children, tone = "light", size = 17, style }) => (
  <div style={{ fontFamily: mono, fontSize: size, letterSpacing: "0.18em", textTransform: "uppercase", color: TONE[tone].accent, display: "flex", alignItems: "center", gap: 12, ...style }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: TONE[tone].accent }} />{children}
  </div>
);

/** Fade, rise and un-blur for any block. */
export const In: React.FC<{ at: number; dur?: number; y?: number; x?: number; children: React.ReactNode; style?: React.CSSProperties; out?: number }> = ({ at, dur = 16, y = 26, x = 0, children, style, out }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: expo });
  const o = out != null ? interpolate(f, [out, out + 10], [1, 0], clamp) : 1;
  return <div style={{ opacity: p * o, transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px)`, filter: p < 1 ? `blur(${(1 - p) * 7}px)` : undefined, ...style }}>{children}</div>;
};

/** A paper card that pops in at `at`. */
export const Card: React.FC<{ at: number; left: number; top: number; width: number; tone?: Tone; accent?: string; children: React.ReactNode; style?: React.CSSProperties; out?: number }> = ({ at, left, top, width, tone = "light", accent = C.seal, children, style, out }) => {
  const f = useCurrentFrame();
  const p = pop(f, at);
  const o = interpolate(f, [at, at + 8], [0, 1], clamp) * (out != null ? interpolate(f, [out, out + 10], [1, 0], clamp) : 1);
  const light = tone !== "dark";
  return (
    <div style={{
      position: "absolute", left, top, width, opacity: o, transform: `translateY(${(1 - p) * 28}px) scale(${0.94 + 0.06 * p})`, transformOrigin: "50% 100%",
      background: light ? C.card : "#221e17", color: light ? C.ink : "#f7f2e8", padding: "22px 26px", borderRadius: 12,
      boxShadow: light ? "0 0 0 1px rgba(23,20,15,0.10), 0 24px 56px rgba(23,20,15,0.16)" : "0 0 0 1px rgba(247,242,232,0.12), 0 30px 70px rgba(0,0,0,0.5)",
      borderTop: `4px solid ${accent}`, fontFamily: sans, ...style,
    }}>{children}</div>
  );
};

/** A big headline in Fraunces. */
export const Head: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 96, style }) => (
  <div style={{ fontFamily: display, fontWeight: 600, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.02, ...style }}>{children}</div>
);
export const Italic: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color, letterSpacing: "-0.01em" }}>{children}</span>
);

/** The flame mark, drawn from the app's own SVG, with its stripes sliding in. */
const FLAME = "M54 3C60 22 85 36 85 62a35 35 0 0 1-70 0C15 50 23 41 31 33.5C31.500 41 36 46.500 43.500 47C41 32 46 15 54 3Z";
export const Mark: React.FC<{ size: number; at?: number; mono?: string }> = ({ size, at = 0, mono: one }) => {
  const f = useCurrentFrame();
  const id = useId();
  const bars: [number, number, string][] = [[0, 27, C.gold], [30, 9.5, C.seal], [42.5, 9.5, C.seal], [55, 9.5, C.seal], [67.5, 9.5, C.ink], [80, 8.5, C.ink], [91.5, 9, C.ink]];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <clipPath id={id}><path d={FLAME} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {bars.map(([y, h, c], i) => {
          const p = interpolate(f, [at + i * 3, at + i * 3 + 14], [0, 1], { ...clamp, easing: expo });
          return <rect key={i} x={(1 - p) * -110} y={y} width={100} height={h} fill={one ?? c} />;
        })}
      </g>
    </svg>
  );
};

/** The film's motif: a row of day stamps. Each one is stamped (kept) or struck (missed) at its frame. */
export const StampRow: React.FC<{ n: number; start: number; every?: number; size?: number; kept?: boolean[]; tone?: Tone; gap?: number }> = ({ n, start, every = 6, size = 54, kept, tone = "light", gap = 16 }) => {
  const f = useCurrentFrame();
  const t = TONE[tone];
  return (
    <div style={{ display: "flex", gap }}>
      {Array.from({ length: n }, (_, i) => {
        const at = start + i * every;
        const p = pop(f, at);
        const done = f >= at;
        const ok = kept ? kept[i] : true;
        const col = ok ? (tone === "dark" ? "#5fd39a" : C.kept) : C.seal;
        return (
          <div key={i} style={{ width: size, height: size, borderRadius: size, border: `2.5px ${done ? "solid" : "dashed"} ${done ? col : t.line}`, display: "grid", placeItems: "center", color: col, background: done && ok ? `${col}1f` : "transparent", transform: done ? `scale(${0.7 + 0.3 * p})` : undefined }}>
            {done && (ok ? (
              <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** A real logo from public/logos, unaltered. */
export const Logo: React.FC<{ file: string; h: number; radius?: number }> = ({ file, h, radius = 10 }) => (
  <Img src={staticFile(`logos/${file}`)} style={{ height: h, borderRadius: radius, display: "block" }} />
);

export const short = (h: string, a = 8, b = 6) => `${h.slice(0, a)}…${h.slice(-b)}`;
export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 18, color, style }) => (
  <span style={{ fontFamily: mono, fontSize: size, color, letterSpacing: "0.02em", ...style }}>{children}</span>
);

export const CHAIN = onchain as unknown as {
  readAtUTC: string; statsRaw: string; head: number; blockSeconds: number; qieUsd: number; signFeeQie: number; signFeeUsd: number;
  addresses: Record<string, string>;
  vaultTxs: { step: string; hash: string; block: number; utc: string; from: string; valueQie: number; feeQie: number }[];
};
export const FIRST_PACT = CHAIN.vaultTxs.find((t) => t.step === "createPact")!;
export const blockStr = (n: number) => n.toLocaleString("en-US");
/** A small honest label for footage that is not mainnet. */
export const SourceNote: React.FC<{ children: React.ReactNode; tone?: Tone; left?: number; top?: number }> = ({ children, tone = "light", left = 96, top = 990 }) => (
  <div style={{ position: "absolute", left, top, fontFamily: mono, fontSize: 15, letterSpacing: "0.06em", color: TONE[tone].muted }}>{children}</div>
);
