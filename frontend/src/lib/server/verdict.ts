/**
 * Pure pass/fail rules for the AI verifier. No imports, so it can be unit-tested with plain Node:
 *   node --test src/lib/server/verdict.test.ts
 */
export interface Judgement {
  verifier: "ai" | "demo";
  approved: boolean;
  confidence: number;
  codeVisible: boolean;
  activityMatches: boolean;
  appearsAuthentic: boolean;
  detectedFeatures: string[];
  reasoning: string;
}

/** Parse the model's JSON and apply Pactiq's own pass rules (never trust a single boolean). */
export function interpretVerdict(text: string, code: string): Judgement {
  let raw: Record<string, unknown> = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    raw = JSON.parse(match ? match[0] : text);
  } catch {
    return {
      verifier: "ai",
      approved: false,
      confidence: 0,
      codeVisible: false,
      activityMatches: false,
      appearsAuthentic: false,
      detectedFeatures: [],
      reasoning: "The verifier couldn't read this photo. Please try a clearer one.",
    };
  }
  const digits = String(raw.codeSeen ?? "").replace(/\D/g, "");
  const codeVisible = raw.codeVisible === true && digits.includes(code);
  const activityMatches = raw.activityMatches === true;
  const appearsAuthentic = raw.appearsAuthentic === true;
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const detectedFeatures = Array.isArray(raw.detectedFeatures)
    ? raw.detectedFeatures.filter((f): f is string => typeof f === "string").slice(0, 6)
    : [];
  const approved = codeVisible && activityMatches && appearsAuthentic && confidence >= 0.6;

  let reasoning = typeof raw.reasoning === "string" ? raw.reasoning.slice(0, 300) : "";
  if (!approved && !codeVisible) reasoning = `Code ${code} wasn't clearly readable. ${reasoning}`.trim();
  return { verifier: "ai", approved, confidence, codeVisible, activityMatches, appearsAuthentic, detectedFeatures, reasoning };
}
