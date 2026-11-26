import React from "react";
import { interpolate } from "remotion";
import { C, display, mono, sans } from "../theme";
import { clamp, expo } from "../ui/motion";
import { Words } from "../ui/Words";
import { Count } from "../ui/Count";
import { Fill, In, Italic, Kicker, Mark, StampRow, useCue } from "./common";

/** 01 · The hook: three things you quit, each stamped for a few days and then struck. */
export const Open: React.FC = () => {
  const { f, rel } = useCue("open");
  const items = [
    { label: "The gym", at: rel("gym"), kept: [true, true, true, false, false, false, false] },
    { label: "The language", at: rel("language"), kept: [true, true, false, false, false, false, false] },
    { label: "The book", at: rel("book"), kept: [true, false, false, false, false, false, false] },
  ];
  const tNothing = rel("nothing");
  return (
    <Fill tone="light">
      <div style={{ position: "absolute", left: 120, top: 150, width: 1000 }}>
        <In at={2}><Kicker>A year in habits</Kicker></In>
        <Words
          text="You have quit something this year."
          at={rel("You")}
          every={5}
          accent={{ "quit": C.seal }}
          style={{ display: "block", marginTop: 28, fontFamily: display, fontWeight: 600, fontSize: 124, letterSpacing: "-0.04em", lineHeight: 1.0 }}
        />
      </div>
      <div style={{ position: "absolute", left: 1080, top: 150, width: 720 }}>
        {items.map((it, i) => {
          const p = interpolate(f, [it.at - 4, it.at + 12], [0, 1], { ...clamp, easing: expo });
          const strike = interpolate(f, [it.at + 26, it.at + 46], [0, 1], { ...clamp, easing: expo });
          return (
            <div key={i} style={{ marginBottom: 34, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              <div style={{ position: "relative", display: "inline-block", fontFamily: display, fontSize: 64, fontWeight: 500, letterSpacing: "-0.03em", color: strike > 0.5 ? C.ink3 : C.ink }}>
                {it.label}
                <span style={{ position: "absolute", left: 0, top: "56%", height: 5, width: `${strike * 100}%`, background: C.seal, borderRadius: 3 }} />
              </div>
              <div style={{ marginTop: 14 }}>
                <StampRow n={7} start={it.at + 4} every={5} size={46} kept={it.kept} gap={12} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 120, top: 800, display: "flex", alignItems: "baseline", gap: 30 }}>
        <In at={tNothing - 6}>
          <div style={{ fontFamily: display, fontSize: 190, fontWeight: 600, letterSpacing: "-0.06em", lineHeight: 0.9, color: C.seal }}>
            $<Count to={0} at={tNothing} dur={4} />
          </div>
        </In>
        <In at={tNothing + 4}>
          <div style={{ fontFamily: sans, fontSize: 40, color: C.ink2, lineHeight: 1.25 }}>
            lost for quitting.<br /><Italic color={C.ink}>So nobody stopped you.</Italic>
          </div>
        </In>
      </div>
    </Fill>
  );
};

/** 02 · The problem: starting is free, quitting is free. */
export const Problem: React.FC = () => {
  const { f, rel } = useCue("problem");
  const tFree = rel("free,");
  const tQuit = rel("quitting");
  const tProblem = rel("problem.");
  const tWish = rel("wish.");
  return (
    <Fill tone="dark">
      <div style={{ position: "absolute", left: 120, top: 120 }}>
        <In at={2}><Kicker tone="dark">The whole problem</Kicker></In>
      </div>
      <div style={{ position: "absolute", left: 120, top: 210, fontFamily: display, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1.0 }}>
        <Words text="Free to start." at={tFree - 8} every={5} style={{ display: "block", fontSize: 168, color: "#f7f2e8", opacity: 1 }} />
        <Words text="Free to quit." at={tQuit - 6} every={5} accent={{ "quit.": "#ff8a6b" }} style={{ display: "block", fontSize: 168, color: "#f7f2e8", marginTop: 6 }} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 640, opacity: interpolate(f, [tProblem - 4, tProblem + 12], [0, 1], clamp) }}>
        <Words text="That is the whole problem." at={tProblem - 2} every={4} accent={{ "problem.": "#ff8a6b" }} style={{ fontFamily: display, fontSize: 78, fontWeight: 500, letterSpacing: "-0.03em", color: "rgba(247,242,232,0.8)" }} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 790, display: "flex", alignItems: "center", gap: 40 }}>
        <In at={tWish - 40} style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.14em", color: "rgba(247,242,232,0.5)" }}>STAKE · 0.00</In>
        <div style={{ display: "flex", gap: 14, opacity: interpolate(f, [tWish - 40, tWish - 20], [0, 1], clamp) }}>
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} style={{ width: 42, height: 42, borderRadius: 42, border: "2.5px dashed rgba(247,242,232,0.3)" }} />
          ))}
        </div>
      </div>
      <In at={tWish - 8} style={{ position: "absolute", left: 120, top: 890, fontFamily: display, fontSize: 56, color: "#f7f2e8", letterSpacing: "-0.02em" }}>
        A promise with no price is just a <Italic color="#ff8a6b">wish.</Italic>
      </In>
    </Fill>
  );
};

/** 03 · The turn: the logo and the line. */
export const Turn: React.FC = () => {
  const { f, rel } = useCue("turn");
  const tName = rel("Pactiq.");
  const tStake = rel("Stake");
  const fadeOut = interpolate(f, [tName - 14, tName - 2], [1, 0], clamp);
  const logoP = interpolate(f, [tName - 6, tName + 18], [0, 1], { ...clamp, easing: expo });
  return (
    <Fill tone="brand">
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", opacity: fadeOut }}>
        <Words text="So we put a price on the promise." at={rel("So")} every={4} accent={{ "price": "#ffe6a0" }} style={{ fontFamily: display, fontSize: 96, fontWeight: 500, letterSpacing: "-0.035em", color: "#fff7ee" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center", alignItems: "center", gap: 46, opacity: logoP, transform: `scale(${0.94 + 0.06 * logoP})` }}>
        <div style={{ background: "#fff7ee", borderRadius: 52, padding: 36 }}><Mark size={230} at={tName - 4} /></div>
        <div style={{ fontFamily: display, fontSize: 250, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>Pactiq</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center" }}>
        <Words text="Stake on a habit. Get every kept day back." at={tStake} every={4} accent={{ "kept": "#ffe6a0" }} style={{ fontFamily: display, fontSize: 74, fontWeight: 500, letterSpacing: "-0.03em", color: "#fff7ee" }} />
      </div>
    </Fill>
  );
};
