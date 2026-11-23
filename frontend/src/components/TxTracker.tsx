"use client";

import React, { useCallback, useRef, useState } from "react";
import type { Hash } from "viem";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { explorerTx } from "@/lib/chain";
import { describeError } from "@/lib/pactiq";
import { Button, Kicker, Notice } from "./ui";

/*
 * One progress window for every transaction the app sends: each wallet confirmation is a row that
 * moves from waiting, to "confirm in your wallet", to sent (with its explorer link), to done, and
 * the window ends on a plain success or failure message.
 */

interface Step {
  key: string;
  title: string;
  detail: string;
  /** todo → wallet (waiting for the user to confirm) → pending (sent, waiting for the chain) → done, or error. */
  state: "todo" | "wallet" | "pending" | "done" | "error";
  hash?: Hash;
}

interface Tracked {
  kicker: string;
  title: string;
  steps: Step[];
  outcome: null | { ok: true; message: string } | { ok: false; message: string };
}

export interface StepHandle {
  /** Pass straight to sendTx / sendPactiqTx: records the transaction hash once the wallet has sent it. */
  onSubmitted: (hash: Hash) => void;
}

export interface TrackControls {
  /** Start a step: the one before it is marked done, and this one waits for the wallet. */
  step: (key: string) => StepHandle;
  /** Remove a step that turned out not to be needed (for example an approval that already exists). */
  drop: (key: string) => void;
}

export interface TrackPlan<T> {
  kicker: string;
  title: string;
  steps: { key: string; title: string; detail: string }[];
  /** Does the work. Return the success message (and anything the caller needs back). */
  work: (controls: TrackControls) => Promise<{ message: string; value: T }>;
}

const STATE_LABEL: Record<Step["state"], string> = {
  todo: "Waiting",
  wallet: "Confirm in your wallet",
  pending: "Sent. Waiting for the network…",
  done: "Done",
  error: "Failed",
};

export function useTxTracker() {
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const active = useRef<string | null>(null);

  const patch = (key: string, change: Partial<Step>) =>
    setTracked((t) => (t ? { ...t, steps: t.steps.map((s) => (s.key === key ? { ...s, ...change } : s)) } : t));

  /** Run `plan.work` with the progress window open. Resolves with the work's value; rethrows its error in plain words. */
  const run = useCallback(async <T,>(plan: TrackPlan<T>): Promise<T> => {
    active.current = null;
    setTracked({ kicker: plan.kicker, title: plan.title, steps: plan.steps.map((s) => ({ ...s, state: "todo" })), outcome: null });
    const controls: TrackControls = {
      step: (key) => {
        if (active.current && active.current !== key) patch(active.current, { state: "done" });
        active.current = key;
        patch(key, { state: "wallet" });
        return { onSubmitted: (hash) => patch(key, { state: "pending", hash }) };
      },
      drop: (key) => setTracked((t) => (t ? { ...t, steps: t.steps.filter((s) => s.key !== key) } : t)),
    };
    try {
      const { message, value } = await plan.work(controls);
      if (active.current) patch(active.current, { state: "done" });
      setTracked((t) => (t ? { ...t, outcome: { ok: true, message } } : t));
      return value;
    } catch (e) {
      const message = describeError(e);
      if (active.current) patch(active.current, { state: "error" });
      setTracked((t) => (t ? { ...t, outcome: { ok: false, message } } : t));
      throw new Error(message);
    }
  }, []);

  const close = useCallback(() => setTracked(null), []);
  return { tracked, run, close };
}

export function TxTracker({ tracked, onClose }: { tracked: Tracked | null; onClose: () => void }) {
  if (!tracked) return null;
  const { steps, outcome } = tracked;
  const approved = outcome && !outcome.ok && steps.some((s) => s.key === "approve" && s.state === "done");
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-ink/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={tracked.title}>
      <div className="sheet w-full sm:max-w-lg rounded-t-2xl sm:rounded-md max-h-[92vh] overflow-y-auto animate-rise" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="border-b border-rule px-5 sm:px-8 pt-5 pb-4 flex items-start justify-between gap-4">
          <div>
            <Kicker className="!text-seal">{tracked.kicker}</Kicker>
            <h2 className="font-display text-3xl font-semibold leading-tight mt-1">{tracked.title}</h2>
          </div>
          {outcome && (
            <button type="button" onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink cursor-pointer mt-1">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-5 sm:px-8 py-6 space-y-5" aria-live="polite">
          <ol className="space-y-3">
            {steps.map((st, i) => {
              const tone = st.state === "done" ? "border-kept text-kept" : st.state === "error" ? "border-seal text-seal" : st.state === "todo" ? "border-rule text-ink-3" : "border-quill text-quill";
              return (
                <li key={st.key} className={`flex items-start gap-3 border rounded-md p-4 ${st.state === "todo" ? "border-rule opacity-60" : st.state === "error" ? "border-seal bg-seal/5" : "border-rule"}`}>
                  <span className={`w-8 h-8 shrink-0 rounded-full border-2 grid place-items-center ${tone}`}>
                    {st.state === "done" ? (
                      <Check className="w-4 h-4" strokeWidth={3} />
                    ) : st.state === "error" ? (
                      <X className="w-4 h-4" strokeWidth={3} />
                    ) : st.state === "wallet" || st.state === "pending" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="num text-xs font-bold">{i + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-semibold">{st.title}</p>
                      <p className={`text-xs font-semibold ${tone.split(" ")[1]}`}>{STATE_LABEL[st.state]}</p>
                    </div>
                    <p className="text-sm text-ink-2 mt-0.5">{st.detail}</p>
                    {st.hash && (
                      <a href={explorerTx(st.hash)} target="_blank" rel="noreferrer" className="num text-xs text-quill underline inline-flex items-center gap-1 mt-1.5">
                        Transaction {st.hash.slice(0, 10)}…{st.hash.slice(-6)} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {outcome === null && <p className="text-xs text-ink-3 text-center">Keep this window open. Each step needs your confirmation in the wallet.</p>}

          {outcome?.ok && (
            <>
              <Notice tone="kept">{outcome.message}</Notice>
              <Button variant="ink" className="w-full" onClick={onClose}>
                Done
              </Button>
            </>
          )}

          {outcome && !outcome.ok && (
            <>
              <Notice>
                <strong>It didn&apos;t go through.</strong> {outcome.message}
                {approved && " The approval went through, so you won't need to approve again for this amount."}
              </Notice>
              <Button variant="seal" className="w-full" onClick={onClose}>
                Back
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
