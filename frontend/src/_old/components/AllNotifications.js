import React, { useState, useEffect } from "react";
import { api } from "../utils/api.js";

function timeAgo(ts) {
  const d = (Date.now() - Number(ts)) / 1000;
  if (d < 60)    return `${Math.round(d)}s ago`;
  if (d < 3600)  return `${Math.round(d/60)}m ago`;
  if (d < 86400) return `${Math.round(d/3600)}h ago`;
  return `${Math.round(d/86400)}d ago`;
}

const inpStyle = { background:"#0A0C12", border:"1px solid #374151", borderRadius:6, padding:"6px 10px", color:"#F9FAFB", fontFamily:"inherit", fontSize:12, outline:"none", colorScheme:"dark" };

export default function AllNotifications() {
  const [posts,    setPosts]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState("");
  const [time,     setTime]    = useState("all");
  const [status,   setStatus]  = useState("all");
  const [sub,      setSub]     = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]  = useState("");

  useEffect(() => {
    setLoading(true);
    api.getAllHistory()
      .then(setPosts)
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

  // Unique subreddits for filter
  const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();

  const visible = posts.filter(p => {
    const alerted = Number(p.alertedAt);
    if (alerted < tFrom || alerted > tTo) return false;
    if (status === "active"  && p.discarded)  return false;
    if (status === "expired" && !p.discarded) return false;
    if (sub !== "all" && p.subreddit !== sub) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.subreddit.toLowerCase().includes(q) && !p.author.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const timeBtns = [
    ["all","All time"], ["today","Today"], ["week","7d"], ["month","30d"], ["custom","Custom"],
  ];
  const statusBtns = [
    { k:"all", l:"All", c:"#F9FAFB" },
    { k:"active", l:"Active", c:"#22C55E" },
    { k:"expired", l:"Expired", c:"#EF4444" },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Fixed header + filters */}
      <div style={{ flexShrink:0, padding:"20px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>
            🔔 All Stack 4 Notifications
          </span>
          <span style={{ fontSize:10, color:"#6B7280", background:"#1F2937", padding:"2px 8px", borderRadius:10 }}>
            {visible.length}{posts.length !== visible.length ? ` / ${posts.length}` : ""} posts
          </span>
        </div>

        {/* Row 1: search + status + subreddit */}
        <div style={{ display:"flex", gap:10, marginBottom:8, alignItems:"center", flexWrap:"wrap" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, subreddit, author…"
            style={{ flex:1, minWidth:200, ...inpStyle, padding:"8px 12px" }}
          />
          <select value={sub} onChange={e => setSub(e.target.value)}
            style={{ ...inpStyle, padding:"8px 10px", cursor:"pointer" }}>
            <option value="all">All subreddits</option>
            {subreddits.map(s => <option key={s} value={s}>r/{s}</option>)}
          </select>
          <div style={{ display:"flex", gap:6 }}>
            {statusBtns.map(({ k, l, c }) => (
              <button key={k} onClick={() => setStatus(k)}
                style={{ background: status===k ? "#111827":"#1F2937", color: status===k ? c:"#9CA3AF",
                  border: status===k ? `1px solid ${c}40`:"1px solid #374151", borderRadius:6,
                  padding:"7px 14px", fontSize:11, fontWeight: status===k ? 700:500,
                  cursor:"pointer", fontFamily:"inherit" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: time filter */}
        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          {timeBtns.map(([k, l]) => (
            <button key={k} onClick={() => setTime(k)}
              style={{ background: time===k ? "#1C1400":"#1F2937", color: time===k ? "#F59E0B":"#9CA3AF",
                border: time===k ? "1px solid #78350F":"1px solid #374151", borderRadius:6,
                padding:"7px 14px", fontSize:11, fontWeight: time===k ? 700:500,
                cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {l}
            </button>
          ))}
          {time === "custom" && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:4 }}>
              <span style={{ fontSize:11, color:"#6B7280" }}>From</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inpStyle} />
              <span style={{ fontSize:11, color:"#6B7280" }}>To</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inpStyle} />
            </div>
          )}
        </div>
      </div>

      {/* Scrollable table */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 24px 24px" }}>
        {loading ? (
          <div style={{ color:"#6B7280", fontSize:12, padding:"40px 0", textAlign:"center" }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ border:"1px dashed #1F2937", borderRadius:10, padding:"48px 20px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>📂</div>
            <div style={{ fontSize:12, color:"#6B7280" }}>
              {posts.length === 0 ? "No posts have reached Stack 4 yet." : "No results match your filters."}
            </div>
          </div>
        ) : (
          <div style={{ background:"#0F1117", border:"1px solid #1F2937", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"120px 100px 1fr 80px 70px 70px 80px", gap:12, padding:"10px 18px", borderBottom:"1px solid #1F2937", position:"sticky", top:0, background:"#0F1117", zIndex:1 }}>
              {["Alerted","Subreddit","Post","Growth","Upvotes","Eng","Status"].map(h => (
                <div key={h} style={{ fontSize:10, color:"#6B7280", fontWeight:700, letterSpacing:"0.05em" }}>{h}</div>
              ))}
            </div>
            {visible.map(p => (
              <div key={p.id}
                style={{ display:"grid", gridTemplateColumns:"120px 100px 1fr 80px 70px 70px 80px", gap:12, padding:"13px 18px", borderBottom:"1px solid #111318", alignItems:"center", transition:"background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background="#13161F"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div style={{ fontSize:11, color:"#9CA3AF" }}>
                  {new Date(Number(p.alertedAt)).toLocaleDateString()}
                  <div style={{ fontSize:10, color:"#6B7280", marginTop:2 }}>{timeAgo(p.alertedAt)}</div>
                </div>
                <div style={{ fontSize:11, color:"#FF4500", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  r/{p.subreddit}
                </div>
                <div style={{ minWidth:0 }}>
                  <a href={p.url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize:13, color:"#D1D5DB", lineHeight:1.4, textDecoration:"none", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {p.title}
                  </a>
                  <div style={{ fontSize:10, color:"#6B7280", marginTop:3 }}>u/{p.author}</div>
                </div>
                <div style={{ fontSize:12, color:"#F59E0B", fontWeight:600 }}>+{Number(p.lastGrowth ?? 0).toFixed(1)}%</div>
                <div style={{ fontSize:12, color:"#9CA3AF" }}>⬆ {p.upvotes}</div>
                <div style={{ fontSize:12, color:"#6B7280" }}>{p.engagement}</div>
                <div>
                  <span style={{ fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:20,
                    background: p.discarded ? "#1F1014":"#0A1A0A",
                    color: p.discarded ? "#EF4444":"#22C55E",
                    border: `1px solid ${p.discarded ? "#7F1D1D":"#14532D"}` }}>
                    {p.discarded ? "expired" : "active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
