"use client";

import React, { useEffect, useState } from "react";
import type { Address } from "viem";
import { Loader2, Flag } from "lucide-react";
import { CATEGORY_LABELS, PactStatus, type OnchainPact, type Squad } from "@/lib/types";
import { fetchSquad, fetchSquadMembers } from "@/lib/pactiq";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAmount, formatAsset, parseAmount, QUSDC_ASSET, usdHint } from "@/lib/assets";
import { useQieId, useQiedex, useTokenBalance } from "@/hooks/useQie";
import { QieIdField } from "./QieIdField";
import { QiedexSwap } from "./QiedexSwap";
import { squadJoinable, squadPhase } from "@/lib/pactTime";
import { squadUrl } from "@/lib/share";
import { ShareButtons } from "./ShareButtons";
import { phaseLabel } from "./SquadsTab";
import { Button, Figure, Kicker, Notice, Sheet } from "./ui";

interface Props {
  squadId: number | null;
  me: Address | null;
  qieBalance: bigint | null;
  now: number;
  usdPrice?: number;
  defaultQieId: string;
  onClose: () => void;
  onJoin: (squad: Squad, qieId: string, onStatus: (s: string) => void) => Promise<void>;
  onSponsor: (squad: Squad, amount: bigint, onStatus: (s: string) => void) => Promise<void>;
  onSwap: (qusdcOut: bigint, qieIn: bigint, onStatus: (s: string) => void) => Promise<void>;
  onFinalize: (squad: Squad) => Promise<void>;
  onConnect: () => void;
}

export const SquadModal: React.FC<Props> = (props) => {
  if (props.squadId === null) return null;
  return <Detail key={props.squadId} {...props} squadId={props.squadId} />;
};

function Detail({
  squadId,
  me,
  qieBalance,
  now,
  usdPrice,
  defaultQieId,
  onClose,
  onJoin,
  onSponsor,
  onSwap,
  onFinalize,
  onConnect,
}: Props & { squadId: number }) {
  const [squad, setSquad] = useState<Squad | null | undefined>(undefined);
  const [members, setMembers] = useState<OnchainPact[]>([]);
  const [nonce, setNonce] = useState(0);
  const qieId = useQieId(me, defaultQieId);
  const [sponsorAmount, setSponsorAmount] = useState("10");
  const [busy, setBusy] = useState<{ action: "join" | "sponsor" | "finalize"; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSquad(squadId), fetchSquadMembers(squadId)])
      .then(([s, m]) => {
        if (cancelled) return;
        setSquad(s);
        setMembers(m);
      })
      .catch(() => !cancelled && setSquad(null));
    return () => {
      cancelled = true;
    };
  }, [squadId, nonce]);

  const run = async (action: "join" | "sponsor" | "finalize", fn: (onStatus: (s: string) => void) => Promise<void>) => {
    setBusy({ action, status: "Confirm in your wallet…" });
    setError(null);
    try {
      await fn((status) => setBusy({ action, status }));
      setNonce((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setBusy(null);
    }
  };

  const isMember = !!me && members.some((m) => m.creator.toLowerCase() === me.toLowerCase());
  const phase = squad && now ? squadPhase(squad, now) : null;
  const joinable = !!squad && now > 0 && squadJoinable(squad, now) && !isMember;
  const stake = squad ? squad.dailyStake * BigInt(squad.totalDays) : 0n;
  const asset = assetOf(squad?.asset);
  const qiedex = useQiedex();
  const qusdcBalance = useTokenBalance(squad && !asset.native ? QUSDC_ASSET.address : null, me);
  const qusdcShort = !asset.native && qusdcBalance.balance !== null && stake > qusdcBalance.balance ? stake - qusdcBalance.balance : 0n;
  const finishersSoFar = members.filter((m) => m.checkInCount === m.totalDays || m.status === PactStatus.COMPLETED).length;

  return (
    <Sheet
      wide
      kicker={squad?.sponsor ? `Sponsored by ${squad.sponsor} · Squad Nº ${squadId}` : `Squad charter · Nº ${squadId}`}
      title={squad ? squad.title : squad === null ? `Squad Nº ${squadId}` : "Opening the charter…"}
      subtitle={
        squad
          ? `${phaseLabel(squad, now)} · ${CATEGORY_LABELS[squad.category]} · ${squad.totalDays} days · day 1 ${new Date(squad.startTime * 1000).toLocaleString()}`
          : undefined
      }
      onClose={onClose}
      locked={!!busy}
    >
      {squad === undefined && (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
        </div>
      )}
      {squad === null && <p className="py-12 text-center text-ink-2">This squad doesn&apos;t exist.</p>}

      {squad && (
        <div className="space-y-7">
          <div className="border-y-2 border-ink grid grid-cols-3 divide-x divide-rule">
            <div className="p-4">
              <Figure label="Seats taken" value={`${squad.memberCount}/${squad.maxMembers}`} />
            </div>
            <div className="p-4">
              <Figure label="Each stakes" value={formatAmount(stake, asset, 2)} sub={usdHint(stake, asset, usdPrice) ?? asset.symbol} />
            </div>
            <div className="p-4">
              {squad.finalized ? (
                <Figure label="Bonus per finisher" tone="gold" value={formatAmount(squad.bonusPerFinisher, asset, 3)} sub={asset.symbol} />
              ) : (
                <Figure
                  label="Sponsor pot"
                  tone="gold"
                  value={formatAmount(squad.sponsorPool, asset, 2)}
                  sub={usdHint(squad.sponsorPool, asset, usdPrice) ?? asset.symbol}
                />
              )}
            </div>
          </div>

          <p className="font-display text-lg leading-relaxed">
            Every member stakes <strong>{formatAsset(squad.dailyStake, asset, 4)}</strong> a day. Missed days, less a 5% fee, plus the sponsor
            pot are split equally between the members who check in <em>every</em> day. Everyone settles together after the last day.
          </p>

          {members.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Kicker>Signatories · {members.length}</Kicker>
                <div className="flex-1 rule-dashed" />
                {phase === "running" && <span className="num text-[11px] text-ink-3">{finishersSoFar} on a perfect run</span>}
              </div>
              <ul className="divide-y divide-rule border-y border-rule">
                {members.map((m) => {
                  const mine = !!me && m.creator.toLowerCase() === me.toLowerCase();
                  return (
                    <li key={m.id} className="py-3 grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                      <span className="min-w-0">
                        <span className="font-sign text-quill text-2xl leading-none block truncate">{m.qieId || shortAddress(m.creator)}</span>
                        {mine && <span className="kicker !text-seal !text-[10px]">You</span>}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {Array.from({ length: m.totalDays }).map((_, i) => (
                          <span
                            key={i}
                            className={`w-2.5 h-2.5 rounded-full ${i < m.checkInCount ? "bg-kept" : "border border-rule"}`}
                            title={`${m.checkInCount}/${m.totalDays} verified`}
                          />
                        ))}
                      </span>
                      <span className="num text-xs text-ink-2 text-right w-14">
                        {m.checkInCount}/{m.totalDays}
                        {m.status === PactStatus.COMPLETED && <span className="block kicker !text-kept !text-[10px]">Kept</span>}
                        {m.status === PactStatus.FAILED && <span className="block kicker !text-seal !text-[10px]">Broken</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && <Notice>{error}</Notice>}

          {joinable && (
            <div className="space-y-3">
              {me && <QieIdField id={qieId} compact />}
              {me && qusdcShort > 0n && qiedex && (
                <QiedexSwap
                  shortfall={qusdcShort}
                  qieBalance={qieBalance}
                  onSwap={async (out, qieIn, onStatus) => {
                    await onSwap(out, qieIn, onStatus);
                    await qusdcBalance.refresh();
                  }}
                />
              )}
              <Button
                variant="seal"
                size="lg"
                className="w-full"
                disabled={!!busy || (!!me && (qieId.blocking || qusdcShort > 0n))}
                onClick={() => (me ? run("join", (s) => onJoin(squad, qieId.submitName, s)) : onConnect())}
              >
                {busy?.action === "join" && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy?.action === "join"
                  ? busy.status
                  : me
                    ? `Sign the charter · stake ${formatAsset(stake, asset, 4)}`
                    : "Connect wallet to join"}
              </Button>
            </div>
          )}
          {isMember && !squad.finalized && (
            <Notice tone="kept">You&apos;ve signed. Check in every day from &ldquo;My pacts&rdquo;.</Notice>
          )}

          {phase === "ended" && (
            <Button variant="ink" size="lg" className="w-full" disabled={!!busy} onClick={() => (me ? run("finalize", () => onFinalize(squad)) : onConnect())}>
              {busy?.action === "finalize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              Close the squad &amp; lock in the split
            </Button>
          )}

          {(phase === "upcoming" || phase === "open" || phase === "running") && (
            <div className="border border-gold/50 bg-gold/5 rounded-md p-4">
              <Kicker className="!text-gold mb-2">Add to the prize pot</Kicker>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sponsorAmount}
                  onChange={(e) => setSponsorAmount(e.target.value)}
                  className="field num flex-1"
                  aria-label={`Amount of ${asset.symbol} to add`}
                />
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    const amount = parseAmount(sponsorAmount || "0", asset);
                    if (amount <= 0n) return setError("Enter an amount.");
                    if (!me) return onConnect();
                    run("sponsor", (s) => onSponsor(squad, amount, s));
                  }}
                >
                  {busy?.action === "sponsor" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {busy?.action === "sponsor" ? busy.status : `Add ${asset.symbol}`}
                </Button>
              </div>
            </div>
          )}

          <div>
            <Kicker className="mb-2">Invite link</Kicker>
            <ShareButtons
              text={`Join my Pactiq squad "${squad.title}": ${squad.totalDays} days, ${formatAsset(squad.dailyStake, asset)} a day. Quitters pay the finishers.`}
              url={squadUrl(squad.id)}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
