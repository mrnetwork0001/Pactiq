"use client";

import React, { useEffect, useState } from "react";
import { Camera, CheckCircle2, AlertCircle, Loader2, ExternalLink, XCircle, RotateCcw } from "lucide-react";
import confetti from "canvas-confetti";
import { BigStamp, Button, CONFETTI, Kicker, Notice, Sheet, btn } from "./ui";
import type { Address } from "viem";
import { explorerTx } from "@/lib/chain";
import { profileUrl } from "@/lib/share";
import { ShareButtons } from "./ShareButtons";
import type { ChallengeResponse, PactWithDays, VerifyProofResponse } from "@/lib/types";

interface CheckInModalProps {
  target: { pact: PactWithDays; day: number } | null;
  userAddress: Address | null;
  onClose: () => void;
  onSubmit: (
    pact: PactWithDays,
    day: number,
    proofHash: `0x${string}`,
    signature: `0x${string}`,
    onSubmitted: (hash: string) => void
  ) => Promise<string>;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ target, ...rest }) => {
  if (!target) return null;
  return <CheckInFlow key={`${target.pact.id}:${target.day}`} pact={target.pact} day={target.day} {...rest} />;
};

type Step = "LOADING" | "READY" | "VERIFYING" | "REJECTED" | "APPROVED" | "SIGNING" | "CONFIRMING" | "DONE";

/** Downscale to ≤1280px JPEG so uploads are small and EXIF is stripped. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function CheckInFlow({
  pact,
  day,
  userAddress,
  onClose,
  onSubmit,
}: Omit<CheckInModalProps, "target"> & { pact: PactWithDays; day: number }) {
  const [step, setStep] = useState<Step>("LOADING");
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerifyProofResponse | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) return;
    const q = new URLSearchParams({ pactId: String(pact.id), dayIndex: String(day), userAddress });
    fetch(`/api/challenge?${q}`)
      .then(async (r) => {
        const data = (await r.json()) as ChallengeResponse;
        if (!r.ok) throw new Error(data.error || "Could not load today's challenge");
        setChallenge(data);
        setStep("READY");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load today's challenge"));
  }, [pact.id, day, userAddress]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setImage(await compressImage(file));
      setVerdict(null);
      setStep("READY");
    } catch {
      setError("Couldn't read that image. Try a JPEG or PNG.");
    }
  };

  const verify = async () => {
    if (!image || !userAddress) return;
    setStep("VERIFYING");
    setError(null);
    try {
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pactId: pact.id, dayIndex: day, userAddress, image }),
      });
      const data = (await res.json()) as VerifyProofResponse;
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setVerdict(data);
      setStep(data.verified && data.signature ? "APPROVED" : "REJECTED");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setStep("READY");
    }
  };

  const submit = async () => {
    if (!verdict?.proofHash || !verdict.signature) return;
    setStep("SIGNING");
    setError(null);
    try {
      const hash = await onSubmit(pact, day, verdict.proofHash, verdict.signature, (h) => {
        setTxHash(h);
        setStep("CONFIRMING");
      });
      setTxHash(hash);
      setStep("DONE");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: CONFETTI });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setStep("APPROVED");
    }
  };

  const shownError = userAddress ? error : "Connect your wallet first.";
  const busy = step === "VERIFYING" || step === "SIGNING" || step === "CONFIRMING";

  return (
    <Sheet
      kicker={`Day ${day} of ${pact.totalDays} · Pact Nº ${String(pact.id).padStart(4, "0")}`}
      title={pact.title}
      subtitle="Present today's proof. An AI witness checks it before the chain records it."
      onClose={onClose}
      locked={busy}
    >
      <div className="space-y-6">
        <div className="relative border-2 border-ink rounded-md bg-paper/60 overflow-hidden">
          <div className="perforated h-2.5 absolute top-0 inset-x-0" />
          <div className="px-5 pt-6 pb-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="shrink-0">
              <Kicker className="!text-seal">Today&apos;s code</Kicker>
              {challenge ? (
                <div className="num text-5xl font-semibold tracking-[0.25em] mt-1">{challenge.code}</div>
              ) : (
                !shownError && <Loader2 className="w-6 h-6 animate-spin mt-3 text-ink-3" />
              )}
            </div>
            <p className="text-sm text-ink-2 leading-relaxed sm:border-l sm:border-dashed sm:border-rule sm:pl-4">
              {challenge?.instruction ?? "Fetching your one-time code for today…"}
            </p>
          </div>
        </div>

        {step !== "LOADING" && (
          <div>
            {image ? (
              <div className="relative rounded-md overflow-hidden border border-rule bg-paper-2 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Your proof photo" className={`w-full object-contain max-h-72 ${step === "DONE" ? "opacity-80" : ""}`} />
                {!busy && step !== "APPROVED" && step !== "DONE" && (
                  <label className={btn("outline", "sm", "absolute bottom-3 right-3")}>
                    Retake
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                  </label>
                )}
                {step === "DONE" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BigStamp text="Verified" className="text-5xl bg-card/60" />
                  </div>
                )}
              </div>
            ) : (
              <label className="border-2 border-dashed border-ink-3 hover:border-ink rounded-md px-6 py-10 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                <Camera className="w-8 h-8 text-seal mb-3" />
                <span className="font-display text-xl font-semibold">Photograph your proof</span>
                <span className="text-sm text-ink-2 mt-1">The code must be clearly readable next to the activity.</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
              </label>
            )}
          </div>
        )}

        {verdict && (
          <div className={`border-l-4 pl-4 py-1 ${verdict.verified ? "border-kept" : "border-seal"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <Kicker className={verdict.verified ? "!text-kept" : "!text-seal"}>Witness report · {verdict.verified ? "approved" : "rejected"}</Kicker>
              <span className="num text-[11px] text-ink-3">
                {verdict.verifier === "demo" ? "demo verifier" : `confidence ${(verdict.confidence * 100).toFixed(0)}%`}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              <Check ok={verdict.checks.codeVisible} label="Today's code is visible" />
              <Check ok={verdict.checks.activityMatches} label="The activity matches the pact" />
              <Check ok={verdict.checks.appearsAuthentic} label="The photo looks authentic" />
            </ul>
            {verdict.reasoning && <p className="font-display italic text-ink-2 mt-3 leading-relaxed">&ldquo;{verdict.reasoning}&rdquo;</p>}
            {!verdict.verified && (
              <p className="text-xs text-ink-3 mt-2">
                {verdict.attemptsLeft} attempt{verdict.attemptsLeft === 1 ? "" : "s"} left today.
              </p>
            )}
          </div>
        )}

        {shownError && (
          <Notice>
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {shownError}
            </span>
          </Notice>
        )}

        {(step === "READY" || step === "REJECTED") && (
          <Button
            variant="ink"
            size="lg"
            className="w-full"
            onClick={verify}
            disabled={!image || !challenge || (step === "REJECTED" && verdict?.attemptsLeft === 0)}
          >
            {step === "REJECTED" ? <RotateCcw className="w-4 h-4" /> : null}
            {step === "REJECTED" ? "Retake the photo, then ask again" : "Ask the AI witness"}
          </Button>
        )}

        {step === "VERIFYING" && <StatusBar text="The witness is examining your photo…" />}

        {step === "APPROVED" && (
          <Button variant="seal" size="lg" className="w-full" onClick={submit}>
            Stamp day {day} on QIE
          </Button>
        )}

        {step === "SIGNING" && <StatusBar text="Confirm the transaction in your wallet…" />}
        {step === "CONFIRMING" && <StatusBar text="Waiting for QIE to confirm…" />}

        {step === "DONE" && (
          <div className="space-y-4">
            <p className="font-display text-xl text-center">
              Day {day} is on the record. <span className="italic text-ink-2">See you tomorrow.</span>
            </p>
            {userAddress && (
              <ShareButtons
                text={`Day ${day}/${pact.totalDays} of "${pact.title}" kept. AI-verified and staked on QIE with Pactiq.`}
                url={profileUrl(userAddress)}
              />
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {txHash && (
          <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs text-quill hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> View transaction
          </a>
        )}
      </div>
    </Sheet>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-ink" : "text-seal"}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 text-kept shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      {label}
    </li>
  );
}

function StatusBar({ text }: { text: string }) {
  return (
    <div className="w-full py-3.5 px-4 rounded-md border-2 border-dashed border-ink text-sm font-semibold flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      {text}
    </div>
  );
}
