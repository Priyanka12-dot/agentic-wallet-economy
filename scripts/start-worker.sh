#!/usr/bin/env bash
# scripts/start-worker.sh
# ─────────────────────────────────────────────────────────────
# Start the AgentSwap Worker Agent
# Usage: ./scripts/start-worker.sh [--watch]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_CORE="$ROOT_DIR/agent-core"

# ── Load .env from project root ──────────────────────────────
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -o allexport
  source "$ROOT_DIR/.env"
  set +o allexport
  echo "✅  Loaded .env"
else
  echo "⚠️   No .env found at $ROOT_DIR/.env"
  echo "    Copy .env.example and fill in your values before running."
  exit 1
fi

# ── Check required env vars ──────────────────────────────────
REQUIRED_VARS=("WORKER_PRIVATE_KEY" "AGENT_IDENTITY_ADDRESS" "SIMPLE_ECONOMY_ADDRESS" "MANTLE_RPC_URL")
MISSING=()

for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    MISSING+=("$VAR")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌  Missing required environment variables:"
  for V in "${MISSING[@]}"; do
    echo "    - $V"
  done
  echo "    Fill these in your .env file."
  exit 1
fi

# ── Check node_modules ───────────────────────────────────────
if [[ ! -d "$AGENT_CORE/node_modules" ]]; then
  echo "📦  Installing agent-core dependencies…"
  cd "$AGENT_CORE" && npm install
fi

# ── Start worker ─────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Starting AgentSwap Worker Agent       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

cd "$AGENT_CORE"

if [[ "${1:-}" == "--watch" ]]; then
  # Watch mode with ts-node-dev for development
  npx ts-node-dev --respawn --transpile-only worker-agent/index.ts
else
  npx ts-node --transpile-only worker-agent/index.ts
fi
