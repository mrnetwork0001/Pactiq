import { erc20Abi, type Abi, type Address } from "viem";
import { publicClient } from "./pactiq";
import { CONTRACT_ADDRESS, PACTIQ_ROUTER, QIE_ECOSYSTEM } from "./chain";
import { PACTIQ_ABI } from "./pactiqAbi";

// ---------------------------------------------------------------------------
// QUSDC (ERC-20)
// ---------------------------------------------------------------------------

export async function tokenBalance(token: Address, owner: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export async function tokenAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
}

// ---------------------------------------------------------------------------
// QIEDEX (Uniswap V2 router): swap QIE for QUSDC without leaving the app
// ---------------------------------------------------------------------------

export const ROUTER_ABI = [
  {
    type: "function",
    name: "getAmountsIn",
    stateMutability: "view",
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactETHForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

export const QIE_TO_QUSDC: readonly Address[] = [QIE_ECOSYSTEM.wqie, QIE_ECOSYSTEM.qusdc];
/** Slippage the app tolerates on a QIEDEX swap. */
export const SWAP_SLIPPAGE_BPS = 100n;

let routerLive: Promise<boolean> | null = null;
/** Whether QIEDEX is deployed on the active chain (mainnet, or a local fork of it). */
export function qiedexAvailable(): Promise<boolean> {
  routerLive ??= publicClient
    .getCode({ address: QIE_ECOSYSTEM.qiedexRouter })
    .then((code) => !!code && code !== "0x")
    .catch(() => false);
  return routerLive;
}

/** QIE (wei) to send for at least `qusdcOut`, including slippage headroom. */
export async function quoteQieForQusdc(qusdcOut: bigint): Promise<{ qieIn: bigint; minOut: bigint }> {
  const amounts = await publicClient.readContract({
    address: QIE_ECOSYSTEM.qiedexRouter,
    abi: ROUTER_ABI,
    functionName: "getAmountsIn",
    args: [qusdcOut, QIE_TO_QUSDC],
  });
  const qieIn = (amounts[0] * (10_000n + SWAP_SLIPPAGE_BPS)) / 10_000n;
  return { qieIn, minOut: qusdcOut };
}

export const QUSDC_TO_QIE: readonly Address[] = [QIE_ECOSYSTEM.qusdc, QIE_ECOSYSTEM.wqie];

/** PactiqRouter (contracts/src/PactiqRouter.sol): the same QIEDEX trade, recorded as a PactiqSwap. */
export const PACTIQ_ROUTER_ABI = [
  {
    type: "function",
    name: "swapQieForToken",
    stateMutability: "payable",
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapTokenForQie",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "event",
    name: "PactiqSwap",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: true },
      { name: "tokenOut", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  { type: "function", name: "totalSwaps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalQieVolume", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/** The contract a swap is sent to, and so the one that needs a QUSDC allowance: PactiqRouter when deployed, else QIEDEX. */
export const SWAP_TARGET: Address = PACTIQ_ROUTER ?? QIE_ECOSYSTEM.qiedexRouter;

/**
 * The transaction for a QIE ⇄ QUSDC swap. Goes through PactiqRouter when it is deployed, so the
 * trade is attributed to Pactiq on-chain; otherwise straight to QIEDEX. Same pool and price either way.
 */
export function swapCall(sellQie: boolean, amountIn: bigint, minOut: bigint, user: Address) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const value = sellQie ? amountIn : undefined;
  if (PACTIQ_ROUTER) {
    const abi = PACTIQ_ROUTER_ABI as unknown as Abi;
    return sellQie
      ? { call: { address: PACTIQ_ROUTER, abi, functionName: "swapQieForToken", args: [QIE_ECOSYSTEM.qusdc, minOut, deadline] }, value }
      : { call: { address: PACTIQ_ROUTER, abi, functionName: "swapTokenForQie", args: [QIE_ECOSYSTEM.qusdc, amountIn, minOut, deadline] }, value };
  }
  const abi = ROUTER_ABI as unknown as Abi;
  const address = QIE_ECOSYSTEM.qiedexRouter;
  return sellQie
    ? { call: { address, abi, functionName: "swapExactETHForTokens", args: [minOut, QIE_TO_QUSDC, user, deadline] }, value }
    : { call: { address, abi, functionName: "swapExactTokensForETH", args: [amountIn, minOut, QUSDC_TO_QIE, user, deadline] }, value };
}

/** What `amountIn` buys on QIEDEX right now, and the least the app will accept after slippage. */
export async function quoteSwap(sellQie: boolean, amountIn: bigint): Promise<{ out: bigint; minOut: bigint }> {
  const amounts = await publicClient.readContract({
    address: QIE_ECOSYSTEM.qiedexRouter,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountIn, sellQie ? QIE_TO_QUSDC : QUSDC_TO_QIE],
  });
  const out = amounts[amounts.length - 1];
  return { out, minOut: (out * (10_000n - SWAP_SLIPPAGE_BPS)) / 10_000n };
}

// ---------------------------------------------------------------------------
// QIE ID (.qie names), via the checker the vault itself trusts
// ---------------------------------------------------------------------------

const NAMES_ABI = [
  {
    type: "function",
    name: "owns",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "name", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nameOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "string" }],
  },
] as const;

let namesAddress: Promise<Address | null> | null = null;
function qieNamesContract(): Promise<Address | null> {
  if (!CONTRACT_ADDRESS) return Promise.resolve(null);
  namesAddress ??= publicClient
    .readContract({ address: CONTRACT_ADDRESS, abi: PACTIQ_ABI, functionName: "qieNames" })
    .then((a) => (/^0x0{40}$/i.test(a) ? null : a))
    .catch(() => {
      namesAddress = null;
      return null;
    });
  return namesAddress;
}

/** Lowercase and add ".qie" when missing: "Alice" -> "alice.qie". */
export function normalizeQieName(raw: string): string {
  const n = raw.trim().toLowerCase();
  if (!n) return "";
  return n.endsWith(".qie") ? n : `${n}.qie`;
}

/** Whether names can be attached at all (the vault has a QIE ID checker). */
export async function qieIdEnabled(): Promise<boolean> {
  return (await qieNamesContract()) !== null;
}

/** The wallet's primary .qie name, or null. */
export async function primaryQieName(user: Address): Promise<string | null> {
  const names = await qieNamesContract();
  if (!names) return null;
  try {
    const n = await publicClient.readContract({ address: names, abi: NAMES_ABI, functionName: "nameOf", args: [user] });
    return n.trim() || null;
  } catch {
    return null;
  }
}

/** Whether QIE's name service says `user` holds `name` (the same check the vault runs). */
export async function holdsQieName(user: Address, name: string): Promise<boolean | null> {
  const names = await qieNamesContract();
  if (!names || !name) return false;
  try {
    // Null means "couldn't find out" (network trouble or no answer in 10 seconds), which is not a no.
    return await Promise.race([
      publicClient.readContract({ address: names, abi: NAMES_ABI, functionName: "owns", args: [user, name] }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
  } catch {
    return null;
  }
}
