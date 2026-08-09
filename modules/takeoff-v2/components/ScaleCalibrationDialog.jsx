import { useEffect, useRef, useState } from "react";
import { parseDistanceInput, approximateDrawingScale } from "../takeoff/units.js";

function describeSnap(snap) {
  if (!snap) return "Manual placement";
  if (snap.kind === "intersection") return "Line intersection";
  if (snap.kind === "endpoint") {
    if (snap.lineId?.startsWith("wv")) return "Wall vertex";
    if (snap.lineId?.startsWith("vec-") || snap.lineId?.startsWith("raster-")) return "Detected line endpoint";
    return "Existing point";
  }
  if (snap.kind === "line") return "Nearest point on detected line";
  return "Manual placement";
}

// Matches the spec's mock exactly:
//   Confirm Scale
//   Alignment: Horizontal 0°
//   Snap A: Wall intersection
//   Snap B: Dimension-line endpoint
//   Selected plan span: [document-space value]
//   Known distance: [ 6000 ] [ mm v ]
//   [Adjust Points] [Cancel] [Confirm Scale]
export default function ScaleCalibrationDialog({ calibrationDialog, onConfirm, onCancel, onAdjustPoints }) {
  const [text, setText] = useState("6000");
  const [unit, setUnit] = useState("mm");
  const inputRef = useRef(null);

  // Autofocus the number field whenever a fresh calibration is presented.
  useEffect(() => {
    if (calibrationDialog) inputRef.current?.focus();
  }, [calibrationDialog]);

  if (!calibrationDialog) return null;
  const { axis, documentDistance, snapA, snapB } = calibrationDialog;

  const parsedMm = parseDistanceInput(`${text} ${unit}`);
  const mmPerDocumentUnit = parsedMm && documentDistance > 0 ? parsedMm / documentDistance : null;
  const scaleLabel = mmPerDocumentUnit ? approximateDrawingScale(mmPerDocumentUnit) : null;
  const valid = Number.isFinite(parsedMm) && parsedMm > 0;

  function handleKeyDown(event) {
    if (event.key === "Enter" && valid) onConfirm(parsedMm);
    else if (event.key === "Escape") onCancel();
  }

  return (
    <div style={S.backdrop} data-testid="scale-calibration-dialog" onKeyDown={handleKeyDown}>
      <div style={S.dialog}>
        <h3 style={S.title}>Confirm Scale</h3>

        <div style={S.readout} data-testid="calibration-alignment-readout">
          <div data-testid="calibration-alignment">Alignment: {axis === "horizontal" ? "Horizontal 0°" : "Vertical 90°"}</div>
          <div data-testid="calibration-snap-a">Snap A: {describeSnap(snapA)}</div>
          <div data-testid="calibration-snap-b">Snap B: {describeSnap(snapB)}</div>
          <div data-testid="calibration-span">Selected plan span: {documentDistance.toFixed(2)} document units</div>
        </div>

        <label style={S.label}>Known distance:</label>
        <div style={S.inputRow} className="scale-input-row">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={S.input}
            data-testid="calibration-distance-input"
          />
          <select value={unit} onChange={(event) => setUnit(event.target.value)} style={S.select} data-testid="calibration-unit-select">
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
        </div>

        <div style={S.readout} data-testid="calibration-readout">
          <div>Calculated conversion: {mmPerDocumentUnit ? `${mmPerDocumentUnit.toFixed(3)} mm per document unit` : "—"}</div>
          {mmPerDocumentUnit != null && (
            <div>Approximate drawing scale: {scaleLabel || "—"} (based on entered distance — not a claimed printed scale)</div>
          )}
        </div>

        {!valid && text !== "" && (
          <div style={S.error}>Enter a positive distance, e.g. 6000, 6000 mm, or 6 m.</div>
        )}

        <div style={S.actions}>
          <button type="button" style={S.secondaryButton} onClick={onAdjustPoints} data-testid="calibration-adjust-points">Adjust Points</button>
          <button type="button" style={S.cancelButton} onClick={onCancel} data-testid="calibration-cancel">Cancel</button>
          <button
            type="button"
            style={{ ...S.confirmButton, ...(valid ? null : S.disabled) }}
            disabled={!valid}
            onClick={() => onConfirm(parsedMm)}
            data-testid="calibration-confirm"
          >
            Confirm Scale
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  dialog: { background: "#fff", borderRadius: 10, padding: 20, width: 380, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", fontFamily: "system-ui, sans-serif" },
  title: { margin: "0 0 12px", fontSize: 16, color: "#0f172a" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4, marginTop: 10 },
  // The distance is the value that matters; the unit is a short, fixed-width
  // qualifier — a `1fr` / fixed-px grid keeps that ratio regardless of the
  // browser's native <select> rendering width (a plain flex row with only
  // the input set to flex:1 could still let the select's native chrome
  // dominate on some platforms).
  inputRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px", gap: 8, marginBottom: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 6, padding: "10px 12px", fontSize: 20, fontWeight: 700, color: "#0f172a" },
  select: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 6, padding: "10px 8px", fontSize: 14 },
  readout: { background: "#f1f5f9", borderRadius: 8, padding: 10, fontSize: 12, color: "#334155", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 },
  error: { color: "#b91c1c", fontSize: 12, marginBottom: 8 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" },
  cancelButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  confirmButton: { border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
};
