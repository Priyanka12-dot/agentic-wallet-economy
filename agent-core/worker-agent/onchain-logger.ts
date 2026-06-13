import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  AGENT_IDENTITY_ABI,
} from "../shared/constants";
import { logger, explorerTx, withRetry } from "../shared/utils";
import type { DecisionOutcome, AgentDecision } from "../shared/types";

const AGENT_NAME = "WORKER";

/**
 * OnChainLogger
 *
 * Wraps the AgentIdentity (ERC-8004) contract's logDecision() function.
 * Every worker decision is recorded immutably on Mantle — this is the
 * on-chain benchmarking pillar of the hackathon requirements.
 */
export class OnChainLogger {
  private contract: ethers.Contract;
  private agentAddress: string;
  private decisionHistory: AgentDecision[] = [];

  constructor(signer: ethers.Wallet) {
    this.agentAddress = signer.address;
    this.contract = new ethers.Contract(
      CONTRACT_ADDRESSES.AGENT_IDENTITY,
      AGENT_IDENTITY_ABI,
      signer
    );
  }

  /**
   * Log a decision to the ERC-8004 identity contract on Mantle.
   *
   * @param taskId          bytes32 task ID
   * @param decision        outcome string
   * @param details         human-readable detail
   * @param reputationDelta signed delta (-127 to +127)
   */
  async log(
    taskId:          string,
    decision:        DecisionOutcome,
    details:         string,
    reputationDelta: number = 0
  ): Promise<string | null> {
    logger.chain(AGENT_NAME, `Logging decision "${decision}" for task ${taskId.slice(0, 10)}…`);

    try {
      const tx = await withRetry(async () =>
        this.contract.logDecision(
          this.agentAddress,
          taskId,
          decision,
          details.slice(0, 200), // keep gas low
          reputationDelta
        )
      );

      const receipt = await tx.wait();
      const txHash  = receipt.hash;

      logger.chain(AGENT_NAME, `Decision logged on-chain: ${explorerTx(txHash)}`);

      // Cache locally for dashboard display
      this.decisionHistory.push({
        agentAddress: this.agentAddress,
        taskId,
        decision,
        details,
        reputationDelta,
        timestamp: Date.now(),
        txHash,
      });

      return txHash;
    } catch (err: any) {
      // Non-fatal — agent continues operating even if logging fails
      logger.warn(AGENT_NAME, `On-chain log failed (non-fatal): ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch current reputation score from the identity contract.
   */
  async getReputation(): Promise<number> {
    try {
      const rep = await this.contract.getReputation(this.agentAddress);
      return Number(rep);
    } catch {
      return 0;
    }
  }

  /**
   * Fetch full agent profile.
   */
  async getProfile() {
    try {
      return await this.contract.getProfile(this.agentAddress);
    } catch {
      return null;
    }
  }

  getDecisionHistory(): AgentDecision[] {
    return this.decisionHistory;
  }
}
