/**
 * dashboard/src/shared/types.ts
 *
 * Pure TypeScript interfaces used by the dashboard.
 * No Node.js imports — safe for browser/Vite.
 */

// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentRole = "WORKER" | "CONSUMER";

export type TaskType   = "SWAP" | "TRANSFER" | "STAKE" | "BRIDGE";

export type TaskStatus =
  | "OPEN"
  | "ACCEPTED"
  | "COMPLETED"
  | "FAILED"
  | "RECLAIMED";

export type DecisionOutcome =
  | "ACCEPT"
  | "REJECT"
  | "COMPLETE"
  | "FAIL"
  | "POST"
  | "VERIFIED";

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id:          string;
  consumer:    string;
  worker:      string | null;
  description: string;
  payment:     bigint;
  deadline:    number;
  status:      TaskStatus;
  postedAt:    number;
  acceptedAt:  number;
  completedAt: number;
  type?:       TaskType;
}

// ─── On-chain Event Types ─────────────────────────────────────────────────────

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
