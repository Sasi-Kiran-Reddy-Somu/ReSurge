import React, { useState } from "react";
import { api } from "../utils/api";

function timeAgo(ts: any) {
  const d = (Date.now() - Number(ts)) / 1000;
  if (d < 60)   return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d/60)}m ago`;
  return `${Math.round(d/3600)}h ago`;
}

function PostCard({ post, onDismiss }: any) {
  const [comment, setComment]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<any>(null);
  const [copied, setCopied]     = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setComment(null);
    try {
      const res = await api.generateComment(post.id);
      setComment(res.comment);
    } catch (e: any) {
      setError(e.message ?? "Failed to generate comment");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(comment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background:"#0F1117", border:"1px solid #2A1F00",
      borderLeft:"3px solid #F59E0B", borderRadius:10,
      padding:"14px 16px",
      boxShadow:"0 0 20px rgba(245,158,11,0.06)",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ flex:1 }}>
          <a href={post.url} target="_blank" rel="noreferrer"
            style={{ fontSize:13, color:"#F9FAFB", lineHeight:1.55 }}>
            {post.title}
          </a>
          <div style={{ display:"flex", gap:12, marginTop:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, color:"#F59E0B", fontWeight:500 }}>
              🔥 +{Number(post.lastGrowth ?? 0).toFixed(1)}% growth
            </span>
            <span style={{ fontSize:10, color:"#6B7280" }}>⬆ {post.upvotes}</span>
            <span style={{ fontSize:10, color:"#6B7280" }}>💬 {post.comments}</span>
            <span style={{ fontSize:10, color:"#6B7280" }}>eng: {post.engagement}</span>
            <span style={{ fontSize:10, color:"#6B7280" }}>posted {timeAgo(post.redditCreatedAt)}</span>
            <span style={{ fontSize:10, color:"#6B7280" }}>alerted {timeAgo(post.alertedAt)}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
          <a href={post.url} target="_blank" rel="noreferrer" style={{
            background:"#1A1D2E", border:"1px solid #374151", borderRadius:6,
            padding:"7px 12px", fontSize:11, color:"#9CA3AF", textDecoration:"none",
          }}>View ↗</a>
          <button onClick={handleGenerate} disabled={loading} style={{
            background: loading ? "#78350F" : "#F59E0B",
            border:"none", borderRadius:6,
            padding:"7px 14px", fontSize:11,
            color: loading ? "#FCD34D" : "#000",
            fontWeight:700, cursor: loading ? "default" : "pointer",
            fontFamily:"'IBM Plex Sans',sans-serif", whiteSpace:"nowrap",
          }}>
            {loading ? "Generating..." : "Generate Comment"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop:12, padding:"10px 14px",
          background:"#1A0A0A", border:"1px solid #7F1D1D",
          borderRadius:8, fontSize:11, color:"#F87171",
        }}>
          {error}
        </div>
      )}

      {comment && (
        <div style={{
          marginTop:12, padding:"12px 14px",
          background:"#0A0F1A", border:"1px solid #1E3A5F",
          borderRadius:8,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:10, color:"#6B7280", letterSpacing:"0.05em" }}>GENERATED COMMENT</span>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={handleGenerate} disabled={loading} style={{
                background:"none", border:"1px solid #1F2937", borderRadius:5,
                padding:"4px 10px", fontSize:10, color:"#6B7280",
                cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif",
              }}>↺ Regenerate</button>
              <button onClick={handleCopy} style={{
                background: copied ? "#064E3B" : "#1A1D2E",
                border: `1px solid ${copied ? "#065F46" : "#2D3148"}`,
                borderRadius:5, padding:"4px 10px", fontSize:10,
                color: copied ? "#34D399" : "#9CA3AF",
                cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif",
              }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
          <p style={{
            margin:0, fontSize:13, color:"#D1D5DB",
            lineHeight:1.65, whiteSpace:"pre-wrap",
          }}>{comment}</p>
        </div>
      )}
    </div>
  );
}

export default function Stack4Feed({ posts, onDismiss }: any) {
  if (posts.length === 0) {
    return (
      <div style={{ border:"1px dashed #1F2937", borderRadius:10, padding:"48px 20px", textAlign:"center" }}>
        <div style={{ fontSize:30, marginBottom:10 }}>📭</div>
        <div style={{ fontSize:12, color:"#6B7280", marginBottom:6 }}>No viral posts yet</div>
        <div style={{ fontSize:11, color:"#6B7280" }}>Posts that pass all three growth gates will appear here</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {posts.map((post: any, i: number) => (
        <div key={post.id} className="slidein" style={{ animationDelay:`${Math.min(i,5)*0.06}s` }}>
          <PostCard post={post} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
