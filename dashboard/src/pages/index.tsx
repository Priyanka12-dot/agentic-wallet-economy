import AgentCard    from "../components/AgentCard";
import DecisionLog  from "../components/DecisionLog";
import LiveStream   from "../components/LiveStream";
import { useChainData } from "../hooks/useChainData";
import { ACTIVE_NETWORK } from "@shared/constants";

export default function DashboardPage() {
  const {
    feedEntries,
    agentStats,
    tasksPosted,
    tasksCompleted,
    currentBlock,
    isLoading,
    error,
    lastUpdated,
    refetch,
  } = useChainData();

  return (
    <div style={{ minHeight: "100vh", background: "#080d18", color: "#e2e8f0" }}>
      {/* ── Grid lines background ─────────────────────────────────────────── */}
      <div style={{
        position:   "fixed",
        inset:      0,
        backgroundImage: `
          linear-gradient(rgba(34,211,238,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,211,238,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        pointerEvents:  "none",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          borderBottom: "1px solid rgba(34,211,238,0.1)",
          padding:      "18px 32px",
          background:   "rgba(8,13,24,0.9)",
          backdropFilter: "blur(8px)",
          position:     "sticky",
          top:          0,
          zIndex:       10,
          display:      "flex",
          justifyContent: "space-between",
          alignItems:   "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Logo */}
            <div style={{
              width:        36,
              height:       36,
              borderRadius: "8px",
              background:   "linear-gradient(135deg, rgba(34,211,238,0.3), rgba(168,85,247,0.3))",
              border:       "1px solid rgba(34,211,238,0.3)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontSize:     "1.1rem",
            }}>
              ⚡
            </div>

            <div>
              <div style={{
                fontSize:     "1.1rem",
                fontWeight:   800,
                letterSpacing:"-0.02em",
                background:   "linear-gradient(90deg, #22d3ee, #a855f7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                AgentSwap
              </div>
              <div style={{ color: "#334155", fontSize: "0.65rem", letterSpacing: "0.14em", marginTop: "1px" }}>
                AUTONOMOUS ON-CHAIN LABOR ECONOMY
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Chain badge */}
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "6px",
              padding:      "5px 10px",
              background:   "rgba(34,211,238,0.06)",
              border:       "1px solid rgba(34,211,238,0.15)",
              borderRadius: "6px",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 5px #22d3ee" }} />
              <span style={{ color: "#67e8f9", fontSize: "0.7rem", letterSpacing: "0.08em", fontFamily: "monospace" }}>
                {ACTIVE_NETWORK.name.replace(" Testnet", "").replace("Mantle ", "")}
              </span>
            </div>

            {/* Refresh */}
            <button
              onClick={refetch}
              style={{
                padding:      "5px 10px",
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                color:        "#64748b",
                fontSize:     "0.7rem",
                cursor:       "pointer",
                letterSpacing:"0.06em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              ↻ SYNC
            </button>
          </div>
        </header>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ padding: "28px 32px", maxWidth: "1400px", margin: "0 auto" }}>

          {/* Error banner */}
          {error && (
            <div style={{
              background:   "rgba(239,68,68,0.1)",
              border:       "1px solid rgba(239,68,68,0.25)",
              borderRadius: "8px",
              padding:      "12px 16px",
              marginBottom: "20px",
              color:        "#fca5a5",
              fontSize:     "0.8rem",
              fontFamily:   "monospace",
            }}>
              ⚠ Chain data error: {error} — using cached data
            </div>
          )}

          {/* Live stream + stats */}
          {!isLoading && (
            <LiveStream
              entries={feedEntries}
              agentStats={agentStats}
              currentBlock={currentBlock}
              lastUpdated={lastUpdated}
            />
          )}

          {/* Loading state */}
          {isLoading && (
            <div style={{
              textAlign:  "center",
              padding:    "48px",
              color:      "#334155",
              fontSize:   "0.85rem",
              fontFamily: "monospace",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "12px", animation: "spin 1.5s linear infinite", display: "inline-block" }}>
                ⟳
              </div>
              <div>Connecting to Mantle Network…</div>
            </div>
          )}

          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", alignItems: "start" }}>

            {/* Left: Agent cards */}
            <div>
              <div style={{
                color:         "#475569",
                fontSize:      "0.65rem",
                letterSpacing: "0.16em",
                fontWeight:    600,
                marginBottom:  "12px",
              }}>
                AGENT IDENTITIES — ERC-8004
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {agentStats.map((s) => (
                  <AgentCard key={s.address} stats={s} isLive />
                ))}
                {/* YOUR MANUAL CARDS HERE */}
    <div style={{
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(34,211,238,0.2)",
      borderRadius: "12px",
      padding:      "16px",
    }}>
      <h3 style={{ color: "#22d3ee", margin: "0 0 6px 0" }}>Worker (Token #1)</h3>
      <p style={{ color: "#94a3b8", margin: "0", fontSize: "0.8rem", fontFamily: "monospace" }}>
        Address: 0x79EE8E925bCAD1b87dCD4bb0C6bD13E5BDE19C6
      </p>
      <p style={{ color: "#fbbf24", margin: "8px 0 0 0", fontSize: "0.9rem", fontWeight: "bold" }}>
        Reputation: 128
      </p>
    </div>

    <div style={{
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(168,85,247,0.2)",
      borderRadius: "12px",
      padding:      "16px",
    }}>
      <h3 style={{ color: "#a855f7", margin: "0 0 6px 0" }}>Consumer (Token #2)</h3>
      <p style={{ color: "#94a3b8", margin: "0", fontSize: "0.8rem", fontFamily: "monospace" }}>
        Address: 0x0e1ceE04C05CF4f173C1e4075b3f25416e0385e3
      </p>
      <p style={{ color: "#fbbf24", margin: "8px 0 0 0", fontSize: "0.9rem", fontWeight: "bold" }}>
        Reputation: 129
      </p>
    </div>
    {/* YOUR MANUAL CARDS HERE */}

             </div>
              {/* Summary stats */}
              <div style={{
                marginTop:    "16px",
                background:   "rgba(255,255,255,0.02)",
                border:       "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding:      "14px",
              }}>
                <div style={{ color: "#475569", fontSize: "0.65rem", letterSpacing: "0.12em", marginBottom: "10px" }}>
                  ECONOMY TOTALS
                </div>
                {[
                  ["Tasks posted",    tasksPosted.length],
                  ["Tasks completed", tasksCompleted.length],
                  ["Success rate",    tasksPosted.length
                    ? `${Math.round((tasksCompleted.length / tasksPosted.length) * 100)}%`
                    : "—"],
                  ["Events logged",   feedEntries.length],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    padding:        "5px 0",
                    borderBottom:   "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <span style={{ color: "#475569", fontSize: "0.75rem" }}>{label}</span>
                    <span style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Decision log */}
            <div>
              <div style={{
                color:         "#475569",
                fontSize:      "0.65rem",
                letterSpacing: "0.16em",
                fontWeight:    600,
                marginBottom:  "12px",
              }}>
                ON-CHAIN DECISION LOG
              </div>
              <DecisionLog entries={feedEntries} />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop:    "40px",
            paddingTop:   "20px",
            borderTop:    "1px solid rgba(255,255,255,0.06)",
            display:      "flex",
            justifyContent: "space-between",
            alignItems:   "center",
          }}>
            <div style={{ color: "#1e293b", fontSize: "0.7rem", fontFamily: "monospace" }}>
               Agentic Wallets & Economy
            </div>
            <a
              href={`${ACTIVE_NETWORK.explorer}/address/${process.env.VITE_SIMPLE_ECONOMY_ADDRESS ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#334155", fontSize: "0.7rem", fontFamily: "monospace", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
            >
              SimpleEconomy contract ↗
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
