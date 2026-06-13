import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchDecisionLogs,
  fetchTaskPostedEvents,
  fetchTaskCompletedEvents,
  fetchAgentStats,
  getCurrentBlock,
  subscribeToDecisions,
} from "../services/eventFetcher";
import type {
  DecisionLoggedEvent,
  TaskPostedEvent,
  TaskCompletedEvent,
  AgentStats,
  FeedEntry,
} from "@shared/types";
import { ethers } from "ethers";

const POLL_INTERVAL_MS = 10_000;
const MAX_FEED_ENTRIES = 100;

// Agent addresses loaded from env
const AGENT_ADDRESSES = [
  process.env.VITE_WORKER_ADDRESS  || "",
  process.env.VITE_CONSUMER_ADDRESS || "",
].filter(Boolean);

interface ChainData {
  decisions:       DecisionLoggedEvent[];
  tasksPosted:     TaskPostedEvent[];
  tasksCompleted:  TaskCompletedEvent[];
  agentStats:      AgentStats[];
  feedEntries:     FeedEntry[];
  currentBlock:    number;
  isLoading:       boolean;
  error:           string | null;
  lastUpdated:     number;
}

export function useChainData() {
  const [data, setData] = useState<ChainData>({
    decisions:      [],
    tasksPosted:    [],
    tasksCompleted: [],
    agentStats:     [],
    feedEntries:    [],
    currentBlock:   0,
    isLoading:      true,
    error:          null,
    lastUpdated:    0,
  });

  const seenTxHashes = useRef<Set<string>>(new Set());

  // ── Build unified feed from all event types ──────────────────────────────
  const buildFeedEntries = useCallback(
    (
      decisions:      DecisionLoggedEvent[],
      tasksPosted:    TaskPostedEvent[],
      tasksCompleted: TaskCompletedEvent[],
      stats:          AgentStats[]
    ): FeedEntry[] => {
      const entries: FeedEntry[] = [];

      const getAgentInfo = (address: string) => {
        const stat = stats.find((s) => s.address.toLowerCase() === address.toLowerCase());
        return {
          name: stat?.name ?? `Agent ${address.slice(0, 6)}`,
          role: stat?.role ?? ("WORKER" as const),
        };
      };

      for (const d of decisions) {
        if (seenTxHashes.current.has(d.txHash)) continue;
        seenTxHashes.current.add(d.txHash);

        const { name, role } = getAgentInfo(d.agent);
        const deltaSign = Number(d.reputationDelta) >= 0 ? "+" : "-";

        entries.push({
          id:        `decision-${d.txHash}`,
          type:      "DECISION",
          agentName: name,
          agentRole: role,
          message:   `${d.decision} — ${d.details.slice(0, 80)}`,
          txHash:    d.txHash,
          timestamp: Number(d.timestamp) * 1000,
          repScore:  Number(d.newReputation),
        });
      }

      for (const t of tasksPosted) {
        if (seenTxHashes.current.has(t.txHash)) continue;
        seenTxHashes.current.add(t.txHash);

        const { name, role } = getAgentInfo(t.consumer);
        entries.push({
          id:        `posted-${t.txHash}`,
          type:      "TASK_POSTED",
          agentName: name,
          agentRole: role,
          message:   `Posted: "${t.description}" (${ethers.formatEther(t.payment)} mETH)`,
          txHash:    t.txHash,
          timestamp: Date.now(), // no timestamp in event; approximate
        });
      }

      for (const c of tasksCompleted) {
        if (seenTxHashes.current.has(c.txHash)) continue;
        seenTxHashes.current.add(c.txHash);

        const { name, role } = getAgentInfo(c.worker);
        entries.push({
          id:        `completed-${c.txHash}`,
          type:      "TASK_COMPLETED",
          agentName: name,
          agentRole: role,
          message:   `Completed task — earned ${ethers.formatEther(c.payment)} mETH`,
          txHash:    c.txHash,
          timestamp: Number(c.timestamp) * 1000,
        });
      }

      return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_FEED_ENTRIES);
    },
    []
  );

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [decisions, tasksPosted, tasksCompleted, agentStats, currentBlock] =
        await Promise.all([
          fetchDecisionLogs(),
          fetchTaskPostedEvents(),
          fetchTaskCompletedEvents(),
          fetchAgentStats(AGENT_ADDRESSES),
          getCurrentBlock(),
        ]);

      const feedEntries = buildFeedEntries(decisions, tasksPosted, tasksCompleted, agentStats);

      setData((prev) => ({
        decisions,
        tasksPosted,
        tasksCompleted,
        agentStats,
        feedEntries: [...feedEntries, ...prev.feedEntries].slice(0, MAX_FEED_ENTRIES),
        currentBlock,
        isLoading:   false,
        error:       null,
        lastUpdated: Date.now(),
      }));
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error:     err.message ?? "Failed to fetch chain data",
      }));
    }
  }, [buildFeedEntries]);

  // ── Initial fetch + polling ────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Real-time subscription for new decisions ──────────────────────────────
  useEffect(() => {
    const unsub = subscribeToDecisions((event) => {
      setData((prev) => {
        if (seenTxHashes.current.has(event.txHash)) return prev;
        seenTxHashes.current.add(event.txHash);

        const stat = prev.agentStats.find(
          (s) => s.address.toLowerCase() === event.agent.toLowerCase()
        );
        const newEntry: FeedEntry = {
          id:        `live-${event.txHash}`,
          type:      "DECISION",
          agentName: stat?.name ?? `Agent ${event.agent.slice(0, 6)}`,
          agentRole: stat?.role ?? "WORKER",
          message:   `${event.decision} — ${event.details.slice(0, 80)}`,
          txHash:    event.txHash,
          timestamp: Number(event.timestamp) * 1000,
          repScore:  Number(event.newReputation),
        };

        return {
          ...prev,
          decisions:   [event, ...prev.decisions].slice(0, 100),
          feedEntries: [newEntry, ...prev.feedEntries].slice(0, MAX_FEED_ENTRIES),
          lastUpdated: Date.now(),
        };
      });
    });

    return unsub;
  }, []);

  return { ...data, refetch: fetchAll };
}
