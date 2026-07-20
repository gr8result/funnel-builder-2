import React from "react";
import type { TakeoffPage, ViewportState } from "../state/takeoffTypes";

export default function PlanToolbar({
  page,
  viewport,
  activeTool,
  onToolChange,
  onRotateLeft,
  onRotateRight,
  onResetAutomatic,
  onConfirmOrientation,
  onFitPage,
  onFitWidth,
  onZoomPreset,
  onDeleteSelected,
  onUndo,
  onRedo,
  onRunAiDetection,
  onConfirmAll,
  onRejectSelected,
  onClearAiResults,
  canUndo = false,
  canRedo = false,
}: {
  page: TakeoffPage | null;
  viewport: ViewportState;
  activeTool: string;
  onToolChange: (tool: string) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetAutomatic: () => void;
  onConfirmOrientation: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onZoomPreset: (scale: number) => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRunAiDetection: () => void;
  onConfirmAll: () => void;
  onRejectSelected: () => void;
  onClearAiResults: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const disabled = !page;
  const scaleConfirmed = page?.scaleStatus === "confirmed";
  const tools = [
    ["select", "Select"],
    ["pan", "Pan"],
    ["scale", "Set Scale"],
    ...(scaleConfirmed ? [
      ["measure", "Measure"],
      ["polyline", "Polyline"],
      ["exteriorWall", "Exterior Wall"],
      ["interiorWall", "Interior Wall"],
      ["room", "Room"],
      ["door", "Door"],
      ["window", "Window"],
      ["opening", "Opening"],
    ] : []),
  ];

  return (
    <div style={styles.toolbar} data-takeoff-engine-controls>
      <div style={styles.group}>
        {tools.map(([tool, label]) => (
          <button
            key={tool}
            type="button"
            style={activeTool === tool ? styles.activeButton : styles.button}
            disabled={disabled}
            onClick={() => onToolChange(tool)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.group}>
        <button type="button" style={styles.button} disabled={disabled} onClick={onRotateLeft}>Rotate Left</button>
        <button type="button" style={styles.button} disabled={disabled} onClick={onRotateRight}>Rotate Right</button>
        <button type="button" style={styles.button} disabled={disabled} onClick={onResetAutomatic}>Reset Orientation</button>
        <button type="button" style={styles.primaryButton} disabled={disabled} onClick={onConfirmOrientation}>Confirm Orientation</button>
      </div>
      <div style={styles.group}>
        <button type="button" style={styles.button} disabled={disabled} onClick={onFitPage}>Fit Page</button>
        <button type="button" style={styles.button} disabled={disabled} onClick={onFitWidth}>Fit Width</button>
        <button type="button" style={styles.button} disabled={disabled} onClick={() => onZoomPreset(Math.min(6, viewport.scale * 1.2))}>Zoom In</button>
        <button type="button" style={styles.button} disabled={disabled} onClick={() => onZoomPreset(Math.max(0.1, viewport.scale / 1.2))}>Zoom Out</button>
        <span style={styles.readout}>{Math.round((viewport?.scale || 1) * 100)}%</span>
      </div>
      {scaleConfirmed ? (
        <div style={styles.group}>
          <button type="button" style={styles.primaryButton} disabled={disabled} onClick={onRunAiDetection}>Run AI Detection</button>
          <button type="button" style={styles.button} disabled={disabled} onClick={onConfirmAll}>Confirm All</button>
          <button type="button" style={styles.button} disabled={disabled} onClick={onRejectSelected}>Reject Selected</button>
          <button type="button" style={styles.dangerButton} disabled={disabled} onClick={onClearAiResults}>Clear AI Results</button>
          <button type="button" style={styles.dangerButton} disabled={disabled} onClick={onDeleteSelected}>Delete</button>
          <button type="button" style={styles.button} disabled={!canUndo} onClick={onUndo}>Undo</button>
          <button type="button" style={styles.button} disabled={!canRedo} onClick={onRedo}>Redo</button>
        </div>
      ) : null}
    </div>
  );
}

const baseButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "6px 9px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "8px 10px",
    borderBottom: "1px solid #d7dee8",
    background: "#f8fafc",
    maxHeight: 112,
    overflow: "auto",
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  button: baseButton,
  activeButton: {
    ...baseButton,
    borderColor: "#2563eb",
    background: "#dbeafe",
    color: "#1e3a8a",
  },
  primaryButton: {
    ...baseButton,
    borderColor: "#0f766e",
    background: "#0f766e",
    color: "#ffffff",
  },
  dangerButton: {
    ...baseButton,
    borderColor: "#fecaca",
    background: "#fff1f2",
    color: "#991b1b",
  },
  readout: {
    minWidth: 46,
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textAlign: "right",
  },
};
