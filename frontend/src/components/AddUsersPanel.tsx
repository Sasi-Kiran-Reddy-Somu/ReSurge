import React, { useState, useEffect } from "react";

const C = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", text:"#F9FAFB", muted:"#6B7280", dim:"#374151", sub:"#9CA3AF", red:"#EF4444", green:"#22C55E", purple:"#A78BFA" };

function req(method: string, path: string, body?: any) {
  const token = localStorage.getItem("token");
  return fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    if (!r.ok) { const e = await r.json().catch(() => ({ error: r.statusText })); throw new Error(e.error ?? "Request failed"); }
    return r.json();
  });
}

const ROLE_COLORS: any = { monitor:"#3B82F6", holder:"#22C55E" };
const ROLE_LABELS: any = { monitor:"Monitor", holder:"Holder" };

export default function AddUsersPanel() {
  const [invites,  setInvites]  = useState<any[]>([]);
  const [email,    setEmail]    = useState("");
  const [role,     setRole]     = useState("holder");
  const [err,      setErr]      = useState("");
  const [success,  setSuccess]  = useState("");
  const [busy,     setBusy]     = useState(false);
  const [delBusy,  setDelBusy]  = useState<string | null>(null);

  useEffect(() => { loadInvites(); }, []);

  function loadInvites() {
    req("GET", "/admin/invites").then(setInvites).catch(() => {});
  }

  async function addInvite(e: any) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr(""); setSuccess("");
    try {
      await req("POST", "/admin/invites", { email: email.trim(), role });
      setEmail("");
      setSuccess(`Invite sent — ${email.trim()} can now sign in as ${ROLE_LABELS[role]}`);
      loadInvites();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvite(id: string) {
    setDelBusy(id);
    try { await req("DELETE", `/admin/invites/${id}`); loadInvites(); }
    catch (e: any) { alert(e.message); }
    finally { setDelBusy(null); }
  }

  const inp: any = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontFamily:"inherit", fontSize:13, width:"100%", boxSizing:"border-box", outline:"none" };

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"28px 36px", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ maxWidth:700 }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", fontWeight:600, marginBottom:6 }}>ADD USERS</div>
          <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6 }}>Invite Team Members</div>
          <div style={{ fontSize:13, color:C.muted }}>Add an email and assign a role. When they sign in with Google using that email, they'll have access.</div>
        </div>

        {/* Invite form */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:28, marginBottom:28 }}>
          <form onSubmit={addInvite} style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:14, alignItems:"end" }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:7, fontWeight:600, letterSpacing:"0.05em" }}>EMAIL ADDRESS</label>
                <input type="email" style={inp} value={email} onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="user@example.com" required />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:7, fontWeight:600, letterSpacing:"0.05em" }}>ROLE</label>
                <select value={role} onChange={(e: any) => setRole(e.target.value)}
                  style={{ ...inp, width:"auto", paddingRight:36, cursor:"pointer", appearance:"auto" as any, background:C.surface }}>
                  <option value="holder">Holder</option>
                  <option value="monitor">Monitor</option>
                </select>
              </div>
            </div>
            {err && <div style={{ fontSize:13, color:C.red, background:"#1C0505", border:"1px solid #7F1D1D", borderRadius:7, padding:"10px 14px" }}>{err}</div>}
            {success && <div style={{ fontSize:13, color:C.green, background:"#071A0A", border:"1px solid #14532D", borderRadius:7, padding:"10px 14px" }}>{success}</div>}
            <button type="submit" disabled={busy}
              style={{ background:C.purple, border:"none", borderRadius:8, padding:"12px 28px", color:"#fff", fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, alignSelf:"flex-start", opacity:busy?0.7:1 }}>
              {busy ? "Adding…" : "Add User →"}
            </button>
          </form>
        </div>

        {/* Pending invites */}
        <div>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", fontWeight:600, marginBottom:14 }}>
            PENDING INVITES ({invites.length})
          </div>
          {invites.length === 0 ? (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"40px 24px", textAlign:"center", color:C.dim, fontSize:13 }}>
              No invites yet. Add emails above to give people access.
            </div>
          ) : (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:16, padding:"11px 20px", borderBottom:`1px solid ${C.border}` }}>
                {["EMAIL", "ROLE", ""].map(h => (
                  <div key={h} style={{ fontSize:10, color:C.dim, fontWeight:700, letterSpacing:"0.08em" }}>{h}</div>
                ))}
              </div>
              {invites.map(inv => (
                <div key={inv.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:16, padding:"14px 20px", borderBottom:`1px solid ${C.border}18`, alignItems:"center" }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
                  onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{inv.email}</div>
                  <span style={{ fontSize:11, color:ROLE_COLORS[inv.role], background:ROLE_COLORS[inv.role]+"18", padding:"4px 12px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap" as const }}>
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                  <button onClick={() => deleteInvite(inv.id)} disabled={delBusy === inv.id}
                    style={{ background:"none", border:"1px solid #7F1D1D", color:C.red, cursor:"pointer", fontFamily:"inherit", fontSize:11, padding:"5px 12px", borderRadius:6, fontWeight:600, opacity:delBusy===inv.id?0.5:1, whiteSpace:"nowrap" as const }}>
                    {delBusy === inv.id ? "…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
