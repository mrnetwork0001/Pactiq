import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  fallback,
  http,
  zeroAddress,
  type Address,
} from "viem";
import { PACTIQ_ABI } from "./pactiqAbi";
import { activeChain, CONTRACT_ADDRESS, QIE_ECOSYSTEM, QIE_USD_FEED, qieMainnet } from "./chain";
import { QUSDC_ASSET, type AssetAmounts } from "./assets";
import { computeStreak, nowSeconds } from "./pactTime";
import {
  PactStatus,
  type AssetStats,
  type Charity,
  type LeaderboardEntry,
  type OnchainPact,
  type PactWithDays,
  type ProtocolStats,
  type QiePrice,
  type Squad,
  type UserProfile,
} from "./types";

const transports = activeChain.rpcUrls.default.http.map((url) => http(url, { batch: true, timeout: 15_000 }));

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: transports.length > 1 ? fallback(transports) : transports[0],
});

/** Prices always come from the mainnet QIE Oracle, even when the app runs on testnet. */
const mainnetClient = createPublicClient({
  chain: qieMainnet,
  transport: fallback(qieMainnet.rpcUrls.default.http.map((url) => http(url, { batch: true }))),
});

function requireContract(): Address {
  if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS is not configured");
  return CONTRACT_ADDRESS;
}

const contract = () => ({ address: requireContract(), abi: PACTIQ_ABI }) as const;

// ---------------------------------------------------------------------------
// Pacts
// ---------------------------------------------------------------------------

type RawPact = Awaited<ReturnType<typeof readRawPact>>;
const readRawPact = (id: number) =>
  publicClient.readContract({ ...contract(), functionName: "getPact", args: [BigInt(id)] });

export function toPact(raw: RawPact): OnchainPact {
  return {
    id: Number(raw.id),
    creator: raw.creator,
    title: raw.title,
    category: raw.category,
    dailyStake: raw.dailyStake,
    totalDays: Number(raw.totalDays),
    startTime: Number(raw.startTime),
    checkInCount: Number(raw.checkInCount),
    lastCheckInDay: Number(raw.lastCheckInDay),
    totalStaked: raw.totalStaked,
    status: raw.status,
    qieId: raw.qieId,
    squadId: Number(raw.squadId),
    charity: raw.charity,
    bestStreak: Number(raw.bestStreak),
    asset: raw.asset,
  };
}

export async function fetchPact(id: number): Promise<OnchainPact> {
  return toPact(await readRawPact(id));
}

export async function fetchPactDays(id: number): Promise<boolean[]> {
  const days = await publicClient.readContract({ ...contract(), functionName: "getPactDays", args: [BigInt(id)] });
  return [...days];
}

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function fetchAssetStats(asset: Address) {
  const c = contract();
  const [r, ledger] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "getProtocolStats", args: [asset] }),
    publicClient.readContract({ ...c, functionName: "getLedger", args: [asset] }),
  ]);
  const money: AssetStats = {
    minStakePerDay: ledger.minStakePerDay,
    activeStake: r.activeStake,
    rewardPool: r.rewardPool,
    volume: r.volume,
    slashed: r.slashed,
    bonusesPaid: r.bonusesPaid,
    donated: r.donated,
    sponsored: r.sponsored,
  };
  return { r, money };
}

export async function fetchProtocolStats(): Promise<ProtocolStats> {
  const assets = await publicClient.readContract({ ...contract(), functionName: "getStakeAssets" });
  const hasQusdc = assets.some((a) => sameAddress(a, QIE_ECOSYSTEM.qusdc));
  const [qie, qusdc] = await Promise.all([
    fetchAssetStats(zeroAddress),
    hasQusdc ? fetchAssetStats(QUSDC_ASSET.address) : Promise.resolve(null),
  ]);
  const { r } = qie;
  return {
    ...qie.money,
    pactCount: Number(r.pactCount),
    squadCount: Number(r.squadCount),
    checkIns: Number(r.checkIns),
    completed: Number(r.completed),
    failed: Number(r.failed),
    qusdc: qusdc?.money ?? null,
  };
}

async function fetchRewards(user: Address): Promise<AssetAmounts> {
  const c = contract();
  const [qie, qusdc] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "userRewardsEarned", args: [user, zeroAddress] }),
    publicClient.readContract({ ...c, functionName: "userRewardsEarned", args: [user, QUSDC_ASSET.address] }),
  ]);
  return { qie, qusdc };
}

export async function fetchUserProfile(user: Address): Promise<UserProfile> {
  const c = contract();
  const [qieId, rewardsEarned, p] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "userQieId", args: [user] }),
    fetchRewards(user),
    publicClient.readContract({ ...c, functionName: "getHumanProfile", args: [user] }),
  ]);
  return {
    qieId,
    rewardsEarned,
    score: Number(p.score),
    totalCheckIns: Number(p.checkIns),
    completedPacts: Number(p.completedPacts),
    failedPacts: Number(p.failedPacts),
    bestStreak: Number(p.bestStreak),
    firstActivity: Number(p.firstActivity),
    badges: Number(p.badges),
  };
}

export async function fetchUserPacts(user: Address): Promise<PactWithDays[]> {
  const c = contract();
  const ids = await publicClient.readContract({ ...c, functionName: "getUserPacts", args: [user] });
  return Promise.all(
    [...ids].reverse().map(async (id) => {
      const [pact, days] = await Promise.all([fetchPact(Number(id)), fetchPactDays(Number(id))]);
      // Solo pacts draw their bonus from the community pool; squad pacts from the squad pot.
      const estBonus =
        pact.status === PactStatus.ACTIVE && pact.squadId === 0
          ? await publicClient.readContract({
              ...c,
              functionName: "estimateBonus",
              args: [pact.creator, pact.asset, pact.totalStaked],
            })
          : 0n;
      return { ...pact, days, estBonus };
    })
  );
}

/** Most recent `limit` pacts, newest first. */
export async function fetchRecentPacts(pactCount: number, limit = 250): Promise<OnchainPact[]> {
  const ids: number[] = [];
  for (let id = pactCount; id >= 1 && ids.length < limit; id--) ids.push(id);
  return Promise.all(ids.map(fetchPact));
}

// ---------------------------------------------------------------------------
// Leaderboard (ranked by Proof-of-Human score)
// ---------------------------------------------------------------------------

export async function fetchLeaderboard(pacts: OnchainPact[], top = 15): Promise<LeaderboardEntry[]> {
  type Acc = LeaderboardEntry & { actives: OnchainPact[] };
  const byUser = new Map<string, Acc>();
  for (const p of pacts) {
    const key = p.creator.toLowerCase();
    const e: Acc =
      byUser.get(key) ??
      ({
        address: p.creator,
        qieId: "",
        checkIns: 0,
        completed: 0,
        activePacts: 0,
        staked: { qie: 0n, qusdc: 0n },
        rewardsEarned: { qie: 0n, qusdc: 0n },
        streak: 0,
        bestStreak: 0,
        score: 0,
        badges: 0,
        actives: [],
      } as Acc);
    e.checkIns += p.checkInCount;
    if (sameAddress(p.asset, QUSDC_ASSET.address)) e.staked.qusdc += p.totalStaked;
    else e.staked.qie += p.totalStaked;
    if (p.status === PactStatus.COMPLETED) e.completed++;
    if (p.status === PactStatus.ACTIVE) {
      e.activePacts++;
      if (e.actives.length < 3) e.actives.push(p);
    }
    if (!e.qieId && p.qieId) e.qieId = p.qieId; // pacts are newest-first
    byUser.set(key, e);
  }

  // Pre-rank cheaply, then fetch the on-chain score for the top candidates and re-rank.
  const candidates = [...byUser.values()]
    .sort((a, b) => b.completed - a.completed || b.checkIns - a.checkIns)
    .slice(0, top * 2);

  const c = contract();
  const now = nowSeconds();
  await Promise.all(
    candidates.map(async (e) => {
      const [rewards, profile, ...allDays] = await Promise.all([
        fetchRewards(e.address),
        publicClient.readContract({ ...c, functionName: "getHumanProfile", args: [e.address] }),
        ...e.actives.map((p) => fetchPactDays(p.id)),
      ]);
      e.rewardsEarned = rewards;
      e.score = Number(profile.score);
      e.badges = Number(profile.badges);
      e.bestStreak = Number(profile.bestStreak);
      e.streak = Math.max(0, ...e.actives.map((p, i) => computeStreak(p, allDays[i] as boolean[], now)));
    })
  );

  return candidates
    .sort((a, b) => b.score - a.score || b.checkIns - a.checkIns)
    .slice(0, top)
    .map((e) => {
      const { actives, ...rest } = e;
      void actives;
      return rest;
    });
}

// ---------------------------------------------------------------------------
// Squads, charities
// ---------------------------------------------------------------------------

export async function fetchSquad(id: number): Promise<Squad | null> {
  const s = await publicClient.readContract({ ...contract(), functionName: "getSquad", args: [BigInt(id)] });
  if (s.creator === zeroAddress) return null;
  return {
    id: Number(s.id),
    creator: s.creator,
    title: s.title,
    category: s.category,
    dailyStake: s.dailyStake,
    totalDays: Number(s.totalDays),
    startTime: Number(s.startTime),
    maxMembers: Number(s.maxMembers),
    memberCount: Number(s.memberCount),
    sponsor: s.sponsor,
    sponsorPool: s.sponsorPool,
    pot: s.pot,
    finisherCount: Number(s.finisherCount),
    bonusPerFinisher: s.bonusPerFinisher,
    finalized: s.finalized,
    asset: s.asset,
  };
}

/** Newest squads first. */
export async function fetchSquads(squadCount: number, limit = 60): Promise<Squad[]> {
  const ids: number[] = [];
  for (let id = squadCount; id >= 1 && ids.length < limit; id--) ids.push(id);
  return (await Promise.all(ids.map(fetchSquad))).filter((s): s is Squad => s !== null);
}

export async function fetchSquadMembers(id: number): Promise<OnchainPact[]> {
  const ids = await publicClient.readContract({ ...contract(), functionName: "getSquadPacts", args: [BigInt(id)] });
  return Promise.all([...ids].map((pid) => fetchPact(Number(pid))));
}

export async function fetchCharities(): Promise<Charity[]> {
  const c = contract();
  const [qie, qusdc] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "getCharities", args: [zeroAddress] }),
    publicClient.readContract({ ...c, functionName: "getCharities", args: [QUSDC_ASSET.address] }),
  ]);
  return qie.map((ch, i) => ({
    account: ch.account,
    name: ch.name,
    active: ch.active,
    received: { qie: ch.totalReceived, qusdc: qusdc[i]?.totalReceived ?? 0n },
    pending: { qie: ch.pending, qusdc: qusdc[i]?.pending ?? 0n },
  }));
}

/** QIE wei needed for `usdPerDay` (18 decimals), priced on-chain by the QIE Oracle. */
export async function quotePactUsd(usdPerDay: bigint, totalDays: number) {
  const [daily, total] = await publicClient.readContract({
    ...contract(),
    functionName: "quotePactUsd",
    args: [usdPerDay, BigInt(totalDays)],
  });
  return { daily, total };
}

// ---------------------------------------------------------------------------
// QIE Oracle price (UI)
// ---------------------------------------------------------------------------

const AGGREGATOR_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export async function fetchQiePrice(): Promise<QiePrice | null> {
  try {
    const [round, decimals] = await Promise.all([
      mainnetClient.readContract({ address: QIE_USD_FEED, abi: AGGREGATOR_ABI, functionName: "latestRoundData" }),
      mainnetClient.readContract({ address: QIE_USD_FEED, abi: AGGREGATOR_ABI, functionName: "decimals" }),
    ]);
    const answer = round[1];
    if (answer <= 0n) return null;
    return { usd: Number(answer) / 10 ** decimals, updatedAt: Number(round[3]) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  InvalidDuration: "Duration must be between 3 and 100 days.",
  InsufficientStake: "The stake is below the daily minimum or doesn't match the total.",
  UnsupportedAsset: "That currency isn't accepted for new pacts right now.",
  QieIdNotOwned: "This wallet doesn't hold that .qie name. Use a name you own, or sign without one.",
  ERC20InsufficientAllowance: "QUSDC isn't approved yet. Approve it and try again.",
  ERC20InsufficientBalance: "Not enough QUSDC in your wallet.",
  InvalidTitle: "Title must be 1–80 characters.",
  InvalidQieId: "QIE ID must be 32 characters or fewer.",
  PactNotFound: "That pact doesn't exist.",
  PactNotActive: "This pact has already been settled.",
  Unauthorized: "Only the pact creator can check in.",
  DayAlreadyCheckedIn: "You've already checked in for this day.",
  DayOutOfRange: "That day is outside this pact.",
  CheckInWindowClosed: "The check-in window for this day isn't open.",
  ProofAlreadyUsed: "This proof has already been used.",
  InvalidOracleSignature: "The verifier signature was rejected. Please verify again.",
  PactStillInProgress: "This pact can't be settled yet.",
  TransferFailed: "Payout transfer failed.",
  EnforcedPause: "New pacts are temporarily paused.",
  PriceUnavailable: "The QIE Oracle price is unavailable or stale. Try staking in QIE instead.",
  InvalidCharity: "That cause isn't on the approved list.",
  SquadNotFound: "That squad doesn't exist.",
  InvalidSquadConfig: "Squads need 2–100 members and must start within 14 days.",
  SquadClosed: "This squad is no longer open.",
  SquadFull: "This squad is full.",
  AlreadyInSquad: "You're already in this squad.",
  SquadStillRunning: "The squad hasn't ended yet. Everyone settles together after the last day.",
  SquadAlreadyFinalized: "This squad has already been finalized.",
  NothingToWithdraw: "Nothing to release yet.",
};

/** Turn viem / wallet errors into a short human message. */
export function describeError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && ERROR_MESSAGES[name]) return ERROR_MESSAGES[name];
      if (name) return `Transaction reverted: ${name}`;
    }
    const msg = err.shortMessage || err.message;
    if (/user rejected|denied|4001/i.test(msg)) return "Request rejected in wallet.";
    if (/insufficient funds/i.test(msg)) return "Not enough QIE in your wallet (stake + gas).";
    if (/INSUFFICIENT_OUTPUT_AMOUNT|EXPIRED/i.test(msg)) return "The QIEDEX price moved. Try the swap again.";
    return msg;
  }
  if (typeof err === "object" && err && "code" in err && (err as { code: number }).code === 4001) {
    return "Request rejected in wallet.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
