// AIReviewPanel.jsx
// Review panel for AI-detected overlays.
// Shows all "suggested" items grouped by type with confidence indicators.
// Allows accept / confirm / delete per item and bulk actions.

import { useState, useMemo } from "react";
import { STYLE, OT } from "./takeoffTypes";
import { overlayMeasure, fmtM, fmtM2 } from "./takeoffUtils";

const TYPE_LABELS = {
  externalWall: "External Walls",
  internalWall: "Internal Walls",
  room:         "Rooms",
  door:         "Doors",
  window:       "Windows",
};

const CONF_META = {
  high:   { label: "High",   color: "#16a34a", bg: "#dcfce7", dot: "#16a34a" },
  medium: { label: "Medium", color: "#d97706", bg: "#fef9c3", dot: "#f59e0b" },
  low:    { label: "Low",    color: "#dc2626", bg: "#fee2e2", dot: "#ef4444" },
};

export default function AIReviewPanel({
  overlays,         // all overlays on the current page
  aiRooms,          // room analysis records from AI
  ppm,              // pixels per metre for measurements
  selectedId,
  onSelect,
  onAccept,         // (id) → status "edited"
  onConfirm,        // (id) → status "confirmed"
  onDelete,         // (id) → remove overlay
  onAcceptAllHigh,  // () → accept all high-confidence suggestions
  onDeleteAllSuggested, // () → remove all suggestions
}) {
  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());

  const suggested = useMemo(
    () => (overlays || []).filter(o => o.status === "suggested" && o.source === "ai"),
    [overlays]
  );

  const filtered = filter === "all" ? suggested : suggested.filter(o => o.type === filter);

  const highCount   = suggested.filter(o => o.confidence === "high").length;
  const medCount    = suggested.filter(o => o.confidence === "medium").length;
  const lowCount    = suggested.filter(o => o.confidence === "low").length;

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirmSelected = () => {
    selectedIds.forEach(id => onConfirm?.(id));
    setSelectedIds(new Set());
  };

  const deleteSelected = () => {
    selectedIds.forEach(id => onDelete?.(id));
    setSelectedIds(new Set());
  };

  if (!suggested.length && !aiRooms?.length) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
        <div style={S.emptyTitle}>No AI suggestions yet</div>
        <div style={S.emptyText}>
          Click <strong>Analyse Plan With AI</strong> in the toolbar to detect walls, rooms, doors and windows.
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {/* Summary chips */}
      <div style={S.chips}>
        <ConfChip label={`${highCount} High`}   meta={CONF_META.high}   />
        <ConfChip label={`${medCount} Medium`}  meta={CONF_META.medium} />
        <ConfChip label={`${lowCount} Low`}     meta={CONF_META.low}    />
      </div>

      {/* Bulk actions */}
      <div style={S.bulkRow}>
        {highCount > 0 && (
          <button style={S.bulkBtn} onClick={() => { onAcceptAllHigh?.(); setSelectedIds(new Set()); }}>
            ✓ Accept All High ({highCount})
          </button>
        )}
        {selectedIds.size > 0 && (
          <>
            <button style={{ ...S.bulkBtn, ...S.confirmBtn }} onClick={confirmSelected}>
              ✓ Confirm ({selectedIds.size})
            </button>
            <button style={{ ...S.bulkBtn, ...S.deleteBtn }} onClick={deleteSelected}>
              ✕ Delete ({selectedIds.size})
            </button>
          </>
        )}
        {suggested.length > 0 && !selectedIds.size && (
          <button style={{ ...S.bulkBtn, ...S.deleteBtn }} onClick={() => { onDeleteAllSuggested?.(); }}>
            ✕ Clear All
          </button>
        )}
      </div>

      {/* Type filter */}
      <div style={S.filters}>
        {["all", ...Object.keys(TYPE_LABELS)].map(t => (
          <button
            key={t}
            style={{ ...S.filterBtn, ...(filter === t ? S.filterBtnOn : {}) }}
            onClick={() => setFilter(t)}
          >
            {t === "all" ? `All (${suggested.length})` : `${TYPE_LABELS[t]} (${suggested.filter(o=>o.type===t).length})`}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={S.list}>
        {filtered.length === 0 && (
          <div style={S.noItems}>No {filter === "all" ? "suggestions" : TYPE_LABELS[filter]} to review.</div>
        )}
        {filtered.map(ov => {
          const conf = CONF_META[ov.confidence] || CONF_META.medium;
          const m    = overlayMeasure(ov, ppm);
          const isSel = selectedIds.has(ov.id);
          const isHl  = ov.id === selectedId;
          const style = STYLE[ov.type] || {};
          return (
            <div
              key={ov.id}
              style={{ ...S.item, ...(isHl ? S.itemHl : {}), ...(isSel ? S.itemSel : {}) }}
              onClick={() => { onSelect?.(ov.id); }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={e => { e.stopPropagation(); toggleSelect(ov.id); }}
                style={{ flexShrink: 0 }}
              />

              {/* Type dot */}
              <span style={{ ...S.dot, background: style.stroke || "#888" }} />

              {/* Label + measurement */}
              <div style={S.itemBody}>
                <div style={S.itemLabel}>{ov.roomName || ov.label}</div>
                <div style={S.itemMeta}>
                  {m.lengthM != null && <span>{fmtM(m.lengthM)}</span>}
                  {m.areaM2  != null && <span>{fmtM2(m.areaM2)}</span>}
                </div>
              </div>

              {/* Confidence badge */}
              <span style={{ ...S.confBadge, background: conf.bg, color: conf.color }}>
                {conf.label}
              </span>

              {/* Actions */}
              <div style={S.itemActions} onClick={e => e.stopPropagation()}>
                <button style={S.acceptBtn} title="Accept (mark as edited)" onClick={() => onAccept?.(ov.id)}>✓</button>
                <button style={S.delBtn}    title="Delete this suggestion"  onClick={() => onDelete?.(ov.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI room records (labels without polygon) */}
      {aiRooms?.length > 0 && (
        <div style={S.roomSection}>
          <div style={S.roomSectionTitle}>Room Labels Detected</div>
          {aiRooms.map(r => {
            const conf = CONF_META[r.confidence] || CONF_META.medium;
            return (
              <div key={r.id} style={S.roomRecord}>
                <span style={S.roomName}>{r.name}</span>
                <span style={{ ...S.confBadge, background: conf.bg, color: conf.color }}>{conf.label}</span>
                {!r.hasPolygon && <span style={S.needsBoundary}>needs boundary</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfChip({ label, meta }) {
  return (
    <span style={{ padding: "3px 8px", borderRadius: 99, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

const S = {
  wrap:         { display:"flex", flexDirection:"column", gap:8 },
  chips:        { display:"flex", gap:5 },
  bulkRow:      { display:"flex", gap:5, flexWrap:"wrap" },
  bulkBtn:      { padding:"4px 10px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#fff", color:"#334155", fontSize:11, fontWeight:600, cursor:"pointer" },
  confirmBtn:   { borderColor:"#16a34a", color:"#15803d", background:"#f0fdf4" },
  deleteBtn:    { borderColor:"#f87171", color:"#dc2626" },
  filters:      { display:"flex", gap:3, flexWrap:"wrap" },
  filterBtn:    { padding:"3px 8px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#f8fafc", color:"#64748b", fontSize:10, fontWeight:600, cursor:"pointer" },
  filterBtnOn:  { background:"#eff6ff", borderColor:"#3b82f6", color:"#1d4ed8" },
  list:         { display:"flex", flexDirection:"column", gap:4 },
  noItems:      { fontSize:12, color:"#94a3b8", fontStyle:"italic", padding:"8px 0" },
  item:         { display:"flex", alignItems:"center", gap:6, padding:"6px 8px", border:"1.5px solid #e2e8f0", borderRadius:8, background:"#fff", cursor:"pointer", transition:"border-color 0.1s" },
  itemHl:       { borderColor:"#3b82f6", background:"#eff6ff" },
  itemSel:      { background:"#f0fdf4", borderColor:"#86efac" },
  dot:          { width:8, height:8, borderRadius:2, flexShrink:0 },
  itemBody:     { flex:1, minWidth:0 },
  itemLabel:    { fontSize:12, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  itemMeta:     { fontSize:11, color:"#64748b", display:"flex", gap:8 },
  confBadge:    { fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99, flexShrink:0 },
  itemActions:  { display:"flex", gap:3, flexShrink:0 },
  acceptBtn:    { width:22, height:22, border:"1px solid #16a34a", borderRadius:4, background:"#f0fdf4", color:"#15803d", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  delBtn:       { width:22, height:22, border:"1px solid #f87171", borderRadius:4, background:"#fff", color:"#dc2626", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  roomSection:  { borderTop:"1px solid #e2e8f0", paddingTop:8, display:"flex", flexDirection:"column", gap:4 },
  roomSectionTitle: { fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" },
  roomRecord:   { display:"flex", alignItems:"center", gap:6, padding:"4px 0" },
  roomName:     { flex:1, fontSize:12, fontWeight:600, color:"#334155" },
  needsBoundary:{ fontSize:10, color:"#d97706", fontStyle:"italic" },
  empty:        { display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"20px 12px", textAlign:"center" },
  emptyTitle:   { fontSize:14, fontWeight:700, color:"#334155" },
  emptyText:    { fontSize:12, color:"#64748b", lineHeight:1.5 },
};
