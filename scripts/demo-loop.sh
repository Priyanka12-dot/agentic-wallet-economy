#!/usr/bin/env bash
# scripts/demo-loop.sh
# ─────────────────────────────────────────────────────────────
# AgentSwap Full Demo Orchestrator
#
# Runs the complete end-to-end flow for the hackathon demo:
#   1. Deploy contracts to Mantle Sepolia
#   2. Mint ERC-8004 identity NFTs for both agents
#   3. Fund agent wallets with test mETH
#   4. Start Consumer agent (background)
#   5. Start Worker agent (background)
#   6. Launch dashboard dev server
#   7. Tail both agent logs to terminal
#
# Usage: ./scripts/demo-loop.sh
# Stop:  Ctrl+C  (kills all background processes)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_CORE="$ROOT_DIR/agent-core"
DASHBOARD="$ROOT_DIR/dashboard"

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[0;33m'; BOLD='\033[1m'; NC='\033[0m'

# PIDs for cleanup
WORKER_PID=""
CONSUMER_PID=""
DASHBOARD_PID=""

log()    { echo -e "${CYAN}[demo]${NC} $*"; }
ok()     { echo -e "${GREEN}[demo] ✓${NC} $*"; }
warn()   { echo -e "${YELLOW}[demo] ⚠${NC} $*"; }
error()  { echo -e "${RED}[demo] ✗${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}$*${NC}\n"; }

cleanup() {
  echo ""
  warn "Shutting down demo…"
  [[ -n "$WORKER_PID" ]]    && kill "$WORKER_PID"    2>/dev/null && ok "Worker stopped"
  [[ -n "$CONSUMER_PID" ]]  && kill "$CONSUMER_PID"  2>/dev/null && ok "Consumer stopped"
  [[ -n "$DASHBOARD_PID" ]] && kill "$DASHBOARD_PID" 2>/dev/null && ok "Dashboard stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────────────
# 0. Banner
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   AgentSwap — Full Demo Orchestrator               ║"
echo "  ║   Turing Test Hackathon 2026 · Track 6             ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────
# 1. Load .env
# ─────────────────────────────────────────────────────────────
header "STEP 1 — Loading environment"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  error ".env not found. Copy .env.example and fill in your keys."
  exit 1
fi

set -o allexport
source "$ROOT_DIR/.env"
set +o allexport
ok "Environment loaded"

# ─────────────────────────────────────────────────────────────
# 2. Install dependencies
# ─────────────────────────────────────────────────────────────
header "STEP 2 — Installing dependencies"

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  log "Installing root (Hardhat) dependencies…"
  cd "$ROOT_DIR" && npm install
fi

if [[ ! -d "$AGENT_CORE/node_modules" ]]; then
  log "Installing agent-core dependencies…"
  cd "$AGENT_CORE" && npm install
fi

if [[ ! -d "$DASHBOARD/node_modules" ]]; then
  log "Installing dashboard dependencies…"
  cd "$DASHBOARD" && npm install
fi

ok "All dependencies ready"

# ─────────────────────────────────────────────────────────────
# 3. Compile & deploy contracts (if not already deployed)
# ─────────────────────────────────────────────────────────────
header "STEP 3 — Deploying contracts to Mantle Sepolia"

if [[ -z "${AGENT_IDENTITY_ADDRESS:-}" || "${AGENT_IDENTITY_ADDRESS}" == "0x000"* ]]; then
  log "No deployed addresses found — compiling and deploying…"
  cd "$ROOT_DIR"
  npx hardhat compile
  npx hardhat run contracts/migrations/1_deploy.js --network mantle_sepolia

  # Read addresses from deployed-addresses.json
  if [[ -f "$ROOT_DIR/deployed-addresses.json" ]]; then
    AGENT_IDENTITY_ADDRESS=$(node -e "console.log(require('./deployed-addresses.json').AgentIdentity)")
    SIMPLE_ECONOMY_ADDRESS=$(node  -e "console.log(require('./deployed-addresses.json').SimpleEconomy)")
    export AGENT_IDENTITY_ADDRESS SIMPLE_ECONOMY_ADDRESS

    # Append to .env so agents pick them up
    echo "" >> "$ROOT_DIR/.env"
    echo "AGENT_IDENTITY_ADDRESS=$AGENT_IDENTITY_ADDRESS" >> "$ROOT_DIR/.env"
    echo "SIMPLE_ECONOMY_ADDRESS=$SIMPLE_ECONOMY_ADDRESS" >> "$ROOT_DIR/.env"
    ok "Addresses appended to .env"
  fi
else
  ok "Contracts already deployed (using existing addresses)"
  log "AgentIdentity : $AGENT_IDENTITY_ADDRESS"
  log "SimpleEconomy : $SIMPLE_ECONOMY_ADDRESS"
fi

# ─────────────────────────────────────────────────────────────
# 4. Mint ERC-8004 identity NFTs
# ─────────────────────────────────────────────────────────────
header "STEP 4 — Minting ERC-8004 identity NFTs"
cd "$AGENT_CORE"
npx ts-node --transpile-only ../scripts/mint-identity.ts && ok "Identity NFTs minted"

# ─────────────────────────────────────────────────────────────
# 5. Fund agent wallets
# ─────────────────────────────────────────────────────────────
header "STEP 5 — Funding agent wallets"
npx ts-node --transpile-only ../scripts/fund-wallets.ts && ok "Wallets funded"

# ─────────────────────────────────────────────────────────────
# 6. Start agents in background
# ─────────────────────────────────────────────────────────────
header "STEP 6 — Starting autonomous agents"

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

log "Starting Consumer agent → logs/consumer.log"
cd "$AGENT_CORE"
npx ts-node --transpile-only consumer-agent/index.ts > "$LOG_DIR/consumer.log" 2>&1 &
CONSUMER_PID=$!
ok "Consumer PID: $CONSUMER_PID"

sleep 2  # slight stagger so consumer posts a task before worker polls

log "Starting Worker agent → logs/worker.log"
npx ts-node --transpile-only worker-agent/index.ts > "$LOG_DIR/worker.log" 2>&1 &
WORKER_PID=$!
ok "Worker PID: $WORKER_PID"

# ─────────────────────────────────────────────────────────────
# 7. Start dashboard
# ─────────────────────────────────────────────────────────────
header "STEP 7 — Starting live dashboard"

cd "$DASHBOARD"
npm run dev > "$LOG_DIR/dashboard.log" 2>&1 &
DASHBOARD_PID=$!
sleep 2

ok "Dashboard running at http://localhost:5173"
echo ""

# ─────────────────────────────────────────────────────────────
# 8. Tail both agent logs
# ─────────────────────────────────────────────────────────────
header "STEP 8 — Live agent output (Ctrl+C to stop)"
echo -e "${YELLOW}Tailing logs/worker.log and logs/consumer.log simultaneously…${NC}\n"

tail -f "$LOG_DIR/worker.log" "$LOG_DIR/consumer.log"
