// TakeoffToolbar.jsx

import { useState } from "react";
import { TOOLS } from "./takeoffTypes";

const GROUPS = [
  {
    label: "Select",
    tools: [
      { key: TOOLS.POINTER, icon: "↖", label: "Pointer", tip: "Select overlays." },
      { key: TOOLS.PAN, icon: "✋", label: "Pan", tip: "Pan the plan view. Middle mouse or Space+drag works with any tool." },
    ],
  },
  {
    label: "Measure",
    tools: [
      { key: TOOLS.MEASURE, icon: "📏", label: "Measure", tip: "Click two points to draw a measurement line." },
      { key: TOOLS.AREA, icon: "m2", label: "Area", color: "#0f766e", tip: "Trace a shape to calculate area." },
      { key: TOOLS.POLYLINE, icon: "〰", label: "Polyline", tip: "Draw a multi-point line." },
    ],
  },
  {
    label: "Walls",
    tools: [
      { key: TOOLS.EXTERNAL_WALL, icon: "━━", label: "Ext Wall", color: "#1d4ed8", tip: "Draw external walls." },
      { key: TOOLS.INTERNAL_WALL, icon: "───", label: "Int Wall", color: "#ea580c", tip: "Draw internal wall segments." },
    ],
  },
  {
    label: "Areas",
    tools: [
      { key: TOOLS.ROOM, icon: "⬡", label: "Room", color: "#0369a1", tip: "Draw room polygon." },
      { key: TOOLS.RECTANGLE, icon: "▭", label: "Rectangle", color: "#7c3aed", tip: "Click two opposite corners." },
      { key: TOOLS.CIRCLE, icon: "◯", label: "Circle", color: "#0891b2", tip: "Click centre then radius." },
    ],
  },
  {
    label: "Elements",
    tools: [
      { key: TOOLS.DOOR, icon: "🚪", label: "Door", color: "#16a34a", tip: "Place a door marker." },
      { key: TOOLS.WINDOW, icon: "🪟", label: "Window", color: "#7c3aed", tip: "Place a window marker." },
      { key: TOOLS.COLUMN, icon: "▪", label: "Column", color: "#92400e", tip: "Place a column marker." },
    ],
  },
  {
    label: "Edit",
    tools: [
      { key: TOOLS.DELETE, icon: "✕", label: "Delete", color: "#dc2626", tip: "Click an overlay to delete it." },
    ],
  },
];

export default function TakeoffToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  overlayCount,
  confirmedCount,
  onAnalysePlan,
  analysing,
  hasPage,
  setupReady = false,
}) {
  return (
    <div style={S.bar}>
      {GROUPS.map((group, groupIndex) => (
        <div key={group.label} style={S.group}>
          {groupIndex > 0 && <div style={S.sep} />}
          <div style={S.groupLabel}>{group.label}</div>
          <div style={S.groupTools}>
            {group.tools.map((tool) => (
              <ToolBtn
                key={tool.key}
                {...tool}
                active={activeTool === tool.key}
                disabled={!setupReady && tool.key !== TOOLS.POINTER && tool.key !== TOOLS.PAN}
                onClick={() => onToolChange(tool.key)}
              />
            ))}
          </div>
        </div>
      ))}

      <div style={S.sep} />

      <div style={S.group}>
        <div style={S.groupLabel}>History</div>
        <div style={S.groupTools}>
          <ActionBtn onClick={onUndo} disabled={!canUndo} title="Undo">↩</ActionBtn>
          <ActionBtn onClick={onRedo} disabled={!canRedo} title="Redo">↪</ActionBtn>
        </div>
      </div>

      <div style={S.sep} />
      <div style={S.group}>
        <div style={S.groupLabel}>AI</div>
        <div style={S.groupTools}>
          <button
            type="button"
            title={!hasPage ? "Upload a PDF plan first" : !setupReady ? "Confirm the plan scale first" : "Detect walls, rooms and doors using AI vision"}
            disabled={analysing || !hasPage || !setupReady}
            onClick={onAnalysePlan}
            style={{ ...S.aiBtn, ...((!hasPage || analysing || !setupReady) ? S.aiBtnOff : {}) }}
          >
            {analysing ? "🔄 Analysing…" : "🤖 Analyse Plan"}
          </button>
        </div>
      </div>

      {overlayCount > 0 && (
        <div style={S.stats}>
          <span>{overlayCount} item{overlayCount !== 1 ? "s" : ""}</span>
          {confirmedCount > 0 && <span style={{ color: "#16a34a" }}>- {confirmedCount} confirmed</span>}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, title, tip, active, color, onClick, disabled = false }) {
  const [hover, setHover] = useState(false);
  const c = color || "#334155";
  return (
    <button
      type="button"
      title={disabled ? "Confirm the plan scale first" : title || tip || label}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.tool,
        ...(active ? { background: `${c}18`, borderColor: c, color: c } : {}),
        ...(hover && !active && !disabled ? { background: "#f1f5f9" } : {}),
        ...(disabled ? S.off : {}),
      }}
    >
      <span style={S.toolIcon}>{icon}</span>
      <span style={S.toolLabel}>{label}</span>
    </button>
  );
}

function ActionBtn({ onClick, disabled, title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...S.action, ...(hover && !disabled ? { background: "#f1f5f9" } : {}), ...(disabled ? S.off : {}) }}
    >
      {children}
    </button>
  );
}

const S = {
  bar: { display: "flex", alignItems: "flex-end", gap: 0, padding: "6px 10px", background: "#fff", borderBottom: "2px solid #e2e8f0", flexShrink: 0, overflowX: "auto" },
  group: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  groupLabel: { fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1 },
  groupTools: { display: "flex", gap: 3 },
  sep: { width: 1, height: 44, background: "#e2e8f0", margin: "0 6px", flexShrink: 0, alignSelf: "center" },
  tool: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "5px 7px", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#fff", cursor: "pointer", color: "#334155", minWidth: 46, transition: "all 0.1s" },
  toolIcon: { fontSize: 12, lineHeight: 1, fontWeight: 900 },
  toolLabel: { fontSize: 10, fontWeight: 700, color: "inherit", whiteSpace: "nowrap" },
  action: { width: 36, height: 36, border: "1.5px solid #e2e8f0", borderRadius: 7, background: "#fff", color: "#334155", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  off: { opacity: 0.35, cursor: "not-allowed" },
  aiBtn: { padding: "5px 12px", border: "2px solid #7c3aed", borderRadius: 8, background: "#faf5ff", color: "#6d28d9", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  aiBtnOff: { opacity: 0.4, cursor: "not-allowed" },
  stats: { marginLeft: "auto", fontSize: 12, color: "#64748b", display: "flex", gap: 6, alignItems: "center", paddingLeft: 12, flexShrink: 0 },
};
