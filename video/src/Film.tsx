import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, scene, wordAt, lineStart } from "./timing";
import { C } from "./theme";
import { Captions } from "./ui/Captions";
import { Grain } from "./ui/Grain";
import { clamp } from "./ui/motion";
import { Open, Problem, Turn } from "./scenes/Intro";
import { Stake, Prove, Settle } from "./scenes/Product";
import { WhyQie, Eco, Proof } from "./scenes/Chain";
import { Why, Trust, Close } from "./scenes/Outro";

const SCENES: Record<string, React.FC> = {
  open: Open, problem: Problem, turn: Turn, stake: Stake, prove: Prove, settle: Settle,
  whyqie: WhyQie, eco: Eco, proof: Proof, why: Why, trust: Trust, close: Close,
};
const OVERLAP = 12; // frames each scene starts early, to dissolve over the last

/** Each scene eases in (a short rise, un-blur and settle) over the tail of the previous one, holding its first frame. */
const SceneIn: React.FC<{ S: React.FC; first: boolean }> = ({ S, first }) => {
  const f = useCurrentFrame();
  if (first) return <S />;
  const p = interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const body = f < OVERLAP ? <Freeze frame={0}><S /></Freeze> : <Sequence from={OVERLAP} layout="none"><S /></Sequence>;
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.04 - 0.04 * p})`, filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined }}>{body}</AbsoluteFill>;
};

// --- Music, ducked under every spoken line.
const LINES = T.scenes.flatMap((s) => s.lines.map((l) => [l.startFrame, l.words[l.words.length - 1].end] as const));
const DUCK: number[] = (() => {
  const v = new Array<number>(T.totalFrames + 1).fill(0);
  for (let f = 0; f <= T.totalFrames; f++) {
    let d = 0;
    for (const [a, b] of LINES) d = Math.max(d, interpolate(f, [a - 10, a, b, b + 14], [0, 1, 1, 0], clamp));
    v[f] = d;
  }
  return v;
})();
const musicVolume = (f: number) => {
  const end = T.totalFrames;
  const fadeIn = interpolate(f, [0, 20], [0, 1], clamp);
  const fadeOut = interpolate(f, [end - 50, end], [1, 0], clamp);
  return (0.6 - 0.4 * DUCK[Math.min(end, Math.max(0, f))]) * fadeIn * fadeOut;
};

interface Fx { file: string; at: number; vol: number; dur?: number }
function effects(): Fx[] {
  const sc = (id: string) => scene(id).from;
  const w = (id: string, word: string, n = 0) => wordAt(id, word, n);
  const fx: Fx[] = [
    { file: "tick", at: 8, vol: 0.3 }, { file: "tick", at: 38, vol: 0.3 }, { file: "tick", at: 68, vol: 0.3 },
    ...["gym.", "language.", "book"].map((x) => ({ file: "pop", at: w("open", x) - 4, vol: 0.32 })),
    { file: "stamp", at: w("open", "nothing,") - 2, vol: 0.5 },
    { file: "whoosh", at: sc("problem") - 8, vol: 0.3 },
    { file: "glitch", at: w("problem", "quitting") - 2, vol: 0.3 },
    { file: "stamp", at: w("problem", "problem.") - 2, vol: 0.5 },
    { file: "riser", at: sc("turn") - 60, vol: 0.4 },
    { file: "impact", at: w("turn", "Pactiq.") - 4, vol: 0.6 },
    { file: "chime", at: w("turn", "Stake") + 2, vol: 0.3 },
    { file: "whoosh", at: sc("stake") - 8, vol: 0.3 },
    ...["three", "QIE", "locks"].map((x) => ({ file: "click", at: w("stake", x) - 2, vol: 0.4 })),
    { file: "link", at: w("stake", "touch") - 2, vol: 0.45 },
    { file: "whoosh", at: sc("prove") - 8, vol: 0.3 },
    { file: "click", at: w("prove", "Write") - 2, vol: 0.4 },
    { file: "swoosh_up", at: w("prove", "vision") - 4, vol: 0.3 },
    { file: "stamp", at: w("prove", "accept") - 6, vol: 0.55 },
    { file: "whoosh", at: sc("settle") - 8, vol: 0.3 },
    { file: "chime", at: w("settle", "refunded.") + 2, vol: 0.35 },
    { file: "denied", at: w("settle", "forfeited,") - 2, vol: 0.3 },
    { file: "coin", at: w("settle", "fifteen") - 4, vol: 0.45 },
    { file: "whoosh", at: sc("whyqie") - 8, vol: 0.3 },
    { file: "tick", at: w("whyqie", "cost") + 2, vol: 0.4 },
    { file: "impact", at: w("whyqie", "cent.") - 6, vol: 0.4 },
    { file: "swoosh_up", at: sc("eco") - 8, vol: 0.35 },
    ...["Wallet", "QUSDC", "QIEDEX", "QIE ID", "Oracle"].map((x) => ({ file: "pop", at: w("eco", x) - 4, vol: 0.4 })),
    { file: "chime", at: w("eco", "Five") + 6, vol: 0.35 },
    { file: "whoosh", at: sc("proof") - 8, vol: 0.3 },
    { file: "click", at: w("proof", "Five") + 2, vol: 0.4 },
    { file: "coin", at: w("proof", "fifty") - 2, vol: 0.4 },
    { file: "swoosh_up", at: sc("why") - 8, vol: 0.35 },
    { file: "link", at: w("why", "Proof") - 2, vol: 0.4 },
    { file: "whoosh", at: sc("trust") - 8, vol: 0.3 },
    ...["wrong,", "keys.", "signature,"].map((x) => ({ file: "click", at: w("trust", x) - 4, vol: 0.4 })),
    { file: "stamp", at: w("trust", "counts.") - 2, vol: 0.5 },
    { file: "whoosh", at: sc("close") - 8, vol: 0.3 },
    { file: "chime", at: w("close", "Pactiq.") - 2, vol: 0.45 },
  ];
  return fx.filter((x) => x.at >= 0 && x.at < T.totalFrames);
}

export const Film: React.FC = () => {
  // Captions sit out where big type already carries the words.
  const hideCaptions = (f: number) => {
    const s = T.scenes.find((x) => f >= x.from && f < x.from + x.durationInFrames);
    return !s || ["open", "problem", "turn", "close", "trust"].includes(s.id);
  };
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {T.scenes.map((s, i) => {
        const S = SCENES[s.id];
        const from = i === 0 ? s.from : s.from - OVERLAP;
        const dur = s.durationInFrames + (i === 0 ? 0 : OVERLAP);
        return S ? (
          <Sequence key={s.id} from={from} durationInFrames={dur} name={s.id}>
            <SceneIn S={S} first={i === 0} />
          </Sequence>
        ) : null;
      })}
      <Grain opacity={0.06} />
      <Captions hidden={hideCaptions} />
      <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />
      {T.scenes.flatMap((s) => s.lines).map((l, i) => (
        <Sequence key={`vo${i}`} from={l.startFrame} durationInFrames={l.durationFrames} name={`vo ${l.text.slice(0, 18)}`}>
          <Audio src={staticFile(l.file)} volume={1} />
        </Sequence>
      ))}
      {effects().map((x, i) => (
        <Sequence key={`fx${i}`} from={x.at} durationInFrames={x.dur ?? 150} name={`fx ${x.file}`}>
          <Audio src={staticFile(`audio/sfx/${x.file}.mp3`)} volume={(f) => x.vol * (x.dur ? interpolate(f, [0, 8, x.dur - 20, x.dur], [0, 1, 1, 0], clamp) : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
