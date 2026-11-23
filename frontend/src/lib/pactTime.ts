import { PactStatus, type OnchainPact } from "./types";

/** Must match PactiqVault.DAY_DURATION / GRACE_PERIOD. */
export const DAY = 86_400;
export const GRACE = 12 * 3_600;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export function dayWindow(pact: Pick<OnchainPact, "startTime">, day: number) {
  const opensAt = pact.startTime + (day - 1) * DAY;
  return { opensAt, closesAt: opensAt + DAY + GRACE };
}

/** 1-based current day, capped at totalDays. */
export function currentDay(pact: Pick<OnchainPact, "startTime" | "totalDays">, now: number) {
  const day = Math.floor((now - pact.startTime) / DAY) + 1;
  return Math.max(1, Math.min(day, pact.totalDays));
}

export function settleableAt(pact: Pick<OnchainPact, "startTime" | "totalDays">) {
  return pact.startTime + pact.totalDays * DAY + GRACE;
}

/** Earliest unchecked day whose window is open right now (the one closing soonest), or null. */
export function openCheckInDay(pact: OnchainPact, days: boolean[], now: number): number | null {
  if (pact.status !== PactStatus.ACTIVE) return null;
  for (let d = 1; d <= pact.totalDays; d++) {
    if (days[d - 1]) continue;
    const { opensAt, closesAt } = dayWindow(pact, d);
    if (now >= opensAt && now <= closesAt) return d;
  }
  return null;
}

export type SettleState = "complete" | "expired" | "locked" | "settled";

export function settleState(pact: OnchainPact, now: number): SettleState {
  if (pact.status !== PactStatus.ACTIVE) return "settled";
  if (pact.checkInCount === pact.totalDays) return "complete";
  if (now > settleableAt(pact)) return "expired";
  return "locked";
}

/** Day status for the progress grid. */
export function dayState(pact: OnchainPact, days: boolean[], day: number, now: number) {
  if (days[day - 1]) return "done" as const;
  const { opensAt, closesAt } = dayWindow(pact, day);
  if (now > closesAt) return "missed" as const;
  if (now >= opensAt) return "open" as const;
  return "future" as const;
}

/** Consecutive verified days ending at the latest day that is still open or done. */
export function computeStreak(pact: OnchainPact, days: boolean[], now: number) {
  let d = currentDay(pact, now);
  if (!days[d - 1]) d -= 1; // today not done yet doesn't break the streak
  let streak = 0;
  while (d >= 1 && days[d - 1]) {
    streak++;
    d--;
  }
  return streak;
}

export function formatDuration(seconds: number) {
  if (seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// --- squads ---

export const SQUAD_JOIN_GRACE = 12 * 3_600;

export function squadEndsAt(s: { startTime: number; totalDays: number }) {
  return s.startTime + s.totalDays * DAY + GRACE;
}

export type SquadPhase = "upcoming" | "open" | "running" | "ended" | "finalized";

/** upcoming: before start (joinable) · open: started, still joinable · running · ended: awaiting finalize */
export function squadPhase(
  s: { startTime: number; totalDays: number; finalized: boolean; memberCount: number; maxMembers: number },
  now: number
): SquadPhase {
  if (s.finalized) return "finalized";
  if (now > squadEndsAt(s)) return "ended";
  if (now < s.startTime) return "upcoming";
  if (now <= s.startTime + SQUAD_JOIN_GRACE) return "open";
  return "running";
}

export const squadJoinable = (
  s: { startTime: number; totalDays: number; finalized: boolean; memberCount: number; maxMembers: number },
  now: number
) => {
  const p = squadPhase(s, now);
  return (p === "upcoming" || p === "open") && s.memberCount < s.maxMembers;
};
