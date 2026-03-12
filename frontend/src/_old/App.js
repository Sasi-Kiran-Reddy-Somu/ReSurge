import React, { useState, useEffect } from "react";
import { useTracker } from "./hooks/useTracker.js";
import Sidebar      from "./components/Sidebar.js";
import SliderPanel  from "./components/SliderPanel.js";
import Stack4Feed   from "./components/Stack4Feed.js";
import StackModal   from "./components/StackModal.js";
import MonitorPanel     from "./components/MonitorPanel.js";
import HoldersPanel     from "./components/HoldersPanel.js";
import AllNotifications from "./components/AllNotifications.js";
import PostHistory      from "./components/PostHistory.js";
import SubredditsPanel  from "./components/SubredditsPanel.js";

const STACK_COLORS = { 1:"#6B7280", 2:"#3B82F6", 3:"#8B5CF6", 4:"#F59E0B" };

const ROLE_LABELS = { main:"Main Admin", monitor:"Monitor", holder:"Holder" };
const ROLE_PORTS  = { main:3000, monitor:3003, holder:3002 };
const ROLE_COLORS = { main:"#FF4500", monitor:"#3B82F6", holder:"#22C55E" };
const ROLE_DESC   = { main:"Admin dashboard & tracker", monitor:"Oversee holder activity", holder:"Post notifications & comments" };
const THIS_ROLE   = "main";
const inp = { background:"#0F1117", border:"1px solid #374151", borderRadius:8, padding:"10px 14px", color:"#F9FAFB", width:"100%", boxSizing:"border-box", fontFamily:"inherit", fontSize:13 };

function LoginGate({ onAuth }) {
  const [step,   setStep]   = useState("pick"); // "pick" | "form"
  const [action, setAction] = useState("");     // "signin" | "signup"
  const [role,   setRole]   = useState("");
  const [form,   setForm]   = useState({ email:"", password:"", name:"", phone:"" });
  const [err,    setErr]    = useState("");
  const [busy,   setBusy]   = useState(false);

  function pick(action, role) { setAction(action); setRole(role); setStep("form"); setErr(""); }

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      let data;
      if (action === "signup") {
        const res = await fetch("/api/auth/signup", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...form, role}) });
        data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Signup failed");
      } else {
        const res = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email:form.email, password:form.password, loginAs:role }) });
        data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Login failed");
      }
      if (role === THIS_ROLE) {
        localStorage.setItem("main_token", data.token);
        onAuth(data.user);
      } else {
        window.location.href = `http://localhost:${ROLE_PORTS[role]}?token=${encodeURIComponent(data.token)}&role=${role}`;
      }
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (step === "pick") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0D0F16", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ width:580 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:44, height:44, background:"#FF4500", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", margin:"0 auto 14px" }}>r/</div>
          <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:26, color:"#F9FAFB" }}>Reddit Tracker</div>
          <div style={{ color:"#6B7280", fontSize:13, marginTop:6 }}>Choose how you want to continue</div>
        </div>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#374151", letterSpacing:"1px", marginBottom:12, textAlign:"center" }}>SIGN IN AS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {["main","monitor","holder"].map(r => (
              <div key={r} onClick={() => pick("signin", r)} style={{ background:"#0F1117", border:`1px solid ${ROLE_COLORS[r]}30`, borderRadius:12, padding:"20px 16px", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`; e.currentTarget.style.background=`${ROLE_COLORS[r]}08`; }}
                onMouseLeave={e => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}30`; e.currentTarget.style.background="#0F1117"; }}>
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
                onMouseEnter={e => { e.currentTarget.style.border=`1px solid ${ROLE_COLORS[r]}`; }}
                onMouseLeave={e => { e.currentTarget.style.border="1px solid #1F2937"; }}>
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
              <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Full Name</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
              <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Phone (optional)</label><input style={inp} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            </>
          )}
          <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Email Address</label><input type="email" style={inp} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></div>
          <div><label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:6 }}>Password</label><input type="password" style={inp} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></div>
          {err && <div style={{ color:"#F87171", fontSize:12 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ background:ROLE_COLORS[role], border:"none", borderRadius:8, padding:"12px", width:"100%", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
            {busy ? "Please wait..." : `${action==="signin" ? "Sign in" : "Create account"} →`}
          </button>
        </form>
        <div onClick={() => { setStep("pick"); setErr(""); }} style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#6B7280", cursor:"pointer" }}>← Back to options</div>
      </div>
    </div>
  );
}

export default function App() {
  const [mainUser,    setMainUser]    = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view,        setView]        = useState("notifications");
  const [showHistory, setShowHistory] = useState(false);
  const [toast,       setToast]       = useState(null);

  function showToast(msg) {
    const id = Date.now();
    setToast({ msg, id });
    setTimeout(() => setToast(t => t?.id === id ? null : t), 5000);
  }

  useEffect(() => {
    // Accept token passed via URL redirect (e.g. from holder/monitor apps)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlRole  = params.get("role");
    if (urlToken && urlRole === "main") {
      localStorage.setItem("main_token", urlToken);
      window.history.replaceState({}, "", "/");
    }
    const t = localStorage.getItem("main_token");
    if (!t) { setAuthChecked(true); return; }
    try {
      const p = JSON.parse(atob(t.split(".")[1]));
      if (p.exp * 1000 > Date.now() && p.role === "main") setMainUser({ id:p.userId, role:p.role });
    } catch {}
    setAuthChecked(true);
  }, []);

  const { subreddits, activeTab, switchTab, thresholds, saveThresholds, stack4Feed, stackCounts, modalPosts, openStackModal, closeModal, addSubreddit, removeSubreddit, dismissPost, countdown, lastRefresh, loading, error } = useTracker();

  if (!authChecked) return null;
  if (!mainUser)    return <LoginGate onAuth={setMainUser} />;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:12 }}>
      <div className="pulse" style={{ width:8, height:8, background:"#22C55E", borderRadius:"50%" }} />
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
    {/* Global toast — sibling of main layout so overflow:hidden can't clip it */}
    {toast && (
      <div style={{ position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", zIndex:99999, background:"#1A2F1A", border:"1px solid #22C55E66", borderRadius:10, padding:"14px 24px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 40px #00000080", pointerEvents:"none", fontFamily:"'IBM Plex Sans',sans-serif" }}>
        <span style={{ fontSize:16 }}>✅</span>
        <span style={{ fontSize:13, color:"#86EFAC", fontWeight:500 }}>{toast.msg}</span>
      </div>
    )}
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      <Sidebar
        subreddits={subreddits} activeTab={activeTab}
        onSwitch={(name) => { setView("tracker"); setShowHistory(false); switchTab(name); }}
        onAdd={addSubreddit}
        stackCounts={stackCounts} countdown={countdown} lastRefresh={lastRefresh}
        view={view}
        onViewMonitors={() => setView("monitors")}
        onViewHolders={() => setView("holders")}
        onViewNotifications={() => setView("notifications")}
        onViewSubreddits={() => setView("subreddits")}
        onLogout={() => { localStorage.removeItem("main_token"); setMainUser(null); }}
      />

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {view === "monitors" ? <MonitorPanel /> : view === "holders" ? <HoldersPanel /> : view === "notifications" ? <AllNotifications /> : view === "subreddits" ? <SubredditsPanel subreddits={subreddits} onSubredditRemoved={removeSubreddit} onSubredditAdded={(s) => addSubreddit(s.name).catch(()=>{})} showToast={showToast} /> : (
          <>
            <div style={{ padding:"14px 24px 0", borderBottom:"1px solid #1A1D2E", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <a href={`https://reddit.com/r/${activeTab}`} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <div style={{ width:30, height:30, background:"#FF4500", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>r/</div>
                  <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:800, fontSize:20, color:"#F9FAFB" }}>{activeTab}</span>
                  <span style={{ fontSize:10, color:"#6B7280" }}>↗ open reddit</span>
                </a>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {[1,2,3,4].map(s => {
                    const count = s===1?stackCounts.s1:s===2?stackCounts.s2:s===3?stackCounts.s3:stackCounts.s4;
                    const color = STACK_COLORS[s]; const clickable = s !== 4;
                    return (
                      <div key={s} onClick={() => { if(clickable) openStackModal(s); }} style={{ display:"flex", alignItems:"center", gap:6, background:"#0F1117", border:`1px solid ${color}35`, borderRadius:8, padding:"6px 12px", cursor:clickable?"pointer":"default", transition:"all 0.15s" }}
                        onMouseEnter={e => { if(clickable) e.currentTarget.style.borderColor=color; }}
                        onMouseLeave={e => { if(clickable) e.currentTarget.style.borderColor=`${color}35`; }}>
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
              <SliderPanel thresholds={thresholds} onSave={saveThresholds} subreddit={activeTab} />
            </div>
            {showHistory
              ? <PostHistory subreddit={activeTab} />
              : <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>🚨 Stack 4 — Viral Alert Queue</span>
                    <span style={{ fontSize:10, color:"#F59E0B", background:"#1C1400", border:"1px solid #78350F", padding:"2px 8px", borderRadius:10 }}>{stackCounts.s4} posts</span>
                    <span style={{ fontSize:10, color:"#374151", marginLeft:"auto" }}>accumulates over time · auto-refreshes every 15s</span>
                  </div>
                  <Stack4Feed posts={stack4Feed} onDismiss={dismissPost} />
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
