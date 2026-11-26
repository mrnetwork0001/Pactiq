// Records the real Pactiq app (and the public explorer) in headless Chrome.
//   ONLY=home,explorer node scripts/capture.mjs        (refuses to run without ONLY)
//
// Sources:
//   mainnet  http://localhost:3000   the app running against QIE Mainnet (chain 1990), read-only, no wallet
//   demo     http://localhost:3001   the same app on a local fork of QIE Mainnet with ~9 days of replayed activity;
//                                    writes there are free and touch no real chain
//   explorer https://mainnet.qie.digital   the public Blockscout explorer, read-only
//
// Nothing here ever signs or sends on mainnet: the fake wallet only exists for the demo fork.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "../..");
const only = process.env.ONLY?.split(",");
if (!only) {
  console.error("Set ONLY=<clip,clip> so one-time writes are never repeated by accident.");
  process.exit(1);
}
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const MARKS = join(ROOT, ".cache/marks.json");
const META = join(ROOT, ".cache/meta.json");
mkdirSync(join(ROOT, ".cache/frames"), { recursive: true });

const MAINNET = "http://localhost:3000";
const DEMO = "http://localhost:3001";
const MAYA = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // maya.qie on the demo fork
const FORK_RPC = "http://127.0.0.1:8545";

/** Fake wallet for the demo fork only: answers from the unlocked local account. */
const walletScript = (account) => `(() => {
  const rpc = async (method, params) => { const r = await fetch(${JSON.stringify(FORK_RPC)}, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code }); return j.result; };
  const provider = { isMetaMask: true, request: async ({ method, params = [] }) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [${JSON.stringify(account)}];
    if (method === "eth_chainId") return "0x7bf";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    return rpc(method, params); }, on() {}, removeListener() {} };
  window.ethereum = provider;
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "qie", name: "QIE Wallet", icon: "", rdns: "me.qiewallet" }, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce); announce();
})();`;

/** A visible cursor, so clicks read as a person using the app. */
const cursorScript = `(() => {
  const add = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div"); c.id = "__cur";
    c.style.cssText = "position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transition:transform 650ms cubic-bezier(.22,.7,.25,1);transform:translate(-60px,-60px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 2l7.5 18 2.6-7.4L20.5 10z" fill="#17140f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const r = document.createElement("div"); r.id = "__rip";
    r.style.cssText = "position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #d13c1f;z-index:2147483646;pointer-events:none;opacity:0";
    document.documentElement.append(r, c);
  };
  document.addEventListener("DOMContentLoaded", add); if (document.readyState !== "loading") add();
  window.__cursor = (x, y) => { add(); document.getElementById("__cur").style.transform = "translate(" + x + "px," + y + "px)"; };
  window.__ripple = (x, y) => { add(); const r = document.getElementById("__rip"); r.style.left = x + "px"; r.style.top = y + "px"; r.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 520, easing: "ease-out" }); };
})();`;

/** Shift the page clock so it matches the fork's chain time (pact windows depend on it). */
async function skewClock(p) {
  const chain = parseInt((await (await fetch(FORK_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }) })).json()).result.timestamp, 16);
  const skew = (chain - Math.floor(Date.now() / 1000)) * 1000;
  await p.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => { const skew = ${skew}, R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(R.now() + skew); } static now() { return R.now() + skew; } } window.Date = D; })();`,
  });
}

const FIND = (text, scope = "button,a,summary,label,[role=button]") =>
  `([...document.querySelectorAll(${JSON.stringify(scope)})].filter(e => e.offsetParent !== null).find(e => e.innerText.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())})))`;

function toolkit(p, marks, clip) {
  const mark = (name) => { marks[name] = Date.now() / 1000; console.log(`  mark ${name}`); };
  const rects = {};
  const t = {
    mark,
    rects,
    sleep,
    /** Records a named rect (CSS px, viewport) of an element for the camera. */
    async rect(name, finder) {
      const r = await p.rectOf(finder);
      if (r) rects[name] = { x: r.x, y: r.y, w: r.width, h: r.height };
      else console.log(`  (no rect for ${name})`);
      return r;
    },
    async scrollTo(y, ms = 1400) {
      await p.js(`new Promise((res) => { const y0 = scrollY, dy = ${y} - y0, t0 = performance.now(); const step = (n) => { const k = Math.min(1, (n - t0) / ${ms}); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2; scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); })`);
    },
    /** Scroll an element into view with the same easing, ending `offset` px below the top. */
    async scrollToEl(finder, offset = 120, ms = 1400) {
      const y = await p.js(`(() => { const e = ${finder}; return e ? Math.max(0, e.getBoundingClientRect().top + scrollY - ${offset}) : null; })()`);
      if (y == null) { console.log("  (scroll target missing)"); return; }
      await t.scrollTo(y, ms);
    },
    /** Smooth-scroll any element (even inside a dialog) to the middle of its scroller. */
    async reveal(finder, block = "center") {
      await p.js(`(() => { const e = ${finder}; e && e.scrollIntoView({ behavior: "smooth", block: ${JSON.stringify(block)} }); })()`);
      await sleep(900);
    },
    /** Glide the cursor to an element, ripple, then click it for real. */
    async tap(finder, { pause = 350 } = {}) {
      const r = await p.rectOf(finder);
      if (!r) { console.log("  (tap target missing)"); return false; }
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      await p.js(`window.__cursor(${x}, ${y})`);
      await sleep(760);
      await p.js(`window.__ripple(${x}, ${y})`);
      await p.js(`(() => { const e = ${finder}; e && e.click(); })()`);
      await sleep(pause);
      return true;
    },
    async tapText(text, scope) { return t.tap(FIND(text, scope)); },
    /** Type into a React-controlled input, one character at a time. */
    async type(finder, text, every = 55) {
      await t.tap(finder, { pause: 150 });
      for (let i = 1; i <= text.length; i++) {
        await p.js(`(() => { const e = ${finder}; const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), "value").set; set.call(e, ${JSON.stringify(text.slice(0, i))}); e.dispatchEvent(new Event("input", { bubbles: true })); })()`);
        await sleep(every);
      }
    },
    async waitFor(finder, ms = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (await p.js(`!!(${finder})`)) return true; await sleep(300); }
      console.log("  (timed out waiting)");
      return false;
    },
    FIND,
  };
  return t;
}

const CLIPS = {};
const clip = (name, spec) => (CLIPS[name] = spec);
export { clip, MAINNET, DEMO, MAYA, FIND };

const defs = await import("./clips.mjs");
defs.register({ clip, MAINNET, DEMO, MAYA, FIND });

const marks = readJson(MARKS);
const meta = readJson(META);
for (const name of only) {
  const spec = CLIPS[name];
  if (!spec) { console.error(`no clip "${name}"`); continue; }
  const [w, h] = spec.size ?? [1600, 900];
  console.log(`recording ${name} (${w}x${h}, ${spec.source})`);
  const dir = join(ROOT, ".cache/frames", name);
  rmSync(dir, { recursive: true, force: true });
  const p = await launch({ width: w, height: h });
  try {
    await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: spec.scale ?? 1.5, mobile: w < 700 });
    if (spec.wallet) await p.send("Page.addScriptToEvaluateOnNewDocument", { source: walletScript(spec.wallet) });
    if (spec.skew) await skewClock(p);
    await p.send("Page.addScriptToEvaluateOnNewDocument", { source: cursorScript });
    await p.goto(spec.url, spec.settle ?? 4500);
    const tk = toolkit(p, marks, name);
    const sc = spec.scale ?? 1.5;
    const stop = await p.screencast(dir, { maxWidth: Math.round(w * sc), maxHeight: Math.round(h * sc) });
    const t0 = Date.now() / 1000;
    marks[`${name}:start`] = t0;
    await sleep(900);
    await spec.run(p, tk);
    await sleep(spec.tail ?? 1200);
    marks[`${name}:end`] = Date.now() / 1000;
    await stop();
    meta[name] = { rects: tk.rects, scale: spec.scale ?? 1.5, source: spec.source };
    console.log(p.consoleLines.length ? `  console: ${p.consoleLines.slice(0, 4).join(" | ")}` : "  no console errors");
  } catch (e) {
    console.error(`  FAILED ${name}: ${e.message}`);
  } finally {
    p.close();
  }
  writeFileSync(MARKS, JSON.stringify(marks, null, 1));
  writeFileSync(META, JSON.stringify(meta, null, 1));
}
process.exit(0);
