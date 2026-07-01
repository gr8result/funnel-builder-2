// GanttChart.jsx
// Interactive Gantt chart rendered with SVG.
// Supports: drag to move tasks, resize duration, dependency lines,
// stage/trade filters, export CSV, export print.

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { resolveDependencies, tasksWithDates, projectEndOffset, formatDate, addDays, toIsoDate, tasksToCSV, buildProcurementCards } from "./ganttUtils";

const DAY_W   = 28;   // pixels per day
const ROW_H   = 34;   // pixels per row
const HDR_H   = 52;   // header height
const LEFT_W  = 280;  // left panel width

const STAGE_COLORS = {
  "Preliminaries & Admin":     "#7c3aed",
  "Approvals & Engineering":   "#2563eb",
  "Site Setup":                "#0891b2",
  "Earthworks & Site Prep":    "#ca8a04",
  "Slab / Base Stage":         "#dc2626",
  "Frame Stage":               "#ea580c",
  "Roof Stage":                "#9333ea",
  "Lock-Up Stage":             "#1d4ed8",
  "Fit-Out / Rough-Ins":       "#059669",
  "Waterproofing & Tiling":    "#0e7490",
  "Linings & Plaster":         "#6d28d9",
  "Joinery & Cabinetry":       "#b45309",
  "Fit-Off Trades":            "#047857",
  "Painting":                  "#be185d",
  "Flooring":                  "#7c2d12",
  "Appliances & Fixtures":     "#1e40af",
  "External Works":            "#166534",
  "Final Clean & Inspections": "#0f172a",
  "Practical Completion":      "#15803d",
  "Handover":                  "#16a34a",
};

function barColor(task) {
  if (task.procurementType === "inspection") return "#f59e0b";
  if (task.procurementType === "milestone")  return "#7c3aed";
  if (task.isProcurement)                    return "#0ea5e9";
  return STAGE_COLORS[task.stage] || "#64748b";
}

export default function GanttChart({
  tasks: rawTasks,
  projectStartDate,
  projectName,
  onBack,
  onTasksChange,
  onPushToProcurement,
}) {
  const [stageFilter, setStageFilter] = useState("all");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [showDeps,    setShowDeps]    = useState(true);
  const scrollRef = useRef(null);
  const leftRef   = useRef(null);

  // Drag/resize state
  const dragRef = useRef(null); // { type: "move"|"resize", taskId, startX, startOffset, startDur }

  // ── Resolve + compute ──────────────────────────────────────────────────────

  const resolved = useMemo(() => resolveDependencies(rawTasks.filter(t => t.included)), [rawTasks]);
  const withDates = useMemo(() => tasksWithDates(resolved, projectStartDate), [resolved, projectStartDate]);
  const totalDays = useMemo(() => projectEndOffset(resolved) + 14, [resolved]);

  const stages = useMemo(() => [...new Set(resolved.map(t => t.stage))], [resolved]);
  const trades  = useMemo(() => [...new Set(resolved.map(t => t.trade).filter(Boolean))], [resolved]);

  const visible = useMemo(() => withDates.filter(t => {
    if (stageFilter !== "all" && t.stage  !== stageFilter) return false;
    if (tradeFilter !== "all" && t.trade  !== tradeFilter) return false;
    return true;
  }), [withDates, stageFilter, tradeFilter]);

  const taskIndex = useMemo(() => Object.fromEntries(visible.map((t, i) => [t.id, i])), [visible]);

  // ── Synchronise vertical scroll ────────────────────────────────────────────

  useEffect(() => {
    const right = scrollRef.current;
    const left  = leftRef.current;
    if (!right || !left) return;
    const onScrollRight = () => { left.scrollTop = right.scrollTop; };
    right.addEventListener("scroll", onScrollRight);
    return () => right.removeEventListener("scroll", onScrollRight);
  }, []);

  // ── Week/month markers ─────────────────────────────────────────────────────

  const timeMarkers = useMemo(() => {
    const markers = [];
    const start   = new Date(projectStartDate || new Date());
    for (let d = 0; d < totalDays; d += 7) {
      const date = addDays(start, d);
      markers.push({ day: d, label: `W${Math.floor(d/7)+1} ${date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}` });
    }
    return markers;
  }, [totalDays, projectStartDate]);

  // ── Drag handling ──────────────────────────────────────────────────────────

  const startDrag = useCallback((e, taskId, type) => {
    e.preventDefault();
    const task = resolved.find(t => t.id === taskId);
    if (!task) return;
    dragRef.current = {
      type,
      taskId,
      startX:      e.clientX,
      startOffset: task.startOffsetDays || 0,
      startDur:    task.durationDays || 1,
    };
    const move = (me) => {
      const dr = dragRef.current;
      if (!dr) return;
      const dx      = me.clientX - dr.startX;
      const dayDelta = Math.round(dx / DAY_W);
      if (dr.type === "move") {
        const newOff = Math.max(0, dr.startOffset + dayDelta);
        onTasksChange(prev => prev.map(t => t.id === dr.taskId ? { ...t, startOffsetDays: newOff } : t));
      } else if (dr.type === "resize") {
        const newDur = Math.max(1, dr.startDur + dayDelta);
        onTasksChange(prev => prev.map(t => t.id === dr.taskId ? { ...t, durationDays: newDur } : t));
      }
    };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
  }, [resolved, onTasksChange]);

  // ── Dependency lines ───────────────────────────────────────────────────────

  const depLines = useMemo(() => {
    if (!showDeps) return [];
    const lines = [];
    for (const task of visible) {
      for (const depId of (task.dependsOn || [])) {
        const predIdx = taskIndex[depId];
        const succIdx = taskIndex[task.id];
        if (predIdx == null || succIdx == null) continue;
        const pred  = visible[predIdx];
        const x1    = (pred.startOffsetDays + pred.durationDays) * DAY_W;
        const y1    = predIdx * ROW_H + ROW_H / 2;
        const x2    = task.startOffsetDays * DAY_W;
        const y2    = succIdx * ROW_H + ROW_H / 2;
        lines.push({ x1, y1, x2, y2, key: `${depId}-${task.id}` });
      }
    }
    return lines;
  }, [visible, taskIndex, showDeps]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const csv  = tasksToCSV(resolved, projectStartDate);
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${projectName || "schedule"}.csv`;
    a.click();
  };

  const exportPrint = () => window.print();

  // ── Procurement push ───────────────────────────────────────────────────────

  const handlePushProcurement = () => {
    const cards = buildProcurementCards(resolved, projectStartDate);
    onPushToProcurement?.(cards);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const svgW = totalDays * DAY_W;
  const svgH = visible.length * ROW_H;

  return (
    <div style={S.wrap}>
      {/* Top bar */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={onBack}>← Back to Review</button>
        <div style={S.topTitle}>{projectName} — Gantt Chart</div>
        <div style={S.topActions}>
          <FilterPill label="Stage" value={stageFilter} options={["all",...stages]} onChange={setStageFilter} />
          <FilterPill label="Trade" value={tradeFilter} options={["all",...trades]} onChange={setTradeFilter} />
          <label style={S.depToggle}>
            <input type="checkbox" checked={showDeps} onChange={e=>setShowDeps(e.target.checked)} />
            &nbsp;Dependencies
          </label>
          <button style={S.actionBtn} onClick={exportCSV}>⤓ CSV</button>
          <button style={S.actionBtn} onClick={exportPrint}>🖨 Print</button>
          {onPushToProcurement && (
            <button style={{ ...S.actionBtn, ...S.procBtn }} onClick={handlePushProcurement}>
              ↗ Push Procurement
            </button>
          )}
        </div>
      </div>

      {/* Gantt body */}
      <div style={S.body}>

        {/* ── Left task list (sticky) ── */}
        <div style={S.leftPanel}>
          {/* Header row */}
          <div style={S.leftHdr}>
            <span style={S.leftHdrText}>Stage / Task</span>
            <span style={S.leftHdrRight}>Trade</span>
          </div>
          {/* Task rows (synced scroll, no overflow) */}
          <div ref={leftRef} style={S.leftScroll}>
            {visible.map((task, i) => (
              <div key={task.id} style={{ ...S.leftRow, ...(i%2?S.leftRowAlt:{}) }}>
                <div style={S.leftRowInner}>
                  <div>
                    <div style={S.leftStage}>{task.stage}</div>
                    <div style={S.leftTask}>{task.task}</div>
                  </div>
                  <div style={S.leftTrade}>{task.trade}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right chart area ── */}
        <div ref={scrollRef} style={S.rightPanel}>
          {/* Timeline header */}
          <div style={{ width: svgW, height: HDR_H, flexShrink: 0, position: "sticky", top: 0, zIndex: 10, background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
            <svg width={svgW} height={HDR_H}>
              {/* Day column grid */}
              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, w) => (
                <line key={w} x1={w*7*DAY_W} x2={w*7*DAY_W} y1={0} y2={HDR_H} stroke="#e2e8f0" strokeWidth={1} />
              ))}
              {/* Week labels */}
              {timeMarkers.map(m => (
                <g key={m.day}>
                  <text x={m.day * DAY_W + 4} y={32} fontSize={10} fill="#64748b" fontWeight="600">{m.label}</text>
                </g>
              ))}
              {/* Today line */}
              <line x1={0} x2={0} y1={0} y2={HDR_H} stroke="#ef4444" strokeWidth={2} />
            </svg>
          </div>

          {/* Chart rows + dependency lines */}
          <svg width={svgW} height={Math.max(svgH, 200)} style={{ display: "block" }}>
            {/* Alternating row background */}
            {visible.map((_, i) => (
              <rect key={i} x={0} y={i*ROW_H} width={svgW} height={ROW_H}
                fill={i%2 ? "#f8fafc" : "#ffffff"} />
            ))}

            {/* Vertical grid lines (weekly) */}
            {timeMarkers.map(m => (
              <line key={m.day} x1={m.day*DAY_W} x2={m.day*DAY_W} y1={0} y2={svgH} stroke="#e2e8f0" strokeWidth={1} />
            ))}

            {/* Task bars */}
            {visible.map((task, i) => {
              const x   = (task.startOffsetDays || 0) * DAY_W;
              const w   = Math.max(4, (task.durationDays || 1) * DAY_W - 2);
              const y   = i * ROW_H + 6;
              const h   = ROW_H - 12;
              const col = barColor(task);
              const isMilestone = task.procurementType === "milestone";
              const isInspection= task.procurementType === "inspection";
              return (
                <g key={task.id}>
                  {isMilestone ? (
                    <polygon points={`${x},${y+h/2} ${x+h/2},${y} ${x+h},${y+h/2} ${x+h/2},${y+h}`} fill={col} />
                  ) : (
                    <>
                      <rect x={x} y={y} width={w} height={h} rx={4} fill={col}
                        opacity={task.isProcurement ? 0.85 : 1}
                        onMouseDown={e => startDrag(e, task.id, "move")}
                        style={{ cursor: "grab" }}
                      />
                      {/* Resize handle */}
                      <rect x={x+w-6} y={y} width={6} height={h} rx={2} fill="rgba(0,0,0,0.25)"
                        onMouseDown={e => startDrag(e, task.id, "resize")}
                        style={{ cursor: "ew-resize" }}
                      />
                    </>
                  )}
                  {/* Label inside bar if wide enough */}
                  {w > 50 && (
                    <text x={x+6} y={y+h/2+4} fontSize={10} fill="#fff" fontWeight="600"
                      style={{ pointerEvents:"none", userSelect:"none" }}>
                      {task.task.slice(0, Math.floor(w/6.5))}
                    </text>
                  )}
                  {/* Duration label above bar */}
                  <text x={x} y={y-1} fontSize={9} fill="#94a3b8" style={{ pointerEvents:"none" }}>
                    {task.durationDays}d
                  </text>
                </g>
              );
            })}

            {/* Dependency arrows */}
            {depLines.map(l => {
              const mx = (l.x1 + l.x2) / 2;
              return (
                <g key={l.key}>
                  <path d={`M ${l.x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}`}
                    fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth={1.5}
                    markerEnd="url(#arrow)" />
                </g>
              );
            })}

            {/* Arrow marker def */}
            <defs>
              <marker id="arrow" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(99,102,241,0.7)" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div style={S.legend}>
        <LegendItem color="#64748b"  label="Task" />
        <LegendItem color="#0ea5e9"  label="Procurement/Order" />
        <LegendItem color="#f59e0b"  label="Inspection / Hold Point" />
        <LegendItem color="#7c3aed"  label="Milestone" />
        <span style={S.legendNote}>Drag bars to move · Drag right edge to resize · {visible.length} tasks shown</span>
      </div>
    </div>
  );
}

function FilterPill({ label, value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding:"4px 7px", border:"1.5px solid #e2e8f0", borderRadius:6, fontSize:11, color:"#334155", cursor:"pointer", maxWidth:160 }}
    >
      {options.map(o => <option key={o} value={o}>{o === "all" ? `All ${label}s` : o}</option>)}
    </select>
  );
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#64748b" }}>
      <span style={{ width:14, height:14, borderRadius:3, background:color, display:"inline-block" }} />
      {label}
    </span>
  );
}

const S = {
  wrap:       { display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", fontFamily:"'Manrope','Segoe UI',system-ui,sans-serif" },
  topBar:     { display:"flex", alignItems:"center", gap:12, padding:"10px 16px", background:"#fff", borderBottom:"2px solid #e2e8f0", flexShrink:0, flexWrap:"wrap" },
  backBtn:    { padding:"5px 10px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#fff", color:"#334155", fontSize:12, fontWeight:600, cursor:"pointer" },
  topTitle:   { flex:1, fontSize:15, fontWeight:700, color:"#0f172a" },
  topActions: { display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" },
  depToggle:  { fontSize:12, color:"#64748b", display:"flex", alignItems:"center", cursor:"pointer" },
  actionBtn:  { padding:"5px 10px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#fff", color:"#334155", fontSize:12, fontWeight:600, cursor:"pointer" },
  procBtn:    { borderColor:"#16a34a", color:"#15803d", background:"#f0fdf4" },
  body:       { display:"flex", flex:1, overflow:"hidden", minHeight:0 },
  leftPanel:  { width:LEFT_W, flexShrink:0, display:"flex", flexDirection:"column", borderRight:"2px solid #e2e8f0", background:"#fff" },
  leftHdr:    { height:HDR_H, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px", background:"#f1f5f9", borderBottom:"2px solid #e2e8f0", flexShrink:0 },
  leftHdrText:{ fontSize:12, fontWeight:700, color:"#334155" },
  leftHdrRight:{ fontSize:12, fontWeight:700, color:"#64748b" },
  leftScroll: { flex:1, overflowY:"auto", overflowX:"hidden" },
  leftRow:    { height:ROW_H, display:"flex", alignItems:"center", borderBottom:"1px solid #f1f5f9", padding:"0 10px" },
  leftRowAlt: { background:"#f8fafc" },
  leftRowInner:{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", gap:8 },
  leftStage:  { fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", lineHeight:1.1 },
  leftTask:   { fontSize:12, fontWeight:600, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 },
  leftTrade:  { fontSize:10, color:"#64748b", flexShrink:0, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  rightPanel: { flex:1, overflow:"auto", position:"relative" },
  legend:     { display:"flex", gap:14, alignItems:"center", padding:"8px 14px", background:"#fff", borderTop:"1.5px solid #e2e8f0", flexShrink:0, flexWrap:"wrap" },
  legendNote: { fontSize:11, color:"#94a3b8", marginLeft:"auto" },
};
