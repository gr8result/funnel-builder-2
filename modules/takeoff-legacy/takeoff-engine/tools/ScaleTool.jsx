import React, { useMemo, useState } from "react";
import { distancePx } from "../core/geometry.js";
import { createScaleCalibration, formatMillimetres } from "../core/scale.js";

export function validateReferenceDistanceMm(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ok: false,
      value: null,
      message: "Enter a positive distance in millimetres.",
    };
  }

  return {
    ok: true,
    value: parsed,
    message: "",
  };
}

export function buildScaleFromToolState({ pointA, pointB, referenceDistanceMm }) {
  if (!pointA || !pointB) {
    throw new Error("Select two points on the raster image before saving scale.");
  }

  return createScaleCalibration({
    start: pointA,
    end: pointB,
    realDistanceMm: referenceDistanceMm,
  });
}

export function getScaleToolStatus({ pointA, pointB, scale }) {
  if (scale) {
    return {
      title: `Reference: ${formatMillimetres(scale.referenceDistanceMm, { includeMetres: false })}`,
      detail: "Scale ready",
      ready: true,
    };
  }

  if (!pointA) {
    return {
      title: "Click the first point",
      detail: "Use two known points on the raster image.",
      ready: false,
    };
  }

  if (!pointB) {
    return {
      title: "Click the second point",
      detail: "Pan and zoom are view-only. Points stay in image pixels.",
      ready: false,
    };
  }

  return {
    title: `${Math.round(distancePx(pointA, pointB)).toLocaleString()} px selected`,
    detail: "Enter the real distance in millimetres.",
    ready: false,
  };
}

export default function ScaleTool({
  pointA,
  pointB,
  scale,
  suggestedScale = null,
  dimensionCandidates = [],
  onApplyScaleSuggestion,
  onSaveScale,
  onReset,
}) {
  const [distanceText, setDistanceText] = useState(scale?.referenceDistanceMm ? String(scale.referenceDistanceMm) : "");
  const [error, setError] = useState("");

  const status = useMemo(() => getScaleToolStatus({ pointA, pointB, scale }), [pointA, pointB, scale]);
  const canSave = Boolean(pointA && pointB);

  function handleSave() {
    const validation = validateReferenceDistanceMm(distanceText);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    try {
      onSaveScale?.(buildScaleFromToolState({
        pointA,
        pointB,
        referenceDistanceMm: validation.value,
      }));
      setError("");
    } catch (err) {
      setError(err?.message || "Scale could not be saved.");
    }
  }

  return (
    <aside style={styles.panel} data-takeoff-engine-scale-tool>
      <div style={styles.header}>Scale calibration</div>
      <div style={status.ready ? styles.readyStatus : styles.status}>
        <strong>{status.title}</strong>
        <span>{status.detail}</span>
      </div>

      {suggestedScale?.ratio && !scale ? (
        <div style={styles.suggestion}>
          <strong>{suggestedScale.label || `Suggested scale: 1:${suggestedScale.ratio}`}</strong>
          <span>Detected from plan text. Confirm before applying.</span>
          {suggestedScale.sheetCandidates?.length ? (
            <small>{suggestedScale.sheetCandidates.map((candidate) => candidate.normalized).join(", ")}</small>
          ) : null}
          <button type="button" style={styles.applyButton} onClick={() => onApplyScaleSuggestion?.(suggestedScale)}>
            Apply suggested scale
          </button>
        </div>
      ) : null}

      {dimensionCandidates?.length ? (
        <div style={styles.detectedDimensions}>
          <strong>Detected dimensions</strong>
          <span>{dimensionCandidates.slice(0, 6).map((candidate) => candidate.normalized).join(", ")}</span>
        </div>
      ) : null}

      <label style={styles.label}>
        Real distance
        <div style={styles.inputRow}>
          <input
            value={distanceText}
            onChange={(event) => setDistanceText(event.target.value)}
            placeholder="11490"
            inputMode="numeric"
            style={styles.input}
          />
          <span style={styles.unit}>mm</span>
        </div>
      </label>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.actions}>
        <button type="button" style={styles.primaryButton} disabled={!canSave} onClick={handleSave}>
          Save scale
        </button>
        <button type="button" style={styles.secondaryButton} onClick={onReset}>
          Reset
        </button>
      </div>
    </aside>
  );
}

const styles = {
  panel: {
    width: 260,
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
  readyStatus: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    color: "#065f46",
    background: "#ecfdf5",
    border: "1px solid #86efac",
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
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 13,
    fontWeight: 800,
  },
  unit: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
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
  suggestion: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    color: "#1e3a8a",
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
  },
  applyButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  detectedDimensions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#334155",
    background: "#f8fafc",
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
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
};
