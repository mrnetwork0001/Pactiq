import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Film } from "./Film";
import { T, scene } from "./timing";
import { display, mono, sans } from "./theme";
import { clamp, expo } from "./ui/motion";
import { Logo, Mark } from "./scenes/common";

/** A vertical YouTube Short cut from the film: the hook, the turn, the daily proof, the payout, then a card. */
const APP = { x: 80, w: 1270 };
const LOCAL = "Recorded on a local fork of QIE Mainnet.";
const PICK: { id: string; title: string; crop?: { x: number; w: number }; note?: string }[] = [
  { id: "open", title: "You quit for free." },
  { id: "turn", title: "So put a price on it." },
  { id: "prove", title: "Prove it, every day.", crop: APP, note: `${LOCAL} Demo verifier, stand-in photo.` },
  { id: "settle", title: "Keep the day. Keep the money.", crop: APP, note: LOCAL },
];
const END = 120;

const SEGS = (() => {
  let at = 0;
  return PICK.map((p) => {
    const s = scene(p.id);
    const seg = { ...p, src: s.from, len: s.durationInFrames, at, lines: s.lines };
    at += s.durationInFrames;
    return seg;
  });
})();
export const SHORT_FRAMES = SEGS.reduce((n, s) => n + s.len, 0) + END;
const END_AT = SHORT_FRAMES - END;

// Every spoken word, moved to Short time.
const WORDS = SEGS.flatMap((s) => s.lines.map((l) => l.words.map((w) => ({ ...w, start: w.start - s.src + s.at, end: w.end - s.src + s.at }))));
const INK = "#17140f";
const PAPER = "#f7f2e8";
const SEAL = "#ff6a45";

const musicVolume = (f: number) => {
  let d = 0;
  for (const l of WORDS) d = Math.max(d, interpolate(f, [l[0].start - 10, l[0].start, l[l.length - 1].end, l[l.length - 1].end + 14], [0, 1, 1, 0], clamp));
  return (0.55 - 0.38 * d) * interpolate(f, [0, 15], [0, 1], clamp) * interpolate(f, [SHORT_FRAMES - 40, SHORT_FRAMES], [1, 0], clamp);
};

const Caption: React.FC<{ top: number }> = ({ top }) => {
  const f = useCurrentFrame();
  const line = WORDS.find((l) => f >= l[0].start - 4 && f <= l[l.length - 1].end + 12);
  if (!line) return null;
  const chunks: (typeof line)[] = [];
  let cur: typeof line = [];
  for (const w of line) {
    cur.push(w);
    if ((/[.,:;?]$/.test(w.word) && cur.length >= 2) || cur.length >= 5) { chunks.push(cur); cur = []; }
  }
  if (cur.length) chunks.push(cur);
  let shown = chunks[0];
  for (const c of chunks) if (f >= c[0].start - 3) shown = c;
  const pop = interpolate(f, [shown[0].start - 3, shown[0].start + 5], [0.92, 1], { ...clamp, easing: expo });
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top, textAlign: "center", transform: `scale(${pop})` }}>
      <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 70, lineHeight: 1.18, letterSpacing: "-0.02em" }}>
        {shown.map((w, i) => {
          const on = f >= w.start - 2;
          const now = on && f <= w.end + 2;
          return <span key={i} style={{ color: now ? SEAL : PAPER, opacity: on ? 1 : 0.35 }}>{w.word} </span>;
        })}
      </span>
    </div>
  );
};

const Frame: React.FC = () => {
  const f = useCurrentFrame();
  const seg = SEGS.find((s) => f >= s.at && f < s.at + s.len) ?? SEGS[SEGS.length - 1];
  const tIn = interpolate(f, [seg.at, seg.at + 10], [0, 1], { ...clamp, easing: expo });
  const crop = seg.crop ?? { x: 0, w: 1920 };
  const k = 1080 / crop.w;
  const H = Math.round(1080 * k);
  const top = 560;
  return (
    <>
      <div style={{ position: "absolute", left: 70, top: 130, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ background: "#fff7ee", borderRadius: 18, padding: 10 }}><Mark size={58} /></div>
        <div style={{ fontFamily: display, fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em", color: PAPER }}>Pactiq</div>
        <div style={{ marginLeft: 16, fontFamily: mono, fontSize: 22, letterSpacing: "0.16em", color: "rgba(247,242,232,0.55)" }}>ON QIE</div>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 290, fontFamily: display, fontSize: 92, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.02, color: PAPER, opacity: tIn, transform: `translateY(${(1 - tIn) * 24}px)` }}>
        {seg.title}
      </div>
      <div style={{ position: "absolute", left: 0, top, width: 1080, height: H, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        {SEGS.map((s) => (
          <Sequence key={s.id} from={s.at} durationInFrames={s.len} layout="none">
            <div style={{ width: 1920, height: 1080, transform: `scale(${k}) translateX(${-crop.x}px)`, transformOrigin: "0 0" }}>
              <Sequence from={-s.src} layout="none"><Film music={false} captions={false} /></Sequence>
            </div>
          </Sequence>
        ))}
      </div>
      {seg.note && <div style={{ position: "absolute", left: 70, right: 70, top: top + H + 18, fontFamily: mono, fontSize: 22, color: "rgba(247,242,232,0.5)", textAlign: "center" }}>{seg.note}</div>}
      <Caption top={top + H + (seg.note ? 110 : 80)} />
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 120, height: 6, borderRadius: 3, background: "rgba(247,242,232,0.15)" }}>
        <div style={{ height: 6, borderRadius: 3, width: `${(f / END_AT) * 100}%`, background: SEAL }} />
      </div>
    </>
  );
};

const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const o = (a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: expo });
  return (
    <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: o(0, 12) }}>
      <div style={{ background: "#fff7ee", borderRadius: 44, padding: 30, transform: `scale(${0.9 + 0.1 * o(0, 20)})` }}><Mark size={200} at={2} /></div>
      <div style={{ fontFamily: display, fontSize: 170, fontWeight: 700, letterSpacing: "-0.05em", color: PAPER, marginTop: 40 }}>Pactiq</div>
      <div style={{ fontFamily: display, fontSize: 64, fontWeight: 500, letterSpacing: "-0.03em", color: PAPER, textAlign: "center", lineHeight: 1.1, marginTop: 20, opacity: o(10, 30) }}>
        Stake on a habit.<br />Get every <span style={{ color: SEAL, fontStyle: "italic" }}>kept</span> day back.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 90, opacity: o(24, 44) }}>
        <span style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.18em", color: "rgba(247,242,232,0.6)" }}>BUILT ON</span>
        <Logo file="qie-logo.png" h={70} radius={14} />
        <span style={{ fontFamily: display, fontSize: 52, fontWeight: 600, color: PAPER }}>QIE Mainnet</span>
      </div>
    </AbsoluteFill>
  );
};

export const Short: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={END_AT} layout="none"><Frame /></Sequence>
    <Sequence from={END_AT}><EndCard /></Sequence>
    <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />
    <Sequence from={END_AT}><Audio src={staticFile("audio/sfx/chime.mp3")} volume={0.45} /></Sequence>
  </AbsoluteFill>
);

export const SHORT_FPS = T.fps;
