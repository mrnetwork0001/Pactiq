"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { CAMPAIGN, CAMPAIGN_ABI, CAMPAIGN_ADDRESS, CLAIM_STATUS, type ClaimStatus } from "@/lib/campaign";
import { publicClient } from "@/lib/pactiq";

export interface CampaignState {
  /** False while the page is showing planned terms because no contract is deployed yet. */
  live: boolean;
  reward: bigint;
  winners: number;
  minStreak: number;
  startsAt: number;
  endsAt: number;
  /** Wallets paid so far, in claim order. */
  claimedBy: Address[];
  /** Whether the contract holds enough to pay every reward that is left. */
  funded: boolean;
  /** Whether the connected wallet can claim right now, and if not, why. Null without a wallet or a contract. */
  status: ClaimStatus | null;
  refresh: () => void;
}

const PLANNED = { live: false, reward: CAMPAIGN.reward, winners: CAMPAIGN.winners, minStreak: CAMPAIGN.minStreak, startsAt: CAMPAIGN.startsAt, endsAt: CAMPAIGN.endsAt, claimedBy: [] as Address[], funded: false, status: null };

/** The campaign's terms and progress, read from its contract when one is deployed. */
export function useCampaign(user: Address | null): CampaignState {
  const [state, setState] = useState<Omit<CampaignState, "refresh">>(PLANNED);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!CAMPAIGN_ADDRESS) return;
    let on = true;
    const c = { address: CAMPAIGN_ADDRESS, abi: CAMPAIGN_ABI } as const;
    const load = async () => {
      try {
        const [reward, maxWinners, minStreak, startsAt, endsAt, claimedBy, funded, status] = await Promise.all([
          publicClient.readContract({ ...c, functionName: "reward" }),
          publicClient.readContract({ ...c, functionName: "maxWinners" }),
          publicClient.readContract({ ...c, functionName: "minStreak" }),
          publicClient.readContract({ ...c, functionName: "startsAt" }),
          publicClient.readContract({ ...c, functionName: "endsAt" }),
          publicClient.readContract({ ...c, functionName: "winners" }),
          publicClient.readContract({ ...c, functionName: "fullyFunded" }),
          user ? publicClient.readContract({ ...c, functionName: "statusOf", args: [user] }) : Promise.resolve(null),
        ]);
        if (!on) return;
        setState({
          live: true,
          reward,
          winners: Number(maxWinners),
          minStreak: Number(minStreak),
          startsAt: Number(startsAt),
          endsAt: Number(endsAt),
          claimedBy: [...claimedBy],
          funded,
          status: status === null ? null : (CLAIM_STATUS[status] ?? null),
        });
      } catch {
        /* keep showing the last good state */
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [user, tick]);

  return { ...state, refresh };
}
