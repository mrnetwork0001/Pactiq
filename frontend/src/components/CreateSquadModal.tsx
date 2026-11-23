"use client";

import React, { useMemo, useState } from "react";
import type { Address } from "viem";
import { Loader2 } from "lucide-react";
import { Category, type AssetStats } from "@/lib/types";
import { formatQie } from "@/lib/format";
import { formatAsset, parseAmount, QIE_ASSET, QUSDC_ASSET, usdHint } from "@/lib/assets";
import { CHALLENGE_TEMPLATES } from "@/lib/templates";
import { useQieId, useQiedex, useTokenBalance } from "@/hooks/useQie";
import { CATEGORIES } from "./CreatePactModal";
import { QieIdField } from "./QieIdField";
import { QiedexSwap } from "./QiedexSwap";
import { Button, Clause, Kicker, Notice, Row, Sheet } from "./ui";

export interface CreateSquadInput {
  title: string;
  category: Category;
  asset: Address;
  dailyStake: bigint;
  totalDays: number;
  startTime: number;
  maxMembers: number;
  sponsor: string;
  sponsorship: bigint;
  joinMyself: boolean;
  qieId: string;
}

interface Props {
  open: { sponsored: boolean } | null;
  address: Address | null;
  balance: bigint | null;
  qieMinStake: bigint;
  qusdc: AssetStats | null;
  usdPrice?: number;
  now: number;
  defaultQieId: string;
  onClose: () => void;
  onSubmit: (input: CreateSquadInput, onStatus: (s: string) => void) => Promise<void>;
  onSwap: (qusdcOut: bigint, qieIn: bigint, onStatus: (s: string) => void) => Promise<void>;
  onConnect?: () => void;
}

export const CreateSquadModal: React.FC<Props> = (props) => {
  if (!props.open) return null;
  return <Form key={String(props.open.sponsored)} sponsoredDefault={props.open.sponsored} {...props} />;
};

const STARTS = [
  { label: "In 1 hour", seconds: 3600 },
  { label: "Tomorrow", seconds: 86_400 },
  { label: "In 3 days", seconds: 3 * 86_400 },
  { label: "In 7 days", seconds: 7 * 86_400 },
];
const SIZES = [5, 10, 25, 100];
const DAY_OPTIONS = [3, 7, 14, 21, 30, 60, 100];

function Form({
  sponsoredDefault,
  address,
  balance,
  qieMinStake,
  qusdc,
  usdPrice,
  now,
  defaultQieId,
  onClose,
  onSubmit,
  onSwap,
  onConnect,
}: Props & { sponsoredDefault: boolean }) {
  const connected = !!address;
  const qusdcOpen = !!qusdc && qusdc.minStakePerDay > 0n;
  const [currency, setCurrency] = useState<"qie" | "qusdc">("qie");
  const asset = currency === "qusdc" ? QUSDC_ASSET : QIE_ASSET;
  const minStake = currency === "qusdc" && qusdc ? qusdc.minStakePerDay : qieMinStake;
  const qusdcBalance = useTokenBalance(qusdcOpen ? QUSDC_ASSET.address : null, address);
  const qiedex = useQiedex();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(Category.CODING);
  const [totalDays, setTotalDays] = useState(14);
  const [dailyStake, setDailyStake] = useState("5");
  const [startIn, setStartIn] = useState(86_400);
  const [maxMembers, setMaxMembers] = useState(sponsoredDefault ? 100 : 10);
  const [sponsored, setSponsored] = useState(sponsoredDefault);
  const [sponsor, setSponsor] = useState("");
  const [sponsorship, setSponsorship] = useState(sponsoredDefault ? "100" : "0");
  const [joinMyself, setJoinMyself] = useState(!sponsoredDefault);
  const qieId = useQieId(address, defaultQieId);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dailyWei = useMemo(() => parseAmount(dailyStake, asset), [dailyStake, asset]);
  const sponsorWei = useMemo(() => (sponsored ? parseAmount(sponsorship, asset) : 0n), [sponsorship, sponsored, asset]);
  const stakeWei = dailyWei * BigInt(totalDays);
  const needed = sponsorWei + (joinMyself ? stakeWei : 0n);
  const qusdcShort = currency === "qusdc" && qusdcBalance.balance !== null && needed > qusdcBalance.balance ? needed - qusdcBalance.balance : 0n;

  const validation = (() => {
    if (!title.trim()) return "Give the squad a name.";
    if (new TextEncoder().encode(title.trim()).length > 80) return "The name must be 80 characters or fewer.";
    if (dailyWei < minStake) return `The minimum stake is ${formatAsset(minStake, asset, 4)} a day.`;
    if (sponsored && !sponsor.trim()) return "Add the sponsor's name.";
    if (sponsor.length > 40) return "The sponsor name must be 40 characters or fewer.";
    if (joinMyself && qieId.problem) return qieId.problem;
    if (qusdcShort > 0n) return `You need ${formatAsset(qusdcShort, QUSDC_ASSET)} more. Swap on QIEDEX above.`;
    if (currency === "qie" && balance !== null && needed > balance) return `You need ${formatQie(needed, 4)} QIE plus gas.`;
    return null;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return onConnect ? onConnect() : setError("Connect your wallet first.");
    if (validation) return setError(validation);
    setError(null);
    try {
      await onSubmit(
        {
          title: title.trim(),
          category,
          asset: asset.address,
          dailyStake: dailyWei,
          totalDays,
          startTime: now + startIn,
          maxMembers,
          sponsor: sponsored ? sponsor.trim() : "",
          sponsorship: sponsorWei,
          joinMyself,
          qieId: qieId.submitName,
        },
        setStatus
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the squad.");
      setStatus(null);
    }
  };

  return (
    <Sheet
      kicker={sponsored ? "Charter · sponsored challenge" : "Charter · squad"}
      title={sponsored ? "Fund a challenge" : "Charter a squad"}
      subtitle={
        sponsored
          ? "Your pot is split equally between everyone who finishes. If nobody does, it goes to the community bonus pool."
          : "Invite friends with a link. Everyone's missed days are split between the squad's finishers."
      }
      onClose={onClose}
      locked={!!status}
    >
      <form onSubmit={submit} className="space-y-7">
        <div>
          <Kicker className="mb-2">Start from a template</Kicker>
          <div className="flex flex-wrap gap-2">
            {CHALLENGE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  setCategory(t.category);
                  setTotalDays(t.totalDays);
                  setDailyStake(t.dailyStake);
                }}
                className="choice !py-1 !px-2.5 !text-xs"
              >
                {t.title.split(":")[0]}
              </button>
            ))}
          </div>
        </div>

        <Clause n={1} label="The shared habit">
          <input type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 6am gym crew" className="field font-display text-lg" />
          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIES.map(({ cat, label, icon: Icon }) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} data-active={category === cat} className="choice inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={2} label="Term and stake">
          {qusdcOpen && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
              {(["qie", "qusdc"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  data-active={currency === c}
                  onClick={() => {
                    setCurrency(c);
                    setDailyStake(c === "qusdc" ? "1" : "5");
                    setSponsorship(sponsored ? (c === "qusdc" ? "20" : "100") : "0");
                  }}
                  className="choice !py-1 !px-2.5"
                >
                  {c === "qie" ? "Stake in QIE" : "Stake in QUSDC stablecoin"}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="kicker block mb-1">Days</span>
              <select value={totalDays} onChange={(e) => setTotalDays(Number(e.target.value))} className="field">
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="kicker block mb-1">{asset.symbol} per day</span>
              <input type="number" min="0.01" step="0.01" value={dailyStake} onChange={(e) => setDailyStake(e.target.value)} className="field num" />
            </label>
          </div>
        </Clause>

        <Clause n={3} label="Day 1 starts" hint="late joiners have 12 hours">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STARTS.map((s) => (
              <button key={s.seconds} type="button" onClick={() => setStartIn(s.seconds)} data-active={startIn === s.seconds} className="choice">
                {s.label}
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={4} label="Seats">
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setMaxMembers(n)} data-active={maxMembers === n} className="choice num">
                {n}
              </button>
            ))}
          </div>
        </Clause>

        <Clause n={5} label="Prize pot">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} className="accent-seal w-4 h-4" />
            Sponsor it: add {asset.symbol} to the finishers&apos; pot
          </label>
          {sponsored && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="kicker block mb-1">Sponsor name</span>
                <input type="text" maxLength={40} value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Your project" className="field" />
              </label>
              <label className="block">
                <span className="kicker block mb-1">Pot ({asset.symbol})</span>
                <input type="number" min="0" step="1" value={sponsorship} onChange={(e) => setSponsorship(e.target.value)} className="field num" />
              </label>
            </div>
          )}
        </Clause>

        <Clause n={6} label="Your seat">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={joinMyself} onChange={(e) => setJoinMyself(e.target.checked)} className="accent-seal w-4 h-4" />
            Join it myself and stake {formatAsset(stakeWei, asset, 4)}
          </label>
          {joinMyself && (
            <div className="mt-3">
              <QieIdField id={qieId} compact />
            </div>
          )}
        </Clause>

        <div className="border-2 border-ink rounded-md bg-paper/60 px-5 py-4 space-y-1.5 text-sm">
          <Row label="Each member stakes">
            <span className="num font-semibold">{formatAsset(stakeWei, asset, 4)}</span>
          </Row>
          {sponsored && (
            <Row label="Sponsor pot">
              <span className="num text-gold font-semibold">
                {formatAsset(sponsorWei, asset, 4)} {usdHint(sponsorWei, asset, usdPrice) ? `≈ ${usdHint(sponsorWei, asset, usdPrice)}` : ""}
              </span>
            </Row>
          )}
          <Row label={<strong className="text-ink">You send now</strong>}>
            <span className="num text-kept font-bold">{formatAsset(needed, asset, 4)}</span>
          </Row>
          {currency === "qusdc" && needed > 0n && (
            <p className="text-xs text-ink-3 pt-1">You approve exactly this much QUSDC first, then sign.</p>
          )}
        </div>

        {currency === "qusdc" && connected && qusdcShort > 0n && qiedex && (
          <QiedexSwap
            shortfall={qusdcShort}
            qieBalance={balance}
            onSwap={async (out, qieIn, onStatus) => {
              await onSwap(out, qieIn, onStatus);
              await qusdcBalance.refresh();
            }}
          />
        )}

        {error && <Notice>{error}</Notice>}

        <Button type="submit" variant="seal" size="lg" className="w-full" disabled={!!status}>
          {status ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {status}
            </>
          ) : connected ? (
            sponsored ? "Publish the challenge" : "Charter the squad"
          ) : (
            "Connect wallet to create"
          )}
        </Button>
      </form>
    </Sheet>
  );
}
