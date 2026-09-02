// TEMPORARY DEVELOPMENT DIAGNOSTICS.
//
// Shows why a wall/corner/jamb snap was chosen (or refused) while tracing on
// a real plan, so the garage-front, front-entry and re-entrant-corner cases
// can be diagnosed from what the snapper actually saw instead of guessed at.
// Remove once those three cases are signed off.

const WALL_DRAW_TOOLS = ["exterior-wall", "internal-wall"];

function round(value, places = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function directionLabel(from, to) {
  if (!from || !to) return "chain start";
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!(Math.hypot(dx, dy) > 0)) return "none";
  const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const cardinal = Math.abs(degrees % 90) < 6 || Math.abs((degrees % 90) - 90) < 6 ? " (axis)" : "";
  return `${round(degrees)}°${cardinal}`;
}

export default function WallSnapDebugPanel({ page, tools }) {
  if (!tools?.wallSnapDebugEnabled || !WALL_DRAW_TOOLS.includes(tools.activeTool)) return null;

  const preview = tools.wallDrawHoverPreview;
  const snap = preview?.snap;
  const chainPoint = tools.wallDrawChainPoint || null;
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || null;
  const breakdown = snap?.scoreBreakdown || null;
  const rejected = snap?.rejectedCandidates || [];

  return (
    <div style={S.panel} data-testid="wall-snap-debug-panel">
      <div style={S.title}>Snap debug (temporary)</div>
      <Row label="Snap type" value={preview?.valid === false ? "none (no valid snap)" : snap?.kind || "-"} />
      <Row label="Current wall direction" value={directionLabel(chainPoint, preview?.point || preview?.rawPoint)} />
      <Row
        label="Candidate position"
        value={preview?.point ? `${round(preview.point.x)}, ${round(preview.point.y)}` : "-"}
      />
      <Row label="Connected face" value={snap?.connectedFace || "unknown"} />
      <Row label="Continuation score" value={round(snap?.continuationScore, 2) ?? "-"} />
      <Row
        label="Opening candidate"
        value={snap?.openingCandidate && snap.openingCandidate !== "none"
          ? `${snap.openingCandidate}${snap.openingWidthMm ? ` (${Math.round(snap.openingWidthMm)} mm)` : ""}`
          : "none"}
      />
      {breakdown && (
        <Row
          label="Score terms"
          value={[
            `dir ${breakdown.connectedToDirection ? "Y" : "n"}`,
            `face ${breakdown.sameTracedFace ?? "-"}`,
            `thk ${breakdown.plausibleTurnThickness ? "Y" : "n"}`,
            `topo ${breakdown.continuesTopology ? "Y" : "n"}`,
            `cursor ${breakdown.cursorScore ?? "-"}`,
          ].join("  ")}
        />
      )}
      {preview?.valid === false && <Row label="Reason" value={preview.reason || "no_wall_corner_snap"} />}
      {mmPerDocumentUnit && <Row label="Scale" value={`${round(mmPerDocumentUnit, 3)} mm/unit`} />}
      {rejected.length > 0 && (
        <div style={S.rejectedBlock}>
          <div style={S.rejectedTitle}>Rejected nearby candidates</div>
          {rejected.slice(0, 4).map((entry, index) => (
            <div key={index} style={S.rejectedRow}>
              {entry.point ? `${round(entry.point.x)}, ${round(entry.point.y)}` : "?"}
              {" — "}
              {entry.reason || "no reason recorded"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value == null || value === "" ? "-" : String(value)}</span>
    </div>
  );
}

const S = {
  panel: {
    position: "absolute",
    left: 12,
    bottom: 12,
    zIndex: 30,
    minWidth: 300,
    maxWidth: 380,
    padding: "10px 12px",
    borderRadius: 8,
    background: "rgba(15,23,42,0.92)",
    color: "#e2e8f0",
    font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
    border: "1px solid rgba(148,163,184,0.35)",
    pointerEvents: "none",
  },
  title: { fontWeight: 700, marginBottom: 6, color: "#fbbf24", letterSpacing: 0.3 },
  row: { display: "flex", justifyContent: "space-between", gap: 12 },
  label: { color: "#94a3b8", whiteSpace: "nowrap" },
  value: { color: "#f1f5f9", textAlign: "right", wordBreak: "break-word" },
  rejectedBlock: { marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(148,163,184,0.25)" },
  rejectedTitle: { color: "#f87171", marginBottom: 3 },
  rejectedRow: { color: "#cbd5e1" },
};
