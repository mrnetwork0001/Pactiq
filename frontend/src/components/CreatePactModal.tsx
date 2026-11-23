"use client";

import React, { useEffect, useMemo, useState } from "react";
import { zeroAddress, type Address } from "viem";
import { Code, Dumbbell, BookOpen, Heart, Award, Loader2, HeartHandshake } from "lucide-react";
import confetti from "canvas-confetti";
import { Category, type AssetStats, type Charity } from "@/lib/types";
import { formatQie } from "@/lib/format";
import { formatAsset, parseAmount, QIE_ASSET, QUSDC_ASSET, usdHint, type AssetMeta } from "@/lib/assets";
import { quotePactUsd } from "@/lib/pactiq";
import { useQieId, useQiedex, useTokenBalance } from "@/hooks/useQie";
import { QieIdField } from "./QieIdField";
import { QiedexSwap } from "./QiedexSwap";
import { GetQie } from "./GetQie";
import { Button, CONFETTI, Clause, Notice, Row, Sheet } from "./ui";

export interface CreatePactInput {
  title: string;
  category: Category;
  totalDays: number;
  qieId: string;
  charity: Address;
  /**
   * "qie":   exact stake in QIE.
   * "usd":   dollars per day paid in QIE, priced on-chain by the QIE Oracle; `value` includes a refundable buffer.
   * "qusdc": stake in QUSDC, QIE's stablecoin (approve + create).
   */
  mode: "qie" | "usd" | "qusdc";
  asset: Address;
  dailyStake: bigint;
  usdPerDay: bigint;
  value: bigint;
}

interface CreatePactModalProps {
  isOpen: boolean;
  address: Address | null;
  balance: bigint | null;
  /** QIE ledger: minimum and bonus pool. */
  qie: Pick<AssetStats, "minStakePerDay" | "rewardPool">;
  /** QUSDC ledger, when the vault accepts QUSDC. */
  qusdc: AssetStats | null;
  usdPrice?: number;
  charities: Charity[];
  defaultQieId: string;
  onClose: () => void;
  onSubmit: (input: CreatePactInput, onStatus: (s: string) => void) => Promise<void>;
  onSwap: (qusdcOut: bigint, qieIn: bigint, onStatus: (s: string) => void) => Promise<void>;
  onConnect?: () => void;
}

/** Outer shell: mounting the form only while open resets its state on every open. */
export const CreatePactModal: React.FC<CreatePactModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <CreatePactForm {...props} />;
};

export const CATEGORIES = [
  { cat: Category.CODING, label: "Coding", icon: Code },
  { cat: Category.FITNESS, label: "Fitness", icon: Dumbbell },
  { cat: Category.LEARNING, label: "Learning", icon: BookOpen },
  { cat: Category.MEDITATION, label: "Mindfulness", icon: Heart },
  { cat: Category.CUSTOM, label: "Custom", icon: Award },
];

const DURATIONS = [7, 14, 21, 30];
const PRESETS = { qie: ["1", "5", "10", "25"], usd: ["0.5", "1", "2", "5"], qusdc: ["0.5", "1", "2", "5"] } as const;
const DEFAULT_AMOUNT = { qie: "5", usd: "1", qusdc: "1" } as const;
const USD_BUFFER_BPS = 200n; // send 2% extra in case the price moves before the tx lands; refunded

function CreatePactForm({
  address,
  balance,
  qie,
  qusdc,
  usdPrice,
  charities,
  defaultQieId,
  onClose,
  onSubmit,
  onSwap,
  onConnect,
}: CreatePactModalProps) {
  const connected = !!address;
  const qusdcOpen = !!qusdc && qusdc.minStakePerDay > 0n;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(Category.CODING);
  const [totalDays, setTotalDays] = useState<number>(14);
  const [mode, setMode] = useState<"qie" | "usd" | "qusdc">("qie");
  const [amount, setAmount] = useState<string>("5");
  const qieId = useQieId(address, defaultQieId);
  const [charity, setCharity] = useState<Address>(zeroAddress);
  const [quote, setQuote] = useState<{ key: string; daily: bigint; total: bigint } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const qusdcBalance = useTokenBalance(qusdcOpen ? QUSDC_ASSET.address : null, address);
  const qiedex = useQiedex();

  const asset: AssetMeta = mode === "qusdc" ? QUSDC_ASSET : QIE_ASSET;
  const ledger = mode === "qusdc" && qusdc ? qusdc : qie;
  const activeCharities = charities.filter((c) => c.active);
  const parsedAmount = useMemo(() => (mode === "usd" ? parseAmount(amount, QIE_ASSET) : parseAmount(amount, asset)), [amount, asset, mode]);

  // USD mode: ask the contract (QIE Oracle) what the stake is, debounced.
  const quoteKey = `${parsedAmount}:${totalDays}`;
  useEffect(() => {
    if (mode !== "usd" || parsedAmount === 0n) return;
    const t = setTimeout(() => {
      quotePactUsd(parsedAmount, totalDays)
        .then((q) => {
          setQuote({ key: quoteKey, ...q });
          setQuoteError(null);
        })
        .catch(() => setQuoteError("The QIE Oracle price is unavailable right now. Stake in QIE or QUSDC instead."));
    }, 300);
    return () => clearTimeout(t);
  }, [mode, parsedAmount, totalDays, quoteKey]);

  const liveQuote = mode === "usd" && quote?.key === quoteKey ? quote : null;
  const daily = mode === "usd" ? (liveQuote?.daily ?? 0n) : parsedAmount;
  const total = daily * BigInt(totalDays);
  const sendValue = mode === "usd" ? total + (total * USD_BUFFER_BPS) / 10_000n : mode === "qie" ? total : 0n;
  const maxBonus = (total * 1500n) / 10_000n;
  const poolBonus = ledger.rewardPool < maxBonus ? ledger.rewardPool : maxBonus;
  const charityName = activeCharities.find((c) => c.account === charity)?.name;
  const qusdcShort = mode === "qusdc" && qusdcBalance.balance !== null && total > qusdcBalance.balance ? total - qusdcBalance.balance : 0n;

  const validation = (() => {
    if (!title.trim()) return "Name the habit you're committing to.";
    if (new TextEncoder().encode(title.trim()).length > 80) return "The habit must be 80 characters or fewer.";
    if (mode === "usd" && !liveQuote) return quoteError ?? "Asking the QIE Oracle for a price…";
    if (daily < ledger.minStakePerDay) return `The minimum stake is ${formatAsset(ledger.minStakePerDay, asset, 4)} a day.`;
    if (qieId.problem) return qieId.problem;
    if (mode === "qusdc" && qusdcShort > 0n) return `You need ${formatAsset(qusdcShort, QUSDC_ASSET)} more. Swap on QIEDEX below.`;
    if (balance !== null && sendValue > balance) return `You need ${formatQie(sendValue, 4)} QIE plus gas.`;
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return onConnect ? onConnect() : setErrorMessage("Connect your wallet first.");
    if (validation) return setErrorMessage(validation);
    setErrorMessage(null);
    setStatus("Confirm in your wallet…");
    try {
      await onSubmit(
        {
          title: title.trim(),
          category,
          totalDays,
          qieId: qieId.submitName,
          charity,
          mode,
          asset: asset.address,
          dailyStake: daily,
          usdPerDay: mode === "usd" ? parsedAmount : 0n,
          value: sendValue,
        },
        setStatus
      );
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: CONFETTI });
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create the pact.");
      setStatus(null);
    }
  };

  const busy = status !== null;
  const presets: readonly string[] = PRESETS[mode];
  const signer = qieId.submitName || "the undersigned";
  const stakeText = mode === "qie" ? `${amount || "0"} QIE` : mode === "usd" ? `$${amount || "0"}` : `${amount || "0"} QUSDC`;
  const modes = [
    { id: "qie" as const, label: "In QIE" },
    { id: "usd" as const, label: "In dollars, paid in QIE" },
    ...(qusdcOpen ? [{ id: "qusdc" as const, label: "In QUSDC stablecoin" }] : []),
  ];

  return (
    <Sheet kicker="Draft · solo pact" title="Draft your pact" subtitle="Day 1 opens the moment your stake is locked." onClose={onClose} locked={busy}>
      <form onSubmit={handleSubmit} className="space-y-7">
        <Clause n={1} label="The habit">
          <input
            type="text"
            maxLength={80}
            placeholder="e.g. Ship one commit every day"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field font-display text-lg"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIES.map(({ cat, label, icon: Icon }) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} data-active={category === cat} className="choice inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={2} label="The term">
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setTotalDays(d)} data-active={totalDays === d} className="choice">
                {d} days
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={3} label="The stake, per day">
          <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                data-active={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setAmount(DEFAULT_AMOUNT[m.id]);
                }}
                className="choice !py-1 !px-2.5"
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {presets.map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)} data-active={amount === v} className="choice num">
                {mode === "qie" ? v : `$${v}`}
              </button>
            ))}
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              aria-label="Custom daily stake"
              value={presets.includes(amount) ? "" : amount}
              placeholder="Other"
              onChange={(e) => setAmount(e.target.value)}
              className="field !py-2 !px-2 text-center num text-sm col-span-4 sm:col-span-1"
            />
          </div>
          {mode === "usd" && (
            <p className="text-xs text-ink-2 mt-2">
              {liveQuote
                ? `≈ ${formatQie(liveQuote.daily, 4)} QIE a day, priced on-chain by the QIE Oracle when you sign.`
                : (quoteError ?? "Asking the QIE Oracle for a price…")}
            </p>
          )}
          {mode === "qusdc" && (
            <p className="text-xs text-ink-2 mt-2">
              QUSDC is QIE&apos;s USDC-backed stablecoin: your stake and refunds stay worth exactly what you put in.
              {qusdcBalance.balance !== null && (
                <span className="num text-ink-3"> You hold {formatAsset(qusdcBalance.balance, QUSDC_ASSET)}.</span>
              )}
            </p>
          )}
          {mode === "qusdc" && connected && qusdcShort > 0n && qiedex && (
            <div className="mt-3">
              <QiedexSwap
                shortfall={qusdcShort}
                qieBalance={balance}
                onSwap={async (out, qieIn, onStatus) => {
                  await onSwap(out, qieIn, onStatus);
                  await qusdcBalance.refresh();
                }}
              />
            </div>
          )}
          {/* Not enough QIE for the stake (or, staking QUSDC, none at all for the network fee): show the way in. */}
          {connected && address && balance !== null && (mode === "qusdc" ? balance === 0n : sendValue > balance) && (
            <div className="mt-3">
              <GetQie compact address={address} needed={mode === "qusdc" || balance === 0n ? undefined : sendValue - balance} />
            </div>
          )}
        </Clause>

        <Clause n={4} label="If I miss a day, that day's stake goes to">
          <div className="grid gap-2">
            <button type="button" onClick={() => setCharity(zeroAddress)} data-active={charity === zeroAddress} className="choice text-left">
              The bonus pool <span className="font-normal opacity-70">: paid to people who finish</span>
            </button>
            {activeCharities.map((c) => (
              <button
                key={c.account}
                type="button"
                onClick={() => setCharity(c.account)}
                data-active={charity === c.account}
                className="choice text-left inline-flex items-center gap-2"
              >
                <HeartHandshake className="w-4 h-4 shrink-0" />
                <span>
                  {c.name} <span className="font-normal opacity-70">: charity mode, 100% donated</span>
                </span>
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={5} label="Your signature" hint="your QIE ID, verified on-chain">
          <QieIdField id={qieId} />
        </Clause>

        <div className="border-2 border-ink rounded-md bg-paper/60">
          <p className="font-display text-lg leading-relaxed px-5 pt-5">
            I, <span className="font-sign text-quill text-2xl">{signer}</span>, pledge to{" "}
            <em className="font-semibold">{title.trim() || "keep my habit"}</em> every day for <strong>{totalDays} days</strong>, staking{" "}
            <strong>{stakeText}</strong> a day. Should I miss a day, that day&apos;s stake goes to <strong>{charityName ?? "the bonus pool"}</strong>.
          </p>
          <div className="px-5 py-4 mt-4 border-t border-rule space-y-1.5 text-sm">
            <Row label="Locked today">
              <span className="num font-semibold">
                {formatAsset(total, asset, 4)}
                {usdHint(total, asset, usdPrice) ? <span className="text-ink-3 font-normal"> ≈ {usdHint(total, asset, usdPrice)}</span> : null}
              </span>
            </Row>
            <Row label="Refunded per verified day">
              <span className="num">{formatAsset(daily, asset, 4)}</span>
            </Row>
            <Row label={"Completion bonus (up to 15%)"}>
              <span className="num text-gold font-semibold">+{formatAsset(poolBonus, asset, 4)}</span>
            </Row>
            <Row label={<strong className="text-ink">If you keep every day</strong>}>
              <span className="num text-kept font-bold">{formatAsset(total + poolBonus, asset, 4)}</span>
            </Row>
            <p className="text-xs text-ink-3 pt-2">
              {charityName ? `Missed days are donated in full to ${charityName}.` : "Missed days: 95% to the bonus pool, 5% protocol fee."}
              {mode === "usd" && " You send 2% extra in case the price moves; the unused part comes back in the same transaction."}
              {mode === "qusdc" && " Two wallet steps: approve exactly this amount of QUSDC, then sign the pact."}
            </p>
          </div>
        </div>

        {errorMessage && <Notice>{errorMessage}</Notice>}

        <Button type="submit" variant="seal" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {status}
            </>
          ) : connected ? (
            `Sign & lock ${formatAsset(total, asset, 4)}`
          ) : (
            "Connect wallet to sign"
          )}
        </Button>
        <p className="text-xs text-ink-3 text-center">
          Missed days are not refunded. By signing you accept the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">
            terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            privacy notice
          </a>
          .
        </p>
      </form>
    </Sheet>
  );
}

