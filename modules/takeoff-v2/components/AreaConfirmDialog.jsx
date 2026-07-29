import { useState } from "react";
import { formatArea } from "../takeoff/units.js";

const AREA_TYPES = ["Living Area", "Garage", "Patio", "Alfresco", "Balcony", "Porch", "Upper Floor", "Void", "Custom"];
const BOUNDARY_BASES = [
  { value: "outside", label: "Outside face" },
  { value: "centreline", label: "Wall centreline" },
  { value: "inside", label: "Inside face" },
];

// Method A of the Area Tool: confirming the area calculated from a closed,
// confirmed exterior perimeter. Always shows the external footprint and the
// internal floor-area estimate as two distinct figures — the internal one is
// only ever produced by actually offsetting the perimeter by a wall
// thickness (see footprintAndInternalArea in useTakeoffTools.js), and shows
// the spec's exact graceful-failure message when that offset can't be
// computed, rather than ever mislabeling the as-traced footprint as internal.
export default function AreaConfirmDialog({
  open, calculatedAreaM2, footprintAndInternalArea,
  boundaryBasis = "outside", wallThicknessMm,
  onSetBoundaryBasis, onSetWallThicknessMm,
  onAccept, onEditWalls, onCancel,
}) {
  const [confirmedText, setConfirmedText] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("Ground Floor");
  const [areaType, setAreaType] = useState("Living Area");
  const [thicknessText, setThicknessText] = useState(wallThicknessMm != null ? String(wallThicknessMm) : "200");

  if (!open || calculatedAreaM2 == null) return null;

  const confirmedAreaM2 = confirmedText === "" ? calculatedAreaM2 : Number(confirmedText);
  const changed = confirmedText !== "" && Number.isFinite(confirmedAreaM2) && Math.abs(confirmedAreaM2 - calculatedAreaM2) > 0.001;
  const canAccept = Number.isFinite(confirmedAreaM2) && confirmedAreaM2 > 0 && (!changed || note.trim().length > 0);

  const applyThickness = () => {
    const mm = Number(thicknessText);
    if (Number.isFinite(mm) && mm > 0) onSetWallThicknessMm?.(mm);
  };

  return (
    <div style={S.backdrop} data-testid="area-confirm-dialog">
      <div style={S.dialog}>
        <h3 style={S.title}>Confirm Area</h3>

        <label style={S.label}>Area name</label>
        <input style={S.input} value={name} onChange={(event) => setName(event.target.value)} data-testid="area-name-input" />

        <label style={S.label}>Classification</label>
        <select style={S.input} value={areaType} onChange={(event) => setAreaType(event.target.value)} data-testid="area-type-select">
          {AREA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={S.readout} data-testid="area-readout">
          <div data-testid="area-external-footprint">External footprint: {formatArea(footprintAndInternalArea?.externalFootprintM2 ?? calculatedAreaM2)}</div>
          {footprintAndInternalArea?.internalFloorAreaM2 != null ? (
            <div data-testid="area-internal-floor-area">Estimated internal floor area: {formatArea(footprintAndInternalArea.internalFloorAreaM2)}</div>
          ) : (
            <div style={S.internalAreaError} data-testid="area-internal-floor-area-error">
              {footprintAndInternalArea?.internalAreaError || "Internal area could not be calculated automatically. Trace the internal boundary using the Area Tool."}
            </div>
          )}
        </div>

        <details style={S.details}>
          <summary style={S.summary}>Boundary basis &amp; wall thickness</summary>
          <label style={S.label}>Boundary basis — which face of the wall this trace represents</label>
          <select
            style={S.input}
            value={boundaryBasis}
            onChange={(event) => onSetBoundaryBasis?.(event.target.value)}
            data-testid="area-boundary-basis-select"
          >
            {BOUNDARY_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <label style={S.label}>Default wall thickness (mm) — used to estimate the internal floor area</label>
          <div style={S.thicknessRow}>
            <input
              style={{ ...S.input, flex: 1 }}
              value={thicknessText}
              onChange={(event) => setThicknessText(event.target.value)}
              data-testid="area-wall-thickness-input"
            />
            <button type="button" style={S.secondaryButton} onClick={applyThickness} data-testid="area-wall-thickness-apply">
              Recalculate
            </button>
          </div>
        </details>

        <label style={S.label}>Confirmed area (m²) — leave blank to accept the calculated value</label>
        <input
          style={S.input}
          value={confirmedText}
          onChange={(event) => setConfirmedText(event.target.value)}
          placeholder={calculatedAreaM2.toFixed(2)}
          data-testid="area-confirmed-input"
        />

        {changed && (
          <>
            <label style={S.label}>Reason for the different figure (required)</label>
            <textarea style={S.textarea} value={note} onChange={(event) => setNote(event.target.value)} data-testid="area-note-input" />
          </>
        )}

        <div style={S.actions}>
          <button type="button" style={S.cancelButton} onClick={onCancel} data-testid="area-cancel">Cancel</button>
          <button type="button" style={S.secondaryButton} onClick={onEditWalls} data-testid="area-edit-walls">Edit Exterior Walls</button>
          <button
            type="button"
            style={{ ...S.confirmButton, ...(canAccept ? null : S.disabled) }}
            disabled={!canAccept}
            onClick={() => onAccept({ confirmedAreaM2, note, name, areaType })}
            data-testid="area-accept"
          >
            Accept Area
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  dialog: { background: "#fff", borderRadius: 10, padding: 20, width: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.25)", fontFamily: "system-ui, sans-serif" },
  title: { margin: "0 0 12px", fontSize: 16, color: "#0f172a" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4, marginTop: 10 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 13, minHeight: 60, boxSizing: "border-box" },
  readout: { background: "#f1f5f9", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, color: "#166534", marginTop: 10, display: "flex", flexDirection: "column", gap: 4 },
  internalAreaError: { color: "#b45309", fontWeight: 600, fontSize: 12 },
  details: { marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" },
  summary: { fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer" },
  thicknessRow: { display: "flex", gap: 6, alignItems: "center" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  confirmButton: { border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
};
