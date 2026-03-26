import React, { useState } from "react";
import { api } from "../utils/api";

const TONES = ["Witty","Empathetic","Informative","Casual","Enthusiastic","Controversial","Professional","Humorous","Supportive"];

const ACCENT = "#F59E0B";
const btn = (bg: string, fg: string, extra?: any) => ({
  background: bg, color: fg, border: "none", borderRadius: 8,
  padding: "10px 18px", fontWeight: 700, cursor: "pointer",
  fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 13,
  transition: "opacity 0.15s", ...extra,
});

function timeAgo(ts: any) {
  const d = (Date.now() - Number(ts)) / 1000;
  if (d < 60)   return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d/60)}m ago`;
  return `${Math.round(d/3600)}h ago`;
}

// ── Comment Modal ─────────────────────────────────────────────
function CommentModal({ post, onClose }: any) {
  const [tones,        setTones]        = useState<string[]>([]);
  const [comment,      setComment]      = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied,       setCopied]       = useState(false);

  function toggleTone(t: string) {
    setTones(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function generate(cp?: string) {
    setLoading(true); setErr("");
    try {
      const res = await api.generateComment(post.id, tones.length ? tones.join(", ") : undefined, cp || undefined);
      setComment(res.comment);
    } catch (e: any) {
      setErr(e.message ?? "Failed to generate comment");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!comment) return;
    await navigator.clipboard.writeText(comment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:32 }}>
      <div style={{ background:"#0F1117", border:"1px solid #2A1F00", borderLeft:`4px solid ${ACCENT}`, borderRadius:16, padding:36, maxWidth:660, width:"100%", maxHeight:"86vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
          <div style={{ flex:1, paddingRight:20 }}>
            <div style={{ fontSize:11, color:ACCENT, fontWeight:700, letterSpacing:"0.06em", marginBottom:8 }}>🔥 VIRAL · r/{post.subreddit}</div>
            <a href={post.url} target="_blank" rel="noreferrer" style={{ color:"#F9FAFB", fontSize:17, lineHeight:1.55, textDecoration:"none", fontWeight:600 }}>{post.title}</a>
            <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:ACCENT, fontWeight:500 }}>🔥 +{Number(post.lastGrowth ?? 0).toFixed(1)}% growth</span>
              <span style={{ fontSize:10, color:"#6B7280" }}>⬆ {post.upvotes}</span>
              <span style={{ fontSize:10, color:"#6B7280" }}>💬 {post.comments}</span>
              <span style={{ fontSize:10, color:"#6B7280" }}>eng: {post.engagement}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #374151", color:"#6B7280", cursor:"pointer", fontSize:18, borderRadius:8, width:36, height:36, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {/* Tone selection — only before comment is generated */}
        {!comment && (
          <>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#6B7280", letterSpacing:"0.08em", marginBottom:8 }}>SELECT TONE (optional, pick multiple)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7 }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => toggleTone(t)} style={{
                    background: tones.includes(t) ? "#1C1200" : "#111318",
                    border: `1px solid ${tones.includes(t) ? ACCENT : "#1F2937"}`,
                    borderRadius:8, padding:"9px 6px", fontSize:12,
                    color: tones.includes(t) ? ACCENT : "#6B7280",
                    cursor:"pointer", fontFamily:"inherit",
                    fontWeight: tones.includes(t) ? 600 : 400, transition:"all 0.12s",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <button onClick={() => generate()} disabled={loading} style={{ ...btn(loading ? "#78350F" : ACCENT, loading ? "#FCD34D" : "#000"), width:"100%", padding:"14px", marginBottom:16, fontSize:14 }}>
              {loading ? "Generating..." : "✨ Generate Comment"}
            </button>
          </>
        )}

        {err && <div style={{ color:"#F87171", fontSize:13, marginBottom:12 }}>{err}</div>}

        {/* Generated comment */}
        {comment && (
          <div style={{ background:"#080B12", border:"1px solid #2A1F00", borderRadius:12, padding:22, marginBottom:20 }}>
            <p style={{ margin:"0 0 16px", fontSize:14, color:"#D1D5DB", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{comment}</p>

            {/* Custom prompt + regenerate */}
            <div style={{ display:"flex", gap:8, marginBottom:12, opacity: customPrompt ? 1 : 0.45, transition:"opacity 0.15s" }}
              onMouseEnter={(e: any) => e.currentTarget.style.opacity="1"}
              onMouseLeave={(e: any) => e.currentTarget.style.opacity= customPrompt ? "1" : "0.45"}
              onFocusCapture={(e: any) => e.currentTarget.style.opacity="1"}
              onBlurCapture={(e: any) => { if (!customPrompt) e.currentTarget.style.opacity="0.45"; }}>
              <input value={customPrompt} onChange={(e: any) => setCustomPrompt(e.target.value)}
                placeholder="Add instruction… e.g. make it shorter, add a question"
                style={{ flex:1, background:"#0A0C12", border:"1px solid #2A1F00", borderRadius:6, padding:"7px 10px", fontSize:12, color:"#E5E7EB", outline:"none", fontFamily:"inherit" }} />
              <button onClick={() => { const cp = customPrompt; setCustomPrompt(""); generate(cp); }} disabled={loading}
                style={{ ...btn("#1C1200", ACCENT), flexShrink:0, whiteSpace:"nowrap" }}>↺ Regenerate</button>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={copy} style={btn(copied ? "#064E3B" : "#1F2937", copied ? "#34D399" : "#9CA3AF")}>
                {copied ? "✓ Copied!" : "Copy Text"}
              </button>
              <button onClick={() => window.open(post.url, "_blank")} style={btn("#1A1D2E", "#9CA3AF", { border:"1px solid #374151" })}>
                Open Post ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────
function PostCard({ post, onDismiss }: any) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {showModal && <CommentModal post={post} onClose={() => setShowModal(false)} />}
      <div style={{
        background:"#0F1117", border:"1px solid #2A1F00",
        borderLeft:"3px solid #F59E0B", borderRadius:10,
        padding:"14px 16px", boxShadow:"0 0 20px rgba(245,158,11,0.06)",
      }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ flex:1 }}>
            <a href={post.url} target="_blank" rel="noreferrer"
              style={{ fontSize:13, color:"#F9FAFB", lineHeight:1.55 }}>
              {post.title}
            </a>
            <div style={{ display:"flex", gap:12, marginTop:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"#F59E0B", fontWeight:500 }}>🔥 +{Number(post.lastGrowth ?? 0).toFixed(1)}% growth</span>
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
            <button onClick={() => setShowModal(true)} style={{
              background:"#F59E0B", border:"none", borderRadius:6,
              padding:"7px 14px", fontSize:11, color:"#000",
              fontWeight:700, cursor:"pointer",
              fontFamily:"'IBM Plex Sans',sans-serif", whiteSpace:"nowrap",
            }}>
              Generate Comment
            </button>
          </div>
        </div>
      </div>
    </>
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
