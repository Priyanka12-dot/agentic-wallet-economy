import { logger, sleep } from "../shared/utils";
import { AGENT_CONFIG }   from "../shared/constants";
import { TaskGenerator }  from "./task-generator";
import { PaymentEngine }  from "./payment-engine";

const AGENT_NAME = "CONSUMER";

/**
 * ConsumerDecisionEngine
 *
 * The Consumer agent's autonomous loop.
 *
 * Every CONSUMER_POST_INTERVAL_MS (default: 15s) the engine:
 *   1. Generates a new randomised task via TaskGenerator.
 *   2. Posts it to SimpleEconomy with mETH locked via PaymentEngine.
 *   3. Logs the intent on-chain via ERC-8004 (happens inside postTask).
 *   4. Monitors pending tasks for completion or expiry.
 *
 * The consumer operates entirely autonomously, continuously flooding the
 * market with tasks to create an on-chain activity stream.
 */
export class ConsumerDecisionEngine {
  private generator: TaskGenerator;
  private payment:   PaymentEngine;
  private running:   boolean = false;
  private loopCount: number  = 0;

  // Track posted task IDs to monitor for expiry
  private pendingTaskIds: string[] = [];

  constructor(generator: TaskGenerator, payment: PaymentEngine) {
    this.generator = generator;
    this.payment   = payment;
  }

  // ─── Main Loop ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.running = true;
    logger.ok(AGENT_NAME, "Decision engine started. Generating tasks…");

    while (this.running) {
      try {
        await this._decisionLoop();
      } catch (err: any) {
        logger.error(AGENT_NAME, `Decision loop error: ${err.message}`);
      }

      await sleep(AGENT_CONFIG.CONSUMER_POST_INTERVAL_MS);
    }
  }

  stop(): void {
    this.running = false;
    logger.warn(AGENT_NAME, "Decision engine stopped.");
  }

  // ─── Core Loop ──────────────────────────────────────────────────────────────

  private async _decisionLoop(): Promise<void> {
    this.loopCount++;
    logger.separator();
    logger.info(AGENT_NAME, `Consumer loop #${this.loopCount}`);

    // ── 1. Generate a new task ─────────────────────────────────────────────
    const { description, payment } = this.generator.generateTask();

    // ── 2. Post to SimpleEconomy ───────────────────────────────────────────
    const taskId = await this.payment.postTask(description, payment);

    if (taskId) {
      this.pendingTaskIds.push(taskId);
    }

    // ── 3. Log current stats ───────────────────────────────────────────────
    const rep        = await this.payment.getReputation();
    const totalTasks = await this.payment.getTotalTasks();

    logger.info(AGENT_NAME, `Reputation: ${rep} | Total tasks on-chain: ${totalTasks}`);
    logger.info(AGENT_NAME, `Pending (unmonitored) tasks: ${this.pendingTaskIds.length}`);
  }

  getStats() {
    return {
      loopCount:    this.loopCount,
      totalPosted:  this.generator.getTotalGenerated(),
      pendingCount: this.pendingTaskIds.length,
    };
  }
}
