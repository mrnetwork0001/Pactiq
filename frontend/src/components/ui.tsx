"use client";

import React, { useEffect, useId } from "react";
import { X } from "lucide-react";
import { BADGE_TIERS } from "@/lib/types";

/** Confetti in the stamp inks. */
export const CONFETTI = ["#d13c1f", "#1d6a46", "#9c6f12", "#2a45a3", "#17140f"];

/* ------------------------------------------------------------------ buttons */

type Variant = "ink" | "seal" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-5 py-3.5",
};

export const btn = (variant: Variant = "ink", size: Size = "md", extra = "") => `btn btn-${variant} ${SIZES[size]} ${extra}`;

export function Button({
  variant = "ink",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={btn(variant, size, className)} />;
}

/* ------------------------------------------------------------------ type */

export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`kicker ${className}`}>{children}</div>;
}

/** Section heading with a roman numeral, set like a contract article. */
export function Article({ n, title, children }: { n: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-ink pb-3 mb-6">
      <div className="flex items-baseline gap-3">
        <span className="font-display italic text-seal text-2xl">{n}</span>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** A labelled figure in a ledger row. */
export function Figure({
  label,
  value,
  sub,
  tone = "ink",
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ink" | "seal" | "kept" | "gold" | "quill";
  size?: "sm" | "md" | "lg";
}) {
  const color = { ink: "text-ink", seal: "text-seal", kept: "text-kept", gold: "text-gold", quill: "text-quill" }[tone];
  const text = { sm: "text-base", md: "text-xl sm:text-2xl", lg: "text-2xl sm:text-4xl" }[size];
  return (
    <div className="min-w-0">
      <div className="kicker !text-[10px] mb-1 truncate">{label}</div>
      <div className={`num font-medium ${text} ${color} truncate leading-tight`}>{value}</div>
      {sub ? <div className="text-[11px] text-ink-3 mt-0.5 truncate">{sub}</div> : null}
    </div>
  );
}

export function Notice({ tone = "seal", children }: { tone?: "seal" | "kept" | "quill"; children: React.ReactNode }) {
  const c = {
    seal: "border-seal text-seal-dark bg-seal/5",
    kept: "border-kept text-kept bg-kept/5",
    quill: "border-quill text-quill bg-quill/5",
  }[tone];
  return <div className={`border-l-[3px] px-3 py-2 text-xs leading-relaxed ${c}`}>{children}</div>;
}

/* ------------------------------------------------------------------ modal */

export function Sheet({
  kicker,
  title,
  subtitle,
  onClose,
  locked = false,
  wide = false,
  children,
}: {
  kicker: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  locked?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !locked && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/45 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-xl"} sheet rounded-t-xl sm:rounded-lg max-h-[94dvh] overflow-y-auto overscroll-contain animate-rise`}
      >
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-rule px-5 sm:px-8 pt-5 pb-4">
          <button
            onClick={onClose}
            disabled={locked}
            className="absolute top-4 right-4 p-2 rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 cursor-pointer disabled:opacity-30"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <Kicker className="!text-seal">{kicker}</Kicker>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mt-1 pr-10 break-words leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
        </div>
        <div className="px-5 sm:px-8 pt-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A numbered clause inside a form. */
export function Clause({ n, label, hint, children }: { n: number; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-2">
      <span className="font-display text-seal text-lg leading-6">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold mb-2 leading-6">
          {label}
          {hint && <span className="font-normal text-ink-3"> · {hint}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-ink-2">{label}</span>
      <span className="flex-1 border-b border-dotted border-rule translate-y-[-3px] mx-1 min-w-4" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ stamps */

export type DayKind = "done" | "open" | "missed" | "future";

/** One day in a pact's ledger, inked like a rubber stamp. */
export function DayStamp({ day, kind, size = 30 }: { day: number; kind: DayKind; size?: number }) {
  const base = "relative inline-flex items-center justify-center rounded-full num text-[10px] font-semibold select-none";
  const style = { width: size, height: size };
  const rot = ((day * 37) % 15) - 7; // deterministic wobble so the row looks hand-stamped
  if (kind === "done")
    return (
      <span title={`Day ${day}: verified`} className={`${base} text-kept border-2 border-kept`} style={{ ...style, transform: `rotate(${rot}deg)` }}>
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto w-[62%] h-[62%] opacity-25" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="relative">{day}</span>
      </span>
    );
  if (kind === "missed")
    return (
      <span title={`Day ${day}: missed`} className={`${base} text-seal border-2 border-seal/70 border-dashed`} style={{ ...style, transform: `rotate(${rot}deg)` }}>
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto w-[55%] h-[55%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </span>
    );
  if (kind === "open")
    return (
      <span title={`Day ${day}: open now`} className={`${base} open-day text-ink border-2 border-dashed border-ink bg-seal/10`} style={style}>
        {day}
      </span>
    );
  return (
    <span title={`Day ${day}`} className={`${base} text-ink-3 border border-rule`} style={style}>
      {day}
    </span>
  );
}

/** A large rotated stamp laid over a finished document. */
export function BigStamp({ text, tone = "kept", className = "" }: { text: string; tone?: "kept" | "seal"; className?: string }) {
  const c = tone === "kept" ? "text-kept border-kept" : "text-seal border-seal";
  return (
    <span
      className={`pointer-events-none inline-block border-[3px] ${c} rounded-md px-3 py-1 font-display font-black uppercase tracking-[0.12em] text-2xl animate-stamp mix-blend-multiply opacity-80 ${className}`}
      style={{ ["--stamp-rot" as string]: "-9deg", boxShadow: "inset 0 0 0 2px var(--color-card)" }}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ wax seals */

function scallop(cx: number, cy: number, r: number, bumps: number, depth: number) {
  const pts: string[] = [];
  const steps = bumps * 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r - depth * (0.5 - 0.5 * Math.cos(a * bumps));
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
const SEAL_PATH = scallop(50, 50, 48, 18, 4);

/** Soulbound badge as a wax seal; unearned tiers are a blind emboss. */
export function Seal({ tier, earned, size = 44 }: { tier: number; earned: boolean; size?: number }) {
  const t = BADGE_TIERS[tier];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${t.name} — ${t.days}-day streak${earned ? "" : " (locked)"}`}
      className="shrink-0"
      style={{ transform: `rotate(${tier * 11 - 8}deg)` }}
    >
      <title>{`${t.name} — ${t.days}-day verified streak${earned ? "" : " (locked)"}`}</title>
      <path d={SEAL_PATH} fill={earned ? t.color : "transparent"} stroke={earned ? "none" : "var(--color-rule)"} strokeWidth="2" strokeDasharray={earned ? undefined : "4 3"} />
      <circle cx="50" cy="50" r="33" fill="none" stroke={earned ? "rgba(255,255,255,0.45)" : "var(--color-rule)"} strokeWidth="1.5" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontWeight="800"
        fontSize={t.days >= 100 ? 26 : 32}
        fill={earned ? "#fbf8f2" : "var(--color-ink-3)"}
      >
        {t.days}
      </text>
      <text x="50" y="73" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="8" letterSpacing="1.5" fill={earned ? "rgba(255,255,255,0.8)" : "var(--color-ink-3)"}>
        DAYS
      </text>
    </svg>
  );
}

export function SealRow({ mask, showLocked = false, size = 26 }: { mask: number; showLocked?: boolean; size?: number }) {
  const tiers = BADGE_TIERS.map((t, i) => ({ i, earned: (mask & t.bit) !== 0 })).filter((t) => showLocked || t.earned);
  if (tiers.length === 0) return null;
  return (
    <span className="inline-flex items-center -space-x-1">
      {tiers.map((t) => (
        <Seal key={t.i} tier={t.i} earned={t.earned} size={size} />
      ))}
    </span>
  );
}

/** The outline of the Pactiq flame, on a 100×100 grid. */
export const FLAME_PATH = "M54 3C60 22 85 36 85 62a35 35 0 0 1-70 0C15 50 23 41 31 33.5C31.500 41 36 46.500 43.500 47C41 32 46 15 54 3Z";

/**
 * The Pactiq mark: a streak flame cut into the seven days of a week. Days kept are ink, the
 * recent run burns red, and today sits on top in gold.
 */
export function Mark({ size = 34 }: { size?: number }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <clipPath id={clip}>
        <path d={FLAME_PATH} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect y="0" width="100" height="27" fill="var(--color-gold)" />
        <rect y="30" width="100" height="9.5" fill="var(--color-seal)" />
        <rect y="42.5" width="100" height="9.5" fill="var(--color-seal)" />
        <rect y="55" width="100" height="9.5" fill="var(--color-seal)" />
        <rect y="67.5" width="100" height="9.5" fill="var(--color-ink)" />
        <rect y="80" width="100" height="8.5" fill="var(--color-ink)" />
        <rect y="91.5" width="100" height="9" fill="var(--color-ink)" />
      </g>
    </svg>
  );
}

/** Wallet names rendered as an ink signature above the printed name. */
export function Signature({ name, caption }: { name: string; caption?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-sign text-quill text-3xl leading-none -mb-1 truncate" style={{ transform: "rotate(-3deg)", transformOrigin: "left" }}>
        {name}
      </div>
      <div className="border-t border-ink/60 pt-1 kicker !text-[10px] truncate">{caption ?? name}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ mobile navigation */

/** Three-line menu button that animates to an ×. Only visible at ≤ 900px (see .burger in globals.css). */
export function Burger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className={`burger ${open ? "open" : ""}`}>
      <span />
      <span />
      <span />
    </button>
  );
}

/**
 * Left drawer for phones and tablets. Closes on backdrop tap, Esc and the close button; callers
 * close it after navigation. Render it outside the sticky header: the header's backdrop blur would
 * otherwise become the drawer's containing block.
 */
export function Drawer({
  open,
  onClose,
  head,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  head: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onClose} className={`drawer-backdrop ${open ? "show" : ""}`} />
      <aside role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open} inert={!open} className={`drawer ${open ? "open" : ""}`}>
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-ink shrink-0">
          {head}
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-2.5 -mr-2 rounded-md text-ink-2 hover:text-ink hover:bg-paper-2 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 pt-4 border-t border-rule drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

/** Smooth-scroll to an in-page section after a drawer closes (body scroll is locked while it's open). */
export function scrollToSection(id: string) {
  setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }, 60);
}
