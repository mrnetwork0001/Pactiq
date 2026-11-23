import type { Address } from "viem";
import type { AssetAmounts } from "./assets";

/** Mirrors PactiqVault.Category (uint8). */
export enum Category {
  FITNESS = 0,
  CODING = 1,
  LEARNING = 2,
  MEDITATION = 3,
  CUSTOM = 4,
}

/** Mirrors PactiqVault.PactStatus (uint8). */
export enum PactStatus {
  ACTIVE = 0,
  COMPLETED = 1,
  FAILED = 2,
}

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.FITNESS]: "Fitness",
  [Category.CODING]: "Coding",
  [Category.LEARNING]: "Learning",
  [Category.MEDITATION]: "Mindfulness",
  [Category.CUSTOM]: "Custom",
};

export interface OnchainPact {
  id: number;
  creator: Address;
  title: string;
  category: Category;
  dailyStake: bigint;
  totalDays: number;
  startTime: number; // unix seconds
  checkInCount: number;
  lastCheckInDay: number;
  totalStaked: bigint;
  status: PactStatus;
  qieId: string;
  squadId: number; // 0 = solo
  charity: Address; // zero address = community pool
  bestStreak: number;
  asset: Address; // zero address = QIE, otherwise QUSDC
}

export interface PactWithDays extends OnchainPact {
  days: boolean[]; // index 0 = day 1
  estBonus: bigint; // bonus if completed, given today's pool
}

/** Money totals of one stake asset (PactiqVault.getProtocolStats + Ledger.minStakePerDay). */
export interface AssetStats {
  /** 0 = closed to new pacts. */
  minStakePerDay: bigint;
  donated: bigint;
  sponsored: bigint;
  activeStake: bigint;
  rewardPool: bigint;
  volume: bigint;
  slashed: bigint;
  bonusesPaid: bigint;
}

/** Protocol-wide counts, with QIE totals at the top level and QUSDC (when listed) under `qusdc`. */
export interface ProtocolStats extends AssetStats {
  pactCount: number;
  squadCount: number;
  checkIns: number;
  completed: number;
  failed: number;
  qusdc: AssetStats | null;
}

/** Mirrors IPactiqReputation.HumanProfile plus display fields. */
export interface UserProfile {
  qieId: string;
  rewardsEarned: AssetAmounts;
  completedPacts: number;
  failedPacts: number;
  totalCheckIns: number;
  score: number;
  bestStreak: number;
  firstActivity: number;
  badges: number; // bitmask: 1 = 7d, 2 = 30d, 4 = 100d
}

export const BADGE_TIERS = [
  { bit: 1, days: 7, name: "Week Warrior", color: "#D13C1F" },
  { bit: 2, days: 30, name: "Month Master", color: "#2A45A3" },
  { bit: 4, days: 100, name: "Century Legend", color: "#9C6F12" },
] as const;

export interface Squad {
  id: number;
  creator: Address;
  title: string;
  category: Category;
  dailyStake: bigint;
  totalDays: number;
  startTime: number;
  maxMembers: number;
  memberCount: number;
  sponsor: string;
  sponsorPool: bigint;
  pot: bigint;
  finisherCount: number;
  bonusPerFinisher: bigint;
  finalized: boolean;
  asset: Address;
}

export interface Charity {
  account: Address;
  name: string;
  active: boolean;
  /** Received in total, per asset. */
  received: AssetAmounts;
  pending: AssetAmounts;
}

export interface QiePrice {
  usd: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  address: Address;
  qieId: string;
  checkIns: number;
  completed: number;
  activePacts: number;
  /** Lifetime stake, per asset. */
  staked: AssetAmounts;
  rewardsEarned: AssetAmounts;
  /** Current run on an active pact. */
  streak: number;
  /** Longest verified run ever, from the on-chain profile. */
  bestStreak: number;
  score: number;
  badges: number;
}

export interface ChallengeResponse {
  code: string;
  instruction: string;
  closesAt: number;
  error?: string;
}

export interface VerifyProofResponse {
  verified: boolean;
  verifier: "ai" | "demo";
  confidence: number;
  reasoning: string;
  detectedFeatures: string[];
  checks: {
    codeVisible: boolean;
    activityMatches: boolean;
    appearsAuthentic: boolean;
  };
  attemptsLeft: number;
  proofHash?: `0x${string}`;
  signature?: `0x${string}`;
  error?: string;
}
