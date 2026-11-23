# Pactiq — Proof-of-Discipline on QIE

**Put money on your habits. Prove it daily. Get paid.**

Pactiq lets people stake QIE or QUSDC on a daily habit (coding, fitness, study, meditation, or anything custom).
Each day they photograph their activity together with a one-time code. An AI vision verifier checks the photo, and the check-in is recorded on QIE Mainnet.
At the end, every verified day is refunded. Missed days fund a bonus for the people who finish, or go to a charity of the user's choice.

Built for **QIE Blockchain Hackathon 3.0** · Track: **Consumer Apps & Social** (also fits AI + Autonomous Agents)

| | |
|---|---|
| Live demo | _add your deployment URL_ |
| PactiqVault (QIE Mainnet, chain 1990) | [`0xcc8cb1Ae278dbc5077A8c0aB7517F1278C84Be3B`](https://mainnet.qie.digital/address/0xcc8cb1Ae278dbc5077A8c0aB7517F1278C84Be3B) |
| PactiqBadges (soulbound ERC-721) | [`0x94B80026A0087613927eC5104791A0d9334B31b1`](https://mainnet.qie.digital/address/0x94B80026A0087613927eC5104791A0d9334B31b1) |
| PactiqRouter (swap attribution) | [`0x5302338570D5565bEf50bdEa64Ce992b54DF96C4`](https://mainnet.qie.digital/address/0x5302338570D5565bEf50bdEa64Ce992b54DF96C4) |
| QieNameVerifier (QIE ID) | [`0xD4BB76117D5E3763e8750519D10F40d1eb1A5A02`](https://mainnet.qie.digital/address/0xD4BB76117D5E3763e8750519D10F40d1eb1A5A02) |
| PactiqCampaign (launch campaign, 10 × 20 QIE) | [`0x06304d82ca0beEDd54B751D4f73F16A569D0Ce30`](https://mainnet.qie.digital/address/0x06304d82ca0beEDd54B751D4f73F16A569D0Ce30) |
| Demo video | _add link_ |

---

## Design: the signed pact

Pactiq doesn't look like a crypto dashboard, on purpose. Every pact is drawn as a contract on paper: numbered clauses when you draft it, your name as an ink signature, a row of rubber stamps for the days you kept (and crossed-out stamps for the days you didn't), and a big **KEPT** or **BROKEN** stamp when it settles. Badges are wax seals. The leaderboard is a register. Your public profile is a certificate of discipline. The share cards use the same paper-and-ink style, so a link posted to X or Telegram is recognisable at a glance.

## Features

| | |
|---|---|
| **Solo pacts** | Stake for 3–100 days. Check in daily with an AI-verified photo. Verified days are refunded. Finish 100% to earn up to 15% from the bonus pool. |
| **Squads with invite links** | Friends commit together with the same start date and stake. A quitter's missed stake is split between the squad's finishers. Share `/squad/<id>`, and the link preview shows a live card. |
| **Sponsored challenges** | Brands, DAOs or anyone can fund a squad's prize pot, which is split equally between finishers. If nobody finishes, the pot goes to the community bonus pool. |
| **Stakes in USD** | "Commit $1/day". The QIE amount is priced **on-chain** by the QIE Oracle (`createPactUsd`), stale prices are rejected, and any overpayment is refunded in the same transaction. |
| **Stakes in QUSDC** | Stake QIE's USDC-backed stablecoin instead, so the stake never moves with the price. Pacts, squads, sponsor pots, bonus pools and charity donations each keep a separate ledger per currency, and one Proof-of-Human score spans both. |
| **Built-in swap** | Swap QIE and QUSDC both ways on QIEDEX from inside the app. In the pact form, a top-up quotes the exact QUSDC shortfall and buys it in one transaction. Every swap goes through `PactiqRouter`, which emits `PactiqSwap` and keeps running totals, so volume through Pactiq is readable on-chain. No Pactiq fee. |
| **Verified names (QIE ID)** | A `.qie` name on a pact is checked **on-chain** against QIE's name registries, so nobody can sign as someone else. The form prefills the wallet's primary name. |
| **Charity mode** | Missed stakes go 100% (no fee) to a cause from an owner-curated list instead of the pool. Anyone can trigger the payout with `releaseCharity`. |
| **Proof-of-Human score** | A public on-chain reputation (`IPactiqReputation`) built from verified check-ins, completions and streaks. Any QIE dApp can gate airdrops, faucets or votes with one call. |
| **Soulbound streak badges** | ERC-721 + ERC-5192 (non-transferable), minted automatically at 7, 30 and 100-day streaks. |
| **Share cards & reminders** | Generated share images for profiles and squads. One-tap posting to X and Telegram. Calendar (.ics) reminders. Installable app with check-in notifications. |

## Why it matters

New chains need real, repeat, human usage, not airdrop farmers. Pactiq creates that naturally:

- **Daily on-chain activity by design.** Every user sends one transaction per day for 3 to 100 days, and squads bring their friends.
- **Bots don't profit.** Each check-in needs a fresh photo containing a secret code that changes every day and only the server can generate.
- **A public good for the ecosystem.** The Proof-of-Human score turns that effort into sybil resistance every QIE project can use.

## How it works

```
 User (QIE Wallet)                 Pactiq server                     PactiqVault (QIE Mainnet)
 ─────────────────                 ─────────────                     ─────────────────────────
 createPact / createPactUsd / joinSquad ─────────────────────────▶  lock QIE or QUSDC (USD priced by QIE Oracle),
                                                                     .qie name checked against QIE ID registries
 GET /api/challenge ────────────▶  verify pact owner + open day
                    ◀────────────  code = HMAC(secret, pact, day, user)
 photo with code    ────────────▶  POST /api/verify-proof
                                   ├─ on-chain eligibility check
                                   ├─ AI vision (0G): code? activity? authentic?
                                   └─ sign keccak(vault, chainId, pact, day, proofHash, user)
 checkIn(sig)       ──────────────────────────────────────────────▶  ecrecover == oracleSigner,
                                                                     streak ↑, badge mint at 7/30/100
 settlePact         ──────────────────────────────────────────────▶  solo: refund days, slash → pool/charity,
                                                                            100% finishers get pool bonus
                                                                     squad: finalize once, split
                                                                            slash + sponsor pot to finishers
```

### Rules enforced by the contract

- Day *N*'s window opens at `start + (N-1) days` and closes 12 hours after the day ends, to allow for time zones.
- A completed solo pact settles immediately. Everything else settles only after the last day's grace period, so nobody can cut someone's final day short.
- Squads start at a fixed time. People can join until 12 hours after the start. Everyone settles after the squad ends, so the finisher split is final. The squad is finalized automatically by the first settlement, or by anyone calling `finalizeSquad`.
- Only the creator can check in. Each attestation is bound to `(contract, chainId, pact, day, proofHash, user)` and can be used once.
- The owner can withdraw **only accrued protocol fees**. User stakes, the bonus pool, squad pots and charity donations can't be touched. Fuzz tests check `balance ≥ active + pool + fees + squad escrow + charity escrow`.
- `pause()` blocks only new pacts and squads. Check-ins and settlements always keep working.
- A failing badge mint can never block a check-in.

### Anti-cheat layers

1. **Server-issued daily code.** It's an HMAC of the pact, day, and wallet, so it can't be predicted or reused on another day.
2. **Vision check.** A vision model on the 0G Compute Router (GPT-5.4 mini by default; any OpenAI-compatible API, or Gemini directly, also works) must read the exact code, see the right activity, and judge the photo to be a real camera shot. Pactiq re-checks the digits the model read. Text inside the image is treated as data, not instructions.
3. **On-chain binding.** The signature only works for that wallet, pact, and day, on this contract and chain.
4. **Rate limits.** 5 verification attempts per pact-day and 60 per IP per hour.

## For QIE builders: Proof-of-Human

```solidity
import {IPactiqReputation} from "./IPactiqReputation.sol";

require(IPactiqReputation(PACTIQ_VAULT).isVerifiedHuman(msg.sender, 200), "humans only");
```

- On-chain: `humanScore(user)`, `isVerifiedHuman(user, minScore)`, `getHumanProfile(user)`. A complete example is in [`HumanGatedAirdrop.sol`](contracts/src/examples/HumanGatedAirdrop.sol).
- HTTP (CORS-enabled): `GET /api/score/<address>?min=200`
- Score = 10 × check-ins + 100 × completed pacts + 20 × best streak − 50 × failed pacts (floored at 0).

## QIE ecosystem integration

Pactiq uses every QIE component named in the hackathon brief, each one on-chain where QIE offers a contract:

| Component | How Pactiq uses it |
|---|---|
| **QIE Mainnet** (chain 1990) | All stakes, check-ins, squads, badges and reputation live on-chain. |
| **QIE Wallet** | EIP-6963 discovery that prefers `me.qiewallet`, falls back to `window.qie` and then `window.ethereum`, and switches or adds the network automatically. |
| **QUSDC** (`0x3F43…5DA5`) | A second stake asset next to QIE (`setStakeAsset`), with its own minimum, bonus pool, fees, squad escrow and charity balance. Users approve exactly the amount a pact needs. |
| **QIEDEX** (router `0x08cd…53Ef`) | Two-way QIE ⇄ QUSDC swap screen and the in-form top-up, both at 1% max slippage. Trades execute on the QIEDEX router through `PactiqRouter`, which holds nothing between calls and forwards proceeds straight to the user. |
| **QIE Oracle** (`0x3Bc6…3D17`) | The official QIE/USDT feed prices USD pacts **on-chain** (`createPactUsd`, `quotePactUsd`, with a staleness check) and turns QIE + QUSDC totals into one dollar figure in the UI. |
| **QIE ID** | [`QieNameVerifier`](contracts/src/QieNameVerifier.sol) reads QIE's two forward name registries (`0x26cC…7223`, `0x1D69…f62e`) and the reverse resolver (`0x76ec…171E`). The vault refuses a `.qie` name the signing wallet doesn't hold. |

The fork test [`QieMainnetFork.t.sol`](contracts/test/QieMainnetFork.t.sol) runs against live mainnet state: it resolves real `.qie` names, swaps QIE for QUSDC on QIEDEX and stakes the QUSDC in a pact signed with a verified name (`QIE_FORK=1 forge test --match-contract QieMainnetFork`).

## Repository

```
contracts/                        Foundry (Shanghai EVM)
  src/PactiqVault.sol             pacts in QIE or QUSDC, USD pacts, squads, sponsors, charity, streaks,
                                  verified .qie names, reputation
  src/PactiqBadges.sol            soulbound ERC-721 / ERC-5192 streak badges
  src/PactiqRouter.sol            QIEDEX swaps made in the app, attributed on-chain (PactiqSwap event, running totals)
  src/QieNameVerifier.sol         QIE ID: checks names against QIE's registries + reverse resolver
  src/PactiqCampaign.sol          launch campaign: first N wallets with a verified streak claim a fixed QIE reward
  src/IPactiqReputation.sol       Proof-of-Human interface for integrators
  src/examples/HumanGatedAirdrop.sol
  test/PactiqVault.t.sol          32 core tests (incl. fuzzed fund conservation)
  test/PactiqFeatures.t.sol       17 tests: squads, sponsors, charity, USD, badges, score (+ squad fuzz)
  test/PactiqQie.t.sol            15 tests: QUSDC ledgers, QIE ID (+ mixed-asset fuzz)
  test/PactiqRouter.t.sol         7 tests: attribution, payouts, no funds or allowance left behind
  test/PactiqCampaign.t.sol       8 tests: streak gate, window, first-come cap, funding, unclaimed recovery
  test/QieMainnetFork.t.sol       live mainnet: real .qie names, QIEDEX swap, QUSDC pact, router both ways
  script/DeployPactiq.s.sol       deploys + wires vault, badges, QIE ID verifier, QUSDC
  script/DeployCampaign.s.sol     deploys the launch campaign against the live vault
  script/local/                   local-only shims for the demo seed (price feed, demo .qie names)
frontend/                         Next.js 16 + React 19 + Tailwind 4 + viem
  scripts/seed-local.mjs          deploys to a local fork and replays ~9 days of demo activity
  src/app/api/challenge           daily code
  src/app/api/verify-proof        AI verification + oracle signature
  src/app/api/card                share images (profile / squad)
  src/app/api/score/[address]     Proof-of-Human JSON
  src/app/api/badge/[id]          badge metadata (tokenURI target)
  src/app/api/reminder/[pactId]   .ics calendar reminders
  src/app/api/push                push reminder subscriptions + the hourly reminder job (/cron)
  src/app/terms, src/app/privacy  terms of use and privacy notice
  src/app/squad/[id]              invite links
  src/app/u/[address]             public profiles
  src/components/ui.tsx           design system: sheets, clauses, day stamps, wax seals
  src/components/                 App, squads, modals, cards, register
```

## Run locally (no real funds)

**One-command demo** (a mainnet fork pre-filled with ~9 days of pacts, a sponsored squad, badges and a charity donation):

```bash
# 1. Fork QIE mainnet from ~9.5 days ago, so the replayed history ends today
anvil --fork-url https://rpc1mainnet.qie.digital/ --chain-id 1983 \
  --fork-block-number $(( $(cast block-number --rpc-url https://rpc1mainnet.qie.digital/) - 222000 )) &

# 2. Verifier key for the frontend (needs no funds)
cd frontend && cp .env.example .env.local
cast wallet new              # put the private key in .env.local as ORACLE_PRIVATE_KEY

# 3. Deploy + seed (writes the contract address, RPC and demo verifier into .env.local)
pnpm install && pnpm demo:local && pnpm dev
```

Then import the demo wallet printed by the script (anvil account #1, "maya.qie", a public test key) into your wallet, add the network `http://127.0.0.1:8545` with chain id 1983, and open http://localhost:3000. Today's check-in is open on her meditation pact, and the demo verifier approves any photo (it can never run on mainnet).

**Manual deploy to a fork:**

```bash
anvil --fork-url https://rpc1mainnet.qie.digital/ --chain-id 1983 &
cd contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
ORACLE_SIGNER_ADDRESS=<verifier address> \
PRICE_FEED_ADDRESS=0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17 \
BADGE_BASE_URI=http://localhost:3000/api/badge/ SEED_REWARD_POOL_WEI=20000000000000000000 \
forge script script/DeployPactiq.s.sol --rpc-url local --broadcast
# (that PRIVATE_KEY is anvil's public test account; never use it on a real network)
# Then in frontend/.env.local set NEXT_PUBLIC_QIE_NETWORK=testnet, NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545,
# NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS=<vault>, NEXT_PUBLIC_APP_URL=http://localhost:3000,
# ORACLE_PRIVATE_KEY=<verifier key>, and LLM_API_KEY=<0G Compute key> or PACTIQ_DEMO_VERIFIER=true
```

Tests: `cd contracts && forge test` (plus `QIE_FORK=1 forge test --match-contract QieMainnetFork` against live mainnet) · `cd frontend && pnpm lint && pnpm test && pnpm build`

## Deploy to QIE Mainnet

> QIE runs the **Shanghai** EVM (it supports `PUSH0` but not Cancun's `MCOPY`/`TLOAD`). `foundry.toml` targets `shanghai`, and the contracts avoid OpenZeppelin modules that need Cancun. Don't change it.

1. **Create two keys:** a deployer/owner key funded with QIE, and a separate verifier key (`cast wallet new`) that needs no funds.
2. **Deploy** (the script links the vault and badges, deploys the QIE ID verifier and lists QUSDC at 0.10/day):
   ```bash
   cd contracts
   export PRIVATE_KEY=<deployer key> ORACLE_SIGNER_ADDRESS=<verifier address>
   export BADGE_BASE_URI=https://<your-app>/api/badge/
   export SEED_REWARD_POOL_WEI=<optional>  CHARITY_ADDRESS=<optional, verified cause>  CHARITY_NAME="<name>"
   forge script script/DeployPactiq.s.sol --rpc-url qie_mainnet --broadcast
   ```
3. **Verify both contracts on the QIE explorer (Blockscout):**
   ```bash
   forge verify-contract <vault> src/PactiqVault.sol:PactiqVault --chain-id 1990 \
     --verifier blockscout --verifier-url https://mainnet.qie.digital/api/ \
     --constructor-args $(cast abi-encode "constructor(address,address)" <verifier address> 0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17)
   forge verify-contract <badges> src/PactiqBadges.sol:PactiqBadges --chain-id 1990 \
     --verifier blockscout --verifier-url https://mainnet.qie.digital/api/ \
     --constructor-args $(cast abi-encode "constructor(string)" "https://<your-app>/api/badge/")
   forge verify-contract <qie id verifier> src/QieNameVerifier.sol:QieNameVerifier --chain-id 1990 \
     --verifier blockscout --verifier-url https://mainnet.qie.digital/api/ \
     --constructor-args $(cast abi-encode "constructor(address,address,address)" 0x26cCB3fABd6db18834987134d715Ba2346CE7223 0x1D69d75AD7b77b91C3760F84faC52E651710f62e 0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E)
   ```
4. **Host the frontend** (e.g. Vercel with root directory `frontend`). Set `NEXT_PUBLIC_QIE_NETWORK=mainnet`, `NEXT_PUBLIC_PACTIQ_CONTRACT_ADDRESS`, `NEXT_PUBLIC_APP_URL`, `ORACLE_PRIVATE_KEY` and `LLM_API_KEY` (a 0G Compute Router key; set `LLM_MODEL` to change the vision model). The demo verifier is automatically disabled on mainnet.
5. **Seed traction:** create a sponsored launch challenge, invite friends to a squad, and record the demo video.

If the ABI changes: `cd contracts && forge build && cd ../frontend && pnpm abi`.

## Testing the AI witness on real photos

A wrongly rejected genuine photo costs a user money, so test the witness before launch. Put real check-in photos in `frontend/witness-photos/` (git-ignored), named `<pass|fail>-<category>-<code>[-note].jpg`, for example `pass-fitness-4821-gym.jpg` or `fail-coding-7742-screenshot.png`, then run:

```bash
cd frontend && pnpm witness:eval            # add --runs 3 to check consistency
```

It uses the same prompt, model and pass rules as the live route and lists every wrong verdict with the reason.

## Known limitations

- The vision verifier raises the cost of cheating a lot, but it isn't perfect. The signer key can be rotated with `setOracleSigner`.
- Rate limits and reminder subscribers live in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Without them they fall back to server memory, which only suits local development.
- Closed-app reminders use web push. Something must call `GET /api/push/cron` hourly with `Authorization: Bearer $CRON_SECRET`; `.github/workflows/reminders.yml` does this once its two secrets are set. On iPhone, web push only works after the site is added to the home screen.
- A `.qie` name is checked when a pact is signed. If the name is transferred later, past pacts keep the name they were signed with.
- QIE and QUSDC are the only listed stake assets. The owner lists assets; fee-on-transfer tokens are refused at deposit.
- The charity list is owner-curated.
- Squads have at most 100 members, and members settle after the squad ends, even with a perfect run.
- The solo completion bonus is paid first come, first served from the current pool. The UI shows the estimate at today's pool size.

## License

MIT
