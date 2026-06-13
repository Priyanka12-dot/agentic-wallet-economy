/**
 * consumer-agent/index.ts
 *
 * Entry point for the AgentSwap Consumer Agent.
 * Run with: npx ts-node consumer-agent/index.ts
 */

import "dotenv/config";
import { WalletManager }          from "./wallet-manager";
import { TaskGenerator }          from "./task-generator";
import { PaymentEngine }          from "./payment-engine";
import { ConsumerDecisionEngine } from "./decision-engine";
import { logger }                 from "../shared/utils";
import { ACTIVE_NETWORK }         from "../shared/constants";

const AGENT_NAME = "CONSUMER";

async function main() {
  logger.separator();
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   AgentSwap — Consumer Agent            ║
  ║   ERC-8004 Autonomous Labor Economy     ║
  ╚══════════════════════════════════════════╝
  `);
  logger.info(AGENT_NAME, `Starting on ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId})`);
  logger.separator();

  // ── Initialize modules ─────────────────────────────────────────────────────
  const walletManager = new WalletManager();
  await walletManager.logBalance();

  const signer        = walletManager.getSigner();
  const taskGenerator = new TaskGenerator();
  const paymentEngine = new PaymentEngine(signer);
  const decisionEngine = new ConsumerDecisionEngine(taskGenerator, paymentEngine);

  // ── Check identity NFT ─────────────────────────────────────────────────────
  const rep = await paymentEngine.getReputation();
  logger.info(AGENT_NAME, rep > 0
    ? `ERC-8004 identity active. Current reputation: ${rep}`
    : "No ERC-8004 identity found. Run scripts/mint-identity.ts first."
  );

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
