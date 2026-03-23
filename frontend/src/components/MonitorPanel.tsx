import React, { useState, useEffect, useCallback } from "react";

const BASE = "/api";
function getToken() { return localStorage.getItem("token"); }
async function req(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

const S: any = {
  card:  { background:"#0A0C12", border:"1px solid #1F2937", borderRadius:10, padding:16, marginBottom:10 },
  btn:   (bg="#3B82F6", fg="#fff") => ({ background:bg, color:fg, border:"none", borderRadius:7, padding:"8px 16px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:12 }),
  input: { background:"#0A0C12", border:"1px solid #374151", borderRadius:7, padding:"9px 12px", color:"#F9FAFB", fontFamily:"inherit", fontSize:12, width:"100%", boxSizing:"border-box" },
  label: { fontSize:10, color:"#6B7280", display:"block", marginBottom:5 },
};

// ── Create Monitor Form ───────────────────────────────────────
function CreateMonitorForm({ onCreated }: any) {
  const [form, setForm] = useState({ name:"", email:"", password:"", phone:"" });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [promoted, setPromoted] = useState(false);

  async function submit(e: any) {
    e.preventDefault(); setErr(""); setBusy(true); setPromoted(false);
    try {
      const result = await req("POST", "/admin/monitors", form);
      setForm({ name:"", email:"", password:"", phone:"" });
      if (result.promoted) setPromoted(true);
      onCreated();
    }
    catch(e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} style={{ ...S.card, borderColor:"#1E3A5F" }}>
      <div style={{ fontSize:11, color:"#93C5FD", fontWeight:700, marginBottom:4 }}>+ New Monitor Account</div>
      <div style={{ fontSize:10, color:"#6B7280", marginBottom:14 }}>If the email already exists, the monitor role will be added to that account.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <div><label style={S.label}>Name</label><input style={S.input} value={form.name} onChange={(e: any)=>setForm({...form,name:e.target.value})} required /></div>
        <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={(e: any)=>setForm({...form,email:e.target.value})} required /></div>
        <div><label style={S.label}>Password <span style={{color:"#374151"}}>(skip if existing user)</span></label><input style={S.input} type="password" value={form.password} onChange={(e: any)=>setForm({...form,password:e.target.value})} /></div>
        <div><label style={S.label}>Phone (optional)</label><input style={S.input} value={form.phone} onChange={(e: any)=>setForm({...form,phone:e.target.value})} /></div>
      </div>
      {err && <div style={{ color:"#F87171", fontSize:11, marginBottom:8 }}>{err}</div>}
      {promoted && <div style={{ color:"#34D399", fontSize:11, marginBottom:8 }}>✓ Monitor role added to existing account.</div>}
      <button type="submit" style={S.btn()} disabled={busy}>{busy ? "Saving..." : "Add Monitor"}</button>
    </form>
  );
}

// ── Assign Holder Modal ───────────────────────────────────────
function AssignModal({ monitor, onClose, onAssigned }: any) {
  const [holders, setHolders]   = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    req("GET", "/admin/holders").then(setHolders).catch(() => {});
  }, []);

  async function assign() {
    if (!selected) return;
    setBusy(true);
    try { await req("POST", `/admin/monitors/${monitor.id}/assignments`, { holderId: selected }); onAssigned(); onClose(); }
    catch(e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:"#0F1117", border:"1px solid #1F2937", borderRadius:12, padding:24, width:360 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>Assign Holder to {monitor.name}</div>
        <label style={S.label}>Select Holder</label>
        <select value={selected} onChange={(e: any)=>setSelected(e.target.value)}
          style={{ ...S.input, marginBottom:16 }}>
          <option value="">— pick holder —</option>
          {holders.map((h: any) => <option key={h.id} value={h.id}>{h.name} ({h.email})</option>)}
        </select>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={S.btn("#1F2937","#9CA3AF")}>Cancel</button>
          <button onClick={assign} disabled={busy || !selected} style={S.btn()}>{busy?"Assigning...":"Assign"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ monitor, onClose, onConfirm }: any) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try { await req("DELETE", `/admin/monitors/${monitor.id}`); onConfirm(); }
    catch(e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
      <div style={{ background:"#0F1117", border:"1px solid #374151", borderRadius:12, padding:28, width:360 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:8, color:"#F9FAFB" }}>Delete monitor?</div>
        <div style={{ fontSize:13, color:"#6B7280", marginBottom:20, lineHeight:1.6 }}>
          This will permanently delete <span style={{ color:"#F9FAFB", fontWeight:600 }}>{monitor.name}</span> and remove all their assignments. This cannot be undone.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={S.btn("#1F2937","#9CA3AF")} disabled={busy}>Cancel</button>
          <button onClick={confirm} style={S.btn("#7F1D1D","#FCA5A5")} disabled={busy}>{busy ? "Deleting..." : "Yes, delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Monitor Card ──────────────────────────────────────────────
function MonitorCard({ monitor, onRefresh, onView }: any) {
  const [expanded, setExpanded]     = useState(false);
  const [holders, setHolders]       = useState<any[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!showSettings) return;
    const close = () => setShowSettings(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showSettings]);

  useEffect(() => {
    if (expanded) {
      req("GET", `/admin/monitors/${monitor.id}/assignments`).then(async (assignments: any[]) => {
        const all = await req("GET", "/admin/holders");
        const assigned = all.filter((h: any) => assignments.some((a: any) => a.holderId === h.id));
        setHolders(assigned);
      }).catch(() => {});
    }
  }, [expanded, monitor.id]);

  return (
    <>
      {showAssign && <AssignModal monitor={monitor} onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); setExpanded(true); onRefresh(); }} />}
      {showDelete && <DeleteConfirmModal monitor={monitor} onClose={() => setShowDelete(false)} onConfirm={() => { setShowDelete(false); onRefresh(); }} />}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ cursor:"pointer", flex:1 }} onClick={() => setExpanded((e: boolean) => !e)}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{monitor.name}</div>
            <div style={{ fontSize:11, color:"#6B7280" }}>{monitor.email}</div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {onView && <button onClick={() => onView(monitor)} style={S.btn("#1A2A40","#93C5FD")}>View Details</button>}
            <button onClick={() => setShowAssign(true)} style={S.btn("#064E3B","#34D399")}>+ Assign Holder</button>
            {/* Settings dropdown */}
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowSettings((s: boolean) => !s)} style={S.btn("#1F2937","#9CA3AF")}>⚙ Settings</button>
              {showSettings && (
                <div style={{ position:"absolute", right:0, top:"110%", background:"#0F1117", border:"1px solid #1F2937", borderRadius:8, padding:6, minWidth:150, zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
                  <div onClick={() => { setShowSettings(false); setShowDelete(true); }}
                    style={{ padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12, color:"#EF4444", display:"flex", alignItems:"center", gap:8 }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background="#1F2937"}
                    onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                    🗑 Delete monitor
                  </div>
                </div>
              )}
            </div>
            <span style={{ cursor:"pointer", color:"#6B7280", fontSize:18, marginLeft:4, lineHeight:1 }} onClick={() => { setExpanded((e: boolean) => !e); setShowSettings(false); }}>
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #1F2937" }}>
            <div style={{ fontSize:10, color:"#6B7280", marginBottom:8 }}>ASSIGNED HOLDERS ({holders.length})</div>
            {holders.length === 0
              ? <div style={{ color:"#6B7280", fontSize:12 }}>No holders assigned yet.</div>
              : holders.map((h: any) => (
                <div key={h.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #111318", fontSize:12 }}>
                  <span style={{ color:"#D1D5DB" }}>{h.name}</span>
                  <span style={{ color:"#6B7280" }}>{h.email}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────
export default function MonitorPanel({ onSelectMonitor }: any) {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [monitorSearch, setMonitorSearch] = useState("");

  const load = useCallback(() => {
    req("GET", "/admin/monitors").then(setMonitors).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredMonitors = monitors.filter((m: any) =>
    m.name.toLowerCase().includes(monitorSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(monitorSearch.toLowerCase())
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
        <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>Monitor Management</span>
      </div>
      <input
        style={{ ...S.input, margin:"20px 0 12px" }}
        placeholder="Search monitors by name or email..."
        value={monitorSearch}
        onChange={(e: any) => setMonitorSearch(e.target.value)}
      />
      <div style={{ fontSize:10, color:"#6B7280", letterSpacing:"1px", marginBottom:12 }}>
        {monitorSearch ? `${filteredMonitors.length} of ${monitors.length}` : monitors.length} MONITOR{monitors.length !== 1 ? "S" : ""}
      </div>
      {filteredMonitors.length === 0
        ? <div style={{ color:"#6B7280", fontSize:12 }}>{monitors.length === 0 ? "No monitor accounts yet." : "No results match your search."}</div>
        : filteredMonitors.map((m: any) => <MonitorCard key={m.id} monitor={m} onRefresh={load} onView={onSelectMonitor} />)
      }
    </div>
  );
}
