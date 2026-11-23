"use client";

import React, { useEffect, useState } from "react";
import { decodeEventLog, erc20Abi, formatUnits, parseEther, type Abi, type Address, type Hash, type TransactionReceipt } from "viem";
import { ArrowDownUp, ArrowRight, Check, ExternalLink, Loader2, X } from "lucide-react";
import { QIE_ASSET, QUSDC_ASSET, formatUsdValue, parseAmount, usdValue, type AssetMeta } from "@/lib/assets";
import { QIE_BRIDGE_URL, QIEDEX_URL, explorerTx } from "@/lib/chain";
import { describeError } from "@/lib/pactiq";
import { PACTIQ_ROUTER_ABI, SWAP_TARGET, qiedexAvailable, quoteSwap, swapCall, tokenAllowance } from "@/lib/qie";
import { sendTx } from "@/lib/tx";
import { useTokenBalance } from "@/hooks/useQie";
import type { WalletState } from "@/hooks/useWallet";
import { Button, Kicker, Notice, Sheet } from "./ui";

/** An amount to six decimal places, cut off rather than rounded, so it never shows more than is there. */
function exact(amount: bigint, asset: AssetMeta) {
  const [whole, fraction = ""] = formatUnits(amount, asset.decimals).split(".");
  const shown = fraction.slice(0, 6).replace(/0+$/, "");
  return `${Number(whole).toLocaleString("en-US")}${shown ? `.${shown}` : ""}`;
}

interface Step {
  key: "approve" | "swap";
  title: string;
  detail: string;
  /** todo → wallet (waiting for the user to confirm) → pending (sent, waiting for the chain) → done, or error. */
  state: "todo" | "wallet" | "pending" | "done" | "error";
  hash?: Hash;
}

interface Flow {
  trade: { sellQie: boolean; amountIn: bigint; quoted: bigint };
  steps: Step[];
  outcome: null | { ok: true; received: bigint; hash: Hash } | { ok: false; message: string };
}

/** What the wallet actually received, read from the PactiqSwap event (absent when trading on QIEDEX directly). */
function receivedFrom(receipt: TransactionReceipt, user: Address): bigint | null {
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: PACTIQ_ROUTER_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "PactiqSwap" && ev.args.user.toLowerCase() === user.toLowerCase()) return ev.args.amountOut;
    } catch {
      /* some other contract's event */
    }
  }
  return null;
}

/** QIE kept back when selling the whole balance, so the wallet can still pay network fees. */
const FEE_RESERVE = parseEther("0.05");

/**
 * Swap QIE and QUSDC on QIEDEX without leaving Pactiq. The trade goes straight from the user's
 * wallet to the QIEDEX router; Pactiq never holds the funds and adds no fee.
 */
export function SwapSheet({
  wallet,
  open,
  usdPrice,
  onClose,
  onConnect,
  onDone,
}: {
  wallet: WalletState;
  open: boolean;
  usdPrice: number | null | undefined;
  onClose: () => void;
  onConnect: () => void;
  onDone: (message: string, href: string) => void;
}) {
  if (!open) return null;
  return <SwapForm wallet={wallet} usdPrice={usdPrice} onClose={onClose} onConnect={onConnect} onDone={onDone} />;
}

function SwapForm({ wallet, usdPrice, onClose, onConnect, onDone }: Omit<Parameters<typeof SwapSheet>[0], "open">) {
  const [sellQie, setSellQie] = useState(true);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<{ key: string; out: bigint; minOut: bigint } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  // null while checking, so the form doesn't flash "unavailable" before the answer arrives.
  const [qiedex, setQiedex] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    qiedexAvailable().then((v) => on && setQiedex(v));
    return () => {
      on = false;
    };
  }, []);
  const qusdc = useTokenBalance(QUSDC_ASSET.address, wallet.address);

  const from = sellQie ? QIE_ASSET : QUSDC_ASSET;
  const to = sellQie ? QUSDC_ASSET : QIE_ASSET;
  const fromBalance = sellQie ? wallet.balance : qusdc.balance;
  const toBalance = sellQie ? qusdc.balance : wallet.balance;
  const amountIn = parseAmount(amount, from);
  const key = `${sellQie}:${amountIn}`;

  useEffect(() => {
    if (amountIn === 0n) return;
    let on = true;
    const t = setTimeout(() => {
      quoteSwap(sellQie, amountIn)
        .then((q) => {
          if (!on) return;
          setQuote({ key: `${sellQie}:${amountIn}`, ...q });
          setQuoteError(null);
        })
        .catch(() => on && setQuoteError("QIEDEX can't quote this amount right now."));
    }, 300);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [sellQie, amountIn]);

  const live = amountIn > 0n && quote?.key === key ? quote : null;
  const spendable = fromBalance === null ? null : sellQie ? (fromBalance > FEE_RESERVE ? fromBalance - FEE_RESERVE : 0n) : fromBalance;
  const tooMuch = spendable !== null && amountIn > spendable;
  const busy = flow !== null && flow.outcome === null;
  // Price shown as QIE per dollar-coin either way round, whichever is easier to read.
  const rate = live ? (sellQie ? Number(live.out) / 1e6 / (Number(amountIn) / 1e18) : Number(amountIn) / 1e6 / (Number(live.out) / 1e18)) : null;

  const flip = () => {
    setSellQie((s) => !s);
    setAmount("");
  };

  const swap = async () => {
    if (!wallet.address) return onConnect();
    if (!live) return;
    const user = wallet.address;
    const trade = { sellQie, amountIn, quoted: live.out };
    const needsApproval = !sellQie && (await tokenAllowance(QUSDC_ASSET.address, user, SWAP_TARGET).catch(() => 0n)) < amountIn;
    const steps: Step[] = [
      ...(needsApproval ? [{ key: "approve" as const, title: "Approve QUSDC", detail: `Lets the swap use exactly ${exact(amountIn, QUSDC_ASSET)} QUSDC, nothing more.`, state: "todo" as const }] : []),
      { key: "swap", title: `Swap ${from.symbol} for ${to.symbol}`, detail: "The trade itself, on QIEDEX.", state: "todo" },
    ];
    setFlow({ trade, steps, outcome: null });
    const mark = (key: Step["key"], patch: Partial<Step>) =>
      setFlow((f) => (f ? { ...f, steps: f.steps.map((st) => (st.key === key ? { ...st, ...patch } : st)) } : f));

    let current: Step["key"] = needsApproval ? "approve" : "swap";
    try {
      if (needsApproval) {
        mark("approve", { state: "wallet" });
        await sendTx(wallet, { address: QUSDC_ASSET.address, abi: erc20Abi as Abi, functionName: "approve", args: [SWAP_TARGET, amountIn] }, { onSubmitted: (hash) => mark("approve", { state: "pending", hash }) });
        mark("approve", { state: "done" });
      }
      current = "swap";
      mark("swap", { state: "wallet" });
      const { call, value } = swapCall(sellQie, amountIn, live.minOut, user);
      const receipt = await sendTx(wallet, call, { value, onSubmitted: (hash) => mark("swap", { state: "pending", hash }) });
      mark("swap", { state: "done", hash: receipt.transactionHash });
      const received = receivedFrom(receipt, user) ?? live.out;
      setFlow((f) => (f ? { ...f, outcome: { ok: true, received, hash: receipt.transactionHash } } : f));
      await qusdc.refresh();
      onDone(`Swapped ${exact(amountIn, from)} ${from.symbol} for ${exact(received, to)} ${to.symbol} on QIEDEX.`, explorerTx(receipt.transactionHash));
      setAmount("");
    } catch (e) {
      const message = describeError(e);
      mark(current, { state: "error" });
      setFlow((f) => (f ? { ...f, outcome: { ok: false, message } } : f));
    }
  };

  const label = !wallet.address
    ? "Connect wallet to swap"
    : amountIn === 0n
      ? "Enter an amount"
      : tooMuch
        ? `Not enough ${from.symbol}`
        : !live
          ? (quoteError ?? "Getting a price…")
          : `Swap ${from.symbol} for ${to.symbol}`;

  return (
    <Sheet kicker="Powered by QIEDEX" title="Swap" subtitle="Trade QIE and QUSDC on QIE's own exchange, straight from your wallet." onClose={onClose} locked={busy}>
      {flow ? (
        <Progress flow={flow} onBack={() => setFlow(null)} onClose={onClose} />
      ) : qiedex === false ? (
        <Notice>QIEDEX isn&apos;t available on this network.</Notice>
      ) : (
        <div className="space-y-4">
          <div className="border border-rule rounded-md bg-paper/50 p-4">
            <div className="flex items-baseline justify-between">
              <Kicker>You pay</Kicker>
              {fromBalance !== null && (
                <button
                  type="button"
                  className="text-xs text-ink-2 hover:text-quill cursor-pointer"
                  onClick={() => spendable !== null && setAmount(formatUnits(spendable, from.decimals))}
                >
                  Balance <span className="num">{exact(fromBalance, from)}</span> · <span className="underline">Max</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input
                inputMode="decimal"
                placeholder="0.0"
                aria-label={`Amount of ${from.symbol} to pay`}
                value={amount}
                disabled={busy}
                onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setAmount(e.target.value)}
                className="num flex-1 min-w-0 bg-transparent text-3xl font-medium outline-none placeholder:text-ink-3"
              />
              <span className="font-display text-xl font-semibold shrink-0">{from.symbol}</span>
            </div>
            <div className="num text-xs text-ink-3 mt-1 h-4">{amountIn > 0n ? (formatUsdValue(usdValue(amountIn, from, usdPrice)) ?? "") : ""}</div>
          </div>

          <div className="flex justify-center -my-7 relative z-10">
            <button
              type="button"
              onClick={flip}
              disabled={busy}
              aria-label="Swap the other way round"
              className="w-10 h-10 grid place-items-center rounded-full border-2 border-ink bg-card cursor-pointer hover:bg-ink hover:text-card transition-colors disabled:opacity-50"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>
          </div>

          <div className="border border-rule rounded-md bg-paper/50 p-4">
            <div className="flex items-baseline justify-between">
              <Kicker>You receive (estimate)</Kicker>
              {toBalance !== null && (
                <span className="text-xs text-ink-2">
                  Balance <span className="num">{exact(toBalance, to)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`num flex-1 min-w-0 truncate text-3xl font-medium ${live ? "text-kept" : "text-ink-3"}`}>{live ? exact(live.out, to) : "0.0"}</span>
              <span className="font-display text-xl font-semibold shrink-0">{to.symbol}</span>
            </div>
            <div className="num text-xs text-ink-3 mt-1 h-4">{live ? (formatUsdValue(usdValue(live.out, to, usdPrice)) ?? "") : ""}</div>
          </div>

          {live && rate !== null && (
            <dl className="text-xs text-ink-2 grid grid-cols-[1fr_auto] gap-y-1.5 px-1">
              <dt>Price</dt>
              <dd className="num">1 QIE ≈ {rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} QUSDC</dd>
              <dt>Least you&apos;ll receive (1% slippage limit)</dt>
              <dd className="num">{exact(live.minOut, to)} {to.symbol}</dd>
              <dt>Pactiq fee</dt>
              <dd className="num">None</dd>
            </dl>
          )}

          <Button variant="seal" size="lg" className="w-full" disabled={busy || (!!wallet.address && (!live || tooMuch))} onClick={swap}>
            {label}
          </Button>

          <p className="text-xs text-ink-3 text-center leading-relaxed">
            The trade runs on{" "}
            <a href={QIEDEX_URL} target="_blank" rel="noreferrer" className="underline">
              QIEDEX
            </a>
            . Funds on another chain?{" "}
            <a href={QIE_BRIDGE_URL} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
              Use the QIE bridge <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      )}
    </Sheet>
  );
}

const STATE_LABEL: Record<Step["state"], string> = {
  todo: "Waiting",
  wallet: "Confirm in your wallet",
  pending: "Sent. Waiting for the network…",
  done: "Done",
  error: "Failed",
};

/** Live tracker for a swap: each transaction, where it has got to, and a link to it on the explorer. */
function Progress({ flow, onBack, onClose }: { flow: Flow; onBack: () => void; onClose: () => void }) {
  const { trade, steps, outcome } = flow;
  const from = trade.sellQie ? QIE_ASSET : QUSDC_ASSET;
  const to = trade.sellQie ? QUSDC_ASSET : QIE_ASSET;
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="border border-rule rounded-md bg-paper/50 p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Kicker>You pay</Kicker>
          <div className="num text-xl font-medium truncate">
            {exact(trade.amountIn, from)} <span className="font-display text-base">{from.symbol}</span>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-ink-3 shrink-0" />
        <div className="min-w-0 text-right">
          <Kicker>{outcome?.ok ? "You received" : "You receive (estimate)"}</Kicker>
          <div className={`num text-xl font-medium truncate ${outcome?.ok ? "text-kept" : ""}`}>
            {exact(outcome?.ok ? outcome.received : trade.quoted, to)} <span className="font-display text-base">{to.symbol}</span>
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((st, i) => {
          const tone = st.state === "done" ? "border-kept text-kept" : st.state === "error" ? "border-seal text-seal" : st.state === "todo" ? "border-rule text-ink-3" : "border-quill text-quill";
          return (
            <li key={st.key} className={`flex items-start gap-3 border rounded-md p-4 ${st.state === "todo" ? "border-rule opacity-60" : st.state === "error" ? "border-seal bg-seal/5" : "border-rule"}`}>
              <span className={`w-8 h-8 shrink-0 rounded-full border-2 grid place-items-center ${tone}`}>
                {st.state === "done" ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : st.state === "error" ? (
                  <X className="w-4 h-4" strokeWidth={3} />
                ) : st.state === "wallet" || st.state === "pending" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="num text-xs font-bold">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">{st.title}</p>
                  <p className={`text-xs font-semibold ${tone.split(" ")[1]}`}>{STATE_LABEL[st.state]}</p>
                </div>
                <p className="text-sm text-ink-2 mt-0.5">{st.detail}</p>
                {st.hash && (
                  <a href={explorerTx(st.hash)} target="_blank" rel="noreferrer" className="num text-xs text-quill underline inline-flex items-center gap-1 mt-1.5">
                    Transaction {st.hash.slice(0, 10)}…{st.hash.slice(-6)} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {outcome === null && <p className="text-xs text-ink-3 text-center">Keep this window open. Each step needs your confirmation in the wallet.</p>}

      {outcome?.ok && (
        <>
          <Notice tone="kept">
            Swap complete. {exact(outcome.received, to)} {to.symbol} is in your wallet.
          </Notice>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onBack}>
              Swap again
            </Button>
            <Button variant="ink" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}

      {outcome && !outcome.ok && (
        <>
          <Notice>
            <strong>The swap didn&apos;t go through.</strong> {outcome.message}
            {steps.some((st) => st.key === "approve" && st.state === "done") && " The approval went through, so you won't need to approve again for this amount."}
          </Notice>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="seal" onClick={onBack}>
              Try again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
