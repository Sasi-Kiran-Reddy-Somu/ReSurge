import React, { useState, useEffect } from "react";

const C = {
  bg: "#0D0F16", surface: "#0F1117", border: "#1F2937",
  text: "#F9FAFB", muted: "#6B7280", dim: "#374151", sub: "#9CA3AF",
  green: "#22C55E", blue: "#3B82F6", amber: "#F59E0B", red: "#EF4444",
  purple: "#A78BFA",
};

const ROLE_COLOR: any = { holder: "#F59E0B", monitor: "#3B82F6", main: "#A78BFA" };
const ROLE_LABEL: any = { holder: "Holder", monitor: "Monitor", main: "Admin" };

const RANK_COLORS = ["#F59E0B", "#9CA3AF", "#CD7C3E"];
const RANK_LABELS = ["🥇", "🥈", "🥉"];

function fmt1(n: number) { return n.toFixed(1); }

export default function LeaderboardPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [sortBy, setSortBy] = useState<"totalUpvotes" | "totalPosted" | "upvoteRate" | "activeDays" | "last24hPosted">("totalUpvotes");

  useEffect(() => {
    fetch("/api/leaderboard", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setRows(data);
        if (data.length > 0 && data[0].updatedAt) {
          setUpdatedAt(new Date(data[0].updatedAt).toLocaleString());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const sorted = [...rows].sort((a, b) => b[sortBy] - a[sortBy]);

  const SORT_BTNS: { key: typeof sortBy; label: string }[] = [
    { key: "totalUpvotes",  label: "Total Upvotes" },
    { key: "totalPosted",   label: "Total Posts" },
    { key: "upvoteRate",    label: "Upvote Rate" },
    { key: "activeDays",    label: "Active Days" },
    { key: "last24hPosted", label: "Last 24h" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px", fontFamily: "'IBM Plex Sans',sans-serif" }}>
      <div style={{ maxWidth: 860 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", fontWeight: 600, marginBottom: 6 }}>LEADERBOARD</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Team Performance</div>
            {updatedAt && <div style={{ fontSize: 11, color: C.dim }}>Updated {updatedAt}</div>}
          </div>
        </div>

        {/* Sort tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {SORT_BTNS.map(({ key, label }) => (
            <button key={key} onClick={() => setSortBy(key)}
              style={{
                background: sortBy === key ? "#1A1D2E" : "none",
                border: sortBy === key ? "1px solid #3B82F640" : `1px solid ${C.border}`,
                borderRadius: 7, padding: "6px 14px", cursor: "pointer",
                fontFamily: "inherit", fontSize: 11, fontWeight: sortBy === key ? 700 : 500,
                color: sortBy === key ? C.blue : C.muted,
              }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "48px 24px", textAlign: "center", color: C.dim, fontSize: 13 }}>
            No data yet — leaderboard updates daily at 3pm IST.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map((row, idx) => {
              const rc = ROLE_COLOR[row.role] ?? C.sub;
              const isTop3 = idx < 3;
              return (
                <div key={row.userId} style={{
                  background: isTop3 ? `${RANK_COLORS[idx]}08` : C.surface,
                  border: `1px solid ${isTop3 ? RANK_COLORS[idx] + "30" : C.border}`,
                  borderRadius: 12, padding: "18px 22px",
                  display: "grid", gridTemplateColumns: "44px 1fr repeat(5, 90px)",
                  alignItems: "center", gap: 12,
                }}>
                  {/* Rank */}
                  <div style={{ textAlign: "center" }}>
                    {isTop3
                      ? <span style={{ fontSize: 22 }}>{RANK_LABELS[idx]}</span>
                      : <span style={{ fontSize: 14, fontWeight: 700, color: C.dim }}>#{idx + 1}</span>
                    }
                  </div>

                  {/* Name + role */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{row.name}</div>
                    <span style={{ fontSize: 10, color: rc, background: rc + "18", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                      {ROLE_LABEL[row.role] ?? row.role}
                    </span>
                  </div>

                  {/* Total upvotes */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{row.totalUpvotes}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginTop: 2 }}>UPVOTES</div>
                  </div>

                  {/* Total posted */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{row.totalPosted}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginTop: 2 }}>POSTED</div>
                  </div>

                  {/* Upvote rate */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.amber }}>{fmt1(row.upvoteRate)}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginTop: 2 }}>UPV/POST</div>
                  </div>

                  {/* Active days */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>{row.activeDays}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginTop: 2 }}>ACTIVE DAYS</div>
                  </div>

                  {/* Last 24h */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: row.last24hPosted > 0 ? C.blue : C.dim }}>{row.last24hPosted}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginTop: 2 }}>LAST 24H</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Note about avg/day */}
        {sorted.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11, color: C.dim, textAlign: "right" }}>
            Avg comments/day: {sorted.map(r => `${r.name.split(" ")[0]} ${fmt1(r.avgPerDay)}`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
