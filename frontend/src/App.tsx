import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTracker } from "./hooks/useTracker";
import Sidebar      from "./components/Sidebar";
import SliderPanel  from "./components/SliderPanel";
import Stack3Feed   from "./components/Stack4Feed";
import StackModal   from "./components/StackModal";
import MonitorPanel     from "./components/MonitorPanel";
import HoldersPanel     from "./components/HoldersPanel";
import AllNotifications from "./components/AllNotifications";
import PostHistory      from "./components/PostHistory";
import SubredditsPanel  from "./components/SubredditsPanel";
import AlertsPanel     from "./components/AlertsPanel";

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
// LoginGate — shared across all roles, no cross-port redirect
// ─────────────────────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: (token: string, user: any, isNewSignup: boolean) => void }) {
  const [step,     setStep]     = useState("pick"); // "pick" | "form"
  const [action,   setAction]   = useState("");     // "signin" | "signup"
  const [role,     setRole]     = useState("");
  const [form,     setForm]     = useState({ email:"", password:"", name:"", phone:"" });
  const [err,      setErr]      = useState("");
  const [busy,     setBusy]     = useState(false);
  const [showPass, setShowPass] = useState(false);

  function pick(act: string, r: string) { setAction(act); setRole(r); setStep("form"); setErr(""); }

  async function submit(e: any) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      let data: any;
      if (action === "signup") {
        const res = await fetch("/api/auth/signup", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...form, role}) });
        data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Signup failed");
      } else {
        const res = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:form.email, password:form.password, loginAs:role }) });
        data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Login failed");
      }
      localStorage.setItem("token", data.token);
      onAuth(data.token, data.user, action === "signup");
    } catch(e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (step === "pick") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0D0F16", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ width:580 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:44, height:44, background:"#FF4500", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", margin:"0 auto 14px" }}>r/</div>
          <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:26, color:"#F9FAFB" }}>ReSurge</div>
          <div style={{ color:"#6B7280", fontSize:13, marginTop:6 }}>Choose how you want to continue</div>
        </div>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#374151", letterSpacing:"1px", marginBottom:12, textAlign:"center" }}>SIGN IN AS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {["main","monitor","holder"].map(r => (
              <div key={r} onClick={() => pick("signin", r)} style={{ background:"#0F1117", border:`1px solid ${ROLE_COLORS[r]}30`, borderRadius:12, padding:"20px 16px", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}
                onMouseEnter={(e: any) => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`; e.currentTarget.style.background=`${ROLE_COLORS[r]}08`; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}30`; e.currentTarget.style.background="#0F1117"; }}>
                <div style={{ width:36, height:36, borderRadius:9, background:`${ROLE_COLORS[r]}18`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:ROLE_COLORS[r] }}/>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:"#F9FAFB", marginBottom:4 }}>{ROLE_LABELS[r]}</div>
                <div style={{ fontSize:11, color:"#6B7280" }}>{ROLE_DESC[r]}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:"#374151", letterSpacing:"1px", marginBottom:12, textAlign:"center" }}>SIGN UP AS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {["monitor","holder"].map(r => (
              <div key={r} onClick={() => pick("signup", r)} style={{ background:"#0F1117", border:"1px solid #1F2937", borderRadius:12, padding:"16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all 0.15s" }}
                onMouseEnter={(e: any) => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.border="1px solid #1F2937"; }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:ROLE_COLORS[r], flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#9CA3AF" }}>Create {ROLE_LABELS[r]} account</div>
                  <div style={{ fontSize:11, color:"#374151", marginTop:2 }}>{ROLE_DESC[r]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0D0F16", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ width:420 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:ROLE_COLORS[role] }}/>
          <span style={{ fontSize:14, fontWeight:700, color:ROLE_COLORS[role] }}>{action==="signin" ? "Sign in as" : "Create"} {ROLE_LABELS[role]} account</span>
        </div>
        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {action === "signup" && (
            <>
              <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Full Name</label><input style={inp} value={form.name} onChange={(e:any)=>setForm({...form,name:e.target.value})} required /></div>
              <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Phone (optional)</label><input style={inp} value={form.phone} onChange={(e:any)=>setForm({...form,phone:e.target.value})} /></div>
            </>
          )}
          <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Email Address</label><input type="email" style={inp} value={form.email} onChange={(e:any)=>setForm({...form,email:e.target.value})} required /></div>
          <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Password</label><div style={{ position:"relative" }}><input type={showPass?"text":"password"} style={{...inp,paddingRight:38}} value={form.password} onChange={(e:any)=>setForm({...form,password:e.target.value})} required /><button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#6B7280", fontSize:15, lineHeight:1, padding:0 }}>{showPass?"🙈":"👁"}</button></div></div>
          {err && <div style={{ color:"#F87171", fontSize:12 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ background:ROLE_COLORS[role], border:"none", borderRadius:8, padding:"12px", width:"100%", color: role==="holder" ? "#000" : "#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
            {busy ? "Please wait..." : `${action==="signin" ? "Sign in" : "Create account"} →`}
          </button>
        </form>
        <div onClick={() => { setStep("pick"); setErr(""); }} style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#6B7280", cursor:"pointer" }}>← Back to options</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MainApp — full admin dashboard
// ─────────────────────────────────────────────────────────────
function MainApp({ onLogout }: { onLogout: () => void }) {
  const [view,           setView]           = useState(() => sessionStorage.getItem("main_view") || "notifications");
  const [showHistory,    setShowHistory]    = useState(false);
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
        onSwitch={(name: string) => { changeView("tracker"); setShowHistory(false); switchTab(name); }}
        onAdd={addSubreddit}
        stackCounts={stackCounts} countdown={countdown} lastRefresh={lastRefresh}
        view={view}
        onViewMonitors={() => changeView("monitors")}
        onViewHolders={() => changeView("holders")}
        onViewNotifications={() => changeView("notifications")}
        onViewSubreddits={() => changeView("subreddits")}
        onViewAlerts={() => changeView("alerts")}
        alertCount={alertCount}
        onLogout={onLogout}
      />

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {view === "monitors" ? <MonitorPanel /> :
         view === "holders" ? (
           selectedHolder
             ? <HolderDetail holder={selectedHolder} onBack={() => setSelectedHolder(null)} />
             : <HoldersPanel onSelectHolder={(h: any) => setSelectedHolder(h)} />
         ) :
         view === "alerts" ? <AlertsPanel onSelectHolder={(h: any) => { setSelectedHolder(h); setView("holders"); sessionStorage.setItem("main_view", "holders"); }} onAckChange={loadAlertCount} /> :
         view === "notifications" ? <AllNotifications /> :
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
                    onClick={() => setShowHistory(h => !h)}
                    style={{ background: showHistory ? "#1A2A40" : "#0F1117", color: showHistory ? "#93C5FD" : "#9CA3AF", border: showHistory ? "1px solid #3B82F640" : "1px solid #374151", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: showHistory ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                    {showHistory ? "← Feed" : "History"}
                  </button>
                </div>
              </div>
              <SliderPanel key={activeTab} thresholds={thresholds} onSave={saveThresholds} subreddit={activeTab} />
            </div>
            {showHistory
              ? <PostHistory subreddit={activeTab} />
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

function getTokenM() { return localStorage.getItem("token"); }
async function reqM(method: string, path: string, body?: any) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`/api${path}`, { method, signal: ctrl.signal, headers: {"Content-Type":"application/json", ...(getTokenM() ? {Authorization:`Bearer ${getTokenM()}`} : {})}, body: body ? JSON.stringify(body) : undefined });
    clearTimeout(tid);
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

function MonitorDashboard({ user, onLogout }: any) {
  const [holders, setHolders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [sideSearch, setSideSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<any>({col:"name",dir:"asc"});

  useEffect(() => {
    reqM("GET", "/monitor/holders").then((data: any[]) => {
      setHolders(data);
      // Restore previously selected holder after refresh
      const savedId = sessionStorage.getItem("monitor_selected_id");
      if (savedId) {
        const found = data.find((h: any) => String(h.id) === String(savedId));
        if (found) setSelected(found);
      }
    }).catch(() => {});
  }, []);

  function selectHolder(h: any) { setSelected(h); sessionStorage.setItem("monitor_selected_id", h.id); }
  function deselectHolder() { setSelected(null); sessionStorage.removeItem("monitor_selected_id"); }

  function toggleSort(col: string) { setSort((s: any) => s.col===col ? {col,dir:s.dir==="asc"?"desc":"asc"} : {col,dir:"asc"}); }
  function sortIcon(col: string) { if (sort.col !== col) return <span style={{opacity:0.2,fontSize:9}}> ⇅</span>; return <span style={{fontSize:9,color:C_M.accent}}> {sort.dir==="asc"?"↑":"↓"}</span>; }

  const sideFiltered = holders.filter(h => h.name.toLowerCase().includes(sideSearch.toLowerCase()) || h.email.toLowerCase().includes(sideSearch.toLowerCase()));

  const tableFiltered = [...holders]
    .filter(h => h.name.toLowerCase().includes(search.toLowerCase()) || h.email.toLowerCase().includes(search.toLowerCase()))
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
    <div style={{display:"flex",height:"100vh",background:C_M.bg,fontFamily:"'IBM Plex Sans',sans-serif",overflow:"hidden"}}>
      <div style={{width:280,background:C_M.surface,borderRight:`1px solid ${C_M.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C_M.border}`}}>
          <div style={{fontSize:11,color:C_M.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>👁 MONITOR PORTAL</div>
          <div style={{fontWeight:700,fontSize:15,color:C_M.text,marginBottom:3}}>{user.name}</div>
          <div style={{fontSize:12,color:C_M.muted}}>{user.email}</div>
        </div>
        <div style={{padding:"10px 14px 4px",flexShrink:0}}>
          <input value={sideSearch} onChange={(e: any) => setSideSearch(e.target.value)} placeholder="Search holders..."
            style={{background:"#111318",border:`1px solid ${C_M.border}`,borderRadius:7,padding:"7px 12px",color:C_M.text,fontFamily:"inherit",fontSize:12,width:"100%",boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{padding:"8px 14px 10px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:10,color:C_M.dim,letterSpacing:"0.08em",marginBottom:8,paddingLeft:4}}>HOLDERS ({sideFiltered.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {sideFiltered.map((h: any) => (
              <div key={h.id} onClick={() => selectHolder(h)}
                style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",background:selected?.id===h.id?"#1E3A5F":"none",border:selected?.id===h.id?`1px solid ${C_M.accent}30`:"1px solid transparent",transition:"all 0.1s"}}
                onMouseEnter={(e: any) => { if (selected?.id !== h.id) e.currentTarget.style.background="#111318"; }}
                onMouseLeave={(e: any) => { if (selected?.id !== h.id) e.currentTarget.style.background="none"; }}>
                <div style={{fontSize:13,fontWeight:600,color:selected?.id===h.id?"#93C5FD":C_M.text,marginBottom:2}}>{h.name}</div>
                <div style={{fontSize:11,color:C_M.muted}}>{h.converted} posted · {h.totalNotifications} notified</div>
              </div>
            ))}
            {sideFiltered.length === 0 && <div style={{fontSize:12,color:C_M.dim,padding:"8px 6px"}}>{holders.length===0?"No holders assigned.":"No results."}</div>}
          </div>
        </div>
        <div style={{padding:"16px 20px",borderTop:`1px solid ${C_M.border}`}}>
          <button onClick={onLogout} style={{background:"none",border:"none",color:C_M.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>→ Logout</button>
        </div>
      </div>

      {selected
        ? <HolderDetail key={selected?.id} holder={selected} onBack={deselectHolder}/>
        : <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"18px 32px",borderBottom:`1px solid ${C_M.border}`,display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
              <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search holders by name or email..."
                style={{flex:1,background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:8,padding:"10px 16px",color:C_M.text,fontFamily:"inherit",fontSize:13,outline:"none"}}/>
              <div style={{whiteSpace:"nowrap",fontSize:13,color:C_M.muted,fontWeight:600}}>
                {search ? `${tableFiltered.length} of ${holders.length}` : holders.length} holder{holders.length!==1?"s":""}
              </div>
            </div>
            <div style={{flex:1,padding:"24px 32px",overflowY:"auto"}}>
              <div style={{background:C_M.surface,border:`1px solid ${C_M.border}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"12px 24px",borderBottom:`1px solid ${C_M.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16}}>
                  {[["name","Name"],["email","Email"],["subreddits","Subreddits"],["notified","Notified"],["posted","Posted"]].map(([col,label]) => (
                    <div key={col} onClick={() => toggleSort(col)} style={{fontSize:11,color:sort.col===col?C_M.accent:C_M.dim,fontWeight:700,letterSpacing:"0.05em",cursor:"pointer",userSelect:"none"}}>
                      {label}{sortIcon(col)}
                    </div>
                  ))}
                </div>
                {tableFiltered.map((h: any) => (
                  <div key={h.id} onClick={() => selectHolder(h)} style={{padding:"14px 24px",borderBottom:`1px solid ${C_M.border}`,display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr",gap:16,cursor:"pointer",transition:"background 0.1s",alignItems:"center"}}
                    onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
                    onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                    <div style={{fontSize:14,fontWeight:600,color:C_M.text}}>{h.name}</div>
                    <div style={{fontSize:12,color:C_M.muted}}>{h.email}</div>
                    <div style={{fontSize:13,color:C_M.sub}}>{h.subreddits.length}</div>
                    <div style={{fontSize:13,color:C_M.amber}}>{h.totalNotifications}</div>
                    <div style={{fontSize:14,fontWeight:700,color:C_M.green}}>{h.converted}</div>
                  </div>
                ))}
                {tableFiltered.length === 0 && <div style={{padding:"40px 24px",textAlign:"center",color:C_M.dim,fontSize:13}}>{holders.length===0?"No holders assigned yet.":"No results match your search."}</div>}
              </div>
            </div>
          </div>
      }
    </div>
  );
}

function MonitorApp({ user, onLogout }: any) {
  return <MonitorDashboard user={user} onLogout={onLogout} />;
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
  if (!res.ok) { const e = await res.json().catch(() => ({error: res.statusText})); throw new Error(e.error ?? "Request failed"); }
  return res.json();
}

const holderApi = {
  getSubreddits:    ()              => reqH("GET",  "/holder/subreddits"),
  getNotifications: ()              => reqH("GET",  "/holder/notifications"),
  getNotification:  (id: any)       => reqH("GET",  `/holder/notifications/${id}`),
  markPosted:       (id: any, link: string) => reqH("PUT",  `/holder/notifications/${id}/posted`, { postedLink: link }),
  markDone:         (id: any)       => reqH("PUT",  `/holder/notifications/${id}/done`),
  generateComment:  (postId: any)   => reqH("POST", `/posts/${postId}/generate-comment`),
  getAccounts:      ()              => reqH("GET",  "/holder/accounts"),
  addAccount:       (data: any)     => reqH("POST", "/holder/accounts", data),
  deleteAccount:    (id: any)       => reqH("DELETE", `/holder/accounts/${id}`),
};

function SubredditGrid({ allSubs, sel, onToggle }: any) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
      {allSubs.map((s: any) => (
        <div key={s.name} onClick={() => onToggle(s.name)}
          style={{background:sel.has(s.name)?"#1C1400":C_H.surface,border:`1px solid ${sel.has(s.name)?C_H.accent:C_H.border}`,borderRadius:10,padding:"16px 18px",cursor:"pointer",transition:"all 0.15s"}}>
          <div style={{fontSize:11,color:C_H.muted,marginBottom:4}}>r/</div>
          <div style={{fontSize:14,fontWeight:600,color:sel.has(s.name)?C_H.accent:C_H.text}}>{s.name}</div>
        </div>
      ))}
      {allSubs.length === 0 && <div style={{color:C_H.dim,fontSize:13}}>No subreddits tracked yet.</div>}
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
            <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:6}}>Reddit Username (optional)</label>
            <input style={inpH} value={form.redditUsername} onChange={(e: any) => setForm(p => ({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
          </div>
        </div>
        {err && <div style={{color:C_H.red,fontSize:12,marginBottom:12}}>{err}</div>}
        <div style={{marginTop:"auto"}}>
          <div style={{fontSize:13,color:C_H.sub,marginBottom:10}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
          <button onClick={save} disabled={busy || !form.emailAddress} style={{...btnH(C_H.accent,"#000"),width:"100%",padding:"13px"}}>
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
              <label style={{fontSize:11,color:C_H.muted,display:"block",marginBottom:5}}>Reddit Username (optional)</label>
              <input style={inpH} value={form.redditUsername} onChange={(e: any) => setForm(p => ({...p,redditUsername:e.target.value}))} placeholder="u/username"/>
            </div>
          </div>
          {err && <div style={{color:C_H.red,fontSize:12,marginBottom:10}}>{err}</div>}
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:12,color:C_H.sub,marginBottom:8}}>{sel.size} subreddit{sel.size!==1?"s":""} selected</div>
            <button onClick={save} disabled={busy || !form.emailAddress} style={{...btnH(C_H.accent,"#000"),width:"100%",padding:"11px",marginBottom:8}}>
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
  async function generate() { setLoading(true); setErr(""); try { const c = (await holderApi.generateComment(notif.postId)).comment; setComment(c); if (onCommentCached) onCommentCached(c); } catch(e: any) { setErr(e.message); } finally { setLoading(false); } }
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
        {!comment && <button onClick={generate} disabled={loading} style={{...btnH(loading?"#78350F":C_H.accent,loading?"#FCD34D":"#000"),width:"100%",padding:"14px",marginBottom:16,fontSize:14}}>{loading?"Generating...":"✨ Generate Comment"}</button>}
        {err && <div style={{color:C_H.red,fontSize:13,marginBottom:12}}>{err}</div>}
        {comment && <div style={{background:"#080B12",border:`1px solid #1E3A5F`,borderRadius:12,padding:22,marginBottom:20}}><p style={{margin:"0 0 16px",fontSize:14,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{comment}</p><div style={{display:"flex",gap:10}}><button onClick={() => { setComment(null); generate(); }} style={btnH("#1F2937",C_H.sub)}>↺ Regenerate</button><button onClick={copy} style={btnH(copied?"#064E3B":"#1F2937",copied?C_H.green:C_H.sub)}>{copied?"✓ Copied!":"Copy Text"}</button></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:showPaste?16:0}}>
          <button onClick={() => window.open(notif.postUrl,"_blank")} style={btnH("#1A1D2E",C_H.sub,{border:`1px solid ${C_H.border}`})}>Open Post ↗</button>
          <button onClick={async () => { await holderApi.markDone(notif.id); onAction(); }} style={btnH("#1F2937",C_H.muted)}>Done</button>
          <button onClick={() => setShowPaste(true)} style={btnH("#064E3B",C_H.green)}>✓ Posted</button>
        </div>
        {showPaste && <div style={{background:"#060D0A",border:`1px solid #065F46`,borderRadius:10,padding:20,marginTop:12}}><label style={{fontSize:12,color:C_H.muted,display:"block",marginBottom:8}}>Paste your Reddit comment link:</label><input style={{...inpH,marginBottom:12}} placeholder="https://reddit.com/r/.../comment/..." value={link} onChange={(e: any) => setLink(e.target.value)}/><button onClick={async () => { if (!link.trim()) return; await holderApi.markPosted(notif.id, link.trim()); onAction(); }} style={{...btnH(C_H.green,"#000"),width:"100%"}}>Submit & Save</button></div>}
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

function ManageAccountsModalH({ accounts, onClose, onDeleted, onAdd, delBusy }: any) {
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
                <button onClick={() => onDeleted(acc.id)} disabled={delBusy===acc.id}
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

function HolderDashboard({ user, onLogout, initialPostId }: any) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [openAccId, setOpenAccId] = useState<any>(() => sessionStorage.getItem("holder_acc_id") || null);
  const [tab, setTab] = useState(() => sessionStorage.getItem("holder_tab") || "all");
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [popup, setPopup] = useState<any>(null);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [showManageAcc, setShowManageAcc] = useState(false);
  const [delAccBusy, setDelAccBusy] = useState<any>(null);
  const commentCache = useRef<any>({});

  useEffect(() => {
    load();
    loadAccounts();
    // Handle deep-link postId (passed from URL or as prop)
    const p = new URLSearchParams(window.location.search);
    const nId = initialPostId || p.get("postId");
    if (nId) {
      holderApi.getNotification(nId).then((notif: any) => {
        setPopup(notif);
        if (notif.accountId) setOpenAccId(notif.accountId);
      }).catch(() => {});
      window.history.replaceState({}, "", "/");
    }
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
      {showManageAcc && <ManageAccountsModalH accounts={accounts} delBusy={delAccBusy} onClose={() => setShowManageAcc(false)} onDeleted={async (id: any) => { await deleteAccount(id); }} onAdd={() => { setShowManageAcc(false); setShowAddAcc(true); }}/>}

      <div style={{width:270,background:C_H.surface,borderRight:`1px solid ${C_H.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${C_H.border}`}}>
          <div style={{fontSize:11,color:C_H.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>🎯 HOLDER PORTAL</div>
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
              const isOpen = String(openAccId) === String(acc.id);
              const accNotifs = notifs.filter(n => n.accountId === acc.id);
              const accPosted = accNotifs.filter(n => n.status === "posted").length;
              return (
                <div key={acc.id}>
                  <div onClick={() => setOpenAccIdPersist(isOpen ? null : acc.id)}
                    style={{display:"flex",alignItems:"center",background:isOpen?"#111827":"none",borderLeft:isOpen?`3px solid ${C_H.accent}`:"3px solid transparent",transition:"all 0.1s",cursor:"pointer"}}
                    onMouseEnter={(e: any) => { if (!isOpen) e.currentTarget.style.background="#0F1117"; }}
                    onMouseLeave={(e: any) => { if (!isOpen) e.currentTarget.style.background="none"; }}>
                    <div style={{flex:1,padding:"10px 20px",minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:isOpen?C_H.accent:C_H.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {acc.redditUsername ? `u/${acc.redditUsername.replace(/^u\//,"")}` : acc.emailAddress}
                      </div>
                      {acc.redditUsername && <div style={{fontSize:11,color:C_H.dim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.emailAddress}</div>}
                    </div>
                    <span style={{color:C_H.dim,fontSize:11,paddingRight:14}}>{isOpen?"▲":"▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{background:"#0A0D14",borderBottom:`1px solid ${C_H.border}20`}}>
                      <div style={{display:"flex",gap:0,padding:"10px 20px 0"}}>
                        {[{l:"Notified",v:accNotifs.length,c:C_H.sub},{l:"Posted",v:accPosted,c:C_H.green}].map((s: any) => (
                          <div key={s.l} style={{flex:1}}>
                            <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
                            <div style={{fontSize:10,color:C_H.dim}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                      {acc.subreddits && acc.subreddits.length > 0 && (
                        <div style={{padding:"10px 20px 8px"}}>
                          <div style={{fontSize:10,color:C_H.dim,letterSpacing:"0.06em",marginBottom:7}}>SUBREDDITS</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {acc.subreddits.map((s: string) => <span key={s} style={{background:C_H.surface,border:`1px solid ${C_H.border}`,color:C_H.sub,padding:"2px 8px",borderRadius:10,fontSize:10}}>r/{s}</span>)}
                          </div>
                        </div>
                      )}
                      <div style={{padding:"6px 20px 12px"}}>
                        <button onClick={(e: any) => { e.stopPropagation(); setShowManageAcc(true); }}
                          style={{background:"none",border:`1px solid ${C_H.border}`,color:C_H.sub,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:"4px 10px",borderRadius:5,fontWeight:600}}>
                          Manage Accounts
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>

        <div style={{padding:"16px 20px",borderTop:`1px solid ${C_H.border}`}}>
          <button onClick={onLogout} style={{background:"none",border:"none",color:C_H.sub,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:"6px 0"}}>→ Logout</button>
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"22px 32px 14px",borderBottom:`1px solid ${C_H.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:C_H.text}}>
                {openAcc
                  ? (openAcc.redditUsername ? `u/${openAcc.redditUsername.replace(/^u\//,"")}` : openAcc.emailAddress)
                  : "All Notifications"}
              </div>
              {openAcc && openAcc.redditUsername && (
                <div style={{fontSize:12,color:C_H.muted,marginTop:1}}>{openAcc.emailAddress}</div>
              )}
              <div style={{fontSize:12,color:C_H.muted,marginTop:3}}>
                Click any post to open, generate a comment and mark as posted
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              {["all","viewed","posted"].map(t => <button key={t} onClick={() => setTabPersist(t)} style={{background:tab===t?"#1C1400":"#161B26",color:tab===t?C_H.accent:C_H.sub,border:tab===t?`1px solid ${C_H.accent}40`:`1px solid ${C_H.border}`,borderRadius:7,padding:"8px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:tab===t?700:500}}>{t} <span style={{opacity:0.8}}>({counts[t]??0})</span></button>)}
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <input
              style={{...inpH,flex:1,minWidth:160,padding:"8px 12px",fontSize:12}}
              placeholder="Search by post title or subreddit…"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
              {[{k:"all",l:"All time"},{k:"today",l:"Today"},{k:"week",l:"7d"},{k:"month",l:"30d"},{k:"custom",l:"Custom"}].map(({k,l}) => (
                <button key={k} onClick={() => setTimeFilter(k)} style={{background:timeFilter===k?"#1C1400":"#161B26",color:timeFilter===k?C_H.accent:C_H.sub,border:timeFilter===k?`1px solid ${C_H.accent}40`:`1px solid ${C_H.border}`,borderRadius:7,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:timeFilter===k?700:500,whiteSpace:"nowrap"}}>{l}</button>
              ))}
              {timeFilter === "custom" && (
                <>
                  <input type="date" value={fromDate} onChange={(e: any) => setFromDate(e.target.value)} style={{...inpH,padding:"7px 10px",fontSize:11,colorScheme:"dark"}}/>
                  <span style={{fontSize:11,color:C_H.dim}}>–</span>
                  <input type="date" value={toDate} onChange={(e: any) => setToDate(e.target.value)} style={{...inpH,padding:"7px 10px",fontSize:11,colorScheme:"dark"}}/>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          <NotifListH notifs={filtered} onOpen={(id: any) => holderApi.getNotification(id).then(setPopup).catch(() => {})}/>
        </div>
      </div>
    </div>
  );
}

function HolderApp({ user, onLogout, initialPostId }: any) {
  const [newSignup, setNewSignup] = useState(false);

  // If user came from signup flow, show account setup
  useEffect(() => {
    const flag = sessionStorage.getItem("holder_new_signup");
    if (flag) { sessionStorage.removeItem("holder_new_signup"); setNewSignup(true); }
  }, []);

  if (newSignup) return <AccountSetupH onDone={() => setNewSignup(false)} />;
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
      if (urlPostId) {
        setInitialPostId(urlPostId);
        window.history.replaceState({}, "", "/");
      } else {
        window.history.replaceState({}, "", "/");
      }
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
    return <MonitorApp user={user} onLogout={handleLogout} />;
  }

  if (role === "holder") {
    return <HolderApp user={user} onLogout={handleLogout} initialPostId={initialPostId} />;
  }

  // Unknown role — show login
  return <LoginGate onAuth={handleAuth} />;
}
