"use client";

import React from "react";
import { Lock, Zap, Users, Trophy, Sparkles } from "lucide-react";

interface HeroStatsProps {
  totalStaked: string;
  activePactsCount: number;
  rewardPool: string;
}

export const HeroStats: React.FC<HeroStatsProps> = ({
  totalStaked,
  activePactsCount,
  rewardPool,
}) => {
  return (
    <div className="relative pt-6 pb-10">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Headline */}
      <div className="text-center max-w-3xl mx-auto mb-10 px-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Built for QIE Mainnet Hackathon 3.0</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Proof-of-Discipline. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            No Bots. Daily Habits.
          </span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
          Stake QIE on your daily commitments. Verify completion with multimodal AI vision.
          Keep 100% of your stake + earn bonus yield from defaulters.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Card 1: Total Staked */}
        <div className="p-5 rounded-2xl bg-[#0E111A]/80 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Total Value Staked</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {totalStaked} <span className="text-sm font-sans text-emerald-400 font-normal">QIE</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Live on Chain 5656</div>
        </div>

        {/* Card 2: Active Pacts */}
        <div className="p-5 rounded-2xl bg-[#0E111A]/80 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Active Daily Pacts</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {activePactsCount} <span className="text-sm font-sans text-cyan-400 font-normal">Habits</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">96.4% Human Check-In Rate</div>
        </div>

        {/* Card 3: Slashed Reward Pool */}
        <div className="p-5 rounded-2xl bg-[#0E111A]/80 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Slash Yield Pool</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono">
            {rewardPool} <span className="text-sm font-sans text-gray-400 font-normal">QIE</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Earned by 100% Completers</div>
        </div>

        {/* Card 4: Verification Method */}
        <div className="p-5 rounded-2xl bg-[#0E111A]/80 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Anti-Bot Engine</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            AI + ECDSA
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">Dynamic Gestures & Vision</div>
        </div>
      </div>
    </div>
  );
};
