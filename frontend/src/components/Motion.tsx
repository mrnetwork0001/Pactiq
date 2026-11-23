"use client";

import React, { useEffect, useRef, useState } from "react";

/*
 * Small motion kit for the landing page: scroll reveals, count-ups and an in-view hook.
 * Everything respects prefers-reduced-motion (see the matching rules in globals.css).
 */

type Listener = (visible: boolean) => void;
let observer: IntersectionObserver | null = null;
const listeners = new WeakMap<Element, Listener>();

function sharedObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) listeners.get(e.target)?.(e.isIntersecting);
    },
    // Fire once an element's top passes 92% of the viewport height.
    { rootMargin: "0px 0px -8% 0px", threshold: 0 }
  );
  return observer;
}

/** True once the element has scrolled into view (or, with `once = false`, while it is in view). */
export function useInView<T extends Element>(once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const io = sharedObserver();
    listeners.set(el, (visible) => {
      if (visible && once) {
        io.unobserve(el);
        listeners.delete(el);
      }
      setInView((was) => (once ? was || visible : visible));
    });
    io.observe(el);
    return () => {
      io.unobserve(el);
      listeners.delete(el);
    };
  }, [once]);
  return [ref, inView] as const;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type RevealTag = "div" | "section" | "li" | "ol" | "p" | "span" | "aside";

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({
  as = "div",
  delay = 0,
  className = "",
  id,
  children,
}: {
  as?: RevealTag;
  delay?: number;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return React.createElement(
    as,
    { ref, id, className: `reveal ${inView ? "in" : ""} ${className}`, style: { "--reveal-delay": `${delay}ms` } as React.CSSProperties },
    children
  );
}

const NUMBER = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts the first number in `text` up from zero when it scrolls into view, keeping its prefix,
 * suffix, separators and decimals ("$62", "118.03", "1,204"). Later changes glide to the new value.
 */
export function CountUp({ text, ms = 1400 }: { text: string; ms?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const match = text.match(NUMBER);
  const target = match ? Number(match[2].replace(/,/g, "")) : 0;
  const decimals = match ? (match[2].split(".")[1] ?? "").length : 0;
  const numeric = match !== null;
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (!numeric || !inView) return;
    const from = current.current;
    if (from === target) return;
    const instant = prefersReducedMotion();
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const t = instant ? 1 : Math.min(1, (now - start) / ms);
      const value = from + (target - from) * easeOut(t);
      current.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [inView, target, ms, numeric]);

  if (!match) return <>{text}</>;
  const digits = shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref}>
      <span aria-hidden="true">
        {match[1]}
        {digits}
        {match[3]}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Section heading set like a contract article; its rule draws itself in when the section arrives. */
export function SectionHead({ n, title, aside }: { n: string; title: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Reveal className="relative flex items-baseline gap-3 pb-3 mb-8">
      <span className="font-display italic text-seal text-2xl">{n}</span>
      <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      {aside ? <span className="kicker ml-auto hidden sm:flex items-center gap-2">{aside}</span> : null}
      <span className="draw-rule absolute left-0 right-0 bottom-0 h-px bg-ink" />
    </Reveal>
  );
}

/**
 * Endless strip that scrolls its children right to left. The content is rendered twice so the
 * loop is seamless; the copy is hidden from assistive tech.
 */
export function Marquee({
  seconds = 40,
  gap = "1.5rem",
  className = "",
  children,
}: {
  seconds?: number;
  gap?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`marquee ${className}`} style={{ "--marquee-s": `${seconds}s`, "--marquee-gap": gap } as React.CSSProperties}>
      <div className="marquee-track">
        <div className="marquee-group">{children}</div>
        <div className="marquee-group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
