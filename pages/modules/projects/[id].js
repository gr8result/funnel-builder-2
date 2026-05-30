// /pages/modules/projects/[id].js
// Project detail — phase flow diagram + per-phase task checklists
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = [
  { key: "sales",        label: "Sales",        color: "#3b82f6", emoji: "🤝" },
  { key: "prelims",      label: "Prelims",       color: "#f59e0b", emoji: "📋" },
  { key: "construction", label: "Construction",  color: "#ef4444", emoji: "🏗️" },
  { key: "complete",     label: "Complete",      color: "#22c55e", emoji: "✅" },
];
const PHASE_ORDER = PHASES.map((p) => p.key);

// Default task checklists per phase — seeded into project_tasks on first open
const TASK_TEMPLATES = {
  sales: [
    "Initial inquiry received",
    "Qualification call completed",
    "Site visit arranged",
    "Site visit completed",
    "Feasibility assessment completed",
    "Proposal / Quote prepared",
    "Proposal presented to client",
    "Client feedback received",
    "Negotiation complete",
    "Contract signed",
    "Deposit received",
  ],
  prelims: [
    "Soil test ordered",
    "Soil test results received",
    "Contour survey arranged",
    "Contour survey completed",
    "Building designer / architect engaged",
    "Preliminary design commenced",
    "Preliminary design approved by client",
    "Final working drawings completed",
    "Engineering drawings commissioned",
    "Engineering drawings completed",
    "Certifier preliminary investigation",
    "Certifier preliminary report received",
    "Development Application (DA) prepared",
    "DA lodged with council",
    "Council approval received",
    "Construction certificate applied",
    "Construction certificate issued",
    "Site establishment plan prepared",
    "Work health & safety plan",
    "Construction program prepared",
    "Subcontractors engaged",
    "Insurance arranged",
    "Pre-construction meeting held",
  ],
  construction: [
    "Site establishment / hoarding",
    "Demolition (if applicable)",
    "Footings excavation",
    "Footings poured",
    "Slab preparation",
    "Slab poured",
    "Frame erected",
    "Frame inspection passed",
    "Roof structure complete",
    "Roof covering complete",
    "External cladding",
    "Lock-up — windows & doors",
    "Rough-in plumbing",
    "Rough-in electrical",
    "Rough-in HVAC",
    "Insulation",
    "Plasterboard hung",
    "Plastering / set",
    "Tiling",
    "Cabinetry installed",
    "Fit-out completion",
    "External works / landscaping",
    "Touch-up / defects",
    "Practical completion inspection",
    "Final sign-off",
    "Handover",
  ],
};

const JOB_TYPES = [
  "New Build", "Renovation", "Extension", "Commercial",
  "Duplex", "Knock Down Rebuild", "Other",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v) {
  if (!v) return null;
  return "$" + Number(v).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject]     = useState(null);
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activePhase, setActivePhase] = useState("sales");
  const [advancing, setAdvancing] = useState(false);

  // Task edit modal state
  const [editTask, setEditTask]   = useState(null);
  const [editForm, setEditForm]   = useState({ due_date: "", notes: "" });
  const [saving, setSaving]       = useState(false);

  // Project edit modal state
  const [showEdit, setShowEdit]   = useState(false);
  const [editProj, setEditProj]   = useState({});
  const [savingProj, setSavingProj] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!router.isReady || !id) return;
    loadProject();
  }, [router.isReady, id]);

  async function loadProject() {
    setLoading(true);
    try {
      const [{ data: proj, error: projErr }, { data: taskRows, error: taskErr }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("project_tasks").select("*").eq("project_id", id).order("sort_order"),
      ]);
      if (projErr) throw projErr;
      if (taskErr) throw taskErr;

      setProject(proj);
      setActivePhase(proj.current_phase === "complete" ? "construction" : proj.current_phase);

      if (!taskRows || taskRows.length === 0) {
        // Seed all task templates on first open
        const rows = [];
        Object.entries(TASK_TEMPLATES).forEach(([phase, names]) => {
          names.forEach((task_name, i) => {
            rows.push({ project_id: id, phase, task_name, sort_order: i, status: "pending" });
          });
        });
        const { data: seeded, error: seedErr } = await supabase
          .from("project_tasks")
          .insert(rows)
          .select();
        if (seedErr) throw seedErr;
        setTasks(seeded || []);
      } else {
        setTasks(taskRows);
      }
    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle task done / pending ───────────────────────────────────────────

  async function toggleTask(task) {
    const newStatus    = task.status === "done" ? "pending" : "done";
    const completed_at = newStatus === "done" ? new Date().toISOString() : null;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => t.id === task.id ? { ...t, status: newStatus, completed_at } : t)
    );

    const { error } = await supabase
      .from("project_tasks")
      .update({ status: newStatus, completed_at })
      .eq("id", task.id);

    if (error) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
      console.error(error);
    }
  }

  // ── Save task notes / due date ───────────────────────────────────────────

  async function saveTaskEdit() {
    if (!editTask) return;
    setSaving(true);
    const update = { due_date: editForm.due_date || null, notes: editForm.notes || null };
    setTasks((prev) => prev.map((t) => t.id === editTask.id ? { ...t, ...update } : t));
    await supabase.from("project_tasks").update(update).eq("id", editTask.id);
    setSaving(false);
    setEditTask(null);
  }

  // ── Advance to next phase ────────────────────────────────────────────────

  async function advancePhase() {
    if (!project) return;
    const idx = PHASE_ORDER.indexOf(project.current_phase);
    if (idx >= PHASE_ORDER.length - 1) return;

    const phaseTasks = tasks.filter((t) => t.phase === project.current_phase && t.status !== "na");
    const incomplete = phaseTasks.filter((t) => t.status !== "done");

    if (incomplete.length > 0) {
      const proceed = window.confirm(
        `${incomplete.length} task${incomplete.length > 1 ? "s are" : " is"} not yet complete in the ` +
        `${project.current_phase} phase.\n\nAdvance to ${PHASES[idx + 1].label} anyway?`
      );
      if (!proceed) return;
    }

    const nextPhase = PHASE_ORDER[idx + 1];
    setAdvancing(true);
    const { error } = await supabase
      .from("projects")
      .update({ current_phase: nextPhase, updated_at: new Date().toISOString() })
      .eq("id", project.id);

    if (error) { console.error(error); setAdvancing(false); return; }
    setProject((p) => ({ ...p, current_phase: nextPhase }));
    setActivePhase(nextPhase === "complete" ? "construction" : nextPhase);
    setAdvancing(false);
  }

  // ── Save project edits ───────────────────────────────────────────────────

  async function saveProjectEdit() {
    setSavingProj(true);
    const update = {
      client_name:    editProj.client_name?.trim() || project.client_name,
      job_address:    editProj.job_address?.trim()  ?? project.job_address,
      job_type:       editProj.job_type              ?? project.job_type,
      contract_value: editProj.contract_value !== undefined
        ? (editProj.contract_value ? parseFloat(editProj.contract_value) : null)
        : project.contract_value,
      notes:          editProj.notes?.trim()         ?? project.notes,
      status:         editProj.status                ?? project.status,
      updated_at:     new Date().toISOString(),
    };
    const { error } = await supabase.from("projects").update(update).eq("id", project.id);
    if (error) { alert("Error saving: " + error.message); setSavingProj(false); return; }
    setProject((p) => ({ ...p, ...update }));
    setSavingProj(false);
    setShowEdit(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={S.loadScreen}>Loading project…</div>;
  }
  if (!project) {
    return (
      <div style={S.loadScreen}>
        Project not found. <Link href="/modules/projects" style={{ color: "#3b82f6" }}>← Back to Projects</Link>
      </div>
    );
  }

  const currentIdx      = PHASE_ORDER.indexOf(project.current_phase);
  const phaseInfo       = PHASES.find((p) => p.key === activePhase);
  const activePhaseTasks = tasks.filter((t) => t.phase === activePhase);
  const activeRequired  = activePhaseTasks.filter((t) => t.status !== "na");
  const activeDone      = activeRequired.filter((t) => t.status === "done").length;
  const activePct       = activeRequired.length ? Math.round((activeDone / activeRequired.length) * 100) : 0;
  const isCurrentPhase  = activePhase === project.current_phase;
  const canAdvance      = project.current_phase !== "complete" && isCurrentPhase;

  return (
    <>
      <Head><title>{project.client_name} — Project Tracker</title></Head>
      <main style={S.page}>

        {/* ── Top nav row ────────────────────────────────────────────── */}
        <div style={S.topRow}>
          <Link href="/modules/projects" style={S.backLink}>← All Projects</Link>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={S.editProjBtn}
              onClick={() => {
                setEditProj({
                  client_name:    project.client_name,
                  job_address:    project.job_address || "",
                  job_type:       project.job_type,
                  contract_value: project.contract_value || "",
                  notes:          project.notes || "",
                  status:         project.status,
                });
                setShowEdit(true);
              }}
            >
              ✏️ Edit
            </button>
            <span style={{
              ...S.statusBadge,
              background: project.status === "active" ? "#22c55e22" : project.status === "on_hold" ? "#f59e0b22" : "#6b728022",
              color:      project.status === "active" ? "#22c55e"   : project.status === "on_hold" ? "#f59e0b"   : "#9ca3af",
              border:     `1px solid ${project.status === "active" ? "#22c55e44" : project.status === "on_hold" ? "#f59e0b44" : "#6b728044"}`,
            }}>
              {project.status}
            </span>
          </div>
        </div>

        {/* ── Project header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={S.projTitle}>{project.client_name}</h1>
          {project.job_address && (
            <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 2 }}>📍 {project.job_address}</div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span style={S.metaTag}>{project.job_type}</span>
            {project.contract_value && (
              <span style={{ ...S.metaTag, color: "#22c55e" }}>{fmtCurrency(project.contract_value)}</span>
            )}
            {project.notes && (
              <span style={{ ...S.metaTag, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                💬 {project.notes}
              </span>
            )}
          </div>
        </div>

        {/* ── Phase Flow ─────────────────────────────────────────────── */}
        <div style={S.flowCard}>
          <div style={S.flowLabel}>PROJECT FLOW</div>
          <div style={S.flowRow}>
            {PHASES.map((ph, i) => {
              const isPast    = i < currentIdx;
              const isCurrent = PHASE_ORDER[i] === project.current_phase;
              const isViewing = ph.key === activePhase;
              const nodes = [
                <button
                  key={`node-${ph.key}`}
                  onClick={() => ph.key !== "complete" && setActivePhase(ph.key)}
                  style={{
                    ...S.phaseNode,
                    opacity:    i > currentIdx ? 0.4 : 1,
                    border:     isViewing ? `2px solid ${ph.color}` : "2px solid transparent",
                    background: isViewing ? ph.color + "18" : "#0f172a",
                    cursor:     ph.key === "complete" ? "default" : "pointer",
                  }}
                >
                  <div style={{
                    ...S.phaseCircle,
                    background: isPast ? "#22c55e" : isCurrent ? ph.color : "#374151",
                  }}>
                    {isPast ? "✓" : ph.emoji}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: isViewing ? 700 : 500, color: isViewing ? ph.color : "#9ca3af" }}>
                    {ph.label}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 16, color: ph.color, fontWeight: 600, letterSpacing: 0.5 }}>CURRENT</div>
                  )}
                </button>,
              ];
              if (i < PHASES.length - 1) {
                nodes.push(
                  <div
                    key={`line-${i}`}
                    style={{ ...S.flowLine, background: i < currentIdx ? "#22c55e" : "#1e293b" }}
                  />
                );
              }
              return nodes;
            })}
          </div>
        </div>

        {/* ── Overall progress strip ─────────────────────────────────── */}
        <OverallProgress tasks={tasks} phases={PHASES} currentPhaseIdx={currentIdx} />

        {/* ── Task Checklist ─────────────────────────────────────────── */}
        {activePhase !== "complete" && (
          <div style={S.checklistCard}>
            {/* Checklist header */}
            <div style={S.clHeader}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {phaseInfo?.emoji} {phaseInfo?.label} Phase
                </div>
                <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 3 }}>
                  {activeDone} of {activeRequired.length} tasks complete
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{
                  fontSize: 18, fontWeight: 600, padding: "6px 14px", borderRadius: 20,
                  background: phaseInfo?.color + "22", color: phaseInfo?.color,
                  border: `1px solid ${phaseInfo?.color}44`,
                }}>
                  {activePct}%
                </div>
                {canAdvance && (
                  <button style={S.advanceBtn} onClick={advancePhase} disabled={advancing}>
                    {advancing
                      ? "Advancing…"
                      : `Advance to ${PHASES[currentIdx + 1]?.label} →`
                    }
                  </button>
                )}
                {project.current_phase === "complete" && (
                  <span style={{ fontSize: 16, color: "#22c55e", fontWeight: 600 }}>✅ Job Complete</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div style={S.progressBar}>
              <div style={{ ...S.progressFill, width: `${activePct}%`, background: phaseInfo?.color }} />
            </div>

            {/* Incomplete / done split indicator */}
            {activeRequired.length > 0 && activeDone < activeRequired.length && (
              <div style={{ fontSize: 16, color: "#f59e0b", marginBottom: 16 }}>
                ⚠️ {activeRequired.length - activeDone} task{activeRequired.length - activeDone > 1 ? "s" : ""} outstanding
                {" — "}tick each one off as you complete it before advancing.
              </div>
            )}

            {/* Task list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {activePhaseTasks.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i + 1}
                  onToggle={() => toggleTask(task)}
                  onEdit={() => {
                    setEditTask(task);
                    setEditForm({ due_date: task.due_date || "", notes: task.notes || "" });
                  }}
                />
              ))}
            </div>

            {/* Advance CTA footer */}
            {canAdvance && activePct === 100 && (
              <div style={{ marginTop: 20, padding: "14px 16px", background: "#22c55e18", border: "1px solid #22c55e44", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 16, color: "#22c55e", fontWeight: 600 }}>
                  ✅ All {phaseInfo?.label} tasks complete — ready to advance!
                </span>
                <button style={{ ...S.advanceBtn, background: "#22c55e" }} onClick={advancePhase} disabled={advancing}>
                  {advancing ? "Advancing…" : `Move to ${PHASES[currentIdx + 1]?.label} →`}
                </button>
              </div>
            )}
          </div>
        )}

        {project.current_phase === "complete" && (
          <div style={S.completeBanner}>
            🎉 This project is complete! All phases done.
          </div>
        )}

      </main>

      {/* ── Task Edit Modal ──────────────────────────────────────────────── */}
      {editTask && (
        <div style={S.overlay} onClick={() => setEditTask(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>{editTask.task_name}</div>
            <label style={S.fieldLabel}>
              Due Date
              <input
                style={S.input} type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </label>
            <label style={S.fieldLabel}>
              Notes
              <textarea
                style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                placeholder="Notes for this task…"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setEditTask(null)}>Cancel</button>
              <button style={S.saveBtn} onClick={saveTaskEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Project Edit Modal ───────────────────────────────────────────── */}
      {showEdit && (
        <div style={S.overlay} onClick={() => setShowEdit(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Edit Project</div>

            <label style={S.fieldLabel}>
              Client / Job Name
              <input style={S.input} value={editProj.client_name}
                onChange={(e) => setEditProj((f) => ({ ...f, client_name: e.target.value }))} />
            </label>
            <label style={S.fieldLabel}>
              Job Address
              <input style={S.input} value={editProj.job_address}
                onChange={(e) => setEditProj((f) => ({ ...f, job_address: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Job Type
                <select style={S.input} value={editProj.job_type}
                  onChange={(e) => setEditProj((f) => ({ ...f, job_type: e.target.value }))}>
                  {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Status
                <select style={S.input} value={editProj.status}
                  onChange={(e) => setEditProj((f) => ({ ...f, status: e.target.value }))}>
                  {["active", "on_hold", "complete", "cancelled"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label style={S.fieldLabel}>
              Contract Value ($)
              <input style={S.input} type="number" value={editProj.contract_value}
                onChange={(e) => setEditProj((f) => ({ ...f, contract_value: e.target.value }))} />
            </label>
            <label style={S.fieldLabel}>
              Notes
              <textarea style={{ ...S.input, minHeight: 68, resize: "vertical" }} value={editProj.notes}
                onChange={(e) => setEditProj((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setShowEdit(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={saveProjectEdit} disabled={savingProj}>
                {savingProj ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Overall Progress Strip ───────────────────────────────────────────────────

function OverallProgress({ tasks, phases, currentPhaseIdx }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
      {phases.filter((ph) => ph.key !== "complete").map((ph, i) => {
        const phaseTasks = tasks.filter((t) => t.phase === ph.key && t.status !== "na");
        const done       = phaseTasks.filter((t) => t.status === "done").length;
        const pct        = phaseTasks.length ? Math.round((done / phaseTasks.length) * 100) : 0;
        const isComplete = pct === 100;
        const isFuture   = i > currentPhaseIdx;
        return (
          <div key={ph.key} style={{
            flex: 1, minWidth: 120, background: "#1a1a2e", border: "1px solid #334155",
            borderRadius: 12, padding: "12px 14px", opacity: isFuture ? 0.5 : 1,
          }}>
            <div style={{ fontSize: 16, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
              {ph.emoji} {ph.label}
            </div>
            <div style={{ height: 4, background: "#0f172a", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: isComplete ? "#22c55e" : ph.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 16, color: isComplete ? "#22c55e" : "#9ca3af" }}>
              {done}/{phaseTasks.length} · {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, index, onToggle, onEdit }) {
  const isDone = task.status === "done";
  const isNA   = task.status === "na";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 8px",
      borderRadius: 8, borderBottom: "1px solid #0f172a",
      background: isDone ? "#22c55e08" : "transparent",
      opacity: isNA ? 0.45 : 1,
    }}>
      {/* Number */}
      <div style={{ fontSize: 16, color: "#9ca3af", minWidth: 22, textAlign: "right", paddingTop: 5, fontWeight: 600 }}>
        {index}
      </div>

      {/* Checkbox */}
      <button
        onClick={onToggle}
        title={isDone ? "Mark as pending" : "Mark as done"}
        style={{
          width: 26, height: 26, borderRadius: 7, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, marginTop: 2,
          background: isDone ? "#22c55e" : "#1e293b",
          outline: isDone ? "none" : "2px solid #374151",
        }}
      >
        {isDone && <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Task name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 500, lineHeight: 1.4,
          textDecoration: isDone ? "line-through" : "none",
          color: isDone ? "#6b7280" : "#f1f5f9",
        }}>
          {task.task_name}
        </div>
        {task.due_date && (
          <div style={{ fontSize: 16, color: "#f59e0b", marginTop: 2 }}>
            📅 Due {fmtDate(task.due_date)}
          </div>
        )}
        {task.notes && (
          <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
            💬 {task.notes}
          </div>
        )}
      </div>

      {/* Completed timestamp */}
      {task.completed_at && (
        <div style={{ fontSize: 16, color: "#22c55e", whiteSpace: "nowrap", marginTop: 5 }}>
          ✓ {fmtDate(task.completed_at)}
        </div>
      )}

      {/* Edit button */}
      <button
        onClick={onEdit}
        title="Set due date / add notes"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "3px 5px", color: "#9ca3af", flexShrink: 0, marginTop: 2 }}
      >
        ✏️
      </button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: "100vh", background: "#0f0f1a", color: "#f1f5f9", padding: "28px 28px", fontFamily: "system-ui, -apple-system, sans-serif" },
  loadScreen:{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#9ca3af", fontSize: 16, fontFamily: "system-ui, sans-serif", gap: 8 },

  topRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backLink:  { color: "#3b82f6", textDecoration: "none", fontSize: 16, fontWeight: 500 },
  statusBadge:{ fontSize: 16, padding: "4px 12px", borderRadius: 20, fontWeight: 600, textTransform: "capitalize" },
  editProjBtn:{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "6px 14px", fontSize: 16, cursor: "pointer" },

  projTitle: { fontSize: 28, fontWeight: 600, margin: 0 },
  metaTag:   { fontSize: 16, background: "#1e293b", padding: "3px 10px", borderRadius: 8, color: "#94a3b8" },

  flowCard:  { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 16, padding: "20px 20px 22px", marginBottom: 20, overflowX: "auto" },
  flowLabel: { fontSize: 16, color: "#9ca3af", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18 },
  flowRow:   { display: "flex", alignItems: "center", minWidth: "max-content" },
  phaseNode: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 18px", borderRadius: 12 },
  phaseCircle:{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff" },
  flowLine:  { flex: 1, height: 3, minWidth: 24, maxWidth: 64, borderRadius: 2 },

  checklistCard:{ background: "#1a1a2e", border: "1px solid #334155", borderRadius: 16, padding: "24px", marginBottom: 24 },
  clHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 },
  progressBar: { height: 6, background: "#0f172a", borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  progressFill:{ height: "100%", borderRadius: 3, transition: "width 0.4s" },

  advanceBtn:{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  completeBanner:{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 14, padding: 28, textAlign: "center", fontSize: 20, fontWeight: 600, color: "#22c55e" },

  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:     { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 16, padding: 24, width: "min(500px, 95vw)", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 },
  fieldLabel:{ display: "flex", flexDirection: "column", gap: 5, fontSize: 16, color: "#94a3b8", fontWeight: 500 },
  input:     { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "9px 12px", fontSize: 16, outline: "none" },
  cancelBtn: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 16px", fontSize: 16, cursor: "pointer" },
  saveBtn:   { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
};
