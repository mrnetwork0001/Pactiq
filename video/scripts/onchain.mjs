// Reads every figure the film quotes from QIE Mainnet (read-only RPC + Blockscout) into data/onchain.json.
//   node scripts/onchain.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "../..");
const RPC = "https://rpc1mainnet.qie.digital/";
const EXPLORER = "https://mainnet.qie.digital";
const A = {
  vault: "0xcc8cb1Ae278dbc5077A8c0aB7517F1278C84Be3B",
  badges: "0x94B80026A0087613927eC5104791A0d9334B31b1",
  router: "0x5302338570D5565bEf50bdEa64Ce992b54DF96C4",
  names: "0xD4BB76117D5E3763e8750519D10F40d1eb1A5A02",
  campaign: "0x06304d82ca0beEDd54B751D4f73F16A569D0Ce30",
  qusdc: "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5",
  oracle: "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17",
  qiedexRouter: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef",
};
const cast = (...a) => execFileSync("cast", [...a, "--rpc-url", RPC], { encoding: "utf8" }).trim();
const num = (s) => s.split(/\s/)[0];
const get = async (u) => (await fetch(u)).json();

const head = Number(cast("block-number"));
const t1 = Number(cast("block", String(head), "--field", "timestamp"));
const t0 = Number(cast("block", String(head - 10000), "--field", "timestamp"));
const blockSeconds = (t1 - t0) / 10000;

const round = cast("call", A.oracle, "latestRoundData()(uint80,int256,uint256,uint256,uint80)").split("\n");
const qieUsd = Number(num(round[1])) / 1e8;

const txs = (await get(`${EXPLORER}/api?module=account&action=txlist&address=${A.vault}&sort=asc`)).result;
const SEL = { "0x7cec56ac": "createPact", "0xd35fb203": "createPactUsd", "0x997071fa": "createSquad", "0x03486b26": "joinSquad", "0x4e887534": "sponsorSquad", "0x412540b1": "fundRewardPool" };
const vaultTxs = txs
  .filter((t) => SEL[t.input.slice(0, 10)])
  .map((t) => ({
    step: SEL[t.input.slice(0, 10)], hash: t.hash, block: +t.blockNumber, utc: new Date(+t.timeStamp * 1000).toISOString(), from: t.from,
    valueQie: +t.value / 1e18, feeQie: (+t.gasUsed * +t.gasPrice) / 1e18, failed: t.isError === "1",
  }));
const swaps = (await get(`${EXPLORER}/api?module=account&action=txlist&address=${A.router}&sort=asc`)).result
  .filter((t) => t.input.startsWith("0x1d9ccc00"))
  .map((t) => ({ hash: t.hash, block: +t.blockNumber, utc: new Date(+t.timeStamp * 1000).toISOString(), valueQie: +t.value / 1e18 }));
const deploy = txs.find((t) => t.input.startsWith("0x60803462"));

const stats = cast("call", A.vault, "getProtocolStats(address)", "0x0000000000000000000000000000000000000000");
const fees = vaultTxs.filter((t) => t.step.startsWith("createPact")).map((t) => t.feeQie);
const out = {
  readAtUTC: new Date().toISOString(), chainId: 1990, head, blockSeconds: +blockSeconds.toFixed(2), qieUsd,
  addresses: A, deployTx: deploy ? { hash: deploy.hash, block: +deploy.blockNumber, utc: new Date(+deploy.timeStamp * 1000).toISOString() } : null,
  vaultTxs, swaps, statsRaw: stats,
  campaign: { balanceQie: Number(num(cast("balance", A.campaign, "-e"))), reward: 20, winners: 10, minStreak: 3 },
  signFeeQie: Math.max(...fees), signFeeUsd: Math.max(...fees) * qieUsd,
};
writeFileSync(join(ROOT, "data/onchain.json"), JSON.stringify(out, null, 1));
console.log(`QIE $${qieUsd}, block ${blockSeconds.toFixed(2)}s, ${vaultTxs.length} vault txs, ${swaps.length} swaps, max sign fee ${out.signFeeQie.toFixed(6)} QIE = $${out.signFeeUsd.toFixed(5)}`);
