import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  AGENT_IDENTITY_ABI,
  SIMPLE_ECONOMY_ABI,
  ACTIVE_NETWORK,
  AGENT_PROFILES,
} from "@shared/constants";
import type {
  DecisionLoggedEvent,
  TaskPostedEvent,
  TaskCompletedEvent,
  AgentStats,
} from "@shared/types";

// ─── Provider singleton ───────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(
      ACTIVE_NETWORK.rpc,
      { name: ACTIVE_NETWORK.name, chainId: ACTIVE_NETWORK.chainId },
      { staticNetwork: true }
    );
  }
  return _provider;
}

function getIdentityContract(): ethers.Contract {
  return new ethers.Contract(
    CONTRACT_ADDRESSES.AGENT_IDENTITY,
    AGENT_IDENTITY_ABI,
    getProvider()
  );
}

function getEconomyContract(): ethers.Contract {
  return new ethers.Contract(
    CONTRACT_ADDRESSES.SIMPLE_ECONOMY,
    SIMPLE_ECONOMY_ABI,
    getProvider()
  );
}

async function getBlockRange(): Promise<{ start: number; end: number }> {
  const end   = await getProvider().getBlockNumber();
  const start = Math.max(0, end - 2000);
  return { start, end };
}

// ─── Agent stats ──────────────────────────────────────────────────────────────
// Uses hardcoded profiles (name, role, tokenId) + live DecisionLogged events
// for reputation and decision counts. No eth_call or long block-range queries.

export async function fetchAgentStats(
  agentAddresses: string[]
): Promise<AgentStats[]> {
  if (!agentAddresses.length) return [];

  const contract       = getIdentityContract();
  const { start, end } = await getBlockRange();

  // Build live stats from the same DecisionLogged events that power the feed
  const repMap       = new Map<string, number>();
  const decisionMap  = new Map<string, number>();
  const completedMap = new Map<string, number>();

  try {
    const logs = await contract.queryFilter(
      contract.filters.DecisionLogged(),
      start,
      end
    );

    for (const raw of logs) {
      const e       = raw as ethers.EventLog;
      const agent   = (e.args[1] as string).toLowerCase();
      const newRep  = Number(e.args[6] as bigint);
      const decision= e.args[3] as string;

      repMap.set(agent, newRep);
      decisionMap.set(agent, (decisionMap.get(agent) ?? 0) + 1);
      if (decision === "COMPLETE") {
        completedMap.set(agent, (completedMap.get(agent) ?? 0) + 1);
      }
    }
  } catch (err) {
    console.error("[fetchAgentStats] DecisionLogged query error:", err);
  }

  // Combine hardcoded profile with live event data
  const stats: AgentStats[] = agentAddresses
    .map((address) => {
      const key     = address.toLowerCase();
      const profile = AGENT_PROFILES[key];
      if (!profile) return null;

      return {
        address,
        name:            profile.name,
        role:            profile.role,
        tokenId:         profile.tokenId,
        reputationScore: repMap.get(key) ?? 100,          // 100 is starting rep
        totalDecisions:  decisionMap.get(key) ?? 0,
        successfulTasks: completedMap.get(key) ?? 0,
      } satisfies AgentStats;
    })
    .filter((s): s is AgentStats => s !== null);

  console.log("[fetchAgentStats] stats:", stats);
  return stats;
}

// ─── Decision logs ────────────────────────────────────────────────────────────

export async function fetchDecisionLogs(
  maxEvents = 50
): Promise<DecisionLoggedEvent[]> {
  const contract       = getIdentityContract();
  const { start, end } = await getBlockRange();

  try {
    const logs = await contract.queryFilter(
      contract.filters.DecisionLogged(),
      start,
      end
    );

    return logs.slice(-maxEvents).map((raw) => {
      const e = raw as ethers.EventLog;
      return {
        tokenId:         e.args[0] as bigint,
        agent:           e.args[1] as string,
        taskId:          e.args[2] as string,
        decision:        e.args[3] as string,
        details:         e.args[4] as string,
        reputationDelta: e.args[5] as bigint,
        newReputation:   e.args[6] as bigint,
        timestamp:       e.args[7] as bigint,
        txHash:          e.transactionHash,
        blockNumber:     e.blockNumber,
      };
    });
  } catch (err) {
    console.error("[fetchDecisionLogs] Error:", err);
    return [];
  }
}

// ─── Task events ──────────────────────────────────────────────────────────────

export async function fetchTaskPostedEvents(
  maxEvents = 50
): Promise<TaskPostedEvent[]> {
  const contract       = getEconomyContract();
  const { start, end } = await getBlockRange();

  try {
    const logs = await contract.queryFilter(
      contract.filters.TaskPosted(),
      start,
      end
    );

    return logs.slice(-maxEvents).map((raw) => {
      const e = raw as ethers.EventLog;
      return {
        taskId:      e.args[0] as string,
        consumer:    e.args[1] as string,
        description: e.args[2] as string,
        payment:     e.args[3] as bigint,
        deadline:    e.args[4] as bigint,
        txHash:      e.transactionHash,
        blockNumber: e.blockNumber,
      };
    });
  } catch (err) {
    console.error("[fetchTaskPostedEvents] Error:", err);
    return [];
  }
}

export async function fetchTaskCompletedEvents(
  maxEvents = 50
): Promise<TaskCompletedEvent[]> {
  const contract       = getEconomyContract();
  const { start, end } = await getBlockRange();

  try {
    const logs = await contract.queryFilter(
      contract.filters.TaskCompleted(),
      start,
      end
    );

    return logs.slice(-maxEvents).map((raw) => {
      const e = raw as ethers.EventLog;
      return {
        taskId:      e.args[0] as string,
        worker:      e.args[1] as string,
        payment:     e.args[2] as bigint,
        timestamp:   e.args[3] as bigint,
        txHash:      e.transactionHash,
        blockNumber: e.blockNumber,
      };
    });
  } catch (err) {
    console.error("[fetchTaskCompletedEvents] Error:", err);
    return [];
  }
}

// ─── Block number ─────────────────────────────────────────────────────────────

export async function getCurrentBlock(): Promise<number> {
  try {
    return await getProvider().getBlockNumber();
  } catch {
    return 0;
  }
}

// ─── Real-time subscription ───────────────────────────────────────────────────

export function subscribeToDecisions(
  callback: (event: DecisionLoggedEvent) => void
): () => void {
  const contract = getIdentityContract();

  const handler = (...args: unknown[]) => {
    const event = args[args.length - 1] as ethers.EventLog;
    callback({
      tokenId:         args[0] as bigint,
      agent:           args[1] as string,
      taskId:          args[2] as string,
      decision:        args[3] as string,
      details:         args[4] as string,
      reputationDelta: args[5] as bigint,
      newReputation:   args[6] as bigint,
      timestamp:       args[7] as bigint,
      txHash:          event?.transactionHash ?? "",
      blockNumber:     event?.blockNumber ?? 0,
    });
  };

  contract.on("DecisionLogged", handler);
  return () => { contract.off("DecisionLogged", handler); };
}