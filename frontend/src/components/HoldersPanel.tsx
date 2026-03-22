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

const S: any = {
  card:  { background:"#0A0C12", border:"1px solid #1F2937", borderRadius:10, padding:16, marginBottom:10 },
  input: { background:"#0A0C12", border:"1px solid #374151", borderRadius:7, padding:"9px 12px", color:"#F9FAFB", fontFamily:"inherit", fontSize:12, width:"100%", boxSizing:"border-box" },
};

function HolderCard({ holder }: any) {
  const [expanded, setExpanded] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (expanded) {
      req("GET", `/admin/holders/${holder.id}/accounts`).then(setAccounts).catch(() => {});
    }
  }, [expanded, holder.id]);

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ cursor:"pointer", flex:1 }} onClick={() => setExpanded((e: boolean) => !e)}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{holder.name}</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>{holder.email}</div>
        </div>
        <span style={{ cursor:"pointer", color:"#6B7280", fontSize:18, lineHeight:1 }} onClick={() => setExpanded((e: boolean) => !e)}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #1F2937" }}>
          <div style={{ fontSize:10, color:"#6B7280", marginBottom:8 }}>ACCOUNTS ({accounts.length})</div>
          {accounts.length === 0
            ? <div style={{ color:"#6B7280", fontSize:12 }}>No accounts added by this holder yet.</div>
            : accounts.map((a: any) => (
              <div key={a.id} style={{ background:"#080B12", border:"1px solid #1F2937", borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ marginBottom: a.subreddits?.length > 0 ? 8 : 0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#F9FAFB" }}>
                    {a.redditUsername ? `u/${a.redditUsername.replace(/^u\//,"")}` : a.emailAddress}
                  </div>
                  {a.redditUsername && <div style={{ fontSize:11, color:"#6B7280", marginTop:2 }}>{a.emailAddress}</div>}
                </div>
                {a.subreddits?.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {a.subreddits.map((s: string) => <span key={s} style={{ background:"#1F2937", color:"#9CA3AF", padding:"2px 8px", borderRadius:10, fontSize:10 }}>r/{s}</span>)}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function HoldersPanel({ onSelectHolder }: { onSelectHolder?: (h: any) => void }) {
  const [holders, setHolders] = useState<any[]>([]);
  const [search, setSearch]   = useState("");

  useEffect(() => { req("GET", "/monitor/holders").then(setHolders).catch(() => {}); }, []);

  const filtered = holders.filter((h: any) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"18px 28px", borderBottom:"1px solid #1A1D2E", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>Holders</span>
        <input
          style={{ ...S.input, maxWidth:320 }}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
        />
        <span style={{ fontSize:12, color:"#6B7280", marginLeft:"auto" }}>
          {search ? `${filtered.length} of ${holders.length}` : holders.length} holder{holders.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px 28px" }}>
        <div style={{ background:"#0F1117", border:"1px solid #1F2937", borderRadius:10, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1.5fr 1fr 1fr", gap:16, padding:"10px 20px", borderBottom:"1px solid #1F2937" }}>
            {["NAME","EMAIL","MONITOR","NOTIFIED","POSTED"].map(h => <div key={h} style={{ fontSize:10, color:"#374151", fontWeight:700, letterSpacing:"0.08em" }}>{h}</div>)}
          </div>
          {filtered.length === 0
            ? <div style={{ padding:"40px 20px", textAlign:"center", color:"#374151", fontSize:13 }}>{holders.length === 0 ? "No holders signed up yet." : "No results."}</div>
            : filtered.map((h: any) => (
              <div key={h.id}
                onClick={() => onSelectHolder?.(h)}
                style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1.5fr 1fr 1fr", gap:16, padding:"13px 20px", borderBottom:"1px solid #1F293718", cursor: onSelectHolder ? "pointer" : "default", transition:"background 0.1s", alignItems:"center" }}
                onMouseEnter={(e: any) => { if (onSelectHolder) e.currentTarget.style.background="#13161F"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background="transparent"; }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#F9FAFB", display:"flex", alignItems:"center", gap:8 }}>
                  {h.name}
                  {h.isMonitor && <span style={{ fontSize:10, fontWeight:700, color:"#93C5FD", background:"#0D1626", border:"1px solid #1E3A5F", borderRadius:6, padding:"2px 7px", letterSpacing:"0.04em" }}>MONITOR</span>}
                </div>
                <div style={{ fontSize:12, color:"#6B7280" }}>{h.email}</div>
                <div style={{ fontSize:12, color: h.monitorName ? "#93C5FD" : "#374151", fontStyle: h.monitorName ? "normal" : "italic" }}>
                  {h.monitorName ?? "unassigned"}
                </div>
                <div style={{ fontSize:13, color:"#F59E0B" }}>{h.totalNotifications ?? 0}</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#22C55E" }}>{h.converted ?? 0}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
