import { formatLength } from "../takeoff/units.js";

const CONFIDENCE_LABEL = { high: "High", medium: "Medium", low: "Low" };

// Compact selected-item panel for the generic wall Edit tool. Deliberately
// pinned to a fixed corner of the viewport (a sibling of the pan/zoom
// transform, not inside it — see PlanViewer.jsx) so it never overlaps the
// wall segment or vertex actually being edited, regardless of where that
// item is on screen.
export default function WallContextPanel({ page, tools }) {
  const field = tools.selectedField || "exteriorWalls";
  const graph = page?.[field];
  if (!graph) return null;

  if (tools.selectedSegmentId) {
    const segment = graph.segments.find((s) => s.id === tools.selectedSegmentId);
    if (!segment) return null;
    const view = tools.segmentToWallSegment(graph, segment, page?.calibration?.mmPerDocumentUnit || null);
    const label = field === "exteriorWalls" ? "Exterior wall segment" : "Internal wall segment";
    return (
      <div style={S.panel} data-testid="wall-context-panel">
        <div style={S.title}>{label}</div>
        <div style={S.row}>Length: {view.lengthMm != null ? formatLength(view.lengthMm) : "Set scale to see length"}</div>
        <div style={S.row}>Source: {segment.source === "automatic" ? "Automatic" : "Manual"}</div>
        {segment.confidence != null && (
          <div style={S.row}>Confidence: {CONFIDENCE_LABEL[segment.confidence] || segment.confidence}</div>
        )}
        <div style={S.actions}>
          <button type="button" style={S.button} onClick={tools.splitSelectedSegment} data-testid="wall-context-split">Split</button>
          <button type="button" style={S.buttonDanger} onClick={tools.deleteSelectedWallSegment} data-testid="wall-context-delete">Delete</button>
          {segment.source === "automatic" && (
            <button type="button" style={S.button} onClick={tools.convertSelectedSegmentToManual} data-testid="wall-context-convert-manual">
              Convert to Manual
            </button>
          )}
        </div>
      </div>
    );
  }

  if (tools.selectedVertexId) {
    const vertex = graph.vertices.find((v) => v.id === tools.selectedVertexId);
    if (!vertex) return null;
    const label = field === "exteriorWalls" ? "Exterior wall corner" : "Internal wall corner";
    return (
      <div style={S.panel} data-testid="wall-context-panel">
        <div style={S.title}>{label}</div>
        <div style={S.actions}>
          <button type="button" style={S.buttonDanger} onClick={tools.deleteSelectedWallVertex} data-testid="wall-context-delete-vertex">
            Delete Point
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const S = {
  panel: {
    position: "absolute", top: 10, right: 10, zIndex: 20,
    background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "10px 12px", minWidth: 190, boxShadow: "0 6px 16px rgba(15,23,42,0.18)",
    fontFamily: "system-ui, sans-serif", fontSize: 12, pointerEvents: "auto",
  },
  title: { fontWeight: 800, color: "#0f172a", marginBottom: 6, fontSize: 13 },
  row: { color: "#334155", marginBottom: 2 },
  actions: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" },
  button: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  buttonDanger: { border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};
