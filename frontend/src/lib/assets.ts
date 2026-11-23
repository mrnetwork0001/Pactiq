import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { QIE_ECOSYSTEM } from "./chain";

/** A stake asset the vault accepts: native QIE or QUSDC. */
export interface AssetMeta {
  address: Address;
  symbol: "QIE" | "QUSDC";
  decimals: number;
  native: boolean;
  /** Pegged to the dollar, so amounts are already USD. */
  stable: boolean;
}

export const QIE_ASSET: AssetMeta = { address: zeroAddress, symbol: "QIE", decimals: 18, native: true, stable: false };
export const QUSDC_ASSET: AssetMeta = {
  address: QIE_ECOSYSTEM.qusdc,
  symbol: "QUSDC",
  decimals: 6,
  native: false,
  stable: true,
};

export function assetOf(address: string | null | undefined): AssetMeta {
  return address && address.toLowerCase() === QUSDC_ASSET.address.toLowerCase() ? QUSDC_ASSET : QIE_ASSET;
}

/** The plain number, e.g. "12.5". */
export function formatAmount(amount: bigint, asset: AssetMeta, maxDigits = 2): string {
  const n = Number(formatUnits(amount, asset.decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDigits, minimumFractionDigits: asset.stable && n > 0 ? 2 : 0 });
}

/** With the symbol, e.g. "12.5 QIE" or "12.50 QUSDC". */
export function formatAsset(amount: bigint, asset: AssetMeta, maxDigits = 2): string {
  return `${formatAmount(amount, asset, maxDigits)} ${asset.symbol}`;
}

export function parseAmount(value: string, asset: AssetMeta): bigint {
  try {
    return value ? parseUnits(value, asset.decimals) : 0n;
  } catch {
    return 0n;
  }
}

/** USD value: QUSDC is 1:1, QIE uses the QIE Oracle price. */
export function usdValue(amount: bigint, asset: AssetMeta, usdPerQie: number | null | undefined): number | null {
  const n = Number(formatUnits(amount, asset.decimals));
  if (asset.stable) return n;
  return usdPerQie ? n * usdPerQie : null;
}

export function formatUsdValue(usd: number | null): string | null {
  if (usd === null) return null;
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: usd < 10 ? 2 : 0 });
}

/** "≈ $1.20" for QIE amounts; null for QUSDC, whose amount already reads as dollars. */
export function usdHint(amount: bigint, asset: AssetMeta, usdPerQie: number | null | undefined): string | null {
  if (asset.stable) return null;
  return formatUsdValue(usdValue(amount, asset, usdPerQie));
}

/** Amounts held in both stake assets. */
export interface AssetAmounts {
  qie: bigint;
  qusdc: bigint;
}

export const ZERO_AMOUNTS: AssetAmounts = { qie: 0n, qusdc: 0n };

/** "1.05 QIE · 2.10 QUSDC", skipping zero legs ("0 QIE" when both are zero). */
export function formatAmounts(a: AssetAmounts, maxDigits = 3): string {
  const parts: string[] = [];
  if (a.qie > 0n) parts.push(formatAsset(a.qie, QIE_ASSET, maxDigits));
  if (a.qusdc > 0n) parts.push(formatAsset(a.qusdc, QUSDC_ASSET, 2));
  return parts.join(" · ") || "0";
}

export function amountsUsd(a: AssetAmounts, usdPerQie: number | null | undefined): number | null {
  const qie = a.qie > 0n ? usdValue(a.qie, QIE_ASSET, usdPerQie) : 0;
  if (qie === null) return null;
  return qie + (usdValue(a.qusdc, QUSDC_ASSET, null) ?? 0);
}
