/**
 * Server-only verification logic for /api/challenge and /api/verify-proof.
 * Never import this from a client component: it reads ORACLE_PRIVATE_KEY.
 */
import { createHmac } from "node:crypto";
import { encodePacked, isAddress, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACT_ADDRESS, activeChain, IS_MAINNET } from "@/lib/chain";
import { PACTIQ_ABI } from "@/lib/pactiqAbi";
import { publicClient } from "@/lib/pactiq";
import { PactStatus, type Category } from "@/lib/types";
import type { Judgement } from "./verdict";
import { incrementWindow } from "./store";
import { WitnessUnavailable, judgePhoto as askWitness, witnessConfigured, type Photo } from "./witness";

export type { Judgement };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function oracleKey(): Hex {
  const key = process.env.ORACLE_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new HttpError(503, "Verifier is not configured (ORACLE_PRIVATE_KEY missing).");
  }
  return key as Hex;
}

function challengeSecret(): string {
  return process.env.CHALLENGE_SECRET || `pactiq-challenge:${oracleKey()}`;
}

export function demoVerifierEnabled() {
  // The demo verifier approves any photo. It can never run against mainnet.
  return process.env.PACTIQ_DEMO_VERIFIER === "true" && !IS_MAINNET;
}

// ---------------------------------------------------------------------------
// Challenge codes: deterministic per (chain, contract, pact, day, user) so no storage is needed,
// unpredictable without the server secret, and different every day.
// ---------------------------------------------------------------------------

export function challengeCode(pactId: number, day: number, user: Address): string {
  const mac = createHmac("sha256", challengeSecret())
    .update(`${activeChain.id}:${CONTRACT_ADDRESS}:${pactId}:${day}:${user.toLowerCase()}`)
    .digest();
  return String((mac.readUInt32BE(0) % 9000) + 1000);
}

// ---------------------------------------------------------------------------
// On-chain eligibility
// ---------------------------------------------------------------------------

export interface EligiblePact {
  title: string;
  category: Category;
  closesAt: number;
}

export function parseIds(pactIdRaw: unknown, dayRaw: unknown, userRaw: unknown) {
  const pactId = Number(pactIdRaw);
  const day = Number(dayRaw);
  if (!Number.isSafeInteger(pactId) || pactId < 1) throw new HttpError(400, "Invalid pactId");
  if (!Number.isSafeInteger(day) || day < 1 || day > 100) throw new HttpError(400, "Invalid dayIndex");
  if (typeof userRaw !== "string" || !isAddress(userRaw)) throw new HttpError(400, "Invalid userAddress");
  return { pactId, day, user: userRaw as Address };
}

export async function assertEligible(pactId: number, day: number, user: Address): Promise<EligiblePact> {
  if (!CONTRACT_ADDRESS) throw new HttpError(503, "Contract address not configured.");
  const c = { address: CONTRACT_ADDRESS, abi: PACTIQ_ABI } as const;
  const [pact, eligible] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "getPact", args: [BigInt(pactId)] }),
    publicClient.readContract({ ...c, functionName: "isCheckInEligible", args: [BigInt(pactId), BigInt(day)] }),
  ]);
  if (pact.creator === "0x0000000000000000000000000000000000000000") throw new HttpError(404, "Pact not found.");
  if (pact.creator.toLowerCase() !== user.toLowerCase()) throw new HttpError(403, "This pact belongs to another wallet.");
  if (pact.status !== PactStatus.ACTIVE) throw new HttpError(409, "This pact is already settled.");
  if (!eligible) throw new HttpError(409, `Day ${day} is not open for check-in (already done or window closed).`);
  const [, closesAt] = await publicClient.readContract({
    ...c,
    functionName: "getDayWindow",
    args: [BigInt(pactId), BigInt(day)],
  });
  return { title: pact.title, category: pact.category as Category, closesAt: Number(closesAt) };
}

// ---------------------------------------------------------------------------
// Rate limiting, counted in the shared store so the limit holds across server instances
// ---------------------------------------------------------------------------

export const MAX_ATTEMPTS_PER_DAY = 5;

/** Count one attempt against `key`. Throws 429 past `max` per window; returns the attempts left. */
export async function takeAttempt(key: string, max = MAX_ATTEMPTS_PER_DAY, windowSeconds = 36 * 3600) {
  let used: number;
  try {
    used = await incrementWindow(`rl:${key}`, windowSeconds);
  } catch (e) {
    // A store outage must not stop people checking in and cost them their stake: let this one through.
    console.error("Rate-limit store unavailable; allowing the request", e);
    return max - 1;
  }
  if (used > max) throw new HttpError(429, "Too many attempts. Try again later.");
  return max - used;
}

// ---------------------------------------------------------------------------
// AI judgement (see witness.ts)
// ---------------------------------------------------------------------------

export const aiVerifierConfigured = witnessConfigured;

export async function judgePhoto(image: Photo, ctx: { title: string; category: Category; code: string }): Promise<Judgement> {
  try {
    return await askWitness(image, ctx);
  } catch (e) {
    if (e instanceof WitnessUnavailable) throw new HttpError(witnessConfigured() ? 502 : 503, e.message);
    throw e;
  }
}

export function demoJudgement(code: string): Judgement {
  return {
    verifier: "demo",
    approved: true,
    confidence: 1,
    codeVisible: true,
    activityMatches: true,
    appearsAuthentic: true,
    detectedFeatures: ["demo mode"],
    reasoning: `Demo verifier (testnet only): photo accepted without AI review. Code ${code}.`,
  };
}

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

export async function signAttestation(pactId: number, day: number, user: Address, imageBytes: Uint8Array) {
  if (!CONTRACT_ADDRESS) throw new HttpError(503, "Contract address not configured.");
  const account = privateKeyToAccount(oracleKey());

  const imageHash = keccak256(imageBytes);
  const proofHash = keccak256(
    encodePacked(
      ["bytes32", "uint256", "address", "uint256", "uint256", "address"],
      [imageHash, BigInt(activeChain.id), CONTRACT_ADDRESS, BigInt(pactId), BigInt(day), user]
    )
  );

  // Ask the contract for the digest so the encoding can never drift from Solidity.
  const [digest, signer] = await Promise.all([
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: PACTIQ_ABI,
      functionName: "checkInDigest",
      args: [BigInt(pactId), BigInt(day), proofHash, user],
    }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: PACTIQ_ABI, functionName: "oracleSigner" }),
  ]);
  if (signer.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`Oracle key mismatch: contract expects ${signer}, server key is ${account.address}`);
    throw new HttpError(503, "Verifier key does not match the contract's oracle signer.");
  }

  const signature = await account.signMessage({ message: { raw: digest } });
  return { proofHash, signature };
}
