import { activeChain, addChainParams } from "./chain";

/** Minimal EIP-1193 provider surface. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: never[]) => void): void;
  removeListener?(event: string, listener: (...args: never[]) => void): void;
}

export interface WalletOption {
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    qie?: Eip1193Provider;
    ethereum?: Eip1193Provider;
  }
}

export const QIE_WALLET_RDNS = "me.qiewallet";

/**
 * Discover injected wallets via EIP-6963, then fall back to window.qie / window.ethereum.
 * QIE Wallet is listed first when present.
 */
export function discoverWallets(timeoutMs = 350): Promise<WalletOption[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const found = new Map<string, WalletOption>();
    const onAnnounce = (event: Event) => {
      const { info, provider } = (event as CustomEvent<Eip6963Detail>).detail;
      if (!found.has(info.rdns)) found.set(info.rdns, { name: info.name, icon: info.icon, rdns: info.rdns, provider });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const list = [...found.values()];
      const known = new Set(list.map((w) => w.provider));
      if (window.qie && !known.has(window.qie)) {
        list.push({ name: "QIE Wallet", rdns: QIE_WALLET_RDNS, provider: window.qie });
      }
      // Generic fallback only when no wallet announced itself: with several installed, window.ethereum is
      // just one of them again under a wrapper, and listing it as "Browser Wallet" is a confusing duplicate.
      if (list.length === 0 && window.ethereum) {
        list.push({ name: "Browser Wallet", provider: window.ethereum });
      }
      list.sort((a, b) => Number(b.rdns === QIE_WALLET_RDNS) - Number(a.rdns === QIE_WALLET_RDNS));
      resolve(list);
    }, timeoutMs);
  });
}

export async function getChainId(provider: Eip1193Provider): Promise<number> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

/** The wallet doesn't know the network yet. EIP-3326 says code 4902, but wallets report it differently. */
function isUnknownChain(err: unknown) {
  const e = err as { code?: number; message?: string; data?: { originalError?: { code?: number } } };
  if (e?.code === 4902 || e?.data?.originalError?.code === 4902) return true;
  return /unrecogni[sz]ed chain|unknown chain|not been added|try adding the chain|wallet_addEthereumChain/i.test(e?.message ?? "");
}

/** Switch the wallet to the app's QIE network. If the wallet doesn't have it, ask to add it, then switch. */
export async function ensureQieChain(provider: Eip1193Provider): Promise<void> {
  if ((await getChainId(provider)) === activeChain.id) return;
  const switchChain = () => provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: addChainParams.chainId }] });
  try {
    await switchChain();
  } catch (err) {
    if (!isUnknownChain(err)) throw err;
    await provider.request({ method: "wallet_addEthereumChain", params: [addChainParams] });
    // Most wallets switch as part of adding; some only add.
    if ((await getChainId(provider)) !== activeChain.id) await switchChain();
  }
}
