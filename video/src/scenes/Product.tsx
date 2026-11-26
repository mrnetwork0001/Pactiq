import React from "react";
import { interpolate } from "remotion";
import { C, display, mono, sans } from "../theme";
import { clamp, expo } from "../ui/motion";
import { Browser, markOf, rectOf } from "../ui/Footage";
import { Count } from "../ui/Count";
import { Card, Fill, In, Italic, Kicker, Mono, SourceNote, useCue } from "./common";

const Chip: React.FC<{ k: string; v: string; tone?: "light" | "dark" }> = ({ k, v, tone = "light" }) => (
  <div>
    <div style={{ fontFamily: mono, fontSize: 14, letterSpacing: "0.16em", textTransform: "uppercase", color: tone === "dark" ? "rgba(247,242,232,0.55)" : C.ink3 }}>{k}</div>
    <div style={{ fontFamily: display, fontSize: 40, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 4 }}>{v}</div>
  </div>
);

/** 04 · Sign and stake: the real create-pact flow on the demo fork. */
export const Stake: React.FC = () => {
  const { rel } = useCue("stake");
  const sig = rectOf("create", "signature");
  return (
    <Fill tone="light">
      <div style={{ position: "absolute", left: 96, top: 60 }}>
        <In at={0}><Kicker>01 · Sign and stake</Kicker></In>
      </div>
      <Browser
        name="create" url="pactiq · sign a pact" width={1240} left={96} top={118} startFrom={Math.max(0, markOf("create", "open") - 6)} rate={1.45} light
        cams={[
          { f: 0, z: 1 },
          { f: rel("three") - 20, rect: { x: 520, y: 130, w: 560, h: 360 }, z: 1.5 },
          { f: rel("QIE") - 6, rect: { x: 520, y: 380, w: 560, h: 260 }, z: 1.6 },
          { f: rel("locks") - 40, rect: sig ?? { x: 585, y: 760, w: 470, h: 106 }, z: 1.7 },
          { f: rel("locks") + 24, rect: { x: 400, y: 120, w: 800, h: 700 }, z: 1.12 },
        ]}
      />
      <Card at={rel("three") - 4} left={1380} top={150} width={470}>
        <Mono size={14} color={C.ink3}>THE TERM</Mono>
        <div style={{ fontFamily: display, fontSize: 52, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>3 to 100 days</div>
      </Card>
      <Card at={rel("QIE") - 4} left={1380} top={340} width={470} accent={C.gold}>
        <Mono size={14} color={C.ink3}>THE STAKE, PER DAY</Mono>
        <div style={{ fontFamily: display, fontSize: 52, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>QIE <Italic color={C.gold}>or</Italic> QUSDC</div>
      </Card>
      <Card at={rel("locks") - 6} left={1380} top={530} width={470} accent={C.kept}>
        <Mono size={14} color={C.ink3}>WHERE IT SITS</Mono>
        <div style={{ fontFamily: display, fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6, lineHeight: 1.1 }}>Locked in the vault contract</div>
        <div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 10 }}>No admin key can move a stake.</div>
      </Card>
      <SourceNote>Recorded on a local fork of QIE Mainnet. Writes there are free and touch no real chain.</SourceNote>
    </Fill>
  );
};

/** 05 · Prove it: the code, the photo, the witness report, the day on the record. */
export const Prove: React.FC = () => {
  const { f, rel } = useCue("prove");
  const report = rectOf("checkin", "report") ?? { x: 545, y: 171, w: 510, h: 697 };
  const m = (k: string) => markOf("checkin", k);
  return (
    <Fill tone="dark">
      <div style={{ position: "absolute", left: 96, top: 60 }}>
        <In at={0}><Kicker tone="dark">02 · Prove it, every day</Kicker></In>
      </div>
      <Browser
        name="checkin" url="pactiq · today's proof" width={1240} left={96} top={118} startFrom={m("modal") - 8} rate={1.5}
        cams={[
          { f: 0, rect: { x: 545, y: 40, w: 510, h: 420 }, z: 1.5 },
          { f: rel("photograph") - 10, rect: { x: 545, y: 300, w: 510, h: 340 }, z: 1.7 },
          { f: rel("vision") - 12, rect: report, z: 1.2 },
          { f: rel("accept") - 40, rect: { x: 545, y: 560, w: 510, h: 320 }, z: 1.8 },
        ]}
      />
      <Card at={rel("code") - 4} left={1380} top={150} width={470} tone="dark" accent="#ff8a6b">
        <Mono size={14} color="rgba(247,242,232,0.55)">TODAY'S CODE</Mono>
        <div style={{ fontFamily: mono, fontSize: 56, fontWeight: 600, letterSpacing: "0.08em", marginTop: 6, whiteSpace: "nowrap" }}>4 digits</div>
        <div style={{ fontFamily: sans, fontSize: 21, color: "rgba(247,242,232,0.7)", marginTop: 8 }}>Different for every pact, day and wallet.</div>
      </Card>
      <Card at={rel("vision") - 4} left={1380} top={420} width={470} tone="dark" accent="#5fd39a">
        <Mono size={14} color="rgba(247,242,232,0.55)">THE WITNESS CHECKS</Mono>
        {["The code is readable", "The activity matches", "The photo is real"].map((t, i) => (
          <div key={t} style={{ fontFamily: sans, fontSize: 28, marginTop: 10, opacity: interpolate(f, [rel("vision") + 6 + i * 14, rel("vision") + 18 + i * 14], [0, 1], clamp), display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#5fd39a" }}>&#10003;</span>{t}
          </div>
        ))}
      </Card>
      <Card at={rel("accept") - 6} left={1380} top={690} width={470} tone="dark" accent="#e0b54a">
        <Mono size={14} color="rgba(247,242,232,0.55)">THEN THE CONTRACT</Mono>
        <div style={{ fontFamily: display, fontSize: 40, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 6, lineHeight: 1.1 }}>Accepts a signed day, once</div>
      </Card>
      <SourceNote tone="dark" top={1000}>Local fork, demo verifier (a stand-in photo). On mainnet the verdict comes from a vision model on the 0G Compute Router.</SourceNote>
    </Fill>
  );
};

/** 06 · Settle: refunded, forfeited, bonus. */
export const Settle: React.FC = () => {
  const { f, rel } = useCue("settle");
  const m = (k: string) => markOf("pacts", k);
  return (
    <Fill tone="light">
      <div style={{ position: "absolute", left: 96, top: 60 }}>
        <In at={0}><Kicker>03 · Settle up</Kicker></In>
      </div>
      <Browser
        name="pacts" url="pactiq · my pacts" width={1240} left={96} top={118} startFrom={m("mid") - 30} stopAt={m("low") + 30} rate={1.5} light
        cams={[
          { f: 0, z: 1 },
          { f: rel("forfeited,") - 30, rect: { x: 124, y: 250, w: 1352, h: 560 }, z: 1.25 },
          { f: rel("Keep") - 10, rect: { x: 124, y: 400, w: 1352, h: 420 }, z: 1.35 },
        ]}
      />
      <Card at={rel("refunded.") - 20} left={1380} top={150} width={470} accent={C.kept}>
        <Mono size={14} color={C.ink3}>A KEPT DAY</Mono>
        <div style={{ fontFamily: display, fontSize: 56, fontWeight: 600, letterSpacing: "-0.03em", color: C.kept, marginTop: 6 }}>Refunded</div>
      </Card>
      <Card at={rel("forfeited,") - 10} left={1380} top={340} width={470}>
        <Mono size={14} color={C.ink3}>A MISSED DAY</Mono>
        <div style={{ fontFamily: display, fontSize: 56, fontWeight: 600, letterSpacing: "-0.03em", color: C.seal, marginTop: 6 }}>Forfeited</div>
        <div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 8, lineHeight: 1.35 }}>5% protocol fee, 95% to the bonus pool.</div>
      </Card>
      <Card at={rel("fifteen") - 24} left={1380} top={590} width={470} accent={C.gold}>
        <Mono size={14} color={C.ink3}>EVERY DAY KEPT</Mono>
        <div style={{ fontFamily: display, fontSize: 96, fontWeight: 600, letterSpacing: "-0.05em", color: C.gold, lineHeight: 1, marginTop: 6 }}>
          up to +<Count to={15} at={rel("fifteen") - 8} dur={26} />%
        </div>
        <div style={{ fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 8 }}>from the bonus pool, on top of your stake.</div>
      </Card>
      <SourceNote>Recorded on a local fork of QIE Mainnet.</SourceNote>
    </Fill>
  );
};

export const _unused = { expo };
