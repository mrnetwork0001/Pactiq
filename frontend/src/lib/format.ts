import { formatEther } from "viem";

export function formatQie(wei: bigint, maxDigits = 2): string {
  const n = Number(formatEther(wei));
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDigits });
}

export function formatUsd(wei: bigint, usdPerQie: number | null | undefined): string | null {
  if (!usdPerQie) return null;
  const usd = Number(formatEther(wei)) * usdPerQie;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd < 10 ? 2 : 0,
  });
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
