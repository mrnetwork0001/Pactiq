"use client";

import React from "react";
import { Flame, Loader2, CalendarPlus, Users, HeartHandshake } from "lucide-react";
import { Category, CATEGORY_LABELS, PactStatus, type PactWithDays } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAmount, formatAsset, usdHint } from "@/lib/assets";
import { computeStreak, currentDay, dayState, dayWindow, formatDuration, openCheckInDay, settleableAt, settleState } from "@/lib/pactTime";
import { BigStamp, Button, DayStamp, Figure, Kicker, Signature } from "./ui";

interface PactCardProps {
  pact: PactWithDays;
  now: number;
  usdPrice?: number;
  settling: boolean;
  squadTitle?: string;
  charityName?: string;
  onOpenCheckIn: (pact: PactWithDays, day: number) => void;
  onSettle: (pact: PactWithDays) => void;
  onOpenSquad: (squadId: number) => void;
}

export const PactCard: React.FC<PactCardProps> = ({
  pact,
  now: rawNow,
  usdPrice,
  settling,
  squadTitle,
  charityName,
  onOpenCheckIn,
  onSettle,
  onOpenSquad,
}) => {
  // Solo pacts start the moment they're created; never show them as "not started" because the
  // synced clock trails the newest block by a few seconds.
  const now = rawNow > 0 && pact.squadId === 0 ? Math.max(rawNow, pact.startTime) : rawNow;
  const ready = now > 0;
  const today = ready ? currentDay(pact, now) : 1;
  const openDay = ready ? openCheckInDay(pact, pact.days, now) : null;
  const isSquad = pact.squadId !== 0;
  const asset = assetOf(pact.asset);
  const active = pact.status === PactStatus.ACTIVE;
  // Squad pacts always settle together after the squad ends (incl. grace), even if complete.
  const rawSettle = ready ? settleState(pact, now) : "locked";
  const settle = isSquad && rawSettle === "complete" && now <= settleableAt(pact) ? "locked" : rawSettle;
  const streak = ready ? computeStreak(pact, pact.days, now) : 0;
  const refund = pact.dailyStake * BigInt(pact.checkInCount);
  const slashed = pact.totalStaked - refund;
  const notStarted = active && ready && now < pact.startTime;

  return (
    <article className="relative sheet rounded-md flex flex-col overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-rule">
        <div className="flex items-center justify-between gap-3">
          <Kicker>
            Pact Nº {String(pact.id).padStart(4, "0")} · {CATEGORY_LABELS[pact.category as Category] ?? "Custom"}
          </Kicker>
          {active ? (
            <span className="inline-flex items-center gap-1 num text-xs font-semibold text-seal whitespace-nowrap shrink-0">
              <Flame className="w-3.5 h-3.5 fill-seal" />
              {streak}-day streak
            </span>
          ) : (
            <Kicker className={`whitespace-nowrap shrink-0 ${pact.status === PactStatus.COMPLETED ? "!text-kept" : "!text-seal"}`}>
              {pact.status === PactStatus.COMPLETED ? "Kept" : "Settled"} · {pact.checkInCount}/{pact.totalDays}
            </Kicker>
          )}
        </div>
        <h3 className="font-display text-2xl font-semibold leading-tight mt-2 break-words pr-2">{pact.title}</h3>
        {(isSquad || charityName) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
            {isSquad && (
              <button onClick={() => onOpenSquad(pact.squadId)} className="inline-flex items-center gap-1 text-quill font-semibold hover:underline cursor-pointer max-md:min-h-10">
                <Users className="w-3.5 h-3.5" /> Squad #{pact.squadId}
                {squadTitle && squadTitle !== pact.title ? ` · ${squadTitle}` : ""}
              </button>
            )}
            {charityName && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <HeartHandshake className="w-3.5 h-3.5 text-seal" /> Forfeits go to {charityName}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-5 sm:px-6 py-4 grid grid-cols-3 gap-3 border-b border-rule bg-paper/40">
        <Figure size="sm" label="Stake / day" value={formatAmount(pact.dailyStake, asset, 4)} sub={asset.symbol} />
        <Figure size="sm" label="Locked" value={formatAmount(pact.totalStaked, asset, 3)} sub={usdHint(pact.totalStaked, asset, usdPrice) ?? asset.symbol} />
        <Figure size="sm" label="Kept" tone="kept" value={`${pact.checkInCount}/${pact.totalDays}`} sub={active ? `day ${today} of ${pact.totalDays}` : "final"} />
      </div>

      <div className="px-5 sm:px-6 py-5 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pact.totalDays }).map((_, i) => {
            const s = ready ? dayState(pact, pact.days, i + 1, now) : pact.days[i] ? "done" : "future";
            return <DayStamp key={i} day={i + 1} kind={s} size={pact.totalDays > 30 ? 24 : 30} />;
          })}
        </div>
        {notStarted && (
          <p className="text-sm text-quill mt-4 font-semibold">Squad starts in {formatDuration(pact.startTime - now)}. Your first check-in opens then.</p>
        )}
      </div>

      <div className="px-5 sm:px-6 pb-5 space-y-3">
        {active && openDay !== null && (
          <div>
            <Button variant="ink" size="lg" className="w-full" onClick={() => onOpenCheckIn(pact, openDay)}>
              Present proof for day {openDay}
            </Button>
            <p className="text-xs text-center text-ink-3 mt-2">
              Check in within <span className="num text-ink-2">{formatDuration(dayWindow(pact, openDay).closesAt - now)}</span>, or day {openDay}&apos;s stake is forfeited.
            </p>
          </div>
        )}

        {active && openDay === null && settle === "locked" && !notStarted && (
          <div className="text-sm text-kept font-semibold border border-kept/40 bg-kept/5 rounded-md px-4 py-3">
            {pact.days[today - 1] ? `Day ${today} is stamped.` : "Waiting for the next day."}{" "}
            <span className="font-normal text-ink-2">
              Next window opens in {formatDuration(dayWindow(pact, Math.min(today + 1, pact.totalDays)).opensAt - now)}.
            </span>
          </div>
        )}

        {(settle === "complete" || settle === "expired") && (
          <Button variant={settle === "complete" ? "seal" : "outline"} size="lg" className="w-full" onClick={() => onSettle(pact)} disabled={settling}>
            {settling && <Loader2 className="w-4 h-4 animate-spin" />}
            {settle === "complete"
              ? isSquad
                ? "Settle: claim stake + squad bonus"
                : `Settle: claim ${formatAsset(pact.totalStaked + pact.estBonus, asset, 4)}`
              : `Settle: ${formatAsset(refund, asset, 4)} back, ${formatAsset(slashed, asset, 4)} forfeited`}
          </Button>
        )}
        {settle === "complete" && pact.estBonus > 0n && (
          <p className="text-xs text-center text-gold font-semibold">Includes +{formatAsset(pact.estBonus, asset, 4)} completion bonus from the pool</p>
        )}
        {active &&
          settle === "locked" &&
          ready &&
          (isSquad ? pact.checkInCount === pact.totalDays : openDay === null && now > dayWindow(pact, pact.totalDays).opensAt) && (
            <p className="text-xs text-center text-ink-3">
              {isSquad ? "Perfect run. The squad settles together after " : "Settles after "}
              {new Date(settleableAt(pact) * 1000).toLocaleString()}
            </p>
          )}

        <div className="flex items-end justify-between gap-4 pt-3">
          <div className="w-40">
            <Signature name={pact.qieId || shortAddress(pact.creator)} caption={`Signed · ${pact.qieId || shortAddress(pact.creator)}`} />
          </div>
          {active && settle === "locked" && (
            <a href={`/api/reminder/${pact.id}`} className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-quill">
              <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
            </a>
          )}
        </div>
      </div>

      {pact.status === PactStatus.COMPLETED && <BigStamp text="Kept" className="absolute right-6 bottom-7 text-3xl" />}
      {pact.status === PactStatus.FAILED && <BigStamp text="Broken" tone="seal" className="absolute right-6 bottom-7 text-3xl" />}
    </article>
  );
};
