"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { holdsQieName, normalizeQieName, primaryQieName, qiedexAvailable, qieIdEnabled, tokenBalance } from "@/lib/qie";

/** An ERC-20 balance (QUSDC) for `owner`, with a manual refresh. */
export function useTokenBalance(token: Address | null, owner: Address | null) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const refresh = useCallback(async () => {
    if (!token || !owner) return setBalance(null);
    try {
      setBalance(await tokenBalance(token, owner));
    } catch {
      setBalance(null);
    }
  }, [token, owner]);
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);
  return { balance, refresh };
}

/** Whether QIEDEX exists on the active chain. */
export function useQiedex() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let on = true;
    qiedexAvailable().then((v) => on && setLive(v));
    return () => {
      on = false;
    };
  }, []);
  return live;
}

/** "wallet": a name is typed but no wallet is connected to check it against. "error": the name service didn't answer. */
export type QieIdState = "disabled" | "empty" | "wallet" | "checking" | "verified" | "unowned" | "error";

/**
 * A .qie name field checked live against QIE's name service, through the same checker the
 * vault uses on-chain. Prefills the wallet's primary name.
 */
export function useQieId(address: Address | null, initial: string) {
  const [value, setValue] = useState(initial);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ key: string; owned: boolean | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [primary, setPrimary] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    qieIdEnabled().then((v) => on && setEnabled(v));
    if (address) {
      primaryQieName(address).then((n) => {
        if (!on || !n) return;
        setPrimary(n);
        setValue((v) => v || n);
      });
    }
    return () => {
      on = false;
    };
  }, [address]);

  const name = normalizeQieName(value);
  const key = `${address}:${name}`;
  useEffect(() => {
    if (!address || !name || !enabled) return;
    let on = true;
    const t = setTimeout(() => {
      holdsQieName(address, name).then((owned) => on && setResult({ key, owned }));
    }, 350);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [address, name, enabled, key, attempt]);

  const state: QieIdState =
    enabled === false
      ? "disabled"
      : !name
        ? "empty"
        : !address
          ? "wallet"
          : result?.key !== key
            ? "checking"
            : result.owned === null
              ? "error"
              : result.owned
                ? "verified"
                : "unowned";

  return {
    value,
    setValue,
    name,
    primary,
    state,
    /** What to send on-chain: the verified name, or "" to sign without one. */
    submitName: state === "verified" ? name : "",
    /** Blocks submit while a typed name is unverified. */
    blocking: state === "checking" || state === "unowned" || state === "error",
    /** Why the name is holding up the form, in words for the user. Null when it isn't. */
    problem:
      state === "checking"
        ? "Checking your .qie name with QIE…"
        : state === "unowned"
          ? `This wallet doesn't hold ${name}. Use a name you own, or sign without one.`
          : state === "error"
            ? `Couldn't check ${name} with QIE. Try again, or clear the name to sign without one.`
            : null,
    /** Ask the name service again after it failed to answer. */
    retry: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
