import React, { useState } from "react";

export default function Sidebar({ subreddits, activeTab, onSwitch, onAdd, stackCounts, countdown, lastRefresh, view, onViewMonitors, onViewHolders, onViewNotifications, onViewSubreddits, onViewAlerts, alertCount, onViewAddUsers, onViewAllEdits, onLogout }: any) {
  const [input,      setInput]      = useState("");
  const [err,        setErr]        = useState("");
  const [busy,       setBusy]       = useState(false);

  async function handleAdd() {
    const clean = input.replace(/^r\//, "").trim().toLowerCase();
    if (!clean) return;
    setBusy(true); setErr("");
    try {
      await onAdd(clean);
      setInput("");
    } catch (e: any) {
      setErr(e.message);
      setTimeout(() => setErr(""), 3000);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ width:236, borderRight:"1px solid #1A1D2E", display:"flex", flexDirection:"column", height:"100%", flexShrink:0 }}>
      {/* Logo */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid #111318" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, background:"#FF4500", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff" }}>r/</div>
          <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:15 }}>ReSurge</span>
        </div>
      </div>

      {/* Add */}
      <div style={{ padding:"12px 12px 8px" }}>
        <div style={{ fontSize:9, color:"#6B7280", letterSpacing:"1px", marginBottom:8, fontWeight:500 }}>SUBREDDITS</div>
        <div style={{ display:"flex", gap:6 }}>
          <input value={input} onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={(e: any) => e.key === "Enter" && handleAdd()}
            placeholder="r/subreddit"
            style={{ flex:1, background:"#111318", border:`1px solid ${err?"#EF4444":"#1F2937"}`, borderRadius:6, padding:"7px 9px", fontSize:11, color:"#E5E7EB", outline:"none" }}
          />
          <button onClick={handleAdd} disabled={busy}
            style={{ background:"#1F2937", border:"none", borderRadius:6, width:28, cursor:"pointer", color:"#9CA3AF", fontSize:18, transition:"background 0.15s" }}
            onMouseEnter={(e: any) => e.target.style.background="#FF4500"}
            onMouseLeave={(e: any) => e.target.style.background="#1F2937"}
          >{busy ? "…" : "+"}</button>
        </div>
        {err && <div style={{ fontSize:10, color:"#EF4444", marginTop:4 }}>{err}</div>}
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 8px" }}>
        {subreddits.map((sub: any) => {
          const name     = sub.name ?? sub;
          const isActive = activeTab === name && view === "tracker";
          return (
            <div key={name} onClick={() => onSwitch(name)} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"8px 10px", borderRadius:7, cursor:"pointer", marginBottom:2,
              background: isActive ? "#1A1D2E" : "transparent",
              borderLeft:`2px solid ${isActive ? "#FF4500" : "transparent"}`,
              transition:"all 0.15s",
            }}
            onMouseEnter={(e: any) => { if (!isActive) e.currentTarget.style.background="#111318"; }}
            onMouseLeave={(e: any) => { if (!isActive) e.currentTarget.style.background="transparent"; }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, overflow:"hidden", flex:1 }}>
                <span style={{ fontSize:10, color:"#FF4500", fontWeight:500, flexShrink:0 }}>r/</span>
                <span style={{ fontSize:12, color: isActive ? "#F9FAFB":"#9CA3AF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
              </div>
              {isActive && stackCounts.s3 > 0 && (
                <span style={{ background:"#F59E0B", color:"#000", borderRadius:10, padding:"1px 5px", fontSize:9, fontWeight:700, flexShrink:0 }}>{stackCounts.s3}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Nav + logout */}
      <div style={{ padding:"8px 12px", borderTop:"1px solid #1A1D2E" }}>
        {[
          {
            label:"Alerts", active:view==="alerts", color:"#EF4444", bg:"#1C0505", onClick:onViewAlerts, badge: alertCount > 0 ? alertCount : null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          },
          {
            label:"All Notifications", active:view==="notifications", color:"#F59E0B", bg:"#1C1400", onClick:onViewNotifications, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          },
          {
            label:"All Edits", active:view==="all-edits", color:"#3B82F6", bg:"#0D1626", onClick:onViewAllEdits, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          },
          {
            label:"Manage Subreddits", active:view==="subreddits", color:"#9CA3AF", bg:"#111318", onClick:onViewSubreddits, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
          },
          {
            label:"Monitors", active:view==="monitors", color:"#93C5FD", bg:"#0D1626", onClick:onViewMonitors, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          },
          {
            label:"Holders", active:view==="holders", color:"#4ADE80", bg:"#071A0A", onClick:onViewHolders, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          },
          {
            label:"Users", active:view==="add-users", color:"#A78BFA", bg:"#13092E", onClick:onViewAddUsers, badge: null,
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          },
        ].map(({label,icon,active,color,bg,onClick,badge}) => (
          <div key={label} onClick={onClick}
            style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:7, cursor:"pointer", marginBottom:2,
              background:active?bg:"transparent", borderLeft:`2px solid ${active?color:"transparent"}`, transition:"background 0.12s" }}
            onMouseEnter={(e: any) => { if (!active) e.currentTarget.style.background="#111318"; }}
            onMouseLeave={(e: any) => { if (!active) e.currentTarget.style.background="transparent"; }}>
            <span style={{ width:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:active?color:"#6B7280" }}>{icon}</span>
            <span style={{ fontSize:12, color:active?color:"#9CA3AF", fontWeight:active?600:400, flex:1 }}>{label}</span>
            {badge !== null && badge > 0 && (
              <span style={{ background:"#EF4444", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:9, fontWeight:700, flexShrink:0 }}>{badge}</span>
            )}
          </div>
        ))}
        {onLogout && (
          <div onClick={onLogout} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:7, cursor:"pointer" }}
            onMouseEnter={(e: any) => e.currentTarget.style.background="#111318"}
            onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
            <span style={{ width:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#6B7280" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span style={{ fontSize:12, color:"#9CA3AF" }}>Logout</span>
          </div>
        )}
      </div>

      {/* Poll countdown */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid #1A1D2E" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ fontSize:9, color:"#6B7280", letterSpacing:"0.5px" }}>NEXT REFRESH</span>
          <span style={{ fontSize:11, color:"#22C55E", fontWeight:500 }}>{countdown}s</span>
        </div>
        <div style={{ width:"100%", height:3, background:"#1F2937", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#22C55E", borderRadius:2, width:`${(1-(countdown/15))*100}%`, transition:"width 1s linear" }} />
        </div>
        {lastRefresh && (
          <div style={{ fontSize:9, color:"#6B7280", marginTop:5 }}>
            refreshed {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
