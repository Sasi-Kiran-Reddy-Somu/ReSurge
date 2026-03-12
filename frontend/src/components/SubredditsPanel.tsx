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

const C: any = {
  bg: "#0D0F16", surface: "#0F1117", border: "#1F2937",
  text: "#F9FAFB", sub: "#9CA3AF", muted: "#6B7280", dim: "#374151",
  accent: "#FF4500", green: "#22C55E", amber: "#F59E0B", red: "#EF4444", blue: "#3B82F6",
};

function StatBox({ label, value, color = C.sub, unit = "" }: any) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}<span style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginLeft: 4 }}>{unit}</span></div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel="Confirm", onConfirm, onCancel, busy }: any) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99998, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onCancel}>
      <div style={{ background:"#0F1117", border:"1px solid #374151", borderRadius:14, padding:"28px 32px", width:420, boxShadow:"0 20px 60px #000000aa" }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ fontSize:18, fontWeight:800, color:"#F9FAFB", marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:13, color:"#9CA3AF", marginBottom:24, lineHeight:1.6 }}>{message}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ background:"#1F2937", color:"#9CA3AF", border:"1px solid #374151", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ background:"#7F1D1D", color:"#FCA5A5", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:busy?0.6:1 }}>
            {busy ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubredditDetail({ sub, onBack, onRemove, onToggleVisibility }: any) {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setLoadingStats(true);
    req("GET", `/subreddits/${sub.name}/stats`)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [sub.name]);

  async function handleToggleVisibility() {
    setToggling(true);
    try {
      await onToggleVisibility(sub.name, !stats.visibleToHolders);
      setStats((s: any) => ({ ...s, visibleToHolders: !s.visibleToHolders }));
    } finally { setToggling(false); }
  }

  async function handleRemove() {
    setRemoving(true);
    try { await onRemove(sub.name); setConfirmRemove(false); }
    catch (e: any) { alert(e.message ?? "Remove failed"); setConfirmRemove(false); }
    finally { setRemoving(false); }
  }

  const visible = stats?.visibleToHolders ?? true;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {confirmRemove && (
        <ConfirmModal
          title={`Remove r/${sub.name}?`}
          message="This will stop tracking this subreddit and remove it from the sidebar. All existing notification history is preserved and holders already subscribed will still have it in their history."
          confirmLabel="Yes, Remove"
          busy={removing}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {/* Header */}
      <div style={{ padding: "22px 32px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "#1F2937", color: C.sub, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>r/</div>
              <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 800, fontSize: 22, color: C.text }}>{sub.name}</span>
              <a href={`https://reddit.com/r/${sub.name}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.muted, textDecoration: "none" }}>↗ open</a>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Added {new Date(sub.addedAt).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleToggleVisibility} disabled={toggling || loadingStats}
            style={{ background: visible ? "#0A1A0A" : "#1F1014", color: visible ? C.green : C.red, border: `1px solid ${visible ? "#14532D" : "#7F1D1D"}`, borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: toggling ? 0.6 : 1 }}>
            {toggling ? "Updating…" : visible ? "👁 Visible to holders" : "🚫 Hidden from holders"}
          </button>
          <button onClick={() => setConfirmRemove(true)}
            style={{ background: "#1F1014", color: C.red, border: `1px solid #7F1D1D`, borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Remove
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {loadingStats ? (
          <div style={{ color: C.muted, fontSize: 13 }}>Loading stats…</div>
        ) : stats ? (
          <>
            <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>STATISTICS</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 32 }}>
              <StatBox label="Holders subscribed" value={stats.subscriberCount} color={C.blue} />
              <StatBox label="Avg alerts / day" value={stats.avgNotifiedPerDay} color={C.amber} unit="posts" />
              <StatBox label="Avg comments posted / day" value={stats.avgPostedPerDay} color={C.green} unit="posts" />
              <StatBox label="Total alerts ever" value={stats.totalAlerted} color={C.sub} />
            </div>

            <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>SETTINGS</div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Visibility row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Visible to holders</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {visible
                      ? "Holders can see and subscribe to this subreddit in their account setup."
                      : "This subreddit is hidden from holders. Existing subscriptions still receive notifications."}
                  </div>
                </div>
                <button onClick={handleToggleVisibility} disabled={toggling}
                  style={{ background: visible ? C.green : "#374151", border: "none", borderRadius: 20, width: 48, height: 26, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 20, opacity: toggling ? 0.6 : 1 }}>
                  <div style={{ position: "absolute", top: 3, left: visible ? 25 : 3, width: 20, height: 20, background: "#fff", borderRadius: "50%", transition: "left 0.2s" }} />
                </button>
              </div>
              {/* Remove row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 4 }}>Remove subreddit</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Stops tracking and removes from the sidebar. Existing notification history is preserved.</div>
                </div>
                <button onClick={() => setConfirmRemove(true)}
                  style={{ background: "#1F1014", color: C.red, border: `1px solid #7F1D1D`, borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 20 }}>
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: C.red, fontSize: 13 }}>Failed to load stats.</div>
        )}
      </div>
    </div>
  );
}

function fireToast(msg: string) {
  const old = document.getElementById("__sub_toast__");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "__sub_toast__";
  el.style.cssText = "position:fixed;bottom:32px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1A2F1A;border:1px solid #22C55E99;border-radius:10px;padding:14px 28px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 40px #000000cc;font-family:'IBM Plex Sans',sans-serif;pointer-events:none;white-space:nowrap;";
  el.innerHTML = `<span style="font-size:18px">✅</span><span style="font-size:13px;color:#86EFAC;font-weight:600">${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
}

export default function SubredditsPanel({ subreddits: initialSubs, onSubredditRemoved, onSubredditAdded, showToast }: any) {
  const [subs, setSubs] = useState<any[]>(initialSubs ?? []);
  const [selected, setSelected] = useState<any>(null);
  const [input, setInput] = useState("");
  const [addErr, setAddErr] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, { s1: number; s2: number; s3: number }>>({});

  // Keep in sync when parent prop changes
  useEffect(() => { setSubs(initialSubs ?? []); }, [initialSubs]);

  // Fetch live stack counts for all subreddits
  const refreshCounts = useCallback(async (subList: any[]) => {
    if (subList.length === 0) return;
    const results = await Promise.allSettled(
      subList.map((s: any) => req("GET", `/posts/${s.name}/counts`).then((c: any) => ({ name: s.name, c })))
    );
    const next: Record<string, { s1: number; s2: number; s3: number }> = {};
    for (const r of results) {
      if (r.status === "fulfilled") next[r.value.name] = r.value.c;
    }
    setCounts(next);
  }, []);

  useEffect(() => { refreshCounts(subs); }, [subs, refreshCounts]);

  // Refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => refreshCounts(subs), 15_000);
    return () => clearInterval(interval);
  }, [subs, refreshCounts]);

  const filtered = subs.filter((s: any) => s.name.includes(search.toLowerCase()));

  async function handleAdd() {
    const names = input
      .split(/[\s,]+/)
      .map((n: string) => n.replace(/^r\//, "").trim().toLowerCase())
      .filter(Boolean);
    if (names.length === 0) return;
    setAddBusy(true); setAddErr("");
    const errors: string[] = [];
    const added: any[] = [];
    for (const name of names) {
      try {
        const result = await req("POST", "/subreddits", { name });
        added.push(result);
        setSubs((p: any[]) => [...p, result]);
        if (onSubredditAdded) onSubredditAdded(result);
      } catch (e: any) { errors.push(`r/${name}: ${e.message}`); }
    }
    setInput("");
    if (added.length > 0) {
      fireToast(added.length === 1
        ? `r/${added[0].name} has been added and is now being tracked.`
        : `${added.length} subreddits added successfully.`);
    }
    if (errors.length > 0) setAddErr(errors.join(" · "));
    setAddBusy(false);
  }

  async function handleRemove(name: string) {
    await req("DELETE", `/subreddits/${encodeURIComponent(name)}`);
    setSubs((p: any[]) => p.filter((s: any) => s.name !== name));
    setSelected(null);
    if (onSubredditRemoved) onSubredditRemoved(name);
  }

  async function handleToggleVisibility(name: string, visible: boolean) {
    await req("PATCH", `/subreddits/${name}/visibility`, { visibleToHolders: visible });
    setSubs((p: any[]) => p.map((s: any) => s.name === name ? { ...s, visibleToHolders: visible } : s));
  }

  const selSub = selected ? subs.find((s: any) => s.name === selected) ?? null : null;

  if (selSub) {
    return (
      <SubredditDetail
        sub={selSub}
        onBack={() => setSelected(null)}
        onRemove={handleRemove}
        onToggleVisibility={handleToggleVisibility}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "22px 32px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 700, fontSize: 18, color: C.text }}>⚙️ Manage Subreddits</span>
            <span style={{ fontSize: 11, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 10 }}>{subs.length} tracked</span>
          </div>
        </div>
        {/* Add + search row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search subreddits…"
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
          <input value={input} onChange={(e: any) => setInput(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && handleAdd()} placeholder="r/sub1, r/sub2, …"
            style={{ width: 220, background: C.surface, border: `1px solid ${addErr ? C.red : C.border}`, borderRadius: 8, padding: "9px 14px", color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
          <button onClick={handleAdd} disabled={addBusy}
            style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {addBusy ? "Adding…" : "+ Add"}
          </button>
        </div>
        {addErr && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{addErr}</div>}
      </div>

      {/* Subreddits table */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {filtered.length === 0 ? (
          <div style={{ border: "1px dashed #1F2937", borderRadius: 10, padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {subs.length === 0 ? "No subreddits tracked yet. Add one above." : "No results match your search."}
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", padding: "0 0 10px 16px" }}>SUBREDDIT</th>
                <th style={{ textAlign: "center", fontSize: 10, color: "#6B7280", fontWeight: 600, letterSpacing: "0.08em", padding: "0 0 10px" }}>S1</th>
                <th style={{ textAlign: "center", fontSize: 10, color: "#3B82F6", fontWeight: 600, letterSpacing: "0.08em", padding: "0 0 10px" }}>S2</th>
                <th style={{ textAlign: "center", fontSize: 10, color: "#F59E0B", fontWeight: 600, letterSpacing: "0.08em", padding: "0 0 10px" }}>S3</th>
                <th style={{ textAlign: "right", fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", padding: "0 16px 10px 0" }}>ADDED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub: any, i: number) => {
                const c = counts[sub.name];
                return (
                  <tr key={sub.name} onClick={() => setSelected(sub.name)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.background = "#13161F"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "14px 0 14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 26, height: 26, background: C.accent, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>r/</div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{sub.name}</span>
                        {!sub.visibleToHolders && (
                          <span style={{ fontSize: 9, background: "#1F1014", color: C.red, border: `1px solid #7F1D1D`, padding: "2px 6px", borderRadius: 8, fontWeight: 600, letterSpacing: "0.04em" }}>HIDDEN</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 8px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#6B7280" }}>{c ? c.s1 : "—"}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 8px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6" }}>{c ? c.s2 : "—"}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "14px 8px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>{c ? c.s3 : "—"}</span>
                    </td>
                    <td style={{ textAlign: "right", padding: "14px 16px 14px 0", fontSize: 11, color: C.muted }}>
                      {new Date(sub.addedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
