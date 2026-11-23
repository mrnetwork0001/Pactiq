"use client";

import React from "react";
import { CATEGORY_LABELS, type Squad } from "@/lib/types";
import { assetOf, formatAmount, formatAsset, usdHint } from "@/lib/assets";
import { formatDuration, squadEndsAt, squadJoinable, squadPhase } from "@/lib/pactTime";
import { Article, Button, Figure, Kicker } from "./ui";

interface SquadsTabProps {
  squads: Squad[];
  now: number;
  usdPrice?: number;
  loading: boolean;
  onOpen: (id: number) => void;
  onCreate: (sponsored: boolean) => void;
}

export const SquadsTab: React.FC<SquadsTabProps> = ({ squads, now, usdPrice, loading, onOpen, onCreate }) => {
  const sponsored = squads.filter((s) => s.sponsor);
  const friends = squads.filter((s) => !s.sponsor);

  return (
    <div className="space-y-14">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.02]">
            Commit together. <span className="italic font-normal">Quitters pay the finishers.</span>
          </h2>
          <p className="text-ink-2 mt-3 max-w-2xl leading-relaxed">
            Everyone in a squad starts the same day with the same stake. Missed days from any member, plus any sponsor money,
            are split equally between everyone who keeps every day.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ink" onClick={() => onCreate(false)}>
            Charter a squad
          </Button>
          <Button variant="outline" onClick={() => onCreate(true)}>
            Fund a challenge
          </Button>
        </div>
      </div>

      <section>
        <Article n="A." title="Sponsored challenges">
          <Kicker>Prize pots funded by projects and DAOs</Kicker>
        </Article>
        {sponsored.length === 0 ? (
          <Empty text={loading ? "Loading…" : "No sponsored challenges yet. Brands and DAOs can fund one for their community."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sponsored.map((s) => (
              <Bounty key={s.id} squad={s} now={now} usdPrice={usdPrice} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>

      <section>
        <Article n="B." title="Open squads">
          <Kicker>Invite-link groups</Kicker>
        </Article>
        {friends.length === 0 ? (
          <Empty text={loading ? "Loading…" : "No squads yet. Charter one and send the invite link to your friends."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {friends.map((s) => (
              <Charter key={s.id} squad={s} now={now} usdPrice={usdPrice} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ink-3 py-8 border-2 border-dashed border-rule rounded-md text-center">{text}</p>;
}

export function phaseLabel(s: Squad, now: number) {
  if (!now) return "";
  const phase = squadPhase(s, now);
  switch (phase) {
    case "upcoming":
      return `Starts in ${formatDuration(s.startTime - now)}`;
    case "open":
      return "Started · last call to join";
    case "running":
      return `Ends in ${formatDuration(squadEndsAt(s) - now)}`;
    case "ended":
      return "Ended · ready to settle";
    case "finalized":
      return `Finished · ${s.finisherCount} finisher${s.finisherCount === 1 ? "" : "s"}`;
  }
}

type CardProps = { squad: Squad; now: number; usdPrice?: number; onOpen: (id: number) => void };

/** Sponsored challenge, set like a printed bounty notice. */
export function Bounty({ squad: s, now, usdPrice, onOpen }: CardProps) {
  const joinable = now > 0 && squadJoinable(s, now);
  const pot = s.finalized ? s.bonusPerFinisher : s.sponsorPool;
  const asset = assetOf(s.asset);
  return (
    <button onClick={() => onOpen(s.id)} className="group text-left sheet rounded-md overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-transform">
      <div className="bg-ink text-card px-5 py-2 flex items-center justify-between gap-3">
        <span className="kicker !text-card/80">Sponsored by {s.sponsor}</span>
        <span className="kicker !text-gold">{phaseLabel(s, now)}</span>
      </div>
      <div className="p-5 sm:p-6 grid grid-cols-[1fr_auto] gap-5 items-start">
        <div className="min-w-0">
          <Kicker>
            Squad Nº {s.id} · {CATEGORY_LABELS[s.category]} · {s.totalDays} days
          </Kicker>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold leading-tight mt-2 break-words">{s.title}</h3>
        </div>
        <div className="text-right">
          <Kicker className="!text-gold">{s.finalized ? "Bonus each" : "Prize pot"}</Kicker>
          <div className="font-display text-4xl sm:text-5xl font-semibold text-gold leading-none mt-1">{formatAmount(pot, asset)}</div>
          <div className="num text-xs text-ink-3 mt-1">
            {asset.symbol} {usdHint(pot, asset, usdPrice) ? `· ${usdHint(pot, asset, usdPrice)}` : ""}
          </div>
        </div>
      </div>
      <div className="px-5 sm:px-6 pb-5 flex items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-6">
          <Figure size="sm" label="Members" value={`${s.memberCount}/${s.maxMembers}`} />
          <Figure size="sm" label="Stake / day" value={formatAsset(s.dailyStake, asset)} />
        </div>
        <span className="text-sm font-semibold text-seal inline-flex items-center gap-1 group-hover:underline">
          {joinable ? "Take a seat" : "Read the charter"}
        </span>
      </div>
    </button>
  );
}

/** Friends' squad. */
function Charter({ squad: s, now, usdPrice, onOpen }: CardProps) {
  const joinable = now > 0 && squadJoinable(s, now);
  const pot = s.finalized ? s.bonusPerFinisher : s.sponsorPool;
  const asset = assetOf(s.asset);
  return (
    <button onClick={() => onOpen(s.id)} className="group text-left sheet rounded-md p-5 flex flex-col cursor-pointer hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center justify-between gap-2">
        <Kicker>Squad Nº {s.id}</Kicker>
        <Kicker className="!text-quill">{phaseLabel(s, now)}</Kicker>
      </div>
      <h3 className="font-display text-2xl font-semibold leading-tight mt-2 break-words flex-1">{s.title}</h3>
      <div className="text-xs text-ink-2 mt-1">
        {CATEGORY_LABELS[s.category]} · {s.totalDays} days
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-rule mt-4 pt-3">
        <Figure size="sm" label="Members" value={`${s.memberCount}/${s.maxMembers}`} />
        <Figure size="sm" label="Per day" value={formatAmount(s.dailyStake, asset)} sub={asset.symbol} />
        <Figure
          size="sm"
          tone="gold"
          label={s.finalized ? "Bonus" : "Pot"}
          value={pot > 0n ? formatAmount(pot, asset) : "—"}
          sub={pot > 0n ? (usdHint(pot, asset, usdPrice) ?? asset.symbol) : "stakes only"}
        />
      </div>
      <span className="mt-4 text-sm font-semibold text-seal inline-flex items-center gap-1 group-hover:underline">
        {joinable ? "Take a seat" : "Read the charter"}
      </span>
    </button>
  );
}
