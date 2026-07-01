// GanttBuilderPage.jsx
// AI Gantt Chart Builder — main orchestrator.
//
// Step machine:
//   idle → generating → reviewing → gantt
//
// Storage:
//   draftSchedule    = AI output, can be discarded
//   approvedSchedule = user-confirmed, never overwritten without confirmation

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { createTask } from "./ganttTypes";
import { resolveDependencies, saveGanttProject, loadGanttByJobId } from "./ganttUtils";
import { generateSchedule } from "./AIScheduleService";

const ScheduleReviewTable = dynamic(() => import("./ScheduleReviewTable"), { ssr: false });
const GanttChart          = dynamic(() => import("./GanttChart"),          { ssr: false });

// ── Step labels ───────────────────────────────────────────────────────────────

const STEPS = {
  idle:       "idle",
  generating: "generating",
  reviewing:  "reviewing",
  gantt:      "gantt",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GanttBuilderPage({ sheet }) {
  const workbook = sheet?.workbook || {};
  const jobId    = workbook?.openedFileName || workbook?.id || "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,     setStep]     = useState(STEPS.idle);
  const [error,    setError]    = useState("");
  const [project,  setProject]  = useState(() => loadGanttByJobId(jobId) || createNewProject(jobId));

  const [draftTasks,    setDraftTasks]    = useState(project.draftSchedule    || []);
  const [approvedTasks, setApprovedTasks] = useState(project.approvedSchedule || []);
  const [activeTasks,   setActiveTasks]   = useState([]);  // currently shown in review/gantt
  const [projectName,   setProjectName]   = useState(project.projectName || "New Build");
  const [estimatedWeeks,setEstWeeks]      = useState(project.estimatedWeeks || 0);
  const [projectStartDate, setProjectStartDate] = useState(
    project.projectStartDate || toDateInput(new Date())
  );

  // Resume from saved state
  useEffect(() => {
    if (project.approvedSchedule?.length) {
      setActiveTasks(project.approvedSchedule);
      setStep(STEPS.gantt);
    } else if (project.draftSchedule?.length) {
      setActiveTasks(project.draftSchedule);
      setStep(STEPS.reviewing);
    }
  }, []); // eslint-disable-line

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const persist = useCallback((updates) => {
    const next = { ...project, ...updates, updatedAt: new Date().toISOString() };
    setProject(next);
    saveGanttProject(next);
  }, [project]);

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setStep(STEPS.generating);
    setError("");

    const result = await generateSchedule(workbook);

    if (!result.ok) {
      setError(result.error || "AI generation failed.");
      setStep(STEPS.idle);
      return;
    }

    const resolved = resolveDependencies(result.tasks);
    setDraftTasks(resolved);
    setActiveTasks(resolved);
    setProjectName(result.projectName || projectName);
    setEstWeeks(result.estimatedWeeks || 0);
    persist({ draftSchedule: resolved, projectName: result.projectName, estimatedWeeks: result.estimatedWeeks, status: "draft" });
    setStep(STEPS.reviewing);
  }, [workbook, projectName, persist]);

  // ── Create Gantt from review ───────────────────────────────────────────────

  const handleCreateGantt = useCallback(() => {
    // If an approved schedule exists, confirm before overwriting
    if (project.approvedSchedule?.length) {
      if (!window.confirm("This will replace the current approved schedule. Continue?")) return;
    }
    const resolved = resolveDependencies(activeTasks);
    setApprovedTasks(resolved);
    setActiveTasks(resolved);
    persist({ approvedSchedule: resolved, draftSchedule: activeTasks, status: "approved" });
    setStep(STEPS.gantt);
  }, [activeTasks, project.approvedSchedule, persist]);

  // ── Back to review from Gantt ──────────────────────────────────────────────

  const handleBackToReview = useCallback(() => {
    setActiveTasks(approvedTasks.length ? approvedTasks : draftTasks);
    setStep(STEPS.reviewing);
  }, [approvedTasks, draftTasks]);

  // ── Push procurement ───────────────────────────────────────────────────────

  const handlePushProcurement = useCallback((cards) => {
    if (!cards.length) { alert("No procurement tasks to push."); return; }
    // Merge into workbook procurement items
    if (sheet?.updateProcurementItem) {
      cards.forEach(c => sheet.updateProcurementItem(c.id, c));
      alert(`${cards.length} procurement card${cards.length !== 1 ? "s" : ""} pushed to Job Board.`);
    } else {
      // Fallback: store in project
      persist({ procurementCards: cards });
      alert(`${cards.length} procurement card${cards.length !== 1 ? "s" : ""} saved (Job Board integration pending).`);
    }
  }, [sheet, persist]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── IDLE ── */}
      {step === STEPS.idle && (
        <IdleScreen
          projectName={projectName}
          projectStartDate={projectStartDate}
          onStartDateChange={setProjectStartDate}
          hasDraft={!!project.draftSchedule?.length}
          hasApproved={!!project.approvedSchedule?.length}
          onGenerate={handleGenerate}
          onResumeDraft={() => { setActiveTasks(project.draftSchedule || []); setStep(STEPS.reviewing); }}
          onResumeGantt={() => { setActiveTasks(project.approvedSchedule || []); setStep(STEPS.gantt);   }}
          error={error}
        />
      )}

      {/* ── GENERATING ── */}
      {step === STEPS.generating && (
        <div style={S.generating}>
          <div style={S.spinner} />
          <div style={S.genTitle}>AI is generating your construction schedule…</div>
          <div style={S.genSub}>
            Analysing your estimate data, trade requirements and construction sequence.
            This usually takes 10–20 seconds.
          </div>
        </div>
      )}

      {/* ── REVIEWING ── */}
      {step === STEPS.reviewing && (
        <div style={S.fullHeight}>
          <ScheduleReviewTable
            tasks={activeTasks}
            onTasksChange={newFn => {
              setActiveTasks(prev => {
                const next = typeof newFn === "function" ? newFn(prev) : newFn;
                persist({ draftSchedule: next });
                return next;
              });
            }}
            projectStartDate={projectStartDate}
            projectName={projectName}
            estimatedWeeks={estimatedWeeks}
            onCreateGantt={handleCreateGantt}
            onRegenerate={() => { setStep(STEPS.idle); setError(""); }}
          />
        </div>
      )}

      {/* ── GANTT ── */}
      {step === STEPS.gantt && (
        <div style={S.fullHeight}>
          <GanttChart
            tasks={activeTasks}
            projectStartDate={projectStartDate}
            projectName={projectName}
            onBack={handleBackToReview}
            onTasksChange={newFn => {
              setActiveTasks(prev => {
                const next = typeof newFn === "function" ? newFn(prev) : newFn;
                persist({ approvedSchedule: next });
                return next;
              });
            }}
            onPushToProcurement={handlePushProcurement}
          />
        </div>
      )}
    </div>
  );
}

// ── Idle / landing screen ─────────────────────────────────────────────────────

function IdleScreen({ projectName, projectStartDate, onStartDateChange, hasDraft, hasApproved, onGenerate, onResumeDraft, onResumeGantt, error }) {
  return (
    <div style={ID.wrap}>
      <div style={ID.card}>
        <div style={ID.icon}>📅</div>
        <div style={ID.title}>AI Gantt Chart Builder</div>
        <div style={ID.subtitle}>
          AI will read your confirmed estimate data and generate a full construction schedule —
          stages, tasks, trades, procurement items, hold points and dependencies.
          Review and adjust before creating the Gantt chart.
        </div>

        {error && <div style={ID.error}>{error}</div>}

        <div style={ID.field}>
          <label style={ID.label}>Project start date</label>
          <input type="date" value={projectStartDate} onChange={e=>onStartDateChange(e.target.value)} style={ID.input} />
        </div>

        <button style={ID.generateBtn} onClick={onGenerate}>
          🤖 Generate Gantt With AI
        </button>

        {hasDraft && (
          <button style={ID.resumeBtn} onClick={onResumeDraft}>
            ↩ Resume Draft Schedule
          </button>
        )}
        {hasApproved && (
          <button style={ID.resumeBtn} onClick={onResumeGantt}>
            📊 Open Approved Gantt Chart
          </button>
        )}

        <div style={ID.note}>
          <strong>What the AI will create:</strong>
          <ul style={ID.list}>
            {[
              "Preliminary admin — QBCC, QLeave, insurances, contracts",
              "Council/certifier approvals and engineering",
              "All construction stages from earthworks to handover",
              "Procurement chains for long-lead items (trusses, joinery, windows)",
              "Hold points, inspections and milestones",
              "Task dependencies and realistic durations",
              "Required order dates calculated from construction sequence",
            ].map(item=><li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function createNewProject(jobId) {
  return {
    id:               `gp-${Date.now()}`,
    jobId,
    projectName:      "New Build",
    projectStartDate: toDateInput(new Date()),
    createdAt:        new Date().toISOString(),
    updatedAt:        new Date().toISOString(),
    draftSchedule:    null,
    approvedSchedule: null,
    status:           "idle",
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:       { height:"100%", display:"flex", flexDirection:"column", fontFamily:"'Manrope','Segoe UI',system-ui,sans-serif", overflow:"hidden" },
  fullHeight: { flex:1, overflow:"hidden", display:"flex", flexDirection:"column" },
  generating: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:40, background:"#f8fafc" },
  spinner:    { width:48, height:48, borderRadius:"50%", border:"4px solid #e2e8f0", borderTopColor:"#2563eb", animation:"spin 0.9s linear infinite" },
  genTitle:   { fontSize:18, fontWeight:700, color:"#0f172a" },
  genSub:     { fontSize:13, color:"#64748b", lineHeight:1.6, maxWidth:380, textAlign:"center" },
};

const ID = {
  wrap:        { flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#f8fafc", padding:24, overflow:"auto" },
  card:        { background:"#fff", borderRadius:16, padding:32, maxWidth:540, width:"100%", boxShadow:"0 8px 30px rgba(0,0,0,0.08)", border:"1.5px solid #e2e8f0", display:"flex", flexDirection:"column", gap:16 },
  icon:        { fontSize:48, textAlign:"center" },
  title:       { fontSize:22, fontWeight:700, color:"#0f172a", textAlign:"center" },
  subtitle:    { fontSize:14, color:"#64748b", lineHeight:1.6, textAlign:"center" },
  error:       { padding:"10px 14px", borderRadius:8, background:"#fef2f2", color:"#dc2626", fontSize:13, fontWeight:600, border:"1px solid #fca5a5" },
  field:       { display:"flex", flexDirection:"column", gap:4 },
  label:       { fontSize:12, fontWeight:700, color:"#64748b" },
  input:       { padding:"8px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, outline:"none" },
  generateBtn: { padding:"14px 0", border:"none", borderRadius:10, background:"linear-gradient(135deg,#2563eb,#7c3aed)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", textAlign:"center" },
  resumeBtn:   { padding:"10px 0", border:"1.5px solid #e2e8f0", borderRadius:10, background:"#f8fafc", color:"#334155", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"center" },
  note:        { padding:"12px 14px", background:"#f8fafc", borderRadius:8, border:"1px solid #e2e8f0", fontSize:12 },
  list:        { margin:"6px 0 0 0", paddingLeft:18, color:"#475569", lineHeight:2, display:"flex", flexDirection:"column", gap:0 },
};
