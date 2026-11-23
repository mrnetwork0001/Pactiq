"use client";

import React, { useState } from "react";
import type { Address } from "viem";
import { Check, Copy, ExternalLink, Wallet } from "lucide-react";
import { IS_MAINNET, QIE_BRIDGE_URL, QIE_BUY_URL, activeChain } from "@/lib/chain";
import { formatQie, shortAddress } from "@/lib/format";

/**
 * The way in for a wallet with no QIE (or not enough): where to get it and where to send it.
 * `needed` is how much more this action takes; leave it out for the general "you have none" case.
 */
export function GetQie({ address, needed, compact = false }: { address: Address; needed?: bigint; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address is on screen to copy by hand */
    }
  };

  const steps = [
    {
      title: "Buy QIE",
      body: "QIE trades against USDT on several exchanges. QIE keeps the current list.",
      link: { href: QIE_BUY_URL, label: "Where to buy QIE" },
    },
    {
      title: `Send it to this wallet on ${IS_MAINNET ? "QIE Mainnet" : activeChain.name}`,
      body: "Withdraw from the exchange to your address below, choosing the QIE network. Holding QIE or stablecoins on Ethereum or BNB Chain instead? Bridge them across.",
      link: { href: QIE_BRIDGE_URL, label: "Official QIE bridge" },
    },
    {
      title: "Come back and sign",
      body: "Your balance updates here by itself. A few QIE covers a first pact; network fees are a fraction of a cent.",
    },
  ];

  return (
    <div className={`border border-quill/40 bg-quill/5 rounded-md ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start gap-3">
        <Wallet className="w-5 h-5 text-quill shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className={`font-display font-semibold ${compact ? "text-lg" : "text-2xl"}`}>
            {needed ? `You need ${formatQie(needed, 4)} more QIE` : "This wallet has no QIE yet"}
          </p>
          <p className="text-sm text-ink-2 mt-1">
            Pacts are staked in QIE, the coin of the QIE network. Here&apos;s how to get some into this wallet.
          </p>
        </div>
      </div>

      <ol className={`mt-4 grid gap-4 ${compact ? "" : "md:grid-cols-3"}`}>
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 text-sm">
            <span className="num w-6 h-6 shrink-0 rounded-full border-2 border-quill text-quill grid place-items-center text-xs font-bold">{i + 1}</span>
            <div className="min-w-0">
              <p className="font-semibold">{s.title}</p>
              <p className="text-ink-2 mt-0.5 leading-relaxed">{s.body}</p>
              {s.link && (
                <a href={s.link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-quill font-semibold underline mt-1">
                  {s.link.label} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={copy}
        className="mt-4 w-full flex items-center justify-between gap-3 border border-rule bg-card rounded-md px-3 py-2.5 text-left cursor-pointer hover:border-quill transition-colors"
      >
        <span className="min-w-0">
          <span className="kicker !text-[10px] block">Your address · send only on the QIE network</span>
          <span className="num text-sm break-all hidden sm:block">{address}</span>
          <span className="num text-sm sm:hidden">{shortAddress(address)}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-quill shrink-0">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}
