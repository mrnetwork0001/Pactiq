"use client";

import React from "react";
import { ChevronRight, ExternalLink, Wallet } from "lucide-react";
import { QIE_WALLET_URL } from "@/lib/chain";
import { QIE_WALLET_RDNS, type WalletOption } from "@/lib/wallet";
import { Sheet } from "./ui";

/**
 * One place to choose a wallet, however many are installed: QIE Wallet first and marked as the
 * recommended choice, the rest in a scrolling list with their own icons.
 */
export function WalletPicker({ open, wallets, onPick, onClose }: { open: boolean; wallets: WalletOption[]; onPick: (w: WalletOption) => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <Sheet kicker="Connect" title="Choose your wallet" subtitle="Pactiq never sees your keys. Your wallet asks you before anything is signed." onClose={onClose}>
      {wallets.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-ink-2">No wallet was found in this browser.</p>
          <a href={QIE_WALLET_URL} target="_blank" rel="noreferrer" className="pill pill-solid mt-4">
            Get QIE Wallet <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <div className="list max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain">
          {wallets.map((w) => (
            <button key={w.rdns ?? w.name} type="button" className="list-row !min-h-[60px]" onClick={() => onPick(w)}>
              <span className="w-10 h-10 shrink-0 rounded-lg border border-rule bg-paper grid place-items-center overflow-hidden">
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the wallet's own icon, supplied as a data URL
                  <img src={w.icon} alt="" className="w-7 h-7 object-contain" />
                ) : (
                  <Wallet className="w-5 h-5 text-seal" />
                )}
              </span>
              <span className="min-w-0 flex-1 font-semibold truncate">{w.name}</span>
              {w.rdns === QIE_WALLET_RDNS && <span className="kicker !text-[10px] !text-kept border border-kept rounded-full px-2 py-0.5 shrink-0">Recommended</span>}
              <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
      {wallets.length > 0 && (
        <p className="text-xs text-ink-3 text-center mt-4">
          New to this?{" "}
          <a href={QIE_WALLET_URL} target="_blank" rel="noreferrer" className="underline">
            Set up QIE Wallet
          </a>
        </p>
      )}
    </Sheet>
  );
}
