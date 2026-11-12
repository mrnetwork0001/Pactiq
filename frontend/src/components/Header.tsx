"use client";

import React from "react";
import { Shield, Flame, CheckCircle, Wallet, Plus, Sparkles } from "lucide-react";

interface HeaderProps {
  userAddress: string | null;
  qieId: string;
  hasQiePass: boolean;
  onConnect: () => void;
  onOpenCreate: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userAddress,
  qieId,
  hasQiePass,
  onConnect,
  onOpenCreate,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#090A0F]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0E111A] rounded-[11px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold tracking-tight text-white">
                Pact<span className="text-emerald-400">iq</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Mainnet
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono hidden sm:block">
              Proof-of-Discipline Protocol
            </p>
          </div>
        </div>

        {/* Network & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* QIE Mainnet Pill */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono">QIE Chain: 5656</span>
          </div>

          {/* QIE Pass Verified Badge */}
          {userAddress && (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
              <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>{hasQiePass ? "QIE Pass Verified" : "Standard Tier"}</span>
            </div>
          )}

          {/* Create Pact Button */}
          <button
            onClick={onOpenCreate}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Pact</span>
          </button>

          {/* Wallet Button */}
          <button
            onClick={onConnect}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#151A27] hover:bg-[#1C2234] border border-white/10 text-white text-sm font-medium transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>
              {userAddress
                ? qieId || `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                : "Connect Wallet"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
