import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  SIMPLE_ECONOMY_ABI,
  AGENT_IDENTITY_ABI,
} from "../shared/constants";
import { logger, explorerTx, withRetry } from "../shared/utils";

const AGENT_NAME = "CONSUMER";

/**
 * PaymentEngine
 *
 * Handles the Consumer's interaction with SimpleEconomy:
 *   - Post tasks with escrowed mETH payment
 *   - Monitor task completion and log intent via ERC-8004
 */
export class PaymentEngine {
  private economy:  ethers.Contract;
  private identity: ethers.Contract;
  private signer:   ethers.Wallet;

  constructor(signer: ethers.Wallet) {
    this.signer = signer;

    this.economy = new ethers.Contract(
      CONTRACT_ADDRESSES.SIMPLE_ECONOMY,
      SIMPLE_ECONOMY_ABI,
      signer
    );

    this.identity = new ethers.Contract(
      CONTRACT_ADDRESSES.AGENT_IDENTITY,
      AGENT_IDENTITY_ABI,
      signer
    );
  }

  /**
   * Post a task to SimpleEconomy with mETH locked in escrow.
   *
   * @param description  Human-readable task description
   * @param payment      Amount of mETH to lock (in wei)
   * @returns taskId (bytes32) or null on failure
   */
  async postTask(description: string, payment: bigint): Promise<string | null> {
    logger.info(AGENT_NAME, `Posting task: "${description}" | Locking ${ethers.formatEther(payment)} mETH`);

    try {
      // Verify sufficient balance
      const balance = await this.signer.provider!.getBalance(this.signer.address);
      if (balance < payment + ethers.parseEther("0.001")) {
        logger.error(AGENT_NAME, `Insufficient balance (${ethers.formatEther(balance)} mETH)`);
        return null;
      }

      const tx = await withRetry(async () =>
        this.economy.postTask(description, {
          value:    payment,
          gasLimit: 300_000n,
        })
      );

      const receipt = await tx.wait();
      logger.ok(AGENT_NAME, `Task posted: ${explorerTx(receipt.hash)}`);

      // Extract taskId from the TaskPosted event
      const iface   = new ethers.Interface(SIMPLE_ECONOMY_ABI);
      let   taskId: string | null = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "TaskPosted") {
            taskId = parsed.args.taskId as string;
            break;
          }
        } catch {}
      }

      if (taskId) {
        logger.ok(AGENT_NAME, `Task ID: ${taskId.slice(0, 20)}…`);
      }

      return taskId;

    } catch (err: any) {
      logger.error(AGENT_NAME, `postTask failed: ${err.message?.slice(0, 100)}`);
      return null;
    }
  }

  /**
   * Reclaim payment from an expired task.
   */
  async reclaimExpiredTask(taskId: string): Promise<boolean> {
    try {
      const tx = await this.economy.reclaimTask(taskId, { gasLimit: 150_000n });
      const receipt = await tx.wait();
      logger.ok(AGENT_NAME, `Reclaimed task ${taskId.slice(0, 10)}…: ${explorerTx(receipt.hash)}`);
      return true;
    } catch (err: any) {
      logger.warn(AGENT_NAME, `Reclaim failed: ${err.message?.slice(0, 60)}`);
      return false;
    }
  }

  /**
   * Get the current reputation score of the consumer agent.
   */
  async getReputation(): Promise<number> {
    try {
      const rep = await this.identity.getReputation(this.signer.address);
      return Number(rep);
    } catch {
      return 0;
    }
  }

  /**
   * Get total tasks posted to the economy contract.
   */
  async getTotalTasks(): Promise<number> {
    try {
      return Number(await this.economy.totalTasks());
    } catch {
      return 0;
    }
  }
}
