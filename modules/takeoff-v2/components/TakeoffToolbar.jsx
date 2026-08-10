import { formatLength, formatArea } from "../takeoff/units.js";
import { validateCalibrationShape } from "../takeoff/scaleCalibration.js";
import { CONFIDENCE_HIGH } from "../orientation/analyzeOrientation.js";
import { distance } from "../takeoff/geometry.js";

// The takeoff toolbar: always visible above the plan viewer, never hidden in
// a menu. The primary row is the spec's exact required tool/action list —
// Select, Pan, Set Scale, Detect Walls, Draw Exterior, Edit Exterior,
// Delete Segment, Close Shape, Clear Exterior, Area Tool, Undo, Redo — with
// Delete Segment and Close Shape as flat, always-visible action buttons
// (never tucked into a submenu), enabled only when they'd actually do
// something. Confirm Exterior Walls / Confirm Area are one-time workflow
// gates rather than persistent tools, so they live as contextual actions in
// the status row below, alongside scale/detection/close-shape feedback.
export default function TakeoffToolbar({ page, tools }) {
  const hasCalibration = Boolean(page?.calibration);
  const hasWalls = Boolean(page?.exteriorWalls?.vertices?.length);
  const wallsConfirmed = Boolean(page?.exteriorWalls?.confirmed);
  const measurementCount = page?.measurements?.length || 0;

  const areaDone = Boolean(page?.areas?.some((a) => a.confirmed));
  const readiness = workflowReadiness(page, tools);
  const traceStatus = exteriorTraceStatus(page, tools);
  const finishExterior = () => {
    if (tools.activeTool === "exterior-wall") {
      tools.finishWallDrawing?.();
      return;
    }
    if (tools.exteriorHighlightedWalls?.length) {
      tools.finishHighlightedExterior?.();
      return;
    }
    tools.confirmExteriorWalls?.();
  };

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
          disabled={tools.wallDetectionBusy}
          onClick={tools.detectExterior}
          testId="tool-detect-exterior"
        >
          {tools.wallDetectionBusy ? "Detecting Exterior..." : "Detect Exterior"}
        </ToolButton>
        <ToolButton
          active={tools.activeTool === "exterior-wall"}
          onClick={tools.traceMissingExteriorSections || (() => tools.setActiveTool("exterior-wall"))}
          testId="tool-trace-exterior"
        >
          Trace Missing Sections
        </ToolButton>
        <ToolButton
          disabled={!hasWalls || wallsConfirmed || tools.wallDetectionBusy}
          onClick={finishExterior}
          testId="tool-finish-exterior"
        >
          Finish Exterior
        </ToolButton>
        <ToolButton
          active={tools.activeTool === "edit-walls"}
          disabled={!hasWalls}
          onClick={() => tools.setActiveTool("edit-walls")}
          testId="tool-edit-exterior"
        >
          Edit Exterior
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

        {page?.planRegion?.confirmed ? (
          <>
            <span style={S.wallStatus} data-testid="plan-region-status">Plan region set</span>
            <button type="button" style={S.miniButton} onClick={() => tools.setActiveTool("plan-region")} data-testid="plan-region-adjust">
              Adjust Region
            </button>
            <button type="button" style={S.miniButton} onClick={tools.clearPlanRegion} data-testid="plan-region-clear">
              Clear Region
            </button>
          </>
        ) : tools.activeTool === "plan-region" ? (
          <>
            <span style={S.wallMessage} data-testid="plan-region-hint">
              {tools.planRegionDraftCorner ? "Click the opposite corner to finish." : "Click one corner of the floor plan area."}
            </span>
            {tools.suggestedPlanRegion && !tools.planRegionDraftCorner && (
              <button type="button" style={S.miniButton} onClick={tools.acceptSuggestedPlanRegion} data-testid="plan-region-accept-suggested">
                Accept Plan Region
              </button>
            )}
            <button type="button" style={S.miniButton} onClick={() => tools.setActiveTool("select")} data-testid="plan-region-cancel">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" style={S.miniButton} onClick={() => tools.setActiveTool("plan-region")} data-testid="plan-region-select-manually">
            Select Region Manually
          </button>
        )}

        {tools.activeTool === "area" && (
          <>
            <SegmentedButton active={tools.areaMode === "room-detect"} onClick={() => tools.setAreaMode("room-detect")} testId="area-mode-room-detect">
              Room Detect
            </SegmentedButton>
            <SegmentedButton active={tools.areaMode === "rectangle"} onClick={() => tools.setAreaMode("rectangle")} testId="area-mode-rectangle">
              Rectangle
            </SegmentedButton>
            <SegmentedButton active={tools.areaMode === "manual-polygon"} onClick={() => tools.setAreaMode("manual-polygon")} testId="area-mode-manual-polygon">
              Manual Polygon
            </SegmentedButton>
            <button
              type="button"
              style={S.miniButton}
              disabled={tools.areaMode !== "manual-polygon" || tools.areaDraftVertices.length < 3}
              onClick={tools.finishAreaTrace}
              data-testid="area-finish-trace"
            >
              Finish Area
            </button>
            {tools.areaDraftVertices.length > 0 && (
              <button type="button" style={S.miniButton} onClick={tools.cancelAreaTrace} data-testid="area-cancel-trace">
                Cancel Trace
              </button>
            )}
            {tools.areaMode === "room-detect" && (
              <span style={S.wallStatus} data-testid="area-room-detect-hint">Click inside a room to detect its wall boundary.</span>
            )}
            {tools.areaMode === "rectangle" && (
              <span style={S.wallStatus} data-testid="area-rectangle-hint">Drag over a room. The rectangle is only a search region.</span>
            )}
            {wallsConfirmed && tools.areaValidation.valid && (
              <button type="button" style={S.miniButton} onClick={() => tools.setAreaDialogOpen(true)} data-testid="area-from-exterior">
                Create Area From Exterior Walls
              </button>
            )}
          </>
        )}

        {tools.activeTool === "exterior-highlighter" && (
          <span style={S.wallStatus} data-testid="exterior-highlighter-hint">
            Hover a wall. Click the blue preview to highlight or unhighlight it.
          </span>
        )}
        {tools.activeTool === "exterior-highlighter" && (
          <span style={S.wallStatus} data-testid="detected-wall-summary">
            Highlighted: {tools.exteriorHighlightedWalls?.length || tools.exteriorHighlightedWallIds?.length || 0}
          </span>
        )}

        {hasWalls && (
          <span style={S.wallStatus} data-testid="wall-status">
            {wallsConfirmed
              ? `Exterior walls confirmed - Total perimeter: ${formatLength(tools.totalPerimeterMm || 0)}`
              : wallStatusText(page, tools)}
          </span>
        )}
        {tools.wallDetectionMessage && (
          <span style={tools.wallDetectionStatus === "incomplete" ? S.wallWarning : S.wallMessage} data-testid="wall-detection-message">{tools.wallDetectionMessage}</span>
        )}
        {hasWalls && !wallsConfirmed && (
          <>
            <button type="button" style={S.miniButton} onClick={tools.confirmExteriorWalls} disabled={!tools.wallValidation?.valid} data-testid="accept-detected-exterior">
              Accept Detected
            </button>
            <button type="button" style={S.miniButton} onClick={tools.traceMissingExteriorSections} data-testid="trace-missing-sections">
              Trace Missing Sections
            </button>
            <button type="button" style={S.miniButton} onClick={tools.requestClearExterior} data-testid="clear-candidate">
              Clear Candidate
            </button>
          </>
        )}
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
        <ProgressItem label="Orientation" state={readiness.orientation} />
        <ProgressItem label="Scale" state={readiness.scale} />
        <ProgressItem label="Exterior Walls" state={readiness.exterior} />
      </div>
      {tools.activeTool === "exterior-wall" && (
        <div style={S.traceStatusBar} data-testid="trace-exterior-status-bar">
          <strong>Trace Exterior active</strong>
          <span>Points: {traceStatus.points}</span>
          <span>Current segment: {traceStatus.currentSegment}</span>
          <span>Total traced: {traceStatus.totalTraced}</span>
          <span>Click: add point</span>
          <span>Space + drag: pan</span>
          <span>Mouse wheel: zoom</span>
          <span>Esc: cancel preview</span>
        </div>
      )}
      {tools.activeTool === "edit-walls" && (
        <div style={S.traceStatusBar} data-testid="edit-exterior-status-bar">
          <strong>Edit Exterior active</strong>
          <span>Selected point: {selectedPointIndex(page, tools)}</span>
          <span>Drag to reposition</span>
          <span>Alt: disable snap</span>
          <span>Delete: remove selected point</span>
          {tools.wallEditValidation?.valid === false && <span style={S.invalidText}>{tools.wallEditValidation.message}</span>}
        </div>
      )}
      <div style={readiness.ready ? S.readyText : S.notReadyText} data-testid="measurement-readiness">
        {readiness.ready ? "Ready for measurement" : "Measurements locked until orientation, scale, and exterior walls are confirmed."}
      </div>
    </div>
  );
}

function exteriorTraceStatus(page, tools) {
  const graph = page?.exteriorWalls || {};
  const vertices = graph.vertices || [];
  const currentVertex = vertices.find((v) => v.id === tools.wallDrawChainVertexId) || null;
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || null;
  const hoverPoint = tools.wallDrawHoverPreview?.point || null;
  const currentMm = currentVertex && hoverPoint && mmPerDocumentUnit
    ? distance(currentVertex, hoverPoint) * mmPerDocumentUnit
    : null;
  return {
    points: vertices.length,
    currentSegment: currentMm == null ? "-" : formatLength(currentMm),
    totalTraced: formatLength(tools.totalExteriorWallLengthMm || tools.totalPerimeterMm || 0),
  };
}

function selectedPointIndex(page, tools) {
  if (!tools.selectedVertexId) return "-";
  const vertices = page?.exteriorWalls?.vertices || [];
  const index = vertices.findIndex((vertex) => vertex.id === tools.selectedVertexId);
  return index >= 0 ? String(index + 1) : "-";
}

function SegmentedButton({ children, active, onClick, testId }) {
  return (
    <button
      type="button"
      style={{ ...S.segmentedButton, ...(active ? S.segmentedButtonActive : null) }}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </button>
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
  const scale = validateCalibrationShape(page?.calibration);
  if (page?.calibration) {
    const c = page.calibration;
    const alignment = c.axis === "horizontal" ? "Horizontal" : "Vertical";
    return `${scale.label} - Calibration line: ${formatLength(c.actualLengthMm)} - Alignment: ${alignment}`;
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

function wallStatusText(page, tools) {
  const walls = page?.exteriorWalls || {};
  const stats = tools?.exteriorCandidateStats || {};
  const isManualTrace = walls.source === "manual-trace-v2" || walls.segments?.some((segment) => segment.source === "manual");
  if (!isManualTrace && (walls.detectionUseful === false || tools.wallDetectionStatus === "incomplete")) {
    return "Exterior detection failed - no valid closed building perimeter found";
  }
  if (walls.exteriorPerimeter?.closed) {
    return `Exterior candidate found - Boundary corners: ${stats.corners || walls.vertices?.length || 0} - Detected exterior wall sections: ${stats.detectedSegments || 0} - Missing sections: ${stats.missingSections || 0}`;
  }
  return "Exterior needs review";
}

function workflowReadiness(page, tools) {
  const orientationConfirmed = Boolean(page?.orientationSource === "manual" || (page?.orientationConfidence ?? 0) >= CONFIDENCE_HIGH);
  const scale = validateCalibrationShape(page?.calibration);
  const scaleState = !page?.calibration
    ? (tools.activeTool === "set-scale" ? "In progress" : "Not started")
    : (scale.status === "confirmed" ? "Confirmed" : scale.status === "invalid" ? "Failed" : "Needs review");
  const exteriorStats = tools?.exteriorCandidateStats || {};
  const exteriorState = !page?.exteriorWalls?.segments?.length
    ? (tools.wallDetectionBusy ? "In progress" : tools.wallDetectionStatus === "incomplete" ? "Failed" : "Not started")
    : (page.exteriorWalls.confirmed ? "Confirmed" : (exteriorStats.missingSections > 0 ? "Needs completion" : "Needs review"));
  return {
    orientation: orientationConfirmed ? "Confirmed" : (page?.orientationSource ? "Needs review" : "Not started"),
    scale: scaleState,
    exterior: exteriorState,
    ready: orientationConfirmed && scale.status === "confirmed" && exteriorState === "Confirmed",
  };
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

function ProgressItem({ label, state }) {
  const confirmed = state === "Confirmed";
  const failed = state === "Failed";
  return (
    <span style={S.progressItem}>
      <span style={{ ...S.progressDot, background: confirmed ? "#16a34a" : failed ? "#dc2626" : "#f59e0b" }} />
      {label}:
      <span style={S.progressState}>{state}</span>
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
  wallWarning: { fontWeight: 800, color: "#b45309" },
  miniButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  miniButtonActive: { background: "#f59e0b", color: "#fff", border: "1px solid #f59e0b" },
  segmentedButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  segmentedButtonActive: { background: "#7c3aed", color: "#fff", border: "1px solid #7c3aed" },
  progressRow: { display: "flex", gap: 16, fontSize: 12, color: "#334155" },
  traceStatusBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    width: "fit-content",
    maxWidth: "100%",
    border: "1px solid #bfdbfe",
    background: "#fff",
    color: "#1e3a8a",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 700,
  },
  invalidText: { color: "#b91c1c", fontWeight: 900 },
  progressItem: { display: "flex", alignItems: "center", gap: 6, fontWeight: 700 },
  progressDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  progressState: { fontWeight: 500, color: "#64748b" },
  readyText: { fontSize: 12, fontWeight: 800, color: "#166534" },
  notReadyText: { fontSize: 12, fontWeight: 800, color: "#92400e" },
};
