import React, { useState } from "react";
import { createDistanceMeasurement } from "../core/measurement.js";

export function getMeasureToolStatus({ scale, pointA, pointB }) {
  if (!scale) {
    return {
      blocked: true,
      title: "Set scale before measuring.",
      detail: "Measurements need a saved mm scale.",
    };
  }

  if (!pointA) {
    return {
      blocked: false,
      title: "Click measurement start",
      detail: "Pick point A on the raster image.",
    };
  }

  if (!pointB) {
    return {
      blocked: false,
      title: "Click measurement end",
      detail: "Pick point B on the raster image.",
    };
  }

  return {
    blocked: false,
    title: "Measurement ready",
    detail: "Save the line or click the image to start again.",
  };
}

export function buildMeasurementFromToolState({ pointA, pointB, scale, label = "" }) {
  if (!scale) {
    throw new Error("Set scale before measuring.");
  }
  if (!pointA || !pointB) {
    throw new Error("Select two points before saving measurement.");
  }

  return createDistanceMeasurement({
    start: pointA,
    end: pointB,
    scale,
    label,
  });
}

export default function MeasureTool({
  scale,
  pointA,
  pointB,
  measurements = [],
  onSaveMeasurement,
  onDeleteMeasurement,
  onReset,
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const status = getMeasureToolStatus({ scale, pointA, pointB });
  const previewMeasurement = scale && pointA && pointB
    ? createDistanceMeasurement({ start: pointA, end: pointB, scale, label })
    : null;

  function handleSave() {
    try {
      onSaveMeasurement?.(buildMeasurementFromToolState({ pointA, pointB, scale, label }));
      setLabel("");
      setError("");
    } catch (err) {
      setError(err?.message || "Measurement could not be saved.");
    }
  }

  return (
    <aside style={styles.panel} data-takeoff-engine-measure-tool>
      <div style={styles.header}>Measure line</div>
      <div style={status.blocked ? styles.blockedStatus : styles.status}>
        <strong>{status.title}</strong>
        <span>{status.detail}</span>
      </div>

      <label style={styles.label}>
        Measurement name
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional"
          style={styles.input}
        />
      </label>

      {previewMeasurement ? (
        <div style={styles.result}>
          <strong>{previewMeasurement.displayText}</strong>
          {previewMeasurement.warning ? <span style={styles.warning}>{previewMeasurement.warning}</span> : null}
        </div>
      ) : null}

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.actions}>
        <button type="button" style={styles.primaryButton} disabled={!scale || !pointA || !pointB} onClick={handleSave}>
          Save measurement
        </button>
        <button type="button" style={styles.secondaryButton} onClick={onReset}>
          Reset
        </button>
      </div>

      <div style={styles.listHeader}>Measurements</div>
      <div style={styles.list}>
        {measurements.length ? measurements.map((measurement) => (
          <div key={measurement.id} style={styles.measurementItem}>
            <div>
              <strong>{measurement.label || "Measurement"}</strong>
              <span>{measurement.displayText}</span>
            </div>
            <button type="button" style={styles.deleteButton} onClick={() => onDeleteMeasurement?.(measurement.id)}>
              Delete
            </button>
          </div>
        )) : <div style={styles.empty}>No measurements yet.</div>}
      </div>
    </aside>
  );
}

const styles = {
  panel: {
    width: 280,
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
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#065f46",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
  },
  warning: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 800,
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
    border: "1px solid #0f766e",
    background: "#0f766e",
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
  measurementItem: {
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

