"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/pactiq";

/**
 * Current *chain* time in unix seconds, ticking every `intervalMs`. Returns 0 until mounted.
 * Check-in windows are enforced with block.timestamp, so the UI follows the chain's clock
 * (via the latest block) rather than trusting the device clock, which may be skewed.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let offset = 0;
    let cancelled = false;
    const tick = () => !cancelled && setNow(Math.floor(Date.now() / 1000) + offset);
    const sync = () =>
      publicClient
        .getBlock({ blockTag: "latest" })
        .then((b) => {
          const drift = Number(b.timestamp) - Math.floor(Date.now() / 1000);
          offset = Math.abs(drift) > 60 ? drift : 0; // ignore normal block-time jitter
          tick();
        })
        .catch(() => {});
    const first = setTimeout(() => {
      tick();
      sync();
    }, 0);
    const t = setInterval(tick, intervalMs);
    const s = setInterval(sync, 5 * 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(t);
      clearInterval(s);
    };
  }, [intervalMs]);
  return now;
}
