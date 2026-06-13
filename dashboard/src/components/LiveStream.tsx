import { useEffect, useRef, useState } from "react";
import type { FeedEntry, AgentStats } from "@shared/types";
import { ACTIVE_NETWORK } from "@shared/constants";

interface LiveStreamProps {
  entries:     FeedEntry[];
  agentStats:  AgentStats[];
  currentBlock: number;
  lastUpdated:  number;
}

function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px",
      padding:      "12px 16px",
      minWidth:     "120px",
      textAlign:    "center",
    }}>
      <div style={{ color: accent ?? "#22d3ee", fontSize: "1.25rem", fontWeight: 700, fontFamily: "monospace", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: "#475569", fontSize: "0.65rem", letterSpacing: "0.12em", marginTop: "4px" }}>
        {label}
      </div>
    </div>
  );
}

function TickerItem({ entry }: { entry: FeedEntry }) {
  const color = entry.agentRole === "WORKER" ? "#22d3ee" : "#a855f7";
  const url   = entry.txHash ? `${ACTIVE_NETWORK.explorer}/tx/${entry.txHash}` : null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
      <span style={{
        color:      color,
        fontWeight: 600,
        fontSize:   "0.75rem",
      }}>
        [{entry.agentName}]
      </span>
      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
        {entry.message.slice(0, 60)}
      </span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#334155", fontSize: "0.7rem", textDecoration: "none" }}>
          ↗
        </a>
      )}
      <span style={{ color: "#1e293b", marginLeft: "24px" }}>◦◦◦</span>
    </span>
  );
}

export default function LiveStream({
  entries,
  agentStats,
  currentBlock,
  lastUpdated,
}: LiveStreamProps) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [tickerOffset, setTickerOffset] = useState(0);
  const animRef = useRef<number>(0);
  const speedPxPerMs = 0.04;
  const lastFrameTs  = useRef<number>(0);

  // ── Ticker scroll animation ──────────────────────────────────────────────
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;

    let offset = 0;
    const contentWidth = ticker.scrollWidth / 2; // duplicated for seamless loop

    const animate = (ts: number) => {
      const delta = ts - (lastFrameTs.current || ts);
      lastFrameTs.current = ts;

      offset += speedPxPerMs * delta;
      if (offset >= contentWidth) offset = 0;

      ticker.style.transform = `translateX(-${offset}px)`;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [entries]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalDecisions = agentStats.reduce((s, a) => s + a.totalDecisions, 0);
  const totalCompleted = agentStats.reduce((s, a) => s + a.successfulTasks, 0);
  const avgRep         = agentStats.length
    ? Math.round(agentStats.reduce((s, a) => s + a.reputationScore, 0) / agentStats.length)
    : 0;
  const timeSince = lastUpdated
    ? `${Math.round((Date.now() - lastUpdated) / 1000)}s ago`
    : "—";

  return (
    <div>
      {/* Ticker bar */}
      <div style={{
        background:   "rgba(10,15,28,0.95)",
        border:       "1px solid rgba(34,211,238,0.15)",
        borderRadius: "8px",
        padding:      "8px 0",
        marginBottom: "24px",
        overflow:     "hidden",
        position:     "relative",
      }}>
        {/* Gradient masks */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "60px",
          background: "linear-gradient(90deg, rgba(10,15,28,1), transparent)",
          zIndex: 1, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: "60px",
          background: "linear-gradient(270deg, rgba(10,15,28,1), transparent)",
          zIndex: 1, pointerEvents: "none",
        }} />

        {/* Scrolling content */}
        <div style={{ overflow: "hidden" }}>
          <div
            ref={tickerRef}
            style={{
              display:    "inline-flex",
              alignItems: "center",
              gap:        "0px",
              fontFamily: "monospace",
              willChange: "transform",
            }}
          >
            {/* Duplicate for seamless loop */}
            {[...entries.slice(0, 20), ...entries.slice(0, 20)].map((entry, i) => (
              <TickerItem key={`${entry.id}-${i}`} entry={entry} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
        <StatPill label="BLOCK HEIGHT" value={currentBlock.toLocaleString()} accent="#22d3ee" />
        <StatPill label="TOTAL DECISIONS" value={totalDecisions} accent="#a855f7" />
        <StatPill label="TASKS DONE" value={totalCompleted} accent="#22c55e" />
        <StatPill label="AVG REPUTATION" value={avgRep} accent="#f59e0b" />
        <StatPill label="NETWORK" value={ACTIVE_NETWORK.name.replace(" Testnet", "")} accent="#64748b" />
        <StatPill label="LAST SYNC" value={timeSince} accent="#475569" />
      </div>
    </div>
  );
}
