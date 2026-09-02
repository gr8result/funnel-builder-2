import { useState } from "react";
import { formatLength, formatArea } from "../takeoff/units.js";
import { validateCalibrationShape } from "../takeoff/scaleCalibration.js";
import { CONFIDENCE_HIGH } from "../orientation/analyzeOrientation.js";

// The takeoff toolbar: always visible above the plan viewer, never hidden in
// a menu. The primary row is the spec's exact required tool/action list —
// Select, Pan, Set Scale, Detect Walls, Draw Exterior, Edit Exterior,
// Delete Segment, Close Shape, Clear Exterior, Area Tool, Undo, Redo — with
// Delete Segment and Close Shape as flat, always-visible action buttons
// (never tucked into a submenu), enabled only when they'd actually do
// something. Confirm Exterior Walls / Confirm Area are one-time workflow
// gates rather than persistent tools, so they live as contextual actions in
// the status row below, alongside scale/detection/close-shape feedback.
export default function TakeoffToolbar({ page, tools, focusMode = false, onToggleFocus, onRotateLeft, onRotateRight, onResetRotation, onConfirmOrientation }) {
  const [openPopover, setOpenPopover] = useState(null);
  const hasCalibration = Boolean(page?.calibration);
  const hasWalls = Boolean(page?.exteriorWalls?.vertices?.length);
  const wallsConfirmed = Boolean(page?.exteriorWalls?.confirmed);
  const measurementCount = page?.measurements?.length || 0;
  const exteriorThickness = page?.exteriorWalls?.wallThicknessMm ?? 250;
  const exteriorConstruction = page?.exteriorWalls?.constructionType || "brick_veneer";
  const interiorThickness = page?.internalWalls?.wallThicknessMm ?? 90;

  const areaDone = Boolean(page?.areas?.some((a) => a.confirmed));
  const traceStatus = exteriorTraceStatus(page, tools);
  const canCloseActiveShape = Boolean(
    tools.canCloseShape ||
    (tools.activeTool === "area" && tools.areaMode === "manual-polygon" && tools.areaDraftVertices.length >= 3)
  );
  const closeShape = () => {
    if (tools.activeTool === "internal-wall") {
      if (!tools.wallDrawChainStartVertexId || !tools.wallDrawChainVertexId) return;
      tools.closeWallPerimeter?.("internalWalls", {
        startVertexId: tools.wallDrawChainStartVertexId,
        endVertexId: tools.wallDrawChainVertexId,
      });
      return;
    }
    if (tools.activeTool === "area" && tools.areaMode === "manual-polygon") {
      tools.finishAreaTrace?.();
      return;
    }
    if (!tools.wallDrawChainStartVertexId || !tools.wallDrawChainVertexId) return;
    tools.closeWallPerimeter?.("exteriorWalls", {
      startVertexId: tools.wallDrawChainStartVertexId,
      endVertexId: tools.wallDrawChainVertexId,
    });
  };
  const readinessBadges = workflowReadiness(page, tools);
  const orientationNeedsReview = readinessBadges.orientation !== "Confirmed";
  const scaleNeedsSetting = readinessBadges.scale !== "Confirmed";
  const activePopover = (name) => openPopover === name;
  const togglePopover = (name) => setOpenPopover((current) => current === name ? null : name);
  const wallSummary = wallSetupSummary({ exteriorConstruction, exteriorThickness, interiorThickness });

  return (
    <div style={S.wrap} data-testid="takeoff-toolbar">
      <div style={S.setupRow} data-testid="plan-setup-row">
        <span style={S.setupTitle}>Plan Setup</span>
        <section style={{ ...S.setupGroup, ...(orientationNeedsReview ? S.setupGroupActive : null) }} data-testid="orientation-setup">
          <span style={S.setupLabel}>Orientation</span>
          <strong style={orientationNeedsReview ? S.needsText : S.confirmedText}>
            {orientationNeedsReview ? "Needs review" : "Confirmed"}
          </strong>
          <button type="button" style={S.setupButton} onClick={onRotateLeft} data-testid="rotate-left-button">Rotate Left</button>
          <button type="button" style={S.setupButton} onClick={onRotateRight} data-testid="rotate-right-button">Rotate Right</button>
          <button type="button" style={S.setupButton} onClick={onResetRotation} data-testid="reset-rotation-button">Reset</button>
          {orientationNeedsReview && <button type="button" style={S.primarySetupButton} onClick={onConfirmOrientation} data-testid="confirm-orientation-button">Confirm</button>}
        </section>
        <section style={{ ...S.setupGroup, ...(!orientationNeedsReview && scaleNeedsSetting ? S.setupGroupActive : null) }} data-testid="scale-setup">
          <span style={S.setupLabel}>Scale</span>
          <strong style={scaleNeedsSetting ? S.needsText : S.confirmedText}>{scaleSetupLabel(page, tools)}</strong>
          <button type="button" style={scaleNeedsSetting ? S.primarySetupButton : S.setupButton} onClick={() => tools.setActiveTool("set-scale")} data-testid="tool-set-scale">
            {hasCalibration ? "Recalibrate" : "Set Scale"}
          </button>
          {hasCalibration && <button type="button" style={S.setupButton} onClick={tools.clearScale} data-testid="clear-scale-button">Clear</button>}
        </section>
        <section style={S.setupGroup} data-testid="wall-setup-summary">
          <span style={S.setupLabel}>Walls</span>
          <strong style={S.wallSummary}>{wallSummary}</strong>
          <PopoverButton active={activePopover("walls")} onClick={() => togglePopover("walls")} testId="wall-settings-button">
            Wall Settings
          </PopoverButton>
        </section>
        <span style={S.spacer} />
        <PopoverButton active={activePopover("debug")} onClick={() => togglePopover("debug")} testId="debug-menu-button">
          Debug
        </PopoverButton>
        <ToolButton active={focusMode} onClick={onToggleFocus} testId="focus-plan-button">
          {focusMode ? "Exit Focus" : "Focus Plan"}
        </ToolButton>
      </div>
      <div style={S.buttonRow} data-testid="takeoff-tools-row">
        <ToolButton active={tools.activeTool === "select"} onClick={() => tools.setActiveTool("select")} testId="tool-select">
          Select
        </ToolButton>
        <ToolButton active={tools.activeTool === "pan"} onClick={() => tools.setActiveTool("pan")} testId="tool-pan">
          Pan
        </ToolButton>
        <span style={S.divider} />
        <ToolButton
          active={tools.activeTool === "exterior-wall"}
          onClick={() => tools.setActiveTool("exterior-wall")}
          testId="tool-exterior-wall"
        >
          Exterior Wall Detection
        </ToolButton>
        <ToolButton
          active={tools.activeTool === "internal-wall"}
          onClick={() => tools.setActiveTool("internal-wall")}
          testId="tool-interior-wall"
        >
          Interior Wall
        </ToolButton>
        <ToolButton active={tools.activeTool === "area"} onClick={() => { tools.setActiveTool("area"); tools.setAreaMode?.("manual-polygon"); }} testId="tool-room-area">
          Room / Area
        </ToolButton>
        <span style={S.divider} />
        <ToolButton active={tools.activeTool === "door"} disabled={!wallsConfirmed} onClick={() => tools.setActiveTool("door")} testId="tool-door">
          Door
        </ToolButton>
        <ToolButton active={tools.activeTool === "window"} disabled={!wallsConfirmed} onClick={() => tools.setActiveTool("window")} testId="tool-window">
          Window
        </ToolButton>
        <ToolButton active={tools.activeTool === "opening"} disabled={!wallsConfirmed} onClick={() => tools.setActiveTool("opening")} testId="tool-opening">
          Opening
        </ToolButton>
        <ToolButton active={tools.activeTool === "garage-door"} disabled={!wallsConfirmed} onClick={() => tools.setActiveTool("garage-door")} testId="tool-garage-door">
          Garage Door
        </ToolButton>
        <span style={S.divider} />
        <ToolButton active={tools.activeTool === "add-corner"} onClick={() => tools.setActiveTool("add-corner")} testId="tool-add-corner">
          Add Corner
        </ToolButton>
        <ToolButton active={tools.activeTool === "move-corner"} onClick={() => tools.setActiveTool("move-corner")} testId="tool-move-corner">
          Move Corner
        </ToolButton>
        <ToolButton disabled={!tools.canDeleteWallSelection} onClick={tools.deleteSelectedWallItem} testId="tool-delete">
          Delete
        </ToolButton>
        <ToolButton
          disabled={!canCloseActiveShape}
          onClick={closeShape}
          testId="tool-close-shape"
        >
          Close Shape
        </ToolButton>
        <ToolButton onClick={tools.clearSelection} testId="tool-clear-selection">
          Clear Selection
        </ToolButton>
        <span style={S.divider} />
        <ToolButton disabled={!tools.canUndo} onClick={tools.undo} testId="tool-undo">
          Undo
        </ToolButton>
        <ToolButton disabled={!tools.canRedo} onClick={tools.redo} testId="tool-redo">
          Redo
        </ToolButton>
        <span style={S.spacer} />
        <PopoverButton active={activePopover("view")} onClick={() => togglePopover("view")} testId="view-menu-button">
          View
        </PopoverButton>
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

      <div style={S.statusStrip} data-testid="workflow-progress">
        <ProgressItem label="Orientation" state={readinessBadges.orientation} />
        <ProgressItem label="Scale" state={readinessBadges.scale} />
        <ProgressItem label="Exterior" state={readinessBadges.exterior} />
        {hasWalls && <span style={S.wallStatus} data-testid="wall-status">{wallsConfirmed ? `Perimeter ${formatLength(tools.totalPerimeterMm || 0)}` : wallStatusText(page, tools)}</span>}
        {areaDone && <span style={S.wallStatus} data-testid="area-status">Area {formatArea(page.areas.find((a) => a.confirmed)?.confirmedAreaM2 || 0)}</span>}
        {tools.wallDetectionMessage && <span style={tools.wallDetectionStatus === "incomplete" ? S.wallWarning : S.wallMessage} data-testid="wall-detection-message">{tools.wallDetectionMessage}</span>}
        {closeShapeFeedback(tools)}
      </div>

      <div style={S.popoverLayer}>
        {activePopover("walls") && (
          <div style={S.popover} data-testid="wall-settings-popover">
            <div style={S.popoverTitle}>Wall Settings</div>
            <div style={S.settingsGrid} data-testid="wall-thickness-controls">
              <label style={S.fieldLabel}>
                Exterior construction
                <select
                  value={exteriorConstruction}
                  onChange={(event) => {
                    const constructionType = event.target.value;
                    const defaultThickness = constructionType === "lightweight_cladding" ? 90 : constructionType === "brick_veneer" ? 250 : exteriorThickness;
                    tools.setWallThicknessDefaults?.("exteriorWalls", { constructionType, wallThicknessMm: defaultThickness });
                  }}
                  style={S.select}
                  data-testid="exterior-construction-select"
                >
                  <option value="lightweight_cladding">Lightweight / Cladding</option>
                  <option value="brick_veneer">Brick Veneer</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label style={S.fieldLabel}>
                Exterior thickness
                <span style={S.inlineControls}>
                  <ThicknessInput
                    value={exteriorThickness}
                    presets={exteriorConstruction === "lightweight_cladding" ? [70, 90] : exteriorConstruction === "brick_veneer" ? [230, 250] : []}
                    onChange={(wallThicknessMm) => tools.setWallThicknessDefaults?.("exteriorWalls", { wallThicknessMm })}
                    testId="exterior-thickness"
                  />
                </span>
              </label>
              <label style={S.lockLabel}>
                <input
                  type="checkbox"
                  checked={Boolean(page?.exteriorWalls?.thicknessLocked)}
                  onChange={(event) => tools.setWallThicknessDefaults?.("exteriorWalls", { thicknessLocked: event.target.checked })}
                  data-testid="exterior-thickness-lock"
                />
                Lock Exterior Thickness
              </label>
              <label style={S.fieldLabel}>
                Interior thickness
                <span style={S.inlineControls}>
                  <ThicknessInput
                    value={interiorThickness}
                    presets={[70, 90]}
                    onChange={(wallThicknessMm) => tools.setWallThicknessDefaults?.("internalWalls", { wallThicknessMm })}
                    testId="interior-thickness"
                  />
                </span>
              </label>
              <label style={S.lockLabel}>
                <input
                  type="checkbox"
                  checked={Boolean(page?.internalWalls?.thicknessLocked)}
                  onChange={(event) => tools.setWallThicknessDefaults?.("internalWalls", { thicknessLocked: event.target.checked })}
                  data-testid="interior-thickness-lock"
                />
                Lock Interior Thickness
              </label>
            </div>
          </div>
        )}

        {activePopover("view") && (
          <div style={S.popover} data-testid="view-popover">
            <div style={S.popoverTitle}>View</div>
            <div style={S.popoverActions}>
              <button type="button" style={S.miniButton} onClick={() => tools.setActiveTool("plan-region")} data-testid="plan-region-select-manually">Select Region</button>
              {page?.planRegion?.confirmed && <button type="button" style={S.miniButton} onClick={tools.clearPlanRegion} data-testid="plan-region-clear">Clear Region</button>}
              {measurementCount > 0 && <button type="button" style={S.miniButton} onClick={tools.clearMeasurements} data-testid="tool-clear-measurements">Clear Measurements</button>}
              {hasWalls && !wallsConfirmed && <button type="button" style={S.miniButton} onClick={tools.confirmExteriorWalls} disabled={!tools.wallValidation?.valid} data-testid="accept-detected-exterior">Accept Detected</button>}
              {hasWalls && !wallsConfirmed && <button type="button" style={S.miniButton} onClick={tools.traceMissingExteriorSections} data-testid="trace-missing-sections">Trace Missing Sections</button>}
              {hasWalls && !wallsConfirmed && <button type="button" style={S.miniButton} onClick={tools.requestClearExterior} data-testid="clear-candidate">Clear Candidate</button>}
              {wallsConfirmed && tools.areaValidation.valid && <button type="button" style={S.miniButton} onClick={() => tools.setAreaDialogOpen(true)} data-testid="tool-confirm-area">Confirm Area</button>}
            </div>
          </div>
        )}

        {activePopover("debug") && (
          <div style={S.popover} data-testid="debug-popover">
            <div style={S.popoverTitle}>Debug</div>
            <label style={S.lockLabel}>
              <input
                type="checkbox"
                checked={Boolean(tools.structuralGraphDebugEnabled)}
                onChange={(event) => tools.setStructuralGraphDebugEnabled?.(event.target.checked)}
                data-testid="show-structural-graph-toggle"
              />
              Structural Graph
            </label>
            <label style={S.lockLabel}>
              <input
                type="checkbox"
                checked={Boolean(tools.wallSnapDebugEnabled)}
                onChange={(event) => tools.setWallSnapDebugEnabled?.(event.target.checked)}
                data-testid="show-wall-faces-toggle"
              />
              Show Wall Faces
            </label>
            <label style={S.lockLabel}>
              <input type="checkbox" disabled />
              Snap Diagnostics
            </label>
          </div>
        )}
      </div>

      {tools.activeTool === "area" && (
        <div style={S.contextStrip} data-testid="area-toolbar-strip">
          <SegmentedButton active={tools.areaMode === "rectangle"} onClick={() => tools.setAreaMode("rectangle")} testId="area-mode-rectangle">Rectangle</SegmentedButton>
          <SegmentedButton active={tools.areaMode === "manual-polygon"} onClick={() => tools.setAreaMode("manual-polygon")} testId="area-mode-manual-polygon">Manual Polygon</SegmentedButton>
          <button type="button" style={S.miniButton} disabled={tools.areaMode !== "manual-polygon" || tools.areaDraftVertices.length < 3} onClick={tools.finishAreaTrace} data-testid="area-finish-trace">Finish Area</button>
          {tools.areaDraftVertices.length > 0 && <button type="button" style={S.miniButton} onClick={tools.cancelAreaTrace} data-testid="area-cancel-trace">Cancel Trace</button>}
          {wallsConfirmed && tools.areaValidation.valid && <button type="button" style={S.miniButton} onClick={() => tools.setAreaDialogOpen(true)} data-testid="area-from-exterior">Create Area From Exterior</button>}
        </div>
      )}
      {(tools.activeTool === "exterior-wall" || tools.activeTool === "internal-wall") && (
        <div style={S.traceStatusBar} data-testid="trace-exterior-status-bar">
          <strong>{tools.activeTool === "internal-wall" ? "Interior Wall active - click inside a physical wall band" : "Exterior Wall Detection active - click inside a physical exterior wall band"}</strong>
          <span>Resolved runs: {traceStatus.segments}</span>
          <span>{tools.activeTool === "internal-wall" ? "Confirmed length" : "Approved length"}: {traceStatus.approvedLength}</span>
          <span>Click: seed wall-face detection</span>
          <span>Space + drag: pan</span>
          <span>Mouse wheel: zoom</span>
          <span>Esc: clear current preview</span>
        </div>
      )}
      {["select", "move-corner", "add-corner", "edit-walls"].includes(tools.activeTool) && (
        <div style={S.traceStatusBar} data-testid="edit-exterior-status-bar">
          <strong>{tools.activeTool === "add-corner" ? "Add Corner active" : tools.activeTool === "move-corner" ? "Move Corner active" : "Select active"}</strong>
          <span>Selected point: {selectedPointIndex(page, tools)}</span>
          <span>Click wall: select</span>
          <span>Drag corner: reposition</span>
          <span>Double-click wall: split</span>
          <span>Alt: disable snap</span>
          <span>Delete: remove selected point</span>
          {tools.wallEditValidation?.valid === false && <span style={S.invalidText}>{tools.wallEditValidation.message}</span>}
        </div>
      )}
      <div style={readinessBadges.ready ? S.readyText : S.notReadyText} data-testid="measurement-readiness">
        {readinessBadges.ready ? "Ready" : "Measurements locked"}
      </div>
    </div>
  );
}

function exteriorTraceStatus(page, tools) {
  const field = tools.activeTool === "internal-wall" ? "internalWalls" : "exteriorWalls";
  const graph = page?.[field] || {};
  const lengthMm = field === "internalWalls"
    ? (tools.totalInternalWallLengthMm || 0)
    : (tools.totalConfirmedExteriorWallLengthMm || 0);
  return {
    segments: graph.segments?.length || 0,
    approvedLength: formatLength(lengthMm),
  };
}

function selectedPointIndex(page, tools) {
  if (!tools.selectedVertexId) return "-";
  const vertices = page?.exteriorWalls?.vertices || [];
  const index = vertices.findIndex((vertex) => vertex.id === tools.selectedVertexId);
  return index >= 0 ? String(index + 1) : "-";
}

function ThicknessInput({ value, presets, onChange, testId }) {
  const numericValue = Number(value);
  const presetValue = presets.includes(numericValue) ? String(numericValue) : "custom";
  return (
    <>
      {presets.length > 0 && (
        <select
          value={presetValue}
          onChange={(event) => {
            if (event.target.value === "custom") return;
            onChange(Number(event.target.value));
          }}
          style={S.select}
          data-testid={`${testId}-preset`}
        >
          {presets.map((preset) => <option key={preset} value={preset}>{preset} mm</option>)}
          <option value="custom">Custom</option>
        </select>
      )}
      {(presetValue === "custom" || presets.length === 0) && (
        <input
          type="number"
          min="1"
          step="10"
          value={Number.isFinite(numericValue) ? numericValue : ""}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next > 0) onChange(next);
          }}
          style={S.numberInput}
          data-testid={`${testId}-custom`}
        />
      )}
    </>
  );
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

function scaleSetupLabel(page, tools) {
  const scale = validateCalibrationShape(page?.calibration);
  if (!page?.calibration) return tools.activeTool === "set-scale" ? "Setting" : "Needs setting";
  if (scale.status !== "confirmed") return "Needs review";
  return `Confirmed ${formatLength(page.calibration.actualLengthMm)}`;
}

function wallSetupSummary({ exteriorConstruction, exteriorThickness, interiorThickness }) {
  const exteriorLabel = exteriorConstruction === "brick_veneer"
    ? "Brick"
    : exteriorConstruction === "lightweight_cladding"
      ? "Lightweight"
      : "Custom";
  return `Ext ${exteriorLabel} ${exteriorThickness}mm | Int ${interiorThickness}mm`;
}

function wallStatusText(page, tools) {
  if (tools.activeTool === "exterior-wall" || tools.activeTool === "internal-wall") {
    return "Manual wall mode - local physical wall snap only";
  }
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

function PopoverButton({ children, active, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{ ...S.popoverButton, ...(active ? S.popoverButtonActive : null) }}
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
  wrap: { position: "relative", flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 0, borderBottom: "1px solid #cbd5e1", background: "#ffffff", zIndex: 30, overflow: "visible", boxSizing: "border-box" },
  setupRow: { height: 44, display: "flex", alignItems: "center", gap: 7, padding: "3px 8px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", overflowX: "auto", overflowY: "visible", boxSizing: "border-box" },
  setupTitle: { flex: "0 0 auto", color: "#0f172a", fontSize: 12, fontWeight: 950, letterSpacing: 0, textTransform: "uppercase" },
  setupGroup: { flex: "0 0 auto", minHeight: 29, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 6px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", color: "#334155", boxSizing: "border-box" },
  setupGroupActive: { border: "1px solid #f59e0b", background: "#fffbeb", boxShadow: "0 0 0 2px rgba(245,158,11,0.14)" },
  setupLabel: { color: "#64748b", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em" },
  confirmedText: { color: "#15803d", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" },
  needsText: { color: "#b45309", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" },
  wallSummary: { color: "#0f172a", fontSize: 12, fontWeight: 850, whiteSpace: "nowrap" },
  setupButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 5, padding: "3px 7px", fontSize: 11, fontWeight: 850, cursor: "pointer", whiteSpace: "nowrap" },
  primarySetupButton: { border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  buttonRow: { display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", minHeight: 44, padding: "5px 8px", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "thin", boxSizing: "border-box" },
  button: { border: "1px solid #cbd5e1", background: "#fff", color: "#1e3a8a", borderRadius: 5, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  buttonActive: { background: "#1d4ed8", color: "#fff", border: "1px solid #1d4ed8" },
  buttonDisabled: { opacity: 0.45, cursor: "not-allowed" },
  popoverButton: { border: "1px solid #94a3b8", background: "#f8fafc", color: "#0f172a", borderRadius: 5, padding: "6px 8px", fontSize: 12, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  popoverButtonActive: { background: "#0f172a", color: "#fff", border: "1px solid #0f172a" },
  spacer: { flex: 1, minWidth: 8 },
  divider: { width: 1, alignSelf: "stretch", background: "#e2e8f0", margin: "0 2px", flex: "0 0 auto" },
  confirmBar: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 700, color: "#7f1d1d", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 10px" },
  confirmDanger: { border: "1px solid #b91c1c", background: "#dc2626", color: "#fff", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  statusStrip: { display: "none" },
  contextStrip: { position: "absolute", left: 10, top: 96, zIndex: 25, display: "flex", alignItems: "center", gap: 6, minHeight: 30, fontSize: 12, flexWrap: "wrap", padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: 7, background: "rgba(255,255,255,0.94)", boxShadow: "0 8px 24px rgba(15,23,42,0.14)" },
  popoverLayer: { position: "absolute", top: 40, right: 8, zIndex: 50 },
  popover: { width: 320, maxWidth: "min(360px, calc(100vw - 32px))", display: "flex", flexDirection: "column", gap: 10, padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", boxShadow: "0 18px 48px rgba(15, 23, 42, 0.20)", color: "#0f172a" },
  popoverTitle: { fontSize: 13, fontWeight: 950, color: "#0f172a" },
  popoverText: { fontSize: 12, lineHeight: 1.35, color: "#334155", fontWeight: 700 },
  popoverActions: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  settingsGrid: { display: "grid", gap: 10 },
  fieldLabel: { display: "grid", gap: 5, color: "#334155", fontSize: 12, fontWeight: 850 },
  inlineControls: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  scaleStatus: { fontWeight: 800, color: "#1e3a8a" },
  wallStatus: { fontWeight: 700, color: "#166534" },
  wallMessage: { fontWeight: 600, color: "#b91c1c" },
  wallWarning: { fontWeight: 800, color: "#b45309" },
  miniButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  inlineLabel: { display: "inline-flex", alignItems: "center", gap: 6, color: "#334155", fontWeight: 800 },
  lockLabel: { display: "inline-flex", alignItems: "center", gap: 5, color: "#334155", fontWeight: 700 },
  select: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 5, padding: "3px 6px", fontSize: 11, fontWeight: 700 },
  numberInput: { width: 72, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 5, padding: "3px 6px", fontSize: 11, fontWeight: 700 },
  miniButtonActive: { background: "#f59e0b", color: "#fff", border: "1px solid #f59e0b" },
  segmentedButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  segmentedButtonActive: { background: "#7c3aed", color: "#fff", border: "1px solid #7c3aed" },
  traceStatusBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    position: "absolute",
    top: 96,
    left: 10,
    zIndex: 25,
    width: "fit-content",
    maxWidth: "100%",
    border: "1px solid #bfdbfe",
    background: "#fff",
    color: "#1e3a8a",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  invalidText: { color: "#b91c1c", fontWeight: 900 },
  progressItem: { display: "flex", alignItems: "center", gap: 5, fontWeight: 800, whiteSpace: "nowrap" },
  progressDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  progressState: { fontWeight: 500, color: "#64748b" },
  readyText: { display: "none" },
  notReadyText: { display: "none" },
};
