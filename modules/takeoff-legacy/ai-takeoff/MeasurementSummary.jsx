// MeasurementSummary.jsx — Phase 1: live measurements from drawn overlays.

import { FLOOR_FINISHES, LEVEL_OPTIONS } from "./takeoffTypes";
import { summarise, pxToM, pxToM2, polyLen, polyArea, getPixelsPerUnit } from "./takeoffUtils";

export default function MeasurementSummary({ pages, selectedPageId, onUpdateOverlay }) {
  const page   = pages.find(p => p.id === selectedPageId);
  const ppm    = getPixelsPerUnit(page?.scale);
  const ovs    = page?.overlays || [];
  const totals = summarise(ovs, ppm);
  const level  = LEVEL_OPTIONS.find(l => l.value === page?.level)?.label || "";

  return (
    <div style={S.wrap}>
      <div style={S.heading}>Measurements</div>

      {!page && (
        <p style={S.muted}>Upload a PDF to begin.</p>
      )}

      {page && !ppm && (
        <div style={S.warn}>Set drawing scale to calculate measurements.</div>
      )}

      {page && ppm && ovs.length === 0 && (
        <p style={S.muted}>Draw walls and rooms to see measurements.</p>
      )}

      {page && ppm && ovs.length > 0 && (
        <>
          <div style={S.pageTitle}>Page {page.pageNumber} — {level}</div>

          <div style={S.block}>
            <Row label="External walls"  value={`${totals.externalWallLM.toFixed(2)} m`}  />
            <Row label="Internal walls"  value={`${totals.internalWallLM.toFixed(2)} m`}  />
            <Row label="Doors"           value={`${totals.doorCount}`}                     />
            <Row label="Windows"         value={`${totals.windowCount}`}                   />
            <Row label="Floor area"      value={`${totals.floorAreaM2.toFixed(2)} m²`}    />
          </div>

          {/* Room breakdown */}
          {totals.rooms.length > 0 && (
            <div style={S.block}>
              <div style={S.blockTitle}>Rooms</div>
              {totals.rooms.map(r => (
                <RoomRow key={r.id} room={r} overlay={ovs.find(o => o.id === r.id)} onUpdate={onUpdateOverlay} />
              ))}
            </div>
          )}
        </>
      )}

      {/* All overlays list */}
      {ovs.length > 0 && (
        <div style={S.block}>
          <div style={S.blockTitle}>All items ({ovs.length})</div>
          {ovs.map(ov => (
            <OverlayRow key={ov.id} ov={ov} ppm={ppm} onUpdate={onUpdateOverlay} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomRow({ room, overlay, onUpdate }) {
  if (!overlay) return null;
  return (
    <div style={S.roomCard}>
      <div style={S.roomTop}>
        <input
          type="text"
          value={overlay.label || ""}
          placeholder="Room name"
          onChange={e => onUpdate?.(overlay.id, { label: e.target.value })}
          style={S.nameInput}
        />
        <span style={S.areaVal}>{room.area.toFixed(2)} m²</span>
      </div>
      <select
        value={overlay.finishType || ""}
        onChange={e => onUpdate?.(overlay.id, { finishType: e.target.value })}
        style={S.finishSel}
      >
        {FLOOR_FINISHES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <div style={S.roomStats}>Perimeter: {room.perim.toFixed(2)} m</div>
    </div>
  );
}

function OverlayRow({ ov, ppm, onUpdate }) {
  const TYPE_ICON = { externalWall: "EW", internalWall: "IW", room: "R", area: "m2", rectangle: "m2", circle: "o", measure: "L", door: "D", window: "W" };
  const TYPE_COLOR = { externalWall: "#1d4ed8", internalWall: "#ea580c", room: "#0369a1", area: "#0f766e", rectangle: "#7c3aed", circle: "#0891b2", measure: "#ef4444", door: "#16a34a", window: "#7c3aed" };

  let measurement = "";
  if (ppm) {
    if (ov.type === "externalWall" || ov.type === "internalWall" || ov.type === "measure") {
      measurement = `${(pxToM(polyLen(ov.points), ppm)).toFixed(2)} m`;
    }
    if (ov.type === "room" || ov.type === "area" || ov.type === "rectangle") {
      measurement = `${(pxToM2(polyArea(ov.points), ppm)).toFixed(2)} m²`;
    }
  }

  return (
    <div style={S.ovRow}>
      <span style={{ color: TYPE_COLOR[ov.type] || "#888", fontSize: 13 }}>{TYPE_ICON[ov.type] || "•"}</span>
      <input
        type="text"
        value={ov.label || ""}
        onChange={e => onUpdate?.(ov.id, { label: e.target.value })}
        style={S.ovLabel}
        placeholder={ov.type}
      />
      {measurement && <span style={S.ovMeas}>{measurement}</span>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );
}

const S = {
  wrap:      { display: "flex", flexDirection: "column", gap: 10 },
  heading:   { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  muted:     { fontSize: 13, color: "#94a3b8", margin: 0 },
  warn:      { padding: "8px 10px", borderRadius: 7, background: "#fef9c3", color: "#92400e", fontSize: 13, fontWeight: 600 },
  pageTitle: { fontSize: 13, fontWeight: 700, color: "#475569" },
  block:     { display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" },
  blockTitle:{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  row:       { display: "flex", alignItems: "center", gap: 8 },
  rowLabel:  { flex: 1, fontSize: 13, color: "#334155" },
  rowValue:  { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  roomCard:  { border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4, background: "#fff" },
  roomTop:   { display: "flex", alignItems: "center", gap: 6 },
  nameInput: { flex: 1, padding: "4px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, outline: "none" },
  areaVal:   { fontSize: 12, fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap" },
  finishSel: { padding: "4px 6px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer" },
  roomStats: { fontSize: 11, color: "#64748b" },
  ovRow:     { display: "flex", alignItems: "center", gap: 6 },
  ovLabel:   { flex: 1, padding: "3px 6px", border: "1px solid transparent", borderRadius: 4, fontSize: 12, outline: "none", background: "transparent" },
  ovMeas:    { fontSize: 11, color: "#0369a1", fontWeight: 700, whiteSpace: "nowrap" },
};
