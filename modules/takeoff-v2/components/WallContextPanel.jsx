import { formatLength } from "../takeoff/units.js";

const CONFIDENCE_LABEL = { high: "High", medium: "Medium", low: "Low" };

// Compact selected-item panel for the generic wall Edit tool. Deliberately
// pinned to a fixed corner of the viewport (a sibling of the pan/zoom
// transform, not inside it — see PlanViewer.jsx) so it never overlaps the
// wall segment or vertex actually being edited, regardless of where that
// item is on screen.
export default function WallContextPanel({ page, tools }) {
  const field = tools.selectedField || "exteriorWalls";
  if (field === "exteriorHighlightedWalls" && tools.selectedVertexId) {
    return (
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>Exterior highlighted corner</div>
        <Field label="State" value="Editable" />
      </div>
    );
  }
  const graph = page?.[field];
  if (!graph) return null;

  if (tools.selectedSegmentId) {
    const segment = graph.segments.find((s) => s.id === tools.selectedSegmentId);
    if (!segment) return null;
    const view = tools.segmentToWallSegment(graph, segment, page?.calibration?.mmPerDocumentUnit || null);
    const isExterior = field === "exteriorWalls";
    const label = isExterior ? "Exterior wall segment" : "Interior wall segment";
    const thickness = segment.thicknessMm ?? graph.wallThicknessMm ?? "";
    const locked = Boolean(segment.locked);
    return (
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
        <div style={S.title}>{label}</div>
        <Field label="Wall type" value={view.wallType === "internal" ? "Interior" : "Exterior"} />
        <Field label="Length" value={view.lengthMm != null ? formatLength(view.lengthMm) : "Set scale to see length"} />
        <Field label="Source" value={segment.source === "automatic" ? "Automatic" : "Manual"} />
        {segment.confidence != null && (
          <Field label="Confidence" value={CONFIDENCE_LABEL[segment.confidence] || segment.confidence} />
        )}
        <label style={S.label}>
          Thickness
          <input
            type="number"
            min="0"
            step="10"
            value={thickness}
            disabled={locked}
            onChange={(event) => {
              const value = Number(event.target.value);
              tools.setSelectedSegmentThickness(Number.isFinite(value) && value > 0 ? value : null);
            }}
            style={S.input}
            data-testid="wall-context-thickness"
          />
          <span style={S.unit}>mm</span>
        </label>
        <Field label="State" value={locked ? "Locked" : "Unlocked"} />
        <div style={S.actions}>
          <button type="button" style={S.button} disabled={locked} onClick={tools.insertPointOnSelectedSegment} data-testid="wall-context-split">Insert Point</button>
          <button type="button" style={S.buttonDanger} disabled={locked} onClick={tools.deleteSelectedWallSegment} data-testid="wall-context-delete">Delete</button>
          <button
            type="button"
            style={S.button}
            disabled={locked}
            onClick={() => tools.moveSelectedSegmentToWallGraph(isExterior ? "internalWalls" : "exteriorWalls")}
            data-testid="wall-context-convert-type"
          >
            {isExterior ? "Convert to Interior" : "Convert to Exterior"}
          </button>
          {segment.source === "automatic" && (
            <button type="button" style={S.button} disabled={locked} onClick={tools.convertSelectedSegmentToManual} data-testid="wall-context-convert-manual">
              Convert to Manual
            </button>
          )}
          {locked ? (
            <button type="button" style={S.button} onClick={() => tools.setSelectedSegmentLocked(false)} data-testid="wall-context-unlock">Unlock</button>
          ) : (
            <button type="button" style={S.button} onClick={() => tools.setSelectedSegmentLocked(true)} data-testid="wall-context-lock">Lock</button>
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
      <div style={S.panel} data-testid="wall-context-panel" onPointerDown={stopPanelEvent} onPointerUp={stopPanelEvent} onClick={stopPanelEvent}>
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

function Field({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function stopPanelEvent(event) {
  event.stopPropagation();
}

const S = {
  panel: {
    position: "absolute", top: 10, right: 10, zIndex: 20,
    background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "10px 12px", minWidth: 190, boxShadow: "0 6px 16px rgba(15,23,42,0.18)",
    fontFamily: "system-ui, sans-serif", fontSize: 12, pointerEvents: "auto",
  },
  title: { fontWeight: 800, color: "#0f172a", marginBottom: 6, fontSize: 13 },
  row: { display: "flex", justifyContent: "space-between", gap: 14, color: "#334155", marginBottom: 3 },
  rowLabel: { color: "#64748b", fontWeight: 700 },
  label: { display: "grid", gridTemplateColumns: "1fr 72px 24px", alignItems: "center", gap: 6, color: "#64748b", fontWeight: 700, marginTop: 8 },
  input: { border: "1px solid #cbd5e1", borderRadius: 5, padding: "4px 6px", fontSize: 12, color: "#0f172a" },
  unit: { color: "#64748b", fontWeight: 700 },
  actions: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" },
  button: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  buttonDanger: { border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 5, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};
