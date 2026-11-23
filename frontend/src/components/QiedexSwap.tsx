"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { formatQie } from "@/lib/format";
import { formatAsset, QUSDC_ASSET } from "@/lib/assets";
import { QIEDEX_URL } from "@/lib/chain";
import { quoteQieForQusdc } from "@/lib/qie";
import { Button } from "./ui";

/**
 * Short of QUSDC? Swap QIE for exactly what's missing on QIEDEX, without leaving the pact.
 * `onSwap` sends the router transaction; this only quotes and shows it.
 */
export function QiedexSwap({
  shortfall,
  qieBalance,
  onSwap,
}: {
  shortfall: bigint;
  qieBalance: bigint | null;
  onSwap: (qusdcOut: bigint, qieIn: bigint, onStatus: (s: string) => void) => Promise<void>;
}) {
  // Round the purchase up to whole cents plus a cent, so rounding never leaves the user short.
  const target = ((shortfall + 9_999n) / 10_000n) * 10_000n + 10_000n;
  const [quote, setQuote] = useState<{ key: bigint; qieIn: bigint } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    const t = setTimeout(() => {
      quoteQieForQusdc(target)
        .then((q) => {
          if (!on) return;
          setQuote({ key: target, qieIn: q.qieIn });
          setQuoteError(null);
        })
        .catch(() => on && setQuoteError("QIEDEX couldn't quote this swap right now."));
    }, 250);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [target]);

  const live = quote?.key === target ? quote : null;
  const tooPoor = live && qieBalance !== null && live.qieIn > qieBalance;

  const swap = async () => {
    if (!live) return;
    setError(null);
    try {
      await onSwap(target, live.qieIn, setStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The swap failed.");
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="border border-quill/40 bg-quill/5 rounded-md p-4 text-sm">
      <div className="flex items-start gap-3">
        <Repeat className="w-4 h-4 text-quill shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-ink-2">
            You need <strong className="num">{formatAsset(shortfall, QUSDC_ASSET)}</strong> more. Swap QIE for it on{" "}
            <a href={QIEDEX_URL} target="_blank" rel="noreferrer" className="text-quill underline">
              QIEDEX
            </a>
            , QIE&apos;s DEX, right here.
          </p>
          <p className="num text-xs text-ink-3 mt-1">
            {live
              ? `≈ ${formatQie(live.qieIn, 4)} QIE for ${formatAsset(target, QUSDC_ASSET)} · 1% max slippage`
              : (quoteError ?? "Getting a QIEDEX quote…")}
          </p>
          {tooPoor && <p className="text-xs text-seal mt-1">Not enough QIE in this wallet for the swap.</p>}
          {error && <p className="text-xs text-seal mt-1">{error}</p>}
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full mt-3" disabled={!live || !!tooPoor || !!status} onClick={swap}>
        {status ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {status}
          </>
        ) : (
          `Swap on QIEDEX for ${formatAsset(target, QUSDC_ASSET)}`
        )}
      </Button>
    </div>
  );
}
