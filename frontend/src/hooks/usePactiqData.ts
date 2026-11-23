"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { CONTRACT_ADDRESS } from "@/lib/chain";
import {
  fetchCharities,
  fetchSquads,
  fetchLeaderboard,
  fetchProtocolStats,
  fetchQiePrice,
  fetchRecentPacts,
  fetchUserPacts,
  fetchUserProfile,
} from "@/lib/pactiq";
import type {
  Charity,
  Squad,
  LeaderboardEntry,
  OnchainPact,
  PactWithDays,
  ProtocolStats,
  QiePrice,
  UserProfile,
} from "@/lib/types";

export interface PactiqData {
  stats: ProtocolStats | null;
  price: QiePrice | null;
  recentPacts: OnchainPact[];
  leaderboard: LeaderboardEntry[];
  squads: Squad[];
  charities: Charity[];
  myPacts: PactWithDays[];
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface GlobalState {
  stats: ProtocolStats | null;
  price: QiePrice | null;
  recentPacts: OnchainPact[];
  leaderboard: LeaderboardEntry[];
  squads: Squad[];
  charities: Charity[];
}

interface UserState {
  owner: Address;
  pacts: PactWithDays[];
  profile: UserProfile;
}

const POLL_MS = 30_000;
const EMPTY: GlobalState = { stats: null, price: null, recentPacts: [], leaderboard: [], squads: [], charities: [] };

async function loadGlobal(): Promise<GlobalState> {
  const [stats, price] = await Promise.all([fetchProtocolStats(), fetchQiePrice()]);
  const [recentPacts, squads, charities] = await Promise.all([
    fetchRecentPacts(stats.pactCount),
    fetchSquads(stats.squadCount),
    fetchCharities(),
  ]);
  const leaderboard = await fetchLeaderboard(recentPacts);
  return { stats, price, recentPacts, leaderboard, squads, charities };
}

async function loadUser(owner: Address): Promise<UserState> {
  const [pacts, profile] = await Promise.all([fetchUserPacts(owner), fetchUserProfile(owner)]);
  return { owner, pacts, profile };
}

export function usePactiqData(user: Address | null): PactiqData {
  const [global, setGlobal] = useState<GlobalState>(EMPTY);
  const [mine, setMine] = useState<UserState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (address: Address | null) => {
    try {
      if (!CONTRACT_ADDRESS) {
        const price = await fetchQiePrice();
        setGlobal({ ...EMPTY, price });
        return;
      }
      const [g, u] = await Promise.all([loadGlobal(), address ? loadUser(address) : Promise.resolve(null)]);
      setGlobal(g);
      if (u) setMine(u);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Failed to load on-chain data");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => load(user), 0);
    const t = setInterval(() => load(user), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user, load]);

  const refresh = useCallback(() => load(user), [load, user]);
  const isMine = !!user && mine?.owner === user;

  return {
    ...global,
    myPacts: isMine ? mine!.pacts : [],
    profile: isMine ? mine!.profile : null,
    loading: !loaded || (!!user && !isMine),
    error,
    refresh,
  };
}
