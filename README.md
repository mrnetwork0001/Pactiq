# Pactiq — Proof-of-Discipline Staking Protocol on QIE Mainnet

Built for **QIE Blockchain Hackathon 3.0** (`http://hackathon.qie.digital/`)  
**Track:** Consumer Apps / AI & Autonomous Agents

---

## ⚡ The Problem & Philosophy
Most Web3 apps on early-stage L1s suffer from the cold-start problem: complex DeFi apps and speculative NFT directories sit empty with zero active human usage, or are farmed by automated airdrop bots.

**Pactiq is built on a simple premise:**
> **Real humans, not bots. Real everyday utility. Guaranteed daily on-chain active usage.**

Instead of relying on third-party merchants to adopt QIE, users stake QIE on their **own discipline** (fitness, coding, studying, deep work). Every day before midnight, they must submit authentic proof.

---

## 🛡️ How Pactiq Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PACTIQ ARCHITECTURE                             │
│                                                                        │
│  [Real User on Phone]                                                  │
│          │                                                             │
│          ▼ (Takes photo with dynamic gesture / proof)                  │
│  [Pactiq Web App] ───► [AI Proof Validator (Gemini Vision)]            │
│          │                         │                                   │
│          │                         ▼ (Verifies authentic human task)   │
│          │             [ECDSA Oracle Attestation]                      │
│          │                         │                                   │
│          ▼                         ▼                                   │
│  [QIE Mainnet Smart Contract (Chain ID: 5656)]                         │
│  ├── PactiqVault.sol (Stores QIE stakes)                               │
│  ├── Daily Check-in & Streak Engine                                   │
│  └── Slash Pool (Distributes defaulters' stakes to completers)        │
│          │                                                             │
│          ▼                                                             │
│  [QIE ID (.qie) Streak Leaderboard & QIE Pass Verified Badge]          │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Commit & Stake:** A user initiates a 7, 14, 21, or 30-day pact, locking e.g. 5 QIE/day into the `PactiqVault.sol` contract.
2. **Anti-Bot Dynamic Challenge:** Every day, Pactiq issues a dynamic anti-spoof challenge (e.g. *"Show Code #742 written in frame"* or *"Hold up 2 fingers (✌️) in front of your gym equipment/IDE"*).
3. **Multimodal AI Attestation:** AI analyzes the live photo for authentic equipment/code and dynamic challenge detection, then signs an ECDSA message.
4. **On-Chain Check-In:** The user submits the attestation directly to `PactiqVault.sol` on QIE Mainnet.
5. **The Slash Pool Payoff:**
   * **100% Completers:** Reclaim **100% of their staked principal** + **up to 15% bonus yield** from the Slash Pool.
   * **QIE Pass Holders:** Earn a **20% bonus boost** on the Slash Pool.
   * **Defaulters:** Missed days are slashed into the community reward pool.

---

## 🌐 QIE Ecosystem Integration

* **QIE Mainnet (Chain ID 5656):**
  * RPC: `https://rpc-main1.qiblockchain.online/`
  * Currency: `QIE`
  * Explorer: `https://mainnet.qiblockchain.online`
* **QIE ID:** Public streak handles (e.g. `satoshi.qie`, `builder.qie`, `alex.qie`).
* **QIE Pass:** Sybil-resistant KYC credential unlocks higher reward tiers and zero protocol commission.

---

## 📂 Repository Structure

```
Pactiq/
├── contracts/               # Foundry Smart Contract Suite
│   ├── src/
│   │   └── PactiqVault.sol  # Staking, check-in, streak & slash vault
│   ├── test/
│   │   └── PactiqVault.t.sol# 7 unit tests (100% pass)
│   ├── script/
│   │   └── DeployPactiq.s.sol # QIE Mainnet deployment script
│   └── foundry.toml         # QIE RPC & Solidity 0.8.24 via-ir config
└── frontend/                # Next.js 14 + Tailwind CSS + Viem
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx     # Dashboard, Pacts, Squads, Leaderboard
    │   │   └── api/verify-proof/route.ts # AI Attestation & ECDSA Oracle
    │   ├── components/      # UI components & Modals
    │   └── lib/             # QIE config, types, and mock data
```

---

## 🚀 Running Locally

### 1. Smart Contracts
```bash
cd contracts
forge test
forge build
```

To deploy to QIE Mainnet:
```bash
forge script script/DeployPactiq.s.sol --rpc-url qie_mainnet --broadcast --private-key <YOUR_PRIVATE_KEY>
```

### 2. Frontend
```bash
cd frontend
pnpm install
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dApp.
