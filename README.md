# ⚡ AgentSwap — Autonomous On-Chain Labor Economy

> **Turing Test Hackathon 2026 · Track 6: Agentic Wallets & Economy**  
> Built on Mantle Network · ERC-8004 · Byreal Skills CLI

[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia%20Testnet-22d3ee?style=flat-square)](https://explorer.sepolia.mantle.xyz)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent%20Identity-a855f7?style=flat-square)](https://docs.mantle.xyz)
[![Track 6](https://img.shields.io/badge/Track%206-Agentic%20Wallets%20%26%20Economy-22c55e?style=flat-square)](https://turingtesthackathon.com)

---

## Overview

AgentSwap is a self-contained **agentic micro-economy** on Mantle Network where two fully autonomous AI agents — a **Worker** and a **Consumer** — transact, build reputation, and create verifiable on-chain value with zero human intervention.

The **Consumer** agent autonomously generates random swap tasks and posts them to a Solidity smart contract with escrowed `mETH` as payment. The **Worker** agent polls for open tasks, makes an independent accept/reject decision, executes the swap via Agni Finance (Mantle's native DEX), and logs every decision to its **ERC-8004 identity NFT**. Once complete, the Consumer's escrow is automatically released to the Worker.

A **live React dashboard** streams all on-chain events in real time — anyone can watch the agents operate and verify every transaction on Mantlescan.

---

## Three Hackathon Pillars — Directly Addressed

| Pillar | Implementation |
|---|---|
| **On-chain benchmarking** | Every agent decision calls `AgentIdentity.logDecision()`, writing an immutable `DecisionLogged` event to Mantle. |
| **ERC-8004 agent identity** | Each agent holds a unique NFT minted by `AgentIdentity.sol`. The NFT accumulates a live reputation score (+/- per outcome). |
| **Radical transparency** | The React dashboard polls Mantle for all `DecisionLogged`, `TaskPosted`, and `TaskCompleted` events and displays them as a live feed. |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Mantle Network                 │
│  ┌──────────────────────────────────────┐  │
│  │  AgentIdentity.sol  (ERC-8004)       │  │
│  │  └─ Decision log · Reputation NFTs  │  │
│  │  SimpleEconomy.sol                   │  │
│  │  └─ Task escrow · Payment routing   │  │
│  └──────────────────────────────────────┘  │
└────────────────────┬────────────────────────┘
                     │ ethers.js v6
        ┌────────────┴─────────────┐
        │     Agent Core           │
        │  Worker ←── polls ───►  │
        │  Consumer ──posts──►    │
        │  Byreal Skills CLI       │
        │  (wallet signing)        │
        └────────────┬─────────────┘
                     │ events
        ┌────────────┴─────────────┐
        │   React Dashboard        │
        │   Live DecisionLog feed  │
        │   Agent reputation cards │
        └──────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Mantle Network (Sepolia Testnet → Mainnet) |
| Agent Identity | ERC-8004 — Custom Solidity (`AgentIdentity.sol`) |
| Smart Contracts | Solidity `^0.8.20` + OpenZeppelin v5 |
| Agent Runtime | Node.js + TypeScript + Byreal Skills CLI |
| Web3 Interaction | ethers.js v6 |
| DEX Execution | Agni Finance (Uniswap V3 fork on Mantle) |
| Frontend | React 18 + Vite + TypeScript |
| Dev Environment | Hardhat |
| Gas | Mantle native low fees (<$0.01/tx) |

---

## Project Structure

```
agentic-wallet-economy/
├── contracts/
│   ├── AgentIdentity.sol          # ERC-8004: identity NFT + decision logging
│   ├── SimpleEconomy.sol          # Task escrow + payment routing
│   └── migrations/1_deploy.js    # Hardhat deploy script
│
├── agent-core/
│   ├── byreal-config/             # Byreal Skills CLI settings + wallet config
│   ├── worker-agent/              # Autonomous worker (polls + executes tasks)
│   │   ├── index.ts
│   │   ├── decision-engine.ts     # Main decision loop (every 10s)
│   │   ├── task-executor.ts       # DEX swap execution via Agni Finance
│   │   ├── onchain-logger.ts      # Writes to ERC-8004 contract
│   │   └── wallet-manager.ts     # Byreal wallet integration
│   ├── consumer-agent/            # Autonomous consumer (generates + posts tasks)
│   │   ├── index.ts
│   │   ├── decision-engine.ts     # Main posting loop (every 15s)
│   │   ├── task-generator.ts      # Randomised task descriptions
│   │   ├── payment-engine.ts      # Posts tasks with escrowed mETH
│   │   └── wallet-manager.ts
│   └── shared/
│       ├── types.ts               # All TypeScript interfaces
│       ├── constants.ts           # RPC, contract addresses, ABIs
│       └── utils.ts               # Gas helpers, logging, task parsing
│
├── dashboard/                     # React live transparency dashboard
│   └── src/
│       ├── components/
│       │   ├── AgentCard.tsx      # ERC-8004 identity + reputation display
│       │   ├── DecisionLog.tsx    # Scrollable on-chain event feed
│       │   └── LiveStream.tsx     # Ticker + economy stats
│       ├── hooks/useChainData.ts  # Polls Mantle every 10s + live subscription
│       ├── services/eventFetcher.ts
│       └── pages/index.tsx        # Main dashboard layout
│
├── scripts/
│   ├── mint-identity.ts           # Mint ERC-8004 NFTs for agents
│   ├── fund-wallets.ts            # Send test mETH to agent wallets
│   ├── start-worker.sh
│   ├── start-consumer.sh
│   └── demo-loop.sh               # Full end-to-end demo orchestrator
│
├── tests/
│   ├── contracts/SimpleEconomy.test.js
│   └── agents/decision-engine.test.ts
│
├── hardhat.config.js
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Test mETH on Mantle Sepolia — [faucet.sepolia.mantle.xyz](https://faucet.sepolia.mantle.xyz)
- Three wallets: deployer, worker, consumer (generate with MetaMask or `ethers.Wallet.createRandom()`)

### 1. Clone & install

```bash
git clone https://github.com/your-handle/agentswap
cd agentswap

# Install root (Hardhat) deps
npm install

# Install agent-core deps
cd agent-core && npm install && cd ..

# Install dashboard deps
cd dashboard && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in private keys and contract addresses
```

### 3. Deploy contracts

```bash
npm run deploy
# Addresses are saved to deployed-addresses.json
# Copy them into .env as AGENT_IDENTITY_ADDRESS and SIMPLE_ECONOMY_ADDRESS
```

### 4. Mint agent identities & fund wallets

```bash
npm run mint    # Mints ERC-8004 NFTs for worker + consumer
npm run fund    # Sends test mETH from deployer to both agents
```

### 5. Run the full demo

```bash
# Option A: Full orchestration (recommended)
npm run demo

# Option B: Manually in separate terminals
npm run consumer   # Terminal 1
npm run worker     # Terminal 2
npm run dashboard  # Terminal 3 → http://localhost:5173
```

### 6. Run tests

```bash
npm test                    # All tests
npm run test:contracts      # Hardhat contract tests
npm run test:agents         # Jest agent unit tests
```

---

## Smart Contracts

### `AgentIdentity.sol` — ERC-8004

Extends ERC-721 with on-chain decision logging and reputation tracking.

| Function | Description |
|---|---|
| `mintIdentity(agent, name, role)` | Mint a unique identity NFT for an agent |
| `logDecision(agent, taskId, decision, details, delta)` | Append a decision to the agent's immutable record |
| `getProfile(agent)` | Read full agent profile including reputation |
| `getReputation(agent)` | Quick reputation score lookup |

**Events emitted:**
- `AgentMinted` — new agent identity created
- `DecisionLogged` — every agent decision recorded on-chain
- `ReputationUpdated` — score changed after an outcome

### `SimpleEconomy.sol`

Task escrow and payment routing between agents.

| Function | Description |
|---|---|
| `postTask(description)` | Consumer locks mETH in escrow, creates task |
| `acceptTask(taskId)` | Worker claims a task (reputation check enforced) |
| `completeTask(taskId, proof)` | Worker reports completion, payment released |
| `failTask(taskId, reason)` | Worker reports failure, consumer refunded |
| `reclaimTask(taskId)` | Consumer reclaims funds from expired task |

---

## Agent Behaviour

### Worker Agent
- Polls `getOpenTasks()` every **10 seconds**
- Selects highest-paying open task (greedy strategy)
- Checks task deadline before accepting
- Executes swap via Agni Finance on Mantle
- Reports outcome (complete/fail) and receives/foregoes payment
- Every decision logged to ERC-8004 with reputation delta

### Consumer Agent
- Generates a randomised swap task every **15 seconds**
- Posts task to `SimpleEconomy` with `0.01 mETH` escrowed
- Task templates include various mETH/USDC/USDT swap pairs
- Amount varied ±20% to ensure unique task IDs on-chain
- Reputation boosted for task posting activity

---

## Live Dashboard

The React dashboard at `http://localhost:5173` shows:

- **Live ticker** — scrolling feed of all recent agent decisions
- **Agent identity cards** — ERC-8004 NFT info, reputation bar, decision stats
- **Decision log** — full on-chain event history with Mantlescan tx links
- **Economy stats** — block height, total decisions, success rate, avg reputation

Data updates every **10 seconds** via polling + real-time WebSocket subscription to `DecisionLogged` events.

---

## Gas Efficiency

Mantle's native low-fee architecture keeps all agent operations under **$0.01/tx**:

| Operation | Estimated Gas | Cost (Mantle) |
|---|---|---|
| `postTask` | ~120,000 | <$0.001 |
| `acceptTask` | ~80,000 | <$0.001 |
| `completeTask` (+ ERC-8004 log) | ~180,000 | <$0.002 |
| `logDecision` | ~60,000 | <$0.001 |

---

## Acknowledgements

Built with love for the **Turing Test Hackathon 2026** powered by:
- [Mantle Network](https://mantle.xyz) — L2 infrastructure
- [Byreal](https://byreal.ai) — Agent wallet SDK
- [Agni Finance](https://agni.finance) — Mantle DEX
- [OpenZeppelin](https://openzeppelin.com) — Contract libraries

---

*AgentSwap demonstrates that autonomous agents can own wallets, transact, and build reputation without human approval — the foundation of the next wave of Web3.*
