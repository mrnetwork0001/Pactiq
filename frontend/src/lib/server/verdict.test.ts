import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretVerdict } from "./verdict.ts";

const good = {
  codeSeen: "4821",
  codeVisible: true,
  activityMatches: true,
  appearsAuthentic: true,
  confidence: 0.92,
  detectedFeatures: ["dumbbells", "handwritten note"],
  reasoning: "Gym scene with the code on a note.",
};

test("approves a genuine photo with the right code", () => {
  const j = interpretVerdict(JSON.stringify(good), "4821");
  assert.equal(j.approved, true);
  assert.equal(j.verifier, "ai");
});

test("rejects when the model claims the code is visible but read different digits", () => {
  const j = interpretVerdict(JSON.stringify({ ...good, codeSeen: "4812" }), "4821");
  assert.equal(j.approved, false);
  assert.equal(j.codeVisible, false);
  assert.match(j.reasoning, /4821/);
});

test("rejects inauthentic or off-topic photos and low confidence", () => {
  assert.equal(interpretVerdict(JSON.stringify({ ...good, appearsAuthentic: false }), "4821").approved, false);
  assert.equal(interpretVerdict(JSON.stringify({ ...good, activityMatches: false }), "4821").approved, false);
  assert.equal(interpretVerdict(JSON.stringify({ ...good, confidence: 0.4 }), "4821").approved, false);
});

test("truthy strings are not booleans", () => {
  const j = interpretVerdict(JSON.stringify({ ...good, codeVisible: "true", appearsAuthentic: "yes" }), "4821");
  assert.equal(j.approved, false);
});

test("tolerates prose around the JSON and handles garbage", () => {
  assert.equal(interpretVerdict("Sure! ```json\n" + JSON.stringify(good) + "\n```", "4821").approved, true);
  const bad = interpretVerdict("I cannot help with that", "4821");
  assert.equal(bad.approved, false);
  assert.equal(bad.confidence, 0);
});

test("clamps confidence and caps feature list", () => {
  const j = interpretVerdict(JSON.stringify({ ...good, confidence: 7, detectedFeatures: Array(20).fill("x") }), "4821");
  assert.equal(j.confidence, 1);
  assert.equal(j.detectedFeatures.length, 6);
});
