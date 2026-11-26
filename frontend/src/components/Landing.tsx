"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { usePactiqData } from "@/hooks/usePactiqData";
import { useNow } from "@/hooks/useNow";
import { useCampaign } from "@/hooks/useCampaign";
import { shortAddress } from "@/lib/format";
import { assetOf, formatAsset } from "@/lib/assets";
import { PactStatus, type OnchainPact } from "@/lib/types";
import { squadJoinable } from "@/lib/pactTime";
import { Wordmark } from "./Header";
import { Hero, StatsLedger } from "./HeroStats";
import { HowItWorks } from "./HowItWorks";
import { ForBuilders } from "./ForBuilders";
import { BuiltOnQie } from "./BuiltOnQie";
import { Marquee, Reveal, SectionHead, SectionMark } from "./Motion";
import { Footer } from "./Footer";
import { Bounty } from "./SquadsTab";
import { BadgeRow } from "./Badges";
import { formatEther } from "viem";
import { CAMPAIGN } from "@/lib/campaign";
import { CampaignCountdown } from "./Countdown";
import { Burger, Drawer, Kicker, btn, scrollToSection } from "./ui";

const WIDE = "max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6";
const PAGE = "max-w-[calc(50vw_+_600px)] mx-auto px-4 sm:px-6";
const SECTIONS = [
  { id: "why", label: "Why Pactiq" },
  { id: "terms", label: "How it works" },
  { id: "qie", label: "Built on QIE" },
  { id: "record", label: "Challenges" },
  { id: "builders", label: "For builders" },
];

/** The public landing page at `/`. The product itself lives at `/app`. */
export default function Landing() {
  const wallet = useWallet();
  const data = usePactiqData(null);
  const campaign = useCampaign(null);
  const now = useNow(30_000);
  const router = useRouter();
  const returning = !!wallet.address;
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);

  const challenges = data.squads
    .filter((s) => s.sponsor)
    .sort((a, b) => Number(now > 0 && squadJoinable(b, now)) - Number(now > 0 && squadJoinable(a, now)) || b.id - a.id)
    .slice(0, 2);
  const top = data.leaderboard.slice(0, 5);

  return (
    <div className="min-h-screen overflow-x-clip flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-ink">
        <div className={`${WIDE} h-16 flex items-center justify-between gap-3`}>
          <Wordmark />
          <nav className="flex items-center gap-7">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`} className="nav-link hidden md:inline text-sm text-ink-2 hover:text-ink transition-colors">
                {x.label}
              </a>
            ))}
            <Burger open={menu} onClick={() => setMenu((m) => !m)} />
          </nav>
        </div>
      </header>

      <Drawer
        open={menu}
        onClose={closeMenu}
        head={<Wordmark size={28} />}
        footer={
          <Link href={returning ? "/app" : "/app#new"} className={btn("seal", "lg", "w-full")} onClick={closeMenu}>
            {returning ? "Go to your pacts" : "Open the app"}
          </Link>
        }
      >
        <Kicker className="mb-1">On this page</Kicker>
        {SECTIONS.map((x, i) => (
          <a
            key={x.id}
            href={`#${x.id}`}
            className="drawer-item"
            onClick={(e) => {
              e.preventDefault();
              closeMenu();
              scrollToSection(x.id);
            }}
          >
            <SectionMark n={i + 1} small className="mr-1" />
            <span className="font-display text-lg">{x.label}</span>
          </a>
        ))}
        <Kicker className="mt-6 mb-1">Launch campaign</Kicker>
        <Link href="/launch" className="drawer-item" onClick={closeMenu}>
          {CAMPAIGN.name}
        </Link>
        <Kicker className="mt-6 mb-1">In the app</Kicker>
        <Link href="/app#squads" className="drawer-item" onClick={closeMenu}>
          Squads &amp; challenges
        </Link>
        <Link href="/app#register" className="drawer-item" onClick={closeMenu}>
          The register
        </Link>
      </Drawer>

      <main className={`${PAGE} flex-1 w-full pb-24`}>
        <noscript>
          <style>{".reveal{opacity:1;translate:none}"}</style>
        </noscript>
        <Link
          href="/launch"
          className="group mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border border-seal/40 bg-seal/5 rounded-md px-4 py-2.5 text-sm text-center hover:bg-seal/10 transition-colors"
        >
          <span className="kicker !text-seal">Launch campaign</span>
          <span>
            <strong>{CAMPAIGN.name}:</strong> keep a {CAMPAIGN.minStreak}-day streak, and the first {CAMPAIGN.winners} to claim get{" "}
            <span className="num">{formatEther(CAMPAIGN.reward)}</span> QIE each.
          </span>
          <CampaignCountdown startsAt={campaign.startsAt} endsAt={campaign.endsAt} soldOut={campaign.claimedBy.length >= campaign.winners} variant="inline" className="text-ink-2" />
          <span className="font-semibold text-seal group-hover:underline">See how &rarr;</span>
        </Link>
        <Hero returning={returning} />

        <Ticker pacts={data.recentPacts} />

        <Reveal className={data.recentPacts.length >= 3 ? "mt-6" : "mt-16"}>
          <StatsLedger stats={data.stats} price={data.price} loading={data.loading} />
        </Reveal>

        {/* I. The problem and the fix */}
        <section id="why" className="mt-24 scroll-mt-24">
          <SectionHead n={1} title="Why Pactiq" />
          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16">
            <Reveal as="p" className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight">
              Free to quit <span className="italic font-normal text-ink-2">is the whole problem.</span>
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-8">
              <Reveal delay={140}>
                <Kicker className="!text-seal mb-2">For people</Kicker>
                <p className="text-ink-2 leading-relaxed">
                  Habit apps cost nothing to abandon, so most get abandoned. A stake changes the maths: skipping a day now
                  costs real money, and finishing pays you back with a share of what the quitters left behind.
                </p>
              </Reveal>
              <Reveal delay={280}>
                <Kicker className="!text-seal mb-2">For QIE</Kicker>
                <p className="text-ink-2 leading-relaxed">
                  New chains get farmed by bots. A staked, AI-witnessed, once-a-day check-in is one of the hardest
                  activities to fake, so every pact also builds a public Proof-of-Human score any QIE app can read.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <HowItWorks n={2} />

        <BuiltOnQie n={3} />

        {/* IV. Live from the chain */}
        <section id="record" className="mt-24 scroll-mt-24">
          <SectionHead
            n={4}
            title="On the record"
            aside={
              <>
                <span className="live-dot" /> Read live from the chain
              </>
            }
          />
          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-10">
            <Reveal>
              <div className="flex items-baseline justify-between mb-4">
                <Kicker>Sponsored challenges</Kicker>
                <Link href="/app#squads" className="text-sm font-semibold text-seal hover:underline">
                  All squads
                </Link>
              </div>
              {challenges.length === 0 ? (
                <p className="text-sm text-ink-3 py-10 border-2 border-dashed border-rule rounded-md text-center">
                  {data.loading ? "Loading…" : "No sponsored challenges yet. Projects can fund one from the app."}
                </p>
              ) : (
                <div className="grid gap-6">
                  {challenges.map((s) => (
                    <Bounty key={s.id} squad={s} now={now} usdPrice={data.price?.usd} onOpen={(id) => router.push(`/squad/${id}`)} />
                  ))}
                </div>
              )}
            </Reveal>

            <Reveal delay={160}>
              <div className="flex items-baseline justify-between mb-4">
                <Kicker>Top of the register</Kicker>
                <Link href="/app#register" className="text-sm font-semibold text-seal hover:underline">
                  Full register
                </Link>
              </div>
              {top.length === 0 ? (
                <p className="text-sm text-ink-3 py-10 border-2 border-dashed border-rule rounded-md text-center">
                  {data.loading ? "Reading the register…" : "The register is empty. Be the first line."}
                </p>
              ) : (
                <ol className="sheet rounded-md divide-y divide-rule">
                  {top.map((u, i) => (
                    <li key={u.address} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper/70">
                      <span className={`font-display text-2xl w-6 ${i < 3 ? "text-seal font-semibold" : "text-ink-3"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/u/${u.address}`} className="font-semibold truncate hover:text-quill hover:underline">
                            {u.qieId || shortAddress(u.address)}
                          </Link>
                          <BadgeRow mask={u.badges} size={20} />
                        </div>
                        <div className="num text-[11px] text-ink-3">
                          {u.checkIns} days kept · best streak {u.bestStreak}d
                        </div>
                      </div>
                      <span className="num text-lg font-semibold">{u.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Reveal>
          </div>
        </section>

        {/* Closing call to action */}
        <Reveal as="section" className="mt-24 border-2 border-ink rounded-md sheet px-6 sm:px-12 py-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Your first pact takes a minute.
              <br />
              <span className="italic font-normal text-ink-2">Keeping it takes the rest of you.</span>
            </h2>
            <p className="text-ink-2 mt-4 max-w-xl">Connect QIE Wallet, name a habit, choose a stake. Day 1 opens the moment you sign.</p>
          </div>
          <Link href={returning ? "/app" : "/app#new"} className={btn("seal", "lg")}>
            {returning ? "Go to your pacts" : "Sign your first pact"}
          </Link>
        </Reveal>
      </main>

      <ForBuilders n={5} />
      <Footer />
    </div>
  );
}

/** A strip of the latest pacts on the chain, always moving. Hidden until there are enough to fill it. */
function Ticker({ pacts }: { pacts: OnchainPact[] }) {
  const latest = pacts.slice(0, 12);
  if (latest.length < 3) return null;
  return (
    <Marquee seconds={latest.length * 7} gap="2.5rem" className="mt-14 border-y border-rule py-2.5">
      {latest.map((p) => (
        <Link key={p.id} href={`/u/${p.creator}`} className="flex items-center gap-2 whitespace-nowrap text-sm text-ink-2 hover:text-ink">
          <span className="kicker !text-[10px]">Nº {p.id}</span>
          <span className="font-semibold text-ink">{p.qieId || shortAddress(p.creator)}</span>
          <span>
            staked <span className="num text-ink">{formatAsset(p.totalStaked, assetOf(p.asset))}</span> on
          </span>
          <span className="font-display italic text-ink max-w-[16rem] truncate">{p.title}</span>
          {p.status === PactStatus.COMPLETED ? (
            <span className="kicker !text-[10px] !text-kept">Kept</span>
          ) : p.status === PactStatus.FAILED ? (
            <span className="kicker !text-[10px] !text-seal">Broken</span>
          ) : (
            <span className="kicker !text-[10px]">
              {p.checkInCount}/{p.totalDays} days
            </span>
          )}
        </Link>
      ))}
    </Marquee>
  );
}
