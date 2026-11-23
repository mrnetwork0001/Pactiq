"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wallet, AlertTriangle, BadgeCheck, LogOut, ExternalLink, UserRound } from "lucide-react";
import { activeChain, addChainParams, explorerAddress, QIE_WALLET_URL } from "@/lib/chain";
import { formatQie, shortAddress } from "@/lib/format";
import type { WalletState } from "@/hooks/useWallet";
import type { WalletOption } from "@/lib/wallet";
import { Burger, Button, Drawer, Kicker, Mark } from "./ui";

interface HeaderProps {
  wallet: WalletState;
  qieId?: string;
  /** Opens the "set your .qie name" sheet. Shown in the wallet menu while the wallet has no name. */
  onSetName?: () => void;
  onConnect: (option?: WalletOption) => void;
  onOpenCreate: () => void;
  /** Extra sections for the phone/tablet drawer; call `close` after any navigation. */
  menu?: (close: () => void) => React.ReactNode;
  /** The page has its own bottom bar on phones, so the menu button and drawer aren't needed. */
  bottomNav?: boolean;
}

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <span className="transition-transform group-hover:-rotate-12">
        <Mark size={size} />
      </span>
      <span className="font-display text-2xl sm:text-[1.7rem] font-bold tracking-tight leading-none">
        Pactiq
      </span>
    </Link>
  );
}

export const Header: React.FC<HeaderProps> = ({ wallet, qieId, onSetName, onConnect, onOpenCreate, menu, bottomNav = false }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  // The wallet dropdowns close on a click anywhere outside them, and on Escape.
  const walletBox = useRef<HTMLDivElement>(null);
  const dropdownOpen = menuOpen || pickerOpen;
  useEffect(() => {
    if (!dropdownOpen) return;
    const close = () => {
      setMenuOpen(false);
      setPickerOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!walletBox.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const handleWalletClick = () => {
    if (wallet.address) return setMenuOpen((o) => !o);
    if (wallet.wallets.length > 1) return setPickerOpen((o) => !o);
    onConnect();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-ink">
        <div className="max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Wordmark />

          <div className="flex items-center gap-2 sm:gap-3">

            <Button variant="seal" size="sm" onClick={onOpenCreate} className="sm:!px-4 sm:!text-sm">
              <span className="hidden sm:inline">Sign a pact</span>
              <span className="sm:hidden">New pact</span>
            </Button>

            <div ref={walletBox} className="relative hidden md:block">
              <Button variant="outline" size="sm" onClick={handleWalletClick} disabled={wallet.connecting} className="sm:!px-3.5 sm:!py-2 sm:!text-sm">
                <Wallet className="w-4 h-4" />
                <span className="max-w-28 truncate">
                  {wallet.connecting ? "Connecting…" : wallet.address ? qieId || shortAddress(wallet.address) : "Connect"}
                </span>
              </Button>

              {pickerOpen && !wallet.address && (
                <div className="absolute right-0 mt-2 w-60 sheet rounded-md p-1.5 z-50">
                  <div className="kicker px-2.5 pt-1.5 pb-2">Choose a wallet</div>
                  {wallet.wallets.map((w) => (
                    <button
                      key={w.rdns ?? w.name}
                      onClick={() => {
                        setPickerOpen(false);
                        onConnect(w);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-paper-2 text-sm cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {w.icon ? <img src={w.icon} alt="" className="w-5 h-5 rounded" /> : <Wallet className="w-4 h-4" />}
                      <span>{w.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {menuOpen && wallet.address && (
                <div className="absolute right-0 mt-2 w-64 sheet rounded-md p-4 z-50 space-y-3">
                  <div>
                    <div className="kicker">{wallet.walletName}</div>
                    {qieId && <div className="font-semibold mt-0.5 truncate">{qieId}</div>}
                    <div className="num text-sm mt-0.5">{shortAddress(wallet.address)}</div>
                    {wallet.balance !== null && <div className="num text-sm text-kept mt-0.5">{formatQie(wallet.balance, 4)} QIE</div>}
                  </div>
                  <div className="rule-dashed" />
                  {!qieId && onSetName && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onSetName();
                      }}
                      className="flex items-center gap-2 text-sm hover:text-quill cursor-pointer"
                    >
                      <BadgeCheck className="w-4 h-4" /> Show my .qie name
                    </button>
                  )}
                  <Link href={`/u/${wallet.address}`} className="flex items-center gap-2 text-sm hover:text-quill" onClick={() => setMenuOpen(false)}>
                    <UserRound className="w-4 h-4" /> Public profile
                  </Link>
                  <a href={explorerAddress(wallet.address)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-quill">
                    <ExternalLink className="w-4 h-4" /> View on QIE Explorer
                  </a>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      wallet.disconnect();
                    }}
                    className="flex items-center gap-2 text-sm text-seal cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              )}
            </div>

            {!bottomNav && <Burger open={drawer} onClick={() => setDrawer((d) => !d)} />}
          </div>
        </div>
        {wallet.discovered && wallet.wallets.length === 0 && (
          <div className="border-t border-rule bg-gold/10 text-ink-2 text-xs text-center py-2 px-4">
            No wallet detected.{" "}
            <a href={QIE_WALLET_URL} target="_blank" rel="noreferrer" className="underline font-semibold text-ink">
              Install QIE Wallet
            </a>{" "}
            to sign pacts and check in.
          </div>
        )}
      </header>

      {/* Wrong network: say so plainly, offer the switch, and give the details for adding it by hand. */}
      {wallet.wrongNetwork && (
        <div role="alert" className="border-b border-seal bg-seal/5 text-sm">
          <div className="max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AlertTriangle className="w-4 h-4 text-seal shrink-0" />
            <p className="flex-1 min-w-[14rem] text-seal-dark">
              <strong>Your wallet is on another network.</strong>{" "}
              {wallet.networkError ?? `Approve the switch to ${activeChain.name} in your wallet.`}
            </p>
            <Button variant="seal" size="sm" onClick={() => wallet.switchNetwork()}>
              Switch to {activeChain.name}
            </Button>
            <details className="w-full text-xs text-ink-2">
              <summary className="cursor-pointer font-semibold">Add it by hand</summary>
              <dl className="num mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 break-all">
                <dt className="text-ink-3">Network name</dt>
                <dd>{addChainParams.chainName}</dd>
                <dt className="text-ink-3">RPC URL</dt>
                <dd>{addChainParams.rpcUrls[0]}</dd>
                <dt className="text-ink-3">Chain ID</dt>
                <dd>{activeChain.id}</dd>
                <dt className="text-ink-3">Currency symbol</dt>
                <dd>{addChainParams.nativeCurrency.symbol}</dd>
                <dt className="text-ink-3">Block explorer</dt>
                <dd>{addChainParams.blockExplorerUrls[0]}</dd>
              </dl>
            </details>
          </div>
        </div>
      )}

      <Drawer open={drawer} onClose={closeDrawer} head={<Wordmark size={28} />}>
        <section className="mb-6">
          <Kicker className="mb-2">Wallet</Kicker>
          {wallet.address ? (
            <div className="border border-rule rounded-md bg-paper/50 p-4">
              <div className="kicker !text-[10px]">{wallet.walletName}</div>
              <div className="font-semibold mt-0.5 truncate">{qieId || shortAddress(wallet.address)}</div>
              <div className="num text-xs text-ink-3">{shortAddress(wallet.address)}</div>
              {wallet.balance !== null && <div className="num text-sm text-kept mt-1">{formatQie(wallet.balance, 4)} QIE</div>}
              <div className="mt-2">
                <Link href={`/u/${wallet.address}`} className="drawer-item" onClick={closeDrawer}>
                  <UserRound className="w-4 h-4" /> Public profile
                </Link>
                <a href={explorerAddress(wallet.address)} target="_blank" rel="noreferrer" className="drawer-item">
                  <ExternalLink className="w-4 h-4" /> View on QIE Explorer
                </a>
                <button
                  type="button"
                  className="drawer-item !text-seal !border-b-0"
                  onClick={() => {
                    closeDrawer();
                    wallet.disconnect();
                  }}
                >
                  <LogOut className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>
          ) : wallet.wallets.length > 1 ? (
            <div className="grid gap-2">
              {wallet.wallets.map((w) => (
                <Button
                  key={w.rdns ?? w.name}
                  variant="outline"
                  className="w-full !justify-start"
                  onClick={() => {
                    closeDrawer();
                    onConnect(w);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.icon ? <img src={w.icon} alt="" className="w-5 h-5 rounded" /> : <Wallet className="w-4 h-4" />}
                  Connect {w.name}
                </Button>
              ))}
            </div>
          ) : (
            <Button
              variant="seal"
              size="lg"
              className="w-full"
              disabled={wallet.connecting}
              onClick={() => {
                closeDrawer();
                onConnect();
              }}
            >
              <Wallet className="w-4 h-4" /> {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
        </section>
        {menu?.(closeDrawer)}
      </Drawer>
    </>
  );
};
