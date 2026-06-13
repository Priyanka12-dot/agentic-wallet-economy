import { ethers } from "ethers";
import type { Task, TaskType } from "./types";
import { ACTIVE_NETWORK } from "./constants";

// ─── Logging ──────────────────────────────────────────────────────────────────

const COLORS = {
  reset:   "\x1b[0m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  magenta: "\x1b[35m",
  dim:     "\x1b[2m",
  bold:    "\x1b[1m",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export const logger = {
  info:  (agent: string, msg: string) =>
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}[${agent}]${COLORS.reset} ${msg}`),
  ok:    (agent: string, msg: string) =>
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}[${agent}] ✓${COLORS.reset} ${msg}`),
  warn:  (agent: string, msg: string) =>
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}[${agent}] ⚠${COLORS.reset} ${msg}`),
  error: (agent: string, msg: string) =>
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}[${agent}] ✗${COLORS.reset} ${msg}`),
  chain: (agent: string, msg: string) =>
    console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.magenta}[${agent}] ⛓${COLORS.reset} ${msg}`),
  separator: () =>
    console.log(`${COLORS.dim}${"─".repeat(70)}${COLORS.reset}`),
};

// ─── Gas Utilities ────────────────────────────────────────────────────────────

/**
 * Estimate gas cost in mETH for a transaction.
 * Mantle's fees are very low (~0.001 gwei), so operations should cost < $0.01.
 */
export async function estimateGasCost(
  provider: ethers.JsonRpcProvider,
  estimatedGasUnits: bigint
): Promise<{ gasUnits: bigint; gasPrice: bigint; costWei: bigint; costMETH: string }> {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? BigInt(1_000_000); // 0.001 gwei fallback

  const costWei = estimatedGasUnits * gasPrice;
  return {
    gasUnits: estimatedGasUnits,
    gasPrice,
    costWei,
    costMETH: ethers.formatEther(costWei),
  };
}

// ─── Task Utilities ───────────────────────────────────────────────────────────

/**
 * Parse a task description to extract the task type and swap parameters.
 * e.g. "Swap 0.01 mETH to USDC on Mantle" → { type: "SWAP", amountIn: ..., tokenIn: "mETH", tokenOut: "USDC" }
 */
export function parseTaskDescription(description: string): {
  type: TaskType;
  amountIn?: bigint;
  tokenIn?: string;
  tokenOut?: string;
} {
  const lower = description.toLowerCase();

  if (lower.includes("swap")) {
    const match = description.match(
      /Swap\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)/i
    );
    if (match) {
      const [, amount, tokenIn, tokenOut] = match;
      return {
        type: "SWAP",
        amountIn: ethers.parseEther(amount),
        tokenIn: tokenIn.toUpperCase(),
        tokenOut: tokenOut.toUpperCase(),
      };
    }
    return { type: "SWAP" };
  }

  if (lower.includes("transfer")) return { type: "TRANSFER" };
  if (lower.includes("stake"))    return { type: "STAKE" };
  if (lower.includes("bridge"))   return { type: "BRIDGE" };

  return { type: "SWAP" }; // default
}

/**
 * Map on-chain task status integer to string.
 */
export function mapTaskStatus(statusInt: number): Task["status"] {
  const map: Task["status"][] = [
    "OPEN", "ACCEPTED", "COMPLETED", "FAILED", "RECLAIMED"
  ];
  return map[statusInt] ?? "OPEN";
}

/**
 * Convert a raw on-chain Task tuple to our typed Task interface.
 */
export function rawToTask(raw: {
  id: string;
  consumer: string;
  worker: string;
  description: string;
  payment: bigint;
  deadline: bigint;
  status: number;
  postedAt: bigint;
  acceptedAt: bigint;
  completedAt: bigint;
}): Task {
  return {
    id:          raw.id,
    consumer:    raw.consumer,
    worker:      raw.worker === ethers.ZeroAddress ? null : raw.worker,
    description: raw.description,
    payment:     raw.payment,
    deadline:    Number(raw.deadline),
    status:      mapTaskStatus(raw.status),
    postedAt:    Number(raw.postedAt),
    acceptedAt:  Number(raw.acceptedAt),
    completedAt: Number(raw.completedAt),
  };
}

// ─── Address Utilities ────────────────────────────────────────────────────────

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerTx(txHash: string): string {
  return `${ACTIVE_NETWORK.explorer}/tx/${txHash}`;
}

export function explorerAddr(address: string): string {
  return `${ACTIVE_NETWORK.explorer}/address/${address}`;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 2000
): Promise<T> {
  let lastErr: Error | unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Task ID bytes32 helpers ─────────────────────────────────────────────────

export function formatTaskId(taskId: string): string {
  return `${taskId.slice(0, 10)}…`;
}
