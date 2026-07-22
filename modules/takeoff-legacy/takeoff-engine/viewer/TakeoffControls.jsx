import React, { useEffect, useState } from "react";

export const VIEWER_ZOOM_PRESETS = Object.freeze([
  { label: "Fit", value: "fit" },
  { label: "100%", value: 1 },
  { label: "200%", value: 2 },
  { label: "400%", value: 4 },
]);

export const ORIENTATION_ROTATION_BUTTONS = Object.freeze([
  { label: "Rotate 90", value: 90 },
  { label: "Rotate 180", value: 180 },
  { label: "Rotate 270", value: 270 },
]);

export function getOrientationWarning(page) {
  if (page?.orientationResetWarning) {
    return page.orientationResetWarning;
  }

  const orientation = page?.orientation || {};
  if (orientation.orientationConfirmed) {
    return "";
  }
  if (orientation.warning) {
    return orientation.warning;
  }
  if (orientation.confidence && !["high", "confirmed", "manual"].includes(orientation.confidence)) {
    return "Orientation may need checking";
  }
  if (page?.metadata?.orientationNeedsReview) {
    return "Orientation may need checking";
  }
  return "";
}

export default function TakeoffControls({
  page,
  viewState,
  activeTool,
  snapEnabled = true,
  onFit,
  onZoomPreset,
  onSetScaleTool,
  onSetMeasureTool,
  onSetAreaTool,
  onSnapToggle,
  onRotate,
  onConfirmOrientation,
  onApplyScaleSuggestion,
}) {
  const warning = getOrientationWarning(page);
  const zoomPercent = Math.round((viewState?.zoom || 1) * 100);
  const orientationAnalysis = page?.metadata?.orientationAnalysis || null;
  const orientationSources = orientationAnalysis?.sources || {};
  const orientationRanked = orientationAnalysis?.ranked || [];
  const suggestedScale = page?.metadata?.suggestedScale || null;
  const showSuggestedScale = suggestedScale?.ratio && !page?.scale && !page?.metadata?.scaleSuggestionConfirmed;
  const [showDeveloperControls, setShowDeveloperControls] = useState(false);

  useEffect(() => {
    setShowDeveloperControls(window.localStorage.getItem("estimate-builder-show-developer-controls") === "true");
  }, []);

  return (
    <div style={styles.shell} data-takeoff-engine-controls>
      <div style={styles.group} aria-label="View controls">
        {VIEWER_ZOOM_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            style={styles.button}
            onClick={() => (preset.value === "fit" ? onFit?.() : onZoomPreset?.(preset.value))}
          >
            {preset.label}
          </button>
        ))}
        <span style={styles.zoomText}>{zoomPercent}%</span>
      </div>

      <div style={styles.group} aria-label="Tool controls">
        <button
          type="button"
          style={activeTool === "scale" ? styles.activeButton : styles.button}
          onClick={() => onSetScaleTool?.()}
        >
          Set Scale
        </button>
        <button
          type="button"
          style={activeTool === "measure" ? styles.activeButton : styles.button}
          onClick={() => onSetMeasureTool?.()}
        >
          Measure
        </button>
        <button
          type="button"
          style={activeTool === "area" ? styles.activeButton : styles.button}
          onClick={() => onSetAreaTool?.()}
        >
          Area
        </button>
        {page?.scale ? <span style={styles.scaleReady}>Scale ready</span> : null}
        {showSuggestedScale ? (
          <span style={styles.scaleSuggestion}>
            {suggestedScale.label || `Suggested scale: 1:${suggestedScale.ratio}`}
            <button type="button" style={styles.confirmScaleButton} onClick={() => onApplyScaleSuggestion?.(suggestedScale)}>
              Apply
            </button>
          </span>
        ) : null}
        <label style={styles.snapToggle}>
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(event) => onSnapToggle?.(event.target.checked)}
          />
          Snap
        </label>
      </div>

      <div style={styles.group} aria-label="Orientation controls">
        {ORIENTATION_ROTATION_BUTTONS.map((button) => (
          <button key={button.value} type="button" style={styles.button} onClick={() => onRotate?.(button.value)}>
            {button.label}
          </button>
        ))}
        <button type="button" style={styles.confirmButton} onClick={() => onConfirmOrientation?.()}>
          Set orientation as correct
        </button>
      </div>

      {warning ? <div style={styles.warning}>{warning}</div> : null}
      {showDeveloperControls && orientationAnalysis ? (
        <details style={styles.diagnostics}>
          <summary style={styles.diagnosticsSummary}>Orientation diagnostics</summary>
          <div style={styles.diagnosticsGrid}>
            <span>Applied</span>
            <strong>{orientationAnalysis.appliedRotation ?? orientationAnalysis.selectedRotation ?? 0} deg</strong>
            <span>Suggested</span>
            <strong>{orientationAnalysis.suggestedRotation ?? orientationAnalysis.selectedRotation ?? 0} deg</strong>
            <span>Confidence</span>
            <strong>{orientationAnalysis.confidence || "unknown"} ({Number(orientationAnalysis.confidenceScore || 0).toFixed(2)})</strong>
            <span>Reason</span>
            <strong>{orientationAnalysis.reason || "No reason recorded"}</strong>
          </div>
          <div style={styles.sourceList}>
            {Object.entries(orientationSources).map(([name, source]) => (
              <div key={name} style={styles.sourceRow}>
                <span>{name}</span>
                <strong>{source?.suggestedRotation ?? source?.selectedRotation ?? 0} deg</strong>
                <em>{source?.confidence || "none"}</em>
              </div>
            ))}
          </div>
          {orientationRanked.length ? (
            <div style={styles.ranked}>
              {orientationRanked.map((item) => (
                <span key={item.rotation}>{item.rotation}: {Number(item.score || 0).toFixed(2)}</span>
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "8px 10px",
    borderBottom: "1px solid #d7dee8",
    background: "#f8fafc",
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  button: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  activeButton: {
    border: "1px solid #2563eb",
    background: "#dbeafe",
    color: "#1e3a8a",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  confirmButton: {
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  zoomText: {
    minWidth: 46,
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "right",
  },
  scaleReady: {
    color: "#047857",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  scaleSuggestion: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#1e3a8a",
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    borderRadius: 999,
    padding: "3px 5px 3px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
  confirmScaleButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  snapToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#334155",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  warning: {
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  diagnostics: {
    flexBasis: "100%",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 6,
    padding: "6px 8px",
    color: "#334155",
    fontSize: 12,
  },
  diagnosticsSummary: {
    cursor: "pointer",
    fontWeight: 900,
    color: "#0f172a",
  },
  diagnosticsGrid: {
    display: "grid",
    gridTemplateColumns: "90px minmax(0, 1fr)",
    gap: "4px 8px",
    marginTop: 8,
  },
  sourceList: {
    display: "grid",
    gap: 4,
    marginTop: 8,
  },
  sourceRow: {
    display: "grid",
    gridTemplateColumns: "110px 70px 70px",
    gap: 8,
    alignItems: "center",
  },
  ranked: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
    color: "#475569",
    fontWeight: 800,
  },
};
