// PushToEstimatorPanel.jsx
// Shows a preview of how confirmed measurements would map to Data Input fields.
// Does NOT automatically push anything. User must explicitly confirm each mapping.
// The actual push logic will be added in a future stage once confirmed safe.
//
// SAFETY NOTE: This panel is read-only. It previews mappings and requires
// explicit user confirmation. It does NOT write to the workbook data.

import { useState } from "react";
import { fmtLM, fmtM2 } from "./takeoffUtils";
import { OVERLAY_STATUS } from "./takeoffTypes";

export default function PushToEstimatorPanel({ totals, pages = [], onPushConfirmed }) {
  const [step, setStep]           = useState("preview"); // "preview" | "confirm" | "done"
  const [selectedMappings, setSelectedMappings] = useState({
    externalWalls:true,
    internalWalls:true,
    floorArea:    true,
    wetArea:      true,
    doorCount:    true,
    windowCount:  true,
  });

  const hasConfirmed = pages.some((pg) => (pg.overlays || []).some((o) => o.status === OVERLAY_STATUS.CONFIRMED));
  const hasScale     = pages.some((pg) => pg.scale?.pixelsPerMetre > 0);
  const ready        = hasConfirmed && hasScale && totals;

  const toggleMapping = (key) => setSelectedMappings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleConfirmPush = () => {
    if (typeof onPushConfirmed === "function") {
      onPushConfirmed({
        mappings: selectedMappings,
        values:   totals,
        timestamp:new Date().toISOString(),
      });
    }
    setStep("done");
  };

  return (
    <div style={S.wrap}>
      <div style={S.title}>🔗 Push to Data Input</div>

      {/* Safety notice */}
      <div style={S.safetyBox}>
        <div style={S.safetyIcon}>🔒</div>
        <div>
          <div style={S.safetyTitle}>Safety Gate</div>
          <div style={S.safetyText}>
            Nothing is pushed automatically. You choose exactly which values to map and must click
            "Confirm Push" to apply. Existing estimator values will only be updated after explicit
            confirmation. You can undo by reloading the previous estimator save.
          </div>
        </div>
      </div>

      {!ready && (
        <div style={S.notReadyBox}>
          <div style={S.notReadyTitle}>Requirements not met</div>
          <ul style={S.notReadyList}>
            {!hasScale     && <li>Set drawing scale on at least one page</li>}
            {!hasConfirmed && <li>Confirm at least one measurement overlay</li>}
          </ul>
        </div>
      )}

      {ready && step === "preview" && (
        <>
          <div style={S.sectionTitle}>Mapping Preview</div>
          <div style={S.table}>
            <div style={S.tableHeader}>
              <span>Include</span>
              <span>Takeoff Value</span>
              <span>→ Data Input Field</span>
              <span>Preview</span>
            </div>

            <MappingRow
              checked={selectedMappings.externalWalls}
              onToggle={() => toggleMapping("externalWalls")}
              value={fmtLM(totals.externalWallLM || 0)}
              field="External Wall Linear Metres"
              section="Site / Structure"
              description="Total external wall length summed from confirmed external wall overlays"
            />
            <MappingRow
              checked={selectedMappings.internalWalls}
              onToggle={() => toggleMapping("internalWalls")}
              value={fmtLM(totals.internalWallLM || 0)}
              field="Internal Wall Linear Metres"
              section="Site / Structure"
              description="Total internal wall length summed from confirmed internal wall overlays"
            />
            <MappingRow
              checked={selectedMappings.floorArea}
              onToggle={() => toggleMapping("floorArea")}
              value={fmtM2(totals.floorAreaM2 || 0)}
              field="Floor Area"
              section="Flooring"
              description="Total floor area from confirmed room polygons"
            />
            <MappingRow
              checked={selectedMappings.wetArea}
              onToggle={() => toggleMapping("wetArea")}
              value={fmtM2(totals.wetAreaM2 || 0)}
              field="Wet Area / Tiling Area"
              section="Tiling & Waterproofing"
              description="Total wet area from confirmed wet area polygons"
            />
            <MappingRow
              checked={selectedMappings.doorCount}
              onToggle={() => toggleMapping("doorCount")}
              value={`${totals.doorCount || 0} units`}
              field="Door Count"
              section="Windows & Doors"
              description="Count of confirmed door markers"
            />
            <MappingRow
              checked={selectedMappings.windowCount}
              onToggle={() => toggleMapping("windowCount")}
              value={`${totals.windowCount || 0} units`}
              field="Window Count"
              section="Windows & Doors"
              description="Count of confirmed window markers"
            />
          </div>

          {/* Room breakdown */}
          {totals.rooms?.length > 0 && (
            <div style={S.roomTable}>
              <div style={S.sectionTitle}>Room Detail (for reference)</div>
              {totals.rooms.map((r) => (
                <div key={r.id} style={S.roomRow}>
                  <span style={S.roomLabel}>{r.label}</span>
                  <span style={S.roomArea}>{fmtM2(r.floorAreaM2)}</span>
                  {r.floorFinish && <span style={S.roomFinish}>{r.floorFinish}</span>}
                  {r.isWetArea && <span style={S.wetBadge}>Wet</span>}
                </div>
              ))}
            </div>
          )}

          <button style={S.proceedBtn} onClick={() => setStep("confirm")}>
            Review & Confirm Push →
          </button>
        </>
      )}

      {ready && step === "confirm" && (
        <div style={S.confirmBox}>
          <div style={S.confirmTitle}>⚠ Confirm Push to Estimator</div>
          <div style={S.confirmText}>
            The following values will be pre-filled in Data Input. If a field already has a value,
            it will be overwritten. Please confirm you have reviewed all mappings.
          </div>
          <div style={S.confirmSummary}>
            {selectedMappings.externalWalls && <div>External Walls → {fmtLM(totals.externalWallLM || 0)}</div>}
            {selectedMappings.internalWalls && <div>Internal Walls → {fmtLM(totals.internalWallLM || 0)}</div>}
            {selectedMappings.floorArea     && <div>Floor Area → {fmtM2(totals.floorAreaM2 || 0)}</div>}
            {selectedMappings.wetArea       && <div>Wet Area → {fmtM2(totals.wetAreaM2 || 0)}</div>}
            {selectedMappings.doorCount     && <div>Doors → {totals.doorCount || 0} units</div>}
            {selectedMappings.windowCount   && <div>Windows → {totals.windowCount || 0} units</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={S.cancelBtn} onClick={() => setStep("preview")}>← Back</button>
            <button style={S.confirmBtn} onClick={handleConfirmPush}>
              ✓ Confirm — Push to Estimator
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={S.doneBox}>
          <div style={S.doneIcon}>✅</div>
          <div style={S.doneTitle}>Values pushed to Data Input</div>
          <div style={S.doneText}>
            Open the Data Input tab to review the imported values and adjust as needed.
          </div>
          <button style={S.doneBtn} onClick={() => setStep("preview")}>Push again</button>
        </div>
      )}
    </div>
  );
}

function MappingRow({ checked, onToggle, value, field, section, description }) {
  return (
    <div style={{ ...S.tableRow, ...(checked ? S.tableRowChecked : S.tableRowUnchecked) }}>
      <label style={S.checkCell}>
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ cursor: "pointer" }} />
      </label>
      <span style={S.valueCell}>{value}</span>
      <div style={S.fieldCell}>
        <span style={S.fieldName}>{field}</span>
        <span style={S.fieldSection}>{section}</span>
      </div>
      <span style={S.descCell}>{description}</span>
    </div>
  );
}

const S = {
  wrap:       { display: "flex", flexDirection: "column", gap: 12 },
  title:      { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  safetyBox:  { display: "flex", gap: 10, padding: "10px 12px", background: "#fef9c3", border: "1.5px solid #fde68a", borderRadius: 9 },
  safetyIcon: { fontSize: 22 },
  safetyTitle:{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 2 },
  safetyText: { fontSize: 12, color: "#78350f", lineHeight: 1.5 },
  notReadyBox:{ padding: "10px 12px", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 9 },
  notReadyTitle:{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginBottom: 4 },
  notReadyList:{ margin: "0 0 0 16px", padding: 0, fontSize: 12, color: "#9a3412", lineHeight: 1.6 },
  sectionTitle:{ fontSize: 12, fontWeight: 700, color: "#334155" },
  table:      { display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" },
  tableHeader:{ display: "grid", gridTemplateColumns: "40px 90px 1fr 1fr", gap: 8, padding: "6px 10px", background: "#f1f5f9", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow:   { display: "grid", gridTemplateColumns: "40px 90px 1fr 1fr", gap: 8, padding: "8px 10px", borderTop: "1px solid #e2e8f0", alignItems: "start" },
  tableRowChecked:  { background: "#fff" },
  tableRowUnchecked:{ background: "#f8fafc", opacity: 0.55 },
  checkCell:  { display: "flex", justifyContent: "center", paddingTop: 2, cursor: "pointer" },
  valueCell:  { fontSize: 12, fontWeight: 700, color: "#0f172a" },
  fieldCell:  { display: "flex", flexDirection: "column", gap: 1 },
  fieldName:  { fontSize: 12, fontWeight: 600, color: "#334155" },
  fieldSection:{ fontSize: 10, color: "#94a3b8" },
  descCell:   { fontSize: 11, color: "#64748b", lineHeight: 1.4 },
  roomTable:  { display: "flex", flexDirection: "column", gap: 4 },
  roomRow:    { display: "flex", gap: 8, alignItems: "center", padding: "3px 8px", background: "#f8fafc", borderRadius: 5, fontSize: 11 },
  roomLabel:  { flex: 1, color: "#334155" },
  roomArea:   { fontWeight: 700, color: "#0f172a" },
  roomFinish: { padding: "1px 5px", borderRadius: 5, background: "#fef9c3", color: "#92400e", fontSize: 10 },
  wetBadge:   { padding: "1px 5px", borderRadius: 5, background: "#dbeafe", color: "#1e40af", fontSize: 10 },
  proceedBtn: { padding: "9px 16px", border: "none", borderRadius: 8, background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" },
  confirmBox: { display: "flex", flexDirection: "column", gap: 8, padding: "14px", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10 },
  confirmTitle:{ fontSize: 14, fontWeight: 700, color: "#9a3412" },
  confirmText:{ fontSize: 12, color: "#78350f", lineHeight: 1.5 },
  confirmSummary:{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", background: "#ffffff", borderRadius: 6, fontSize: 12, color: "#334155" },
  cancelBtn:  { padding: "7px 14px", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#fff", color: "#334155", fontSize: 12, cursor: "pointer" },
  confirmBtn: { flex: 1, padding: "8px 14px", border: "none", borderRadius: 7, background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  doneBox:    { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 20, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, textAlign: "center" },
  doneIcon:   { fontSize: 32 },
  doneTitle:  { fontSize: 14, fontWeight: 700, color: "#15803d" },
  doneText:   { fontSize: 12, color: "#166534", lineHeight: 1.5 },
  doneBtn:    { padding: "6px 14px", border: "1.5px solid #16a34a", borderRadius: 7, background: "#fff", color: "#15803d", fontSize: 12, cursor: "pointer" },
};
