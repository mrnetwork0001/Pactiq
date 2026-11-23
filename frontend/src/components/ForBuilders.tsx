import React from "react";
import { Reveal, SectionMark } from "./Motion";

const SOLIDITY = `import {IPactiqReputation} from "pactiq/IPactiqReputation.sol";

contract MyAirdrop {
    IPactiqReputation constant PACTIQ = IPactiqReputation(<PactiqVault>);

    function claim() external {
        require(PACTIQ.isVerifiedHuman(msg.sender, 200), "humans only");
        // ... pay out
    }
}`;

const HTTP = `GET /api/score/0xYourAddress?min=200

{ "score": 560, "verifiedHuman": true, "bestStreak": 7,
  "checkIns": 7, "completedPacts": 1, "badges": ["Week Warrior"] }`;

/** Inverted section: Pactiq as a Proof-of-Human primitive for other QIE apps. */
export function ForBuilders({ n = 5 }: { n?: number }) {
  return (
    <section id="builders" className="bg-ink text-card mt-24 scroll-mt-16">
      <div className="max-w-[calc(50vw_+_600px)] mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-14 items-start">
          <Reveal>
            <div className="flex items-center gap-3">
              <SectionMark n={n} />
              <div className="kicker !text-seal">For QIE builders</div>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.02] mt-3">
              Proof-of-Human,
              <br />
              <span className="italic font-normal">as a public good.</span>
            </h2>
            <p className="text-card/70 mt-5 leading-relaxed">
              Every Pactiq check-in is a staked, AI-witnessed daily action: expensive for bot farms, effortless for real people.
              Any QIE app can read a wallet&apos;s score to gate airdrops, faucets, allowlists or votes. Streaks also mint
              soulbound badges (ERC-5192) at 7, 30 and 100 days.
            </p>
            <div className="mt-6 border-t border-card/20 pt-4 num text-xs text-card/60 leading-relaxed">
              score = 10 × check-ins + 100 × kept pacts + 20 × best streak
              <br />− 50 × broken pacts
            </div>
          </Reveal>
          <div className="space-y-4 min-w-0">
            <Reveal delay={120}>
              <Snippet title="On-chain · Solidity" code={SOLIDITY} />
            </Reveal>
            <Reveal delay={260}>
              <Snippet title="Off-chain · HTTP, CORS-enabled" code={HTTP} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="border border-card/20 rounded-md overflow-hidden">
      <div className="px-4 py-2 border-b border-card/20 kicker !text-card/60">{title}</div>
      <pre className="p-4 text-[12px] leading-relaxed text-card/90 overflow-x-auto num">
        <code>{code}</code>
        <span className="caret" aria-hidden="true" />
      </pre>
    </div>
  );
}
