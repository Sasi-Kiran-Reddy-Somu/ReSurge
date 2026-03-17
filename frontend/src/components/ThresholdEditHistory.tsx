import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

const FIELD_LABELS: Record<string, string> = {
  s1MinAge:    "Stack 1 Age",
  s1MinEng:    "Stack 1→2 Min Engagement",
  s2EvalStart: "Eval Window Start",
  s2EvalEnd:   "Eval Window End",
  s2GrowthPct: "Stack 2→3 Growth %",
};
const FIELD_UNITS: Record<string, string> = {
  s1MinAge: "min", s1MinEng: "eng", s2EvalStart: "min", s2EvalEnd: "min", s2GrowthPct: "%",
};

function timeAgo(ts: any) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60)    return `${Math.round(d)}s ago`;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function getDiff(before: any, after: any) {
  return Object.keys(FIELD_LABELS).filter(k => before[k] !== after[k]).map(k => ({
    key: k,
    label: FIELD_LABELS[k],
    unit: FIELD_UNITS[k] ?? "",
    from: before[k],
    to: after[k],
  }));
}

export default function ThresholdEditHistory({ subreddit }: any) {
  const [edits,   setEdits]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getThresholdEdits(subreddit)
      .then(setEdits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subreddit]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, padding: "20px 24px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontWeight: 700, fontSize: 15 }}>
            ✏️ Threshold Edit History — r/{subreddit}
          </span>
          <span style={{ fontSize: 10, color: "#6B7280", background: "#1F2937", padding: "2px 8px", borderRadius: 10 }}>
            {edits.length} edits
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        {loading ? (
          <div style={{ color: "#6B7280", fontSize: 12, padding: "40px 0", textAlign: "center" }}>Loading...</div>
        ) : edits.length === 0 ? (
          <div style={{ border: "1px dashed #1F2937", borderRadius: 10, padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📝</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>No threshold edits recorded yet.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {edits.map((edit: any) => {
              const before = JSON.parse(edit.before);
              const after  = JSON.parse(edit.after);
              const diff   = getDiff(before, after);
              return (
                <div key={edit.id} style={{ background: "#0F1117", border: "1px solid #1F2937", borderRadius: 10, padding: "16px 20px" }}
                  onMouseEnter={(e: any) => e.currentTarget.style.borderColor = "#374151"}
                  onMouseLeave={(e: any) => e.currentTarget.style.borderColor = "#1F2937"}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: diff.length ? 12 : 0 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        {new Date(edit.editedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        <span style={{ marginLeft: 8, color: "#374151" }}>{timeAgo(edit.editedAt)}</span>
                      </div>
                      {edit.note && (
                        <div style={{ fontSize: 13, color: "#D1D5DB", marginTop: 6, fontStyle: "italic" }}>
                          "{edit.note}"
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: "#6B7280", background: "#1F2937", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                      {diff.length} change{diff.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {diff.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                      {diff.map(d => (
                        <div key={d.key} style={{ background: "#0A0C12", border: "1px solid #1F2937", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
                          <span style={{ color: "#6B7280" }}>{d.label}: </span>
                          <span style={{ color: "#EF4444", fontWeight: 600 }}>{d.from}{d.unit}</span>
                          <span style={{ color: "#4B5563", margin: "0 6px" }}>→</span>
                          <span style={{ color: "#22C55E", fontWeight: 600 }}>{d.to}{d.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
