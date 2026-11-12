"use client";

import React from "react";
import { Pact, Category, PactStatus } from "@/lib/types";
import { Flame, CheckCircle2, Clock, Code, Dumbbell, BookOpen, Heart, Award, ArrowRight } from "lucide-react";

interface PactCardProps {
  pact: Pact;
  onOpenCheckIn: (pact: Pact) => void;
  onSettle: (pact: Pact) => void;
}

export const PactCard: React.FC<PactCardProps> = ({
  pact,
  onOpenCheckIn,
  onSettle,
}) => {
  const getCategoryIcon = (category: Category) => {
    switch (category) {
      case Category.CODING:
        return <Code className="w-4 h-4 text-cyan-400" />;
      case Category.FITNESS:
        return <Dumbbell className="w-4 h-4 text-emerald-400" />;
      case Category.LEARNING:
        return <BookOpen className="w-4 h-4 text-amber-400" />;
      case Category.MEDITATION:
        return <Heart className="w-4 h-4 text-purple-400" />;
      default:
        return <Award className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCategoryBadgeClass = (category: Category) => {
    switch (category) {
      case Category.CODING:
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case Category.FITNESS:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case Category.LEARNING:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case Category.MEDITATION:
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  const isCompleted = pact.checkInCount === pact.totalDays;
  const progressPercent = Math.round((pact.checkInCount / pact.totalDays) * 100);

  return (
    <div className="p-6 rounded-2xl bg-[#0E111A] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group">
      {/* Top row: Category & Streak */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getCategoryBadgeClass(
              pact.category
            )}`}
          >
            {getCategoryIcon(pact.category)}
            <span>{pact.category}</span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-orange-400" />
            <span>{pact.checkInCount}-Day Streak</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
          {pact.title}
        </h3>
        <p className="text-xs text-gray-400 mb-4 font-mono">
          Ident: <span className="text-gray-300">{pact.qieId}</span>
        </p>

        {/* Staking specs */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#151A27]/60 border border-white/5 mb-4">
          <div>
            <span className="text-[10px] uppercase text-gray-400 font-semibold block">
              Daily Stake
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {pact.dailyStake} QIE
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-gray-400 font-semibold block">
              Total Locked
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {pact.totalStaked} QIE
            </span>
          </div>
        </div>

        {/* Progress Bar & Day Tracker */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
            <span className="text-gray-400">
              Progress: Day {pact.currentDay} of {pact.totalDays}
            </span>
            <span className="text-emerald-400 font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Day Matrix Dots */}
          <div className="flex items-center justify-between mt-3 px-1">
            {Array.from({ length: pact.totalDays }).map((_, index) => {
              const dayNum = index + 1;
              const isChecked = dayNum <= pact.checkInCount;
              const isToday = dayNum === pact.currentDay;

              return (
                <div
                  key={dayNum}
                  title={`Day ${dayNum}: ${isChecked ? "Verified" : isToday ? "Today" : "Pending"}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isChecked
                      ? "bg-emerald-400 ring-2 ring-emerald-500/20"
                      : isToday && !pact.hasCheckedInToday
                      ? "bg-amber-400 animate-ping"
                      : "bg-white/10"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pt-2 border-t border-white/5">
        {isCompleted ? (
          <button
            onClick={() => onSettle(pact)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-98"
          >
            <Award className="w-4 h-4 stroke-[2.5]" />
            <span>Settle Pact & Claim 15% Yield Bonus</span>
          </button>
        ) : pact.hasCheckedInToday ? (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-sm flex items-center justify-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Day {pact.currentDay} Verified Today</span>
          </div>
        ) : (
          <button
            onClick={() => onOpenCheckIn(pact)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-98"
          >
            <Clock className="w-4 h-4 stroke-[2.5]" />
            <span>Check-In for Day {pact.currentDay}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
