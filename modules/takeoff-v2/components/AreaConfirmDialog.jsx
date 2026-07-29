import { useState } from "react";
import { formatArea } from "../takeoff/units.js";

export default function AreaConfirmDialog({ open, calculatedAreaM2, onAccept, onEditWalls, onCancel }) {
  const [confirmedText, setConfirmedText] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("Ground Floor");

  if (!open || calculatedAreaM2 == null) return null;

  const confirmedAreaM2 = confirmedText === "" ? calculatedAreaM2 : Number(confirmedText);
  const changed = confirmedText !== "" && Number.isFinite(confirmedAreaM2) && Math.abs(confirmedAreaM2 - calculatedAreaM2) > 0.001;
  const canAccept = Number.isFinite(confirmedAreaM2) && confirmedAreaM2 > 0 && (!changed || note.trim().length > 0);

  return (
    <div style={S.backdrop} data-testid="area-confirm-dialog">
      <div style={S.dialog}>
        <h3 style={S.title}>Confirm Area</h3>

        <label style={S.label}>Area name</label>
        <input style={S.input} value={name} onChange={(event) => setName(event.target.value)} data-testid="area-name-input" />

        <div style={S.readout} data-testid="area-readout">
          <div>Calculated building footprint: {formatArea(calculatedAreaM2)}</div>
        </div>

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
            onClick={() => onAccept({ confirmedAreaM2, note, name })}
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
  dialog: { background: "#fff", borderRadius: 10, padding: 20, width: 380, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", fontFamily: "system-ui, sans-serif" },
  title: { margin: "0 0 12px", fontSize: 16, color: "#0f172a" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4, marginTop: 10 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "8px 10px", fontSize: 13, minHeight: 60, boxSizing: "border-box" },
  readout: { background: "#f1f5f9", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, color: "#166534", marginTop: 10 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  confirmButton: { border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
};
