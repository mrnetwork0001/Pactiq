"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAddress, type Address } from "viem";
import { ArrowLeft, Loader2, ExternalLink, Users } from "lucide-react";
import { fetchUserPacts, fetchUserProfile } from "@/lib/pactiq";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAmounts, formatAsset } from "@/lib/assets";
import { profileUrl } from "@/lib/share";
import { BADGE_TIERS, CATEGORY_LABELS, PactStatus, type PactWithDays, type UserProfile } from "@/lib/types";
import { ShareButtons } from "@/components/ShareButtons";
import { Wordmark } from "@/components/Header";
import { Figure, Kicker, Mark, Seal } from "@/components/ui";

export default function ProfileView() {
  const { address } = useParams<{ address: string }>();
  const valid = isAddress(address);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pacts, setPacts] = useState<PactWithDays[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    Promise.all([fetchUserProfile(address as Address), fetchUserPacts(address as Address)])
      .then(([p, list]) => {
        if (cancelled) return;
        setProfile(p);
        setPacts(list);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message.split("\n")[0] : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [address, valid]);

  const name = profile?.qieId || (valid ? shortAddress(address) : "");

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink bg-paper/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Wordmark />
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
            <ArrowLeft className="w-4 h-4" /> Back to the app
          </Link>
        </div>
      </header>

      <main className="max-w-[calc(50vw_+_472px)] mx-auto px-4 sm:px-6 py-10 space-y-12">
        {!valid && <p className="text-seal">That isn&apos;t a valid wallet address.</p>}
        {error && <p className="text-seal">{error}</p>}
        {valid && !profile && !error && (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
          </div>
        )}

        {profile && (
          <>
            <div className="sheet rounded-md p-2 animate-rise">
              <div className="border-[3px] border-double border-ink rounded-sm px-6 sm:px-12 py-10 text-center relative">
                <Kicker>Certificate of discipline · issued on-chain</Kicker>
                <div className="font-sign text-quill text-6xl sm:text-7xl leading-none mt-6 break-words">{name}</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="num text-xs text-ink-3 hover:text-quill inline-flex items-center gap-1 break-all">
                    {address} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                <div className="mt-8">
                  <div className="font-display text-8xl sm:text-9xl font-semibold leading-none tracking-tight">{profile.score}</div>
                  <div className="font-display italic text-xl text-ink-2 mt-2">Proof-of-Human score</div>
                </div>

                <div className="mt-10 border-y border-ink grid grid-cols-2 sm:grid-cols-4 text-left">
                  {[
                    <Figure key="c" label="Verified check-ins" value={String(profile.totalCheckIns)} tone="kept" />,
                    <Figure key="s" label="Best streak" value={`${profile.bestStreak} days`} tone="seal" />,
                    <Figure key="k" label="Pacts kept" value={String(profile.completedPacts)} />,
                    <Figure key="b" label="Bonus earned" value={formatAmounts(profile.rewardsEarned)} tone="gold" />,
                  ].map((f, i) => (
                    <div key={i} className={`p-4 ${i > 0 ? "sm:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} border-rule`}>
                      {f}
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex flex-wrap items-end justify-center gap-8 sm:gap-12">
                  {BADGE_TIERS.map((t, i) => {
                    const earned = (profile.badges & t.bit) !== 0;
                    return (
                      <div key={t.bit} className={`flex flex-col items-center ${earned ? "" : "opacity-60"}`}>
                        <Seal tier={i} earned={earned} size={84} />
                        <div className="font-display font-semibold mt-2">{t.name}</div>
                        <div className="kicker !text-[10px]">{earned ? "Soulbound · earned" : `Locked · ${t.days}-day streak`}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-10 flex items-end justify-between gap-4 text-left">
                  <div className="kicker !text-[10px]">
                    {profile.firstActivity > 0 ? `On the register since ${new Date(profile.firstActivity * 1000).toLocaleDateString()}` : "New to the register"}
                  </div>
                  <span className="rotate-12 opacity-90">
                    <Mark size={56} />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-display text-xl">Share this certificate</span>
              <ShareButtons
                compact
                text={`${name} has a Proof-of-Human score of ${profile.score} on Pactiq. ${profile.bestStreak}-day best streak, staked on QIE.`}
                url={profileUrl(address)}
              />
            </div>

            <section>
              <div className="flex items-baseline gap-3 border-b border-ink pb-2 mb-2">
                <h2 className="font-display text-3xl font-semibold">Pacts on file</h2>
                <span className="num text-sm text-ink-3">{pacts.length}</span>
              </div>
              {pacts.length === 0 ? (
                <p className="text-sm text-ink-3 py-6">No pacts yet.</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {pacts.map((p) => (
                    <li key={p.id} className="py-4 grid grid-cols-[1fr_auto] gap-4 items-center">
                      <div className="min-w-0">
                        <div className="font-display text-xl leading-snug truncate">{p.title}</div>
                        <div className="num text-[11px] text-ink-3 mt-1 flex flex-wrap items-center gap-x-2">
                          <span>Nº {String(p.id).padStart(4, "0")}</span>·<span>{CATEGORY_LABELS[p.category]}</span>·<span>{formatAsset(p.totalStaked, assetOf(p.asset))}</span>
                          {p.squadId > 0 && (
                            <span className="inline-flex items-center gap-1 text-quill">
                              <Users className="w-3 h-3" /> squad
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.days.map((d, i) => (
                            <span key={i} className={`w-2 h-2 rounded-full ${d ? "bg-kept" : "border border-rule"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-sm">
                          {p.checkInCount}/{p.totalDays}
                        </div>
                        <div
                          className={`kicker !text-[10px] ${
                            p.status === PactStatus.COMPLETED ? "!text-kept" : p.status === PactStatus.FAILED ? "!text-seal" : "!text-quill"
                          }`}
                        >
                          {p.status === PactStatus.COMPLETED ? "Kept" : p.status === PactStatus.FAILED ? "Broken" : "Active"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
