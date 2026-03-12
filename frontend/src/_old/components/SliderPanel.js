import React, { useState, useEffect } from "react";

const SLIDERS = [
  { key:"s1MinAge",    label:"S1 — Post age",        unit:"min", min:1,  max:20,  color:"#6B7280", track:"#1F2937", tip:"Post must be this old before leaving Stack 1" },
  { key:"s1MinEng",    label:"S1→S2 Min engagement", unit:"eng", min:1,  max:20,  color:"#22C55E", track:"#14532D", tip:"Minimum upvotes+comments to pass Stack 1" },
  { key:"s2MinAge",    label:"S2 — Time in stack",   unit:"min", min:1,  max:20,  color:"#3B82F6", track:"#1E3A5F", tip:"Time post must spend in Stack 2 before check" },
  { key:"s2GrowthPct", label:"S2→S3 Growth %",       unit:"%",   min:5,  max:200, color:"#3B82F6", track:"#1E3A5F", tip:"Engagement growth % to advance to Stack 3" },
  { key:"s3MinAge",    label:"S3 — Time in stack",   unit:"min", min:1,  max:20,  color:"#8B5CF6", track:"#3B1F6E", tip:"Time post must spend in Stack 3 before check" },
  { key:"s3GrowthPct", label:"S3→S4 Growth %",       unit:"%",   min:5,  max:200, color:"#F59E0B", track:"#78350F", tip:"Engagement growth % to reach Stack 4 (alert!)" },
];

export default function SliderPanel({ thresholds, onSave, subreddit }) {
  const [local,      setLocal]      = useState(thresholds);
  const [dirty,      setDirty]      = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [confirm,    setConfirm]    = useState(null); // null | "save" | "discard"
  const [editingKey, setEditingKey] = useState(null); // key being inline-edited

  // Keep local in sync if thresholds prop changes externally
  useEffect(() => {
    setLocal(thresholds);
    setDirty(false);
  }, [thresholds]);

  function update(key, val) {
    setLocal(p => ({ ...p, [key]: val }));
    setDirty(true);
  }

  async function executeSave() {
    setSaving(true);
    setConfirm(null);
    try { await onSave(local); setDirty(false); }
    finally { setSaving(false); }
  }

  function executeDiscard() {
    setLocal(thresholds);
    setDirty(false);
    setConfirm(null);
  }

  // Row layout: odd-numbered sliders (1,3,5 → indices 0,2,4) in row 1
  //             even-numbered sliders (2,4,6 → indices 1,3,5) in row 2
  // CSS order: even index i → i/2+1,  odd index i → (i-1)/2+4
  function sliderOrder(i) {
    return i % 2 === 0 ? i / 2 + 1 : (i - 1) / 2 + 4;
  }

  return (
    <div style={{ padding:"14px 20px 12px" }}>
      {/* Confirm overlay */}
      {confirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500 }}>
          <div style={{ background:"#0F1117", border:"1px solid #374151", borderRadius:12, padding:28, width:360, fontFamily:"'IBM Plex Sans',sans-serif" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#F9FAFB", marginBottom:8 }}>
              {confirm === "save" ? "Save threshold changes?" : "Discard changes?"}
            </div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:22, lineHeight:1.6 }}>
              {confirm === "save"
                ? "This will update the thresholds used by the poll worker immediately."
                : "All unsaved changes will be lost and values will revert to the last saved state."}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirm(null)}
                style={{ flex:1, background:"#1F2937", color:"#9CA3AF", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
              <button
                onClick={confirm === "save" ? executeSave : executeDiscard}
                style={{ flex:1, background: confirm === "save" ? "#22C55E" : "#7F1D1D", color: confirm === "save" ? "#000" : "#FCA5A5", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {confirm === "save" ? "Yes, save" : "Yes, discard"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:10, color:"#6B7280", letterSpacing:"1px", fontWeight:500 }}>THRESHOLDS{subreddit ? ` · r/${subreddit}` : ""}</span>
        {dirty && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setConfirm("discard")} style={{
              background:"#1F2937", border:"1px solid #374151", borderRadius:5,
              padding:"4px 12px", fontSize:10, color:"#9CA3AF", fontWeight:600,
              cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif",
            }}>
              Discard
            </button>
            <button onClick={() => setConfirm("save")} disabled={saving} style={{
              background:"#22C55E", border:"none", borderRadius:5,
              padding:"4px 12px", fontSize:10, color:"#000", fontWeight:700,
              cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif",
            }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Grid: 3 columns, sliders reordered so row1=1,3,5 and row2=2,4,6 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px 24px" }}>
        {SLIDERS.map(({ key, label, unit, min, max, color, track, tip }, i) => {
          const val = local[key] ?? thresholds[key];
          const pct = Math.min(100, ((val - min) / (max - min)) * 100);
          return (
            <div key={key} style={{ order: sliderOrder(i) }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:10, color:"#6B7280" }} title={tip}>{label}</span>
                {editingKey === key ? (
                  <input
                    type="number" min={min} value={val} autoFocus
                    onChange={e => update(key, Number(e.target.value))}
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingKey(null); }}
                    style={{ width:60, background:"#0A0C12", border:`1px solid ${color}`, borderRadius:4, padding:"1px 5px", color, fontSize:11, fontWeight:600, fontFamily:"inherit", outline:"none", textAlign:"right" }}
                  />
                ) : (
                  <span
                    style={{ fontSize:11, color, fontWeight:500, cursor:"text", userSelect:"none" }}
                    title="Double-click to type a custom value"
                    onDoubleClick={() => setEditingKey(key)}
                  >{val}{unit}</span>
                )}
              </div>
              <input type="range" min={min} max={max} value={val}
                onChange={e => update(key, Number(e.target.value))}
                style={{ background:`linear-gradient(to right,${color} 0%,${color} ${pct}%,${track} ${pct}%,${track} 100%)` }}
              />
              <style>{`input[type=range]::-webkit-slider-thumb{background:${color}}`}</style>
            </div>
          );
        })}
      </div>
    </div>
  );
}
