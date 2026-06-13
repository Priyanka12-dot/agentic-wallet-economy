// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentRole = "WORKER" | "CONSUMER";

export interface AgentConfig {
  name:       string;
  role:       AgentRole;
  privateKey: string;       // loaded from env / byreal-config
  address:    string;       // derived from privateKey
  tokenId?:   number;       // ERC-8004 identity NFT token ID (set after mint)
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskType = "SWAP" | "TRANSFER" | "STAKE" | "BRIDGE";

export type TaskStatus =
  | "OPEN"
  | "ACCEPTED"
  | "COMPLETED"
  | "FAILED"
  | "RECLAIMED";

export interface Task {
  id:          string;          // bytes32 hex string
  consumer:    string;          // consumer agent address
  worker:      string | null;   // worker agent address (null if OPEN)
  description: string;          // e.g. "Swap 0.01 mETH to USDC"
  payment:     bigint;          // wei
  deadline:    number;          // unix timestamp
  status:      TaskStatus;
  postedAt:    number;
  acceptedAt:  number;
  completedAt: number;
  type?:       TaskType;        // parsed from description
}

// ─── Decision Types ───────────────────────────────────────────────────────────

export type DecisionOutcome =
  | "ACCEPT"
  | "REJECT"
  | "COMPLETE"
  | "FAIL"
  | "POST"
  | "VERIFIED";

export interface AgentDecision {
  agentAddress: string;
  taskId:       string;
  decision:     DecisionOutcome;
  details:      string;
  reputationDelta: number;
  timestamp:    number;
  txHash?:      string;
}

// ─── Swap / Execution Types ───────────────────────────────────────────────────

export interface SwapParams {
  tokenIn:    string;   // token address or "mETH"
  tokenOut:   string;   // token address or "USDC"
  amountIn:   bigint;   // wei
  minAmountOut: bigint; // slippage-adjusted minimum
  deadline:   number;   // unix timestamp
}

export interface ExecutionResult {
  success:   boolean;
  txHash?:   string;
  amountOut?: bigint;
  gasUsed?:  bigint;
  error?:    string;
}

// ─── On-chain Event Types (from ethers.js logs) ───────────────────────────────

export interface DecisionLoggedEvent {
  tokenId:         bigint;
  agent:           string;
  taskId:          string;
  decision:        string;
  details:         string;
  reputationDelta: bigint;
  newReputation:   bigint;
  timestamp:       bigint;
  txHash:          string;
  blockNumber:     number;
}

export interface TaskPostedEvent {
  taskId:      string;
  consumer:    string;
  description: string;
  payment:     bigint;
  deadline:    bigint;
  txHash:      string;
  blockNumber: number;
}

export interface TaskCompletedEvent {
  taskId:    string;
  worker:    string;
  payment:   bigint;
  timestamp: bigint;
  txHash:    string;
  blockNumber: number;
}

// ─── Dashboard / Feed Types ───────────────────────────────────────────────────

export interface FeedEntry {
  id:        string;
  type:      "DECISION" | "TASK_POSTED" | "TASK_COMPLETED" | "REPUTATION";
  agentName: string;
  agentRole: AgentRole;
  message:   string;
  txHash?:   string;
  timestamp: number;
  repScore?: number;
}

export interface AgentStats {
  address:         string;
  name:            string;
  role:            AgentRole;
  reputationScore: number;
  totalDecisions:  number;
  successfulTasks: number;
  tokenId:         number;
}
