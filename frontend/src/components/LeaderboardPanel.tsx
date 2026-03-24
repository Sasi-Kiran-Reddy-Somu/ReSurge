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

type SortKey = "avgPerDay" | "totalUpvotes" | "totalPosted" | "upvoteRate" | "activeDays" | "last24hPosted";

const SORT_BTNS: { key: SortKey; label: string; color: string; tip: string }[] = [
  { key: "avgPerDay",     label: "Avg Comments/Day", color: C.amber,  tip: "Average number of comments posted per active day" },
  { key: "totalUpvotes",  label: "Total Upvotes",    color: C.green,  tip: "Total upvotes received across all posted comments" },
  { key: "totalPosted",   label: "Total Posts",      color: C.text,   tip: "Total number of comments posted through this tool" },
  { key: "upvoteRate",    label: "Upvote Rate",      color: C.amber,  tip: "Average upvotes per comment posted (total upvotes ÷ total posted)" },
  { key: "activeDays",    label: "Active Days",      color: C.purple, tip: "Number of distinct days on which at least one comment was posted" },
  { key: "last24hPosted", label: "Last 24h",         color: C.blue,   tip: "Number of comments posted in the last 24 hours" },
];

function fmt1(n: number) { return Number.isFinite(n) ? n.toFixed(1) : "0.0"; }

export default function LeaderboardPanel({ token, role: roleProp }: { token: string; role?: string }) {
  const role = roleProp ?? (() => { try { return JSON.parse(localStorage.getItem("user_data") ?? "{}").role ?? "monitor"; } catch { return "monitor"; } })();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("avgPerDay");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "holder" | "monitor">("all");
  const [hoveredTip, setHoveredTip] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setRows(Array.isArray(data) ? data : []);
        const latest = (Array.isArray(data) ? data : []).find((d: any) => d.updatedAt);
        if (latest) setUpdatedAt(new Date(latest.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = rows.filter(r => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);

  const inp: any = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 14px", color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px", fontFamily: "'IBM Plex Sans',sans-serif" }}>
      <div style={{ maxWidth: 920 }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", fontWeight: 600, marginBottom: 6 }}>LEADERBOARD</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Team Performance</div>
            {updatedAt && <div style={{ fontSize: 11, color: C.dim }}>Last updated {updatedAt}</div>}
          </div>
        </div>

        {/* Search + role filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...inp, flex: "1 1 200px" }}
            placeholder="Search by name…"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "holder", ...(role !== "holder" ? ["monitor"] : [])] as const).map((f: any) => {
              const col = f === "all" ? C.text : ROLE_COLOR[f];
              const active = roleFilter === f;
              return (
                <button key={f} onClick={() => setRoleFilter(f)}
                  style={{ background: active ? col + "18" : "none", border: active ? `1px solid ${col}40` : `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: active ? 700 : 500, color: active ? col : C.muted }}>
                  {f === "all" ? "All" : ROLE_LABEL[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {SORT_BTNS.map(({ key, label, color, tip }) => {
            const active = sortBy === key;
            return (
              <button key={key} onClick={() => setSortBy(key)}
                style={{ background: active ? color + "15" : "none", border: active ? `1px solid ${color}50` : `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: active ? 700 : 500, color: active ? color : C.muted, transition: "all 0.12s", display: "flex", alignItems: "center", gap: 5, position: "relative" }}>
                {active ? `↓ ${label}` : label}
                <span
                  onMouseEnter={() => setHoveredTip(key)}
                  onMouseLeave={() => setHoveredTip(null)}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", border: `1px solid ${active ? color + "80" : C.muted + "60"}`, fontSize: 9, fontWeight: 800, color: active ? color : C.muted, cursor: "help", flexShrink: 0, lineHeight: 1 }}>i</span>
                {hoveredTip === key && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1F2937", border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 11px", fontSize: 11, color: C.text, whiteSpace: "normal", zIndex: 100, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", maxWidth: 240, lineHeight: 1.5 }}>
                    {tip}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "48px 24px", textAlign: "center", color: C.dim, fontSize: 13 }}>
            {search || roleFilter !== "all" ? "No users match your filters." : "No data yet — leaderboard updates daily at 3pm IST."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.map((row, idx) => {
              const rc = ROLE_COLOR[row.role] ?? C.sub;
              const isTop3 = idx < 3;
              const activeSortColor = SORT_BTNS.find(s => s.key === sortBy)?.color ?? C.text;
              return (
                <div key={row.userId} style={{
                  background: isTop3 ? `${RANK_COLORS[idx]}08` : C.surface,
                  border: `1px solid ${isTop3 ? RANK_COLORS[idx] + "30" : C.border}`,
                  borderRadius: 12, padding: "16px 20px",
                  display: "grid", gridTemplateColumns: "40px 1fr repeat(6, 82px)",
                  alignItems: "center", gap: 10,
                }}>
                  {/* Rank */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isTop3 ? RANK_COLORS[idx] : C.dim }}>#{idx + 1}</span>
                  </div>

                  {/* Name + role */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{row.name}</div>
                    <span style={{ fontSize: 10, color: rc, background: rc + "18", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                      {ROLE_LABEL[row.role] ?? row.role}
                    </span>
                  </div>

                  {/* Avg/day */}
                  <Metric value={fmt1(row.avgPerDay)} label="AVG CMTS/DAY" color={C.amber} highlight={sortBy === "avgPerDay"} />

                  {/* Total upvotes */}
                  <Metric value={String(row.totalUpvotes)} label="UPVOTES" color={C.green} highlight={sortBy === "totalUpvotes"} />

                  {/* Total posted */}
                  <Metric value={String(row.totalPosted)} label="POSTED" color={C.text} highlight={sortBy === "totalPosted"} />

                  {/* Upvote rate */}
                  <Metric value={fmt1(row.upvoteRate)} label="UPV/POST" color={C.amber} highlight={sortBy === "upvoteRate"} />

                  {/* Active days */}
                  <Metric value={String(row.activeDays)} label="ACTIVE DAYS" color={C.purple} highlight={sortBy === "activeDays"} />

                  {/* Last 24h */}
                  <Metric value={String(row.last24hPosted)} label="LAST 24H" color={row.last24hPosted > 0 ? C.blue : C.dim} highlight={sortBy === "last24hPosted"} />
                </div>
              );
            })}
          </div>
        )}

        {sorted.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 10, color: C.dim, textAlign: "right" }}>
            {sorted.length} member{sorted.length !== 1 ? "s" : ""} shown
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label, color, highlight }: { value: string; label: string; color: string; highlight: boolean }) {
  return (
    <div style={{ textAlign: "center", background: highlight ? color + "0D" : "none", borderRadius: 8, padding: "4px 0" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight ? color : color }}>{value}</div>
      <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
    </div>
  );
}
