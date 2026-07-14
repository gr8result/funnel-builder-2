import { useState, useCallback } from "react";
import { SCALE_PRESETS } from "./takeoffTypes";
import { presetToPpm, calibrationToPpm, getPixelsPerUnit, dist } from "./takeoffUtils";

const RENDER_DPI = 192;

export default function ScaleCalibrationPanel({
  scale,
  calibrating,
  measuredFloorAreaM2 = 0,
  onScaleChange,
  onStartCalibration,
  onCancelCalibration,
}) {
  const [mode, setMode] = useState(scale?.method || "preset");
  const [distance, setDistance] = useState("");
  const [knownArea, setKnownArea] = useState("");

  const calPts = calibrating?.points || [];
  const distanceMm = parseFloat(distance);
  const calReady = calPts.length >= 2 && distanceMm > 0;
  const pixelsPerUnit = getPixelsPerUnit(scale);
  const hasScale = pixelsPerUnit > 0;
  const confirmed = hasScale && scale?.accepted !== false;
  const scaleSummary = getScaleSummary(scale);
  const canCorrectArea = confirmed && measuredFloorAreaM2 > 0 && parseFloat(knownArea) > 0;

  const applyPreset = useCallback((preset) => {
    const ppm = presetToPpm(preset.ratio);
    onScaleChange({
      method: "preset",
      preset: preset.value,
      ratio: preset.ratio,
      pixelsPerMetre: ppm,
      pixelsPerUnit: ppm,
      accepted: true,
      confidence: 1,
      confirmedAt: new Date().toISOString(),
    });
  }, [onScaleChange]);

  const confirmDetectedScale = useCallback(() => {
    if (!hasScale) return;
    onScaleChange({ ...scale, accepted: true, confirmedAt: new Date().toISOString() });
  }, [hasScale, onScaleChange, scale]);

  const applyCalibration = useCallback(() => {
    if (!calReady) return;
    const distM = distanceMm / 1000;
    const ppm = calibrationToPpm(calPts[0], calPts[1], distM);
    if (ppm) {
      onScaleChange({
        method: "calibration",
        preset: null,
        pixelsPerMetre: ppm,
        pixelsPerUnit: ppm,
        calibrationPoints: calPts,
        calibrationDistanceMetres: distM,
        calibrationDistanceMm: distanceMm,
        accepted: true,
        confidence: 1,
        confirmedAt: new Date().toISOString(),
      });
      onCancelCalibration();
    }
  }, [calReady, calPts, distanceMm, onScaleChange, onCancelCalibration]);

  const applyKnownAreaCorrection = useCallback(() => {
    const targetArea = parseFloat(knownArea);
    const currentArea = Number(measuredFloorAreaM2) || 0;
    const currentPpm = getPixelsPerUnit(scale);
    if (!(targetArea > 0 && currentArea > 0 && currentPpm > 0)) return;
    const correctionFactor = Math.sqrt(currentArea / targetArea);
    onScaleChange({
      ...scale,
      method: scale?.method || "calibration",
      pixelsPerMetre: currentPpm * correctionFactor,
      pixelsPerUnit: currentPpm * correctionFactor,
      accepted: true,
      areaCorrection: {
        targetAreaM2: targetArea,
        measuredAreaBeforeM2: currentArea,
        factor: correctionFactor,
        correctedAt: new Date().toISOString(),
      },
    });
  }, [knownArea, measuredFloorAreaM2, onScaleChange, scale]);

  return (
    <div style={S.wrap}>
      <div style={S.row}>
        <span style={S.step}>Step 1</span>
        <span style={S.title}>Set Scale</span>
      </div>

      {confirmed ? (
        <div style={S.readyCard}>
          <div style={S.readyTitle}>Ready to measure</div>
          <div style={S.readyLine}>Reference line: {scaleSummary.referenceText}</div>
          <div style={S.readyLine}>Approx scale: {scaleSummary.scaleText}</div>
          <button type="button" style={S.resetBtn} onClick={() => onScaleChange(null)}>Reset</button>
        </div>
      ) : hasScale ? (
        <div style={S.detectedScale}>
          <div>
            <strong>Likely scale: {scaleSummary.scaleText}</strong>
            <span>{scale.matchedText ? `Found "${scale.matchedText}"` : "Confirm before takeoff tools unlock."}</span>
          </div>
          <button type="button" style={S.confirmBtn} onClick={confirmDetectedScale}>Confirm Scale</button>
        </div>
      ) : (
        <div style={S.warn}>Set scale before drawing walls or rooms.</div>
      )}

      <div style={S.tabs}>
        <button type="button" style={{ ...S.tab, ...(mode === "preset" ? S.tabOn : {}) }} onClick={() => setMode("preset")}>Preset</button>
        <button type="button" style={{ ...S.tab, ...(mode === "calibration" ? S.tabOn : {}) }} onClick={() => setMode("calibration")}>Measure</button>
      </div>

      {mode === "preset" && (
        <div style={S.presets}>
          {SCALE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              style={{ ...S.presetBtn, ...(scale?.preset === preset.value ? S.presetOn : {}) }}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {mode === "calibration" && (
        <div style={S.calSection}>
          <div style={S.label}>1. Click two points on the plan</div>
          {!calibrating ? (
            <button type="button" style={S.calBtn} onClick={onStartCalibration}>Set Scale</button>
          ) : (
            <div style={S.calStatus}>
              {calPts.length === 0 && "Click the first point..."}
              {calPts.length === 1 && "Click the second point..."}
              {calPts.length >= 2 && "Two points selected"}
              <button type="button" style={S.cancelBtn} onClick={onCancelCalibration}>Cancel</button>
            </div>
          )}

          <div style={{ ...S.label, marginTop: 8 }}>2. Enter the real distance</div>
          <div style={S.inputRow}>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 5000"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              style={S.input}
            />
            <span style={S.unit}>mm</span>
          </div>

          {calReady && (
            <button type="button" style={S.applyBtn} onClick={applyCalibration}>Confirm Scale</button>
          )}
        </div>
      )}

      {confirmed && (
        <div style={S.areaCorrection}>
          <div style={S.label}>Fine tune by known floor area</div>
          <div style={S.areaHint}>
            Current measured floor area: <strong>{Number(measuredFloorAreaM2 || 0).toFixed(2)} m2</strong>
          </div>
          <div style={S.inputRow}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Plan area, e.g. 111.88"
              value={knownArea}
              onChange={(event) => setKnownArea(event.target.value)}
              style={S.input}
            />
            <span style={S.unit}>m2</span>
          </div>
          <button
            type="button"
            style={{ ...S.applyBtn, ...(!canCorrectArea ? S.applyBtnDisabled : {}) }}
            disabled={!canCorrectArea}
            onClick={applyKnownAreaCorrection}
          >
            Match Plan Area
          </button>
        </div>
      )}
    </div>
  );
}

function getScaleSummary(scale) {
  const ppm = getPixelsPerUnit(scale);
  const approxRatio = approximateScaleRatio(scale);
  const points = scale?.calibrationPoints || [];
  const realMm = Number(scale?.calibrationDistanceMm || (scale?.calibrationDistanceMetres || 0) * 1000);
  const drawnPx = points.length >= 2 ? Math.round(dist(points[0], points[1])) : 0;
  const referenceText = realMm > 0
    ? `${Math.round(realMm).toLocaleString()} mm`
    : scale?.preset || (drawnPx > 0 ? `${drawnPx.toLocaleString()} drawing px` : "Preset scale");
  return {
    referenceText,
    scaleText: approxRatio ? `1:${approxRatio.toLocaleString()}` : ppm > 0 ? "set" : "not set",
  };
}

function approximateScaleRatio(scale) {
  if (scale?.ratio) return Math.round(Number(scale.ratio));
  const ppm = getPixelsPerUnit(scale);
  if (!(ppm > 0)) return null;
  const ratio = (RENDER_DPI / 25.4) * 1000 / ppm;
  return ratio > 0 ? Math.round(ratio) : null;
}

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 8 },
  step: { fontSize: 11, fontWeight: 700, background: "#2563eb", color: "#fff", padding: "2px 8px", borderRadius: 99 },
  title: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  readyCard: { position: "relative", display: "flex", flexDirection: "column", gap: 3, padding: "9px 58px 10px 10px", borderRadius: 8, background: "#dcfce7", color: "#166534", border: "1px solid #86efac", fontSize: 12, fontWeight: 700 },
  readyTitle: { fontSize: 13, fontWeight: 900, color: "#15803d" },
  readyLine: { fontSize: 12, color: "#166534", lineHeight: 1.35 },
  detectedScale: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 700, lineHeight: 1.35 },
  confirmBtn: { padding: "6px 9px", border: "1px solid #2563eb", borderRadius: 6, background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  resetBtn: { position: "absolute", top: 8, right: 8, padding: "2px 8px", border: "1px solid #16a34a", borderRadius: 5, background: "#fff", color: "#15803d", fontSize: 11, cursor: "pointer" },
  warn: { padding: "7px 10px", borderRadius: 7, background: "#fef9c3", color: "#92400e", fontSize: 13, fontWeight: 600 },
  tabs: { display: "flex", gap: 4 },
  tab: { flex: 1, padding: "7px 0", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  tabOn: { background: "#eff6ff", borderColor: "#3b82f6", color: "#1d4ed8" },
  presets: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  presetBtn: { padding: "10px 0", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#f8fafc", color: "#334155", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  presetOn: { background: "#eff6ff", borderColor: "#2563eb", color: "#1d4ed8" },
  calSection: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
  calBtn: { padding: "9px 10px", border: "1.5px solid #2563eb", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  calStatus: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#fef9c3", borderRadius: 7, fontSize: 13, color: "#92400e" },
  cancelBtn: { padding: "3px 8px", border: "1px solid #f59e0b", borderRadius: 5, background: "#fff", color: "#92400e", fontSize: 11, cursor: "pointer" },
  inputRow: { display: "flex", gap: 6, alignItems: "center" },
  input: { flex: 1, padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 14, outline: "none" },
  unit: { fontSize: 13, color: "#64748b" },
  applyBtn: { padding: "9px 14px", border: "none", borderRadius: 7, background: "#15803d", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  applyBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  areaCorrection: { display: "flex", flexDirection: "column", gap: 6, padding: 10, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" },
  areaHint: { fontSize: 12, color: "#334155", lineHeight: 1.4 },
};
