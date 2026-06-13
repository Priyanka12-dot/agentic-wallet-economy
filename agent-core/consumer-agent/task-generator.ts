import { ethers } from "ethers";
import { TASK_TEMPLATES, AGENT_CONFIG } from "../shared/constants";
import { logger } from "../shared/utils";
import type { TaskType } from "../shared/types";

const AGENT_NAME = "CONSUMER";

/**
 * TaskGenerator
 *
 * Autonomously generates task requests for the Consumer agent.
 * Tasks are randomised from TASK_TEMPLATES with slight amount variation
 * to simulate real-world variance in swap requirements.
 */
export class TaskGenerator {
  private taskCount: number = 0;

  /**
   * Generate a randomised task description.
   * Varies the amount slightly each time to make each task unique on-chain.
   */
  generateTask(): { description: string; type: TaskType; payment: bigint } {
    const template = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];

    // Vary amount by ±20% to prevent duplicate task IDs
    const variance = 0.8 + Math.random() * 0.4; // 0.80 – 1.20
    const description = this._applyVariance(template, variance);

    const type = this._inferType(description);

    // Payment is fixed at TASK_PAYMENT_WEI — could scale with task complexity
    const payment = AGENT_CONFIG.TASK_PAYMENT_WEI;

    this.taskCount++;
    logger.info(AGENT_NAME, `Generated task #${this.taskCount}: "${description}" (${ethers.formatEther(payment)} mETH)`);

    return { description, type, payment };
  }

  /**
   * Apply variance to the numeric amount in a template string.
   * "Swap 0.01 mETH to USDC" + 1.2 → "Swap 0.012 mETH to USDC"
   */
  private _applyVariance(template: string, multiplier: number): string {
    return template.replace(/([\d.]+)/, (match) => {
      const original = parseFloat(match);
      const varied   = (original * multiplier).toFixed(4).replace(/\.?0+$/, "");
      return varied;
    });
  }

  private _inferType(description: string): TaskType {
    const l = description.toLowerCase();
    if (l.includes("swap"))     return "SWAP";
    if (l.includes("transfer")) return "TRANSFER";
    if (l.includes("stake"))    return "STAKE";
    if (l.includes("bridge"))   return "BRIDGE";
    return "SWAP";
  }

  getTotalGenerated(): number {
    return this.taskCount;
  }
}
