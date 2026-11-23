"use client";

import React from "react";
import Link from "next/link";
import type { Address } from "viem";
import {
  ArrowDownUp,
  BellRing,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { activeChain, CONTRACT_ADDRESS, QIE_BUY_URL, explorerAddress } from "@/lib/chain";
import { assetOf, formatAsset } from "@/lib/assets";
import { shortAddress } from "@/lib/format";
import { dayWindow, formatDuration, openCheckInDay, settleState, squadJoinable } from "@/lib/pactTime";
import type { PactWithDays, Squad, UserProfile } from "@/lib/types";
import type { WalletState } from "@/hooks/useWallet";
import { BadgeRow } from "./Badges";
import { Mark } from "./ui";

/*
 * Phone layout for /app (≤ 900px): a "Today" home that leads with the one thing to do, a "More"
 * page of plain rows, and a bottom bar in place of the menu. Desktop keeps its tabs.
 */

export type MobileTab = "TODAY" | "MY_PACTS" | "SQUADS" | "LEADERBOARD" | "MORE";

const NAV: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: "TODAY", label: "Today", icon: Home },
  { id: "MY_PACTS", label: "Pacts", icon: ScrollText },
  { id: "SQUADS", label: "Squads", icon: Users },
  { id: "LEADERBOARD", label: "Ranks", icon: Trophy },
  { id: "MORE", label: "More", icon: Menu },
];

export function BottomNav({ tab, due, onChange }: { tab: MobileTab; due: number; onChange: (t: MobileTab) => void }) {
  return (
    <nav aria-label="Sections" className="bottom-nav md:hidden">
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-current={active ? "page" : undefined} className={`bottom-nav-item ${active ? "active" : ""}`}>
            <span className="relative">
              <Icon className="w-6 h-6" strokeWidth={active ? 2.2 : 1.7} />
              {id === "TODAY" && due > 0 && <span className="bottom-nav-badge num">{due}</span>}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function greeting(now: number) {
  if (!now) return "Hello";
  const h = new Date(now * 1000).getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** One line of the day's list: a habit and where today's check-in stands. */
function HabitRow({ pact, now, onCheckIn, onOpen }: { pact: PactWithDays; now: number; onCheckIn: (p: PactWithDays, day: number) => void; onOpen: () => void }) {
  const day = now ? openCheckInDay(pact, pact.days, now) : null;
  const settle = now ? settleState(pact, now) : "locked";
  const kept = pact.days.filter(Boolean).length;
  const ready = settle === "complete" || settle === "expired";
  return (
    <button type="button" className="list-row" onClick={() => (day !== null ? onCheckIn(pact, day) : onOpen())}>
      <span className={`list-row-icon ${day !== null ? "!border-seal !text-seal" : ready ? "!border-gold !text-gold" : "!border-kept !text-kept"}`}>
        {day !== null ? <Camera className="w-5 h-5" /> : ready ? <Trophy className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold leading-snug truncate">{pact.title}</span>
        <span className="block text-sm text-ink-2">
          {day !== null
            ? `Day ${day} of ${pact.totalDays} · closes in ${formatDuration(dayWindow(pact, day).closesAt - now)}`
            : ready
              ? "Finished. Collect what you kept."
              : `${kept} of ${pact.totalDays} days kept · nothing due right now`}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
    </button>
  );
}

export function TodayView({
  wallet,
  name,
  now,
  loading,
  pacts,
  profile,
  squads,
  remindersOff,
  onConnect,
  onCreate,
  onCheckIn,
  onGo,
  onOpenSquad,
  onEnableReminders,
}: {
  wallet: WalletState;
  name: string | null;
  now: number;
  loading: boolean;
  pacts: PactWithDays[];
  profile: UserProfile | null;
  squads: Squad[];
  remindersOff: boolean;
  onConnect: () => void;
  onCreate: () => void;
  onCheckIn: (p: PactWithDays, day: number) => void;
  onGo: (t: MobileTab) => void;
  onOpenSquad: (id: number) => void;
  onEnableReminders: () => void;
}) {
  const due = now ? pacts.flatMap((p) => { const d = openCheckInDay(p, p.days, now); return d === null ? [] : [{ pact: p, day: d, left: dayWindow(p, d).closesAt - now }]; }).sort((a, b) => a.left - b.left) : [];
  const toCollect = now ? pacts.filter((p) => ["complete", "expired"].includes(settleState(p, now))) : [];
  const next = due[0];
  const challenge = now ? squads.find((s) => s.sponsor && squadJoinable(s, now)) : undefined;
  const date = now ? new Date(now * 1000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <div className="md:hidden space-y-6 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="kicker h-4">{date}</div>
          <h1 className="font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight mt-1">{greeting(now)}{name ? "," : "!"}</h1>
          {name && <div className="font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight italic truncate">{name}</div>}
          <p className="text-ink-2 mt-2">
            {!wallet.address
              ? "Promises to yourself, kept one day at a time."
              : due.length > 0
                ? `${due.length} check-in${due.length > 1 ? "s" : ""} to do today.`
                : pacts.length > 0
                  ? "You're up to date. Nothing due right now."
                  : "No habit on the line yet."}
          </p>
        </div>
        <span className="shrink-0 w-14 h-14 rounded-full border-2 border-rule bg-card grid place-items-center">
          <Mark size={30} />
        </span>
      </header>

      {/* The one thing to do next. */}
      {!wallet.address ? (
        <ActionCard title="Start with your wallet" body="Connect it to see today's check-ins and sign your first pact." primary={{ label: "Connect wallet", onClick: onConnect }} />
      ) : next ? (
        <ActionCard
          title={`Today's proof: ${next.pact.title}`}
          body={`Day ${next.day} of ${next.pact.totalDays}. Take a photo with today's code before it closes in ${formatDuration(next.left)}.`}
          primary={{ label: "Present proof", onClick: () => onCheckIn(next.pact, next.day), icon: Camera }}
          secondary={due.length > 1 ? { label: `See all ${due.length}`, onClick: () => onGo("MY_PACTS") } : undefined}
        />
      ) : toCollect.length > 0 ? (
        <ActionCard title="You have money to collect" body={`"${toCollect[0].title}" has finished. Collect the days you kept${toCollect[0].checkInCount === toCollect[0].totalDays ? ", plus your bonus" : ""}.`} primary={{ label: "Collect it", onClick: () => onGo("MY_PACTS") }} />
      ) : pacts.length === 0 && !loading ? (
        <ActionCard title="Make your first pact" body="Pick a habit and put a little money on it. Keep every day and you get it all back, plus a bonus." primary={{ label: "Choose a habit", onClick: onCreate, icon: Plus }} />
      ) : pacts.length > 0 ? (
        <ActionCard tone="kept" title="All done for today" body="Every check-in is in. Come back tomorrow for the next one." secondary={{ label: "Add another habit", onClick: onCreate }} />
      ) : null}

      {wallet.address && pacts.length > 0 && (
        <section>
          <SectionTitle title="Your habits" action={{ label: "Open all", onClick: () => onGo("MY_PACTS") }} />
          <div className="list">
            {pacts.slice(0, 4).map((p) => (
              <HabitRow key={p.id} pact={p} now={now} onCheckIn={onCheckIn} onOpen={() => onGo("MY_PACTS")} />
            ))}
          </div>
        </section>
      )}

      {wallet.address && profile && (profile.totalCheckIns > 0 || profile.score > 0) && (
        <section className="sheet rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="kicker">Your record</div>
              <div className="font-display text-5xl font-semibold leading-none mt-1">{profile.score}</div>
              <div className="text-sm text-ink-2 mt-1">
                {profile.totalCheckIns} days kept · best run {profile.bestStreak} days
              </div>
            </div>
            <BadgeRow mask={profile.badges} showLocked size={40} />
          </div>
        </section>
      )}

      {remindersOff && wallet.address && pacts.length > 0 && (
        <button type="button" className="list-row list-row-solo" onClick={onEnableReminders}>
          <span className="list-row-icon">
            <BellRing className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Turn on reminders</span>
            <span className="block text-sm text-ink-2">A nudge before a check-in closes, so you never lose a day by forgetting.</span>
          </span>
          <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
        </button>
      )}

      {challenge && (
        <button type="button" onClick={() => onOpenSquad(challenge.id)} className="w-full text-left rounded-xl overflow-hidden border border-rule bg-card cursor-pointer">
          <span className="block bg-ink text-card px-5 py-4">
            <span className="kicker !text-card/70">Sponsored challenge</span>
            <span className="block font-display text-4xl font-semibold text-[#e0b54a] leading-none mt-2">{formatAsset(challenge.sponsorPool, assetOf(challenge.asset))}</span>
            <span className="block text-sm text-card/70 mt-1">shared between everyone who finishes</span>
          </span>
          <span className="flex items-center gap-3 px-5 py-4">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-semibold leading-snug">{challenge.title}</span>
              <span className="block text-sm text-ink-2">
                {challenge.totalDays} days · {challenge.memberCount} joined · by {challenge.sponsor}
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
          </span>
        </button>
      )}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="text-sm font-semibold text-seal cursor-pointer">
          {action.label}
        </button>
      )}
    </div>
  );
}

function ActionCard({
  title,
  body,
  primary,
  secondary,
  tone = "seal",
}: {
  title: string;
  body: string;
  primary?: { label: string; onClick: () => void; icon?: React.ElementType };
  secondary?: { label: string; onClick: () => void };
  tone?: "seal" | "kept";
}) {
  const Icon = primary?.icon;
  return (
    <section className={`rounded-2xl border p-5 ${tone === "kept" ? "border-kept/40 bg-kept/10" : "border-seal/30 bg-seal/10"}`}>
      <h2 className="font-display text-2xl font-semibold leading-snug">{title}</h2>
      <p className="text-ink-2 mt-1.5 leading-relaxed">{body}</p>
      {(primary || secondary) && (
        <div className="flex flex-wrap gap-3 mt-4">
          {secondary && (
            <button type="button" onClick={secondary.onClick} className="pill pill-outline">
              {secondary.label}
            </button>
          )}
          {primary && (
            <button type="button" onClick={primary.onClick} className="pill pill-solid">
              {Icon && <Icon className="w-4 h-4" />} {primary.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ More */

function Row({ icon: Icon, title, body, onClick, href, external }: { icon: React.ElementType; title: string; body: string; onClick?: () => void; href?: string; external?: boolean }) {
  const inner = (
    <>
      <span className="list-row-icon">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold text-seal-dark leading-snug">{title}</span>
        <span className="block text-sm text-ink-2">{body}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
    </>
  );
  if (href && external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className="list-row">
        {inner}
      </a>
    );
  if (href)
    return (
      <Link href={href} className="list-row">
        {inner}
      </Link>
    );
  return (
    <button type="button" className="list-row" onClick={onClick}>
      {inner}
    </button>
  );
}

export function MoreView({
  wallet,
  name,
  profile,
  remindersOff,
  onConnect,
  onCreate,
  onSwap,
  onSquad,
  onEnableReminders,
}: {
  wallet: WalletState;
  name: string | null;
  profile: UserProfile | null;
  remindersOff: boolean;
  onConnect: () => void;
  onCreate: () => void;
  onSwap: () => void;
  onSquad: () => void;
  onEnableReminders: () => void;
}) {
  const address: Address | null = wallet.address;
  return (
    <div className="md:hidden space-y-6 pt-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">More</h1>

      {address ? (
        <Link href={`/u/${address}`} className="list-row list-row-solo">
          <span className="w-14 h-14 shrink-0 rounded-full border-2 border-rule bg-paper grid place-items-center">
            <Mark size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-2xl font-semibold leading-tight truncate">{name || shortAddress(address)}</span>
            <span className="block text-sm text-ink-2">{profile ? `Score ${profile.score} · ${profile.totalCheckIns} days kept` : "See your public record"}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" />
        </Link>
      ) : (
        <div className="list">
          <Row icon={Wallet} title="Connect wallet" body="See your pacts and check in" onClick={onConnect} />
        </div>
      )}

      <div className="list">
        <Row icon={Plus} title="Sign a new pact" body="Pick a habit and what you'll put on it" onClick={onCreate} />
        <Row icon={Users} title="Start a squad" body="Do it with friends, or fund a challenge" onClick={onSquad} />
        <Row icon={ArrowDownUp} title="Swap" body="Trade between QIE and dollars (QUSDC)" onClick={onSwap} />
        {remindersOff && address && <Row icon={BellRing} title="Reminders" body="A nudge before a check-in closes" onClick={onEnableReminders} />}
        {address && <Row icon={UserRound} title="Your public record" body="Share your score, streaks and badges" href={`/u/${address}`} />}
      </div>

      <div className="list">
        <Row icon={HelpCircle} title="How Pactiq works" body="The four rules, in plain words" href="/#terms" />
        <Row icon={Wallet} title="Get QIE" body="Where to buy the coin pacts are staked in" href={QIE_BUY_URL} external />
        <Row icon={FileText} title="Terms and privacy" body="What you agree to, and what happens to photos" href="/terms" />
        {address && <Row icon={LogOut} title="Disconnect" body="Your pacts stay safe; connect again any time" onClick={wallet.disconnect} />}
      </div>

      <div className="text-center text-sm text-ink-3 space-y-2 pb-2">
        <div className="inline-flex items-center gap-2">
          <span className="live-dot" /> Running on {activeChain.name}
        </div>
        {CONTRACT_ADDRESS && (
          <div>
            <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="underline">
              See the contract that holds the stakes
            </a>
          </div>
        )}
        <div>
          <Link href="/" className="underline">
            Pactiq home page
          </Link>
        </div>
      </div>
    </div>
  );
}
