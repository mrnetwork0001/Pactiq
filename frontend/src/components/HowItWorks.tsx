import React from "react";
import { Reveal, SectionHead } from "./Motion";

const TERMS = [
  {
    title: "Sign & stake",
    body: "Name the habit, choose 3–100 days and a daily stake in QIE or in QUSDC, QIE's stablecoin (one tap swaps it on QIEDEX). The whole amount is locked in the PactiqVault contract. Nobody, including us, can touch it.",
  },
  {
    title: "Prove it daily",
    body: "Every day you get a fresh four-digit code. Write it down and photograph it next to your run, your commit, your open book.",
  },
  {
    title: "An AI witnesses",
    body: "A vision model checks the code, the activity and that the photo is real, then signs an attestation. The contract rejects any check-in without that signature.",
  },
  {
    title: "Settle up",
    body: `Each verified day is refunded. Missed days fund the bonus pool or a charity you chose. Keep every day and earn up to 15% on top.`,
  },
];

export function HowItWorks({ n = 2 }: { n?: number }) {
  return (
    <section id="terms" className="mt-24 scroll-mt-24">
      <SectionHead n={n} title="The terms" aside="Four clauses, enforced by code" />
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
        {TERMS.map((t, i) => (
          <Reveal as="li" key={t.title} delay={i * 130} className="relative pt-5">
            <span className="draw-rule absolute top-0 left-0 right-0 h-0.5 bg-seal" />
            <div className="font-display text-6xl font-light text-seal leading-none">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="font-display text-xl font-semibold mt-3">{t.title}</h3>
            <p className="text-sm text-ink-2 leading-relaxed mt-2">{t.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
