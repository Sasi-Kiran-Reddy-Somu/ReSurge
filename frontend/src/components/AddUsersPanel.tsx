import React, { useState, useEffect, useRef } from "react";

const C = {
  bg: "#0D0F16", surface: "#0F1117", border: "#1F2937",
  text: "#F9FAFB", muted: "#6B7280", dim: "#374151", sub: "#9CA3AF",
  red: "#EF4444", green: "#22C55E", purple: "#A78BFA", blue: "#3B82F6",
  amber: "#F59E0B", orange: "#F97316",
};

async function req(method: string, path: string, body?: any) {
  const token = localStorage.getItem("token");
  let r: Response;
  try {
    r = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr: any) {
    throw new Error("Network error — backend unreachable: " + networkErr.message);
  }
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Server returned non-JSON (${r.status}): ${text.slice(0, 200)}`); }
  if (r.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user_data"); window.location.reload(); throw new Error("Session expired"); }
  if (!r.ok) {
    const err: any = new Error(json.error ?? `Request failed (${r.status})`);
    err.code = json.code;
    err.existingRole = json.existingRole;
    throw err;
  }
  return json;
}

const ROLE_COLORS: any = { monitor: C.blue, holder: "#14B8A6", main: "#FF4500" };
const ROLE_LABELS: any = { monitor: "Monitor", holder: "Holder", main: "Admin" };
const ROLE_OPTIONS = ["holder", "monitor", "main"];

const STATUS_COLOR: any  = { invited: C.amber, active: C.green, inactive: C.orange, deleted: C.muted };
const STATUS_LABEL: any  = { invited: "INVITED", active: "ACTIVE", inactive: "INACTIVE", deleted: "DELETED" };

function timeAgo(ts: any) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60)    return `${Math.round(d)}s ago`;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

type RowAction = "resend" | "deactivate" | "activate" | "delete" | "role";

function ActionsMenu({ row, onAction, busy }: { row: any; onAction: (action: RowAction, extra?: any) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [roleMenu, setRoleMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setOpen(false); setRoleMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function toggleMenu() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(o => !o); setRoleMenu(false);
  }

  if (busy) return <span style={{ fontSize: 12, color: C.muted }}>…</span>;
  if (row.status === "deleted") return <span style={{ fontSize: 11, color: C.dim }}>—</span>;

  return (
    <div style={{ position: "relative" }}>
      <button ref={btnRef} onClick={toggleMenu}
        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, width: 30, height: 30, cursor: "pointer", color: C.sub, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
        ⚙
      </button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, background: "#13161F", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", zIndex: 9999, minWidth: 170, boxShadow: "0 8px 32px #00000080" }}>
          {!roleMenu ? (
            <>
              {/* Resend invite — for invited and active */}
              {(row.status === "invited" || row.status === "active") && (
                <MenuItem icon="📨" label="Resend Invite" color={C.sub} onClick={() => { setOpen(false); onAction("resend"); }} />
              )}
              {/* Role change — for active and inactive users */}
              {row.type === "user" && row.status !== "deleted" && (
                <MenuItem icon="🔄" label="Change Role" color={C.sub} onClick={() => setRoleMenu(true)} />
              )}
              {/* Deactivate — active users only */}
              {row.status === "active" && (
                <MenuItem icon="⏸" label="Deactivate" color={C.amber} onClick={() => { setOpen(false); onAction("deactivate"); }} />
              )}
              {/* Activate — inactive users only */}
              {row.status === "inactive" && (
                <MenuItem icon="▶" label="Activate" color={C.green} onClick={() => { setOpen(false); onAction("activate"); }} />
              )}
              {/* Delete */}
              {row.type === "user" && (
                <>
                  <div style={{ height: 1, background: C.border }} />
                  <MenuItem icon="🗑" label="Delete User" color={C.red} onClick={() => { setOpen(false); onAction("delete"); }} />
                </>
              )}
              {row.type === "invite" && (
                <>
                  <div style={{ height: 1, background: C.border }} />
                  <MenuItem icon="✕" label="Remove Invite" color={C.red} onClick={() => { setOpen(false); onAction("delete"); }} />
                </>
              )}
            </>
          ) : (
            <>
              <div style={{ padding: "8px 16px 6px", fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: "0.08em" }}>SELECT ROLE</div>
              {ROLE_OPTIONS.map(r => (
                <MenuItem key={r} label={ROLE_LABELS[r]} color={ROLE_COLORS[r]} onClick={() => { setOpen(false); setRoleMenu(false); onAction("role", r); }} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, color, onClick }: { icon?: string; label: string; color: string; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{ padding: "11px 16px", cursor: "pointer", fontSize: 12, color, display: "flex", alignItems: "center", gap: 8 }}
      onMouseEnter={(e: any) => e.currentTarget.style.background = "#1F2937"}
      onMouseLeave={(e: any) => e.currentTarget.style.background = "transparent"}>
      {icon && <span>{icon}</span>}{label}
    </div>
  );
}

export default function UsersPanel({ onSelectHolder, onAckChange }: { onSelectHolder?: (h: any) => void; onAckChange?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sign-up alerts
  const [signupAlerts, setSignupAlerts] = useState<any>({ newSignups: [], total: 0 });
  const [acking, setAcking] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("holder");
  const [busy, setBusy] = useState(false);

  // Status banners
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // Per-row busy states
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  // Search / filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal for errors with context
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);

  function loadAll() {
    setLoading(true);
    Promise.all([
      req("GET", "/admin/all-users").catch(() => null),
      req("GET", "/admin/alerts").catch(() => ({ newSignups: [], total: 0 })),
    ]).then(async ([allRows, alerts]) => {
      if (allRows) {
        setRows(allRows);
      } else {
        // Fallback: stitch together from old endpoints (Railway not yet redeployed)
        const [rawUsers, rawInvites] = await Promise.all([
          req("GET", "/admin/users").catch(() => []),
          req("GET", "/admin/invites").catch(() => []),
        ]);
        const users = (rawUsers as any[]).map((u: any) => ({
          ...u, type: "user",
          status: u.isDeleted ? "deleted" : u.isActive === false ? "inactive" : "active",
          date: u.createdAt,
        }));
        const invites = (rawInvites as any[]).map((i: any) => ({
          ...i, type: "invite", status: "invited", date: i.invitedAt ?? i.createdAt,
        }));
        setRows([...invites, ...users]);
      }
      setSignupAlerts(alerts ?? { newSignups: [], total: 0 });
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  async function ack(userId: string) {
    setAcking(userId);
    try {
      await req("POST", `/admin/alerts/ack/${userId}`);
      setSignupAlerts((prev: any) => ({ ...prev, newSignups: prev.newSignups.filter((u: any) => u.id !== userId), total: prev.total - 1 }));
      onAckChange?.();
    } catch {} finally { setAcking(null); }
  }

  async function ackAll() {
    setAcking("all");
    try {
      await req("POST", "/admin/alerts/ack-all");
      setSignupAlerts({ newSignups: [], total: 0 });
      onAckChange?.();
    } catch {} finally { setAcking(null); }
  }

  async function sendInvite(e: any) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr(""); setSuccess("");
    try {
      await req("POST", "/admin/invites", { email: email.trim(), role });
      setEmail("");
      setSuccess(`Invite sent to ${email.trim()} as ${ROLE_LABELS[role]}`);
      loadAll();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      if (err.code === "USER_EXISTS_SAME_ROLE") {
        setModal({ title: "User already exists", message: `${email.trim()} is already a ${ROLE_LABELS[role] ?? role}.` });
      } else if (err.code === "USER_EXISTS_DIFF_ROLE") {
        setModal({ title: "User already exists", message: `${email.trim()} is already signed up as ${ROLE_LABELS[err.existingRole] ?? err.existingRole}.` });
      } else if (err.code === "INVITE_EXISTS") {
        setModal({ title: "Invite already sent", message: `An invite is already pending for ${email.trim()}. Resend or remove it from the list below.` });
      } else {
        setErr(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(row: any, action: RowAction, extra?: any) {
    const id = row.id;
    setRowBusy(b => ({ ...b, [id]: true }));
    setErr(""); setSuccess("");
    try {
      if (action === "resend") {
        if (row.type === "invite") await req("POST", `/admin/invites/${id}/resend`);
        else await req("POST", `/admin/users/${id}/resend-invite`);
        setSuccess(`Invite email resent to ${row.email}`);
      } else if (action === "deactivate") {
        if (!confirm(`Deactivate ${row.email}? They will be logged out immediately.`)) return;
        await req("PATCH", `/admin/users/${id}`, { action: "deactivate" });
        setSuccess(`${row.email} deactivated.`);
        loadAll();
      } else if (action === "activate") {
        await req("PATCH", `/admin/users/${id}`, { action: "activate" });
        setSuccess(`${row.email} reactivated.`);
        loadAll();
      } else if (action === "delete") {
        const msg = row.type === "invite"
          ? `Remove the pending invite for ${row.email}?`
          : `Delete ${row.email}? They will be logged out immediately. Data is preserved.`;
        if (!confirm(msg)) return;
        if (row.type === "invite") await req("DELETE", `/admin/invites/${id}`);
        else await req("DELETE", `/admin/users/${id}`);
        setSuccess(row.type === "invite" ? "Invite removed." : `${row.email} deleted.`);
        loadAll();
      } else if (action === "role") {
        await req("PATCH", `/admin/users/${id}`, { role: extra });
        setSuccess(`Role updated to ${ROLE_LABELS[extra] ?? extra}`);
        loadAll();
      }
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setRowBusy(b => ({ ...b, [id]: false }));
    }
  }

  const ROLE_BG: any = { holder: "#071A0A", monitor: "#0D1626", main: "#1C0800" };
  const ROLE_COLOR: any = { holder: "#22C55E", monitor: "#3B82F6", main: "#FF4500" };

  const inp: any = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none" };

  // Filter rows
  const filtered = rows.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.email?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = { invited: 0, active: 0, inactive: 0, deleted: 0 };
  rows.forEach(r => { if (counts[r.status as keyof typeof counts] !== undefined) counts[r.status as keyof typeof counts]++; });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px", fontFamily: "'IBM Plex Sans',sans-serif" }}>
      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 24 }}>
          <div style={{ background: "#0F1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 12 }}>{modal.title}</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 24 }}>{modal.message}</div>
            <button onClick={() => setModal(null)} style={{ background: "#1F2937", border: "none", borderRadius: 8, padding: "10px 20px", color: C.sub, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>OK</button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 820 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", fontWeight: 600, marginBottom: 6 }}>USERS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>User Management</div>
        </div>

        {/* Global banners */}
        {err && (
          <div style={{ marginBottom: 16, fontSize: 13, color: C.red, background: "#1C0505", border: `1px solid #7F1D1D`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠ {err}</span><span onClick={() => setErr("")} style={{ cursor: "pointer", opacity: 0.7, marginLeft: 16 }}>✕</span>
          </div>
        )}
        {success && !err && (
          <div style={{ marginBottom: 16, fontSize: 13, color: C.green, background: "#071A0A", border: `1px solid #14532D`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>✓ {success}</span><span onClick={() => setSuccess("")} style={{ cursor: "pointer", opacity: 0.7, marginLeft: 16 }}>✕</span>
          </div>
        )}

        {/* ── Sign-up Alerts (inline at top) ── */}
        {signupAlerts.newSignups?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em" }}>NEW SIGN-UPS</span>
                <span style={{ background: C.red, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{signupAlerts.newSignups.length}</span>
              </div>
              {signupAlerts.newSignups.length > 1 && (
                <button onClick={ackAll} disabled={acking === "all"}
                  style={{ background: "#1F2937", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 11, color: C.sub, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {acking === "all" ? "Clearing…" : "Mark all seen"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signupAlerts.newSignups.map((u: any) => (
                <div key={u.id} style={{ background: "#0F1117", border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ background: ROLE_BG[u.role] ?? "#111", border: `1px solid ${(ROLE_COLOR[u.role] ?? "#6B7280")}40`, borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLOR[u.role] ?? "#6B7280", textTransform: "capitalize" }}>{u.role}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{u.email} · signed up {timeAgo(u.createdAt)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {u.role === "holder" && onSelectHolder && (
                      <button onClick={() => { ack(u.id); onSelectHolder(u); }}
                        style={{ background: C.green, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 11, fontWeight: 700, color: "#000", cursor: "pointer", fontFamily: "inherit" }}>
                        View Profile
                      </button>
                    )}
                    <button onClick={() => ack(u.id)} disabled={acking === u.id}
                      style={{ background: "#1F2937", border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 14px", fontSize: 11, color: C.sub, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {acking === u.id ? "…" : "Dismiss"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invite form ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", marginBottom: 14 }}>SEND INVITE</div>
          <form onSubmit={sendInvite} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>EMAIL ADDRESS</label>
              <input type="email" style={{ ...inp, width: "100%", boxSizing: "border-box" as any }} value={email}
                onChange={(e: any) => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div style={{ flexShrink: 0 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>ROLE</label>
              <select value={role} onChange={(e: any) => setRole(e.target.value)}
                style={{ ...inp, paddingRight: 36, cursor: "pointer", appearance: "auto" as any }}>
                <option value="holder">Holder</option>
                <option value="monitor">Monitor</option>
                <option value="main">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={busy}
              style={{ background: C.purple, border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13, opacity: busy ? 0.7 : 1, flexShrink: 0 }}>
              {busy ? "Sending…" : "Send Invite →"}
            </button>
          </form>
        </div>

        {/* ── Unified users table ── */}
        <div>
          {/* Search + filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ flex: "1 1 180px", ...inp, padding: "8px 14px" }}
              placeholder="Search by name or email…" value={search} onChange={(e: any) => setSearch(e.target.value)} />
            <div style={{ display: "flex", gap: 4 }}>
              {[["all", "All"], ["invited", "Invited"], ["active", "Active"], ["inactive", "Inactive"], ["deleted", "Deleted"]].map(([k, l]) => {
                const cnt = k === "all" ? rows.length : counts[k as keyof typeof counts];
                const active = statusFilter === k;
                const col = k === "all" ? C.text : STATUS_COLOR[k] ?? C.sub;
                return (
                  <button key={k} onClick={() => setStatusFilter(k)}
                    style={{ background: active ? col + "18" : "none", border: active ? `1px solid ${col}40` : `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: active ? 700 : 500, color: active ? col : C.muted, whiteSpace: "nowrap" as const }}>
                    {l} {cnt > 0 && <span style={{ opacity: 0.7 }}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "36px 24px", textAlign: "center", color: C.dim, fontSize: 13 }}>
              {search || statusFilter !== "all" ? "No users match your filters." : "No users yet. Send an invite above."}
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px 110px 40px", gap: 16, padding: "11px 20px", borderBottom: `1px solid ${C.border}` }}>
                {["NAME / EMAIL", "ROLE", "STATUS", "DATE", ""].map(h => (
                  <div key={h} style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: "0.08em" }}>{h}</div>
                ))}
              </div>
              {filtered.map((row: any) => {
                const sc = STATUS_COLOR[row.status] ?? C.sub;
                const isBusy = !!rowBusy[row.id];
                const userRole = row.role ?? row.roles?.[0];
                return (
                  <div key={`${row.type}-${row.id}`}
                    style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px 110px 40px", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${C.border}18`, alignItems: "center", opacity: isBusy ? 0.5 : 1, transition: "background 0.1s" }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background = "#13161F"}
                    onMouseLeave={(e: any) => e.currentTarget.style.background = "transparent"}>
                    <div style={{ minWidth: 0 }}>
                      {row.name
                        ? <><div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{row.name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{row.email}</div></>
                        : <div style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{row.email}</div>
                      }
                    </div>
                    <span style={{ fontSize: 11, color: ROLE_COLORS[userRole] ?? C.sub, background: (ROLE_COLORS[userRole] ?? C.sub) + "18", padding: "4px 10px", borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap" as const, textAlign: "center" }}>
                      {ROLE_LABELS[userRole] ?? userRole}
                    </span>
                    <span style={{ fontSize: 11, color: sc, background: sc + "18", padding: "4px 10px", borderRadius: 20, fontWeight: 700, whiteSpace: "nowrap" as const, textAlign: "center", letterSpacing: "0.03em" }}>
                      {STATUS_LABEL[row.status] ?? row.status.toUpperCase()}
                    </span>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {row.date ? new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </div>
                    <ActionsMenu row={row} onAction={(action, extra) => handleAction(row, action, extra)} busy={isBusy} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
