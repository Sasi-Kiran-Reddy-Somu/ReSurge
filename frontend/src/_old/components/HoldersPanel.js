import React, { useState, useEffect } from "react";

const BASE = "/api";
function getToken() { return localStorage.getItem("main_token"); }
async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error ?? "Failed"); }
  return res.json();
}

const S = {
  card:  { background:"#0A0C12", border:"1px solid #1F2937", borderRadius:10, padding:16, marginBottom:10 },
  input: { background:"#0A0C12", border:"1px solid #374151", borderRadius:7, padding:"9px 12px", color:"#F9FAFB", fontFamily:"inherit", fontSize:12, width:"100%", boxSizing:"border-box" },
};

function HolderCard({ holder }) {
  const [expanded, setExpanded] = useState(false);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (expanded) {
      req("GET", `/admin/holders/${holder.id}/accounts`).then(setAccounts).catch(() => {});
    }
  }, [expanded, holder.id]);

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ cursor:"pointer", flex:1 }} onClick={() => setExpanded(e => !e)}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{holder.name}</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>{holder.email}</div>
        </div>
        <span style={{ cursor:"pointer", color:"#6B7280", fontSize:18, lineHeight:1 }} onClick={() => setExpanded(e => !e)}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #1F2937" }}>
          <div style={{ fontSize:10, color:"#6B7280", marginBottom:8 }}>ACCOUNTS ({accounts.length})</div>
          {accounts.length === 0
            ? <div style={{ color:"#6B7280", fontSize:12 }}>No accounts added by this holder yet.</div>
            : accounts.map(a => (
              <div key={a.id} style={{ background:"#080B12", border:"1px solid #1F2937", borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ marginBottom: a.subreddits?.length > 0 ? 8 : 0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#F9FAFB" }}>
                    {a.redditUsername ? `u/${a.redditUsername.replace(/^u\//,"")}` : a.emailAddress}
                  </div>
                  {a.redditUsername && <div style={{ fontSize:11, color:"#6B7280", marginTop:2 }}>{a.emailAddress}</div>}
                </div>
                {a.subreddits?.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {a.subreddits.map(s => <span key={s} style={{ background:"#1F2937", color:"#9CA3AF", padding:"2px 8px", borderRadius:10, fontSize:10 }}>r/{s}</span>)}
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

export default function HoldersPanel() {
  const [holders, setHolders] = useState([]);
  const [search, setSearch]   = useState("");

  useEffect(() => { req("GET", "/admin/holders").then(setHolders).catch(() => {}); }, []);

  const filtered = holders.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
        <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>👤 Holders</span>
      </div>
      <input
        style={{ ...S.input, marginBottom:14 }}
        placeholder="Search holders by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div style={{ fontSize:10, color:"#6B7280", letterSpacing:"1px", marginBottom:12 }}>
        {search ? `${filtered.length} of ${holders.length}` : holders.length} HOLDER{holders.length !== 1 ? "S" : ""}
      </div>
      {filtered.length === 0
        ? <div style={{ color:"#6B7280", fontSize:12 }}>{holders.length === 0 ? "No holders signed up yet." : "No results match your search."}</div>
        : filtered.map(h => <HolderCard key={h.id} holder={h} />)
      }
    </div>
  );
}
