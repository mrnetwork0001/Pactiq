// Dev helper: opens the demo app as maya.qie, runs steps, prints what is on screen. node scripts/explore.mjs
import { launch, sleep } from "./cdp.mjs";
const FORK_RPC = "http://127.0.0.1:8545";
const ACCOUNT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const wallet = `(() => { const rpc = async (m, p) => { const r = await fetch(${JSON.stringify(FORK_RPC)}, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result; };
  const provider = { isMetaMask: true, request: async ({ method, params = [] }) => { if (method === "eth_requestAccounts" || method === "eth_accounts") return [${JSON.stringify(ACCOUNT)}]; if (method === "eth_chainId") return "0x7bf"; if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null; return rpc(method, params); }, on() {}, removeListener() {} };
  window.ethereum = provider; const a = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "q", name: "QIE Wallet", icon: "", rdns: "me.qiewallet" }, provider }) })); window.addEventListener("eip6963:requestProvider", a); a(); })();`;
const chain = parseInt((await (await fetch(FORK_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }) })).json()).result.timestamp, 16);
const skew = (chain - Math.floor(Date.now() / 1000)) * 1000;
const [w = 1600, h = 900, path = "/app", ...steps] = process.argv.slice(2);
const p = await launch({ width: +w, height: +h });
await p.send("Page.addScriptToEvaluateOnNewDocument", { source: wallet });
await p.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const skew = ${skew}, R = Date; class D extends R { constructor(...a) { a.length ? super(...a) : super(R.now() + skew); } static now() { return R.now() + skew; } } window.Date = D; })();` });
await p.goto(`http://localhost:3001${path}`, 4500);
for (const s of steps) {
  const [cmd, ...r] = s.split(":"); const arg = r.join(":");
  if (cmd === "click") console.log("click", arg, await p.click(arg, "button,a,summary,label,[role=button]"));
  else if (cmd === "wait") await sleep(+arg);
  else if (cmd === "eval") console.log(JSON.stringify(await p.js(arg)));
  else if (cmd === "shot") await p.shot(`out/chk/${arg}.png`);
  await sleep(700);
}
console.log(p.consoleLines.slice(0, 3));
p.close(); process.exit(0);
