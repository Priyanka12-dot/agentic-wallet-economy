import { useState } from "react";
import type { FeedEntry } from "@shared/types";
import { ACTIVE_NETWORK } from "@shared/constants";

interface DecisionLogProps {
  entries:  FeedEntry[];
  maxShown?: number;
}

const DECISION_ICONS: Record<string, string> = {
  DECISION:       "⚡",
  TASK_POSTED:    "📋",
  TASK_COMPLETED: "✅",
  REPUTATION:     "⭐",
};

const DECISION_COLORS: Record<string, string> = {
  ACCEPT:    "#22d3ee",
  REJECT:    "#94a3b8",
  COMPLETE:  "#22c55e",
  FAIL:      "#ef4444",
  POST:      "#a855f7",
  VERIFIED:  "#f59e0b",
  default:   "#64748b",
};

function getDecisionColor(message: string): string {
  for (const [key, color] of Object.entries(DECISION_COLORS)) {
    if (message.toUpperCase().includes(key)) return color;
  }
  return DECISION_COLORS.default;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs  = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5)   return "just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function LogRow({ entry, index }: { entry: FeedEntry; index: number }) {
  const color    = getDecisionColor(entry.message);
  const icon     = DECISION_ICONS[entry.type] ?? "◦";
  const explorerUrl = entry.txHash
    ? `${ACTIVE_NETWORK.explorer}/tx/${entry.txHash}`
    : null;

  return (
    <div
      style={{
        display:     "flex",
        gap:         "10px",
        padding:     "10px 14px",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        alignItems:  "flex-start",
        animation:   index === 0 ? "slideIn 0.3s ease" : "none",
        background:  index === 0 ? "rgba(34,211,238,0.03)" : "transparent",
        transition:  "background 0.3s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = index === 0 ? "rgba(34,211,238,0.03)" : "transparent")}
    >
      {/* Icon */}
      <div style={{
        fontSize:   "0.85rem",
        marginTop:  "1px",
        flexShrink: 0,
        width:      18,
        textAlign:  "center",
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          {/* Agent + role */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 600 }}>
              {entry.agentName}
            </span>
            <span style={{
              color:      entry.agentRole === "WORKER" ? "#67e8f9" : "#d8b4fe",
              fontSize:   "0.6rem",
              letterSpacing: "0.1em",
              background: entry.agentRole === "WORKER" ? "rgba(6,182,212,0.1)" : "rgba(168,85,247,0.1)",
              padding:    "1px 5px",
              borderRadius: "3px",
            }}>
              {entry.agentRole}
            </span>
          </div>

          {/* Timestamp */}
          <span style={{ color: "#334155", fontSize: "0.65rem", flexShrink: 0 }}>
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>

        {/* Message */}
        <div style={{
          color:      color,
          fontSize:   "0.75rem",
          marginTop:  "3px",
          fontFamily: "monospace",
          wordBreak:  "break-all",
        }}>
          {entry.message}
        </div>

        {/* TX link + rep score */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color:          "#334155",
                fontSize:       "0.65rem",
                fontFamily:     "monospace",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
            >
              {entry.txHash!.slice(0, 14)}… ↗
            </a>
          )}
          {entry.repScore != null && (
            <span style={{ color: "#475569", fontSize: "0.65rem" }}>
              rep: <span style={{ color: "#94a3b8" }}>{entry.repScore}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DecisionLog({ entries, maxShown = 30 }: DecisionLogProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? entries : entries.slice(0, maxShown);

  return (
    <div style={{
      background:   "rgba(15,23,42,0.8)",
      border:       "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      overflow:     "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:        "14px 16px",
        borderBottom:   "1px solid rgba(255,255,255,0.08)",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        background:     "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ color: "#94a3b8", fontSize: "0.75rem", letterSpacing: "0.12em", fontWeight: 600 }}>
            LIVE DECISION LOG
          </span>
        </div>
        <span style={{ color: "#334155", fontSize: "0.7rem", fontFamily: "monospace" }}>
          {entries.length} events
        </span>
      </div>

      {/* Feed */}
      <div style={{ maxHeight: "480px", overflowY: "auto" }}>
        {displayed.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#334155", fontSize: "0.8rem" }}>
            No events yet — agents are warming up…
          </div>
        ) : (
          displayed.map((entry, i) => (
            <LogRow key={entry.id} entry={entry} index={i} />
          ))
        )}
      </div>

      {/* Show more */}
      {entries.length > maxShown && (
        <div
          style={{
            padding:     "10px 16px",
            borderTop:   "1px solid rgba(255,255,255,0.06)",
            textAlign:   "center",
            cursor:      "pointer",
            color:       "#475569",
            fontSize:    "0.75rem",
            background:  "rgba(255,255,255,0.01)",
            transition:  "color 0.2s",
          }}
          onClick={() => setShowAll(!showAll)}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
        >
          {showAll ? "Show less" : `Show all ${entries.length} events`}
        </div>
      )}
    </div>
  );
}
