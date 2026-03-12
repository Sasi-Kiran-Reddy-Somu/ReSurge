import React, { useState } from "react";

export default function Sidebar({ subreddits, activeTab, onSwitch, onAdd, stackCounts, countdown, lastRefresh, view, onViewMonitors, onViewHolders, onViewNotifications, onViewSubreddits, onLogout }) {
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
    } catch (e) {
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
          <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:15 }}>Reddit Tracker</span>
        </div>
      </div>

      {/* Add */}
      <div style={{ padding:"12px 12px 8px" }}>
        <div style={{ fontSize:9, color:"#6B7280", letterSpacing:"1px", marginBottom:8, fontWeight:500 }}>SUBREDDITS</div>
        <div style={{ display:"flex", gap:6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="r/subreddit"
            style={{ flex:1, background:"#111318", border:`1px solid ${err?"#EF4444":"#1F2937"}`, borderRadius:6, padding:"7px 9px", fontSize:11, color:"#E5E7EB", outline:"none" }}
          />
          <button onClick={handleAdd} disabled={busy}
            style={{ background:"#1F2937", border:"none", borderRadius:6, width:28, cursor:"pointer", color:"#9CA3AF", fontSize:18, transition:"background 0.15s" }}
            onMouseEnter={e => e.target.style.background="#FF4500"}
            onMouseLeave={e => e.target.style.background="#1F2937"}
          >{busy ? "…" : "+"}</button>
        </div>
        {err && <div style={{ fontSize:10, color:"#EF4444", marginTop:4 }}>{err}</div>}
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 8px" }}>
        {subreddits.map(sub => {
          const name     = sub.name ?? sub;
          const isActive = activeTab === name;
          return (
            <div key={name} onClick={() => onSwitch(name)} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"8px 10px", borderRadius:7, cursor:"pointer", marginBottom:2,
              background: isActive ? "#1A1D2E" : "transparent",
              borderLeft:`2px solid ${isActive ? "#FF4500" : "transparent"}`,
              transition:"all 0.15s",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background="#111318"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background="transparent"; }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, overflow:"hidden", flex:1 }}>
                <span style={{ fontSize:10, color:"#FF4500", fontWeight:500, flexShrink:0 }}>r/</span>
                <span style={{ fontSize:12, color: isActive ? "#F9FAFB":"#9CA3AF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
              </div>
              {isActive && stackCounts.s4 > 0 && (
                <span style={{ background:"#F59E0B", color:"#000", borderRadius:10, padding:"1px 5px", fontSize:9, fontWeight:700, flexShrink:0 }}>{stackCounts.s4}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Manage Subreddits + nav + logout */}
      <div style={{ padding:"8px 12px", borderTop:"1px solid #1A1D2E" }}>
        {[
          { label:"All Notifications", icon:"🔔", active:view==="notifications", color:"#F59E0B", bg:"#1C1400",    onClick:onViewNotifications },
          { label:"Manage Subreddits", icon:"⚙️",  active:view==="subreddits",     color:"#9CA3AF", bg:"#111318",     onClick:onViewSubreddits },
          { label:"Monitors",          icon:"👁️",   active:view==="monitors",      color:"#93C5FD", bg:"#0D1626",    onClick:onViewMonitors },
          { label:"Holders",           icon:"👤",   active:view==="holders",       color:"#4ADE80", bg:"#071A0A",    onClick:onViewHolders },
        ].map(({label,icon,active,color,bg,onClick})=>(
          <div key={label} onClick={onClick}
            style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:7, cursor:"pointer", marginBottom:2,
              background:active?bg:"transparent", borderLeft:`2px solid ${active?color:"transparent"}`, transition:"background 0.12s" }}
            onMouseEnter={e=>{ if(!active)e.currentTarget.style.background="#111318"; }}
            onMouseLeave={e=>{ if(!active)e.currentTarget.style.background="transparent"; }}>
            <span style={{ fontSize:15, width:20, textAlign:"center", flexShrink:0, lineHeight:1 }}>{icon}</span>
            <span style={{ fontSize:12, color:active?color:"#9CA3AF", fontWeight:active?600:400 }}>{label}</span>
          </div>
        ))}
        {onLogout && (
          <div onClick={onLogout} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:7, cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.background="#111318"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{ fontSize:15, width:20, textAlign:"center", flexShrink:0 }}>→</span>
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
