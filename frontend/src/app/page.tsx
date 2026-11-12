"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { HeroStats } from "@/components/HeroStats";
import { PactCard } from "@/components/PactCard";
import { CheckInModal } from "@/components/CheckInModal";
import { CreatePactModal } from "@/components/CreatePactModal";
import { Leaderboard } from "@/components/Leaderboard";
import { SquadPacts } from "@/components/SquadPacts";
import { INITIAL_PACTS, MOCK_LEADERBOARD } from "@/lib/mockData";
import { Pact, PactStatus } from "@/lib/types";
import { Shield, Sparkles, Flame, Plus, CheckCircle2, Award } from "lucide-react";
import confetti from "canvas-confetti";

export default function Home() {
  const [userAddress, setUserAddress] = useState<string | null>(
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
  );
  const [qieId, setQieId] = useState<string>("alex.qie");
  const [hasQiePass, setHasQiePass] = useState<boolean>(true);

  const [pacts, setPacts] = useState<Pact[]>(INITIAL_PACTS);
  const [activeCheckInPact, setActiveCheckInPact] = useState<Pact | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"MY_PACTS" | "SQUADS" | "LEADERBOARD">("MY_PACTS");
  const [notification, setNotification] = useState<string | null>(null);

  // Compute stats
  const totalStakedSum = pacts
    .reduce((acc, p) => acc + Number(p.totalStaked), 1250)
    .toLocaleString();

  const handleConnect = () => {
    if (userAddress) {
      setUserAddress(null);
      setNotification("Wallet disconnected");
    } else {
      setUserAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
      setQieId("alex.qie");
      setHasQiePass(true);
      setNotification("Connected to QIE Mainnet via alex.qie");
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCheckInSuccess = (pactId: number, dayIndex: number) => {
    setPacts((prev) =>
      prev.map((p) => {
        if (p.id === pactId) {
          const newCheckInCount = p.checkInCount + 1;
          const updatedHistory = p.history.map((h) =>
            h.day === dayIndex ? { ...h, checkedIn: true, verifiedAt: Date.now() } : h
          );
          return {
            ...p,
            checkInCount: newCheckInCount,
            hasCheckedInToday: true,
            history: updatedHistory,
          };
        }
        return p;
      })
    );

    setNotification(`Day ${dayIndex} attestation verified & submitted on QIE Mainnet!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSettle = (pact: Pact) => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#F59E0B", "#10B981", "#06B6D4"],
    });

    const principal = Number(pact.totalStaked);
    const bonus = (principal * 0.15).toFixed(1);
    const totalPayout = (principal + Number(bonus)).toFixed(1);

    setPacts((prev) =>
      prev.map((p) =>
        p.id === pact.id ? { ...p, status: PactStatus.COMPLETED } : p
      )
    );

    setNotification(
      `🎉 Pact settled! 100% principal refunded (${principal} QIE) + ${bonus} QIE Slash Pool Yield! Total payout: ${totalPayout} QIE`
    );
    setTimeout(() => setNotification(null), 6000);
  };

  const handleCreateNewPact = (newPact: Pact) => {
    setPacts((prev) => [newPact, ...prev]);
    setActiveTab("MY_PACTS");
    setNotification(`Discipline Pact '${newPact.title}' locked on QIE Mainnet!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleJoinSquad = (squadName: string, dailyStake: string) => {
    setIsCreateOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0E111A] border border-emerald-500/40 text-emerald-300 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <Header
        userAddress={userAddress}
        qieId={qieId}
        hasQiePass={hasQiePass}
        onConnect={handleConnect}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {/* Hero Stats */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 w-full">
        <HeroStats
          totalStaked={totalStakedSum}
          activePactsCount={pacts.length + 182}
          rewardPool="3,420"
        />

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-white/5 mb-8 pb-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={() => setActiveTab("MY_PACTS")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === "MY_PACTS"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Active Pacts ({pacts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("SQUADS")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === "SQUADS"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Squad Challenges</span>
            </button>

            <button
              onClick={() => setActiveTab("LEADERBOARD")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === "LEADERBOARD"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Streak Board</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Pact</span>
          </button>
        </div>

        {/* Tab 1: My Active Pacts */}
        {activeTab === "MY_PACTS" && (
          <div>
            {pacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pacts.map((pact) => (
                  <PactCard
                    key={pact.id}
                    pact={pact}
                    onOpenCheckIn={(p) => setActiveCheckInPact(p)}
                    onSettle={handleSettle}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-[#0E111A] rounded-3xl border border-white/5">
                <Flame className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">No Active Pacts</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                  Stake QIE on your first habit to lock in discipline and earn from the slash pool.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs"
                >
                  Create First Pact
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Squad Pacts */}
        {activeTab === "SQUADS" && <SquadPacts onJoin={handleJoinSquad} />}

        {/* Tab 3: Leaderboard */}
        {activeTab === "LEADERBOARD" && <Leaderboard users={MOCK_LEADERBOARD} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 bg-[#07080C] text-xs text-gray-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-gray-300">Pactiq</span>
            <span>•</span>
            <span>Deployed on QIE Blockchain Mainnet (Chain ID 5656)</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Powered by QIE ID &amp; QIE Pass</span>
            <span>•</span>
            <span className="text-emerald-400">QIE Hackathon 3.0</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CheckInModal
        pact={activeCheckInPact}
        userAddress={userAddress}
        onClose={() => setActiveCheckInPact(null)}
        onSuccess={handleCheckInSuccess}
      />

      <CreatePactModal
        isOpen={isCreateOpen}
        userAddress={userAddress}
        userQieId={qieId}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreateNewPact}
      />
    </div>
  );
}
