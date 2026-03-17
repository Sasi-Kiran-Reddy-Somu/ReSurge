import React, { useState, useEffect } from "react";

const THRESHOLD_KEYS = ["s1MinAge", "s1MinEng", "s2EvalStart", "s2EvalEnd", "s2GrowthPct"] as const;

// Grid: a=s1MinAge, b=s1MinEng, c=S2EvalWindow, d=s2GrowthPct — rendered a/c top row, b/d bottom row
const SLIDERS = [
  { key:"s1MinAge",    label:"Stack 1",                        unit:"min", min:1, max:20,  color:"#6B7280", track:"#1F2937", tip:"Post must be this old before Stack 1 check" },
  { key:"s1MinEng",    label:"Stack 1→2 Min engagement",       unit:"eng", min:1, max:20,  color:"#22C55E", track:"#14532D", tip:"Minimum upvotes+comments to pass Stack 1" },
  { key:"s2GrowthPct", label:"Stack 2→3 Growth %",             unit:"%",   min:5, max:200, color:"#F59E0B", track:"#78350F", tip:"Engagement growth % during eval window to reach Stack 3 (alert!)" },
];

function renderSlider(
  { key, label, unit, min, max, color, track, tip }: typeof SLIDERS[number],
  val: number,
  editingKey: string | null,
  setEditingKey: (k: string | null) => void,
  update: (k: string, v: number) => void,
) {
  const pct = Math.min(100, ((val - min) / (max - min)) * 100);
  const btnStyle: any = { background:"#1F2937", border:"1px solid #374151", borderRadius:5, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", color:"#F9FAFB", fontSize:14, fontWeight:700, cursor:"pointer", flexShrink:0, lineHeight:1, fontFamily:"inherit" };
  return (
    <div key={key}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, color:"#F9FAFB", fontWeight:600 }} title={tip}>{label}</span>
        {editingKey === key ? (
          <input type="number" min={min} value={val} autoFocus
            onChange={(e: any) => update(key, Number(e.target.value))}
            onBlur={() => setEditingKey(null)}
            onKeyDown={(e: any) => { if (e.key === "Enter" || e.key === "Escape") setEditingKey(null); }}
            style={{ width:60, background:"#0A0C12", border:`1px solid ${color}`, borderRadius:4, padding:"1px 5px", color, fontSize:13, fontWeight:700, fontFamily:"inherit", outline:"none", textAlign:"center" }}
          />
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => update(key, Math.max(min, val - 1))} style={btnStyle}>−</button>
            <span style={{ fontSize:13, color:"#F9FAFB", fontWeight:700, minWidth:36, textAlign:"center", cursor:"text", userSelect:"none" as const }}
              title="Double-click to type a custom value"
              onDoubleClick={() => setEditingKey(key)}>
              {val}{unit}
            </span>
            <button onClick={() => update(key, Math.min(max, val + 1))} style={btnStyle}>+</button>
          </div>
        )}
      </div>
      <input type="range" min={min} max={max} value={val}
        onChange={(e: any) => update(key, Number(e.target.value))}
        style={{ background:`linear-gradient(to right,${color} 0%,${color} ${pct}%,${track} ${pct}%,${track} 100%)` }}
      />
      <style>{`input[type=range]::-webkit-slider-thumb{background:${color}}`}</style>
    </div>
  );
}

export default function SliderPanel({ thresholds, onSave, onEditSaved, subreddit }: any) {
  const [local,      setLocal]      = useState<any>(() => ({ ...thresholds }));
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [confirm,    setConfirm]    = useState<any>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [notePrompt, setNotePrompt] = useState<{ before: any; after: any } | null>(null);
  const [note,       setNote]       = useState("");

  useEffect(() => { setLocal({ ...thresholds }); }, [thresholds]);

  const dirty = !!(thresholds && local && THRESHOLD_KEYS.some(k => local[k] !== thresholds[k]));

  function update(key: string, val: number) {
    setLocal((p: any) => ({ ...p, [key]: val }));
  }

  async function executeSave() {
    const before = { ...thresholds };
    const after  = { ...local };
    setSaving(true); setSaveError(null); setConfirm(null);
    try {
      await onSave(local);
      setNotePrompt({ before, after });
      setNote("");
    }
    catch (e: any) { setSaveError(e?.message ?? "Save failed — check backend"); }
    finally { setSaving(false); }
  }

  function submitNote(skipNote = false) {
    if (notePrompt && onEditSaved) {
      onEditSaved({ before: notePrompt.before, after: notePrompt.after, note: skipNote ? null : (note.trim() || null) });
    }
    setNotePrompt(null);
    setNote("");
  }

  function executeDiscard() { setLocal({ ...thresholds }); setConfirm(null); }

  const evalStart = local?.s2EvalStart ?? 7;
  const evalEnd   = local?.s2EvalEnd   ?? 14;
  const evalMax   = 20;
  const evalMin   = 1;
  const startPct  = ((evalStart - evalMin) / (evalMax - evalMin)) * 100;
  const endPct    = ((evalEnd   - evalMin) / (evalMax - evalMin)) * 100;

  return (
    <div style={{ padding:"14px 20px 12px" }}>
      <style>{`
        .dual-range input[type=range] {
          -webkit-appearance: none; appearance: none;
          position: absolute; top: 0; left: 0;
          width: 100%; height: 100%;
          background: transparent; pointer-events: none; margin: 0; padding: 0;
        }
        .dual-range input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: #3B82F6; border: 2px solid #1E3A5F;
          cursor: pointer; pointer-events: all;
        }
        .dual-range input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #3B82F6; border: 2px solid #1E3A5F;
          cursor: pointer; pointer-events: all;
        }
        .dual-range input[type=range]::-webkit-slider-runnable-track { background: transparent; }
        .dual-range input[type=range]::-moz-range-track { background: transparent; }
      `}</style>

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
                : "All unsaved changes will be lost."}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirm(null)}
                style={{ flex:1, background:"#1F2937", color:"#9CA3AF", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
              <button onClick={confirm === "save" ? executeSave : executeDiscard}
                style={{ flex:1, background: confirm === "save" ? "#22C55E" : "#7F1D1D", color: confirm === "save" ? "#000" : "#FCA5A5", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {confirm === "save" ? "Yes, save" : "Yes, discard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note prompt — shown after a successful save */}
      {notePrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500 }}>
          <div style={{ background:"#0F1117", border:"1px solid #374151", borderRadius:12, padding:28, width:400, fontFamily:"'IBM Plex Sans',sans-serif" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#F9FAFB", marginBottom:6 }}>Changes saved</div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:16, lineHeight:1.6 }}>
              Add an optional note to remember why you made this change.
            </div>
            <textarea
              autoFocus
              value={note}
              onChange={(e: any) => setNote(e.target.value)}
              placeholder="e.g. Lowered growth % to catch slower-moving posts in r/beauty"
              rows={3}
              style={{ width:"100%", background:"#0A0C12", border:"1px solid #374151", borderRadius:6, padding:"10px 12px", color:"#F9FAFB", fontSize:12, fontFamily:"inherit", resize:"none", outline:"none", boxSizing:"border-box" as any }}
            />
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => submitNote(true)}
                style={{ flex:1, background:"#1F2937", color:"#9CA3AF", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Skip
              </button>
              <button onClick={() => submitNote(false)}
                style={{ flex:1, background:"#3B82F6", color:"#fff", border:"none", borderRadius:7, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title + save/discard buttons */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:10, color:"#6B7280", letterSpacing:"1px", fontWeight:500 }}>
          THRESHOLDS{subreddit ? ` · r/${subreddit}` : ""}
        </span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {saveError && <span style={{ fontSize:10, color:"#F87171" }}>{saveError}</span>}
          {dirty && (
            <>
              <button onClick={() => setConfirm("discard")}
                style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:5, padding:"4px 12px", fontSize:10, color:"#9CA3AF", fontWeight:600, cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif" }}>
                Discard
              </button>
              <button onClick={() => setConfirm("save")} disabled={saving}
                style={{ background:"#22C55E", border:"none", borderRadius:5, padding:"4px 12px", fontSize:10, color:"#000", fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2-column grid: a/c top row, b/d bottom row — positions pinned explicitly */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"auto auto", gap:"12px 24px" }}>

        {/* (a) row 1 col 1 — S1 Post age */}
        <div style={{ gridColumn:1, gridRow:1 }}>
          {renderSlider(SLIDERS[0], local?.[SLIDERS[0].key] ?? thresholds?.[SLIDERS[0].key] ?? 0, editingKey, setEditingKey, update)}
        </div>

        {/* (c) row 1 col 2 — S2 Evaluation Window — dual-range */}
        <div style={{ gridColumn:2, gridRow:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:12, color:"#F9FAFB", fontWeight:600 }}
              title="Post starts being evaluated after the left bound; must hit growth % before right bound or it's discarded">
              Stack 2 — Evaluation window
            </span>
            <span style={{ fontSize:13, color:"#F9FAFB", fontWeight:700 }}>
              {evalStart}min – {evalEnd}min
            </span>
          </div>

          <div className="dual-range" style={{ position:"relative", height:20 }}>
            <div style={{ position:"absolute", top:"50%", left:0, right:0, height:4, background:"#1F2937", borderRadius:2, transform:"translateY(-50%)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", top:"50%", left:`${startPct}%`, width:`${endPct - startPct}%`, height:4, background:"#3B82F6", borderRadius:2, transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input type="range" min={evalMin} max={evalMax} value={evalStart}
              onChange={(e: any) => update("s2EvalStart", Math.min(Number(e.target.value), evalEnd - 1))}
            />
            <input type="range" min={evalMin} max={evalMax} value={evalEnd}
              onChange={(e: any) => update("s2EvalEnd", Math.max(Number(e.target.value), evalStart + 1))}
            />
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
            <span style={{ fontSize:9, color:"#374151" }}>eval starts at {evalStart}m</span>
            <span style={{ fontSize:9, color:"#374151" }}>discard after {evalEnd}m</span>
          </div>
        </div>

        {/* (b) row 2 col 1 — S1→S2 Min engagement */}
        <div style={{ gridColumn:1, gridRow:2 }}>
          {renderSlider(SLIDERS[1], local?.[SLIDERS[1].key] ?? thresholds?.[SLIDERS[1].key] ?? 0, editingKey, setEditingKey, update)}
        </div>

        {/* (d) row 2 col 2 — S2→S3 Growth % */}
        <div style={{ gridColumn:2, gridRow:2 }}>
          {renderSlider(SLIDERS[2], local?.[SLIDERS[2].key] ?? thresholds?.[SLIDERS[2].key] ?? 0, editingKey, setEditingKey, update)}
        </div>

      </div>
    </div>
  );
}
