import React from "react";
import { interpolate } from "remotion";
import { C, display, mono, sans } from "../theme";
import { clamp, expo } from "../ui/motion";
import { Browser, Phone, markOf } from "../ui/Footage";
import { Words } from "../ui/Words";
import { Card, Fill, In, Italic, Kicker, Logo, Mark, Mono, SourceNote, StampRow, useCue } from "./common";

/** 10 · Why Pactiq: a public Proof-of-Human score, and squads. */
export const Why: React.FC = () => {
  const { f, rel } = useCue("why");
  return (
    <Fill tone="brand">
      <div style={{ position: "absolute", left: 96, top: 60 }}>
        <In at={0}><Kicker tone="brand">Why Pactiq</Kicker></In>
      </div>
      <Browser
        name="profile" url="pactiq · a public profile" width={1020} left={96} top={130} startFrom={0} rate={1} light
        cams={[
          { f: 0, z: 1 },
          { f: rel("Proof") - 10, rect: { x: 100, y: 60, w: 1400, h: 520 }, z: 1.3 },
          { f: rel("hardest") - 10, rect: { x: 100, y: 200, w: 1400, h: 560 }, z: 1.15 },
        ]}
      />
      <div style={{ position: "absolute", left: 1230, top: 150, width: 600, opacity: interpolate(f, [rel("Proof") - 4, rel("Proof") + 12, rel("friends,") - 50, rel("friends,") - 36], [0, 1, 1, 0], clamp), transform: `translateY(${(1 - interpolate(f, [rel("Proof") - 4, rel("Proof") + 12], [0, 1], clamp)) * 30}px)` }}>
        <Mono size={15} color="rgba(255,247,238,0.75)">GET /api/score/&lt;address&gt;?min=200</Mono>
        <div style={{ marginTop: 14, background: "rgba(23,20,15,0.92)", borderRadius: 14, padding: "26px 30px", fontFamily: mono, fontSize: 26, lineHeight: 1.6, color: "#f7f2e8", boxShadow: "0 30px 70px rgba(80,10,0,0.4)" }}>
          {"{"}<br />
          &nbsp;&nbsp;"score": <span style={{ color: "#e0b54a" }}>490</span>,<br />
          &nbsp;&nbsp;"verifiedHuman": <span style={{ color: "#5fd39a" }}>true</span>,<br />
          &nbsp;&nbsp;"checkIns": <span style={{ color: "#e0b54a" }}>15</span>,<br />
          &nbsp;&nbsp;"bestStreak": <span style={{ color: "#e0b54a" }}>7</span><br />
          {"}"}
        </div>
        <div style={{ fontFamily: sans, fontSize: 22, color: "rgba(255,247,238,0.85)", marginTop: 16, lineHeight: 1.35 }}>One call for any QIE app. Values shown are the demo fork's.</div>
      </div>
      <Phone name="phone" left={1230} top={90} height={760} startFrom={markOf("phone", "ranks") - 40} enter={rel("friends,") - 30} hold={0} />
      <Card at={rel("Proof") - 4} left={96} top={760} width={1020} accent="#ffe6a0" style={{ display: "flex", gap: 44, alignItems: "baseline", padding: "20px 30px" }}>
        {[["10", "per check-in"], ["100", "per completed pact"], ["20", "per day of best streak"], ["−50", "per failed pact"]].map(([n, l]) => (
          <div key={l}>
            <div style={{ fontFamily: display, fontSize: 54, fontWeight: 600, letterSpacing: "-0.04em", color: l.includes("failed") ? C.seal : C.ink }}>{n}</div>
            <div style={{ fontFamily: sans, fontSize: 19, color: C.ink2 }}>{l}</div>
          </div>
        ))}
      </Card>
      <div style={{ position: "absolute", left: 1230, top: 900, width: 340, textAlign: "center", fontFamily: display, fontSize: 36, letterSpacing: "-0.02em", opacity: interpolate(f, [rel("friends,") - 40, rel("friends,") - 20], [0, 1], clamp) }}>
        Squads, <Italic color="#ffe6a0">on your phone.</Italic>
      </div>
      <SourceNote tone="brand" left={96} top={1010}>Profile and phone recorded on a local fork of QIE Mainnet. Any QIE app can read the score from the contract or one HTTP call.</SourceNote>
    </Fill>
  );
};

/** 11 · Trust: the model judges, the contract decides. */
export const Trust: React.FC = () => {
  const { f, rel } = useCue("trust");
  const nodes = [
    { at: rel("wrong,"), tag: "1 · THE MODEL", title: "Judges the photo", body: "It can be wrong, so it never holds a key.", accent: C.gold },
    { at: rel("keys."), tag: "2 · THE SERVER", title: "Signs an attestation", body: "For one wallet, one pact, one day.", accent: C.seal },
    { at: rel("signature,"), tag: "3 · THE CONTRACT", title: "Checks the signature", body: "No valid signature, no kept day. Once only.", accent: C.kept },
  ];
  const lineP = (i: number) => interpolate(f, [nodes[i + 1].at - 18, nodes[i + 1].at - 2], [0, 1], { ...clamp, easing: expo });
  return (
    <Fill tone="light">
      <div style={{ position: "absolute", left: 120, top: 90 }}>
        <In at={0}><Kicker>Under the hood</Kicker></In>
      </div>
      <div style={{ position: "absolute", left: 120, top: 170 }}>
        <Words text="The model decides if you did it." at={rel("AI")} every={4} style={{ display: "block", fontFamily: display, fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em" }} />
        <Words text="The contract decides if that counts." at={rel("decides", 1) - 14} every={4} accent={{ "counts.": C.seal }} style={{ display: "block", fontFamily: display, fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink2 }} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 560, display: "flex", alignItems: "stretch", gap: 0 }}>
        {nodes.map((n, i) => (
          <React.Fragment key={n.tag}>
            <div style={{ width: 470, padding: "28px 30px", background: C.card, borderRadius: 14, borderTop: `5px solid ${n.accent}`, boxShadow: "0 0 0 1px rgba(23,20,15,0.1), 0 22px 50px rgba(23,20,15,0.12)", opacity: interpolate(f, [n.at - 8, n.at + 8], [0, 1], clamp), transform: `translateY(${(1 - interpolate(f, [n.at - 8, n.at + 8], [0, 1], clamp)) * 30}px)` }}>
              <Mono size={14} color={C.ink3}>{n.tag}</Mono>
              <div style={{ fontFamily: display, fontSize: 46, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 8, lineHeight: 1.05 }}>{n.title}</div>
              <div style={{ fontFamily: sans, fontSize: 24, color: C.ink2, marginTop: 12, lineHeight: 1.35 }}>{n.body}</div>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ width: 130, display: "flex", alignItems: "center" }}>
                <div style={{ height: 5, width: `${lineP(i) * 100}%`, background: C.ink, borderRadius: 3, position: "relative" }}>
                  <span style={{ position: "absolute", right: -4, top: -9, width: 0, height: 0, borderLeft: `18px solid ${C.ink}`, borderTop: "11px solid transparent", borderBottom: "11px solid transparent", opacity: lineP(i) > 0.95 ? 1 : 0 }} />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Fill>
  );
};

/** 12 · Close. */
export const Close: React.FC = () => {
  const { f, rel } = useCue("close");
  const o = (a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: expo });
  return (
    <Fill tone="dark">
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", alignItems: "center", gap: 36, opacity: o(0, 22) }}>
        <div style={{ background: "#fff7ee", borderRadius: 38, padding: 26 }}><Mark size={150} at={2} /></div>
        <div style={{ fontFamily: display, fontSize: 190, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>Pactiq</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, textAlign: "center" }}>
        <Words text="Free to quit is the whole problem." at={rel("Free") - 2} every={4} accent={{ "problem.": "#ff8a6b" }} style={{ fontFamily: display, fontSize: 92, fontWeight: 500, letterSpacing: "-0.035em", color: "#f7f2e8" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 740, display: "flex", justifyContent: "center", alignItems: "center", gap: 34, opacity: o(rel("Built") - 6, rel("Built") + 14) }}>
        <Mono size={22} color="rgba(247,242,232,0.6)" style={{ letterSpacing: "0.18em" }}>BUILT ON</Mono>
        <Logo file="qie-logo.png" h={74} radius={16} />
        <div style={{ fontFamily: display, fontSize: 56, fontWeight: 600, letterSpacing: "-0.03em" }}>QIE Mainnet</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontFamily: mono, fontSize: 22, letterSpacing: "0.16em", color: "rgba(247,242,232,0.6)", opacity: o(rel("Hackathon.") - 10, rel("Hackathon.") + 8) }}>
        QIE BLOCKCHAIN HACKATHON 3.0 · CONSUMER APPS &amp; SOCIAL
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: o(10, 40) }}>
        <StampRow n={14} start={4} every={3} size={26} gap={10} tone="dark" />
      </div>
    </Fill>
  );
};
