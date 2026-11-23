"use client";

import React from "react";
import Link from "next/link";
import { Camera, Check, Gift, PenLine } from "lucide-react";
import type { Abi } from "viem";
import { CAMPAIGN_ABI, CAMPAIGN_ADDRESS } from "@/lib/campaign";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { sendTx } from "@/lib/tx";
import { useCampaign } from "@/hooks/useCampaign";
import { TxTracker, useTxTracker } from "./TxTracker";
import { formatQie, formatUsd } from "@/lib/format";
import { formatDuration } from "@/lib/pactTime";
import { appUrl } from "@/lib/share";
import { useNow } from "@/hooks/useNow";
import { usePactiqData } from "@/hooks/usePactiqData";
import { useWallet } from "@/hooks/useWallet";
import { Wordmark } from "./Header";
import { Footer } from "./Footer";
import { Reveal, SectionMark } from "./Motion";
import { ShareButtons } from "./ShareButtons";
import { Kicker, btn } from "./ui";

const PAGE = "max-w-[calc(50vw_+_600px)] mx-auto px-4 sm:px-6";
const day = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

/** The launch campaign page: the offer, the three steps, the ten rewards and the rules. */
export default function Launch() {
  const wallet = useWallet();
  const data = usePactiqData(wallet.address);
  const now = useNow(30_000);
  const usd = data.price?.usd;
  const c = useCampaign(wallet.address);
  const tracker = useTxTracker();
  const pot = c.reward * BigInt(c.winners);

  const phase = !now ? "loading" : now < c.startsAt ? "before" : now < c.endsAt && c.claimedBy.length < c.winners ? "live" : "over";
  const claimed = c.claimedBy.length;
  // Progress is the wallet's best run of days in a row on one pact, which is what the contract checks.
  const mine = wallet.address && data.profile ? Math.min(data.profile.bestStreak, c.minStreak) : 0;
  const won = !!wallet.address && c.claimedBy.some((a) => a.toLowerCase() === wallet.address!.toLowerCase());

  const claim = async () => {
    if (!CAMPAIGN_ADDRESS) return;
    try {
      await tracker.run({
        kicker: "The First Ten",
        title: `Claim ${formatQie(c.reward)} QIE`,
        steps: [{ key: "claim", title: "Claim your reward", detail: "Paid straight to your wallet by the campaign contract." }],
        work: async (t) => {
          await sendTx(wallet, { address: CAMPAIGN_ADDRESS!, abi: CAMPAIGN_ABI as unknown as Abi, functionName: "claim", args: [] }, t.step("claim"));
          c.refresh();
          return { message: `${formatQie(c.reward)} QIE is in your wallet. You're one of the first ${c.winners}.`, value: null };
        },
      });
    } catch {
      c.refresh(); // the progress window already says what went wrong
    }
  };

  const steps = [
    { icon: PenLine, title: "Sign a pact", body: "Pick any habit and put a small stake on it. The minimum is a few cents, and every day you keep is refunded." },
    { icon: Camera, title: `Check in ${c.minStreak} days in a row`, body: "Each day, take a photo of your habit with that day's four-digit code in it. An AI witness checks it." },
    { icon: Gift, title: `Claim ${formatQie(c.reward)} QIE`, body: `The first ${c.winners} people to finish and claim are paid, straight to their wallet.` },
  ];

  return (
    <div className="min-h-screen overflow-x-clip flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-ink">
        <div className="max-w-[calc(75vw_+_324px)] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Wordmark />
          <Link href="/app#new" className={btn("seal", "sm", "sm:!px-4 sm:!text-sm")}>
            Sign a pact
          </Link>
        </div>
      </header>

      <main className={`${PAGE} flex-1 w-full pb-24`}>
        {/* The offer */}
        <section className="pt-10 sm:pt-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 border border-rule rounded-full pl-2.5 pr-3 py-1.5 text-xs text-ink-2 animate-rise">
              <span className="live-dot" />
              {phase === "before" && `Opens ${day(c.startsAt)}`}
              {phase === "live" && `Live now · ends ${day(c.endsAt)} or when every reward is claimed`}
              {phase === "over" && "This campaign has ended"}
              {phase === "loading" && "Launch campaign"}
            </div>
            <h1 className="font-display font-semibold tracking-[-0.02em] leading-[0.95] text-[3.1rem] sm:text-7xl lg:text-[5.2rem] mt-5">
              <span className="block animate-rise">The First</span>
              <span className="block animate-rise [animation-delay:110ms] italic font-normal">
                <span className="scribble">Ten</span>.
              </span>
            </h1>
            <p className="mt-7 text-lg text-ink-2 max-w-xl leading-relaxed animate-rise [animation-delay:240ms]">
              {formatQie(pot)} QIE for the first {c.winners} people who keep a {c.minStreak}-day streak on Pactiq. Sign a pact, check in
              {c.minStreak} days in a row, and claim {formatQie(c.reward)} QIE. Anyone can take part; the first {c.winners} to finish are paid.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 animate-rise [animation-delay:360ms]">
              <Link href="/app#new" className={btn("seal", "lg")}>
                {phase === "before" ? "Get ready: sign a pact" : "Sign a pact"}
              </Link>
              <a href="#rules" className={btn("outline", "lg")}>
                Read the rules
              </a>
            </div>
          </div>

          {/* Prize ticket */}
          <div className="animate-rise [animation-delay:300ms]">
            <div className="float-card relative mx-auto w-full max-w-md" aria-label="Prize">
              <div className="float-back absolute inset-0 sheet rounded-md" />
              <div className="relative sheet rounded-md overflow-hidden">
                <div className="bg-ink text-card px-6 py-3 flex items-center justify-between">
                  <span className="kicker !text-card/80">Launch prize</span>
                  <span className="kicker !text-[#e0b54a]">First come, first served</span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="font-display text-7xl sm:text-8xl font-semibold text-gold leading-none">{formatQie(pot)}</div>
                  <div className="num text-sm text-ink-3 mt-2">QIE{usd ? ` · about ${formatUsd(pot, usd)}` : ""}</div>
                  <div className="mt-6 grid grid-cols-3 gap-3 border-y border-rule py-4">
                    <Stat label="Each" value={`${formatQie(c.reward)} QIE`} />
                    <Stat label="Claimed" value={`${claimed} / ${c.winners}`} />
                    <Stat
                      label={phase === "before" ? "Opens in" : phase === "live" ? "Ends in" : "Status"}
                      value={phase === "before" ? formatDuration(c.startsAt - now) : phase === "live" ? formatDuration(c.endsAt - now) : phase === "over" ? "Ended" : "…"}
                    />
                  </div>
                  <div className="mt-5">
                    <Kicker className="mb-2.5">The rewards</Kicker>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: c.winners }, (_, i) => (
                        <span
                          key={i}
                          title={i < claimed ? `Reward ${i + 1}: claimed by ${shortAddress(c.claimedBy[i])}` : `Reward ${i + 1}: open`}
                          className={`num w-9 h-9 rounded-full grid place-items-center text-[11px] font-semibold border-2 ${
                            i < claimed ? "border-kept text-kept" : "border-dashed border-ink-3 text-ink-3"
                          }`}
                        >
                          {i < claimed ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-ink-3 mt-4">
                      {CAMPAIGN_ADDRESS ? (
                        <>
                          {c.funded ? "Prize money is held by " : "Prize money will be held by "}
                          <a href={explorerAddress(CAMPAIGN_ADDRESS)} target="_blank" rel="noreferrer" className="num text-quill underline">
                            the campaign contract
                          </a>
                          {c.funded ? " and paid automatically." : ". Not deposited yet."}
                        </>
                      ) : (
                        "Preview: the campaign contract isn't deployed yet."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Your progress, and the claim */}
        {wallet.address && (
          <Reveal className="mt-14 sheet rounded-md px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Kicker>Your streak</Kicker>
              <p className="font-display text-2xl font-semibold mt-1">
                {won ? "Reward claimed" : `${mine} of ${c.minStreak} days in a row`}
              </p>
              {!won && c.status && c.status !== "eligible" && c.status !== "streak-too-short" && (
                <p className="text-sm text-ink-2 mt-1">
                  {
                    {
                      "not-started": `Claims open ${day(c.startsAt)}. Your streak already counts.`,
                      ended: "The campaign has ended.",
                      "all-claimed": `All ${c.winners} rewards have been claimed.`,
                      "already-claimed": "This wallet has already been paid.",
                      "not-funded": "The prize money hasn't been deposited yet.",
                    }[c.status]
                  }
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {Array.from({ length: c.minStreak }, (_, i) => (
                <span key={i} className={`w-10 h-10 rounded-full grid place-items-center border-2 ${i < mine ? "border-kept text-kept" : "border-dashed border-ink-3 text-ink-3"}`}>
                  {i < mine ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="num text-xs">{i + 1}</span>}
                </span>
              ))}
            </div>
            {c.status === "eligible" ? (
              <button type="button" onClick={claim} className={btn("seal", "lg")}>
                <Gift className="w-4 h-4" /> Claim {formatQie(c.reward)} QIE
              </button>
            ) : (
              <Link href="/app" className={btn("ink", "md")}>
                {won || mine >= c.minStreak ? "Open your pacts" : "Check in today"}
              </Link>
            )}
          </Reveal>
        )}

        {/* How to take part */}
        <section className="mt-24 scroll-mt-24">
          <Reveal className="relative flex items-center gap-3.5 pb-3 mb-8">
            <SectionMark n={1} />
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Three steps</h2>
            <span className="draw-rule absolute left-0 right-0 bottom-0 h-px bg-ink" />
          </Reveal>
          <ol className="grid md:grid-cols-3 gap-x-8 gap-y-10">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 130} className="relative pt-5">
                <span className="draw-rule absolute top-0 left-0 right-0 h-0.5 bg-seal" />
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full border-2 border-seal text-seal grid place-items-center">
                    <s.icon className="w-5 h-5" />
                  </span>
                  <span className="font-display text-5xl font-light text-seal leading-none">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="font-display text-xl font-semibold mt-4">{s.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed mt-2">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Rules */}
        <section id="rules" className="mt-24 scroll-mt-24">
          <Reveal className="relative flex items-center gap-3.5 pb-3 mb-8">
            <SectionMark n={2} />
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">The rules</h2>
            <span className="draw-rule absolute left-0 right-0 bottom-0 h-px bg-ink" />
          </Reveal>
          <Reveal as="ol" className="grid md:grid-cols-2 gap-x-12 gap-y-5 text-ink-2 leading-relaxed">
            {[
              [`${formatQie(pot)} QIE, ${c.winners} rewards`, `Each reward is ${formatQie(c.reward)} QIE. One reward per person.`],
              ["When it runs", `From ${day(c.startsAt)} to ${day(c.endsAt)} (UTC), or until all ${c.winners} rewards are claimed, whichever comes first.`],
              ["Who can take part", "Anyone. There is no sign-up and no limit on how many people join."],
              ["How to qualify", `Check in ${c.minStreak} days in a row on one pact, each approved by the AI witness. A streak you start before the opening counts; claims open on ${day(c.startsAt)}.`],
              ["Who gets paid", `The first ${c.winners} people who qualify and claim. Finishing is not enough: you have to claim before the rewards run out.`],
              ["Your stake is yours", "The campaign reward is on top of your pact. Days you keep are refunded as usual; days you miss are forfeited as usual."],
            ].map(([title, body]) => (
              <li key={title} className="border-t border-rule pt-4">
                <span className="block font-display text-lg font-semibold text-ink">{title}</span>
                {body}
              </li>
            ))}
          </Reveal>
        </section>

        {/* Share */}
        <Reveal as="section" className="mt-24 border-2 border-ink rounded-md sheet px-6 sm:px-12 py-10 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">Ten rewards won&apos;t last long.</h2>
            <p className="text-ink-2 mt-2">Tell someone who keeps saying they&apos;ll start tomorrow.</p>
          </div>
          <ShareButtons
            text={`${formatQie(pot)} QIE for the first ${c.winners} people to keep a ${c.minStreak}-day streak on Pactiq. Opens ${day(c.startsAt)}.`}
            url={`${appUrl()}/launch`}
          />
        </Reveal>
      </main>

      <TxTracker tracked={tracker.tracked} onClose={tracker.close} />
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="kicker !text-[10px] mb-1">{label}</div>
      <div className="num font-medium text-base truncate">{value}</div>
    </div>
  );
}
