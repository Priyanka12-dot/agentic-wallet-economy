import type { AgentStats } from "@shared/types";
import { ACTIVE_NETWORK } from "@shared/constants";

interface AgentCardProps {
  stats:   AgentStats;
  isLive?: boolean;
}

const ROLE_COLORS = {
  WORKER:   { bg: "rgba(6,182,212,0.08)",  border: "#06b6d4", text: "#67e8f9", label: "bg-cyan-900/50 text-cyan-300"  },
  CONSUMER: { bg: "rgba(168,85,247,0.08)", border: "#a855f7", text: "#d8b4fe", label: "bg-purple-900/50 text-purple-300" },
} as const;

function ReputationBar({ score }: { score: number }) {
  const pct   = Math.min(100, (score / 1000) * 100);
  const color = score >= 80 ? "#22d3ee" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span style={{ color: "#94a3b8", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
          REPUTATION
        </span>
        <span style={{ color, fontSize: "0.875rem", fontWeight: 700, fontFamily: "monospace" }}>
          {score} / 1000
        </span>
      </div>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            borderRadius: "2px",
            transition: "width 0.6s ease",
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: 1,
      textAlign: "center",
      padding: "8px 4px",
      background: "rgba(255,255,255,0.03)",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ color: "#64748b", fontSize: "0.6rem", letterSpacing: "0.12em", marginBottom: "3px" }}>
        {label}
      </div>
      <div style={{ color: "#e2e8f0", fontSize: "0.875rem", fontWeight: 600, fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

export default function AgentCard({ stats, isLive = false }: AgentCardProps) {
  const colors = ROLE_COLORS[stats.role];
  const successRate = stats.totalDecisions > 0
    ? Math.round((stats.successfulTasks / stats.totalDecisions) * 100)
    : 0;

  const explorerUrl = `${ACTIVE_NETWORK.explorer}/address/${stats.address}`;

  return (
    <div
      style={{
        background:   colors.bg,
        border:       `1px solid ${colors.border}33`,
        borderRadius: "12px",
        padding:      "20px",
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {/* Glow effect */}
      <div style={{
        position:   "absolute",
        top:        -40,
        right:      -40,
        width:      120,
        height:     120,
        borderRadius: "50%",
        background: `${colors.border}11`,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div>
          {/* Role badge */}
          <span style={{
            display:      "inline-block",
            padding:      "2px 8px",
            borderRadius: "4px",
            background:   `${colors.border}22`,
            border:       `1px solid ${colors.border}44`,
            color:        colors.text,
            fontSize:     "0.65rem",
            letterSpacing:"0.12em",
            fontWeight:   600,
            marginBottom: "8px",
          }}>
            {stats.role}
          </span>

          <h3 style={{
            color:      "#f1f5f9",
            fontSize:   "1rem",
            fontWeight: 700,
            margin:     0,
            letterSpacing: "-0.01em",
          }}>
            {stats.name}
          </h3>

          {/* Address */}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color:      "#475569",
              fontSize:   "0.7rem",
              fontFamily: "monospace",
              textDecoration: "none",
              display:    "block",
              marginTop:  "3px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            {stats.address.slice(0, 10)}…{stats.address.slice(-6)} ↗
          </a>
        </div>

        {/* NFT badge */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width:        36,
            height:       36,
            borderRadius: "8px",
            background:   `linear-gradient(135deg, ${colors.border}33, ${colors.border}11)`,
            border:       `1px solid ${colors.border}44`,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            marginBottom: "4px",
          }}>
            <span style={{ fontSize: "1rem" }}>⛓</span>
          </div>
          <div style={{ color: "#475569", fontSize: "0.6rem", letterSpacing: "0.08em" }}>
            NFT #{stats.tokenId}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "2px" }}>
        <StatBox label="DECISIONS" value={stats.totalDecisions} />
        <StatBox label="COMPLETED" value={stats.successfulTasks} />
        <StatBox label="SUCCESS %" value={`${successRate}%`} />
      </div>

      {/* Reputation bar */}
      <ReputationBar score={stats.reputationScore} />

      {/* Live indicator */}
      {isLive && (
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "5px",
          marginTop:  "12px",
        }}>
          <div style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   "#22c55e",
            boxShadow:    "0 0 6px #22c55e",
            animation:    "pulse 2s infinite",
          }} />
          <span style={{ color: "#22c55e", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
            ACTIVE
          </span>
        </div>
      )}
    </div>
  );
}
