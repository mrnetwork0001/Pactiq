import React from "react";
import { interpolate } from "remotion";
import { C, display, mono, sans } from "../theme";
import { clamp } from "../ui/motion";
import { Browser, markOf } from "../ui/Footage";
import { Words } from "../ui/Words";
import { Count } from "../ui/Count";
import { CHAIN, Card, FIRST_PACT, Fill, In, Italic, Kicker, Logo, Mono, SourceNote, blockStr, short, useCue } from "./common";

/** 07 · Why QIE: a check-in has to cost almost nothing. The fee, the block time and the explorer page are real. */
export const WhyQie: React.FC = () => {
  const { f, rel } = useCue("whyqie");
  const fee = CHAIN.signFeeUsd;
  return (
    <Fill tone="dark">
      <div style={{ position: "absolute", left: 96, top: 70 }}>
        <In at={0}><Kicker tone="dark">Why QIE</Kicker></In>
      </div>
      <div style={{ position: "absolute", left: 96, top: 150, width: 780 }}>
        <In at={rel("cost") - 8}>
          <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.14em", color: "rgba(247,242,232,0.55)" }}>TO SIGN A PACT ON QIE MAINNET</div>
          <div style={{ fontFamily: display, fontSize: 150, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 0.95, marginTop: 14, color: "#f7f2e8" }}>
            $<Count to={fee} at={rel("cost")} dur={34} decimals={5} />
          </div>
          <div style={{ fontFamily: sans, fontSize: 28, color: "rgba(247,242,232,0.7)", marginTop: 14, lineHeight: 1.35 }}>
            {CHAIN.signFeeQie.toFixed(6)} QIE · block {blockStr(FIRST_PACT.block)} · <Italic color="#ff8a6b">six thousandths of a cent</Italic>
          </div>
        </In>
        <div style={{ display: "flex", gap: 70, marginTop: 80 }}>
          <In at={rel("three") - 8}>
            <div style={{ fontFamily: display, fontSize: 112, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1 }}>
              <Count to={CHAIN.blockSeconds} at={rel("three")} dur={26} decimals={1} />s
            </div>
            <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.12em", color: "rgba(247,242,232,0.55)", marginTop: 10 }}>BLOCK TIME, LAST 10,000 BLOCKS</div>
          </In>
          <In at={rel("ten") - 8}>
            <div style={{ fontFamily: display, fontSize: 112, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1, color: "#e0b54a" }}>$0.10</div>
            <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.12em", color: "rgba(247,242,232,0.55)", marginTop: 10 }}>MINIMUM QUSDC STAKE PER DAY</div>
          </In>
        </div>
      </div>
      <Browser
        name="explorer" url="mainnet.qie.digital/tx/0x57cc01a9…7117ff" width={900} left={940} top={130} startFrom={markOf("explorer", "tx") + 20} rate={1}
        enter={rel("cost") - 14}
        cams={[
          { f: 0, rect: { x: 200, y: 300, w: 1200, h: 520 }, z: 1.0 },
          { f: rel("cost") + 20, rect: { x: 200, y: 430, w: 1200, h: 360 }, z: 1.25 },
          { f: rel("three") - 10, rect: { x: 200, y: 430, w: 1200, h: 140 }, z: 1.6 },
        ]}
      />
      <Card at={rel("possible.") - 12} left={940} top={760} width={900} tone="dark" accent="#5fd39a">
        <div style={{ fontFamily: mono, fontSize: 18, color: "rgba(247,242,232,0.6)" }}>tx {short(FIRST_PACT.hash, 12, 8)} · {FIRST_PACT.utc.slice(0, 16).replace("T", " ")} UTC · read from mainnet.qie.digital</div>
        <div style={{ fontFamily: display, fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 8 }}>Cheap enough that a daily check-in is not a tax.</div>
      </Card>
    </Fill>
  );
};

const PIECES = [
  { file: "qiewallet.png", h: 62, name: "QIE Wallet", role: "signs every transaction", cue: "Wallet" },
  { file: "qusdc.png", h: 62, name: "QUSDC", role: "the dollar stake, with its own bonus pool", cue: "QUSDC" },
  { file: "qiedex.png", h: 62, name: "QIEDEX", role: "swaps between QIE and QUSDC in the app", cue: "QIEDEX" },
  { file: "qie-id.svg", h: 62, name: "QIE ID", role: "your .qie name, checked on-chain", cue: "QIE ID" },
  { file: "qie-logo.png", h: 62, name: "QIE Oracle", role: "prices dollar stakes in QIE", cue: "Oracle" },
];

/** 08 · The ecosystem: five QIE components, each doing one job in the product. */
export const Eco: React.FC = () => {
  const { f, rel } = useCue("eco");
  return (
    <Fill tone="light">
      <div style={{ position: "absolute", left: 96, top: 60 }}>
        <In at={0}><Kicker>QIE ecosystem · five pieces, one pact</Kicker></In>
      </div>
      <Browser
        name="swap" url="pactiq · swap on QIEDEX" width={860} left={96} top={150} startFrom={markOf("swap", "sheet") - 10} rate={1} light
        enter={8}
        cams={[{ f: 0, rect: { x: 513, y: 150, w: 574, h: 560 }, z: 1.5 }]}
      />
      <Words text="One pact. Five QIE pieces." at={14} every={5} accent={{ "pieces.": C.seal }} style={{ position: "absolute", left: 96, top: 720, fontFamily: display, fontSize: 86, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.0, width: 860, display: "block" }} />
      <div style={{ position: "absolute", left: 1010, top: 140, width: 830 }}>
        {PIECES.map((p, i) => {
          const at = rel(p.cue);
          const o = interpolate(f, [at - 6, at + 10], [0, 1], clamp);
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 28, padding: "20px 28px", marginBottom: 22, background: "#fbf8f2", borderRadius: 14, boxShadow: "0 0 0 1px rgba(23,20,15,0.1), 0 18px 40px rgba(23,20,15,0.1)", opacity: o, transform: `translateX(${(1 - o) * 60}px)`, borderLeft: `6px solid ${i % 2 ? C.gold : C.seal}` }}>
              <div style={{ width: 150, display: "flex", justifyContent: "center" }}><Logo file={p.file} h={p.h} /></div>
              <div>
                <div style={{ fontFamily: display, fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{p.name}</div>
                <div style={{ fontFamily: sans, fontSize: 24, color: C.ink2, marginTop: 6 }}>{p.role}</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.kept, fontFamily: mono, fontSize: 15, letterSpacing: "0.12em" }}>INTEGRATED</div>
            </div>
          );
        })}
      </div>
      <SourceNote>Swap quote recorded on a local fork of QIE Mainnet. Logos are QIE's own, unaltered.</SourceNote>
    </Fill>
  );
};

/** 09 · It is live: the contracts, the counts and the explorer. */
export const Proof: React.FC = () => {
  const { f, rel } = useCue("proof");
  const hex = CHAIN.statsRaw.replace(/^0x/, "").match(/.{64}/g) ?? [];
  const big = (i: number) => Number(BigInt("0x" + (hex[i] ?? "0")));
  const pacts = big(0);
  const squads = big(1);
  const bonus = big(3) / 1e18;
  const rows: [string, string][] = [
    ["PactiqVault", CHAIN.addresses.vault],
    ["PactiqRouter", CHAIN.addresses.router],
    ["PactiqBadges", CHAIN.addresses.badges],
    ["QieNameVerifier", CHAIN.addresses.names],
    ["PactiqCampaign", CHAIN.addresses.campaign],
  ];
  return (
    <Fill tone="dark">
      <div style={{ position: "absolute", left: 96, top: 70 }}>
        <In at={0}><Kicker tone="dark">Live on QIE Mainnet</Kicker></In>
      </div>
      <div style={{ position: "absolute", left: 96, top: 140, width: 960 }}>
        {rows.map(([name, addr], i) => {
          const at = rel("Five") + i * 12;
          const o = interpolate(f, [at, at + 12], [0, 1], clamp);
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 22, padding: "17px 0", borderBottom: "1px solid rgba(247,242,232,0.16)", opacity: o, transform: `translateY(${(1 - o) * 18}px)` }}>
              <span style={{ color: "#5fd39a", fontSize: 28 }}>&#10003;</span>
              <span style={{ fontFamily: display, fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", width: 330 }}>{name}</span>
              <Mono size={22} color="rgba(247,242,232,0.62)">{short(addr, 10, 8)}</Mono>
              <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 15, letterSpacing: "0.14em", color: "#5fd39a" }}>SOURCE VERIFIED</span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 56, marginTop: 56 }}>
          {[
            { v: pacts, label: "pacts signed", at: rel("pacts,"), suffix: "" },
            { v: squads, label: "squad", at: rel("squad,"), suffix: "" },
            { v: bonus, label: "QIE in the bonus pool", at: rel("fifty"), suffix: "" },
          ].map((s) => (
            <In key={s.label} at={s.at - 8}>
              <div style={{ fontFamily: display, fontSize: 110, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1, color: s.label.startsWith("QIE") ? "#e0b54a" : "#f7f2e8" }}>
                <Count to={s.v} at={s.at} dur={24} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.12em", color: "rgba(247,242,232,0.55)", marginTop: 8, textTransform: "uppercase" }}>{s.label}</div>
            </In>
          ))}
        </div>
      </div>
      <Browser
        name="explorer" url="mainnet.qie.digital · PactiqVault" width={760} left={1110} top={190} startFrom={markOf("explorer", "vault") + 10} rate={1}
        enter={14}
        cams={[{ f: 0, rect: { x: 100, y: 80, w: 800, h: 520 }, z: 1.45 }]}
      />
      <div style={{ position: "absolute", left: 1110, top: 690, width: 760, fontFamily: mono, fontSize: 16, color: "rgba(247,242,232,0.5)", lineHeight: 1.5, opacity: interpolate(f, [24, 44], [0, 1], clamp) }}>
        Counts read from the vault on {CHAIN.readAtUTC.slice(0, 10)} (block {blockStr(CHAIN.head)}).
      </div>
      <SourceNote tone="dark" top={1000}>Contract state read live over QIE's public RPC.</SourceNote>
    </Fill>
  );
};
