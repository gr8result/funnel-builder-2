// ObjectPanel.jsx — Properties of the currently selected overlay.

import { STYLE, FLOOR_FINISHES, WALL_TYPES, LEVELS, OT } from "./takeoffTypes";
import { overlayMeasure, fmtM, fmtM2, fmtMM } from "./takeoffUtils";

export default function ObjectPanel({ overlay, ppm, onUpdate, onDelete }) {
  if (!overlay) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>↖</div>
        <div style={S.emptyText}>Select an overlay with the Pointer tool to edit its properties.</div>
      </div>
    );
  }

  const st = STYLE[overlay.type] || {};
  const m  = overlayMeasure(overlay, ppm);

  return (
    <div style={S.wrap}>
      <div style={S.typeRow}>
        <span style={{ ...S.typeDot, background: st.stroke || "#888" }} />
        <span style={S.typeName}>{st.label || overlay.type}</span>
        <button type="button" onClick={() => onDelete?.(overlay.id)} style={S.delBtn} title="Delete this overlay">🗑 Delete</button>
      </div>

      {/* Label / name */}
      <Field label="Label">
        <input
          type="text"
          value={overlay.label || ""}
          onChange={e => onUpdate?.(overlay.id, { label: e.target.value })}
          style={S.input}
        />
      </Field>

      {/* Room name (for room polygon) */}
      {overlay.type === OT.ROOM && (
        <Field label="Room name">
          <input
            type="text"
            value={overlay.roomName || ""}
            placeholder="e.g. Kitchen"
            onChange={e => onUpdate?.(overlay.id, { roomName: e.target.value, label: e.target.value || overlay.label })}
            style={S.input}
          />
        </Field>
      )}

      {/* Level */}
      <Field label="Level">
        <select value={overlay.level||"ground"} onChange={e=>onUpdate?.(overlay.id,{level:e.target.value})} style={S.select}>
          {LEVELS.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>

      {/* Wall type (for walls) */}
      {(overlay.type===OT.EXTERNAL_WALL||overlay.type===OT.INTERNAL_WALL) && (
        <Field label="Wall type">
          <select value={overlay.wallType||""} onChange={e=>onUpdate?.(overlay.id,{wallType:e.target.value})} style={S.select}>
            {WALL_TYPES.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
      )}

      {/* Floor finish (for rooms / rectangles) */}
      {(overlay.type===OT.ROOM||overlay.type===OT.AREA||overlay.type===OT.RECTANGLE) && (
        <Field label="Floor finish">
          <select value={overlay.floorFinish||""} onChange={e=>onUpdate?.(overlay.id,{floorFinish:e.target.value})} style={S.select}>
            {FLOOR_FINISHES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
      )}

      {/* Calculated measurements */}
      <div style={S.measBlock}>
        <div style={S.measTitle}>Measurements</div>
        {m.lengthM   != null && <MRow label="Length"     value={`${fmtM(m.lengthM)}  (${fmtMM(m.lengthM)})`} />}
        {m.areaM2    != null && <MRow label="Area"       value={fmtM2(m.areaM2)} />}
        {m.perimM    != null && <MRow label="Perimeter"  value={fmtM(m.perimM)} />}
        {m.radiusM   != null && <MRow label="Radius"     value={fmtM(m.radiusM)} />}
        {!ppm && <div style={S.noScale}>Set scale to calculate measurements.</div>}
      </div>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={overlay.notes||""}
          onChange={e=>onUpdate?.(overlay.id,{notes:e.target.value})}
          rows={2}
          style={{...S.input, resize:"vertical", lineHeight:1.4}}
        />
      </Field>

      {/* Confirm */}
      <button
        type="button"
        onClick={()=>onUpdate?.(overlay.id,{status:overlay.status==="confirmed"?"draft":"confirmed"})}
        style={{...S.confirmBtn,...(overlay.status==="confirmed"?S.confirmOn:{})}}
      >
        {overlay.status==="confirmed" ? "✓ Confirmed — click to unconfirm" : "Confirm this item"}
      </button>

      <div style={S.idLabel}>ID: {overlay.id}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function MRow({ label, value }) {
  return (
    <div style={S.mRow}>
      <span style={S.mLabel}>{label}</span>
      <span style={S.mVal}>{value}</span>
    </div>
  );
}

const S = {
  wrap:       { display:"flex", flexDirection:"column", gap:8 },
  typeRow:    { display:"flex", alignItems:"center", gap:8 },
  typeDot:    { width:10, height:10, borderRadius:2, flexShrink:0 },
  typeName:   { flex:1, fontSize:13, fontWeight:700, color:"#334155" },
  delBtn:     { padding:"3px 8px", border:"1px solid #f87171", borderRadius:5, background:"#fff", color:"#dc2626", fontSize:11, cursor:"pointer" },
  field:      { display:"flex", flexDirection:"column", gap:3 },
  fieldLabel: { fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" },
  input:      { padding:"5px 8px", border:"1.5px solid #e2e8f0", borderRadius:6, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" },
  select:     { padding:"5px 8px", border:"1.5px solid #e2e8f0", borderRadius:6, fontSize:13, cursor:"pointer", width:"100%", boxSizing:"border-box" },
  measBlock:  { background:"#f8fafc", borderRadius:8, border:"1px solid #e2e8f0", padding:"8px 10px", display:"flex", flexDirection:"column", gap:4 },
  measTitle:  { fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 },
  mRow:       { display:"flex", justifyContent:"space-between", gap:8 },
  mLabel:     { fontSize:12, color:"#64748b" },
  mVal:       { fontSize:12, fontWeight:700, color:"#0369a1" },
  noScale:    { fontSize:11, color:"#d97706", fontStyle:"italic" },
  confirmBtn: { padding:"7px 12px", border:"1.5px solid #e2e8f0", borderRadius:7, background:"#fff", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer", width:"100%", textAlign:"center" },
  confirmOn:  { background:"#dcfce7", borderColor:"#16a34a", color:"#15803d" },
  idLabel:    { fontSize:10, color:"#cbd5e1" },
  empty:      { display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"20px 12px", textAlign:"center" },
  emptyText:  { fontSize:12, color:"#94a3b8", lineHeight:1.5 },
};
