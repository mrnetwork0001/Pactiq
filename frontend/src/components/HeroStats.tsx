"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatQie } from "@/lib/format";
import { amountsUsd, formatAsset, formatUsdValue, QUSDC_ASSET } from "@/lib/assets";
import type { ProtocolStats, QiePrice } from "@/lib/types";
import { BigStamp, DayStamp, Figure, Kicker, Signature, btn, type DayKind } from "./ui";
import { CountUp, prefersReducedMotion } from "./Motion";

const TERM = 7;

/** Landing hero: the promise, two calls to action, and a specimen of a pact being kept. */
export function Hero({ returning }: { returning: boolean }) {
  return (
    <section className="pt-10 sm:pt-16">
      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-12 lg:gap-10 items-center">
        <div>
          <h1 className="font-display font-semibold tracking-[-0.02em] leading-[0.95] text-[3.1rem] sm:text-7xl lg:text-[5.4rem]">
            <span className="block animate-rise">Make a pact</span>
            <span className="block animate-rise [animation-delay:110ms]">with yourself.</span>
            <span className="block animate-rise [animation-delay:220ms] italic font-normal">
              Put <span className="scribble">money</span> on it.
            </span>
          </h1>
          <p className="mt-7 text-lg text-ink-2 max-w-xl leading-relaxed animate-rise [animation-delay:340ms]">
            Stake QIE on a daily habit. Each day, photograph your proof with a one-time code. An AI witness checks it and
            the chain keeps the record. Keep every day and you get it all back <em>plus</em> a share of what the quitters
            left behind.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 animate-rise [animation-delay:460ms]">
            {returning ? (
              <Link href="/app" className={btn("seal", "lg")}>
                Go to your pacts
              </Link>
            ) : (
              <Link href="/app#new" className={btn("seal", "lg")}>
                Sign your first pact
              </Link>
            )}
            <Link href="/app#squads" className={btn("outline", "lg")}>
              Join a squad
            </Link>
          </div>
        </div>

        <div className="animate-rise [animation-delay:300ms]">
          <Specimen />
        </div>
      </div>
    </section>
  );
}

/**
 * Specimen document, illustrative. It never sits still: the sheet floats, and the pact plays out
 * on a loop. Each day opens, gets stamped, and on day 7 the pact is marked Kept and paid back.
 */
function Specimen() {
  // Days verified so far. Starts complete so the server render (and reduced motion) shows a kept pact.
  const [day, setDay] = useState(TERM);
  const [run, setRun] = useState(0);
  const kept = day >= TERM;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setTimeout(
      () => {
        if (day >= TERM) {
          setRun((r) => r + 1);
          setDay(0);
        } else {
          setDay((d) => d + 1);
        }
      },
      day >= TERM ? 3800 : day === 0 ? 1500 : 900
    );
    return () => clearTimeout(t);
  }, [day]);

  return (
    <div className="float-card relative mx-auto w-full max-w-md lg:rotate-[1.5deg]" aria-hidden="true">
      <div className="float-back absolute inset-0 sheet rounded-md" />
      <div className="relative sheet rounded-md p-6 sm:p-7">
        <div className="flex justify-between items-start">
          <Kicker>Pact Nº 0001 · Coding</Kicker>
          <Kicker className="!text-seal">Specimen</Kicker>
        </div>
        <div className="font-display text-3xl font-semibold mt-3 leading-tight">Ship one commit every day</div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-rule py-3">
          <Figure size="sm" label="Stake" value="1 QIE/day" />
          <Figure size="sm" label="Term" value="7 days" />
          <Figure
            size="sm"
            label="Paid back"
            tone={kept ? "gold" : "ink"}
            value={
              <span key={day} className="tick-in">
                {kept ? "7.84 QIE" : `${day}.00 QIE`}
              </span>
            }
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from({ length: TERM }, (_, i) => {
            const kind: DayKind = i < day ? "done" : i === day ? "open" : "future";
            return (
              <span key={`${run}-${i}-${kind}`} className={kind === "done" ? "day-pop" : "inline-flex"}>
                <DayStamp day={i + 1} kind={kind} size={34} />
              </span>
            );
          })}
        </div>
        <div className="mt-7 grid grid-cols-2 gap-6 items-end">
          <div key={run} className="sign-write min-w-0">
            <Signature name="maya.qie" caption="Signed · maya.qie" />
          </div>
          <div className="text-right">
            <div className="num text-[11px] text-ink-2">
              <span key={day} className="tick-in">
                {day}/{TERM} verified
              </span>
            </div>
            <div className="kicker !text-[10px] border-t border-ink/60 pt-1 mt-1">Witness · AI verifier</div>
          </div>
        </div>
        {kept && <BigStamp key={run} text="Kept" className="absolute right-7 bottom-[5.6rem] text-4xl" />}
      </div>
    </div>
  );
}

/** Live protocol figures in a ruled ledger row. `compact` is the slim strip used at the top of /app. */
export function StatsLedger({
  stats,
  price,
  loading,
  compact = false,
}: {
  stats: ProtocolStats | null;
  price: QiePrice | null;
  loading: boolean;
  compact?: boolean;
}) {
  const settled = stats ? stats.completed + stats.failed : 0;
  const q = stats?.qusdc;
  // Two currencies: headline in dollars (QIE priced by the QIE Oracle, QUSDC 1:1), legs underneath.
  // The landing ledger counts its figures up as it scrolls into view; the compact strip in /app doesn't.
  const num = (text: string) => (compact ? text : <CountUp text={text} />);
  const inQie = (qie: bigint) => (
    <>
      {num(formatQie(qie))} <small className="text-sm text-ink-3">QIE</small>
    </>
  );
  const money = (qie: bigint, qusdc: bigint | undefined) => {
    const legs = { qie, qusdc: qusdc ?? 0n };
    const usd = amountsUsd(legs, price?.usd);
    const both = legs.qusdc > 0n;
    if (!both) return { value: inQie(qie), legs: formatUsdValue(usd) };
    const dollars = formatUsdValue(usd);
    return dollars !== null
      ? { value: num(dollars), legs: `${formatQie(qie)} QIE + ${formatAsset(legs.qusdc, QUSDC_ASSET)}` }
      : { value: inQie(qie), legs: `+ ${formatAsset(legs.qusdc, QUSDC_ASSET)}` };
  };
  const locked = stats ? money(stats.activeStake, q?.activeStake) : null;
  const pool = stats ? money(stats.rewardPool, q?.rewardPool) : null;
  const paid = stats ? amountsUsd({ qie: stats.bonusesPaid, qusdc: q?.bonusesPaid ?? 0n }, price?.usd) : null;
  const donated = stats ? amountsUsd({ qie: stats.donated, qusdc: q?.donated ?? 0n }, price?.usd) : null;
  const sponsored = stats ? amountsUsd({ qie: stats.sponsored, qusdc: q?.sponsored ?? 0n }, price?.usd) : null;
  const keptRate = stats && settled > 0 ? Math.round((stats.completed / settled) * 100) : null;
  const show = (v: React.ReactNode) => (loading && !stats ? <span className="inline-block w-16 h-6 bg-paper-2 animate-pulse rounded" /> : v);
  const size = compact ? "md" : "lg";

  return (
    <div className={`${compact ? "border-y border-ink ledger-compact" : "border-y-2 border-ink"} ledger`}>
      <div>
        <Figure
          size={size}
          label="Locked in pacts"
          value={show(locked?.value ?? <>0 <small className="text-sm text-ink-3">QIE</small></>)}
          sub={compact ? undefined : locked?.legs || "Escrowed by the vault"}
        />
      </div>
      <div>
        <Figure
          size={size}
          label="Pacts signed"
          value={show(num((stats?.pactCount ?? 0).toLocaleString("en-US")))}
          sub={compact ? undefined : stats ? `${stats.squadCount} squads · ${keptRate === null ? "—" : `${keptRate}% kept`}` : "—"}
        />
      </div>
      <div>
        <Figure
          size={size}
          tone="gold"
          label="Bonus pool"
          value={show(pool?.value ?? <>0 <small className="text-sm text-ink-3">QIE</small></>)}
          sub={
            compact
              ? undefined
              : stats
                ? q
                  ? `${pool?.legs ?? ""}${paid !== null ? ` · ${formatUsdValue(paid)} paid` : ""}`
                  : `${formatQie(stats.bonusesPaid)} paid · ${formatQie(stats.donated)} donated`
                : "Paid to finishers"
          }
        />
      </div>
      <div>
        <Figure
          size={size}
          tone="kept"
          label="Verified check-ins"
          value={show(num((stats?.checkIns ?? 0).toLocaleString("en-US")))}
          sub={
            compact
              ? undefined
              : stats
                ? q && sponsored !== null
                  ? `${formatUsdValue(sponsored)} sponsored${donated ? ` · ${formatUsdValue(donated)} donated` : ""}`
                  : `${formatQie(stats.sponsored)} QIE sponsored`
                : "AI-witnessed, on-chain"
          }
        />
      </div>
    </div>
  );
}
