import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  SIMPLE_ECONOMY_ABI,
  AGENT_CONFIG,
} from "../shared/constants";
import { logger, rawToTask, sleep, explorerTx, formatTaskId } from "../shared/utils";
import { TaskExecutor } from "./task-executor";
import { OnChainLogger } from "./onchain-logger";
import type { Task } from "../shared/types";

const AGENT_NAME = "WORKER";

/**
 * WorkerDecisionEngine
 *
 * The autonomous decision loop for the Worker agent.
 *
 * Every DECISION_INTERVAL_MS (default: 10s) the engine:
 *   1. Polls SimpleEconomy for open tasks.
 *   2. Evaluates each task (reputation check, profitability heuristic).
 *   3. Accepts one task and executes it.
 *   4. Logs the outcome to ERC-8004 and calls completeTask/failTask.
 *
 * The worker operates entirely autonomously — no human approval needed.
 */
export class WorkerDecisionEngine {
  private economy:   ethers.Contract;
  private signer:    ethers.Wallet;
  private executor:  TaskExecutor;
  private logger_:   OnChainLogger;
  private running:   boolean = false;
  private tasksDone: number  = 0;

  constructor(signer: ethers.Wallet, executor: TaskExecutor, onChainLogger: OnChainLogger) {
    this.signer   = signer;
    this.executor = executor;
    this.logger_  = onChainLogger;

    this.economy = new ethers.Contract(
      CONTRACT_ADDRESSES.SIMPLE_ECONOMY,
      SIMPLE_ECONOMY_ABI,
      signer
    );
  }

  // ─── Main Loop ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.running = true;
    logger.ok(AGENT_NAME, "Decision engine started. Polling for tasks…");

    while (this.running) {
      try {
        await this._decisionLoop();
      } catch (err: any) {
        logger.error(AGENT_NAME, `Decision loop error: ${err.message}`);
      }

      await sleep(AGENT_CONFIG.DECISION_INTERVAL_MS);
    }
  }

  stop(): void {
    this.running = false;
    logger.warn(AGENT_NAME, "Decision engine stopped.");
  }

  // ─── Core Decision Loop ─────────────────────────────────────────────────────

  private async _decisionLoop(): Promise<void> {
    logger.separator();
    logger.info(AGENT_NAME, `Decision loop #${this.tasksDone + 1} | Scanning open tasks…`);

    // 1. Fetch open task IDs
    const openTaskIds: string[] = await this.economy.getOpenTasks();

    if (openTaskIds.length === 0) {
      logger.info(AGENT_NAME, "No open tasks found. Idling…");
      return;
    }

    logger.info(AGENT_NAME, `Found ${openTaskIds.length} open task(s)`);

    // 2. Evaluate each task and pick the best one
    const candidates: Task[] = [];
    for (const taskId of openTaskIds) {
      try {
        const raw  = await this.economy.getTask(taskId);
        const task = rawToTask(raw);

        // Skip expired tasks
        if (Date.now() / 1000 > task.deadline) {
          logger.warn(AGENT_NAME, `Task ${formatTaskId(task.id)} expired, skipping`);
          continue;
        }

        candidates.push(task);
      } catch {
        // Task may have been claimed by another worker between polling calls
      }
    }

    if (candidates.length === 0) {
      logger.info(AGENT_NAME, "All visible tasks expired or unavailable. Idling…");
      return;
    }

    // 3. Pick the highest-paying task (simple greedy strategy)
    const chosen = candidates.sort((a, b) =>
      b.payment > a.payment ? 1 : -1
    )[0];

    logger.info(
      AGENT_NAME,
      `Selected task ${formatTaskId(chosen.id)}: "${chosen.description}" (${ethers.formatEther(chosen.payment)} mETH)`
    );

    await this._processTask(chosen);
  }

  // ─── Task Processing ────────────────────────────────────────────────────────

  private async _processTask(task: Task): Promise<void> {
    // ── Step 1: Accept the task on-chain ──────────────────────────────────────
    let acceptTx: string | undefined;
    try {
      logger.info(AGENT_NAME, `Accepting task ${formatTaskId(task.id)}…`);
      const tx = await this.economy.acceptTask(task.id, { gasLimit: 200_000n });
      const receipt = await tx.wait();
      acceptTx = receipt.hash;
      logger.ok(AGENT_NAME, `Task accepted: ${explorerTx(acceptTx)}`);
    } catch (err: any) {
      // Task may have just been accepted by a competing worker
      logger.warn(AGENT_NAME, `Accept failed: ${err.message?.slice(0, 80)}`);
      return;
    }

    // ── Step 2: Execute the task (DEX swap or simulation) ─────────────────────
    logger.info(AGENT_NAME, `Executing task…`);
    const result = await this.executor.execute(task);

    // ── Step 3: Report outcome to SimpleEconomy ───────────────────────────────
    if (result.success && result.txHash) {
      try {
        const proof = result.txHash;
        const completeTx = await this.economy.completeTask(task.id, proof, { gasLimit: 300_000n });
        const completeReceipt = await completeTx.wait();
        logger.ok(
          AGENT_NAME,
          `Task completed! Payment released: ${explorerTx(completeReceipt.hash)}`
        );
        this.tasksDone++;

        // ERC-8004 logging happens inside completeTask() on the contract
        // but we also log locally for immediate display
        await this.logger_.log(
          task.id,
          "COMPLETE",
          `Executed: ${result.txHash}`,
          5
        );

      } catch (err: any) {
        logger.error(AGENT_NAME, `completeTask failed: ${err.message?.slice(0, 80)}`);
      }
    } else {
      // Report failure to contract
      try {
        const failTx = await this.economy.failTask(task.id, result.error ?? "Execution failed", { gasLimit: 200_000n });
        await failTx.wait();
        logger.warn(AGENT_NAME, `Task ${formatTaskId(task.id)} marked as FAILED on-chain`);

        await this.logger_.log(task.id, "FAIL", result.error ?? "execution error", -5);
      } catch {
        // Non-fatal
      }
    }

    const rep = await this.logger_.getReputation();
    logger.info(AGENT_NAME, `Current reputation score: ${rep}`);
  }

  getStats() {
    return { tasksDone: this.tasksDone };
  }
}
