// ScaleCalibrationPanel.jsx — required before wall/room drawing.

import { useState, useCallback } from "react";
import { SCALE_PRESETS } from "./takeoffTypes";
import { presetToPpm, calibrationToPpm } from "./takeoffUtils";

export default function ScaleCalibrationPanel({
  scale, calibrating, measuredFloorAreaM2 = 0, onScaleChange, onStartCalibration, onCancelCalibration,
}) {
  const [mode,     setMode]     = useState(scale?.method || "preset");
  const [distance, setDistance] = useState("");
  const [knownArea, setKnownArea] = useState("");

  const calPts     = calibrating?.points || [];
  const calReady   = calPts.length >= 2 && parseFloat(distance) > 0;
  const hasScale    = !!(scale?.pixelsPerMetre > 0);
  const confirmed  = hasScale && scale?.accepted !== false;
  const canCorrectArea = confirmed && measuredFloorAreaM2 > 0 && parseFloat(knownArea) > 0;

  const applyPreset = useCallback((preset) => {
    const ppm = presetToPpm(preset.ratio);
    onScaleChange({ method: "preset", preset: preset.value, ratio: preset.ratio, pixelsPerMetre: ppm, accepted: true, confidence: 1, confirmedAt: new Date().toISOString() });
  }, [onScaleChange]);

  const confirmDetectedScale = useCallback(() => {
    if (!hasScale) return;
    onScaleChange({ ...scale, accepted: true, confirmedAt: new Date().toISOString() });
  }, [hasScale, onScaleChange, scale]);

  const applyCalibration = useCallback(() => {
    const dist = parseFloat(distance);
    if (!calReady) return;
    const ppm = calibrationToPpm(calPts[0], calPts[1], dist);
    if (ppm) {
      onScaleChange({ method: "calibration", preset: null, pixelsPerMetre: ppm, calibrationPoints: calPts, calibrationDistanceMetres: dist, accepted: true, confidence: 1, confirmedAt: new Date().toISOString() });
      onCancelCalibration();
    }
  }, [calReady, calPts, distance, onScaleChange, onCancelCalibration]);

  const applyKnownAreaCorrection = useCallback(() => {
    const targetArea = parseFloat(knownArea);
    const currentArea = Number(measuredFloorAreaM2) || 0;
    const currentPpm = Number(scale?.pixelsPerMetre) || 0;
    if (!(targetArea > 0 && currentArea > 0 && currentPpm > 0)) return;
    const correctionFactor = Math.sqrt(currentArea / targetArea);
    onScaleChange({
      ...scale,
      method: scale?.method || "calibration",
      pixelsPerMetre: currentPpm * correctionFactor,
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
        <div style={S.ok}>
          ✓ {scale.method === "preset" ? scale.preset : "Custom calibration"}
          <button style={S.resetBtn} onClick={() => onScaleChange(null)}>Reset</button>
        </div>
      ) : hasScale ? (
        <div style={S.detectedScale}>
          <div>
            <strong>Likely scale: {scale.preset || (scale.ratio ? `1:${scale.ratio}` : "detected")}</strong>
            <span>{scale.matchedText ? `Found "${scale.matchedText}"` : "Confirm before takeoff tools unlock."}</span>
          </div>
          <button style={S.confirmBtn} onClick={confirmDetectedScale}>Confirm Scale</button>
        </div>
      ) : (
        <div style={S.warn}>Set scale before drawing walls or rooms.</div>
      )}

      <div style={S.tabs}>
        <button style={{ ...S.tab, ...(mode === "preset" ? S.tabOn : {}) }} onClick={() => setMode("preset")}>Preset</button>
        <button style={{ ...S.tab, ...(mode === "calibration" ? S.tabOn : {}) }} onClick={() => setMode("calibration")}>Measure</button>
      </div>

      {mode === "preset" && (
        <div style={S.presets}>
          {SCALE_PRESETS.map(p => (
            <button
              key={p.value}
              style={{ ...S.presetBtn, ...(scale?.preset === p.value ? S.presetOn : {}) }}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {mode === "calibration" && (
        <div style={S.calSection}>
          <div style={S.label}>1. Click two points on the plan</div>
          {!calibrating ? (
            <button style={S.calBtn} onClick={onStartCalibration}>Click two points on canvas</button>
          ) : (
            <div style={S.calStatus}>
              {calPts.length === 0 && "Click the first point…"}
              {calPts.length === 1 && "Click the second point…"}
              {calPts.length >= 2  && "✓ Two points selected"}
              <button style={S.cancelBtn} onClick={onCancelCalibration}>Cancel</button>
            </div>
          )}

          <div style={{ ...S.label, marginTop: 8 }}>2. Enter the real distance</div>
          <div style={S.inputRow}>
            <input
              type="number" min="0.01" step="0.01" placeholder="e.g. 5.0"
              value={distance} onChange={e => setDistance(e.target.value)}
              style={S.input}
            />
            <span style={S.unit}>m</span>
          </div>

          {calReady && (
            <button style={S.applyBtn} onClick={applyCalibration}>Confirm Scale</button>
          )}
        </div>
      )}

      {confirmed && (
        <div style={S.areaCorrection}>
          <div style={S.label}>Fine tune by known floor area</div>
          <div style={S.areaHint}>
            Current measured floor area: <strong>{Number(measuredFloorAreaM2 || 0).toFixed(2)} m²</strong>
          </div>
          <div style={S.inputRow}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Plan area, e.g. 111.88"
              value={knownArea}
              onChange={e => setKnownArea(e.target.value)}
              style={S.input}
            />
            <span style={S.unit}>m²</span>
          </div>
          <button
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

const S = {
  wrap:       { display: "flex", flexDirection: "column", gap: 8 },
  row:        { display: "flex", alignItems: "center", gap: 8 },
  step:       { fontSize: 11, fontWeight: 700, background: "#2563eb", color: "#fff", padding: "2px 8px", borderRadius: 99 },
  title:      { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  ok:         { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 7, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 },
  detectedScale: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 700, lineHeight: 1.35 },
  confirmBtn: { padding: "6px 9px", border: "1px solid #2563eb", borderRadius: 6, background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  resetBtn:   { padding: "2px 8px", border: "1px solid #16a34a", borderRadius: 5, background: "#fff", color: "#15803d", fontSize: 11, cursor: "pointer" },
  warn:       { padding: "7px 10px", borderRadius: 7, background: "#fef9c3", color: "#92400e", fontSize: 13, fontWeight: 600 },
  tabs:       { display: "flex", gap: 4 },
  tab:        { flex: 1, padding: "7px 0", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  tabOn:      { background: "#eff6ff", borderColor: "#3b82f6", color: "#1d4ed8" },
  presets:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  presetBtn:  { padding: "10px 0", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#f8fafc", color: "#334155", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  presetOn:   { background: "#eff6ff", borderColor: "#2563eb", color: "#1d4ed8" },
  calSection: { display: "flex", flexDirection: "column", gap: 6 },
  label:      { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
  calBtn:     { padding: "9px 10px", border: "1.5px solid #2563eb", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  calStatus:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#fef9c3", borderRadius: 7, fontSize: 13, color: "#92400e" },
  cancelBtn:  { padding: "3px 8px", border: "1px solid #f59e0b", borderRadius: 5, background: "#fff", color: "#92400e", fontSize: 11, cursor: "pointer" },
  inputRow:   { display: "flex", gap: 6, alignItems: "center" },
  input:      { flex: 1, padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 14, outline: "none" },
  unit:       { fontSize: 13, color: "#64748b" },
  applyBtn:   { padding: "9px 14px", border: "none", borderRadius: 7, background: "#15803d", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  applyBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  areaCorrection: { display: "flex", flexDirection: "column", gap: 6, padding: 10, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff" },
  areaHint: { fontSize: 12, color: "#334155", lineHeight: 1.4 },
};
