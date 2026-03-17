import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

const FIELD_LABELS: Record<string, string> = {
  s1MinAge:    "Stack 1 Age",
  s1MinEng:    "Stack 1→2 Min Engagement",
  s2EvalStart: "Eval Window Start",
  s2EvalEnd:   "Eval Window End",
  s2GrowthPct: "Stack 2→3 Growth %",
};
const FIELD_UNITS: Record<string, string> = {
  s1MinAge: "min", s1MinEng: "eng", s2EvalStart: "min", s2EvalEnd: "min", s2GrowthPct: "%",
};

const inpStyle: any = { background:"#0A0C12", border:"1px solid #374151", borderRadius:6, padding:"6px 10px", color:"#F9FAFB", fontFamily:"inherit", fontSize:12, outline:"none", colorScheme:"dark" };

function timeAgo(ts: any) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60)    return `${Math.round(d)}s ago`;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function getDiff(before: any, after: any) {
  return Object.keys(FIELD_LABELS).filter(k => before[k] !== after[k]).map(k => ({
    key: k, label: FIELD_LABELS[k], unit: FIELD_UNITS[k] ?? "", from: before[k], to: after[k],
  }));
}

export default function AllEdits() {
  const [edits,    setEdits]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [sub,      setSub]      = useState("all");
  const [time,     setTime]     = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  useEffect(() => {
    setLoading(true);
    api.getAllThresholdEdits()
      .then(setEdits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();

  function getTimeBounds() {
    if (time === "today")  return { from: now - 86400000,    to: now };
    if (time === "week")   return { from: now - 7*86400000,  to: now };
    if (time === "month")  return { from: now - 30*86400000, to: now };
    if (time === "custom") {
      const f = fromDate ? new Date(fromDate).getTime() : 0;
      const t = toDate   ? new Date(toDate).getTime() + 86399999 : now;
      return { from: f, to: t };
    }
    return { from: 0, to: Infinity };
  }

  const { from: tFrom, to: tTo } = getTimeBounds();

  const subreddits = [...new Set(edits.map((e: any) => e.subreddit).filter(Boolean))].sort() as string[];

  const visible = edits.filter((e: any) => {
    const ts = new Date(e.editedAt).getTime();
    if (ts < tFrom || ts > tTo) return false;
    if (sub !== "all" && e.subreddit !== sub) return false;
    if (search) {
      const q = search.toLowerCase();
      const subMatch  = (e.subreddit ?? "global").toLowerCase().includes(q);
      const noteMatch = (e.note ?? "").toLowerCase().includes(q);
      const before = JSON.parse(e.before);
      const after  = JSON.parse(e.after);
      const diffMatch = getDiff(before, after).some(d => d.label.toLowerCase().includes(q));
      if (!subMatch && !noteMatch && !diffMatch) return false;
    }
    return true;
  });

  const timeBtns = [
    ["all","All time"], ["today","Today"], ["week","7d"], ["month","30d"], ["custom","Custom"],
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header + filters */}
      <div style={{ flexShrink:0, padding:"20px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:26, height:26, background:"#3B82F6", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>✏️</div>
            <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>All Threshold Edits</span>
          </div>
          <span style={{ fontSize:10, color:"#6B7280", background:"#1F2937", padding:"2px 8px", borderRadius:10 }}>
            {visible.length}{edits.length !== visible.length ? ` / ${edits.length}` : ""} edits
          </span>
        </div>

        {/* Row 1: search + subreddit filter */}
        <div style={{ display:"flex", gap:10, marginBottom:8, alignItems:"center", flexWrap:"wrap" as const }}>
          <input
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search by subreddit, note, or field name…"
            style={{ flex:1, minWidth:200, ...inpStyle, padding:"8px 12px" }}
          />
          <select value={sub} onChange={(e: any) => setSub(e.target.value)}
            style={{ ...inpStyle, padding:"8px 10px", cursor:"pointer" }}>
            <option value="all">All subreddits</option>
            {subreddits.map((s: string) => <option key={s} value={s}>r/{s}</option>)}
          </select>
        </div>

        {/* Row 2: time filter */}
        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" as const, alignItems:"center" }}>
          {timeBtns.map(([k, l]) => (
            <button key={k} onClick={() => setTime(k)}
              style={{ background: time===k ? "#1C1400":"#1F2937", color: time===k ? "#F59E0B":"#9CA3AF",
                border: time===k ? "1px solid #78350F":"1px solid #374151", borderRadius:6,
                padding:"7px 14px", fontSize:11, fontWeight: time===k ? 700:500,
                cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" as const }}>
              {l}
            </button>
          ))}
          {time === "custom" && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:4 }}>
              <span style={{ fontSize:11, color:"#6B7280" }}>From</span>
              <input type="date" value={fromDate} onChange={(e: any) => setFromDate(e.target.value)} style={inpStyle} />
              <span style={{ fontSize:11, color:"#6B7280" }}>To</span>
              <input type="date" value={toDate} onChange={(e: any) => setToDate(e.target.value)} style={inpStyle} />
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 24px 24px" }}>
        {loading ? (
          <div style={{ color:"#6B7280", fontSize:12, padding:"40px 0", textAlign:"center" }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ border:"1px dashed #1F2937", borderRadius:10, padding:"48px 20px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>📝</div>
            <div style={{ fontSize:12, color:"#6B7280" }}>
              {edits.length === 0 ? "No threshold edits recorded yet." : "No results match your filters."}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {visible.map((edit: any) => {
              const before = JSON.parse(edit.before);
              const after  = JSON.parse(edit.after);
              const diff   = getDiff(before, after);
              return (
                <div key={edit.id} style={{ background:"#0F1117", border:"1px solid #1F2937", borderRadius:10, padding:"14px 18px" }}
                  onMouseEnter={(e: any) => e.currentTarget.style.borderColor="#374151"}
                  onMouseLeave={(e: any) => e.currentTarget.style.borderColor="#1F2937"}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom: diff.length ? 10 : 0 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"#FF4500", fontWeight:600 }}>
                          r/{edit.subreddit ?? "global"}
                        </span>
                        <span style={{ fontSize:11, color:"#6B7280" }}>
                          {new Date(edit.editedAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                        </span>
                        <span style={{ fontSize:10, color:"#374151" }}>{timeAgo(edit.editedAt)}</span>
                      </div>
                      {edit.note && (
                        <div style={{ fontSize:13, color:"#D1D5DB", fontStyle:"italic" }}>"{edit.note}"</div>
                      )}
                    </div>
                    <span style={{ fontSize:10, color:"#6B7280", background:"#1F2937", padding:"3px 8px", borderRadius:6, whiteSpace:"nowrap" as const, flexShrink:0 }}>
                      {diff.length} change{diff.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {diff.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                      {diff.map(d => (
                        <div key={d.key} style={{ background:"#0A0C12", border:"1px solid #1F2937", borderRadius:6, padding:"5px 10px", fontSize:11 }}>
                          <span style={{ color:"#6B7280" }}>{d.label}: </span>
                          <span style={{ color:"#EF4444", fontWeight:600 }}>{d.from}{d.unit}</span>
                          <span style={{ color:"#4B5563", margin:"0 5px" }}>→</span>
                          <span style={{ color:"#22C55E", fontWeight:600 }}>{d.to}{d.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
