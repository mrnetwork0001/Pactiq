import React from "react";
import { AbsoluteFill } from "remotion";
import { C, display, mono } from "./theme";
import { Italic, Logo, Mark, StampRow } from "./scenes/common";

/** The YouTube thumbnail: the line, the mark, and QIE. */
export const Poster: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: display }}>
    <div style={{ position: "absolute", left: 90, top: 80, display: "flex", alignItems: "center", gap: 22 }}>
      <Mark size={84} at={-100} />
      <div style={{ fontSize: 74, fontWeight: 700, letterSpacing: "-0.04em" }}>Pactiq</div>
    </div>
    <div style={{ position: "absolute", left: 90, top: 270, fontSize: 196, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 0.95 }}>
      Free to quit<br /><Italic color={C.seal}>is the whole problem.</Italic>
    </div>
    <div style={{ position: "absolute", left: 90, bottom: 90 }}>
      <StampRow n={14} start={-200} every={1} size={52} gap={14} kept={[...Array(11).fill(true), false, true, true]} />
    </div>
    <div style={{ position: "absolute", right: 90, bottom: 84, display: "flex", alignItems: "center", gap: 20 }}>
      <span style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.16em", color: C.ink3 }}>BUILT ON</span>
      <Logo file="qie-logo.png" h={72} radius={16} />
    </div>
  </AbsoluteFill>
);
