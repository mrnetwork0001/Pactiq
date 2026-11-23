"use client";

import React from "react";
import { useNow } from "@/hooks/useNow";

interface Props {
  startsAt: number;
  endsAt: number;
  /** Every reward is already claimed, so the campaign is over whatever the clock says. */
  soldOut?: boolean;
  /** "tiles" is the large four-box clock; "inline" is one line of text for banners. */
  variant?: "tiles" | "inline";
  className?: string;
}

const two = (n: number) => String(n).padStart(2, "0");

/**
 * The campaign clock, ticking every second on chain time: counts down to the opening, then,
 * once claims are open, counts down to the deadline.
 */
export function CampaignCountdown({ startsAt, endsAt, soldOut = false, variant = "tiles", className = "" }: Props) {
  const now = useNow(1000);
  const phase = !now ? "loading" : soldOut || now >= endsAt ? "over" : now < startsAt ? "before" : "live";
  const left = phase === "before" ? startsAt - now : phase === "live" ? endsAt - now : 0;
  const parts: [string, number][] = [
    ["days", Math.floor(left / 86_400)],
    ["hours", Math.floor((left % 86_400) / 3_600)],
    ["mins", Math.floor((left % 3_600) / 60)],
    ["secs", left % 60],
  ];
  const label = phase === "before" ? "Claims open in" : phase === "live" ? "Claims close in" : phase === "over" ? (soldOut ? "Every reward is claimed" : "The campaign has ended") : "Claims open in";

  if (variant === "inline") {
    if (phase === "over") return <span className={className}>{soldOut ? "All rewards claimed" : "Ended"}</span>;
    return (
      <span className={className}>
        {phase === "live" ? "Closes in " : "Opens in "}
        <span className="num font-semibold" suppressHydrationWarning>
          {phase === "loading" ? "…" : `${parts[0][1]}d ${two(parts[1][1])}h ${two(parts[2][1])}m ${two(parts[3][1])}s`}
        </span>
      </span>
    );
  }

  return (
    <div className={className} role="timer" aria-label={label}>
      <div className="flex items-center gap-2 mb-2.5">
        {phase === "live" && <span className="live-dot" />}
        <span className={`kicker ${phase === "live" ? "!text-seal" : ""}`}>{label}</span>
      </div>
      {phase !== "over" && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md">
          {parts.map(([unit, value]) => (
            <div key={unit} className={`sheet rounded-md text-center py-3 sm:py-4 ${phase === "live" ? "!border-seal" : ""}`}>
              <div className="num font-semibold leading-none text-3xl sm:text-5xl" suppressHydrationWarning>
                {phase === "loading" ? "--" : two(value)}
              </div>
              <div className="kicker !text-[10px] mt-2">{unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
