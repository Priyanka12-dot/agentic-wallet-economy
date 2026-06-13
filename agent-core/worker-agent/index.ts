/**
 * worker-agent/index.ts
 *
 * Entry point for the AgentSwap Worker Agent.
 * Run with: npx ts-node worker-agent/index.ts
 */

import "dotenv/config";
import { WalletManager }         from "./wallet-manager";
import { TaskExecutor }          from "./task-executor";
import { OnChainLogger }         from "./onchain-logger";
import { WorkerDecisionEngine }  from "./decision-engine";
import { logger }                from "../shared/utils";
import { ACTIVE_NETWORK }        from "../shared/constants";

const AGENT_NAME = "WORKER";

async function main() {
  logger.separator();
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   AgentSwap — Worker Agent              ║
  ║   ERC-8004 Autonomous Labor Economy     ║
  ╚══════════════════════════════════════════╝
  `);
  logger.info(AGENT_NAME, `Starting on ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId})`);
  logger.separator();

  // ── Initialize modules ─────────────────────────────────────────────────────
  const walletManager = new WalletManager();
  await walletManager.logBalance();

  const signer        = walletManager.getSigner();
  const onChainLogger = new OnChainLogger(signer);
  const taskExecutor  = new TaskExecutor(signer);
  const decisionEngine = new WorkerDecisionEngine(signer, taskExecutor, onChainLogger);

  // ── Check identity NFT ─────────────────────────────────────────────────────
  const profile = await onChainLogger.getProfile();
  if (profile) {
    logger.ok(AGENT_NAME, `Identity NFT found: "${profile.name}" | Rep: ${profile.reputationScore}`);
  } else {
    logger.warn(AGENT_NAME, "No ERC-8004 identity found. Run scripts/mint-identity.ts first.");
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  process.on("SIGINT",  () => { decisionEngine.stop(); process.exit(0); });
  process.on("SIGTERM", () => { decisionEngine.stop(); process.exit(0); });

  // ── Start autonomous loop ──────────────────────────────────────────────────
  await decisionEngine.start();
}

main().catch((err) => {
  logger.error(AGENT_NAME, `Fatal error: ${err.message}`);
  process.exit(1);
});
