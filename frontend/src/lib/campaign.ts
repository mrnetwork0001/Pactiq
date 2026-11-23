import { isAddress, parseEther, type Address } from "viem";

/**
 * The launch campaign, "The First Ten".
 *
 * Once NEXT_PUBLIC_CAMPAIGN_ADDRESS points at a deployed PactiqCampaign, the /launch page reads
 * every term below from that contract, so the page can never promise something the contract
 * won't pay. Until then these are the planned terms and the page is a preview.
 */
export const CAMPAIGN = {
  name: "The First Ten",
  /** QIE paid to each winner. */
  reward: parseEther("20"),
  /** How many people are rewarded, first come, first served. */
  winners: 10,
  /** Consecutive verified days, on one pact, needed to qualify. */
  minStreak: 3,
  /** 25 November 2026, 00:00 UTC. */
  startsAt: Date.UTC(2026, 10, 25) / 1000,
  /** Five days later. The campaign also ends as soon as every reward is claimed. */
  endsAt: Date.UTC(2026, 10, 30) / 1000,
} as const;

const raw = process.env.NEXT_PUBLIC_CAMPAIGN_ADDRESS ?? "";
export const CAMPAIGN_ADDRESS: Address | null = isAddress(raw) ? (raw as Address) : null;

/** PactiqCampaign.Status, in contract order. */
export const CLAIM_STATUS = ["eligible", "not-started", "ended", "all-claimed", "already-claimed", "streak-too-short", "not-funded"] as const;
export type ClaimStatus = (typeof CLAIM_STATUS)[number];

const view = (name: string, type: string) => ({ type: "function", name, stateMutability: "view", inputs: [], outputs: [{ type }] }) as const;
export const CAMPAIGN_ABI = [
  view("reward", "uint256"),
  view("maxWinners", "uint256"),
  view("minStreak", "uint256"),
  view("startsAt", "uint256"),
  view("endsAt", "uint256"),
  view("winners", "address[]"),
  view("fullyFunded", "bool"),
  { type: "function", name: "statusOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "error", name: "CannotClaim", inputs: [{ name: "status", type: "uint8" }] },
  { type: "error", name: "TransferFailed", inputs: [] },
] as const;
