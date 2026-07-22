// RoomPanel.jsx — Room table with area, perimeter, floor finish, confirm status.

import { FLOOR_FINISHES } from "./takeoffTypes";
import { overlayMeasure, fmtM2, fmtM } from "./takeoffUtils";

export default function RoomPanel({ overlays, ppm, selectedId, onSelect, onUpdate }) {
  const rooms = (overlays || []).filter(ov => ov.type === "room");

  if (rooms.length === 0) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⬡</div>
        <div style={S.emptyTitle}>No rooms drawn yet</div>
        <div style={S.emptyText}>
          Use the <strong>Room</strong> tool to draw room polygons on the plan.
          Each room will appear here with its area and floor finish.
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.heading}>Rooms <span style={S.badge}>{rooms.length}</span></div>

      {!ppm && (
        <div style={S.noScale}>Set scale to calculate areas.</div>
      )}

      <div style={S.table}>
        {rooms.map(room => {
          const m    = overlayMeasure(room, ppm);
          const isSel= room.id === selectedId;
          return (
            <div
              key={room.id}
              style={{ ...S.row, ...(isSel ? S.rowSel : {}) }}
              onClick={() => onSelect?.(isSel ? null : room.id)}
            >
              {/* Room name */}
              <input
                type="text"
                value={room.roomName || room.label || ""}
                placeholder="Room name"
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdate?.(room.id, { roomName: e.target.value, label: e.target.value })}
                style={S.nameInput}
              />

              {/* Measurements */}
              <div style={S.measurements}>
                <span style={S.measLabel}>Area</span>
                <span style={S.measVal}>{fmtM2(m.areaM2)}</span>
                <span style={S.measLabel}>Perimeter</span>
                <span style={S.measVal}>{fmtM(m.perimM)}</span>
              </div>

              {/* Floor finish */}
              <select
                value={room.floorFinish || ""}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdate?.(room.id, { floorFinish: e.target.value })}
                style={S.finishSel}
              >
                {FLOOR_FINISHES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>

              {/* Confirm toggle */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUpdate?.(room.id, { status: room.status === "confirmed" ? "draft" : "confirmed" }); }}
                style={{ ...S.confirmBtn, ...(room.status === "confirmed" ? S.confirmBtnOn : {}) }}
                title={room.status === "confirmed" ? "Click to unconfirm" : "Confirm this room"}
              >
                {room.status === "confirmed" ? "✓ Confirmed" : "Confirm"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      {ppm && (
        <div style={S.totals}>
          <span style={S.totLabel}>Total floor area</span>
          <span style={S.totVal}>
            {(rooms.reduce((s, r) => { const m = overlayMeasure(r, ppm); return s + (m.areaM2 || 0); }, 0)).toFixed(2)} m²
          </span>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap:        { display:"flex", flexDirection:"column", gap:8 },
  heading:     { display:"flex", alignItems:"center", gap:8, fontSize:14, fontWeight:700, color:"#0f172a" },
  badge:       { fontSize:11, fontWeight:700, background:"#dbeafe", color:"#1d4ed8", padding:"1px 7px", borderRadius:99 },
  noScale:     { padding:"7px 10px", borderRadius:7, background:"#fef9c3", color:"#92400e", fontSize:12, fontWeight:600 },
  table:       { display:"flex", flexDirection:"column", gap:6 },
  row:         { display:"flex", flexDirection:"column", gap:5, padding:"8px 10px", border:"1.5px solid #e2e8f0", borderRadius:9, background:"#fff", cursor:"pointer", transition:"border-color 0.1s" },
  rowSel:      { borderColor:"#3b82f6", background:"#eff6ff" },
  nameInput:   { padding:"4px 7px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:13, fontWeight:700, color:"#0f172a", outline:"none", width:"100%", boxSizing:"border-box" },
  measurements:{ display:"grid", gridTemplateColumns:"auto 1fr auto 1fr", gap:"2px 8px", alignItems:"center" },
  measLabel:   { fontSize:11, color:"#64748b", fontWeight:600 },
  measVal:     { fontSize:12, fontWeight:700, color:"#0369a1" },
  finishSel:   { padding:"4px 7px", border:"1.5px solid #e2e8f0", borderRadius:6, fontSize:12, color:"#334155", cursor:"pointer", width:"100%" },
  confirmBtn:  { padding:"4px 10px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#fff", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer", alignSelf:"flex-start" },
  confirmBtnOn:{ background:"#dcfce7", borderColor:"#16a34a", color:"#15803d" },
  empty:       { display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"20px 12px", textAlign:"center" },
  emptyTitle:  { fontSize:14, fontWeight:700, color:"#334155" },
  emptyText:   { fontSize:12, color:"#64748b", lineHeight:1.5 },
  totals:      { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:"#eff6ff", borderRadius:8, border:"1.5px solid #bfdbfe" },
  totLabel:    { fontSize:13, fontWeight:600, color:"#1d4ed8" },
  totVal:      { fontSize:14, fontWeight:700, color:"#0f172a" },
};
