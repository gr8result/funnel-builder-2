// ScheduleReviewTable.jsx
// Step 2 of the Gantt workflow: review and edit the AI-generated schedule
// before creating the Gantt chart.

import { useState, useCallback } from "react";
import { PROCUREMENT_TYPES, createTask } from "./ganttTypes";
import { resolveDependencies, formatDate, addDays } from "./ganttUtils";

const CONF_COLOR = { high: "#16a34a", medium: "#d97706", low: "#dc2626" };

export default function ScheduleReviewTable({
  tasks,
  projectStartDate,
  onTasksChange,
  onCreateGantt,
  onRegenerate,
  projectName,
  estimatedWeeks,
}) {
  const [filter, setFilter] = useState("all");   // "all" | stage name
  const [selected, setSelected] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [sortBy, setSortBy] = useState("offset"); // "offset" | "stage"

  const stages = [...new Set(tasks.map(t => t.stage).filter(Boolean))];

  const resolved = resolveDependencies(tasks);
  const visible  = filter === "all" ? resolved : resolved.filter(t => t.stage === filter);
  const sorted   = sortBy === "stage"
    ? [...visible].sort((a, b) => a.stage.localeCompare(b.stage) || a.startOffsetDays - b.startOffsetDays)
    : [...visible].sort((a, b) => a.startOffsetDays - b.startOffsetDays);

  const includedCount   = tasks.filter(t => t.included).length;
  const procurementCount = tasks.filter(t => t.included && t.isProcurement).length;

  // ── Cell update ─────────────────────────────────────────────────────────────

  const updateTask = useCallback((id, patch) => {
    onTasksChange(prev => prev.map(t => t.id === id ? { ...t, ...patch, source: "manual" } : t));
  }, [onTasksChange]);

  const toggleIncluded = (id) => updateTask(id, { included: !tasks.find(t => t.id === id)?.included });

  const deleteTask = (id) => {
    onTasksChange(prev => prev.filter(t => t.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const addTask = () => {
    const newTask = createTask({ stage: filter !== "all" ? filter : (stages[0] || ""), source: "manual" });
    onTasksChange(prev => [...prev, newTask]);
    setEditingId(newTask.id);
  };

  const moveTask = (id, direction) => {
    onTasksChange(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll    = () => setSelected(new Set(sorted.map(t => t.id)));
  const clearSelect  = () => setSelected(new Set());

  const deleteSelected = () => {
    onTasksChange(prev => prev.filter(t => !selected.has(t.id)));
    clearSelect();
  };

  const includeSelected  = () => { selected.forEach(id => updateTask(id, { included: true  })); };
  const excludeSelected  = () => { selected.forEach(id => updateTask(id, { included: false })); };

  const startDate = new Date(projectStartDate || new Date());

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Review AI Schedule — {projectName}</div>
          <div style={S.subtitle}>
            {tasks.length} tasks · {estimatedWeeks} weeks · {includedCount} included · {procurementCount} procurement items
          </div>
        </div>
        <div style={S.headerActions}>
          <button style={S.regenBtn} onClick={onRegenerate}>↺ Regenerate</button>
          <button style={S.addBtn}   onClick={addTask}>+ Add Task</button>
          <button style={S.createBtn} onClick={onCreateGantt}>
            Create Gantt Chart →
          </button>
        </div>
      </div>

      {/* Filters + sort */}
      <div style={S.controls}>
        <div style={S.filterRow}>
          <button style={{ ...S.filterBtn, ...(filter==="all"?S.filterOn:{}) }} onClick={()=>setFilter("all")}>
            All ({tasks.length})
          </button>
          {stages.map(s=>(
            <button key={s} style={{ ...S.filterBtn, ...(filter===s?S.filterOn:{}) }} onClick={()=>setFilter(s)}>
              {s.replace("& ","")} ({tasks.filter(t=>t.stage===s).length})
            </button>
          ))}
        </div>
        <div style={S.sortRow}>
          <span style={S.sortLabel}>Sort:</span>
          <button style={{ ...S.sortBtn, ...(sortBy==="offset"?S.sortOn:{}) }} onClick={()=>setSortBy("offset")}>By Start</button>
          <button style={{ ...S.sortBtn, ...(sortBy==="stage" ?S.sortOn:{}) }} onClick={()=>setSortBy("stage")}>By Stage</button>
          {selected.size > 0 && (
            <span style={S.bulkActions}>
              <button style={S.bulkBtn} onClick={includeSelected}>✓ Include</button>
              <button style={S.bulkBtn} onClick={excludeSelected}>○ Exclude</button>
              <button style={{ ...S.bulkBtn, color:"#dc2626" }} onClick={deleteSelected}>✕ Delete ({selected.size})</button>
              <button style={S.bulkBtn} onClick={clearSelect}>Clear</button>
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={{...S.th, width:32}}><input type="checkbox" onChange={e=>e.target.checked?selectAll():clearSelect()} /></th>
              <th style={{...S.th, width:30}}>✓</th>
              <th style={{...S.th, width:140}}>Stage</th>
              <th style={{...S.th, minWidth:200}}>Task</th>
              <th style={{...S.th, width:140}}>Trade / Supplier</th>
              <th style={{...S.th, width:70}}>Days</th>
              <th style={{...S.th, width:90}}>Start Day</th>
              <th style={{...S.th, width:110}}>Start Date</th>
              <th style={{...S.th, width:140}}>Depends On</th>
              <th style={{...S.th, width:120}}>Order Date</th>
              <th style={{...S.th, width:130}}>Procurement</th>
              <th style={{...S.th, minWidth:150}}>Notes</th>
              <th style={{...S.th, width:60}}>Conf.</th>
              <th style={{...S.th, width:80}}>Move</th>
              <th style={{...S.th, width:40}}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, idx) => {
              const isExcluded = !task.included;
              const isEditing  = editingId === task.id;
              const taskStart  = addDays(startDate, task.startOffsetDays || 0);
              return (
                <tr key={task.id} style={{ ...S.tr, ...(isExcluded?S.trExcluded:{}), ...(selected.has(task.id)?S.trSelected:{}) }}
                    onDoubleClick={()=>setEditingId(isEditing?null:task.id)}>
                  {/* Select */}
                  <td style={S.td}><input type="checkbox" checked={selected.has(task.id)} onChange={()=>toggleSelect(task.id)}/></td>

                  {/* Include */}
                  <td style={S.td}>
                    <input type="checkbox" checked={!!task.included} onChange={()=>toggleIncluded(task.id)} title="Include in Gantt"/>
                  </td>

                  {/* Stage */}
                  <td style={S.td}>
                    {isEditing
                      ? <input style={S.cellInput} value={task.stage} onChange={e=>updateTask(task.id,{stage:e.target.value})}/>
                      : <span style={S.stagePill}>{task.stage}</span>}
                  </td>

                  {/* Task */}
                  <td style={S.td}>
                    <input style={{...S.cellInput,fontWeight:isEditing?600:400}} value={task.task}
                      onChange={e=>updateTask(task.id,{task:e.target.value})}
                      onFocus={()=>setEditingId(task.id)}/>
                    {task.source==="manual" && <span style={S.manualTag}>manual</span>}
                  </td>

                  {/* Trade */}
                  <td style={S.td}>
                    <input style={S.cellInput} value={task.trade||""}
                      onChange={e=>updateTask(task.id,{trade:e.target.value})}
                      onFocus={()=>setEditingId(task.id)}/>
                  </td>

                  {/* Duration */}
                  <td style={S.td}>
                    <input type="number" min={1} max={365} style={{...S.cellInput,width:52,textAlign:"right"}}
                      value={task.durationDays}
                      onChange={e=>updateTask(task.id,{durationDays:Math.max(1,Number(e.target.value)||1)})}/>
                  </td>

                  {/* Start offset */}
                  <td style={{...S.td,textAlign:"right",color:"#64748b",fontSize:12}}>
                    {task.startOffsetDays || 0}d
                  </td>

                  {/* Start date */}
                  <td style={{...S.td,fontSize:12,color:"#334155"}}>
                    {formatDate(taskStart)}
                  </td>

                  {/* Depends On */}
                  <td style={S.td}>
                    <input style={{...S.cellInput,fontSize:11}} value={(task.dependsOn||[]).join(", ")}
                      placeholder="task IDs..."
                      onChange={e=>updateTask(task.id,{dependsOn:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})}
                      onFocus={()=>setEditingId(task.id)}/>
                  </td>

                  {/* Required order date */}
                  <td style={S.td}>
                    <input type="date" style={{...S.cellInput,fontSize:11}}
                      value={task.requiredOrderDate || ""}
                      onChange={e=>updateTask(task.id,{requiredOrderDate:e.target.value||null})}/>
                  </td>

                  {/* Procurement type */}
                  <td style={S.td}>
                    <select style={S.cellInput}
                      value={task.procurementType||""}
                      onChange={e=>{
                        const v = e.target.value;
                        updateTask(task.id,{procurementType:v, isProcurement:!!v});
                      }}>
                      {PROCUREMENT_TYPES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </td>

                  {/* Notes */}
                  <td style={S.td}>
                    <input style={S.cellInput} value={task.notes||""} placeholder="notes..."
                      onChange={e=>updateTask(task.id,{notes:e.target.value})}
                      onFocus={()=>setEditingId(task.id)}/>
                  </td>

                  {/* Confidence */}
                  <td style={{...S.td,textAlign:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:CONF_COLOR[task.confidence]||"#64748b"}}>
                      {task.confidence?.[0]?.toUpperCase()||"M"}
                    </span>
                  </td>

                  {/* Move */}
                  <td style={{...S.td,textAlign:"center"}}>
                    <button style={S.moveBtn} onClick={()=>moveTask(task.id,-1)} title="Move up">↑</button>
                    <button style={S.moveBtn} onClick={()=>moveTask(task.id,1)}  title="Move down">↓</button>
                  </td>

                  {/* Delete */}
                  <td style={S.td}>
                    <button style={S.deleteBtn} onClick={()=>deleteTask(task.id)} title="Remove task">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.footerNote}>
          Double-click a row to enter edit mode. Changes are auto-saved.
          Only included tasks (✓) will appear in the Gantt chart.
        </span>
        <button style={S.createBtn} onClick={onCreateGantt}>
          Create Gantt Chart →
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  wrap:       { display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:"#f8fafc" },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"14px 18px", background:"#fff", borderBottom:"2px solid #e2e8f0", flexShrink:0 },
  title:      { fontSize:16, fontWeight:700, color:"#0f172a" },
  subtitle:   { fontSize:12, color:"#64748b", marginTop:2 },
  headerActions:{ display:"flex", gap:8, alignItems:"center" },
  regenBtn:   { padding:"7px 12px", border:"1.5px solid #e2e8f0", borderRadius:7, background:"#fff", color:"#334155", fontSize:12, fontWeight:600, cursor:"pointer" },
  addBtn:     { padding:"7px 12px", border:"1.5px solid #3b82f6", borderRadius:7, background:"#eff6ff", color:"#1d4ed8", fontSize:12, fontWeight:700, cursor:"pointer" },
  createBtn:  { padding:"9px 18px", border:"none", borderRadius:8, background:"#16a34a", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" },
  controls:   { padding:"8px 18px", background:"#fff", borderBottom:"1.5px solid #e2e8f0", flexShrink:0 },
  filterRow:  { display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 },
  filterBtn:  { padding:"3px 8px", border:"1.5px solid #e2e8f0", borderRadius:99, background:"#f8fafc", color:"#64748b", fontSize:11, fontWeight:600, cursor:"pointer" },
  filterOn:   { background:"#eff6ff", borderColor:"#3b82f6", color:"#1d4ed8" },
  sortRow:    { display:"flex", gap:6, alignItems:"center" },
  sortLabel:  { fontSize:11, color:"#94a3b8" },
  sortBtn:    { padding:"2px 8px", border:"1px solid #e2e8f0", borderRadius:5, background:"#f8fafc", color:"#64748b", fontSize:11, cursor:"pointer" },
  sortOn:     { background:"#0f172a", color:"#fff" },
  bulkActions:{ display:"flex", gap:4, marginLeft:12 },
  bulkBtn:    { padding:"2px 8px", border:"1px solid #e2e8f0", borderRadius:5, background:"#fff", color:"#334155", fontSize:11, cursor:"pointer" },
  tableWrap:  { flex:1, overflow:"auto" },
  table:      { width:"100%", borderCollapse:"collapse", fontSize:12 },
  thead:      { position:"sticky", top:0, zIndex:10 },
  th:         { padding:"8px 8px", background:"#f1f5f9", borderBottom:"2px solid #e2e8f0", textAlign:"left", fontWeight:700, color:"#334155", fontSize:11, whiteSpace:"nowrap" },
  tr:         { borderBottom:"1px solid #e2e8f0", transition:"background 0.1s" },
  trExcluded: { opacity:0.45 },
  trSelected: { background:"#eff6ff" },
  td:         { padding:"5px 7px", verticalAlign:"middle" },
  cellInput:  { width:"100%", padding:"3px 5px", border:"1px solid transparent", borderRadius:4, fontSize:12, background:"transparent", color:"#0f172a", outline:"none", ":hover":{borderColor:"#e2e8f0"} },
  stagePill:  { display:"inline-block", padding:"1px 6px", borderRadius:4, background:"#f1f5f9", color:"#475569", fontSize:11 },
  manualTag:  { fontSize:9, color:"#7c3aed", marginLeft:4, fontStyle:"italic" },
  moveBtn:    { width:22, height:22, border:"1px solid #e2e8f0", borderRadius:3, background:"#f8fafc", cursor:"pointer", fontSize:12, padding:0 },
  deleteBtn:  { width:22, height:22, border:"1px solid #fca5a5", borderRadius:3, background:"#fff", color:"#dc2626", cursor:"pointer", fontSize:11, padding:0 },
  footer:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", background:"#fff", borderTop:"1.5px solid #e2e8f0", flexShrink:0 },
  footerNote: { fontSize:11, color:"#94a3b8" },
};
