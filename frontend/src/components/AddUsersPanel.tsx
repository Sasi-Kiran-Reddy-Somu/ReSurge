import React, { useState, useEffect, useRef } from "react";

const C = { bg:"#0D0F16", surface:"#0F1117", border:"#1F2937", text:"#F9FAFB", muted:"#6B7280", dim:"#374151", sub:"#9CA3AF", red:"#EF4444", green:"#22C55E", purple:"#A78BFA", blue:"#3B82F6" };

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

const ROLE_COLORS: any   = { monitor:C.blue, holder:C.green, main:"#F59E0B" };
const ROLE_LABELS: any   = { monitor:"Monitor", holder:"Holder", main:"Admin" };
const ROLE_OPTIONS = ["holder", "monitor", "main"];

function SettingsDropdown({ user, onRoleChange, onDelete }: { user: any; onRoleChange: (id: string, role: string) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowRoles(false); }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => { setOpen(o => !o); setShowRoles(false); }}
        style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, width:30, height:30, cursor:"pointer", color:C.sub, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
        ⚙
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, bottom:36, background:"#13161F", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", zIndex:100, minWidth:160, boxShadow:"0 8px 32px #00000080" }}>
          {!showRoles ? (
            <>
              <div onClick={() => setShowRoles(true)}
                style={{ padding:"11px 16px", cursor:"pointer", fontSize:12, color:C.sub, display:"flex", alignItems:"center", gap:8 }}
                onMouseEnter={(e: any) => e.currentTarget.style.background="#1F2937"}
                onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                <span>🔄</span> Change Role
              </div>
              <div style={{ height:1, background:C.border }} />
              <div onClick={() => { setOpen(false); onDelete(user.id); }}
                style={{ padding:"11px 16px", cursor:"pointer", fontSize:12, color:C.red, display:"flex", alignItems:"center", gap:8 }}
                onMouseEnter={(e: any) => e.currentTarget.style.background="#1C0505"}
                onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                <span>🗑</span> Delete User
              </div>
            </>
          ) : (
            <>
              <div style={{ padding:"8px 16px 6px", fontSize:10, color:C.muted, fontWeight:700, letterSpacing:"0.08em" }}>SELECT ROLE</div>
              {ROLE_OPTIONS.map(r => (
                <div key={r} onClick={() => { setOpen(false); setShowRoles(false); onRoleChange(user.id, r); }}
                  style={{ padding:"10px 16px", cursor:"pointer", fontSize:12, color:ROLE_COLORS[r], background:"transparent", display:"flex", alignItems:"center", gap:8 }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background="#1F2937"}
                  onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                  {ROLE_LABELS[r]}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsersPanel() {
  const [tab, setTab] = useState<"invite" | "current">("invite");

  // Invite state
  const [invites,  setInvites]  = useState<any[]>([]);
  const [email,    setEmail]    = useState("");
  const [role,     setRole]     = useState("holder");
  const [err,      setErr]      = useState("");
  const [success,  setSuccess]  = useState("");
  const [busy,     setBusy]     = useState(false);
  const [delBusy,  setDelBusy]  = useState<string | null>(null);

  // Current users state
  const [allUsers,    setAllUsers]    = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [deleting,     setDeleting]    = useState<string | null>(null);

  useEffect(() => { loadInvites(); loadUsers(); }, []);

  function loadInvites() {
    req("GET", "/admin/invites").then(setInvites).catch(() => {});
  }

  function loadUsers() {
    setUsersLoading(true);
    req("GET", "/admin/users").then(setAllUsers).catch(() => {}).finally(() => setUsersLoading(false));
  }

  async function addInvite(e: any) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr(""); setSuccess("");
    try {
      await req("POST", "/admin/invites", { email: email.trim(), role });
      setEmail("");
      setSuccess(`Invite sent to ${email.trim()} — they'll receive an email and can sign in as ${ROLE_LABELS[role]}`);
      loadInvites();
      setTimeout(() => setSuccess(""), 5000);
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

  async function changeRole(id: string, newRole: string) {
    setRoleChanging(id);
    try { await req("PATCH", `/admin/users/${id}`, { role: newRole }); loadUsers(); }
    catch (e: any) { alert(e.message); }
    finally { setRoleChanging(null); }
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeleting(id);
    try { await req("DELETE", `/admin/users/${id}`); loadUsers(); }
    catch (e: any) { alert(e.message); }
    finally { setDeleting(null); }
  }

  const inp: any = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontFamily:"inherit", fontSize:13, width:"100%", boxSizing:"border-box", outline:"none" };
  const tabStyle = (active: boolean): any => ({
    padding:"8px 20px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:active?700:400,
    color:active?C.text:C.sub, background:active?"#1F2937":"transparent", border:"none", fontFamily:"inherit",
  });

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"28px 36px", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ maxWidth:760 }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", fontWeight:600, marginBottom:6 }}>USERS</div>
          <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6 }}>User Management</div>
          <div style={{ fontSize:13, color:C.muted }}>Invite new members or manage existing accounts.</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:"#0F1117", border:`1px solid ${C.border}`, borderRadius:10, padding:4, width:"fit-content" }}>
          <button style={tabStyle(tab === "invite")}  onClick={() => setTab("invite")}>Invite Users</button>
          <button style={tabStyle(tab === "current")} onClick={() => setTab("current")}>Current Users ({allUsers.length})</button>
        </div>

        {/* ── INVITE TAB ── */}
        {tab === "invite" && (
          <>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:28, marginBottom:24 }}>
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
                      <option value="main">Admin</option>
                    </select>
                  </div>
                </div>
                {err && <div style={{ fontSize:13, color:C.red, background:"#1C0505", border:"1px solid #7F1D1D", borderRadius:7, padding:"10px 14px" }}>{err}</div>}
                {success && <div style={{ fontSize:13, color:C.green, background:"#071A0A", border:"1px solid #14532D", borderRadius:7, padding:"10px 14px" }}>✓ {success}</div>}
                <button type="submit" disabled={busy}
                  style={{ background:C.purple, border:"none", borderRadius:8, padding:"12px 28px", color:"#fff", fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, alignSelf:"flex-start", opacity:busy?0.7:1 }}>
                  {busy ? "Sending…" : "Send Invite →"}
                </button>
              </form>
            </div>

            <div>
              <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", fontWeight:600, marginBottom:14 }}>
                PENDING INVITES ({invites.length})
              </div>
              {invites.length === 0 ? (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"36px 24px", textAlign:"center", color:C.dim, fontSize:13 }}>
                  No invites yet. Send an invite above to give someone access.
                </div>
              ) : (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:16, padding:"11px 20px", borderBottom:`1px solid ${C.border}` }}>
                    {["EMAIL", "ROLE", "INVITED", ""].map(h => (
                      <div key={h} style={{ fontSize:10, color:C.dim, fontWeight:700, letterSpacing:"0.08em" }}>{h}</div>
                    ))}
                  </div>
                  {invites.map(inv => (
                    <div key={inv.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:16, padding:"14px 20px", borderBottom:`1px solid ${C.border}18`, alignItems:"center" }}
                      onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
                      onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                      <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{inv.email}</div>
                      <span style={{ fontSize:11, color:ROLE_COLORS[inv.role], background:ROLE_COLORS[inv.role]+"18", padding:"4px 12px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap" as const }}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                      <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" as const }}>
                        {new Date(inv.invitedAt).toLocaleDateString()}
                      </span>
                      <button onClick={() => deleteInvite(inv.id)} disabled={delBusy === inv.id}
                        style={{ background:"none", border:`1px solid #7F1D1D`, color:C.red, cursor:"pointer", fontFamily:"inherit", fontSize:11, padding:"5px 12px", borderRadius:6, fontWeight:600, opacity:delBusy===inv.id?0.5:1, whiteSpace:"nowrap" as const }}>
                        {delBusy === inv.id ? "…" : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CURRENT USERS TAB ── */}
        {tab === "current" && (
          <div>
            {usersLoading ? (
              <div style={{ color:C.muted, fontSize:13, padding:20 }}>Loading…</div>
            ) : allUsers.length === 0 ? (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"36px 24px", textAlign:"center", color:C.dim, fontSize:13 }}>
                No users yet.
              </div>
            ) : (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:16, padding:"11px 20px", borderBottom:`1px solid ${C.border}` }}>
                  {["NAME / EMAIL", "ROLE", "JOINED", ""].map(h => (
                    <div key={h} style={{ fontSize:10, color:C.dim, fontWeight:700, letterSpacing:"0.08em" }}>{h}</div>
                  ))}
                </div>
                {allUsers.map(u => {
                  const isBusy = roleChanging === u.id || deleting === u.id;
                  const userRole = u.role ?? (u.roles?.[0]);
                  return (
                    <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:16, padding:"14px 20px", borderBottom:`1px solid ${C.border}18`, alignItems:"center", opacity:isBusy?0.5:1 }}
                      onMouseEnter={(e: any) => e.currentTarget.style.background="#13161F"}
                      onMouseLeave={(e: any) => e.currentTarget.style.background="transparent"}>
                      <div>
                        <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{u.name || "—"}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{u.email}</div>
                      </div>
                      <span style={{ fontSize:11, color:ROLE_COLORS[userRole] ?? C.sub, background:(ROLE_COLORS[userRole] ?? C.sub)+"18", padding:"4px 12px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap" as const }}>
                        {ROLE_LABELS[userRole] ?? userRole}
                      </span>
                      <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" as const }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </span>
                      <SettingsDropdown user={u} onRoleChange={changeRole} onDelete={deleteUser} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
