import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTracker } from "./hooks/useTracker";
import Sidebar      from "./components/Sidebar";
import SliderPanel  from "./components/SliderPanel";
import Stack3Feed   from "./components/Stack4Feed";
import StackModal   from "./components/StackModal";
import MonitorPanel     from "./components/MonitorPanel";
import HoldersPanel     from "./components/HoldersPanel";
import AllNotifications from "./components/AllNotifications";
import PostHistory           from "./components/PostHistory";
import ThresholdEditHistory  from "./components/ThresholdEditHistory";
import AllEdits              from "./components/AllEdits";
import { api }               from "./utils/api";
import SubredditsPanel  from "./components/SubredditsPanel";
import AlertsPanel     from "./components/AlertsPanel";
import AddUsersPanel   from "./components/AddUsersPanel";

// ─────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────
const STACK_COLORS: any = { 1:"#6B7280", 2:"#3B82F6", 3:"#F59E0B" };

const ROLE_LABELS: any = { main:"Main Admin", monitor:"Monitor", holder:"Holder" };
const ROLE_COLORS: any = { main:"#FF4500", monitor:"#3B82F6", holder:"#22C55E" };
const ROLE_DESC: any   = { main:"Admin dashboard & tracker", monitor:"Oversee holder activity", holder:"Post notifications & comments" };

const inp: any = { background:"#0F1117", border:"1px solid #374151", borderRadius:8, padding:"10px 14px", color:"#F9FAFB", width:"100%", boxSizing:"border-box", fontFamily:"inherit", fontSize:13 };

// ─────────────────────────────────────────────────────────────
// JWT decode helper
// ─────────────────────────────────────────────────────────────
function decodeJwt(t: string): any {
  try {
    const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b));
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// LoginGate — Google OAuth only, no role picker
// ─────────────────────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: (token: string, user: any, isNewSignup: boolean) => void }) {
  const btnRef = useRef<any>(null);
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { setErr("Google Client ID not configured (VITE_GOOGLE_CLIENT_ID)"); return; }

    function initGoogle() {
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (btnRef.current) {
        (window as any).google.accounts.id.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 280,
        });
      }
    }

    if ((window as any).google?.accounts?.id) {
      initGoogle();
    } else {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
      if (existing) {
        (existing as any).addEventListener("load", initGoogle);
      } else {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true; s.defer = true;
        s.onload = initGoogle;
        document.head.appendChild(s);
      }
    }
  }, []);

  async function handleCredential(response: any) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      onAuth(data.token, data.user, data.isNewSignup ?? false);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display:"flex", height:"100vh", background:"#0D0F16", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      {/* Left: Branding */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, borderRight:"1px solid #1F2937" }}>
        <div style={{ width:72, height:72, background:"#FF4500", borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:800, color:"#fff", marginBottom:32 }}>r/</div>
        <div style={{ fontSize:48, fontWeight:800, color:"#F9FAFB", letterSpacing:"-0.03em", marginBottom:14 }}>ReSurge</div>
        <div style={{ maxWidth:340, textAlign:"center" }}>
          <div style={{ fontSize:16, color:"#6B7280" }}>Reddit viral post tracker and comment generator</div>
          <div style={{ fontSize:14, color:"#4B5563", marginTop:8, lineHeight:1.7 }}>Catch trending posts before they blow up, then generate and post AI comments in one click.</div>
        </div>
      </div>
      {/* Right: Sign-in */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60 }}>
        <div style={{ width:320 }}>
          <div style={{ marginBottom:36 }}>
            <div style={{ fontSize:24, fontWeight:700, color:"#F9FAFB", marginBottom:8 }}>Welcome back</div>
            <div style={{ fontSize:14, color:"#6B7280" }}>Sign in with your Google account to continue.</div>
          </div>
          {busy && <div style={{ fontSize:13, color:"#6B7280", marginBottom:16 }}>Signing in…</div>}
          <div ref={btnRef} />
          {err && <div style={{ marginTop:20, fontSize:13, color:"#EF4444", background:"#1C0505", border:"1px solid #7F1D1D", borderRadius:8, padding:"12px 16px" }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MainApp — full admin dashboard
// ─────────────────────────────────────────────────────────────
function MainApp({ onLogout }: { onLogout: () => void }) {
  const [view,           setView]           = useState(() => sessionStorage.getItem("main_view") || "notifications");
  const [historyView,    setHistoryView]    = useState<null|"notifications"|"edits">(null);
  const [toast,          setToast]          = useState<any>(null);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [alertCount,    setAlertCount]    = useState(0);

  function loadAlertCount() {
    fetch("/api/admin/alerts", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => r.ok ? r.json() : { total: 0 })
      .then(d => setAlertCount(d.total ?? 0))
      .catch(() => {});
  }

  function changeView(v: string) { setView(v); sessionStorage.setItem("main_view", v); setSelectedHolder(null); }

  function showToast(msg: string) {
    const id = Date.now();
    setToast({ msg, id });
    setTimeout(() => setToast((t: any) => t?.id === id ? null : t), 5000);
  }

  const { subreddits, activeTab, switchTab, thresholds, saveThresholds, stack3Feed, stackCounts, modalPosts, openStackModal, closeModal, addSubreddit, removeSubreddit, dismissPost, countdown, lastRefresh, loading, error } = useTracker();

  useEffect(() => { loadAlertCount(); }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:12 }}>
      <div style={{ width:8, height:8, background:"#22C55E", borderRadius:"50%" }} />
      <span style={{ fontSize:12, color:"#6B7280" }}>Connecting to backend...</span>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:28 }}>⚠️</div>
      <span style={{ fontSize:13, color:"#EF4444" }}>{error}</span>
      <span style={{ fontSize:11, color:"#6B7280" }}>Make sure the backend server is running on port 3001</span>
    </div>
  );

  return (
    <>
    {toast && (
      <div style={{ position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", zIndex:99999, background:"#1A2F1A", border:"1px solid #22C55E66", borderRadius:10, padding:"14px 24px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 40px #00000080", pointerEvents:"none", fontFamily:"'IBM Plex Sans',sans-serif" }}>
        <span style={{ fontSize:16 }}>✅</span>
        <span style={{ fontSize:13, color:"#86EFAC", fontWeight:500 }}>{toast.msg}</span>
      </div>
    )}
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      <Sidebar
        subreddits={subreddits} activeTab={activeTab}
        onSwitch={(name: string) => { changeView("tracker"); setHistoryView(null); switchTab(name); }}
        onAdd={addSubreddit}
        stackCounts={stackCounts} countdown={countdown} lastRefresh={lastRefresh}
        view={view}
        onViewMonitors={() => changeView("monitors")}
        onViewHolders={() => changeView("holders")}
        onViewNotifications={() => changeView("notifications")}
        onViewSubreddits={() => changeView("subreddits")}
        onViewAlerts={() => changeView("alerts")}
        alertCount={alertCount}
        onViewAddUsers={() => changeView("add-users")}
        onViewAllEdits={() => changeView("all-edits")}
        onLogout={onLogout}
      />

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {view === "add-users" ? <AddUsersPanel onSelectHolder={(h: any) => { setSelectedHolder(h); changeView("holders"); }} onAckChange={loadAlertCount} /> :
         view === "monitors" ? <MonitorPanel /> :
         view === "holders" ? (
           selectedHolder
             ? <HolderDetail holder={selectedHolder} onBack={() => setSelectedHolder(null)} />
             : <HoldersPanel onSelectHolder={(h: any) => setSelectedHolder(h)} />
         ) :
         view === "notifications" ? <AllNotifications /> :
         view === "all-edits" ? <AllEdits /> :
         view === "subreddits" ? <SubredditsPanel subreddits={subreddits} onSubredditRemoved={removeSubreddit} onSubredditAdded={(s: any) => addSubreddit(s.name).catch(()=>{})} showToast={showToast} /> : (
          <>
            <div style={{ padding:"14px 24px 0", borderBottom:"1px solid #1A1D2E", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <a href={`https://reddit.com/r/${activeTab}`} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <div style={{ width:30, height:30, background:"#FF4500", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>r/</div>
                  <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:20, color:"#F9FAFB" }}>{activeTab}</span>
                  <span style={{ fontSize:10, color:"#6B7280" }}>↗ open reddit</span>
                </a>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {[1,2,3].map(s => {
                    const count = s===1?stackCounts.s1:s===2?stackCounts.s2:stackCounts.s3;
                    const color = STACK_COLORS[s]; const clickable = s !== 3;
                    return (
                      <div key={s} onClick={() => { if(clickable) openStackModal(s); }} style={{ display:"flex", alignItems:"center", gap:6, background:"#0F1117", border:`1px solid ${color}35`, borderRadius:8, padding:"6px 12px", cursor:clickable?"pointer":"default", transition:"all 0.15s" }}
                        onMouseEnter={(e: any) => { if(clickable) e.currentTarget.style.borderColor=color; }}
                        onMouseLeave={(e: any) => { if(clickable) e.currentTarget.style.borderColor=`${color}35`; }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:color }} />
                        <span style={{ fontSize:10, color:"#6B7280" }}>S{s}</span>
                        <span style={{ fontSize:13, fontWeight:600, color, minWidth:16, textAlign:"center" }}>{count}</span>
                        {clickable && <span style={{ fontSize:9, color:"#374151" }}>↑</span>}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setHistoryView(v => v === "notifications" ? null : "notifications")}
                    style={{ background: historyView === "notifications" ? "#1A2A40" : "#0F1117", color: historyView === "notifications" ? "#93C5FD" : "#9CA3AF", border: historyView === "notifications" ? "1px solid #3B82F640" : "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: historyView === "notifications" ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                    {historyView === "notifications" ? "← Feed" : "Notification History"}
                  </button>
                  <button
                    onClick={() => setHistoryView(v => v === "edits" ? null : "edits")}
                    style={{ background: historyView === "edits" ? "#1C1400" : "#0F1117", color: historyView === "edits" ? "#F59E0B" : "#9CA3AF", border: historyView === "edits" ? "1px solid #78350F" : "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: historyView === "edits" ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                    {historyView === "edits" ? "← Feed" : "Edit History"}
                  </button>
                </div>
              </div>
              <SliderPanel key={activeTab} thresholds={thresholds} onSave={saveThresholds} subreddit={activeTab}
                onEditSaved={({ before, after, note }: any) => {
                  api.saveThresholdEdit({ subreddit: activeTab, before, after, note }).catch(() => {});
                }}
              />
            </div>
            {historyView === "notifications"
              ? <PostHistory subreddit={activeTab} />
              : historyView === "edits"
              ? <ThresholdEditHistory subreddit={activeTab} />
              : <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>🚨 Stack 3 — Viral Alert Queue</span>
                    <span style={{ fontSize:10, color:"#F59E0B", background:"#1C1400", border:"1px solid #78350F", padding:"2px 8px", borderRadius:10 }}>{stackCounts.s3} posts</span>
                    <span style={{ fontSize:10, color:"#374151", marginLeft:"auto" }}>expires after 4h · auto-refreshes every 15s</span>
                  </div>
                  <Stack3Feed posts={stack3Feed} onDismiss={dismissPost} />
                </div>
            }
          </>
        )}
      </div>

      {modalPosts && <StackModal stack={modalPosts.stack} posts={modalPosts.posts} thresholds={thresholds} onClose={closeModal} onRefresh={() => openStackModal(modalPosts.stack)} />}
    </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// MonitorApp — full monitor portal
// ─────────────────────────────────────────────────────────────
const C_M: any = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", accent:"#3B82F6", green:"#22C55E", amber:"#F59E0B", red:"#EF4444", muted:"#6B7280", dim:"#374151", text:"#F9FAFB", sub:"#9CA3AF" };
const btnM = (bg=C_M.accent, fg="#fff", ex: any={}) => ({background:bg,color:fg,border:"none",borderRadius:7,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,...ex});
const inpM: any = {background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:8,padding:"10px 14px",color:C_M.text,fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"};
const statusColorM = (s: string) => s==="posted"?C_M.green:s==="done"?C_M.dim:s==="opened"?C_M.accent:C_M.amber;
function timeAgoM(ts: any) { const d=(Date.now()-new Date(ts).getTime())/1000; if(d<60)return`${Math.round(d)}s ago`; if(d<3600)return`${Math.round(d/60)}m ago`; if(d<86400)return`${Math.round(d/3600)}h ago`; return`${Math.round(d/86400)}d ago`; }

function pauseTimeLeft(until: number) { const ms = until - Date.now(); if (ms <= 0) return null; const h = Math.floor(ms/3600000); const m = Math.floor((ms%3600000)/60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; }

function PauseModalShared({ isPaused, pausedUntil, onClose, onPause, onResume, accent }: any) {
  const [hours, setHours] = useState(1); const [editing, setEditing] = useState(false); const [inputVal, setInputVal] = useState("1"); const [busy, setBusy] = useState(false);
  const timeLeft = isPaused && pausedUntil ? pauseTimeLeft(pausedUntil) : null;
  const C = C_M;
  function clamp(v: number) { return Math.min(16, Math.max(1, Math.round(v))); }
  function commitEdit() { const v = parseInt(inputVal, 10); if (!isNaN(v)) setHours(clamp(v)); setEditing(false); }
  async function handlePause() { setBusy(true); try { await onPause(hours); onClose(); } catch(e: any) { alert(e.message); } finally { setBusy(false); } }
  async function handleResume() { setBusy(true); try { await onResume(); onClose(); } catch(e: any) { alert(e.message); } finally { setBusy(false); } }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,width:"min(380px,96vw)",padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:800,color:C.text}}>Pause Notifications</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {isPaused && timeLeft ? (
          <>
            <div style={{background:"#0A1A10",border:`1px solid #065F46`,borderRadius:10,padding:"16px 18px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.08em",marginBottom:6}}>CURRENTLY PAUSED</div>
              <div style={{fontSize:28,fontWeight:800,color:C.text,marginBottom:4}}>{timeLeft}</div>
              <div style={{fontSize:12,color:C.muted}}>remaining</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleResume} disabled={busy} style={{...btnM(C.green,"#000"),flex:1,padding:"11px"}}>{busy?"Resuming...":"Resume Now"}</button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 16px",borderRadius:7}}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Pause email notifications for how long?</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:24}}>
              <button onClick={() => setHours(h => clamp(h-1))} style={{width:40,height:40,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>−</button>
              {editing ? (
                <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)} onBlur={commitEdit} onKeyDown={(e: any) => { if(e.key==="Enter") commitEdit(); if(e.key==="Escape") setEditing(false); }} style={{width:80,textAlign:"center",background:C.surface,border:`1px solid ${accent}`,borderRadius:8,padding:"8px 0",color:C.text,fontSize:22,fontWeight:700,fontFamily:"inherit",outline:"none"}}/>
              ) : (
                <div onDoubleClick={() => { setInputVal(String(hours)); setEditing(true); }} title="Double-click to type a value" style={{width:80,textAlign:"center",fontSize:22,fontWeight:800,color:C.text,cursor:"default",userSelect:"none",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 0"}}>
                  {hours}<span style={{fontSize:13,fontWeight:500,color:C.muted,marginLeft:4}}>hr</span>
                </div>
              )}
              <button onClick={() => setHours(h => clamp(h+1))} style={{width:40,height:40,borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>+</button>
            </div>
            <div style={{fontSize:11,color:C.muted,textAlign:"center",marginBottom:20}}>Max 16 hours · Double-click the number to type a custom value</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handlePause} disabled={busy} style={{...btnM(accent,"#000"),flex:1,padding:"11px"}}>{busy?"Pausing...":"Done"}</button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 16px",borderRadius:7}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getTokenM() { return localStorage.getItem("token"); }
async function reqM(method: string, path: string, body?: any) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`/api${path}`, { method, signal: ctrl.signal, headers: {"Content-Type":"application/json", ...(getTokenM() ? {Authorization:`Bearer ${getTokenM()}`} : {})}, body: body ? JSON.stringify(body) : undefined });
    clearTimeout(tid);
    if (res.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user_data"); window.location.reload(); throw new Error("Session expired"); }
    if (!res.ok) { const e = await res.json().catch(() => ({error: res.statusText})); throw new Error(e.error ?? "HTTP " + res.status); }
    return res.json();
  } catch(e: any) { clearTimeout(tid); if (e.name === "AbortError") throw new Error("Request timed out"); throw e; }
}

function HolderDetail({ holder, onBack }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [loadErr, setLoadErr] = useState<any>(null);
  const [accountId, setAccountId] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setDetail(null); setLoadErr(null); setAccountId(null); setSearch(""); setTimeFilter("all"); setStatusFilter("all");
    reqM("GET", `/monitor/holders/${holder.id}`).then((d: any) => {
      setDetail(d);
      if (d.accounts && d.accounts.length > 0) setAccountId(d.accounts[0].id);
    }).catch((e: any) => setLoadErr(e.message || "Failed to load"));
  }, [holder.id]);

  if (loadErr) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:C_M.muted}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontSize:14,color:C_M.red}}>{loadErr}</div>
      <button onClick={() => { setLoadErr(null); setDetail(null); reqM("GET", `/monitor/holders/${holder.id}`).then((d: any) => { setDetail(d); if (d.accounts?.length > 0) setAccountId(d.accounts[0].id); }).catch((e: any) => setLoadErr(e.message || "Failed")); }} style={{...btnM("#1F2937", C_M.sub), marginTop:4}}>Retry</button>
    </div>
  );

  if (!detail) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C_M.muted}}>
      <div style={{width:28,height:28,border:`3px solid ${C_M.border}`,borderTop:`3px solid ${C_M.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>Loading holder data…</span>
    </div>
  );

  const now = Date.now();
  function timeBounds(k: string) {
    if (k === "today") return {from: now-86400000, to: now};
    if (k === "week")  return {from: now-7*86400000, to: now};
    if (k === "month") return {from: now-30*86400000, to: now};
    if (k === "custom") { const f = customFrom ? new Date(customFrom).getTime() : 0; const t = customTo ? new Date(customTo).getTime()+86399999 : now; return {from:f, to:t}; }
    return {from:0, to:Infinity};
  }
  const {from: tFrom, to: tTo} = timeBounds(timeFilter);

  const selAccount = detail.accounts.find((a: any) => a.id === accountId);
  const acctSubs = selAccount?.subreddits ?? [];

  const baseNotifs = accountId ? detail.notifications.filter((n: any) => n.accountId === accountId) : detail.notifications;
  const timeNotifs = baseNotifs.filter((n: any) => { const ms = new Date(n.sentAt).getTime(); return ms >= tFrom && ms <= tTo; });
  let tableNotifs = [...timeNotifs].sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  if (statusFilter === "viewed") tableNotifs = tableNotifs.filter((n: any) => n.status === "opened");
  else if (statusFilter !== "all") tableNotifs = tableNotifs.filter((n: any) => n.status === statusFilter);
  if (search) { const q = search.toLowerCase(); tableNotifs = tableNotifs.filter((n: any) => n.postTitle?.toLowerCase().includes(q) || n.subreddit?.toLowerCase().includes(q)); }

  const statsNotifs = timeNotifs;
  const statsPosted = statsNotifs.filter((n: any) => n.status === "posted").length;
  const statsViewed = statsNotifs.filter((n: any) => n.status === "opened" || n.status === "posted" || n.status === "done").length;

  const pillStyle = (active: boolean) => ({padding:"8px 18px",borderRadius:24,border:`1px solid ${active?C_M.accent:C_M.border}`,background:active?"#1A2A40":"none",color:active?C_M.accent:C_M.sub,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?700:500,whiteSpace:"nowrap" as const,transition:"all 0.15s"});

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C_M.bg}}>
      <div style={{padding:"20px 32px",borderBottom:`1px solid ${C_M.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:C_M.surface}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={onBack} style={{background:"#1F2937",border:"none",borderRadius:8,padding:"8px 14px",color:C_M.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>← Back</button>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C_M.text,letterSpacing:"-0.01em"}}>{detail.name}</div>
            <div style={{fontSize:12,color:C_M.muted,marginTop:2}}>{detail.email}{detail.phone && ` · ${detail.phone}`}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:28,textAlign:"right"}}>
          {[{l:"Notifications",v:statsNotifs.length,c:C_M.text},{l:"Posted",v:statsPosted,c:C_M.green},{l:"Accounts",v:detail.accounts.length,c:C_M.accent}].map((s: any) => (
            <div key={s.l}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:C_M.dim,marginTop:2,letterSpacing:"0.05em"}}>{s.l.toUpperCase()}{timeFilter!=="all"?<span style={{display:"block",fontSize:9,color:C_M.dim,fontWeight:400}}>{timeFilter==="today"?"today":timeFilter==="week"?"7d":timeFilter==="month"?"30d":"custom"}</span>:null}</div></div>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 32px",borderBottom:`1px solid ${C_M.border}`,flexShrink:0,background:C_M.surface}}>
        <div style={{fontSize:10,color:C_M.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>ACCOUNTS</div>
        {detail.accounts.length === 0
          ? <div style={{fontSize:13,color:C_M.dim}}>No accounts added by this holder.</div>
          : <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {detail.accounts.map((a: any) => {
                const label = a.redditUsername ? `u/${a.redditUsername.replace(/^u\//,"")}` : (a.emailAddress || "Account");
                const acctNotifCount = detail.notifications.filter((n: any) => n.accountId === a.id).length;
                const acctPostedCount = detail.notifications.filter((n: any) => n.accountId === a.id && n.status === "posted").length;
                const active = accountId === a.id;
                return (
                  <div key={a.id} onClick={() => setAccountId(a.id)} style={pillStyle(active)}>
                    <span style={{fontWeight:active?700:500}}>{label}</span>
                    <span style={{marginLeft:8,opacity:0.65,fontSize:11}}>{acctNotifCount} notif{acctNotifCount!==1?"s":""} · {acctPostedCount} posted</span>
                  </div>
                );
              })}
            </div>
        }
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"24px 32px",display:"flex",flexDirection:"column",gap:24}}>

        {/* ── Time filter — above stats ── */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:C_M.dim,fontWeight:700,letterSpacing:"0.08em",marginRight:4}}>TIME RANGE</span>
          {[{k:"all",l:"All time"},{k:"today",l:"Today"},{k:"week",l:"7d"},{k:"month",l:"30d"},{k:"custom",l:"Custom"}].map(({k,l}) => (
            <button key={k} onClick={() => setTimeFilter(k)} style={{background:timeFilter===k?"#1A2A40":"#111318",color:timeFilter===k?C_M.accent:C_M.muted,border:timeFilter===k?`1px solid ${C_M.accent}40`:`1px solid ${C_M.border}`,borderRadius:7,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:timeFilter===k?700:500}}>{l}</button>
          ))}
          {timeFilter === "custom" && (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:6,padding:"6px 10px",color:C_M.text,fontFamily:"inherit",fontSize:12,outline:"none",colorScheme:"dark"}}/>
              <span style={{fontSize:12,color:C_M.dim}}>–</span>
              <input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:6,padding:"6px 10px",color:C_M.text,fontFamily:"inherit",fontSize:12,outline:"none",colorScheme:"dark"}}/>
            </div>
          )}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[
            {label:"Notifications",value:statsNotifs.length,color:C_M.text,icon:"📬"},
            {label:"Posted",value:statsPosted,color:C_M.green,icon:"✅"},
            {label:"Viewed",value:statsViewed,color:C_M.accent,icon:"👁"},
          ].map((s: any) => (
            <div key={s.label} style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C_M.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>{s.icon} {s.label.toUpperCase()}</div>
              <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.value}</div>
              {timeFilter !== "all" && <div style={{fontSize:10,color:C_M.dim,marginTop:4}}>{timeFilter==="today"?"today":timeFilter==="week"?"last 7d":timeFilter==="month"?"last 30d":"custom range"}</div>}
            </div>
          ))}
        </div>

        {accountId && (
          <div style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:12,padding:"18px 22px"}}>
            <div style={{fontSize:10,color:C_M.dim,fontWeight:700,letterSpacing:"0.1em",marginBottom:12}}>TRACKED SUBREDDITS · {acctSubs.length}</div>
            {acctSubs.length === 0
              ? <div style={{fontSize:13,color:C_M.dim}}>No subreddits added for this account.</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {acctSubs.map((s: string) => (
                    <span key={s} style={{background:"#111827",border:`1px solid ${C_M.border}`,color:C_M.sub,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500}}>r/{s}</span>
                  ))}
                </div>
            }
          </div>
        )}

        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <input style={{flex:"1 1 200px",minWidth:160,background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:8,padding:"9px 14px",color:C_M.text,fontFamily:"inherit",fontSize:13,outline:"none"}}
              placeholder="Search post title or subreddit…" value={search} onChange={(e: any) => setSearch(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:`1px solid ${C_M.border}`,paddingBottom:0}}>
            {[{k:"all",l:"All",count:timeNotifs.length},{k:"sent",l:"Pending",count:timeNotifs.filter((n: any)=>n.status==="sent").length},{k:"viewed",l:"Viewed",count:timeNotifs.filter((n: any)=>n.status==="opened").length},{k:"posted",l:"Posted",count:timeNotifs.filter((n: any)=>n.status==="posted").length},{k:"done",l:"Done",count:timeNotifs.filter((n: any)=>n.status==="done").length}].map(({k,l,count}) => {
              const active = statusFilter === k;
              const tabColor = k==="posted"?C_M.green:k==="viewed"?C_M.accent:k==="sent"?C_M.amber:k==="done"?C_M.muted:C_M.text;
              return (
                <button key={k} onClick={() => setStatusFilter(k)}
                  style={{background:"none",border:"none",borderBottom:active?`2px solid ${tabColor}`:"2px solid transparent",color:active?tabColor:C_M.dim,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:active?700:500,padding:"10px 16px",marginBottom:-1,display:"flex",alignItems:"center",gap:6}}>
                  {l}
                  <span style={{fontSize:11,background:active?tabColor+"22":C_M.surface,color:active?tabColor:C_M.dim,padding:"1px 7px",borderRadius:10}}>{count}</span>
                </button>
              );
            })}
          </div>
          {tableNotifs.length === 0
            ? <div style={{padding:"48px 0",textAlign:"center",color:C_M.dim,fontSize:14}}>No notifications match your filters.</div>
            : <div style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"150px 1fr 110px 80px",gap:16,padding:"11px 20px",borderBottom:`1px solid ${C_M.border}`}}>
                  {["DATE","POST","STATUS","LINK"].map(h => <div key={h} style={{fontSize:10,color:C_M.dim,fontWeight:700,letterSpacing:"0.08em"}}>{h}</div>)}
                </div>
                {tableNotifs.map((n: any) => {
                  const sc = n.status==="posted"?C_M.green:n.status==="opened"?C_M.accent:n.status==="done"?C_M.muted:C_M.amber;
                  const sl = n.status==="sent"?"pending":n.status==="opened"?"viewed":n.status;
                  return (
                    <div key={n.id} style={{display:"grid",gridTemplateColumns:"150px 1fr 110px 80px",gap:16,padding:"14px 20px",borderBottom:`1px solid ${C_M.border}18`,alignItems:"center",transition:"background 0.1s"}}
                      onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
                      onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                      <div>
                        <div style={{fontSize:12,color:C_M.sub}}>{new Date(n.sentAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                        <div style={{fontSize:11,color:C_M.dim,marginTop:2}}>{new Date(n.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:11,color:C_M.muted,marginBottom:3}}>r/{n.subreddit}</div>
                        <div style={{fontSize:13,color:C_M.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{n.postTitle}</div>
                      </div>
                      <span style={{fontSize:11,color:sc,background:sc+"18",padding:"4px 12px",borderRadius:20,textAlign:"center",fontWeight:600,display:"inline-block"}}>{sl}</span>
                      <div>{n.postedLink ? <a href={n.postedLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:C_M.green,fontWeight:600}}>↗ open</a> : <span style={{fontSize:11,color:C_M.dim}}>—</span>}</div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

function HoldersOverviewM({ holders, onSelect }: any) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<any>({ col: "name", dir: "asc" });
  function toggleSort(col: string) { setSort((s: any) => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }); }
  function sortIcon(col: string) { if (sort.col !== col) return <span style={{ opacity: 0.2, fontSize: 9 }}> ⇅</span>; return <span style={{ fontSize: 9, color: C_M.accent }}> {sort.dir === "asc" ? "↑" : "↓"}</span>; }
  const filtered = [...holders]
    .filter((h: any) => h.name.toLowerCase().includes(search.toLowerCase()) || h.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.col === "name") return dir * a.name.localeCompare(b.name);
      if (sort.col === "email") return dir * a.email.localeCompare(b.email);
      if (sort.col === "subreddits") return dir * (a.subreddits.length - b.subreddits.length);
      if (sort.col === "notified") return dir * (a.totalNotifications - b.totalNotifications);
      if (sort.col === "posted") return dir * (a.converted - b.converted);
      return 0;
    });
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "18px 32px", borderBottom: `1px solid ${C_M.border}`, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search holders by name or email..."
          style={{ flex: 1, background: C_M.surface, border: `1px solid ${C_M.border}`, borderRadius: 8, padding: "10px 16px", color: C_M.text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
        <div style={{ whiteSpace: "nowrap", fontSize: 13, color: C_M.muted, fontWeight: 600 }}>{search ? `${filtered.length} of ${holders.length}` : holders.length} holder{holders.length !== 1 ? "s" : ""}</div>
      </div>
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ background: C_M.surface, border: `1px solid ${C_M.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 24px", borderBottom: `1px solid ${C_M.border}`, display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 16 }}>
            {[["name","Name"],["email","Email"],["subreddits","Subreddits"],["notified","Notified"],["posted","Posted"]].map(([col,label]) => (
              <div key={col} onClick={() => toggleSort(col)} style={{ fontSize: 11, color: sort.col === col ? C_M.accent : C_M.dim, fontWeight: 700, letterSpacing: "0.05em", cursor: "pointer", userSelect: "none" as const }}>{label}{sortIcon(col)}</div>
            ))}
          </div>
          {filtered.map((h: any) => (
            <div key={h.id} onClick={() => onSelect(h)} style={{ padding: "14px 24px", borderBottom: `1px solid ${C_M.border}`, display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 16, cursor: "pointer", transition: "background 0.1s", alignItems: "center" }}
              onMouseEnter={(e: any) => e.currentTarget.style.background = "#13161F"}
              onMouseLeave={(e: any) => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C_M.text }}>{h.name}</div>
              <div style={{ fontSize: 12, color: C_M.muted }}>{h.email}</div>
              <div style={{ fontSize: 13, color: C_M.sub }}>{h.subreddits.length}</div>
              <div style={{ fontSize: 13, color: C_M.amber }}>{h.totalNotifications}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C_M.green }}>{h.converted}</div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: "40px 24px", textAlign: "center", color: C_M.dim, fontSize: 13 }}>{holders.length === 0 ? "No holders assigned yet." : "No results match your search."}</div>}
        </div>
      </div>
    </div>
  );
}

const TONES = ["Witty","Empathetic","Informative","Casual","Enthusiastic","Controversial","Professional","Humorous","Supportive"];

function PostPopupM({ notif, onClose, onAction }: any) {
  const [comment, setComment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [tone, setTone] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  async function generate(cp?: string) { setLoading(true); setErr(""); try { const c = (await reqM("POST", `/posts/${notif.postId}/generate-comment`, { tone: tone || undefined, customPrompt: cp || undefined })).comment; setComment(c); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }
  async function copy() { await navigator.clipboard.writeText(comment); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 32 }}>
      <div style={{ background: C_M.surface, border: `1px solid ${C_M.border}`, borderLeft: `4px solid ${C_M.accent}`, borderRadius: 16, padding: 36, maxWidth: 660, width: "100%", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ flex: 1, paddingRight: 20 }}>
            <div style={{ fontSize: 11, color: C_M.accent, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>🔥 VIRAL · r/{notif.subreddit}</div>
            <a href={notif.postUrl} target="_blank" rel="noreferrer" style={{ color: C_M.text, fontSize: 17, lineHeight: 1.55, textDecoration: "none", fontWeight: 600 }}>{notif.postTitle}</a>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C_M.border}`, color: C_M.muted, cursor: "pointer", fontSize: 18, borderRadius: 8, width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        {!comment && (<>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C_M.muted, letterSpacing: "0.08em", marginBottom: 8 }}>SELECT TONE (optional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(tone === t ? "" : t)}
                  style={{ background: tone === t ? "#0D1626" : "#111318", border: `1px solid ${tone === t ? C_M.accent : "#1F2937"}`, borderRadius: 8, padding: "9px 6px", fontSize: 12, color: tone === t ? C_M.accent : C_M.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: tone === t ? 600 : 400, transition: "all 0.12s" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => generate()} disabled={loading} style={{ ...btnM(loading ? "#1E3A5F" : C_M.accent, "#fff"), width: "100%", padding: "14px", marginBottom: 16, fontSize: 14 }}>{loading ? "Generating..." : "✨ Generate Comment"}</button>
        </>)}
        {err && <div style={{ color: C_M.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        {comment && <div style={{ background: "#080B12", border: `1px solid #1E3A5F`, borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#D1D5DB", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{comment}</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={customPrompt} onChange={(e: any) => setCustomPrompt(e.target.value)} placeholder="Add instruction to customize… e.g. make it shorter, add a question"
              style={{ flex: 1, background: "#0A0C12", border: "1px solid #1F2937", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "#E5E7EB", outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => { const cp = customPrompt; setCustomPrompt(""); generate(cp); }} disabled={loading}
              style={{ ...btnM("#1E3A5F", C_M.accent), flexShrink: 0, whiteSpace: "nowrap" }}>↺ Regenerate</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={copy} style={btnM(copied ? "#064E3B" : "#1F2937", copied ? C_M.green : C_M.sub)}>{copied ? "✓ Copied!" : "Copy Text"}</button>
          </div>
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <button onClick={() => window.open(notif.postUrl, "_blank")} style={btnM("#1A1D2E", C_M.sub, { border: `1px solid ${C_M.border}` })}>Open Post ↗</button>
          <button onClick={() => setShowPaste((v: boolean) => !v)} style={btnM("#064E3B", C_M.green)}>Paste Link</button>
        </div>
        {showPaste && <div style={{ background: "#060D0A", border: `1px solid #065F46`, borderRadius: 10, padding: 20, marginTop: 4 }}><label style={{ fontSize: 12, color: C_M.muted, display: "block", marginBottom: 8 }}>Paste your Reddit comment link:</label><input style={{ ...inpM, marginBottom: 12 }} placeholder="https://reddit.com/r/.../comment/..." value={link} onChange={(e: any) => setLink(e.target.value)} /><button onClick={async () => { if (!link.trim()) return; await reqM("PUT", `/holder/notifications/${notif.id}/posted`, { postedLink: link.trim() }); onAction(); }} style={{ ...btnM(C_M.green, "#fff"), width: "100%" }}>Submit & Save</button></div>}
      </div>
    </div>
  );
}

function MyNotificationsM({ accounts, openAccId, initialPostId }: any) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [popup, setPopup] = useState<any>(null);
  useEffect(() => {
    reqM("GET", "/holder/notifications").then(setNotifs).catch(() => {});
    const nIdM = sessionStorage.getItem("pending_post_id") || initialPostId;
    if (nIdM) {
      sessionStorage.removeItem("pending_post_id");
      reqM("GET", `/holder/notifications/${nIdM}`).then((notif: any) => {
        setPopup(notif);
      }).catch(() => {});
    }
    const interval = setInterval(() => { reqM("GET", "/holder/notifications").then(setNotifs).catch(() => {}); }, 30_000);
    return () => clearInterval(interval);
  }, []);
  const scoped = openAccId ? notifs.filter((n: any) => String(n.accountId) === String(openAccId)) : notifs;
  const tabFiltered = scoped.filter((n: any) => tab === "all" || (tab === "viewed" ? n.status === "opened" : n.status === tab));
  const filtered = tabFiltered.filter((n: any) => !search || n.postTitle?.toLowerCase().includes(search.toLowerCase()) || n.subreddit?.toLowerCase().includes(search.toLowerCase()));
  const counts: any = { all: scoped.length, viewed: scoped.filter((n: any) => n.status === "opened").length, posted: scoped.filter((n: any) => n.status === "posted").length };
  const openAcc = accounts.find((a: any) => String(a.id) === String(openAccId));
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {popup && <PostPopupM notif={popup} onClose={() => setPopup(null)} onAction={() => { setPopup(null); reqM("GET", "/holder/notifications").then(setNotifs).catch(() => {}); }} />}
      <div style={{ padding: "22px 32px 14px", borderBottom: `1px solid ${C_M.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C_M.text }}>
              {openAcc ? (openAcc.redditUsername ? `u/${openAcc.redditUsername.replace(/^u\//, "")}` : openAcc.emailAddress) : "All Notifications"}
            </div>
            <div style={{ fontSize: 12, color: C_M.muted, marginTop: 3 }}>Click any post to open and take action.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {["all", "viewed", "posted"].map((t: string) => (
              <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "#0D1626" : "#161B26", color: tab === t ? C_M.accent : C_M.sub, border: tab === t ? `1px solid ${C_M.accent}40` : `1px solid ${C_M.border}`, borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: tab === t ? 700 : 500 }}>
                {t} ({counts[t] ?? 0})
              </button>
            ))}
          </div>
        </div>
        <input style={{ ...inpM, padding: "8px 12px", fontSize: 12 }} placeholder="Search by post title or subreddit…" value={search} onChange={(e: any) => setSearch(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {filtered.length === 0
          ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 14 }}><div style={{ fontSize: 44 }}>📭</div><div style={{ fontSize: 16, color: C_M.muted }}>No notifications yet</div></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((n: any) => (
              <div key={n.id} onClick={() => reqM("GET", `/holder/notifications/${n.id}`).then(setPopup).catch(() => {})}
                style={{ background: C_M.surface, border: `1px solid ${C_M.border}`, borderLeft: `3px solid ${statusColorM(n.status)}`, borderRadius: 10, padding: "18px 22px", cursor: "pointer", transition: "background 0.1s", display: "flex", alignItems: "center", gap: 20 }}
                onMouseEnter={(e: any) => e.currentTarget.style.background = "#13161F"}
                onMouseLeave={(e: any) => e.currentTarget.style.background = C_M.surface}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C_M.muted, marginBottom: 5 }}>r/{n.subreddit}</div>
                  <div style={{ fontSize: 14, color: C_M.text, fontWeight: 500, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.postTitle}</div>
                  {n.postedLink && <a href={n.postedLink} target="_blank" rel="noreferrer" onClick={(e: any) => e.stopPropagation()} style={{ fontSize: 11, color: C_M.green, marginTop: 5, display: "block" }}>✓ Comment posted</a>}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" as const }}>
                  <span style={{ display: "inline-block", fontSize: 11, color: statusColorM(n.status), background: statusColorM(n.status) + "18", border: `1px solid ${statusColorM(n.status)}30`, padding: "4px 12px", borderRadius: 20, marginBottom: 5 }}>{n.status === "sent" ? "new" : n.status}</span>
                  <div style={{ fontSize: 11, color: C_M.dim }}>{timeAgoM(n.sentAt)}</div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}

function ManageSubsPanelM({ account, onUpdated }: any) {
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [sel, setSel] = useState(new Set<string>(account?.subreddits ?? []));
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { reqM("GET", "/holder/subreddits").then(setAllSubs).catch(() => {}); }, []);
  useEffect(() => { setSel(new Set(account?.subreddits ?? [])); }, [account?.id]);
  function toggle(name: string) { setSel(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; }); }
  async function save() {
    if (!account) return;
    setBusy(true);
    try { await reqM("PUT", `/holder/accounts/${account.id}`, { subreddits: [...sel] }); onUpdated(); }
    catch(e: any) { alert(e.message); } finally { setBusy(false); }
  }
  const visible = q ? allSubs.filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase())) : allSubs;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <span style={{ fontSize: 13, color: C_M.sub }}>{sel.size} selected</span>
        <button onClick={save} disabled={busy || !account} style={{ ...btnM(C_M.accent, "#fff"), padding: "7px 16px", fontSize: 12 }}>{busy ? "Saving…" : "Save Changes"}</button>
      </div>
      <input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Search subreddits…"
        style={{ background: C_M.surface, border: `1px solid ${C_M.border}`, borderRadius: 8, padding: "8px 12px", color: C_M.text, fontFamily: "inherit", fontSize: 12, width: "100%", boxSizing: "border-box" as const, outline: "none", marginBottom: 16 }}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {visible.map((s: any) => (
          <div key={s.name} onClick={() => toggle(s.name)}
            style={{ background: sel.has(s.name) ? "#0D1626" : C_M.surface, border: `1px solid ${sel.has(s.name) ? C_M.accent : C_M.border}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontSize: 11, color: C_M.muted, marginBottom: 4 }}>r/</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: sel.has(s.name) ? C_M.accent : C_M.text }}>{s.name}</div>
          </div>
        ))}
        {visible.length === 0 && <div style={{ color: C_M.dim, fontSize: 13 }}>No results.</div>}
      </div>
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    title: "Welcome to ReSurge",
    icon: "👋",
    content: (email: string) => (
      <div>
        <p style={{ margin: "0 0 12px" }}>ReSurge watches Reddit for viral posts in your subreddits and alerts you the moment they start blowing up, so you can jump in early with an AI-generated comment.</p>
        <p style={{ margin: 0 }}>Alerts will be sent to <strong style={{ color: "#F9FAFB" }}>{email}</strong>, that's your login email.</p>
      </div>
    ),
  },
  {
    title: "Add your Reddit account",
    icon: "➕",
    content: () => (
      <div>
        <p style={{ margin: "0 0 12px" }}>In the left sidebar under <strong style={{ color: "#F9FAFB" }}>MY ACCOUNTS</strong>, click the <strong style={{ color: "#A78BFA" }}>+ Add</strong> button.</p>
        <p style={{ margin: "0 0 12px" }}>Enter:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.9 }}>
          <li>The <strong style={{ color: "#F9FAFB" }}>email address</strong> of your Reddit account</li>
          <li>Your <strong style={{ color: "#F9FAFB" }}>Reddit username</strong> (e.g. <code style={{ background: "#1F2937", padding: "1px 5px", borderRadius: 4 }}>u/yourname</code>)</li>
        </ul>
        <p style={{ margin: 0 }}>You can add multiple Reddit accounts if you manage more than one.</p>
      </div>
    ),
  },
  {
    title: "Select your subreddits",
    icon: "📋",
    content: () => (
      <div>
        <p style={{ margin: 0 }}>Select the subreddits you want to monitor with that Reddit account. ReSurge will watch those subreddits for viral posts and alert you when one takes off.</p>
      </div>
    ),
  },
  {
    title: "You'll get email alerts",
    icon: "📧",
    content: (email: string) => (
      <div>
        <p style={{ margin: "0 0 12px" }}>When a post goes viral, you'll receive an alert email at <strong style={{ color: "#F9FAFB" }}>{email}</strong>.</p>
        <p style={{ margin: "0 0 12px" }}>The email shows the post title and a button <strong style={{ color: "#F59E0B" }}>Open &amp; Respond</strong>. Clicking it opens the post popup directly in this portal.</p>
        <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>You can also see all live viral posts directly on this dashboard.</p>
      </div>
    ),
  },
  {
    title: "Generate and post your comment",
    icon: "💬",
    content: () => (
      <div>
        <p style={{ margin: "0 0 10px" }}>Once the post popup is open:</p>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
          <li>Click <strong style={{ color: "#F9FAFB" }}>Generate Comment</strong>, AI writes a relevant reply</li>
          <li>Click <strong style={{ color: "#F9FAFB" }}>Copy</strong> and paste it as a comment on Reddit</li>
          <li>Come back, click <strong style={{ color: "#A78BFA" }}>Paste Link</strong> and drop the Reddit comment URL to track it</li>
        </ol>
      </div>
    ),
  },
];

function MonitorOnboarding({ user, onDone }: { user: any; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 24 }}>
      <div style={{ background: "#0F1117", border: "1px solid #1F2937", borderRadius: 16, width: "min(520px,96vw)", overflow: "hidden", boxShadow: "0 24px 64px #00000090" }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "#1F2937" }}>
          <div style={{ height: "100%", background: "#A78BFA", width: `${((step + 1) / ONBOARDING_STEPS.length) * 100}%`, transition: "width 0.3s ease" }} />
        </div>
        <div style={{ padding: "28px 32px 24px" }}>
          {/* Step counter */}
          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 16 }}>
            STEP {step + 1} OF {ONBOARDING_STEPS.length}
          </div>
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>{s.title}</div>
          </div>
          {/* Content */}
          <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.75, minHeight: 120 }}>
            {s.content(user.email)}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: "16px 32px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1F2937" }}>
          <button onClick={onDone} style={{ background: "none", border: "none", color: "#4B5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            Skip setup guide
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ background: "none", border: "1px solid #1F2937", color: "#9CA3AF", cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: "10px 20px", borderRadius: 8, fontWeight: 600 }}>
                Back
              </button>
            )}
            <button onClick={() => isLast ? onDone() : setStep(s => s + 1)}
              style={{ background: "#A78BFA", border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: "10px 24px", borderRadius: 8, fontWeight: 700 }}>
              {isLast ? "Let's go →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitorDashboard({ user, onLogout, initialPostId }: any) {
  const [section, setSection] = useState("accounts");
  const [openAccId, setOpenAccId] = useState<any>(null);
  const [mainTab, setMainTab] = useState("notifications");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [delAccBusy, setDelAccBusy] = useState<any>(null);
  const [holders, setHolders] = useState<any[]>([]);
  const [selectedHolder, setSelectedHolder] = useState<any>(null);
  const [showManageAcc, setShowManageAcc] = useState(false);
  const [editAcc, setEditAcc] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("monitor_onboarding_done"));

  const [pausedUntilM, setPausedUntilM] = useState<number|null>(null);
  const [showPauseM, setShowPauseM] = useState(false);
  const [,setTickM] = useState(0);
  useEffect(() => { const id = setInterval(() => setTickM(t=>t+1), 30000); return () => clearInterval(id); }, []);
  const isPausedM = pausedUntilM && pausedUntilM > Date.now();

  useEffect(() => { loadAccounts(); reqM("GET", "/monitor/holders").then(setHolders).catch(() => {}); reqM("GET", "/holder/pause-status").then((d:any) => setPausedUntilM(d.pausedUntil??null)).catch(()=>{}); }, []);

  function loadAccounts() {
    reqM("GET", "/holder/accounts").then((accs: any[]) => {
      setAccounts(accs);
      if (accs.length > 0) setOpenAccId((id: any) => id || accs[0].id);
    }).catch(() => {});
  }
  async function deleteAccount(id: any) {
    setDelAccBusy(id);
    try { await reqM("DELETE", `/holder/accounts/${id}`); loadAccounts(); if (openAccId === id) setOpenAccId(null); }
    catch (e: any) { alert(e.message); } finally { setDelAccBusy(null); }
  }

  function ManageAccountsModal({ onClose }: any) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 24 }}>
        <div style={{ background: C_M.bg, border: `1px solid ${C_M.border}`, borderRadius: 14, width: "min(480px,96vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C_M.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C_M.text }}>Manage Accounts</div>
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${C_M.border}`, color: C_M.muted, cursor: "pointer", fontSize: 18, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
            {accounts.length === 0
              ? <div style={{ color: C_M.dim, fontSize: 13, padding: "20px 0", textAlign: "center" as const }}>No accounts yet.</div>
              : accounts.map((acc: any) => (
                <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C_M.border}20` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C_M.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//, "")}` : acc.emailAddress}
                    </div>
                    {acc.redditUsername && <div style={{ fontSize: 11, color: C_M.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{acc.emailAddress}</div>}
                  </div>
                  <button onClick={() => { onClose(); setEditAcc(acc); }}
                    style={{ background: "none", border: `1px solid ${C_M.border}`, color: C_M.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: "5px 12px", borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>
                    Edit Subs
                  </button>
                  <button onClick={() => { if (window.confirm(`Remove account "${acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//, "")}` : acc.emailAddress}"? This cannot be undone.`)) deleteAccount(acc.id); }} disabled={delAccBusy === acc.id}
                    style={{ background: "none", border: "1px solid #7F1D1D", color: C_M.red, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: "5px 12px", borderRadius: 6, fontWeight: 600, flexShrink: 0, opacity: delAccBusy === acc.id ? 0.5 : 1 }}>
                    {delAccBusy === acc.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))
            }
          </div>
          <div style={{ padding: "14px 24px", borderTop: `1px solid ${C_M.border}`, display: "flex", gap: 10 }}>
            <button onClick={() => { onClose(); setShowAddAcc(true); }} style={{ ...btnM(C_M.accent, "#fff"), flex: 1, padding: "11px" }}>＋ Add Account</button>
            <button onClick={onClose} style={{ background: "none", border: `1px solid ${C_M.border}`, color: C_M.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: "11px 18px", borderRadius: 7 }}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const openAccount = accounts.find((a: any) => a.id === openAccId);

  return (
    <div style={{ display: "flex", height: "100vh", background: C_M.bg, fontFamily: "'IBM Plex Sans',sans-serif", overflow: "hidden" }}>
      {showOnboarding && <MonitorOnboarding user={user} onDone={() => { localStorage.setItem("monitor_onboarding_done", "1"); setShowOnboarding(false); }} />}
      {showAddAcc && <AddAccountModalH onClose={() => setShowAddAcc(false)} onAdded={() => { setShowAddAcc(false); loadAccounts(); }} />}
      {showManageAcc && <ManageAccountsModal onClose={() => setShowManageAcc(false)} />}
      {editAcc && <EditAccountSubredditsModal account={editAcc} onClose={() => setEditAcc(null)} onSaved={() => { setEditAcc(null); loadAccounts(); }} saveSubreddits={(subs: string[]) => reqM("PUT", `/holder/accounts/${editAcc.id}`, { subreddits: subs })}/>}

      <div style={{ width: 280, background: C_M.surface, borderRight: `1px solid ${C_M.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${C_M.border}` }}>
          <div style={{ fontSize: 11, color: C_M.accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 14 }}>MONITOR PORTAL</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C_M.text, marginBottom: 3 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: C_M.muted }}>{user.email}</div>
        </div>

        <div style={{ padding: "12px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C_M.dim, letterSpacing: "0.08em" }}>MY ACCOUNTS ({accounts.length})</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowAddAcc(true)} style={{ background: "none", border: `1px solid ${C_M.accent}40`, color: C_M.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 700 }}>＋ Add</button>
            {accounts.length > 0 && <button onClick={() => setShowManageAcc(true)} style={{ background: "none", border: `1px solid ${C_M.border}`, color: C_M.sub, cursor: "pointer", fontFamily: "inherit", fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 600 }}>Manage</button>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {accounts.length === 0
            ? <div style={{ padding: "10px 20px", fontSize: 12, color: C_M.dim }}>No accounts yet. Click + Add to get started.</div>
            : accounts.map((acc: any) => {
              const active = openAccId === acc.id && section === "accounts";
              return (
                <div key={acc.id} onClick={() => { setOpenAccId(acc.id); setSection("accounts"); setMainTab("notifications"); }}
                  style={{ display: "flex", alignItems: "center", background: active ? "#111827" : "none", borderLeft: active ? `3px solid ${C_M.accent}` : "3px solid transparent", transition: "all 0.1s", cursor: "pointer", padding: "11px 20px" }}
                  onMouseEnter={(e: any) => { if (!active) e.currentTarget.style.background = "#0F1117"; }}
                  onMouseLeave={(e: any) => { if (!active) e.currentTarget.style.background = "none"; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active ? C_M.accent : C_M.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//, "")}` : acc.emailAddress}
                    </div>
                    {acc.redditUsername && <div style={{ fontSize: 11, color: C_M.dim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{acc.emailAddress}</div>}
                    <div style={{ fontSize: 10, color: active ? `${C_M.accent}80` : C_M.dim, marginTop: 2 }}>{(acc.subreddits ?? []).length} active</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div style={{ borderTop: `1px solid ${C_M.border}`, padding: "8px 12px" }}>
          <div onClick={() => { setSection("holders"); setSelectedHolder(null); }}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2, background: section === "holders" ? "#0D1626" : "transparent", borderLeft: `2px solid ${section === "holders" ? C_M.accent : "transparent"}`, transition: "background 0.12s" }}
            onMouseEnter={(e: any) => { if (section !== "holders") e.currentTarget.style.background = "#111318"; }}
            onMouseLeave={(e: any) => { if (section !== "holders") e.currentTarget.style.background = "transparent"; }}>
            <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: section === "holders" ? C_M.accent : "#6B7280" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <span style={{ fontSize: 12, color: section === "holders" ? C_M.accent : "#9CA3AF", fontWeight: section === "holders" ? 600 : 400, flex: 1 }}>Holders</span>
            {holders.length > 0 && <span style={{ fontSize: 10, color: "#6B7280" }}>{holders.length}</span>}
          </div>
          <div onClick={() => setShowOnboarding(true)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2 }}
            onMouseEnter={(e: any) => e.currentTarget.style.background = "#111318"}
            onMouseLeave={(e: any) => e.currentTarget.style.background = "transparent"}>
            <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#6B7280" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Setup Guide</span>
          </div>
          <div onClick={() => setShowPauseM(true)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer",background:isPausedM?"#0A1A10":"none",border:`1px solid ${isPausedM?"#065F46":"transparent"}`,marginBottom:2}}
            onMouseEnter={(e: any) => { if(!isPausedM) e.currentTarget.style.background="#111318"; }}
            onMouseLeave={(e: any) => { if(!isPausedM) e.currentTarget.style.background="none"; }}>
            <span style={{width:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:isPausedM?C_M.green:"#6B7280"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </span>
            <span style={{fontSize:12,color:isPausedM?C_M.green:"#9CA3AF",fontWeight:isPausedM?600:400}}>{isPausedM?`Paused · ${pauseTimeLeft(pausedUntilM!)||"resuming"}`:"Pause Notifications"}</span>
          </div>
          <div onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, cursor: "pointer" }}
            onMouseEnter={(e: any) => e.currentTarget.style.background = "#111318"}
            onMouseLeave={(e: any) => e.currentTarget.style.background = "transparent"}>
            <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#6B7280" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Logout</span>
          </div>
          {showPauseM && <PauseModalShared isPaused={!!isPausedM} pausedUntil={pausedUntilM} onClose={()=>setShowPauseM(false)} accent={C_M.accent} onPause={async(h:number)=>{const d=await reqM("PUT","/holder/pause-notifications",{hours:h});setPausedUntilM(d.pausedUntil);}} onResume={async()=>{await reqM("PUT","/holder/pause-notifications",{hours:null});setPausedUntilM(null);}}/>}
        </div>
      </div>

      {section === "accounts"
        ? openAccId
          ? <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ background: C_M.surface, borderBottom: `1px solid ${C_M.border}`, display: "flex", flexShrink: 0, padding: "0 32px" }}>
                {[["notifications","Notifications"],["subreddits","Manage Subreddits"]].map(([key,label]) => {
                  const a = mainTab === key;
                  return (<button key={key} onClick={() => setMainTab(key)} style={{ background: "none", border: "none", borderBottom: a ? `2px solid ${C_M.accent}` : "2px solid transparent", color: a ? C_M.accent : C_M.dim, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: a ? 700 : 500, padding: "14px 18px", marginBottom: -1, transition: "color 0.12s" }}>{label}</button>);
                })}
              </div>
              {mainTab === "notifications"
                ? <MyNotificationsM accounts={accounts} openAccId={openAccId} initialPostId={initialPostId} />
                : <ManageSubsPanelM account={openAccount} onUpdated={loadAccounts} />
              }
            </div>
          : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: C_M.dim }}>
              <div style={{ fontSize: 32 }}>👤</div>
              <div style={{ fontSize: 14 }}>Select an account from the sidebar</div>
            </div>
        : selectedHolder
          ? <HolderDetail key={selectedHolder.id} holder={selectedHolder} onBack={() => setSelectedHolder(null)} />
          : <HoldersOverviewM holders={holders} onSelect={setSelectedHolder} />
      }
    </div>
  );
}

function MonitorApp({ user, onLogout, initialPostId }: any) {
  useEffect(() => { sessionStorage.removeItem("monitor_new_signup"); }, []);
  return <MonitorDashboard user={user} onLogout={onLogout} initialPostId={initialPostId} />;
}

// ─────────────────────────────────────────────────────────────
// HolderApp — full holder portal
// ─────────────────────────────────────────────────────────────
const C_H: any = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", accent:"#F59E0B", blue:"#3B82F6", green:"#22C55E", red:"#EF4444", muted:"#6B7280", dim:"#374151", text:"#F9FAFB", sub:"#9CA3AF", orange:"#FF4500" };
const btnH = (bg=C_H.accent, fg="#000", ex: any={}) => ({background:bg,color:fg,border:"none",borderRadius:7,padding:"9px 18px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,whiteSpace:"nowrap" as const,...ex});
const inpH: any = {background:C_H.surface,border:`1px solid ${C_H.border}`,borderRadius:8,padding:"10px 14px",color:C_H.text,fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box"};
const statusColorH = (s: string) => s==="posted"?C_H.green:s==="done"?C_H.dim:s==="opened"?C_H.blue:C_H.accent;
const displayStatusH = (s: string) => s==="sent"?"new":s;
function timeAgoH(ts: any){const d=(Date.now()-new Date(ts).getTime())/1000;if(d<60)return`${Math.round(d)}s ago`;if(d<3600)return`${Math.round(d/60)}m ago`;if(d<86400)return`${Math.round(d/3600)}h ago`;return`${Math.round(d/86400)}d ago`;}

function getTokenH() { return localStorage.getItem("token"); }
async function reqH(method: string, path: string, body?: any) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getTokenH() ? { Authorization: `Bearer ${getTokenH()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user_data"); window.location.reload(); throw new Error("Session expired"); }
  if (!res.ok) { const e = await res.json().catch(() => ({error: res.statusText})); throw new Error(e.error ?? "Request failed"); }
  return res.json();
}

const holderApi = {
  getSubreddits:    ()              => reqH("GET",  "/holder/subreddits"),
  getNotifications: ()              => reqH("GET",  "/holder/notifications"),
  getNotification:  (id: any)       => reqH("GET",  `/holder/notifications/${id}`),
  markPosted:       (id: any, link: string) => reqH("PUT",  `/holder/notifications/${id}/posted`, { postedLink: link }),
  markDone:         (id: any)       => reqH("PUT",  `/holder/notifications/${id}/done`),
  generateComment:  (postId: any, tone?: string, customPrompt?: string) => reqH("POST", `/posts/${postId}/generate-comment`, { tone, customPrompt }),
  getAccounts:      ()              => reqH("GET",  "/holder/accounts"),
  addAccount:       (data: any)     => reqH("POST", "/holder/accounts", data),
  updateAccount:    (id: any, data: any) => reqH("PUT", `/holder/accounts/${id}`, data),
  deleteAccount:    (id: any)       => reqH("DELETE", `/holder/accounts/${id}`),
  getPauseStatus:   ()              => reqH("GET",  "/holder/pause-status"),
  pauseNotifications: (hours: number) => reqH("PUT", "/holder/pause-notifications", { hours }),
  resumeNotifications: ()           => reqH("PUT",  "/holder/pause-notifications", { hours: null }),
};

function SubredditGrid({ allSubs, sel, onToggle }: any) {
  const [q, setQ] = useState("");
  const visible = q ? allSubs.filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase())) : allSubs;
  return (
    <div>
      <input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Search subreddits…"
        style={{...inpH, marginBottom:16, padding:"8px 12px", fontSize:12}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
        {visible.map((s: any) => (
          <div key={s.name} onClick={() => onToggle(s.name)}
            style={{background:sel.has(s.name)?"#1C1400":C_H.surface,border:`1px solid ${sel.has(s.name)?C_H.accent:C_H.border}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{fontSize:11,color:C_H.muted,marginBottom:4}}>r/</div>
            <div style={{fontSize:14,fontWeight:600,color:sel.has(s.name)?C_H.accent:C_H.text}}>{s.name}</div>
          </div>
        ))}
        {visible.length === 0 && <div style={{color:C_H.dim,fontSize:13}}>{allSubs.length === 0 ? "No subreddits tracked yet." : "No results."}</div>}
      </div>
    </div>
  );
}

function AccountSetupH({ onDone }: any) {
  const [form, setForm] = useState({emailAddress:"",redditUsername:""});
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [sel, setSel] = useState(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { holderApi.getSubreddits().then(setAllSubs).catch(() => {}); }, []);
  function toggle(name: string) { setSel(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; }); }
  async function save() {
    if (!form.emailAddress) { setErr("Email address is required"); return; }
    if (!form.redditUsername) { setErr("Reddit username is required"); return; }
    setBusy(true); setErr("");
    try { await holderApi.addAccount({...form, subreddits:[...sel]}); onDone(); }
    catch(e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div style={{display:"flex",height:"100vh",background:C_H.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      <div style={{width:320,background:C_H.surface,borderRight:`1px solid ${C_H.border}`,padding:40,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C_H.text,marginBottom:6}}>Set up your account</div>
        <div style={{color:C_H.muted,fontSize:13,lineHeight:1.7,marginBottom:28}}>Add the account you'll use to post comments on Reddit.</div>
        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
          <div>
            <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:6}}>Email Address *</label>
            <input style={inpH} value={form.emailAddress} onChange={(e: any) => setForm(p => ({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/>
          </div>
          <div>
            <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:6}}>Reddit Username *</label>
            <input style={inpH} value={form.redditUsername} onChange={(e: any) => setForm(p => ({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
          </div>
        </div>
        {err && <div style={{color:C_H.red,fontSize:12,marginBottom:12}}>{err}</div>}
        <div style={{marginTop:"auto"}}>
          <div style={{fontSize:13,color:C_H.sub,marginBottom:10}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
          <button onClick={save} disabled={busy || !form.emailAddress || !form.redditUsername} style={{...btnH(C_H.accent,"#000"),width:"100%",padding:"13px"}}>
            {busy ? "Saving..." : "Save & Continue →"}
          </button>
          <button onClick={onDone} style={{background:"none",border:"none",color:C_H.dim,cursor:"pointer",fontFamily:"inherit",fontSize:12,marginTop:10,padding:0}}>
            Skip for now →
          </button>
        </div>
      </div>
      <div style={{flex:1,padding:40,overflowY:"auto"}}>
        <div style={{fontSize:14,fontWeight:700,color:C_H.sub,marginBottom:20}}>Pick subreddits for this account</div>
        <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
      </div>
    </div>
  );
}

function AddAccountModalH({ onClose, onAdded }: any) {
  const [form, setForm] = useState({emailAddress:"",redditUsername:""});
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [sel, setSel] = useState(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { holderApi.getSubreddits().then(setAllSubs).catch(() => {}); }, []);
  function toggle(name: string) { setSel(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; }); }
  async function save() {
    if (!form.emailAddress) { setErr("Email address is required"); return; }
    if (!form.redditUsername) { setErr("Reddit username is required"); return; }
    setBusy(true); setErr("");
    try { await holderApi.addAccount({...form, subreddits:[...sel]}); onAdded(); }
    catch(e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
      <div style={{background:C_H.bg,border:`1px solid ${C_H.border}`,borderRadius:16,width:"min(780px,96vw)",maxHeight:"88vh",display:"flex",overflow:"hidden"}}>
        <div style={{width:280,background:C_H.surface,padding:32,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:800,color:C_H.text,marginBottom:6}}>Add Account</div>
          <div style={{color:C_H.muted,fontSize:12,lineHeight:1.7,marginBottom:22}}>Add a new Reddit account and pick its subreddits.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            <div>
              <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:5}}>Email Address *</label>
              <input style={inpH} value={form.emailAddress} onChange={(e: any) => setForm(p => ({...p,emailAddress:e.target.value}))} placeholder="email@example.com"/>
            </div>
            <div>
              <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:5}}>Reddit Username *</label>
              <input style={inpH} value={form.redditUsername} onChange={(e: any) => setForm(p => ({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
            </div>
          </div>
          {err && <div style={{color:C_H.red,fontSize:12,marginBottom:10}}>{err}</div>}
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:12,color:C_H.sub,marginBottom:8}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
            <button onClick={save} disabled={busy || !form.emailAddress || !form.redditUsername} style={{...btnH(C_H.accent,"#000"),width:"100%",padding:"11px",marginBottom:8}}>
              {busy ? "Saving..." : "Add Account →"}
            </button>
            <button onClick={onClose} style={{background:"none",border:"none",color:C_H.dim,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:0}}>Cancel</button>
          </div>
        </div>
        <div style={{flex:1,padding:28,overflowY:"auto"}}>
          <div style={{fontSize:12,fontWeight:700,color:C_H.sub,marginBottom:16}}>PICK SUBREDDITS</div>
          <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
        </div>
      </div>
    </div>
  );
}

function PostPopupH({ notif, cachedComment, onCommentCached, onClose, onAction }: any) {
  const [comment, setComment] = useState(cachedComment);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [tone, setTone] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  async function generate(cp?: string) { setLoading(true); setErr(""); try { const c = (await holderApi.generateComment(notif.postId, tone || undefined, cp || undefined)).comment; setComment(c); if (onCommentCached) onCommentCached(c); } catch(e: any) { setErr(e.message); } finally { setLoading(false); } }
  async function copy() { await navigator.clipboard.writeText(comment); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:32}}>
      <div style={{background:C_H.surface,border:`1px solid #2A1F00`,borderLeft:`4px solid ${C_H.accent}`,borderRadius:16,padding:36,maxWidth:660,width:"100%",maxHeight:"86vh",overflowY:"auto",boxShadow:"0 0 80px rgba(245,158,11,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div style={{flex:1,paddingRight:20}}>
            <div style={{fontSize:11,color:C_H.accent,fontWeight:700,letterSpacing:"0.06em",marginBottom:8}}>🔥 VIRAL · r/{notif.subreddit}</div>
            <a href={notif.postUrl} target="_blank" rel="noreferrer" style={{color:C_H.text,fontSize:17,lineHeight:1.55,textDecoration:"none",fontWeight:600}}>{notif.postTitle}</a>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:36,height:36,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:"1"}}>×</button>
        </div>
        {!comment && (<>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:C_H.muted,letterSpacing:"0.08em",marginBottom:8}}>SELECT TONE (optional)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(tone === t ? "" : t)}
                  style={{background:tone===t?"#1C1400":"#111318",border:`1px solid ${tone===t?C_H.accent:"#2A1F00"}`,borderRadius:8,padding:"9px 6px",fontSize:12,color:tone===t?C_H.accent:C_H.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:tone===t?600:400,transition:"all 0.12s"}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => generate()} disabled={loading} style={{...btnH(loading?"#78350F":C_H.accent,loading?"#FCD34D":"#000"),width:"100%",padding:"14px",marginBottom:16,fontSize:14}}>{loading?"Generating...":"✨ Generate Comment"}</button>
        </>)}
        {err && <div style={{color:C_H.red,fontSize:13,marginBottom:12}}>{err}</div>}
        {comment && <div style={{background:"#080B12",border:`1px solid #1E3A5F`,borderRadius:12,padding:22,marginBottom:20}}>
          <p style={{margin:"0 0 16px",fontSize:14,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{comment}</p>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={customPrompt} onChange={(e: any) => setCustomPrompt(e.target.value)} placeholder="Add instruction to customize… e.g. make it shorter, add a question"
              style={{flex:1,background:"#0A0C12",border:"1px solid #2A1F00",borderRadius:6,padding:"7px 10px",fontSize:12,color:"#E5E7EB",outline:"none",fontFamily:"inherit"}} />
            <button onClick={() => { const cp = customPrompt; setCustomPrompt(""); generate(cp); }} disabled={loading}
              style={{...btnH("#1C1400",C_H.accent),flexShrink:0,whiteSpace:"nowrap"}}>↺ Regenerate</button>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={copy} style={btnH(copied?"#064E3B":"#1F2937",copied?C_H.green:C_H.sub)}>{copied?"✓ Copied!":"Copy Text"}</button>
          </div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <button onClick={() => window.open(notif.postUrl,"_blank")} style={btnH("#1A1D2E",C_H.sub,{border:`1px solid ${C_H.border}`})}>Open Post ↗</button>
          <button onClick={() => setShowPaste(v => !v)} style={btnH("#064E3B",C_H.green)}>Paste Link</button>
        </div>
        {showPaste && <div style={{background:"#060D0A",border:`1px solid #065F46`,borderRadius:10,padding:20,marginTop:4}}><label style={{fontSize:12,color:C_H.muted,display:"block",marginBottom:8}}>Paste your Reddit comment link:</label><input style={{...inpH,marginBottom:12}} placeholder="https://reddit.com/r/.../comment/..." value={link} onChange={(e: any) => setLink(e.target.value)}/><button onClick={async () => { if (!link.trim()) return; await holderApi.markPosted(notif.id, link.trim()); onAction(); }} style={{...btnH(C_H.green,"#000"),width:"100%"}}>Submit & Save</button></div>}
      </div>
    </div>
  );
}

function NotifListH({ notifs, onOpen }: any) {
  if (notifs.length === 0) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:14}}>
      <div style={{fontSize:44}}>📭</div>
      <div style={{fontSize:16,color:C_H.muted}}>No notifications yet</div>
      <div style={{fontSize:13,color:C_H.dim}}>You'll get an email when a viral post appears in your subreddits.</div>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {notifs.map((n: any) => (
        <div key={n.id} onClick={() => onOpen(n.id)}
          style={{background:C_H.surface,border:`1px solid ${C_H.border}`,borderLeft:`3px solid ${statusColorH(n.status)}`,borderRadius:10,padding:"18px 22px",cursor:"pointer",transition:"background 0.1s",display:"flex",alignItems:"center",gap:20}}
          onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
          onMouseLeave={(e: any) => e.currentTarget.style.background=C_H.surface}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:C_H.muted,marginBottom:5}}>r/{n.subreddit}</div>
            <div style={{fontSize:14,color:C_H.text,fontWeight:500,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.postTitle}</div>
            {n.postedLink && <a href={n.postedLink} target="_blank" rel="noreferrer" onClick={(e: any) => e.stopPropagation()} style={{fontSize:11,color:C_H.green,marginTop:5,display:"block"}}>✓ Comment posted</a>}
          </div>
          <div style={{flexShrink:0,textAlign:"right"}}>
            <span style={{display:"inline-block",fontSize:11,color:statusColorH(n.status),background:statusColorH(n.status)+"18",border:`1px solid ${statusColorH(n.status)}30`,padding:"4px 12px",borderRadius:20,marginBottom:5}}>{displayStatusH(n.status)}</span>
            <div style={{fontSize:11,color:C_H.dim}}>{timeAgoH(n.sentAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditAccountSubredditsModal({ account, onClose, onSaved, saveSubreddits }: any) {
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [sel, setSel] = useState(new Set<string>(account.subreddits ?? []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { holderApi.getSubreddits().then(setAllSubs).catch(() => {}); }, []);
  function toggle(name: string) { setSel(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; }); }
  async function save() {
    setBusy(true); setErr("");
    try { await saveSubreddits([...sel]); onSaved(); }
    catch(e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }
  const label = account.redditUsername ? `u/${account.redditUsername.replace(/^u\//,"")}` : account.emailAddress;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:24}}>
      <div style={{background:C_H.bg,border:`1px solid ${C_H.border}`,borderRadius:14,width:"min(720px,96vw)",maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C_H.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C_H.text}}>Edit Subreddits</div>
            <div style={{fontSize:12,color:C_H.muted,marginTop:2}}>{label}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:24}}>
          <div style={{fontSize:12,color:C_H.sub,marginBottom:12}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
          <SubredditGrid allSubs={allSubs} sel={sel} onToggle={toggle}/>
        </div>
        {err && <div style={{padding:"0 24px 8px",color:"#EF4444",fontSize:12}}>{err}</div>}
        <div style={{padding:"14px 24px",borderTop:`1px solid ${C_H.border}`,display:"flex",gap:10}}>
          <button onClick={save} disabled={busy} style={{...btnH(C_H.accent,"#000"),flex:1,padding:"11px"}}>{busy?"Saving…":"Save Changes"}</button>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 18px",borderRadius:7}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ManageAccountsModalH({ accounts, onClose, onDeleted, onAdd, onEdit, delBusy }: any) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:24}}>
      <div style={{background:C_H.bg,border:`1px solid ${C_H.border}`,borderRadius:14,width:"min(480px,96vw)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C_H.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:800,color:C_H.text}}>Manage Accounts</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.muted,cursor:"pointer",fontSize:18,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 24px"}}>
          {accounts.length === 0
            ? <div style={{color:C_H.dim,fontSize:13,padding:"20px 0",textAlign:"center"}}>No accounts yet.</div>
            : accounts.map((acc: any) => (
              <div key={acc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C_H.border}20`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C_H.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//,"")}` : acc.emailAddress}
                  </div>
                  {acc.redditUsername && <div style={{fontSize:11,color:C_H.muted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                </div>
                <button onClick={() => onEdit(acc)}
                  style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.sub,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:6,fontWeight:600,flexShrink:0}}>
                  Edit Subs
                </button>
                <button onClick={() => { if (window.confirm(`Remove account "${acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//,"")}` : acc.emailAddress}"? This cannot be undone.`)) onDeleted(acc.id); }} disabled={delBusy===acc.id}
                  style={{background:"none",border:"1px solid #7F1D1D",color:"#EF4444",cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:"5px 12px",borderRadius:6,fontWeight:600,flexShrink:0,opacity:delBusy===acc.id?0.5:1}}>
                  {delBusy===acc.id?"Removing…":"Remove"}
                </button>
              </div>
            ))
          }
        </div>
        <div style={{padding:"14px 24px",borderTop:`1px solid ${C_H.border}`,display:"flex",gap:10}}>
          <button onClick={onAdd} style={{...btnH(C_H.accent,"#000"),flex:1,padding:"11px"}}>＋ Add Account</button>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"11px 18px",borderRadius:7}}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ManageSubsPanelH({ account, onUpdated }: any) {
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [sel, setSel] = useState(new Set<string>(account?.subreddits ?? []));
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { holderApi.getSubreddits().then(setAllSubs).catch(() => {}); }, []);
  useEffect(() => { setSel(new Set(account?.subreddits ?? [])); }, [account?.id]);
  function toggle(name: string) { setSel(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; }); }
  async function save() {
    if (!account) return;
    setBusy(true);
    try { await holderApi.updateAccount(account.id, { subreddits: [...sel] }); onUpdated(); }
    catch(e: any) { alert(e.message); } finally { setBusy(false); }
  }
  const visible = q ? allSubs.filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase())) : allSubs;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <span style={{ fontSize: 13, color: C_H.sub }}>{sel.size} selected</span>
        <button onClick={save} disabled={busy || !account} style={{ ...btnH(C_H.accent, "#000"), padding: "7px 16px", fontSize: 12 }}>{busy ? "Saving…" : "Save Changes"}</button>
      </div>
      <input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Search subreddits…"
        style={{ background: C_H.surface, border: `1px solid ${C_H.border}`, borderRadius: 8, padding: "8px 12px", color: C_H.text, fontFamily: "inherit", fontSize: 12, width: "100%", boxSizing: "border-box" as const, outline: "none", marginBottom: 16 }}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {visible.map((s: any) => (
          <div key={s.name} onClick={() => toggle(s.name)}
            style={{ background: sel.has(s.name) ? "#1C1400" : C_H.surface, border: `1px solid ${sel.has(s.name) ? C_H.accent : C_H.border}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontSize: 11, color: C_H.muted, marginBottom: 4 }}>r/</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: sel.has(s.name) ? C_H.accent : C_H.text }}>{s.name}</div>
          </div>
        ))}
        {visible.length === 0 && <div style={{ color: C_H.dim, fontSize: 13 }}>No results.</div>}
      </div>
    </div>
  );
}

function HolderDashboard({ user, onLogout, initialPostId }: any) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [openAccId, setOpenAccId] = useState<any>(() => sessionStorage.getItem("holder_acc_id") || null);
  const [holderMainTab, setHolderMainTab] = useState("notifications");
  const [tab, setTab] = useState(() => sessionStorage.getItem("holder_tab") || "all");
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [popup, setPopup] = useState<any>(null);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [showManageAcc, setShowManageAcc] = useState(false);
  const [editAcc, setEditAcc] = useState<any>(null);
  const [delAccBusy, setDelAccBusy] = useState<any>(null);
  const commentCache = useRef<any>({});

  const [pausedUntilH, setPausedUntilH] = useState<number|null>(null);
  const [showPauseH, setShowPauseH] = useState(false);
  const [,setTickH] = useState(0);
  useEffect(() => { const id = setInterval(() => setTickH(t=>t+1), 30000); return () => clearInterval(id); }, []);
  const isPausedH = pausedUntilH && pausedUntilH > Date.now();

  useEffect(() => {
    load();
    loadAccounts();
    holderApi.getPauseStatus().then((d:any) => setPausedUntilH(d.pausedUntil??null)).catch(()=>{});
    // Handle deep-link: read directly from sessionStorage so it's always available
    const nId = sessionStorage.getItem("pending_post_id") || initialPostId;
    if (nId) {
      sessionStorage.removeItem("pending_post_id");
      holderApi.getNotification(nId).then((notif: any) => {
        setPopup(notif);
        if (notif.accountId) setOpenAccId(notif.accountId);
      }).catch(() => {});
    }
    const interval = setInterval(() => { load(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  function setOpenAccIdPersist(id: any) { setOpenAccId(id); if (id) sessionStorage.setItem("holder_acc_id", id); else sessionStorage.removeItem("holder_acc_id"); }
  function setTabPersist(t: string) { setTab(t); sessionStorage.setItem("holder_tab", t); }

  function loadAccounts() {
    holderApi.getAccounts().then((accs: any[]) => {
      setAccounts(accs);
      if (accs.length > 0) {
        setOpenAccId((id: any) => {
          const savedId = sessionStorage.getItem("holder_acc_id");
          const match = savedId && accs.find((a: any) => String(a.id) === String(savedId));
          const keep = match ? match.id : accs[0].id;
          sessionStorage.setItem("holder_acc_id", String(keep));
          return keep;
        });
      }
    }).catch(() => {});
  }

  async function deleteAccount(accId: any) {
    setDelAccBusy(accId);
    try { await holderApi.deleteAccount(accId); loadAccounts(); if (String(openAccId) === String(accId)) setOpenAccIdPersist(null); }
    catch(e: any) { alert(e.message); }
    finally { setDelAccBusy(null); }
  }

  async function load() { try { setNotifs(await holderApi.getNotifications()); } catch {} }

  const scopedNotifs = openAccId ? notifs.filter(n => String(n.accountId) === String(openAccId)) : notifs;

  const now = Date.now();
  function getTimeBoundsH(key: string) {
    if (key === "today") return {from: now-86400000, to: now};
    if (key === "week")  return {from: now-7*86400000, to: now};
    if (key === "month") return {from: now-30*86400000, to: now};
    if (key === "custom") { const f = fromDate ? new Date(fromDate).getTime() : 0; const t = toDate ? new Date(toDate).getTime()+86399999 : now; return {from:f, to:t}; }
    return {from:0, to:Infinity};
  }
  const {from: tFrom, to: tTo} = getTimeBoundsH(timeFilter);
  const timeFiltered = scopedNotifs.filter(n => { const ms = new Date(n.sentAt).getTime(); return ms >= tFrom && ms <= tTo; });
  const tabFiltered = timeFiltered.filter(n => tab==="all" || (tab==="viewed" ? n.status==="opened" : n.status===tab));
  const filtered = tabFiltered.filter(n => { if (!search) return true; const q = search.toLowerCase(); return n.postTitle?.toLowerCase().includes(q) || n.subreddit?.toLowerCase().includes(q); });
  const counts: any = {all:timeFiltered.length, viewed:timeFiltered.filter(n=>n.status==="opened").length, posted:timeFiltered.filter(n=>n.status==="posted").length};
  const openAcc = accounts.find(a => String(a.id) === String(openAccId));

  return (
    <div style={{display:"flex",height:"100vh",background:C_H.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      {popup && <PostPopupH notif={popup} cachedComment={commentCache.current[popup.postId]||null} onCommentCached={(c: any) => { commentCache.current[popup.postId]=c; }} onClose={() => setPopup(null)} onAction={() => { setPopup(null); load(); }}/>}
      {showAddAcc && <AddAccountModalH onClose={() => setShowAddAcc(false)} onAdded={() => { setShowAddAcc(false); loadAccounts(); }}/>}
      {showManageAcc && <ManageAccountsModalH accounts={accounts} delBusy={delAccBusy} onClose={() => setShowManageAcc(false)} onDeleted={async (id: any) => { await deleteAccount(id); }} onAdd={() => { setShowManageAcc(false); setShowAddAcc(true); }} onEdit={(acc: any) => { setShowManageAcc(false); setEditAcc(acc); }}/>}
      {editAcc && <EditAccountSubredditsModal account={editAcc} onClose={() => setEditAcc(null)} onSaved={() => { setEditAcc(null); loadAccounts(); }} saveSubreddits={(subs: string[]) => holderApi.updateAccount(editAcc.id, { subreddits: subs })}/>}

      <div style={{width:270,background:C_H.surface,borderRight:`1px solid ${C_H.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C_H.border}`}}>
          <div style={{fontSize:11,color:C_H.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>HOLDER PORTAL</div>
          <div style={{fontWeight:700,fontSize:15,color:C_H.text,marginBottom:3}}>{user.name}</div>
          <div style={{fontSize:12,color:C_H.muted}}>{user.email}</div>
        </div>

        <div style={{padding:"12px 20px 6px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontSize:10,color:C_H.dim,letterSpacing:"0.08em"}}>MY ACCOUNTS ({accounts.length})</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={() => setShowAddAcc(true)} style={{background:"none",border:`1px solid ${C_H.accent}40`,color:C_H.accent,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:700}}>＋ Add</button>
            {accounts.length > 0 && <button onClick={() => setShowManageAcc(true)} style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.sub,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:600}}>Manage</button>}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto"}}>
          {accounts.length === 0
            ? <div style={{padding:"10px 20px",fontSize:12,color:C_H.dim}}>No accounts yet. Click + Add to get started.</div>
            : accounts.map((acc: any) => {
              const active = String(openAccId) === String(acc.id);
              return (
                <div key={acc.id} onClick={() => { setOpenAccIdPersist(acc.id); setTab("all"); }}
                  style={{display:"flex",alignItems:"center",background:active?"#111827":"none",borderLeft:active?`3px solid ${C_H.accent}`:"3px solid transparent",transition:"all 0.1s",cursor:"pointer",padding:"11px 20px"}}
                  onMouseEnter={(e: any) => { if (!active) e.currentTarget.style.background="#0F1117"; }}
                  onMouseLeave={(e: any) => { if (!active) e.currentTarget.style.background="none"; }}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:active?C_H.accent:C_H.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//,"")}` : acc.emailAddress}
                    </div>
                    {acc.redditUsername && <div style={{fontSize:11,color:C_H.dim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                    <div style={{fontSize:10,color:active?`${C_H.accent}80`:C_H.dim,marginTop:2}}>{(acc.subreddits??[]).length} active</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div style={{padding:"16px 20px",borderTop:`1px solid ${C_H.border}`}}>
          <button onClick={()=>setShowPauseH(true)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:isPausedH?"#0A1A10":"none",border:`1px solid ${isPausedH?"#065F46":C_H.border}`,borderRadius:7,padding:"8px 12px",cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPausedH?C_H.green:C_H.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <span style={{fontSize:12,color:isPausedH?C_H.green:C_H.sub,fontWeight:isPausedH?600:400}}>{isPausedH?`Paused · ${pauseTimeLeft(pausedUntilH!)||"resuming"}`:"Pause Notifications"}</span>
          </button>
          <button onClick={onLogout} style={{background:"none",border:"none",color:C_H.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"6px 0"}}>→ Logout</button>
        </div>
        {showPauseH && <PauseModalShared isPaused={!!isPausedH} pausedUntil={pausedUntilH} onClose={()=>setShowPauseH(false)} accent={C_H.accent} onPause={async(h:number)=>{const d=await holderApi.pauseNotifications(h);setPausedUntilH(d.pausedUntil);}} onResume={async()=>{await holderApi.resumeNotifications();setPausedUntilH(null);}}/>}
      </div>

      {openAccId
        ? <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{background:C_H.surface,borderBottom:`1px solid ${C_H.border}`,display:"flex",flexShrink:0,padding:"0 32px"}}>
              {[["notifications","Notifications"],["subreddits","Manage Subreddits"]].map(([key,label]) => {
                const a = holderMainTab === key;
                return (<button key={key} onClick={() => setHolderMainTab(key)} style={{background:"none",border:"none",borderBottom:a?`2px solid ${C_H.accent}`:"2px solid transparent",color:a?C_H.accent:C_H.dim,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:a?700:500,padding:"14px 18px",marginBottom:-1,transition:"color 0.12s"}}>{label}</button>);
              })}
            </div>
            {holderMainTab === "notifications"
              ? <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{padding:"18px 32px 14px",borderBottom:`1px solid ${C_H.border}`,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:20,fontWeight:800,color:C_H.text}}>
                          {openAcc ? (openAcc.redditUsername ? `u/${openAcc.redditUsername.replace(/^u\//,"")}` : openAcc.emailAddress) : "All Notifications"}
                        </div>
                        <div style={{fontSize:12,color:C_H.muted,marginTop:3}}>Click any post to open and take action.</div>
                      </div>
                      <div style={{display:"flex",gap:8,flexShrink:0}}>
                        {["all","viewed","posted"].map(t => <button key={t} onClick={() => setTabPersist(t)} style={{background:tab===t?"#1C1400":"#161B26",color:tab===t?C_H.accent:C_H.sub,border:tab===t?`1px solid ${C_H.accent}40`:`1px solid ${C_H.border}`,borderRadius:7,padding:"8px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:tab===t?700:500}}>{t} <span style={{opacity:0.8}}>({counts[t]??0})</span></button>)}
                      </div>
                    </div>
                    <input style={{...inpH,padding:"8px 12px",fontSize:12}} placeholder="Search by post title or subreddit…" value={search} onChange={(e: any) => setSearch(e.target.value)}/>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
                    <NotifListH notifs={filtered} onOpen={(id: any) => holderApi.getNotification(id).then(setPopup).catch(() => {})}/>
                  </div>
                </div>
              : <ManageSubsPanelH account={openAcc} onUpdated={loadAccounts}/>
            }
          </div>
        : <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C_H.dim}}>
            <div style={{fontSize:32}}>👤</div>
            <div style={{fontSize:14}}>Select an account from the sidebar</div>
          </div>
      }
    </div>
  );
}

function HolderApp({ user, onLogout, initialPostId }: any) {
  useEffect(() => { sessionStorage.removeItem("holder_new_signup"); }, []);
  return <HolderDashboard user={user} onLogout={onLogout} initialPostId={initialPostId} />;
}

// ─────────────────────────────────────────────────────────────
// Root App — JWT check + route to correct portal
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [token,       setToken]       = useState<string|null>(null);
  const [user,        setUser]        = useState<any>(null);
  const [initialPostId, setInitialPostId] = useState<string|null>(null);
  const [isNewSignup, setIsNewSignup] = useState(false);

  useEffect(() => {
    // Check URL params for deep-link token (email links from holder notifications)
    const params = new URLSearchParams(window.location.search);
    const urlToken  = params.get("token");
    const urlRole   = params.get("role");
    const urlPostId = params.get("postId");

    if (urlToken) {
      localStorage.setItem("token", urlToken);
    }
    if (urlPostId) {
      // Write to sessionStorage immediately — dashboards read it directly on mount
      sessionStorage.setItem("pending_post_id", urlPostId);
    }
    if (urlToken || urlPostId) {
      window.history.replaceState({}, "", "/");
    }

    // Migrate old key "main_token" → "token" (one-time migration from old CRA app)
    if (!localStorage.getItem("token")) {
      const legacy = localStorage.getItem("main_token");
      if (legacy) { localStorage.setItem("token", legacy); localStorage.removeItem("main_token"); }
    }

    const t = localStorage.getItem("token");
    if (!t) { setAuthChecked(true); return; }

    const payload = decodeJwt(t);
    if (!payload || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem("token");
      localStorage.removeItem("user_data");
      setAuthChecked(true);
      return;
    }

    // Check cached user_data
    const stored = localStorage.getItem("user_data");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        const role = u.role ?? (u.roles?.[0]);
        if (role === payload.role || u.roles?.includes(payload.role)) {
          setToken(t);
          setUser(u);
          setAuthChecked(true);
          return;
        }
      } catch {}
    }

    // Verify with API
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          localStorage.setItem("user_data", JSON.stringify(d.user));
          setToken(t);
          setUser(d.user);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user_data");
        }
      })
      .catch(() => {
        // If verify fails but JWT looks valid, trust the JWT payload
        const u = { id: payload.userId, role: payload.role, name: payload.name ?? "", email: payload.email ?? "" };
        setToken(t);
        setUser(u);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  function handleAuth(tok: string, u: any, newSignup: boolean) {
    localStorage.setItem("user_data", JSON.stringify(u));
    setToken(tok);
    setUser(u);
    if (newSignup && u.role === "holder") {
      sessionStorage.setItem("holder_new_signup", "1");
      setIsNewSignup(true);
    } else if (newSignup && u.role === "monitor") {
      sessionStorage.setItem("monitor_new_signup", "1");
      setIsNewSignup(false);
    } else {
      setIsNewSignup(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user_data");
    setToken(null);
    setUser(null);
    setIsNewSignup(false);
  }

  if (!authChecked) return (
    <div style={{ height:"100vh", background:"#0D0F16", display:"flex", alignItems:"center", justifyContent:"center", color:"#6B7280", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      Loading...
    </div>
  );

  if (!token || !user) return <LoginGate onAuth={handleAuth} />;

  const role = user.role ?? (user.roles?.[0]);

  if (role === "main") {
    return <MainApp onLogout={handleLogout} />;
  }

  if (role === "monitor") {
    return <MonitorApp user={user} onLogout={handleLogout} initialPostId={initialPostId} />;
  }

  if (role === "holder") {
    return <HolderApp user={user} onLogout={handleLogout} initialPostId={initialPostId} />;
  }

  // Unknown role — show login
  return <LoginGate onAuth={handleAuth} />;
}
