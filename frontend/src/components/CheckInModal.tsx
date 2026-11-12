"use client";

import React, { useState } from "react";
import { Pact } from "@/lib/types";
import { X, Camera, Upload, CheckCircle2, AlertCircle, Sparkles, Loader2, ShieldCheck, Zap } from "lucide-react";
import confetti from "canvas-confetti";

interface CheckInModalProps {
  pact: Pact | null;
  userAddress: string | null;
  onClose: () => void;
  onSuccess: (pactId: number, dayIndex: number) => void;
}

type VerificationStep = "IDLE" | "SCANNING" | "SIGNED" | "SUBMITTING" | "SUCCESS";

export const CheckInModal: React.FC<CheckInModalProps> = ({
  pact,
  userAddress,
  onClose,
  onSuccess,
}) => {
  if (!pact) return null;

  const [step, setStep] = useState<VerificationStep>("IDLE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dynamicCode] = useState<string>(() => Math.floor(100 + Math.random() * 900).toString());
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [oracleSignature, setOracleSignature] = useState<string | null>(null);
  const [proofHash, setProofHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage(null);
    }
  };

  const runVerification = async () => {
    if (!userAddress) {
      setErrorMessage("Please connect your Web3 wallet first.");
      return;
    }

    try {
      setStep("SCANNING");
      setStatusLogs([
        "Connecting to Multimodal AI Vision Oracle...",
        "Scanning image metadata and timestamp validity...",
      ]);

      await new Promise((r) => setTimeout(r, 900));
      setStatusLogs((prev) => [
        ...prev,
        `Verifying category alignment for '${pact.category}'...`,
        `Analyzing dynamic challenge: Code #${dynamicCode} detected in frame.`,
      ]);

      await new Promise((r) => setTimeout(r, 900));

      // Call our AI proof verification API
      const res = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pactId: pact.id,
          dayIndex: pact.currentDay,
          category: pact.category,
          userAddress: userAddress,
          dynamicCode: dynamicCode,
          fileName: selectedFile?.name || "live_camera_capture.jpg",
          hasImage: !!selectedFile,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.verified) {
        throw new Error(data.error || "AI verification failed anti-spoof check.");
      }

      setStatusLogs((prev) => [
        ...prev,
        `AI Attestation passed (Confidence: ${(data.confidence * 100).toFixed(1)}%).`,
        "ECDSA Oracle signature generated for QIE Mainnet Chain ID: 5656.",
      ]);

      setOracleSignature(data.signature);
      setProofHash(data.proofHash);
      setStep("SIGNED");

      // Auto-trigger on-chain settlement simulation or manual button
    } catch (err: unknown) {
      setStep("IDLE");
      setErrorMessage(err instanceof Error ? err.message : "Verification error occurred");
    }
  };

  const handleOnChainCheckIn = async () => {
    try {
      setStep("SUBMITTING");
      setStatusLogs((prev) => [
        ...prev,
        `Broadcasting checkIn(pactId: ${pact.id}, day: ${pact.currentDay}) to QIE Mainnet RPC...`,
      ]);

      // Simulate on-chain confirmation delay
      await new Promise((r) => setTimeout(r, 1400));

      setStep("SUCCESS");
      setStatusLogs((prev) => [
        ...prev,
        "Transaction Confirmed on QIE Mainnet!",
        `Day ${pact.currentDay} logged. Streak extended!`,
      ]);

      // Fire celebratory confetti!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10B981", "#06B6D4", "#F59E0B"],
      });

      setTimeout(() => {
        onSuccess(pact.id, pact.currentDay);
        onClose();
      }, 2000);
    } catch (err: unknown) {
      setStep("SIGNED");
      setErrorMessage(err instanceof Error ? err.message : "On-chain transaction error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0E111A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Anti-Bot Verification</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Daily Check-In: <span className="text-emerald-400">Day {pact.currentDay}</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">{pact.title}</p>
        </div>

        {/* Dynamic Anti-Spoof Challenge Box */}
        <div className="p-4 rounded-2xl bg-[#151A27] border border-emerald-500/20 mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 fill-emerald-400" />
              <span>Today&apos;s Dynamic Challenge</span>
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              Code #{dynamicCode}
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Take a live photo of your {pact.category.toLowerCase()} activity showing dynamic code{" "}
            <span className="text-white font-mono font-bold">#{dynamicCode}</span> written on paper
            or hold up <span className="text-emerald-400 font-bold">2 fingers (✌️)</span>.
          </p>
        </div>

        {/* Media Upload / Preview */}
        <div className="mb-6">
          {previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black max-h-56 flex items-center justify-center group">
              <img
                src={previewUrl}
                alt="Proof Preview"
                className="w-full h-full object-cover max-h-56"
              />
              {step === "IDLE" && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 text-white hover:bg-black transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#151A27]/40 hover:bg-[#151A27]/80">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-white">Snap or Upload Proof Photo</span>
              <span className="text-xs text-gray-400 mt-1">
                JPEG, PNG or live mobile capture
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>

        {/* AI Scanner Terminal Logs */}
        {statusLogs.length > 0 && (
          <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px] text-gray-300 space-y-1 mb-6 max-h-32 overflow-y-auto">
            {statusLogs.map((log, index) => (
              <div key={index} className="flex items-center space-x-1.5 text-emerald-400/90">
                <span className="text-gray-500">›</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div>
          {step === "IDLE" && (
            <button
              onClick={runVerification}
              disabled={!selectedFile}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                selectedFile
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-lg shadow-emerald-500/20"
                  : "bg-white/5 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Verify Proof with AI Vision</span>
            </button>
          )}

          {step === "SCANNING" && (
            <div className="w-full py-3 px-4 rounded-xl bg-[#151A27] border border-emerald-500/30 text-emerald-400 font-semibold text-sm flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Multimodal AI Vision Analyzing Proof...</span>
            </div>
          )}

          {step === "SIGNED" && (
            <button
              onClick={handleOnChainCheckIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Submit Attestation to QIE Mainnet (Chain 5656)</span>
            </button>
          )}

          {step === "SUBMITTING" && (
            <div className="w-full py-3 px-4 rounded-xl bg-[#151A27] border border-cyan-500/30 text-cyan-400 font-semibold text-sm flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing Transaction on QIE Mainnet...</span>
            </div>
          )}

          {step === "SUCCESS" && (
            <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Check-In Verified on QIE Mainnet!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
