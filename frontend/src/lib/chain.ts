import { defineChain, isAddress, type Address, type Chain } from "viem";

/** QIE Mainnet (V3). Chain ID 1990 — the legacy IDs 5656 / 9731 are deprecated. */
export const qieMainnet = defineChain({
  id: 1990,
  name: "QIE Mainnet",
  nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://rpc1mainnet.qie.digital/",
        "https://rpc2mainnet.qie.digital/",
        "https://rpc3mainnet.qie.digital/",
      ],
    },
  },
  blockExplorers: {
    default: { name: "QIE Explorer", url: "https://mainnet.qie.digital" },
  },
});

export const qieTestnet = defineChain({
  id: 1983,
  name: "QIE Testnet",
  nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc1testnet.qie.digital/", "https://rpc2testnet.qie.digital/"],
    },
  },
  blockExplorers: {
    default: { name: "QIE Testnet Explorer", url: "https://testnet.qie.digital" },
  },
  testnet: true,
});

/** Official QIE Oracle QIE/USDT feed (8 decimals) on QIE Mainnet. */
export const QIE_USD_FEED: Address = "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17";

const envAddress = (v: string | undefined, fallback: Address): Address => (v && isAddress(v) ? (v as Address) : fallback);

/**
 * QIE ecosystem contracts (QIE Mainnet). A local fork of mainnet has them at the same addresses;
 * the app only offers what is actually deployed on the active chain (the vault lists QUSDC, the
 * router has code), so these stay inert on testnet.
 */
export const QIE_ECOSYSTEM = {
  /** QUSDC, QIE's USDC-backed stablecoin (6 decimals). */
  qusdc: envAddress(process.env.NEXT_PUBLIC_QUSDC_ADDRESS, "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5"),
  /** Wrapped QIE, the router's native leg. */
  wqie: envAddress(process.env.NEXT_PUBLIC_WQIE_ADDRESS, "0x0087904D95BEe9E5F24dc8852804b547981A9139"),
  /** QIEDEX router (Uniswap V2 interface). */
  qiedexRouter: envAddress(process.env.NEXT_PUBLIC_QIEDEX_ROUTER, "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef"),
} as const;

export const QIE_ID_URL = "https://id.qie.digital";
export const QIEDEX_URL = "https://qiedex.qie.digital";
/** QIE's own list of exchanges and swap services that sell QIE. */
export const QIE_BUY_URL = "https://www.qie.digital/buy";
export const QIE_BRIDGE_URL = "https://bridge.qie.digital";

export const NETWORK: "mainnet" | "testnet" =
  process.env.NEXT_PUBLIC_QIE_NETWORK === "testnet" ? "testnet" : "mainnet";

export const IS_MAINNET = NETWORK === "mainnet";

const baseChain = IS_MAINNET ? qieMainnet : qieTestnet;
const rpcOverride = process.env.NEXT_PUBLIC_RPC_URL;

/** The chain the app reads from and asks the wallet to use. */
export const activeChain: Chain = rpcOverride
  ? { ...baseChain, rpcUrls: { default: { http: [rpcOverride] } } }
  : baseChain;

const rawAddress = process.env.NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS ?? "";

export const CONTRACT_ADDRESS: Address | null = isAddress(rawAddress) ? (rawAddress as Address) : null;

const rawRouter = process.env.NEXT_PUBLIC_PACTIQ_ROUTER_ADDRESS ?? "";
/** PactiqRouter: swaps made in the app go through it so they are attributed on-chain. Null = trade on QIEDEX directly. */
export const PACTIQ_ROUTER: Address | null = isAddress(rawRouter) ? (rawRouter as Address) : null;

export const EXPLORER_URL = activeChain.blockExplorers?.default.url ?? "https://mainnet.qie.digital";

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;

/** Parameters for wallet_addEthereumChain, as published in the QIE docs. */
export const addChainParams = {
  chainId: `0x${activeChain.id.toString(16)}`,
  chainName: IS_MAINNET ? "QIEMainnet" : "QIE Testnet",
  nativeCurrency: { name: "QIE", symbol: IS_MAINNET ? "QIEV3" : "QIE", decimals: 18 },
  // The wallet must talk to the same chain the app reads from, including a local or custom RPC.
  rpcUrls: [...activeChain.rpcUrls.default.http],
  blockExplorerUrls: [baseChain.blockExplorers!.default.url],
};

export const QIE_WALLET_URL =
  "https://docs.qie.digital/getting-started-with-qie-blockchain/2.-set-up-a-wallet";
