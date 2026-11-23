"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { decodeEventLog, erc20Abi, zeroAddress, type Abi, type Address, type TransactionReceipt } from "viem";
import { Plus, CheckCircle2, AlertCircle, ExternalLink, Info, X, BellRing, UserRound, ArrowDownUp } from "lucide-react";
import confetti from "canvas-confetti";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button, Figure, Kicker, btn, CONFETTI } from "@/components/ui";
import { StatsLedger } from "@/components/HeroStats";
import { PactCard } from "@/components/PactCard";
import { CheckInModal } from "@/components/CheckInModal";
import { CreatePactModal, type CreatePactInput } from "@/components/CreatePactModal";
import { CreateSquadModal, type CreateSquadInput } from "@/components/CreateSquadModal";
import { SquadModal } from "@/components/SquadModal";
import { SquadsTab } from "@/components/SquadsTab";
import { Leaderboard } from "@/components/Leaderboard";
import { BadgeRow } from "@/components/Badges";
import { ShareButtons } from "@/components/ShareButtons";
import { useWallet } from "@/hooks/useWallet";
import { usePactiqData } from "@/hooks/usePactiqData";
import { useNow } from "@/hooks/useNow";
import { useReminders } from "@/hooks/useReminders";
import { GetQie } from "@/components/GetQie";
import { openCheckInDay } from "@/lib/pactTime";
import { SwapSheet } from "@/components/SwapSheet";
import { BottomNav, MoreView, TodayView, type MobileTab } from "@/components/MobileHome";
import { WalletPicker } from "@/components/WalletPicker";
import { NameSheet } from "@/components/NameSheet";
import { useQieName } from "@/hooks/useQie";
import { TxTracker, useTxTracker, type TrackControls } from "@/components/TxTracker";
import { activeChain, CONTRACT_ADDRESS, explorerTx, QIE_WALLET_URL } from "@/lib/chain";
import { describeError } from "@/lib/pactiq";
import { PACTIQ_ABI } from "@/lib/pactiqAbi";
import { sendPactiqTx, sendTx } from "@/lib/tx";
import { assetOf, formatAmounts, formatAsset, QIE_ASSET, QUSDC_ASSET } from "@/lib/assets";
import { swapCall, tokenAllowance } from "@/lib/qie";
import { profileUrl } from "@/lib/share";
import { BADGE_TIERS, PactStatus, type PactWithDays, type Squad } from "@/lib/types";
import type { WalletOption } from "@/lib/wallet";

type Tab = MobileTab;
type Toast = { kind: "success" | "error" | "info"; message: string; href?: string };

function eventsOf(receipt: TransactionReceipt) {
  const out: ReturnType<typeof decodeEventLog<typeof PACTIQ_ABI>>[] = [];
  for (const log of receipt.logs) {
    try {
      out.push(decodeEventLog({ abi: PACTIQ_ABI, data: log.data, topics: log.topics }));
    } catch {
      /* not a vault event */
    }
  }
  return out;
}

export default function App({ initialSquadId = null }: { initialSquadId?: number | null }) {
  const wallet = useWallet();
  const data = usePactiqData(wallet.address);
  const now = useNow(30_000);
  const reminders = useReminders(data.myPacts, now, wallet.address);

  const [tab, setTab] = useState<Tab>(initialSquadId ? "SQUADS" : "MY_PACTS");
  const [createOpen, setCreateOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [walletPicker, setWalletPicker] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const displayName = useQieName(wallet.address, data.profile?.qieId);
  const [squadCreate, setSquadCreate] = useState<{ sponsored: boolean } | null>(null);
  const [openSquadId, setOpenSquadId] = useState<number | null>(initialSquadId);
  const [checkInTarget, setCheckInTarget] = useState<{ pact: PactWithDays; day: number } | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const tracker = useTxTracker();

  // Deep links from the landing page: /app#new, /app#swap, /app#squads, /app#register, /app#pacts.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "squads") setTab("SQUADS");
      else if (hash === "register") setTab("LEADERBOARD");
      else if (hash === "pacts") setTab("MY_PACTS");
      else if (hash === "new" || hash === "swap") {
        if (hash === "new") setCreateOpen(true);
        else setSwapOpen(true);
        window.history.replaceState(null, "", "/app");
      }
    };
    const t = setTimeout(() => {
      // Phones open on the Today screen unless a link asked for a specific section.
      if (!window.location.hash && !initialSquadId && window.matchMedia("(max-width: 900px)").matches) setTab("TODAY");
      apply();
    }, 0);
    window.addEventListener("hashchange", apply);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", apply);
    };
  }, [initialSquadId]);

  const notify = useCallback((t: Toast, ms = 6000) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  }, []);

  const connect = useCallback(
    async (option?: WalletOption) => {
      try {
        await wallet.connect(option);
      } catch (e) {
        if (e instanceof Error && e.message === "NO_WALLET") {
          notify({ kind: "info", message: "No wallet found. Install QIE Wallet to continue.", href: QIE_WALLET_URL });
        } else {
          notify({ kind: "error", message: describeError(e) });
        }
      }
    },
    [wallet, notify]
  );

  /** Connect straight away when there is one wallet (or none); with several, let the user choose. */
  const chooseWallet = () => {
    if (wallet.wallets.length > 1) setWalletPicker(true);
    else connect();
  };
  const requireWallet = () => {
    if (!wallet.address) chooseWallet();
  };

  const announceBadges = (receipt: TransactionReceipt) => {
    for (const ev of eventsOf(receipt)) {
      if (ev.eventName === "BadgeEarned") {
        const tier = BADGE_TIERS[ev.args.tier];
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 }, colors: CONFETTI });
        notify({ kind: "success", message: `Sealed: a new soulbound badge, ${tier.name} (${tier.days}-day streak).`, href: explorerTx(receipt.transactionHash) }, 9000);
        return true;
      }
    }
    return false;
  };

  // --- writes ---

  /** The "approve" row of a tracked action that pays in a token. */
  const approveStep = (asset: Address, amount: bigint) => ({
    key: "approve",
    title: `Approve ${assetOf(asset).symbol}`,
    detail: `Lets Pactiq take exactly ${formatAsset(amount, assetOf(asset), 4)} for this, and nothing more.`,
  });
  /** Send the approval if the vault can't already take `amount`; otherwise remove the row. */
  const approveIfNeeded = async (c: TrackControls, token: Address, amount: bigint) => {
    if (!CONTRACT_ADDRESS || !wallet.address || amount === 0n) return c.drop("approve");
    if ((await tokenAllowance(token, wallet.address, CONTRACT_ADDRESS)) >= amount) return c.drop("approve");
    await sendTx(wallet, { address: token, abi: erc20Abi as Abi, functionName: "approve", args: [CONTRACT_ADDRESS, amount] }, c.step("approve"));
  };
  const WATCH = "Follow the steps in the progress window…";

  const createPact = async (input: CreatePactInput, onStatus: (s: string) => void) => {
    onStatus(WATCH);
    const token = input.mode !== "usd" && input.asset !== zeroAddress;
    const total = input.dailyStake * BigInt(input.totalDays);
    await tracker.run({
      kicker: "Signing your pact",
      title: input.title,
      steps: [
        ...(token ? [approveStep(input.asset, total)] : []),
        { key: "sign", title: "Sign the pact and lock your stake", detail: `${input.totalDays} days. Each day you keep is refunded.` },
      ],
      work: async (c) => {
        let receipt: TransactionReceipt;
        if (input.mode === "usd") {
          receipt = await sendPactiqTx(
            wallet,
            "createPactUsd",
            [input.title, input.category, input.usdPerDay, BigInt(input.totalDays), input.qieId, input.charity],
            { value: input.value, ...c.step("sign") }
          );
        } else {
          if (token) await approveIfNeeded(c, input.asset, total);
          receipt = await sendPactiqTx(
            wallet,
            "createPact",
            [input.title, input.category, input.asset, input.dailyStake, BigInt(input.totalDays), input.qieId, input.charity],
            { value: token ? 0n : input.value, ...c.step("sign") }
          );
        }
        const created = eventsOf(receipt).find((e) => e.eventName === "PactCreated");
        const pactId = created?.eventName === "PactCreated" ? created.args.pactId : undefined;
        setTab("MY_PACTS");
        await data.refresh();
        return { message: `Pact${pactId ? ` Nº ${pactId}` : ""} is live. Day 1 is open, so check in today.`, value: null };
      },
    });
  };

  const createSquad = async (input: CreateSquadInput, onStatus: (s: string) => void) => {
    onStatus(WATCH);
    const token = input.asset !== zeroAddress;
    // One approval covers the sponsorship and, if joining, the creator's own stake.
    const joinStake = input.joinMyself ? input.dailyStake * BigInt(input.totalDays) : 0n;
    const squadId = await tracker.run({
      kicker: input.sponsorship > 0n ? "Funding a challenge" : "Starting a squad",
      title: input.title,
      steps: [
        ...(token && input.sponsorship + joinStake > 0n ? [approveStep(input.asset, input.sponsorship + joinStake)] : []),
        { key: "create", title: "Create the squad", detail: input.sponsorship > 0n ? "Puts the prize pot into the squad." : "Opens the squad for people to join." },
        ...(input.joinMyself ? [{ key: "join", title: "Join it yourself", detail: "Locks your own stake as the first member." }] : []),
      ],
      work: async (c) => {
        if (token) await approveIfNeeded(c, input.asset, input.sponsorship + joinStake);
        const receipt = await sendPactiqTx(
          wallet,
          "createSquad",
          [input.title, input.category, input.asset, input.dailyStake, BigInt(input.totalDays), BigInt(input.startTime), BigInt(input.maxMembers), input.sponsor, input.sponsorship],
          { value: token ? 0n : input.sponsorship, ...c.step("create") }
        );
        const ev = eventsOf(receipt).find((e) => e.eventName === "SquadCreated");
        const id = ev?.eventName === "SquadCreated" ? Number(ev.args.squadId) : null;
        if (id && input.joinMyself) {
          await sendPactiqTx(wallet, "joinSquad", [BigInt(id), input.qieId], { value: token ? 0n : joinStake, ...c.step("join") });
        }
        await data.refresh();
        return { message: `Squad Nº ${id} is created. Share the invite link to fill it.`, value: id };
      },
    });
    setTab("SQUADS");
    if (squadId) setOpenSquadId(squadId);
  };

  const joinSquad = async (squad: Squad, qieId: string, onStatus: (s: string) => void) => {
    onStatus(WATCH);
    const stake = squad.dailyStake * BigInt(squad.totalDays);
    const token = squad.asset !== zeroAddress;
    await tracker.run({
      kicker: "Joining a squad",
      title: squad.title,
      steps: [...(token ? [approveStep(squad.asset, stake)] : []), { key: "join", title: "Sign the charter and lock your stake", detail: `${formatAsset(stake, assetOf(squad.asset), 4)} for ${squad.totalDays} days.` }],
      work: async (c) => {
        if (token) await approveIfNeeded(c, squad.asset, stake);
        await sendPactiqTx(wallet, "joinSquad", [BigInt(squad.id), qieId], { value: token ? 0n : stake, ...c.step("join") });
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 }, colors: CONFETTI });
        await data.refresh();
        return { message: `You're in. Day 1 starts ${new Date(squad.startTime * 1000).toLocaleString()}.`, value: null };
      },
    });
  };

  const sponsorSquad = async (squad: Squad, amount: bigint, onStatus: (s: string) => void) => {
    onStatus(WATCH);
    const token = squad.asset !== zeroAddress;
    await tracker.run({
      kicker: "Adding to the prize pot",
      title: squad.title,
      steps: [...(token ? [approveStep(squad.asset, amount)] : []), { key: "fund", title: "Add to the pot", detail: `${formatAsset(amount, assetOf(squad.asset), 4)}, shared between everyone who finishes.` }],
      work: async (c) => {
        if (token) await approveIfNeeded(c, squad.asset, amount);
        await sendPactiqTx(wallet, "sponsorSquad", [BigInt(squad.id), amount], { value: token ? 0n : amount, ...c.step("fund") });
        await data.refresh();
        return { message: `Added ${formatAsset(amount, assetOf(squad.asset), 4)} to the pot.`, value: null };
      },
    });
  };

  /** QIEDEX: swap QIE for at least `qusdcOut` QUSDC, straight into the connected wallet. */
  const swapForQusdc = async (qusdcOut: bigint, qieIn: bigint, onStatus: (s: string) => void) => {
    const user = wallet.address;
    if (!user) throw new Error("Connect your wallet first.");
    onStatus(WATCH);
    await tracker.run({
      kicker: "Topping up on QIEDEX",
      title: `Swap QIE for ${formatAsset(qusdcOut, QUSDC_ASSET)}`,
      steps: [{ key: "swap", title: "Swap QIE for QUSDC", detail: `Up to ${formatAsset(qieIn, QIE_ASSET, 4)}, at a 1% slippage limit.` }],
      work: async (c) => {
        const { call, value } = swapCall(true, qieIn, qusdcOut, user);
        const receipt = await sendTx(wallet, call, { value, ...c.step("swap") });
        let got = qusdcOut;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== QUSDC_ASSET.address.toLowerCase()) continue;
          try {
            const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
            if (ev.eventName === "Transfer" && ev.args.to.toLowerCase() === user.toLowerCase()) got = ev.args.value;
          } catch {
            /* not a transfer */
          }
        }
        return { message: `Swap complete. ${formatAsset(got, QUSDC_ASSET)} is in your wallet.`, value: null };
      },
    });
  };

  const finalizeSquad = async (squad: Squad) => {
    await tracker.run({
      kicker: "Closing the squad",
      title: squad.title,
      steps: [{ key: "finalize", title: "Work out who finished", detail: "Splits the pot between the members who kept every day." }],
      work: async (c) => {
        await sendPactiqTx(wallet, "finalizeSquad", [BigInt(squad.id)], c.step("finalize"));
        await data.refresh();
        return { message: "Squad closed. Members can now collect.", value: null };
      },
    });
  };

  const submitCheckIn = async (
    pact: PactWithDays,
    day: number,
    proofHash: `0x${string}`,
    signature: `0x${string}`,
    onSubmitted: (hash: string) => void
  ) => {
    try {
      const receipt = await sendPactiqTx(wallet, "checkIn", [BigInt(pact.id), BigInt(day), proofHash, signature], { onSubmitted });
      if (!announceBadges(receipt)) {
        notify({ kind: "success", message: `Day ${day} verified on-chain. Keep the streak going!`, href: explorerTx(receipt.transactionHash) });
      }
      data.refresh();
      return receipt.transactionHash;
    } catch (e) {
      throw new Error(describeError(e));
    }
  };

  const settle = async (pact: PactWithDays) => {
    setSettlingId(pact.id);
    try {
      await tracker.run({
        kicker: "Collecting",
        title: pact.title,
        steps: [{ key: "settle", title: "Settle the pact", detail: "Pays back every day you kept, plus any bonus." }],
        work: async (c) => {
          const receipt = await sendPactiqTx(wallet, "settlePact", [BigInt(pact.id)], c.step("settle"));
          let message = "Pact settled.";
          for (const ev of eventsOf(receipt)) {
            if (ev.eventName !== "PactSettled") continue;
            const { refundedPrincipal, bonusReward, slashedAmount, status } = ev.args;
            const a = assetOf(pact.asset);
            message =
              status === PactStatus.COMPLETED
                ? `Pact kept. You received ${formatAsset(refundedPrincipal + bonusReward, a, 4)}, including a ${formatAsset(bonusReward, a, 4)} bonus.`
                : `Pact settled. ${formatAsset(refundedPrincipal, a, 4)} came back and ${formatAsset(slashedAmount, a, 4)} was forfeited${pact.charity !== zeroAddress ? " and donated" : ""}.`;
            if (status === PactStatus.COMPLETED) confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors: CONFETTI });
          }
          await data.refresh();
          return { message, value: null };
        },
      });
    } catch {
      /* the progress window already shows what went wrong */
    } finally {
      setSettlingId(null);
    }
  };

  const activePacts = data.myPacts.filter((p) => p.status === PactStatus.ACTIVE);
  const pastPacts = data.myPacts.filter((p) => p.status !== PactStatus.ACTIVE);
  const usd = data.price?.usd;
  const squadTitles = new Map(data.squads.map((s) => [s.id, s.title]));
  const charityNames = new Map(data.charities.map((c) => [c.account.toLowerCase(), c.name]));

  const openCreate = () => {
    setCreateOpen(true);
    requireWallet();
  };
  const deskTab: Tab = tab === "TODAY" || tab === "MORE" ? "MY_PACTS" : tab;
  const goTo = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const dueToday = now > 0 ? activePacts.filter((p) => openCheckInDay(p, p.days, now) !== null).length : 0;
  const TABS: { id: Tab; n: string; label: string; count?: number }[] = [
    { id: "MY_PACTS", n: "I.", label: "My pacts", count: wallet.address ? activePacts.length : undefined },
    { id: "SQUADS", n: "II.", label: "Squads", count: data.squads.length || undefined },
    { id: "LEADERBOARD", n: "III.", label: "The register" },
  ];

  return (
    <div className="min-h-screen overflow-x-clip flex flex-col">
      {toast && (
        <div
          role="status"
          style={{ bottom: "calc(var(--toast-lift, 1.25rem) + env(safe-area-inset-bottom))" }}
          className={`max-md:[--toast-lift:5.5rem] fixed right-5 left-5 sm:left-auto sm:max-w-md z-[60] sheet rounded-md px-4 py-3 text-sm flex items-start gap-3 animate-rise border-l-4 ${
            toast.kind === "error" ? "border-l-seal" : toast.kind === "info" ? "border-l-quill" : "border-l-kept"
          }`}
        >
          {toast.kind === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-seal" />
          ) : toast.kind === "info" ? (
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-quill" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-kept" />
          )}
          <div className="flex-1">
            <span>{toast.message}</span>
            {toast.href && (
              <a href={toast.href} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-quill underline">
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button onClick={() => setToast(null)} className="text-ink-3 hover:text-ink cursor-pointer" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Header
        wallet={wallet}
        qieId={displayName ?? undefined}
        onSetName={() => setNameOpen(true)}
        onConnect={connect}
        onOpenCreate={openCreate}
        bottomNav
        menu={(close) => (
          <>
            <section className="mb-6">
              <Kicker className="mb-1">Go to</Kicker>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`drawer-item ${tab === t.id ? "!text-seal font-semibold" : ""}`}
                  onClick={() => {
                    setTab(t.id);
                    close();
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <span className="font-display italic text-seal w-8">{t.n}</span>
                  <span className="font-display text-lg">{t.label}</span>
                  {t.count !== undefined && <span className="num text-xs text-ink-3 ml-auto">{t.count}</span>}
                </button>
              ))}
              <Link href="/" className="drawer-item" onClick={close}>
                <span className="w-8" />
                <span className="font-display text-lg">Pactiq home</span>
              </Link>
            </section>
            <section>
              <Kicker className="mb-1">Do</Kicker>
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  close();
                  openCreate();
                }}
              >
                Draft a new pact
              </button>
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  close();
                  setSwapOpen(true);
                }}
              >
                Swap QIE and QUSDC
              </button>
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  close();
                  setSquadCreate({ sponsored: false });
                  requireWallet();
                }}
              >
                Charter a squad
              </button>
              <button
                type="button"
                className="drawer-item"
                onClick={() => {
                  close();
                  setSquadCreate({ sponsored: true });
                  requireWallet();
                }}
              >
                Fund a challenge
              </button>
              {wallet.address && now > 0 && reminders.permission !== "unsupported" && reminders.permission !== "granted" && (
                <button
                  type="button"
                  className="drawer-item"
                  onClick={() => {
                    close();
                    reminders.enable();
                  }}
                >
                  <BellRing className="w-4 h-4" /> Turn on check-in reminders
                </button>
              )}
            </section>
          </>
        )}
      />

      {!CONTRACT_ADDRESS && (
        <div className="border-b border-seal bg-seal/10 text-seal-dark text-xs text-center py-2 px-4">
          Contract not configured. Set <code className="num">NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS</code> (see README).
        </div>
      )}
      {data.error && (
        <div className="border-b border-rule bg-gold/10 text-ink-2 text-xs text-center py-2 px-4">
          Having trouble reaching {activeChain.name}: {data.error}
        </div>
      )}

      <main className="flex-1 max-w-[calc(50vw_+_600px)] mx-auto px-4 sm:px-6 pb-20 max-md:pb-28 w-full">
        <div className="pt-8 max-sm:hidden">
          <StatsLedger compact stats={data.stats} price={data.price} loading={data.loading} />
        </div>

        <nav
          id="desk"
          className="max-md:hidden mt-10 max-sm:mt-0 scroll-mt-20 grid grid-cols-3 md:flex items-end gap-1 sm:gap-2 border-b-2 border-ink max-md:sticky max-md:top-16 max-md:z-30 max-md:bg-paper/95 max-md:backdrop-blur-md max-md:-mx-4 max-md:px-4 sm:max-md:-mx-6 sm:max-md:px-6 max-md:pt-3"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-w-0 px-1 sm:px-5 pt-3 pb-2.5 rounded-t-md border-2 border-b-0 -mb-[2px] cursor-pointer whitespace-nowrap transition-colors max-md:text-center ${
                deskTab === t.id ? "bg-card border-ink" : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              <span className="font-display italic text-seal mr-1.5 max-sm:hidden">{t.n}</span>
              <span className="font-display text-base sm:text-lg md:text-xl font-semibold">{t.label}</span>
              {t.count !== undefined && <span className="num text-xs text-ink-3 ml-1.5">{t.count}</span>}
            </button>
          ))}
          <button onClick={() => setSwapOpen(true)} className="ml-auto hidden md:inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink hover:underline cursor-pointer pb-3 whitespace-nowrap">
            <ArrowDownUp className="w-4 h-4" /> Swap
          </button>
          <button onClick={openCreate} className="ml-6 hidden md:inline-flex items-center gap-1 text-sm font-semibold text-seal hover:underline cursor-pointer pb-3 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Draft a new pact
          </button>
        </nav>

        {tab === "TODAY" && (
          <TodayView
            wallet={wallet}
            name={displayName}
            now={now}
            loading={data.loading}
            pacts={activePacts}
            profile={data.profile}
            squads={data.squads}
            remindersOff={now > 0 && reminders.permission === "default"}
            onConnect={chooseWallet}
            onCreate={openCreate}
            onCheckIn={(pact, day) => setCheckInTarget({ pact, day })}
            onGo={goTo}
            onOpenSquad={(id) => setOpenSquadId(id)}
            onEnableReminders={reminders.enable}
          />
        )}
        {tab === "MORE" && (
          <MoreView
            wallet={wallet}
            name={displayName}
            profile={data.profile}
            remindersOff={now > 0 && reminders.permission === "default"}
            onConnect={chooseWallet}
            onCreate={openCreate}
            onSwap={() => setSwapOpen(true)}
            onSquad={() => {
              setSquadCreate({ sponsored: false });
              requireWallet();
            }}
            onEnableReminders={reminders.enable}
          />
        )}

        {/* Today and More are phone screens; on a wide window they fall back to the pacts tab. */}
        <div className={`pt-8 max-md:pt-6 ${tab === "TODAY" || tab === "MORE" ? "max-md:hidden" : ""}`}>
          {deskTab === "MY_PACTS" && (
            <div className="space-y-10">
              {/* A connected wallet that can't afford the smallest pact: show how to get QIE first. */}
              {wallet.address && wallet.balance !== null && activePacts.length === 0 && wallet.balance < (data.stats?.minStakePerDay ?? 10n ** 16n) * 3n && (
                <GetQie address={wallet.address} />
              )}
              {!wallet.address ? (
                <EmptyState
                  title="Your desk is empty."
                  body="Connect QIE Wallet to see your pacts, present today's proof and settle up."
                  cta="Connect wallet"
                  onClick={chooseWallet}
                />
              ) : activePacts.length === 0 && pastPacts.length === 0 ? (
                <EmptyState
                  title={data.loading ? "Fetching your pacts from the chain…" : "No pacts signed yet."}
                  body="Stake QIE on your first habit or join a squad with friends. Keep every day to get it all back plus a bonus."
                  cta="Draft your first pact"
                  onClick={() => setCreateOpen(true)}
                />
              ) : (
                <>
                  {data.profile && (
                    <div className="sheet rounded-md grid md:grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-5">
                      <div className="md:pr-6 md:border-r border-rule">
                        <Kicker>Proof-of-Human score</Kicker>
                        <div className="font-display text-6xl font-semibold leading-none mt-1">{data.profile.score}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <Figure label="Check-ins" value={String(data.profile.totalCheckIns)} tone="kept" />
                        <Figure label="Best streak" value={`${data.profile.bestStreak}d`} tone="seal" />
                        <Figure label="Bonus earned" value={formatAmounts(data.profile.rewardsEarned)} tone="gold" />
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-3">
                        <BadgeRow mask={data.profile.badges} showLocked size={46} />
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/u/${wallet.address}`} className={btn("outline", "sm")}>
                            <UserRound className="w-3.5 h-3.5" /> Profile
                          </Link>
                          {now > 0 && reminders.permission !== "unsupported" && reminders.permission !== "granted" && (
                            <Button variant="outline" size="sm" onClick={reminders.enable}>
                              <BellRing className="w-3.5 h-3.5" /> Reminders
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-3 border-t border-rule pt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-ink-2">Share your record. Every number on it is verified on-chain.</span>
                        <ShareButtons
                          compact
                          text={`My Proof-of-Human score on Pactiq is ${data.profile.score}. ${data.profile.bestStreak}-day best streak, AI-verified and staked on QIE.`}
                          url={profileUrl(wallet.address)}
                        />
                      </div>
                    </div>
                  )}

                  {activePacts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activePacts.map((p) => (
                        <PactCard
                          key={p.id}
                          pact={p}
                          now={now}
                          usdPrice={usd}
                          squadTitle={p.squadId ? squadTitles.get(p.squadId) : undefined}
                          charityName={charityNames.get(p.charity.toLowerCase())}
                          settling={settlingId === p.id}
                          onOpenCheckIn={(pact, day) => setCheckInTarget({ pact, day })}
                          onSettle={settle}
                          onOpenSquad={(id) => setOpenSquadId(id)}
                        />
                      ))}
                    </div>
                  )}
                  {pastPacts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <Kicker>The archive · {pastPacts.length} settled</Kicker>
                        <div className="flex-1 rule-dashed" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pastPacts.map((p) => (
                          <PactCard
                            key={p.id}
                            pact={p}
                            now={now}
                            usdPrice={usd}
                            squadTitle={p.squadId ? squadTitles.get(p.squadId) : undefined}
                            charityName={charityNames.get(p.charity.toLowerCase())}
                            settling={false}
                            onOpenCheckIn={() => {}}
                            onSettle={() => {}}
                            onOpenSquad={(id) => setOpenSquadId(id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {deskTab === "SQUADS" && (
            <SquadsTab
              squads={data.squads}
              now={now}
              usdPrice={usd}
              loading={data.loading}
              onOpen={(id) => setOpenSquadId(id)}
              onCreate={(sponsored) => {
                setSquadCreate({ sponsored });
                requireWallet();
              }}
            />
          )}

          {deskTab === "LEADERBOARD" && <Leaderboard entries={data.leaderboard} recent={data.recentPacts} me={wallet.address} loading={data.loading} />}
        </div>

      </main>

      <BottomNav tab={tab} due={dueToday} onChange={goTo} />

      <TxTracker tracked={tracker.tracked} onClose={tracker.close} />
      <NameSheet open={nameOpen} address={wallet.address} onClose={() => setNameOpen(false)} />

      <WalletPicker
        open={walletPicker && !wallet.address}
        wallets={wallet.wallets}
        onClose={() => setWalletPicker(false)}
        onPick={(w) => {
          setWalletPicker(false);
          connect(w);
        }}
      />

      <SwapSheet
        wallet={wallet}
        open={swapOpen}
        usdPrice={usd}
        onClose={() => setSwapOpen(false)}
        onConnect={() => connect()}
        onDone={(message, href) => notify({ kind: "success", message, href })}
      />

      <div className="max-md:hidden">
        <Footer />
      </div>

      <CheckInModal target={checkInTarget} userAddress={wallet.address} onClose={() => setCheckInTarget(null)} onSubmit={submitCheckIn} />

      <CreatePactModal
        isOpen={createOpen}
        address={wallet.address}
        balance={wallet.balance}
        qie={{ minStakePerDay: data.stats?.minStakePerDay ?? 10n ** 16n, rewardPool: data.stats?.rewardPool ?? 0n }}
        qusdc={data.stats?.qusdc ?? null}
        usdPrice={usd}
        charities={data.charities}
        defaultQieId={data.profile?.qieId ?? ""}
        onClose={() => setCreateOpen(false)}
        onSubmit={createPact}
        onSwap={swapForQusdc}
        onConnect={() => connect()}
      />

      <CreateSquadModal
        open={squadCreate}
        address={wallet.address}
        balance={wallet.balance}
        qieMinStake={data.stats?.minStakePerDay ?? 10n ** 16n}
        qusdc={data.stats?.qusdc ?? null}
        onSwap={swapForQusdc}
        usdPrice={usd}
        now={now}
        defaultQieId={data.profile?.qieId ?? ""}
        onClose={() => setSquadCreate(null)}
        onSubmit={createSquad}
        onConnect={() => connect()}
      />

      <SquadModal
        squadId={openSquadId}
        me={wallet.address}
        qieBalance={wallet.balance}
        onSwap={swapForQusdc}
        now={now}
        usdPrice={usd}
        defaultQieId={data.profile?.qieId ?? ""}
        onClose={() => {
          setOpenSquadId(null);
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/squad/")) {
            window.history.replaceState(null, "", "/app");
          }
        }}
        onJoin={joinSquad}
        onSponsor={sponsorSquad}
        onFinalize={finalizeSquad}
        onConnect={() => connect()}
      />
    </div>
  );
}

function EmptyState({ title, body, cta, onClick }: { title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <div className="text-center py-16 px-6 border-2 border-dashed border-rule rounded-md">
      <div className="font-display text-3xl font-semibold">{title}</div>
      <p className="text-sm text-ink-2 max-w-md mx-auto mt-2 mb-6">{body}</p>
      <Button variant="seal" onClick={onClick}>
        {cta}
      </Button>
    </div>
  );
}
