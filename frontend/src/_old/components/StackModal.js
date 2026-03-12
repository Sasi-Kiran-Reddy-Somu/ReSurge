import React, { useEffect } from "react";

const COLORS = { 1:"#6B7280", 2:"#3B82F6", 3:"#8B5CF6" };
const LABELS = { 1:"Baseline", 2:"Growing", 3:"Hot" };

function timeAgo(ts) {
  const d = (Date.now() - Number(ts)) / 1000;
  if (d < 60)   return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d/60)}m ago`;
  return `${Math.round(d/3600)}h ago`;
}
function inStack(ts, minAge) {
  const elapsed = (Date.now() - Number(ts)) / 60000;
  const left    = minAge - elapsed;
  return left <= 0 ? "deciding next poll…" : `${Math.ceil(left)}m left`;
}

export default function StackModal({ stack, posts, thresholds, onClose, onRefresh }) {
  // Auto-refresh modal data every 15 seconds while open
  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(onRefresh, 15_000);
    return () => clearInterval(t);
  }, [onRefresh]);
  const color  = COLORS[stack];
  const minAge = stack === 1 ? thresholds.s1MinAge : stack === 2 ? thresholds.s2MinAge : thresholds.s3MinAge;

  return (
    <div className="fadein" onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.72)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000, padding:20,
    }}>
      <div className="scalein" onClick={e => e.stopPropagation()} style={{
        background:"#0F1117", border:`1px solid ${color}40`,
        borderTop:`2px solid ${color}`, borderRadius:12,
        width:"100%", maxWidth:680, maxHeight:"80vh",
        display:"flex", flexDirection:"column",
        boxShadow:`0 0 40px ${color}18`,
      }}>
        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #1A1D2E", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:color }} />
            <span style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:700, fontSize:15 }}>
              Stack {stack} — {LABELS[stack]}
            </span>
            <span style={{ fontSize:11, color:"#6B7280" }}>{posts.length} posts</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#6B7280", fontSize:20, cursor:"pointer" }}>×</button>
        </div>

        {/* Threshold row */}
        <div style={{ padding:"8px 20px", background:"#0D0F14", borderBottom:"1px solid #1A1D2E", display:"flex", gap:20 }}>
          {stack === 1 && <>
            <span style={{ fontSize:10, color:"#6B7280" }}>Min age: <b style={{ color:"#22C55E" }}>{thresholds.s1MinAge}m</b></span>
            <span style={{ fontSize:10, color:"#6B7280" }}>Min engagement: <b style={{ color:"#22C55E" }}>{thresholds.s1MinEng}</b></span>
          </>}
          {stack === 2 && <>
            <span style={{ fontSize:10, color:"#6B7280" }}>Time in stack: <b style={{ color:"#3B82F6" }}>{thresholds.s2MinAge}m</b></span>
            <span style={{ fontSize:10, color:"#6B7280" }}>Growth needed: <b style={{ color:"#3B82F6" }}>{thresholds.s2GrowthPct}%</b></span>
          </>}
          {stack === 3 && <>
            <span style={{ fontSize:10, color:"#6B7280" }}>Time in stack: <b style={{ color:"#8B5CF6" }}>{thresholds.s3MinAge}m</b></span>
            <span style={{ fontSize:10, color:"#6B7280" }}>Growth needed: <b style={{ color:"#8B5CF6" }}>{thresholds.s3GrowthPct}%</b></span>
          </>}
        </div>

        {/* List */}
        <div style={{ overflowY:"auto", flex:1, padding:"12px 20px" }}>
          {posts.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#6B7280", fontSize:12 }}>
              No posts in this stack right now
            </div>
          ) : posts.map((post, i) => (
            <div key={post.id} className="slidein" style={{
              animationDelay:`${i*0.04}s`,
              background:"#0D0F14", border:"1px solid #1A1D2E",
              borderLeft:`3px solid ${color}`, borderRadius:8,
              padding:"11px 14px", marginBottom:8,
            }}>
              <a href={post.url} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:"#E5E7EB", lineHeight:1.5 }}>
                {post.title}
              </a>
              <div style={{ display:"flex", gap:12, marginTop:7, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, color:"#6B7280" }}>⬆ {post.upvotes}</span>
                <span style={{ fontSize:10, color:"#6B7280" }}>💬 {post.comments}</span>
                <span style={{ fontSize:10, color }}>eng: {post.engagement}</span>
                <span style={{ fontSize:10, color:"#6B7280" }}>posted {timeAgo(post.redditCreatedAt)}</span>
                {post.lastGrowth != null && (
                  <span style={{ fontSize:10, color: post.lastGrowth > 0 ? "#22C55E":"#EF4444" }}>
                    {post.lastGrowth > 0 ? "+" : ""}{Number(post.lastGrowth).toFixed(1)}% growth
                  </span>
                )}
                <span style={{ fontSize:10, color:"#F59E0B", marginLeft:"auto" }}>
                  {inStack(post.stackEnteredAt, minAge)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
