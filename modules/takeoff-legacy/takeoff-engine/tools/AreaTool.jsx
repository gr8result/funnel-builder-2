import React, { useState } from "react";
import { buildPolygonArea, buildRectangleArea, rectanglePointsFromCorners } from "../core/measurement.js";

export const AREA_MODES = Object.freeze({
  RECTANGLE: "rectangle",
  POLYGON: "polygon",
});

export function getAreaToolStatus({ scale, mode, rectanglePointA, rectanglePointB, polygonPoints = [] }) {
  if (!scale) {
    return {
      blocked: true,
      title: "Set scale before measuring areas.",
      detail: "Area measurements need a saved mm scale.",
    };
  }

  if (mode === AREA_MODES.RECTANGLE) {
    if (!rectanglePointA) {
      return { blocked: false, title: "Click first corner", detail: "Pick one rectangle corner on the raster image." };
    }
    if (!rectanglePointB) {
      return { blocked: false, title: "Click opposite corner", detail: "Pick the opposite rectangle corner." };
    }
    return { blocked: false, title: "Rectangle ready", detail: "Save the area or click again to restart." };
  }

  if (polygonPoints.length < 3) {
    return { blocked: false, title: "Click polygon points", detail: "Add at least three points, then confirm." };
  }

  return { blocked: false, title: "Polygon ready", detail: "Confirm to finish the area." };
}

export default function AreaTool({
  scale,
  mode,
  rectanglePointA,
  rectanglePointB,
  polygonPoints = [],
  areas = [],
  onModeChange,
  onSaveArea,
  onDeleteArea,
  onReset,
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const status = getAreaToolStatus({ scale, mode, rectanglePointA, rectanglePointB, polygonPoints });
  const previewArea = scale && mode === AREA_MODES.RECTANGLE && rectanglePointA && rectanglePointB
    ? buildRectangleArea({ pointA: rectanglePointA, pointB: rectanglePointB, scale, label })
    : scale && mode === AREA_MODES.POLYGON && polygonPoints.length >= 3
      ? buildPolygonArea({ points: polygonPoints, scale, label })
      : null;

  function saveArea() {
    try {
      const area = mode === AREA_MODES.RECTANGLE
        ? buildRectangleArea({ pointA: rectanglePointA, pointB: rectanglePointB, scale, label })
        : buildPolygonArea({ points: polygonPoints, scale, label });
      onSaveArea?.(area);
      setLabel("");
      setError("");
    } catch (err) {
      setError(err?.message || "Area could not be saved.");
    }
  }

  return (
    <aside style={styles.panel} data-takeoff-engine-area-tool>
      <div style={styles.header}>Area measurement</div>
      <div style={status.blocked ? styles.blockedStatus : styles.status}>
        <strong>{status.title}</strong>
        <span>{status.detail}</span>
      </div>

      <div style={styles.modeRow}>
        <button
          type="button"
          style={mode === AREA_MODES.RECTANGLE ? styles.activeModeButton : styles.modeButton}
          onClick={() => onModeChange?.(AREA_MODES.RECTANGLE)}
        >
          Rectangle Area
        </button>
        <button
          type="button"
          style={mode === AREA_MODES.POLYGON ? styles.activeModeButton : styles.modeButton}
          onClick={() => onModeChange?.(AREA_MODES.POLYGON)}
        >
          Polygon Area
        </button>
      </div>

      <label style={styles.label}>
        Area name
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional"
          style={styles.input}
        />
      </label>

      {previewArea ? (
        <div style={styles.result}>
          <strong>{previewArea.displayText}</strong>
        </div>
      ) : null}

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.actions}>
        <button type="button" style={styles.primaryButton} disabled={!scale || !previewArea} onClick={saveArea}>
          Confirm area
        </button>
        <button type="button" style={styles.secondaryButton} onClick={onReset}>
          Reset
        </button>
      </div>

      <div style={styles.listHeader}>Areas</div>
      <div style={styles.list}>
        {areas.length ? areas.map((area) => (
          <div key={area.id} style={styles.areaItem}>
            <div>
              <strong>{area.label || "Area"}</strong>
              <span>{area.displayText}</span>
            </div>
            <button type="button" style={styles.deleteButton} onClick={() => onDeleteArea?.(area.id)}>
              Delete
            </button>
          </div>
        )) : <div style={styles.empty}>No areas yet.</div>}
      </div>
    </aside>
  );
}

const styles = {
  panel: {
    width: 300,
    borderLeft: "1px solid #d7dee8",
    background: "#ffffff",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },
  status: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    color: "#334155",
    background: "#f8fafc",
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
  },
  blockedStatus: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    color: "#991b1b",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
  },
  modeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },
  modeButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  activeModeButton: {
    border: "1px solid #7c3aed",
    background: "#ede9fe",
    color: "#4c1d95",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 13,
    fontWeight: 800,
  },
  result: {
    color: "#4c1d95",
    background: "#f5f3ff",
    border: "1px solid #c4b5fd",
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
  },
  error: {
    color: "#991b1b",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    border: "1px solid #7c3aed",
    background: "#7c3aed",
    color: "#ffffff",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  listHeader: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  areaItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
  },
  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 6,
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
};
