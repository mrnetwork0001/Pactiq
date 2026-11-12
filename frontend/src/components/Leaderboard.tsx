"use client";

import React from "react";
import { LeaderboardUser } from "@/lib/types";
import { Trophy, Flame, CheckCircle, ShieldCheck } from "lucide-react";

interface LeaderboardProps {
  users: LeaderboardUser[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ users }) => {
  return (
    <div className="p-6 rounded-3xl bg-[#0E111A] border border-white/5 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Top Disciplined Guardians</span>
          </div>
          <h2 className="text-xl font-bold text-white">QIE Mainnet Streak Leaderboard</h2>
        </div>
        <p className="text-xs text-gray-400 hidden sm:block max-w-xs text-right">
          Ranked by daily consistency & yield earned from defaulters&apos; slash pool.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              <th className="pb-3 pl-2">Rank</th>
              <th className="pb-3">User (QIE ID)</th>
              <th className="pb-3">Current Streak</th>
              <th className="pb-3 hidden sm:table-cell">Completed Pacts</th>
              <th className="pb-3 text-right pr-2">Slash Yield Won</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {users.map((u) => {
              const isTop3 = u.rank <= 3;
              return (
                <tr
                  key={u.rank}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="py-3.5 pl-2 font-mono font-bold">
                    {u.rank === 1 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                        🥇
                      </span>
                    )}
                    {u.rank === 2 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 text-xs">
                        🥈
                      </span>
                    )}
                    {u.rank === 3 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 text-xs">
                        🥉
                      </span>
                    )}
                    {u.rank > 3 && <span className="text-gray-400 ml-1.5">#{u.rank}</span>}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white group-hover:text-emerald-400 transition-colors font-mono">
                        {u.qieId}
                      </span>
                      {u.hasQiePass && (
                        <span
                          title="QIE Pass Verified"
                          className="flex items-center text-cyan-400"
                        >
                          <ShieldCheck className="w-4 h-4 fill-cyan-500/20" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {u.address}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
                      <Flame className="w-3.5 h-3.5 fill-orange-400" />
                      <span>{u.currentStreak} Days</span>
                    </div>
                  </td>
                  <td className="py-3.5 hidden sm:table-cell text-gray-300 font-mono">
                    {u.totalCompleted} Pacts
                  </td>
                  <td className="py-3.5 text-right pr-2">
                    <span className="text-amber-400 font-bold font-mono">
                      +{u.totalRewardsEarned}
                    </span>{" "}
                    <span className="text-xs text-gray-400">QIE</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
