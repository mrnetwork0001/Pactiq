"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, getAddress, type Address } from "viem";
import { activeChain } from "@/lib/chain";
import { publicClient } from "@/lib/pactiq";
import { discoverWallets, ensureQieChain, getChainId, type Eip1193Provider, type WalletOption } from "@/lib/wallet";

const STORAGE_KEY = "pactiq:wallet";

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  walletName: string | null;
  balance: bigint | null;
  wallets: WalletOption[];
  discovered: boolean;
  connecting: boolean;
  wrongNetwork: boolean;
  /** Why the last automatic or manual network switch failed, in plain words. Null when it worked. */
  networkError: string | null;
  connect: (option?: WalletOption) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  /** Wallet client bound to the connected account; switches network first. */
  getWalletClient: () => Promise<ReturnType<typeof makeClient>>;
  refreshBalance: () => void;
}

function switchFailure(err: unknown): string {
  const e = err as { code?: number; message?: string };
  if (e?.code === 4001 || /reject|denied|cancel/i.test(e?.message ?? "")) return "The network switch was declined in your wallet.";
  const detail = (e?.message ?? "").split("\n")[0].slice(0, 140);
  return `Your wallet couldn't switch to ${activeChain.name} by itself${detail ? ` (${detail})` : ""}.`;
}

function makeClient(provider: Eip1193Provider, account: Address) {
  return createWalletClient({ account, chain: activeChain, transport: custom(provider) });
}

export function useWallet(): WalletState {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [discovered, setDiscovered] = useState(false);
  const [active, setActive] = useState<WalletOption | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [balanceNonce, setBalanceNonce] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Discover wallets and silently restore a previous connection.
  useEffect(() => {
    let cancelled = false;
    discoverWallets().then(async (list) => {
      if (cancelled) return;
      setWallets(list);
      setDiscovered(true);
      const remembered = localStorage.getItem(STORAGE_KEY);
      if (!remembered) return;
      const option = list.find((w) => (w.rdns ?? w.name) === remembered);
      if (!option) return;
      try {
        const accounts = (await option.provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled || !accounts?.length) return;
        setActive(option);
        setAddress(getAddress(accounts[0]));
        setChainId(await getChainId(option.provider));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track account / network changes.
  useEffect(() => {
    const provider = active?.provider;
    if (!provider?.on) return;
    const onAccounts = (accounts: string[]) => {
      if (!accounts?.length) {
        setAddress(null);
        setActive(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setAddress(getAddress(accounts[0]));
      }
    };
    const onChain = (hex: string) => setChainId(Number.parseInt(hex, 16));
    provider.on("accountsChanged", onAccounts as never);
    provider.on("chainChanged", onChain as never);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts as never);
      provider.removeListener?.("chainChanged", onChain as never);
    };
  }, [active]);

  // Keep the wallet on QIE. Whenever a connected wallet is on another network (a restored session,
  // or the user switched in the wallet), ask it to switch, adding QIE first if the wallet lacks it.
  // One prompt per account and network, so a rejection doesn't loop; the header button stays as the retry.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !address || chainId === null || chainId === activeChain.id) return;
    const key = `${address}:${chainId}`;
    if (asked.current === key) return;
    asked.current = key;
    ensureQieChain(active.provider)
      .then(() => getChainId(active.provider))
      .then((id) => {
        setChainId(id);
        setNetworkError(null);
      })
      .catch((err) => setNetworkError(switchFailure(err)));
  }, [active, address, chainId]);

  // Native balance on the app's chain.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () =>
      publicClient
        .getBalance({ address })
        .then((b) => !cancelled && setBalance(b))
        .catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [address, balanceNonce]);

  const connect = useCallback(
    async (option?: WalletOption) => {
      const choice = option ?? wallets[0];
      if (!choice) throw new Error("NO_WALLET");
      setConnecting(true);
      try {
        const accounts = (await choice.provider.request({ method: "eth_requestAccounts" })) as string[];
        if (!accounts?.length) throw new Error("No account authorised");
        // The network check above (switch, or add then switch) runs as soon as the wallet is set.
        setActive(choice);
        setAddress(getAddress(accounts[0]));
        setChainId(await getChainId(choice.provider));
        localStorage.setItem(STORAGE_KEY, choice.rdns ?? choice.name);
      } finally {
        setConnecting(false);
      }
    },
    [wallets]
  );

  const disconnect = useCallback(() => {
    setActive(null);
    setAddress(null);
    setBalance(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!active) return;
    try {
      await ensureQieChain(active.provider);
      setChainId(await getChainId(active.provider));
      setNetworkError(null);
    } catch (err) {
      setNetworkError(switchFailure(err));
    }
  }, [active]);

  const getWalletClient = useCallback(async () => {
    if (!active || !address) throw new Error("Connect your wallet first.");
    await ensureQieChain(active.provider);
    setChainId(activeChain.id);
    return makeClient(active.provider, address);
  }, [active, address]);

  return useMemo(
    () => ({
      address,
      chainId,
      walletName: active?.name ?? null,
      balance: address ? balance : null,
      wallets,
      discovered,
      connecting,
      wrongNetwork: !!address && chainId !== null && chainId !== activeChain.id,
      networkError: !!address && chainId !== activeChain.id ? networkError : null,
      connect,
      disconnect,
      switchNetwork,
      getWalletClient,
      refreshBalance: () => setBalanceNonce((n) => n + 1),
    }),
    [address, chainId, active, balance, wallets, discovered, connecting, networkError, connect, disconnect, switchNetwork, getWalletClient]
  );
}
