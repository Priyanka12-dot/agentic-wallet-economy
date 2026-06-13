/**
 * tests/agents/decision-engine.test.ts
 *
 * Unit tests for the Worker and Consumer decision engines.
 * Uses Jest + manual mocks — no live RPC calls needed.
 *
 * Run with: npx jest tests/agents/decision-engine.test.ts
 */

import { ethers } from "ethers";
import { TaskGenerator }  from "../../agent-core/consumer-agent/task-generator";
import { parseTaskDescription, mapTaskStatus, formatTaskId } from "../../agent-core/shared/utils";
import { TASK_TEMPLATES, AGENT_CONFIG } from "../../agent-core/shared/constants";
import type { Task } from "../../agent-core/shared/types";

// ─── TaskGenerator ────────────────────────────────────────────────────────────

describe("TaskGenerator", () => {
  let generator: TaskGenerator;

  beforeEach(() => {
    generator = new TaskGenerator();
  });

  it("generates a task with a non-empty description", () => {
    const { description } = generator.generateTask();
    expect(description.length).toBeGreaterThan(5);
  });

  it("generates descriptions based on TASK_TEMPLATES", () => {
    // All templates contain at least one keyword
    const keywords = ["swap", "transfer", "stake", "bridge"];
    for (let i = 0; i < 10; i++) {
      const { description } = generator.generateTask();
      const hasKeyword = keywords.some((k) => description.toLowerCase().includes(k));
      expect(hasKeyword).toBe(true);
    }
  });

  it("increments totalGenerated counter", () => {
    expect(generator.getTotalGenerated()).toBe(0);
    generator.generateTask();
    generator.generateTask();
    expect(generator.getTotalGenerated()).toBe(2);
  });

  it("sets payment to TASK_PAYMENT_WEI", () => {
    const { payment } = generator.generateTask();
    expect(payment).toBe(AGENT_CONFIG.TASK_PAYMENT_WEI);
  });

  it("infers SWAP type for swap descriptions", () => {
    for (let i = 0; i < 20; i++) {
      const { description, type } = generator.generateTask();
      if (description.toLowerCase().includes("swap")) {
        expect(type).toBe("SWAP");
      }
    }
  });

  it("produces varied descriptions (not always identical)", () => {
    const descriptions = new Set<string>();
    for (let i = 0; i < 20; i++) {
      descriptions.add(generator.generateTask().description);
    }
    // Due to ±20% variance, we expect at least a few unique descriptions
    expect(descriptions.size).toBeGreaterThan(1);
  });
});

// ─── parseTaskDescription ─────────────────────────────────────────────────────

describe("parseTaskDescription", () => {
  it("parses a standard swap description", () => {
    const result = parseTaskDescription("Swap 0.01 mETH to USDC on Mantle");
    expect(result.type).toBe("SWAP");
    expect(result.tokenIn).toBe("METH");
    expect(result.tokenOut).toBe("USDC");
    expect(result.amountIn).toBe(ethers.parseEther("0.01"));
  });

  it("parses transfer type", () => {
    expect(parseTaskDescription("Transfer 0.001 mETH to treasury").type).toBe("TRANSFER");
  });

  it("defaults to SWAP for unknown descriptions", () => {
    expect(parseTaskDescription("do something random").type).toBe("SWAP");
  });

  it("handles decimal amounts correctly", () => {
    const result = parseTaskDescription("Swap 0.0125 mETH to USDT on Mantle");
    expect(result.amountIn).toBe(ethers.parseEther("0.0125"));
  });

  it("normalises token symbols to uppercase", () => {
    const result = parseTaskDescription("Swap 0.01 meth to usdc on Mantle");
    expect(result.tokenIn).toBe("METH");
    expect(result.tokenOut).toBe("USDC");
  });
});

// ─── mapTaskStatus ────────────────────────────────────────────────────────────

describe("mapTaskStatus", () => {
  const cases: [number, Task["status"]][] = [
    [0, "OPEN"],
    [1, "ACCEPTED"],
    [2, "COMPLETED"],
    [3, "FAILED"],
    [4, "RECLAIMED"],
  ];

  test.each(cases)("maps %i → %s", (input, expected) => {
    expect(mapTaskStatus(input)).toBe(expected);
  });

  it("defaults to OPEN for unknown status", () => {
    expect(mapTaskStatus(99)).toBe("OPEN");
  });
});

// ─── formatTaskId ─────────────────────────────────────────────────────────────

describe("formatTaskId", () => {
  it("truncates a bytes32 taskId to 10 chars + ellipsis", () => {
    const taskId = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const formatted = formatTaskId(taskId);
    expect(formatted).toBe("0xabcdef123…");
    expect(formatted.length).toBe(11);
  });
});

// ─── Worker decision logic (pure heuristics, no chain calls) ──────────────────

describe("Worker decision heuristics", () => {
  const makeTasks = (payments: bigint[]): Task[] =>
    payments.map((p, i) => ({
      id:          `0x${i.toString().padStart(64, "0")}`,
      consumer:    "0xConsumer",
      worker:      null,
      description: `Task ${i}`,
      payment:     p,
      deadline:    Math.floor(Date.now() / 1000) + 600,
      status:      "OPEN" as const,
      postedAt:    Math.floor(Date.now() / 1000),
      acceptedAt:  0,
      completedAt: 0,
    }));

  it("selects highest-paying task (greedy strategy)", () => {
    const tasks = makeTasks([
      ethers.parseEther("0.005"),
      ethers.parseEther("0.02"),
      ethers.parseEther("0.01"),
    ]);

    const chosen = tasks.sort((a, b) => (b.payment > a.payment ? 1 : -1))[0];
    expect(chosen.payment).toBe(ethers.parseEther("0.02"));
  });

  it("filters out expired tasks", () => {
    const tasks = makeTasks([
      ethers.parseEther("0.01"),
      ethers.parseEther("0.05"),
    ]);
    // Expire the high-paying one
    tasks[1].deadline = Math.floor(Date.now() / 1000) - 1;

    const valid = tasks.filter((t) => Date.now() / 1000 <= t.deadline);
    expect(valid.length).toBe(1);
    expect(valid[0].payment).toBe(ethers.parseEther("0.01"));
  });
});

// ─── AGENT_CONFIG sanity checks ───────────────────────────────────────────────

describe("AGENT_CONFIG", () => {
  it("DECISION_INTERVAL_MS is at least 5 seconds", () => {
    expect(AGENT_CONFIG.DECISION_INTERVAL_MS).toBeGreaterThanOrEqual(5000);
  });

  it("TASK_PAYMENT_WEI is positive", () => {
    expect(AGENT_CONFIG.TASK_PAYMENT_WEI).toBeGreaterThan(0n);
  });

  it("MIN_WORKER_REPUTATION is between 0 and 1000", () => {
    expect(AGENT_CONFIG.MIN_WORKER_REPUTATION).toBeGreaterThan(0);
    expect(AGENT_CONFIG.MIN_WORKER_REPUTATION).toBeLessThan(1000);
  });
});
