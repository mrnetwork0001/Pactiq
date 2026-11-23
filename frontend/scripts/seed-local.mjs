#!/usr/bin/env node
/**
 * LOCAL DEMO ONLY. Deploys Pactiq to an anvil fork of QIE mainnet and replays ~9 days of
 * realistic activity (solo pacts, a sponsored squad, charity donations, badges, a failed pact,
 * QUSDC pacts funded by real QIEDEX swaps), ending at the real current
 * time so dates in the UI look right. QUSDC, QIEDEX and the QIE name registries are the real
 * mainnet contracts, present on the fork.
 *
 * Start the fork ~9.5 days in the past first (see README → "Run locally"):
 *   anvil --fork-url https://rpc1mainnet.qie.digital/ --fork-block-number <latest − 222000> --chain-id 1983
 * Then:   pnpm demo:local      (builds the contracts, runs this, rewrites .env.local)
 *
 * Uses anvil's public test mnemonic. Refuses to run against anything that is not anvil.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, keccak256, toHex, zeroAddress, defineChain, erc20Abi } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(here, "../.env.local");
const OUT = resolve(here, "../../contracts/out");
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const QIE_ORACLE = "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17";
const QUSDC = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5";
const WQIE = "0x0087904D95BEe9E5F24dc8852804b547981A9139";
const QIEDEX_ROUTER = "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef";
const QIE_NAMES = ["0x26cCB3fABd6db18834987134d715Ba2346CE7223", "0x1D69d75AD7b77b91C3760F84faC52E651710f62e", "0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E"];
const ROUTER_ABI = [
  { type: "function", name: "getAmountsIn", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address[]" }], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "swapExactETHForTokens", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256[]" }] },
];
const MNEMONIC = "test test test test test test test test test test test junk";
const D = 86400;
const H = 3600;

// ---------------------------------------------------------------------------- setup
const env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const oracleKey = env.match(/^ORACLE_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)?.[1];
if (!oracleKey) throw new Error("Set ORACLE_PRIVATE_KEY in frontend/.env.local first (cast wallet new).");
const oracle = privateKeyToAccount(oracleKey);

const chain = defineChain({
  id: 1983,
  name: "QIE fork",
  nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });
const rpc = (method, params = []) => pub.request({ method, params });

try {
  await rpc("anvil_nodeInfo");
} catch {
  throw new Error(`${RPC} is not an anvil node. This script only runs against a local fork.`);
}

const artifact = (file, name) => JSON.parse(readFileSync(`${OUT}/${file}/${name}.json`, "utf8"));
const VaultArt = artifact("PactiqVault.sol", "PactiqVault");
const BadgesArt = artifact("PactiqBadges.sol", "PactiqBadges");
const FeedArt = artifact("LocalDemoFeed.sol", "LocalDemoFeed");
const VerifierArt = artifact("QieNameVerifier.sol", "QieNameVerifier");
const NamesArt = artifact("LocalQieNames.sol", "LocalQieNames");
const RouterArt = artifact("PactiqRouter.sol", "PactiqRouter");

const acct = (i) => mnemonicToAccount(MNEMONIC, { addressIndex: i });
const people = {
  owner: acct(0),
  maya: acct(1), // the "you" account in the demo — import this key into your wallet
  tunde: acct(2),
  sam: acct(3),
  lena: acct(4),
  kofi: acct(5),
  ada: acct(6),
  charity: acct(9),
};
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });

let vault;
const padGas = async (req) => ((await pub.estimateContractGas(req)) * 13n) / 10n;
async function send(who, functionName, args = [], value = 0n) {
  const req = { address: vault, abi: VaultArt.abi, functionName, args, value, account: who };
  const hash = await wallet(who).writeContract({ ...req, gas: await padGas(req) });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
}
async function deploy(art, args) {
  const hash = await wallet(people.owner).deployContract({ abi: art.abi, bytecode: art.bytecode.object, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}
const read = (functionName, args = []) => pub.readContract({ address: vault, abi: VaultArt.abi, functionName, args });
async function at(t) {
  const now = Number((await pub.getBlock()).timestamp);
  if (t > now) await rpc("evm_setNextBlockTimestamp", [toHex(t)]);
}
const lastId = async (counter) => Number(await read(counter)) - 1;
async function write(who, address, abi, functionName, args, value = 0n) {
  const req = { address, abi, functionName, args, value, account: who };
  const hash = await wallet(who).writeContract({ ...req, gas: await padGas(req) });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
}
const usdc = (n) => parseUnits(String(n), 6);
/** Buy exactly-ish `amount` QUSDC with QIE on the real QIEDEX router (present on the fork). */
async function buyQusdc(who, amount) {
  const [qieIn] = await pub.readContract({ address: QIEDEX_ROUTER, abi: ROUTER_ABI, functionName: "getAmountsIn", args: [amount, [WQIE, QUSDC]] });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * D);
  await write(who, QIEDEX_ROUTER, ROUTER_ABI, "swapExactETHForTokens", [amount, [WQIE, QUSDC], who.address, deadline], (qieIn * 101n) / 100n);
}
const approve = (who, amount) => write(who, QUSDC, erc20Abi, "approve", [vault, amount]);

async function checkIn(who, pactId, day) {
  const proofHash = keccak256(toHex(`demo:${pactId}:${day}:${Math.random()}`));
  const digest = await read("checkInDigest", [BigInt(pactId), BigInt(day), proofHash, who.address]);
  const signature = await oracle.signMessage({ message: { raw: digest } });
  await send(who, "checkIn", [BigInt(pactId), BigInt(day), proofHash, signature]);
}

// ---------------------------------------------------------------------------- timeline
const T0 = Number((await pub.getBlock()).timestamp) + 60;
const END = Math.floor(Date.now() / 1000) - 120;
if (END - T0 < 9.2 * D) {
  throw new Error(
    `Fork starts only ${((END - T0) / D).toFixed(1)} days ago; need ≥ 9.2. Restart anvil with an older --fork-block-number.`
  );
}
console.log(`Replaying ${((END - T0) / D).toFixed(2)} days of activity…`);
await at(T0);

// Deploy
const feed = await deploy(FeedArt, [QIE_ORACLE]);
vault = await deploy(VaultArt, [oracle.address, feed]);
const badges = await deploy(BadgesArt, ["http://localhost:3000/api/badge/"]);
{
  const hash = await wallet(people.owner).writeContract({ address: badges, abi: BadgesArt.abi, functionName: "setMinter", args: [vault] });
  await pub.waitForTransactionReceipt({ hash });
}
await send(people.owner, "setBadges", [badges]);
await send(people.owner, "setCharity", [people.charity.address, "Open Source Fund (demo)", true]);
await send(people.owner, "fundRewardPool", [zeroAddress, parseEther("40")], parseEther("40"));

// QIE ID: QIE's real name registries (on the fork) plus demo names for the test accounts.
const verifier = await deploy(VerifierArt, QIE_NAMES);
const names = await deploy(NamesArt, [verifier]);
for (const [who, name] of [["maya", "maya.qie"], ["tunde", "tunde.qie"], ["sam", "sam.qie"], ["lena", "lena.qie"], ["kofi", "kofi.qie"], ["ada", "ada.qie"]]) {
  await write(people.owner, names, NamesArt.abi, "set", [people[who].address, name]);
}
await send(people.owner, "setQieNames", [names]);

// QUSDC: the real token, bought with QIE on the real QIEDEX pool.
await send(people.owner, "setStakeAsset", [QUSDC, usdc("0.10")]);
await buyQusdc(people.owner, usdc(80));
await buyQusdc(people.ada, usdc(25));
await buyQusdc(people.lena, usdc(15));
await buyQusdc(people.maya, usdc(2)); // a little, so the demo shows the in-app QIEDEX top-up
await approve(people.owner, usdc(80));
await send(people.owner, "fundRewardPool", [QUSDC, usdc(20)]);

// Category enum (PactiqVault.Category): 0 fitness, 1 coding, 2 learning, 3 meditation, 4 custom
const pact = async (who, title, cat, perDay, days, qieId, charity = zeroAddress) => {
  await send(who, "createPact", [title, cat, zeroAddress, parseEther(perDay), BigInt(days), qieId, charity], parseEther(perDay) * BigInt(days));
  return lastId("nextPactId");
};
const stablePact = async (who, title, cat, perDay, days, qieId) => {
  await approve(who, usdc(perDay) * BigInt(days));
  await send(who, "createPact", [title, cat, QUSDC, usdc(perDay), BigInt(days), qieId, zeroAddress]);
  return lastId("nextPactId");
};

// Day 0
const A = await pact(people.maya, "Ship one commit every day", 1, "1", 7, "maya.qie");
const B = await pact(people.tunde, "5 km run before work", 0, "2", 14, "tunde.qie");
const C = await pact(people.sam, "Read 20 pages a day", 2, "0.5", 5, "sam.qie", people.charity.address);
const F = await stablePact(people.ada, "One Duolingo lesson a day", 2, "1", 7, "ada.qie");
const squadStart = T0 + 2 * H;
await send(people.lena, "createSquad", ["No-Zero Days: Builders Week", 1, zeroAddress, parseEther("1"), 7n, BigInt(squadStart), 8n, "Pactiq Launch Fund", parseEther("30")], parseEther("30"));
const S1 = await lastId("nextSquadId");
const squadPacts = {};
for (const [who, id] of [[people.lena, "lena.qie"], [people.maya, "maya.qie"], [people.kofi, "kofi.qie"], [people.ada, "ada.qie"]]) {
  await send(who, "joinSquad", [BigInt(S1), id], parseEther("7"));
  squadPacts[id] = await lastId("nextPactId");
}

const squadDays = { "lena.qie": [1, 2, 3, 4, 5, 6, 7], "maya.qie": [1, 2, 3, 4, 5, 6, 7], "kofi.qie": [1, 2], "ada.qie": [1, 2, 3, 5, 6] };
const squadWho = { "lena.qie": people.lena, "maya.qie": people.maya, "kofi.qie": people.kofi, "ada.qie": people.ada };
let E;
for (let d = 1; d <= 9; d++) {
  await at(T0 + (d - 1) * D + 4 * H + d * 600);
  if (d <= 7) await checkIn(people.maya, A, d);
  await checkIn(people.tunde, B, d);
  if ([1, 2, 4].includes(d)) await checkIn(people.sam, C, d);
  if (d <= 7) await checkIn(people.ada, F, d);
  if (d === 7) await send(people.ada, "settlePact", [BigInt(F)]); // QUSDC back + bonus from the QUSDC pool
  for (const [id, days] of Object.entries(squadDays)) if (days.includes(d)) await checkIn(squadWho[id], squadPacts[id], d);
  if (d === 7) await send(people.maya, "settlePact", [BigInt(A)]); // perfect run → stake + bonus + Week Warrior
  if (d === 4) E = await pact(people.kofi, "No sugar after 6pm", 4, "0.2", 3, "kofi.qie"); // abandoned
  if (d === 8) {
    // Squad (ends start + 7d + 12h grace) and expired solo pacts settle once their windows close.
    await at(T0 + 7 * D + 15 * H);
    await send(people.owner, "finalizeSquad", [BigInt(S1)]);
    for (const id of Object.values(squadPacts)) await send(people.owner, "settlePact", [BigInt(id)]);
    await send(people.owner, "settlePact", [BigInt(C)]); // missed days → charity
    await send(people.owner, "settlePact", [BigInt(E)]); // missed days → pool
    await send(people.owner, "releaseCharity", [people.charity.address, zeroAddress]);
  }
  if (d === 9) {
    // Maya starts a USD-denominated meditation pact and checks in day 1; day 2 is open "today".
    const usd = 50n * 10n ** 16n; // $0.50 / day, 18 decimals
    const [, need] = await read("quotePactUsd", [usd, 21n]);
    await send(people.maya, "createPactUsd", ["Meditate 10 minutes", 3, usd, 21n, "maya.qie", zeroAddress], (need * 102n) / 100n);
    await checkIn(people.maya, await lastId("nextPactId"), 1);
  }
}

// "Today": an upcoming community squad and a sponsored challenge, both open to join.
await at(END);
await send(people.tunde, "createSquad", ["30 Days of Deep Work", 1, zeroAddress, parseEther("0.5"), 30n, BigInt(END + 20 * H), 20n, "", 0n]);
const S2 = await lastId("nextSquadId");
await send(people.tunde, "joinSquad", [BigInt(S2), "tunde.qie"], parseEther("15"));
await send(people.sam, "joinSquad", [BigInt(S2), "sam.qie"], parseEther("15"));
// A QUSDC challenge: dollar stakes, a dollar prize pot.
await send(people.owner, "createSquad", ["10-Day Move Every Day", 0, QUSDC, usdc(1), 10n, BigInt(END + 6 * H), 50n, "Pactiq Launch Fund", usdc(50)]);
const S3 = await lastId("nextSquadId");
for (const who of [people.lena, people.ada]) {
  await approve(who, usdc(10));
  await send(who, "joinSquad", [BigInt(S3), who === people.lena ? "lena.qie" : "ada.qie"]);
}

// Swaps made in the app go through PactiqRouter (deployed last, so earlier addresses don't shift).
const router = await deploy(RouterArt, [QIEDEX_ROUTER, WQIE]);

// ---------------------------------------------------------------------------- env
const setEnv = (text, key, value) =>
  new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
let next = env;
next = setEnv(next, "NEXT_PUBLIC_QIE_NETWORK", "testnet");
next = setEnv(next, "NEXT_PUBLIC_RPC_URL", RPC);
next = setEnv(next, "NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS", vault);
next = setEnv(next, "NEXT_PUBLIC_PACTIQ_ROUTER_ADDRESS", router);
next = setEnv(next, "NEXT_PUBLIC_APP_URL", "http://localhost:3000");
next = setEnv(next, "PACTIQ_DEMO_VERIFIER", "true");
writeFileSync(ENV_FILE, next);

console.log(`
PactiqVault   ${vault}
PactiqBadges  ${badges}
Demo feed     ${feed}  (re-serves the real QIE Oracle price)
QIE ID        ${names}  (real QIE registries via ${verifier}, plus demo names)
QUSDC         ${QUSDC}  (real token; demo accounts bought it on QIEDEX)
Squads        #${S1} finished · #${S2} upcoming · #${S3} sponsored in QUSDC
.env.local updated. Restart \`pnpm dev\` if it was running.

Demo wallet ("maya.qie", anvil account #1 — public test key, never use on a real network):
  ${"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"}
  RPC ${RPC} · chain id 1983
`);
