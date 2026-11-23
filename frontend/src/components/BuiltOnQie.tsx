"use client";

import React from "react";
import { Check, Clock } from "lucide-react";
import { QIE_ECOSYSTEM, QIE_ID_URL, QIE_USD_FEED, explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { Marquee, Reveal, SectionHead } from "./Motion";

interface Integration {
  logo: string;
  name: string;
  body: string;
  /** Where a reader can check the claim: the contract Pactiq calls, or the QIE product itself. */
  proof: { label: string; href: string };
  live: boolean;
}

/** Every QIE component Pactiq uses, each labelled for what it is. */
export function BuiltOnQie({ n }: { n: number }) {
  const contract = (address: `0x${string}`) => ({ label: shortAddress(address), href: explorerAddress(address) });

  const items: Integration[] = [
    {
      logo: "/qie/qiewallet.png",
      name: "QIE Wallet",
      body: "Connect, sign and pay from QIE Wallet. Pactiq moves the wallet to QIE Mainnet by itself and adds the network if it's missing.",
      proof: { label: "Chain 1990", href: "https://mainnet.qie.digital" },
      live: true,
    },
    {
      logo: "/qie/qusdc.png",
      name: "QIE Stable Coin",
      body: "Stake a pact or fund a squad in QUSDC. It has its own bonus pool, so a promise to yourself isn't also a bet on price.",
      proof: contract(QIE_ECOSYSTEM.qusdc),
      live: true,
    },
    {
      logo: "/qie/qiedex.png",
      name: "QIE Dex",
      body: "A built-in swap trades QIE and QUSDC on QIEDEX both ways, and the pact form tops up exactly what a stake is short by.",
      proof: contract(QIE_ECOSYSTEM.qiedexRouter),
      live: true,
    },
    {
      logo: "/qie/qie-id.svg",
      name: "QIE ID",
      body: "Sign with your .qie name. The contract asks QIE's name registry and refuses a name the signing wallet doesn't hold.",
      proof: { label: "id.qie.digital", href: QIE_ID_URL },
      live: true,
    },
    {
      logo: "/qie/qie-logo.png",
      name: "QIE Oracle",
      body: "The QIE/USD feed prices dollar stakes on-chain at signing, and every dollar total you see on this page.",
      proof: contract(QIE_USD_FEED),
      live: true,
    },
  ];

  return (
    <section id="qie" className="mt-24 scroll-mt-24">
      <SectionHead n={n} title="Built on QIE" aside={`${items.length} QIE components, one pact`} />
      <Reveal as="p" className="text-lg text-ink-2 max-w-3xl leading-relaxed mb-8">
        Pactiq stakes in QIE and QIE&apos;s stablecoin, tops up through QIEDEX, prices dollars with the QIE Oracle and
        checks .qie names on-chain. Each piece is labelled below for what it is.
      </Reveal>
      <Reveal>
        <Marquee seconds={items.length * 8} gap="1.25rem" className="py-3 -my-3">
          {items.map((it) => (
            <article key={it.name} className="lift sheet rounded-md p-5 w-[17.5rem] sm:w-[19.5rem] flex flex-col">
              <div className="h-12 flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- small static brand marks, no optimisation needed */}
                <img src={it.logo} alt="" className="max-h-12 max-w-[9.5rem] object-contain object-left rounded-md" loading="lazy" />
              </div>
              <h3 className="font-display text-xl font-semibold mt-4">{it.name}</h3>
              <p className="text-sm text-ink-2 leading-relaxed mt-2 flex-1">{it.body}</p>
              <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between gap-3">
                {it.live ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-kept border border-kept rounded-full px-2.5 py-1 whitespace-nowrap shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} /> Integrated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold border border-gold rounded-full px-2.5 py-1 whitespace-nowrap shrink-0">
                    <Clock className="w-3.5 h-3.5" /> Built · awaiting key
                  </span>
                )}
                <a href={it.proof.href} target="_blank" rel="noreferrer" className="num text-[11px] text-quill hover:underline truncate min-w-0">
                  {it.proof.label}
                </a>
              </div>
            </article>
          ))}
        </Marquee>
      </Reveal>
    </section>
  );
}
