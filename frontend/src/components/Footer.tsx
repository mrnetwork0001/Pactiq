import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  activeChain,
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  QIE_BRIDGE_URL,
  QIE_BUY_URL,
  QIE_ECOSYSTEM,
  QIE_ID_URL,
  QIE_USD_FEED,
  QIE_WALLET_URL,
  QIEDEX_URL,
  explorerAddress,
} from "@/lib/chain";
import { Wordmark } from "./Header";

interface Item {
  label: string;
  href: string;
  /** Small grey note after the label. */
  note?: string;
  external?: boolean;
}

const COLUMNS: { title: string; items: Item[] }[] = [
  {
    title: "Product",
    items: [
      { label: "Open the app", href: "/app" },
      { label: "Sign a pact", href: "/app#new" },
      { label: "Swap QIE and QUSDC", href: "/app#swap" },
      { label: "Squads & challenges", href: "/app#squads" },
      { label: "The register", href: "/app#register" },
      { label: "Launch campaign", note: "200 QIE", href: "/launch" },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Why Pactiq", href: "/#why" },
      { label: "How it works", href: "/#terms" },
      { label: "For builders", href: "/#builders" },
      { label: "Get QIE", href: QIE_BUY_URL, external: true },
      { label: "Bridge to QIE", href: QIE_BRIDGE_URL, external: true },
    ],
  },
  {
    title: "Built on QIE",
    items: [
      { label: "QIE Wallet", note: "sign & stake", href: QIE_WALLET_URL, external: true },
      { label: "QUSDC", note: "stablecoin stakes", href: explorerAddress(QIE_ECOSYSTEM.qusdc), external: true },
      { label: "QIEDEX", note: "in-app swaps", href: QIEDEX_URL, external: true },
      { label: "QIE Oracle", note: "dollar pricing", href: explorerAddress(QIE_USD_FEED), external: true },
      { label: "QIE ID", note: ".qie names", href: QIE_ID_URL, external: true },
    ],
  },
];

function FooterLink({ item }: { item: Item }) {
  const inner = (
    <>
      <span className="footer-link-label">{item.label}</span>
      {item.note && <span className="text-ink-3"> · {item.note}</span>}
      {item.external && <ArrowUpRight className="footer-link-arrow w-3 h-3" />}
    </>
  );
  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className="footer-link">
      {inner}
    </a>
  ) : (
    <Link href={item.href} className="footer-link">
      {inner}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t-2 border-ink bg-card">
      <div className="max-w-[calc(50vw_+_600px)] mx-auto px-4 sm:px-6">
        <div className="grid gap-x-8 gap-y-12 pt-14 pb-12 grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 md:pr-8">
            <Wordmark size={36} />
            <p className="text-ink-2 mt-4 max-w-xs leading-relaxed">
              A proof-of-discipline protocol. Real humans, real habits, real money, verified one day at a time.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/app#new" className="btn btn-seal text-xs px-3 py-1.5">
                Sign your first pact
              </Link>
              <div className="inline-flex items-center gap-2 border border-rule rounded-full pl-2.5 pr-3 py-1.5 text-xs text-ink-2">
                <span className="live-dot" />
                <span>
                  Live on {activeChain.name} · chain <span className="num">{activeChain.id}</span>
                </span>
              </div>
            </div>
          </div>

          {COLUMNS.map((col, i) => (
            <nav key={col.title} aria-label={col.title} className={i === COLUMNS.length - 1 ? "col-span-2 md:col-span-1" : undefined}>
              <h2 className="kicker !text-ink mb-4 pb-2 border-b border-rule">{col.title}</h2>
              <ul className="space-y-2.5 text-sm">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <FooterLink item={item} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* On-chain record: the contract is the product, so it gets its own line. */}
        <div className="border-t border-rule py-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-ink-2">
          <span className="kicker !text-[10px]">On the record</span>
          {CONTRACT_ADDRESS && (
            <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="footer-link">
              <span className="text-ink-3">Vault contract</span>{" "}
              <span className="num footer-link-label">
                {CONTRACT_ADDRESS.slice(0, 8)}…{CONTRACT_ADDRESS.slice(-6)}
              </span>
              <ArrowUpRight className="footer-link-arrow w-3 h-3" />
            </a>
          )}
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="footer-link">
            <span className="footer-link-label">Block explorer</span>
            <ArrowUpRight className="footer-link-arrow w-3 h-3" />
          </a>
          <span>Stakes are held by the contract, never by Pactiq.</span>
        </div>

        <div
          className="border-t border-ink pt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-xs text-ink-2"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <span>© 2026 Pactiq · Built for QIE Hackathon 3.0</span>
          <span className="order-3 w-full md:order-none md:w-auto text-ink-3">Missed days are forfeited. Only stake what you can afford to lose.</span>
          <span className="flex items-center gap-5">
            <Link href="/terms" className="footer-link">
              <span className="footer-link-label">Terms</span>
            </Link>
            <Link href="/privacy" className="footer-link">
              <span className="footer-link-label">Privacy</span>
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
