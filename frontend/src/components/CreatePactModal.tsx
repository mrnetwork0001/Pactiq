"use client";

import React, { useState } from "react";
import { Category, Pact, PactStatus } from "@/lib/types";
import { X, Code, Dumbbell, BookOpen, Heart, Award, Shield, Sparkles, Loader2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

interface CreatePactModalProps {
  isOpen: boolean;
  userAddress: string | null;
  userQieId: string;
  onClose: () => void;
  onCreated: (newPact: Pact) => void;
}

export const CreatePactModal: React.FC<CreatePactModalProps> = ({
  isOpen,
  userAddress,
  userQieId,
  onClose,
  onCreated,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(Category.CODING);
  const [totalDays, setTotalDays] = useState<number>(14);
  const [dailyStake, setDailyStake] = useState<number>(5);
  const [qieId, setQieId] = useState(userQieId || "builder.qie");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalRequiredStake = (dailyStake * totalDays).toFixed(1);
  const estimatedBonusYield = (Number(totalRequiredStake) * 0.15).toFixed(1);
  const estimatedReturn = (Number(totalRequiredStake) + Number(estimatedBonusYield)).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please enter a title for your commitment.");
      return;
    }
    if (!userAddress) {
      setErrorMessage("Please connect your Web3 wallet first.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Simulate on-chain contract call: createPact{value: requiredStake}(...)
      await new Promise((r) => setTimeout(r, 1400));

      const newPact: Pact = {
        id: Date.now(),
        creator: userAddress,
        title: title.trim(),
        category,
        dailyStake: dailyStake.toFixed(1),
        totalDays,
        checkInCount: 0,
        currentDay: 1,
        totalStaked: totalRequiredStake,
        status: PactStatus.ACTIVE,
        qieId: qieId || "user.qie",
        startTime: Date.now(),
        hasCheckedInToday: false,
        history: Array.from({ length: totalDays }).map((_, i) => ({
          day: i + 1,
          checkedIn: false,
        })),
      };

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10B981", "#06B6D4"],
      });

      onCreated(newPact);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating pact");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0E111A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="mb-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Commitment Vault</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Initiate a Discipline Pact</h2>
          <p className="text-sm text-gray-400 mt-1">
            Stake QIE on your daily habit. Settle on QIE Mainnet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Habit Title */}
          <div>
            <label className="block text-xs uppercase font-semibold text-gray-300 mb-2">
              Habit / Goal Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1-Hour Code Shipping & Commits"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#151A27] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs uppercase font-semibold text-gray-300 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { cat: Category.CODING, label: "Coding", icon: Code },
                { cat: Category.FITNESS, label: "Fitness", icon: Dumbbell },
                { cat: Category.LEARNING, label: "Learning", icon: BookOpen },
                { cat: Category.MEDITATION, label: "Mindfulness", icon: Heart },
                { cat: Category.CUSTOM, label: "Custom", icon: Award },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = category === item.cat;
                return (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => setCategory(item.cat)}
                    className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-[#151A27] border-white/5 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs uppercase font-semibold text-gray-300 mb-2">
              Pact Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[7, 14, 21, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTotalDays(days)}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    totalDays === days
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-[#151A27] border-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Daily Stake Amount */}
          <div>
            <label className="block text-xs uppercase font-semibold text-gray-300 mb-2">
              Daily Stake (QIE / Day)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 5, 10, 25].map((stake) => (
                <button
                  key={stake}
                  type="button"
                  onClick={() => setDailyStake(stake)}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    dailyStake === stake
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-[#151A27] border-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {stake} QIE
                </button>
              ))}
            </div>
          </div>

          {/* QIE ID input */}
          <div>
            <label className="block text-xs uppercase font-semibold text-gray-300 mb-2">
              Your QIE ID Handle
            </label>
            <input
              type="text"
              placeholder="e.g. satoshi.qie"
              value={qieId}
              onChange={(e) => setQieId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#151A27] border border-white/10 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>

          {/* Staking Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#151A27] to-[#0A0D14] border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Total Upfront Stake:</span>
              <span className="text-white font-bold font-mono">{totalRequiredStake} QIE</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Principal Return (100% Completion):</span>
              <span className="text-emerald-400 font-bold font-mono">100% Refundable</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Est. Slash Pool Yield Bonus:</span>
              <span className="text-amber-400 font-bold font-mono">+{estimatedBonusYield} QIE (+15%)</span>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm font-bold">
              <span className="text-white">Est. Payout on Day {totalDays}:</span>
              <span className="text-emerald-400 font-mono text-base">{estimatedReturn} QIE</span>
            </div>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Locking Stake on QIE Mainnet...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 stroke-[2.5]" />
                <span>Lock {totalRequiredStake} QIE & Launch Pact</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
