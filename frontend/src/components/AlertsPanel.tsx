import React, { useState, useEffect } from "react";

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

function timeAgo(ts: any) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60)    return `${Math.round(d)}s ago`;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

const ROLE_COLOR: any = { holder: "#22C55E", monitor: "#3B82F6", main: "#FF4500" };
const ROLE_BG: any    = { holder: "#071A0A", monitor: "#0D1626", main: "#1C0800" };

export default function AlertsPanel({ onSelectHolder, onAckChange }: { onSelectHolder?: (h: any) => void, onAckChange?: () => void }) {
  const [alerts,  setAlerts]  = useState<any>({ newSignups: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [acking,  setAcking]  = useState<string | null>(null);

  function load() {
    setLoading(true);
    req("GET", "/admin/alerts")
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function ack(userId: string) {
    setAcking(userId);
    try {
      await req("POST", `/admin/alerts/ack/${userId}`);
      setAlerts((prev: any) => ({
        ...prev,
        newSignups: prev.newSignups.filter((u: any) => u.id !== userId),
        total: prev.total - 1,
      }));
      onAckChange?.();
    } catch {} finally { setAcking(null); }
  }

  async function ackAll() {
    setAcking("all");
    try {
      await req("POST", "/admin/alerts/ack-all");
      setAlerts({ newSignups: [], total: 0 });
      onAckChange?.();
    } catch {} finally { setAcking(null); }
  }

  const newSignups = alerts.newSignups ?? [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 28px", borderBottom: "1px solid #1A1D2E", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 700, fontSize: 15 }}>Alerts</span>
        {newSignups.length > 0 && (
          <span style={{ background: "#EF4444", color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
            {newSignups.length} new
          </span>
        )}
        {newSignups.length > 1 && (
          <button
            onClick={ackAll}
            disabled={acking === "all"}
            style={{ marginLeft: "auto", background: "#1F2937", border: "1px solid #374151", borderRadius: 6, padding: "6px 14px", fontSize: 11, color: "#9CA3AF", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {acking === "all" ? "Clearing…" : "Mark all as seen"}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>

        {/* ── New Signups ─────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "1px", fontWeight: 600, marginBottom: 14 }}>NEW SIGNUPS</div>

          {loading ? (
            <div style={{ color: "#6B7280", fontSize: 13, padding: "20px 0" }}>Loading…</div>
          ) : newSignups.length === 0 ? (
            <div style={{ background: "#0F1117", border: "1px solid #1F2937", borderRadius: 10, padding: "32px 20px", textAlign: "center", color: "#374151", fontSize: 13 }}>
              No new signups — you're all caught up.
            </div>
          ) : newSignups.map((u: any) => (
            <div key={u.id} style={{
              background: "#0F1117", border: "1px solid #1F2937", borderRadius: 10,
              padding: "14px 18px", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              {/* Role badge */}
              <div style={{ background: ROLE_BG[u.role] ?? "#111", border: `1px solid ${(ROLE_COLOR[u.role] ?? "#6B7280")}40`, borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLOR[u.role] ?? "#6B7280", textTransform: "capitalize" }}>{u.role}</span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{u.email} · signed up {timeAgo(u.createdAt)}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {u.role === "holder" && onSelectHolder && (
                  <button
                    onClick={() => { ack(u.id); onSelectHolder(u); }}
                    style={{ background: "#22C55E", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 11, fontWeight: 700, color: "#000", cursor: "pointer", fontFamily: "inherit" }}>
                    View Profile
                  </button>
                )}
                <button
                  onClick={() => ack(u.id)}
                  disabled={acking === u.id}
                  style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 6, padding: "7px 14px", fontSize: 11, color: "#9CA3AF", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {acking === u.id ? "…" : "Dismiss"}
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
