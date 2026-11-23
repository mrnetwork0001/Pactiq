"use client";

import React from "react";
import Link from "next/link";
import { BadgeRow } from "./Badges";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAsset, QIE_ASSET, QUSDC_ASSET } from "@/lib/assets";
import { CATEGORY_LABELS, PactStatus, type LeaderboardEntry, type OnchainPact } from "@/lib/types";
import { Kicker } from "./ui";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  recent: OnchainPact[];
  me: string | null;
  loading: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, recent, me, loading }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-10">
      <div className="min-w-0">
        <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
          The register <span className="italic font-normal text-ink-2">of verified humans</span>
        </h2>
        <p className="text-ink-2 mt-2 max-w-2xl">
          Ranked by on-chain Proof-of-Human score: verified check-ins, kept pacts and streaks. Bots can&apos;t fake a
          staked, witnessed photo every day.
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-ink-3 py-12 mt-6 text-center border-2 border-dashed border-rule rounded-md">
            {loading ? "Reading the register from the chain…" : "The register is empty. Sign a pact and take the first line."}
          </p>
        ) : (
          <div className="overflow-x-auto mt-6 border-t-2 border-ink">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink">
                  {[["Nº"], ["Signatory"], ["Score"], ["Best streak", "Streak"], ["Days kept"], ["Pacts kept"], ["Bonus won", "Bonus"]].map(([h, short], i) => (
                    <th
                      key={h}
                      className={`kicker !text-[10px] py-2.5 font-normal whitespace-nowrap ${i === 0 ? "pl-1 pr-3 w-10" : ""} ${i >= 2 && i <= 5 ? "pr-3 sm:pr-5" : ""} ${i >= 4 && i <= 5 ? "hidden sm:table-cell" : ""} ${i === 6 ? "text-right pr-1" : ""}`}
                    >
                      {short ? (
                        <>
                          <span className="sm:hidden">{short}</span>
                          <span className="max-sm:hidden">{h}</span>
                        </>
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {entries.map((u, i) => {
                  const isMe = !!me && u.address.toLowerCase() === me.toLowerCase();
                  return (
                    <tr key={u.address} className={`hover:bg-card ${isMe ? "bg-seal/5" : ""}`}>
                      <td className="py-4 pl-1 pr-3 align-middle">
                        <span className={`font-display text-2xl ${i < 3 ? "text-seal font-semibold" : "text-ink-3"}`}>{i + 1}</span>
                      </td>
                      <td className="py-4 pr-3 sm:pr-4 max-w-0 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href={`/u/${u.address}`} className="font-semibold hover:text-quill hover:underline truncate">
                            {u.qieId || shortAddress(u.address)}
                          </Link>
                          {isMe && <span className="kicker !text-seal !text-[10px]">You</span>}
                          <BadgeRow mask={u.badges} size={22} />
                        </div>
                        {u.qieId && (
                          <a href={explorerAddress(u.address)} target="_blank" rel="noreferrer" className="num text-[11px] text-ink-3 hover:text-quill">
                            {shortAddress(u.address)}
                          </a>
                        )}
                      </td>
                      <td className="py-4 pr-3 sm:pr-5 num text-lg font-semibold">{u.score}</td>
                      <td className="py-4 pr-3 sm:pr-5 num whitespace-nowrap">
                        <span className="text-seal">{u.bestStreak}d</span>
                        {u.streak > 0 && <span className="block kicker !text-[10px]">live {u.streak}d</span>}
                      </td>
                      <td className="py-4 pr-3 sm:pr-5 num hidden sm:table-cell text-ink-2">{u.checkIns}</td>
                      <td className="py-4 pr-3 sm:pr-5 num hidden sm:table-cell text-ink-2">{u.completed}</td>
                      <td className="py-4 text-right pr-1 num text-gold font-semibold">
                        {u.rewardsEarned.qie > 0n || u.rewardsEarned.qusdc > 0n ? (
                          <>
                            {u.rewardsEarned.qie > 0n && <span className="block">+{formatAsset(u.rewardsEarned.qie, QIE_ASSET, 3)}</span>}
                            {u.rewardsEarned.qusdc > 0n && <span className="block">+{formatAsset(u.rewardsEarned.qusdc, QUSDC_ASSET)}</span>}
                          </>
                        ) : (
                          "+0"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="lg:border-l lg:border-rule lg:pl-8">
        <Kicker className="border-b border-ink pb-2 mb-4">Latest filings</Kicker>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-3">{loading ? "Loading…" : "Nothing filed yet."}</p>
        ) : (
          <ul className="space-y-4">
            {recent.slice(0, 8).map((p) => (
              <li key={p.id} className="border-b border-dashed border-rule pb-4 last:border-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-display text-lg leading-snug">{p.title}</span>
                  <span
                    className={`kicker !text-[10px] shrink-0 ${
                      p.status === PactStatus.ACTIVE ? "!text-quill" : p.status === PactStatus.COMPLETED ? "!text-kept" : "!text-seal"
                    }`}
                  >
                    {p.status === PactStatus.ACTIVE ? "Active" : p.status === PactStatus.COMPLETED ? "Kept" : "Broken"}
                  </span>
                </div>
                <div className="num text-[11px] text-ink-3 mt-1">
                  {p.qieId || shortAddress(p.creator)} · {CATEGORY_LABELS[p.category]} · {formatAsset(p.totalStaked, assetOf(p.asset))} · {p.checkInCount}/{p.totalDays}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
};
