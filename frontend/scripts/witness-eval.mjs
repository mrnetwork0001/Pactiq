#!/usr/bin/env node
/**
 * Runs a folder of real photos through the AI witness, with the same prompt, model and pass
 * rules as the live check-in route, and reports wrong verdicts.
 *
 *   pnpm witness:eval [folder] [--runs 3]        (default folder: ./witness-photos)
 *
 * Name each photo  <expected>-<category>-<code>[-anything].jpg
 *   expected   pass = genuine proof that should be approved, fail = should be rejected
 *   category   fitness | coding | learning | mindfulness | custom
 *   code       the four digits written in the photo (for a "fail" photo with no code, use the
 *              code the witness would be asking for, e.g. 0000)
 * Examples:  pass-fitness-4821-gym.jpg   pass-coding-3310-dim-room.heic   fail-learning-7742-screenshot.png
 *
 * Photos are resized to 1280px JPEG first, as the app does. Needs LLM_API_KEY (or GEMINI_API_KEY)
 * in .env.local. Each photo costs one model call per run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local without overriding anything already set in the shell.
const envFile = resolve(here, "../.env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const { judgePhoto, witnessConfigured, witnessModel } = await import("../src/lib/server/witness.ts");

const args = process.argv.slice(2);
const runsAt = args.indexOf("--runs");
const runs = runsAt >= 0 ? Math.max(1, Number(args[runsAt + 1]) || 1) : 1;
const folder = resolve(args.find((a, i) => !a.startsWith("--") && (runsAt < 0 || i !== runsAt + 1)) ?? resolve(here, "../witness-photos"));

const CATEGORIES = ["fitness", "coding", "learning", "mindfulness", "custom"];
const TITLES = ["Work out for 30 minutes", "Ship one commit every day", "Study for 30 minutes", "Meditate for 10 minutes", "Do my daily habit"];
const NAME = /^(pass|fail)-(fitness|coding|learning|mindfulness|custom)-(\d{4})(?:-.*)?\.(jpe?g|png|webp|heic|heif)$/i;

if (!witnessConfigured()) {
  console.error("No AI verifier key found. Set LLM_API_KEY in frontend/.env.local.");
  process.exit(1);
}
if (!existsSync(folder)) {
  console.error(`No photo folder at ${folder}\nCreate it and add photos named like pass-fitness-4821-gym.jpg (see the top of this script).`);
  process.exit(1);
}
const files = readdirSync(folder).filter((f) => !f.startsWith(".") && !f.endsWith(".json")).sort();
const cases = files.map((file) => ({ file, m: file.match(NAME) }));
for (const c of cases.filter((c) => !c.m)) console.warn(`skipped (name not understood): ${c.file}`);
const todo = cases.filter((c) => c.m);
if (!todo.length) {
  console.error("No photos with a usable name. Example: pass-fitness-4821-gym.jpg");
  process.exit(1);
}

/** Same preparation as the app's compressImage(): longest side 1280px, JPEG. Uses macOS `sips`. */
const work = mkdtempSync(join(tmpdir(), "witness-"));
function prepare(file) {
  const out = join(work, `${file}.jpg`);
  try {
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", "-Z", "1280", join(folder, file), "--out", out], { stdio: "ignore" });
    return { mime: "image/jpeg", base64: readFileSync(out).toString("base64") };
  } catch {
    if (/\.hei[cf]$/i.test(file)) throw new Error("HEIC needs macOS `sips` to convert");
    const ext = file.split(".").pop().toLowerCase();
    return { mime: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg", base64: readFileSync(join(folder, file)).toString("base64") };
  }
}

console.log(`Witness model: ${witnessModel()} · ${todo.length} photos × ${runs} run(s)\n`);
const results = [];
for (const { file, m } of todo) {
  const expected = m[1].toLowerCase() === "pass";
  const category = CATEGORIES.indexOf(m[2].toLowerCase());
  const code = m[3];
  let image;
  try {
    image = prepare(file);
  } catch (e) {
    console.log(`ERROR  ${file}: ${e.message}`);
    continue;
  }
  for (let run = 1; run <= runs; run++) {
    const started = Date.now();
    try {
      const j = await judgePhoto(image, { title: TITLES[category], category, code });
      const right = j.approved === expected;
      const checks = `${j.codeVisible ? "code✓" : "code✗"} ${j.activityMatches ? "activity✓" : "activity✗"} ${j.appearsAuthentic ? "real✓" : "real✗"} conf ${j.confidence.toFixed(2)}`;
      console.log(`${right ? "ok   " : "WRONG"}  ${file}${runs > 1 ? ` #${run}` : ""}  →  ${j.approved ? "approved" : "rejected"}  [${checks}]  ${((Date.now() - started) / 1000).toFixed(1)}s`);
      if (!right) console.log(`       ${j.reasoning}`);
      results.push({ file, run, expected, category: m[2].toLowerCase(), ...j, right, ms: Date.now() - started });
    } catch (e) {
      console.log(`ERROR  ${file}: ${e.message}`);
      results.push({ file, run, expected, error: e.message });
    }
  }
}

const judged = results.filter((r) => !r.error);
const genuine = judged.filter((r) => r.expected);
const fakes = judged.filter((r) => !r.expected);
const wronglyRejected = genuine.filter((r) => !r.right);
const wronglyApproved = fakes.filter((r) => !r.right);
console.log("\nSummary");
console.log(`  Genuine photos approved:  ${genuine.length - wronglyRejected.length}/${genuine.length}${wronglyRejected.length ? "   ← each miss here would cost a real user money" : ""}`);
console.log(`  Fakes rejected:           ${fakes.length - wronglyApproved.length}/${fakes.length}`);
if (results.length > judged.length) console.log(`  Errors:                   ${results.length - judged.length}`);
for (const [why, key] of [["code not read", "codeVisible"], ["activity not recognised", "activityMatches"], ["judged not a real photo", "appearsAuthentic"]]) {
  const n = wronglyRejected.filter((r) => !r[key]).length;
  if (n) console.log(`  Wrongly rejected because ${why}: ${n}`);
}
const lowConfidence = wronglyRejected.filter((r) => r.codeVisible && r.activityMatches && r.appearsAuthentic).length;
if (lowConfidence) console.log(`  Wrongly rejected on low confidence alone (under 0.6): ${lowConfidence}`);

const report = join(folder, "witness-results.json");
writeFileSync(report, JSON.stringify({ model: witnessModel(), at: new Date().toISOString(), runs, results }, null, 2));
console.log(`\nFull results: ${report}`);
process.exit(wronglyRejected.length || wronglyApproved.length ? 2 : 0);
