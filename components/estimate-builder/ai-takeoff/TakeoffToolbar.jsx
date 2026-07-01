// TakeoffToolbar.jsx — Phase 2 professional toolbar.

import { useState } from "react";
import { TOOLS } from "./takeoffTypes";

const GROUPS = [
  {
    label: "Select",
    tools: [
      { key: TOOLS.POINTER, icon: "↖", label: "Pointer", tip: "Select and edit overlays. Drag control points to move vertices." },
      { key: TOOLS.PAN,     icon: "✋", label: "Pan",     tip: "Click and drag to pan the plan. Space+drag works with any tool." },
    ],
  },
  {
    label: "Measure",
    tools: [
      { key: TOOLS.MEASURE,  icon: "📏", label: "Measure",  tip: "Click two points to draw a measurement line with length." },
      { key: TOOLS.AREA,     icon: "m2",   label: "Area",     color: "#0f766e", tip: "Trace any shape to calculate area. Double-click, Enter, or click near the start to finish." },
      { key: TOOLS.POLYLINE, icon: "〰",  label: "Polyline", tip: "Draw a multi-point line (general measurement). Double-click to finish." },
    ],
  },
  {
    label: "Walls",
    tools: [
      { key: TOOLS.EXTERNAL_WALL, icon: "━━", label: "Ext Wall", color: "#1d4ed8", tip: "Draw external walls (blue). Click points, double-click or Enter to finish. Scale required." },
      { key: TOOLS.INTERNAL_WALL, icon: "───", label: "Int Wall", color: "#ea580c", tip: "Draw internal walls (orange). Same as external wall." },
    ],
  },
  {
    label: "Areas",
    tools: [
      { key: TOOLS.ROOM,      icon: "⬡",  label: "Room",      color: "#0369a1", tip: "Draw room polygon. Click vertices, double-click or click near start to close." },
      { key: TOOLS.RECTANGLE, icon: "▭",  label: "Rectangle", color: "#7c3aed", tip: "Click two opposite corners to define a rectangular area." },
      { key: TOOLS.CIRCLE,    icon: "◯",  label: "Circle",    color: "#0891b2", tip: "Click centre then click to set radius." },
    ],
  },
  {
    label: "Elements",
    tools: [
      { key: TOOLS.DOOR,   icon: "🚪", label: "Door",   color: "#16a34a", tip: "Single click places a door marker." },
      { key: TOOLS.WINDOW, icon: "🪟", label: "Window", color: "#7c3aed", tip: "Single click places a window marker." },
      { key: TOOLS.COLUMN, icon: "▪",  label: "Column", color: "#92400e", tip: "Single click places a structural column marker." },
    ],
  },
  {
    label: "Edit",
    tools: [
      { key: TOOLS.DELETE, icon: "✕", label: "Delete", color: "#dc2626", tip: "Click any overlay to delete it. Or select with Pointer then press Delete." },
    ],
  },
];

export default function TakeoffToolbar({
  activeTool, onToolChange,
  snapEnabled, onToggleSnap,
  onUndo, onRedo, canUndo, canRedo,
  overlayCount, confirmedCount,
  onAnalysePlan, onOrientPlan, analysing, hasPage, setupReady = false,
}) {
  return (
    <div style={S.bar}>

      {GROUPS.map((g, gi) => (
        <div key={g.label} style={S.group}>
          {gi > 0 && <div style={S.sep} />}
          <div style={S.groupLabel}>{g.label}</div>
          <div style={S.groupTools}>
            {g.tools.map(t => (
              <ToolBtn
                key={t.key}
                {...t}
                active={activeTool===t.key}
                disabled={!setupReady && t.key !== TOOLS.POINTER && t.key !== TOOLS.PAN}
                onClick={()=>onToolChange(t.key)}
              />
            ))}
          </div>
        </div>
      ))}

      <div style={S.sep} />

      {/* Snap toggle */}
      <div style={S.group}>
        <div style={S.groupLabel}>Snap</div>
        <div style={S.groupTools}>
          <ToolBtn icon="⊕" label={snapEnabled?"On":"Off"} title="Snap to existing vertices" active={snapEnabled} color="#7c3aed" onClick={onToggleSnap} />
        </div>
      </div>

      <div style={S.sep} />

      {/* Undo / redo */}
      <div style={S.group}>
        <div style={S.groupLabel}>History</div>
        <div style={S.groupTools}>
          <ActionBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</ActionBtn>
          <ActionBtn onClick={onRedo} disabled={!canRedo} title="Redo">↪</ActionBtn>
        </div>
      </div>

      {/* Analyse Plan With AI — main CTA */}
      <div style={S.sep} />
      <div style={S.group}>
        <div style={S.groupLabel}>AI</div>
        <div style={S.groupTools}>
          <button
            type="button"
            title={!hasPage ? "Upload a PDF plan first" : "Use AI to rotate this plan upright"}
            disabled={analysing || !hasPage}
            onClick={onOrientPlan}
            style={{ ...S.orientBtn, ...((!hasPage || analysing) ? S.aiBtnOff : {}) }}
          >
            Orient Plan
          </button>
          <button
            type="button"
            title={!hasPage ? "Upload a PDF plan first" : !setupReady ? "Complete Plan Setup first" : "Detect walls, rooms and doors using AI vision"}
            disabled={analysing || !hasPage || !setupReady}
            onClick={onAnalysePlan}
            style={{ ...S.aiBtn, ...((!hasPage || analysing || !setupReady) ? S.aiBtnOff : {}) }}
          >
            {analysing ? "🔄 Analysing…" : "🤖 Analyse Plan"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {overlayCount > 0 && (
        <div style={S.stats}>
          <span>{overlayCount} item{overlayCount!==1?"s":""}</span>
          {confirmedCount > 0 && <span style={{color:"#16a34a"}}>· {confirmedCount} confirmed</span>}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, title, tip, active, color, onClick, disabled = false }) {
  const [h, sh] = useState(false);
  const c = color || "#334155";
  return (
    <button type="button" title={disabled ? "Complete Plan Setup first" : title || tip || label} onClick={onClick} disabled={disabled}
      onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{
        ...S.tool,
        ...(active ? { background:`${c}18`, borderColor:c, color:c } : {}),
        ...(h&&!active&&!disabled ? { background:"#f1f5f9" } : {}),
        ...(disabled ? S.off : {}),
      }}>
      <span style={{fontSize:15,lineHeight:1}}>{icon}</span>
      <span style={{fontSize:10,fontWeight:700,color:"inherit",whiteSpace:"nowrap"}}>{label}</span>
    </button>
  );
}

function ActionBtn({ onClick, disabled, title, children }) {
  const [h, sh] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{...S.action,...(h&&!disabled?{background:"#f1f5f9"}:{}),...(disabled?S.off:{})}}>
      {children}
    </button>
  );
}

const S = {
  bar:        { display:"flex", alignItems:"flex-end", gap:0, padding:"6px 10px", background:"#fff", borderBottom:"2px solid #e2e8f0", flexShrink:0, overflowX:"auto" },
  group:      { display:"flex", flexDirection:"column", alignItems:"center", gap:2 },
  groupLabel: { fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em", lineHeight:1 },
  groupTools: { display:"flex", gap:3 },
  sep:        { width:1, height:44, background:"#e2e8f0", margin:"0 6px", flexShrink:0, alignSelf:"center" },
  tool:       { display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"5px 7px", border:"1.5px solid #e2e8f0", borderRadius:7, background:"#fff", cursor:"pointer", color:"#334155", minWidth:46, transition:"all 0.1s" },
  action:     { width:36, height:36, border:"1.5px solid #e2e8f0", borderRadius:7, background:"#fff", color:"#334155", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  off:        { opacity:.35, cursor:"not-allowed" },
  orientBtn:  { padding:"5px 10px", border:"2px solid #0f766e", borderRadius:8, background:"#ecfdf5", color:"#0f766e", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  aiBtn:      { padding:"5px 12px", border:"2px solid #7c3aed", borderRadius:8, background:"#faf5ff", color:"#6d28d9", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  aiBtnOff:   { opacity:0.4, cursor:"not-allowed" },
  stats:      { marginLeft:"auto", fontSize:12, color:"#64748b", display:"flex", gap:6, alignItems:"center", paddingLeft:12, flexShrink:0 },
};
