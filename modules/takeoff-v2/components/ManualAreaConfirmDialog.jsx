import { useState } from "react";
import { formatArea } from "../takeoff/units.js";

const AREA_TYPES = ["Living Area", "Bedroom", "Bathroom", "Ensuite", "Kitchen", "Dining", "Garage", "Laundry", "Study", "Robe", "Pantry", "Hallway", "Patio", "Alfresco", "Balcony", "Porch", "Upper Floor", "Void", "Custom"];

// Method B of the Area Tool: confirming a manually traced polygon (no
// relationship to any wall perimeter required — a patio, a void, a room
// traced independently of the exterior walls). Distinct from
// AreaConfirmDialog (Method A), which additionally shows the
// footprint-vs-internal-floor-area distinction that only makes sense for an
// area generated from a closed exterior wall perimeter.
export default function ManualAreaConfirmDialog({ open, candidate, onAccept, onCancel }) {
  const [confirmedText, setConfirmedText] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("Area");
  const [areaType, setAreaType] = useState("Custom");

  if (!open) return null;

  if (!candidate?.valid) {
    return (
      <div style={S.backdrop} data-testid="manual-area-confirm-dialog">
        <div style={S.dialog}>
          <h3 style={S.title}>Area boundary not valid</h3>
          <p style={S.invalidReason} data-testid="manual-area-invalid-reason">{candidate?.reason || "This boundary is not valid."}</p>
          <div style={S.actions}>
            <button type="button" style={S.cancelButton} onClick={onCancel} data-testid="manual-area-cancel">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const calculatedAreaM2 = candidate.calculatedAreaM2;
  const grossAreaM2 = candidate.grossAreaM2 ?? calculatedAreaM2;
  const excludedAreaM2 = candidate.excludedAreaM2 ?? 0;
  const netAreaM2 = candidate.netAreaM2 ?? calculatedAreaM2;
  const confirmedAreaM2 = confirmedText === "" ? calculatedAreaM2 : Number(confirmedText);
  const changed = confirmedText !== "" && Number.isFinite(confirmedAreaM2) && Math.abs(confirmedAreaM2 - calculatedAreaM2) > 0.001;
  const canAccept = Number.isFinite(confirmedAreaM2) && confirmedAreaM2 > 0 && (!changed || note.trim().length > 0);

  return (
    <div style={S.backdrop} data-testid="manual-area-confirm-dialog">
      <div style={S.dialog}>
        <h3 style={S.title}>{candidate.source === "room-detect" || candidate.source === "rectangle" ? "Review Detected Room" : "Confirm Traced Area"}</h3>

        {(candidate.source === "room-detect" || candidate.source === "rectangle") && (
          <div style={S.detectedBanner} data-testid="room-detect-banner">
            Room boundary detected
            {candidate.confidence != null && <span>Confidence: {Math.round(candidate.confidence * 100)}%</span>}
          </div>
        )}

        <label style={S.label}>Area name</label>
        <input style={S.input} value={name === "Area" && candidate.name ? candidate.name : name} onChange={(event) => setName(event.target.value)} data-testid="manual-area-name-input" />

        <label style={S.label}>Classification</label>
        <select style={S.input} value={areaType} onChange={(event) => setAreaType(event.target.value)} data-testid="manual-area-type-select">
          {AREA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={S.readout} data-testid="manual-area-readout">
          <div>Gross area: {formatArea(grossAreaM2)}</div>
          {excludedAreaM2 > 0 && <div>Excluded area: {formatArea(excludedAreaM2)}</div>}
          <div>Net area: {formatArea(netAreaM2)}</div>
          {(candidate.holes || []).map((hole) => (
            <div key={hole.id} style={S.exclusionLine} data-testid="manual-area-exclusion-readout">
              {hole.type === "robe" ? "Robe excluded" : `${hole.type} excluded`}: {formatArea(holeAreaM2(hole, candidate))}
            </div>
          ))}
        </div>

        <label style={S.label}>Confirmed area (m²) — leave blank to accept the calculated value</label>
        <input
          style={S.input}
          value={confirmedText}
          onChange={(event) => setConfirmedText(event.target.value)}
          placeholder={calculatedAreaM2.toFixed(2)}
          data-testid="manual-area-confirmed-input"
        />

        {changed && (
          <>
            <label style={S.label}>Reason for the different figure (required)</label>
            <textarea style={S.textarea} value={note} onChange={(event) => setNote(event.target.value)} data-testid="manual-area-note-input" />
          </>
        )}

        <div style={S.actions}>
          <button type="button" style={S.cancelButton} onClick={onCancel} data-testid="manual-area-cancel">Cancel</button>
          <button
            type="button"
            style={{ ...S.confirmButton, ...(canAccept ? null : S.disabled) }}
            disabled={!canAccept}
            onClick={() => onAccept({ confirmedAreaM2, note, name: name === "Area" && candidate.name ? candidate.name : name, areaType })}
            data-testid="manual-area-accept"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function holeAreaM2(hole, candidate) {
  const total = candidate.excludedAreaM2 || 0;
  const included = (candidate.holes || []).filter((item) => item.included !== false);
  if (included.length === 1) return total;
  return 0;
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  dialog: { background: "#fff", borderRadius: 10, padding: 20, width: 380, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", fontFamily: "system-ui, sans-serif" },
  title: { margin: "0 0 12px", fontSize: 16, color: "#0f172a" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4, marginTop: 10 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 13, minHeight: 60, boxSizing: "border-box" },
  readout: { background: "#f1f5f9", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, color: "#166534", marginTop: 10 },
  detectedBanner: { background: "#ede9fe", border: "1px solid #c4b5fd", color: "#5b21b6", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 10 },
  exclusionLine: { color: "#c2410c" },
  invalidReason: { fontSize: 13, color: "#b91c1c", fontWeight: 600 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  confirmButton: { border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
};
