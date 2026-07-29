import { formatLength, formatArea } from "../takeoff/units.js";

// The takeoff toolbar: always visible above the plan viewer, never hidden in
// a menu. The primary row is the spec's exact required tool/action list —
// Select, Pan, Set Scale, Auto Detect Exterior, Draw Exterior, Edit Exterior,
// Delete Segment, Close Shape, Clear Exterior, Area Tool, Undo, Redo — with
// Delete Segment and Close Shape as flat, always-visible action buttons
// (never tucked into a submenu), enabled only when they'd actually do
// something. Confirm Exterior Walls / Confirm Area are one-time workflow
// gates rather than persistent tools, so they live as contextual actions in
// the status row below, alongside scale/detection/close-shape feedback.
export default function TakeoffToolbar({ page, tools, onDetectExteriorWalls }) {
  const hasCalibration = Boolean(page?.calibration);
  const hasWalls = Boolean(page?.exteriorWalls?.vertices?.length);
  const wallsConfirmed = Boolean(page?.exteriorWalls?.confirmed);
  const measurementCount = page?.measurements?.length || 0;

  const orientationDone = Boolean(page?.orientationConfirmed);
  const scaleDone = hasCalibration;
  const wallsDone = wallsConfirmed;
  const areaDone = Boolean(page?.areas?.some((a) => a.confirmed));

  return (
    <div style={S.wrap} data-testid="takeoff-toolbar">
      <div style={S.buttonRow}>
        <ToolButton active={tools.activeTool === "select"} onClick={() => tools.setActiveTool("select")} testId="tool-select">
          Select
        </ToolButton>
        <ToolButton active={tools.activeTool === "pan"} onClick={() => tools.setActiveTool("pan")} testId="tool-pan">
          Pan
        </ToolButton>
        <ToolButton active={tools.activeTool === "set-scale"} onClick={() => tools.setActiveTool("set-scale")} testId="tool-set-scale">
          Set Scale
        </ToolButton>
        <span style={S.divider} />
        <ToolButton
          disabled={!hasCalibration || tools.wallDetectionBusy}
          onClick={onDetectExteriorWalls}
          testId="tool-detect-exterior"
        >
          {tools.wallDetectionBusy ? "Detecting..." : "Auto Detect Exterior"}
        </ToolButton>
        <ToolButton active={tools.activeTool === "exterior-wall"} onClick={() => tools.setActiveTool("exterior-wall")} testId="tool-draw-exterior">
          Draw Exterior
        </ToolButton>
        <ToolButton
          active={tools.activeTool === "edit-walls"}
          disabled={!hasWalls}
          onClick={() => tools.setActiveTool("edit-walls")}
          testId="tool-edit-exterior"
        >
          Edit Exterior
        </ToolButton>
        <ToolButton disabled={!tools.canDeleteWallSelection} onClick={tools.deleteSelectedWallItem} testId="tool-delete-segment">
          Delete Segment
        </ToolButton>
        <ToolButton disabled={!tools.canCloseShape} onClick={() => tools.closeWallPerimeter("exteriorWalls")} testId="tool-close-shape">
          Close Shape
        </ToolButton>
        <ToolButton disabled={!tools.canClearExterior} onClick={tools.requestClearExterior} testId="tool-clear-exterior">
          Clear Exterior
        </ToolButton>
        <span style={S.divider} />
        <ToolButton active={tools.activeTool === "area"} onClick={() => tools.setActiveTool("area")} testId="tool-area">
          Area Tool
        </ToolButton>
        <span style={S.divider} />
        <ToolButton disabled={!tools.canUndo} onClick={tools.undo} testId="tool-undo">
          Undo
        </ToolButton>
        <ToolButton disabled={!tools.canRedo} onClick={tools.redo} testId="tool-redo">
          Redo
        </ToolButton>
      </div>

      {tools.clearExteriorConfirmOpen && (
        <div style={S.confirmBar} data-testid="clear-exterior-confirm">
          <span>Clear the exterior perimeter? All exterior wall segments and any openings on them will be removed.</span>
          <button type="button" style={S.confirmDanger} onClick={tools.confirmClearExterior} data-testid="clear-exterior-confirm-yes">
            Clear Exterior
          </button>
          <button type="button" style={S.miniButton} onClick={tools.cancelClearExterior} data-testid="clear-exterior-confirm-cancel">
            Cancel
          </button>
        </div>
      )}

      <div style={S.statusRow}>
        <span style={S.scaleStatus} data-testid="scale-status">
          {scaleStatusText(page, tools)}
        </span>
        {hasCalibration && (
          <>
            <button type="button" style={S.miniButton} onClick={() => tools.setActiveTool("set-scale")} data-testid="recalibrate-button">
              Recalibrate
            </button>
            <button type="button" style={S.miniButton} onClick={tools.clearScale} data-testid="clear-scale-button">
              Clear Scale
            </button>
          </>
        )}
        {tools.activeTool === "set-scale" && (
          <button
            type="button"
            style={{ ...S.miniButton, ...(tools.manualPlacementEnabled ? S.miniButtonActive : null) }}
            onClick={tools.toggleManualPlacement}
            data-testid="place-manually-toggle"
          >
            {tools.manualPlacementEnabled ? "Place Manually: On" : "Place Manually"}
          </button>
        )}
        {measurementCount > 0 && (
          <button type="button" style={S.miniButton} onClick={tools.clearMeasurements} data-testid="tool-clear-measurements">
            Clear Measurements
          </button>
        )}

        {hasWalls && (
          <span style={S.wallStatus} data-testid="wall-status">
            {wallsConfirmed
              ? `Exterior walls confirmed — Total perimeter: ${formatLength(tools.totalPerimeterMm || 0)}`
              : `Exterior walls: ${page.exteriorWalls.segments.length} segments${page.exteriorWalls.isClosed ? " — Closed" : " — Open"}${page.exteriorWalls.detectionConfidence != null ? ` — Confidence: ${page.exteriorWalls.detectionConfidence}%` : ""}`}
          </span>
        )}
        {hasWalls && !wallsConfirmed && (
          <button type="button" style={S.miniButton} disabled={!tools.wallValidation.valid} onClick={tools.confirmExteriorWalls} data-testid="tool-confirm-walls">
            Confirm Exterior Walls
          </button>
        )}
        {tools.wallDetectionMessage && !hasWalls && (
          <span style={S.wallMessage} data-testid="wall-detection-message">{tools.wallDetectionMessage}</span>
        )}

        {closeShapeFeedback(tools)}

        {wallsConfirmed && tools.areaValidation.valid && (
          <button type="button" style={S.miniButton} onClick={() => tools.setAreaDialogOpen(true)} data-testid="tool-confirm-area">
            Confirm Area
          </button>
        )}
        {areaDone && (
          <span style={S.wallStatus} data-testid="area-status">
            Area confirmed: {formatArea(page.areas.find((a) => a.confirmed)?.confirmedAreaM2 || 0)}
          </span>
        )}
      </div>

      <div style={S.progressRow} data-testid="workflow-progress">
        <ProgressItem label="Orientation" done={orientationDone} />
        <ProgressItem label="Scale" done={scaleDone} />
        <ProgressItem label="Exterior walls" done={wallsDone} />
        <ProgressItem label="Area" done={areaDone} />
      </div>
    </div>
  );
}

function closeShapeFeedback(tools) {
  if (tools.closeShapeError) {
    return <span style={S.wallMessage} data-testid="close-shape-error">{tools.closeShapeError}</span>;
  }
  if (tools.closeShapeSuccessMessage) {
    return <span style={S.wallStatus} data-testid="close-shape-success">{tools.closeShapeSuccessMessage}</span>;
  }
  return null;
}

function scaleStatusText(page, tools) {
  if (page?.calibration) {
    const c = page.calibration;
    const alignment = c.axis === "horizontal" ? "Horizontal" : "Vertical";
    return `Scale: Calibrated — Reference: ${formatLength(c.actualLengthMm)} — Alignment: ${alignment}`;
  }
  if (tools.activeTool === "set-scale") {
    if (!tools.pendingPoint) return "Scale: Selecting first point";
    const axis = tools.hoverPreview?.axis;
    if (axis === "horizontal") return "Scale: Horizontal lock — select second point";
    if (axis === "vertical") return "Scale: Vertical lock — select second point";
    return "Scale: Select second point";
  }
  return "Scale: Not set";
}

function ToolButton({ children, active, disabled, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        ...S.button,
        ...(active ? S.buttonActive : null),
        ...(disabled ? S.buttonDisabled : null),
      }}
    >
      {children}
    </button>
  );
}

function ProgressItem({ label, done }) {
  return (
    <span style={S.progressItem}>
      <span style={{ ...S.progressDot, background: done ? "#16a34a" : "#cbd5e1" }} />
      {label}
      <span style={S.progressState}>{done ? "Complete" : "Not " + (label === "Exterior walls" ? "detected" : label === "Area" ? "confirmed" : "set")}</span>
    </span>
  );
}

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderBottom: "2px solid #1d4ed8", background: "#eff6ff" },
  buttonRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  button: { border: "1px solid #93c5fd", background: "#fff", color: "#1e3a8a", borderRadius: 6, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  buttonActive: { background: "#1d4ed8", color: "#fff", border: "1px solid #1d4ed8" },
  buttonDisabled: { opacity: 0.45, cursor: "not-allowed" },
  divider: { width: 1, alignSelf: "stretch", background: "#bfdbfe", margin: "0 2px" },
  confirmBar: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 700, color: "#7f1d1d", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 10px" },
  confirmDanger: { border: "1px solid #b91c1c", background: "#dc2626", color: "#fff", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  statusRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, flexWrap: "wrap" },
  scaleStatus: { fontWeight: 800, color: "#1e3a8a" },
  wallStatus: { fontWeight: 700, color: "#166534" },
  wallMessage: { fontWeight: 600, color: "#b91c1c" },
  miniButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  miniButtonActive: { background: "#f59e0b", color: "#fff", border: "1px solid #f59e0b" },
  progressRow: { display: "flex", gap: 16, fontSize: 12, color: "#334155" },
  progressItem: { display: "flex", alignItems: "center", gap: 6, fontWeight: 700 },
  progressDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  progressState: { fontWeight: 500, color: "#64748b" },
};
