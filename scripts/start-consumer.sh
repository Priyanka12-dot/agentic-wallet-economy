#!/usr/bin/env bash
# scripts/start-consumer.sh
# ─────────────────────────────────────────────────────────────
# Start the AgentSwap Consumer Agent
# Usage: ./scripts/start-consumer.sh [--watch]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_CORE="$ROOT_DIR/agent-core"

# ── Load .env ────────────────────────────────────────────────
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
REQUIRED_VARS=("CONSUMER_PRIVATE_KEY" "AGENT_IDENTITY_ADDRESS" "SIMPLE_ECONOMY_ADDRESS" "MANTLE_RPC_URL")
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
  exit 1
fi

# ── Check node_modules ───────────────────────────────────────
if [[ ! -d "$AGENT_CORE/node_modules" ]]; then
  echo "📦  Installing agent-core dependencies…"
  cd "$AGENT_CORE" && npm install
fi

# ── Start consumer ───────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Starting AgentSwap Consumer Agent     ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

cd "$AGENT_CORE"

if [[ "${1:-}" == "--watch" ]]; then
  npx ts-node-dev --respawn --transpile-only consumer-agent/index.ts
else
  npx ts-node --transpile-only consumer-agent/index.ts
fi
