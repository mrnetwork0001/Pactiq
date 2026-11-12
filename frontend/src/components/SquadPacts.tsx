"use client";

import React from "react";
import { SQUAD_PACTS } from "@/lib/mockData";
import { Users, Coins, Clock, Sparkles, ArrowRight } from "lucide-react";

interface SquadPactsProps {
  onJoin: (squadName: string, dailyStake: string) => void;
}

export const SquadPacts: React.FC<SquadPactsProps> = ({ onJoin }) => {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Community Squad Challenges</span>
          </div>
          <h2 className="text-xl font-bold text-white">Join a Collective Habit Squad</h2>
        </div>
        <span className="text-xs text-gray-400 hidden sm:block">
          Compete alongside fellow QIE builders
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SQUAD_PACTS.map((squad) => (
          <div
            key={squad.id}
            className="p-5 rounded-2xl bg-[#0E111A] border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {squad.badge}
                </span>
                <span className="text-xs text-gray-400 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span>{squad.daysLeft}d remaining</span>
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                {squad.name}
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed line-clamp-2">
                {squad.description}
              </p>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#151A27]/60 border border-white/5 mb-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] uppercase text-gray-500 block font-sans">
                    Participants
                  </span>
                  <span className="text-white font-bold">{squad.participants} Humans</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-500 block font-sans">
                    Collective Pool
                  </span>
                  <span className="text-cyan-400 font-bold">{squad.poolSize}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onJoin(squad.name, squad.dailyStake)}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 border border-white/10 text-gray-200 font-semibold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Join Squad ({squad.dailyStake}/day)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
