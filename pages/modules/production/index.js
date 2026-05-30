// /pages/modules/production/index.js
// Production Flow — sticky-note board: jobs as rows, standard steps as columns
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

const STEPS = [
  { key: "quote_req",   label: "Quote\nReq'd" },
  { key: "quote_rcvd",  label: "Quote\nRcvd" },
  { key: "quote_appr",  label: "Quote\nAppr'd" },
  { key: "sample_req",  label: "Sample\nReq'd" },
  { key: "sample_appr", label: "Sample\nAppr'd" },
  { key: "ordered",     label: "Ordered" },
  { key: "eta_conf",    label: "ETA\nConf'd" },
  { key: "delivered",   label: "Delivered" },
  { key: "on_site",     label: "On\nSite" },
  { key: "installed",   label: "Installed" },
  { key: "signed_off",  label: "Signed\nOff" },
];

const ST = {
  pending:     { bg: "#dbeafe", topBorder: "#3b82f6", border: "#bfdbfe", text: "#1e40af", label: "To Do" },
  in_progress: { bg: "#fef9c3", topBorder: "#eab308", border: "#fde68a", text: "#92400e", label: "In Progress" },
  done:        { bg: "#dcfce7", topBorder: "#22c55e", border: "#bbf7d0", text: "#14532d", label: "Done" },
  na:          { bg: "#f1f5f9", topBorder: "#94a3b8", border: "#e2e8f0", text: "#64748b", label: "N / A" },
};

export default function ProductionBoard() {
  const router = useRouter();
  const [user, setUser]           = useState(null);
  const [jobs, setJobs]           = useState([]);
  const [stepMap, setStepMap]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");

  const [cell, setCell]           = useState(null);
  const [popStatus, setPopStatus] = useState("pending");
  const [popNotes, setPopNotes]   = useState("");
  const [popBy, setPopBy]         = useState("");
  const [saving, setSaving]       = useState(false);

  const [showNew, setShowNew]     = useState(false);
  const [form, setForm]           = useState({ name: "", client_name: "", description: "" });

  const [editJob, setEditJob]     = useState(null);
  const [editForm, setEditForm]   = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: jobsData, error } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) { alert("Error: " + error.message); setLoading(false); return; }
    const js = jobsData || [];
    setJobs(js);
    if (js.length === 0) { setLoading(false); return; }
    const { data: stepsData } = await supabase
      .from("production_job_steps")
      .select("*")
      .in("job_id", js.map((j) => j.id));
    const map = {};
    for (const j of js) {
      map[j.id] = {};
      for (const s of STEPS) map[j.id][s.key] = null;
    }
    for (const rec of stepsData || []) {
      if (map[rec.job_id]) map[rec.job_id][rec.step_key] = rec;
    }
    setStepMap(map);
    setLoading(false);
  }, [user]);

  const getStatus = (jobId, stepKey) => stepMap[jobId]?.[stepKey]?.status || "pending";
  const getRec    = (jobId, stepKey) => stepMap[jobId]?.[stepKey] || null;

  const openCell = (job, step) => {
    const rec = getRec(job.id, step.key);
    setCell({ job, step, rec });
    setPopStatus(rec?.status || "pending");
    setPopNotes(rec?.notes || "");
    setPopBy(rec?.completed_by || "");
  };

  const saveCell = async () => {
    if (!cell) return;
    setSaving(true);
    const { job, step, rec } = cell;
    const payload = {
      job_id: job.id,
      step_key: step.key,
      status: popStatus,
      notes: popNotes,
      completed_by: popBy,
      completed_at: popStatus === "done" ? new Date().toISOString() : null,
    };
    setStepMap((prev) => ({
      ...prev,
      [job.id]: { ...prev[job.id], [step.key]: { ...(rec || {}), ...payload } },
    }));
    setCell(null);
    let error;
    if (rec?.id) {
      ({ error } = await supabase.from("production_job_steps").update(payload).eq("id", rec.id));
    } else {
      const { data: inserted, error: e } = await supabase
        .from("production_job_steps").insert(payload).select().single();
      error = e;
      if (inserted) {
        setStepMap((prev) => ({
          ...prev,
          [job.id]: { ...prev[job.id], [step.key]: inserted },
        }));
      }
    }
    if (error) alert("Save error: " + error.message);
    setSaving(false);
  };

  const createJob = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("production_jobs")
      .insert({ ...form, user_id: user.id })
      .select().single();
    if (error) { alert(error.message); setSaving(false); return; }
    setJobs((prev) => [...prev, data]);
    setStepMap((prev) => {
      const init = {};
      STEPS.forEach((s) => { init[s.key] = null; });
      return { ...prev, [data.id]: init };
    });
    setSaving(false);
    setShowNew(false);
    setForm({ name: "", client_name: "", description: "" });
  };

  const saveEditJob = async () => {
    if (!editJob) return;
    setSaving(true);
    const { error } = await supabase.from("production_jobs").update(editForm).eq("id", editJob.id);
    if (error) { alert(error.message); setSaving(false); return; }
    setJobs((prev) => prev.map((j) => j.id === editJob.id ? { ...j, ...editForm } : j));
    setSaving(false);
    setEditJob(null);
  };

  const deleteJob = async (jobId) => {
    if (!confirm("Delete this job and all its step data?")) return;
    await supabase.from("production_jobs").delete().eq("id", jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setStepMap((prev) => { const n = { ...prev }; delete n[jobId]; return n; });
    setEditJob(null);
  };

  let totalPending = 0, totalProgress = 0, totalDone = 0;
  for (const j of jobs) {
    for (const s of STEPS) {
      const st = getStatus(j.id, s.key);
      if (st === "pending") totalPending++;
      else if (st === "in_progress") totalProgress++;
      else if (st === "done") totalDone++;
    }
  }

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    return STEPS.some((s) => getStatus(job.id, s.key) === filter);
  });

  if (loading) return (
    <div style={S.page}>
      <div style={S.loadWrap}><div style={S.spinner} /></div>
    </div>
  );

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .note-card:hover { transform: translateY(-2px) scale(1.03); box-shadow: 3px 5px 14px rgba(0,0,0,0.35) !important; }
        .edit-job-btn { opacity: 0; transition: opacity 0.15s; }
        .job-row:hover .edit-job-btn { opacity: 1; }
      `}</style>

      <div style={S.header}>
        <div>
          <h1 style={S.title}>⚙️ Production Flow</h1>
          <p style={S.sub}>
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            <span style={{ color: "#93c5fd" }}>🔵 {totalPending} to do</span>&nbsp;·&nbsp;
            <span style={{ color: "#fde047" }}>🟡 {totalProgress} in progress</span>&nbsp;·&nbsp;
            <span style={{ color: "#86efac" }}>🟢 {totalDone} done</span>
          </p>
        </div>
        <button style={S.addBtn} onClick={() => setShowNew(true)}>+ New Job</button>
      </div>

      <div style={S.filterRow}>
        {[["all","All Jobs"],["pending","🔵 To Do"],["in_progress","🟡 In Progress"],["done","🟢 Done"]].map(([val,label]) => (
          <button key={val} style={filter===val ? S.filterOn : S.filterOff} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <div style={S.empty}>
          {jobs.length === 0 ? 'No jobs yet — click "+ New Job" to get started.' : "No jobs match this filter."}
        </div>
      ) : (
        <div style={S.boardWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.cornerTh}>Job / Client</th>
                {STEPS.map((step) => (
                  <th key={step.key} style={S.stepTh}>
                    <span style={{ whiteSpace: "pre-line" }}>{step.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => {
                const allDone = STEPS.every((s) => { const st = getStatus(job.id, s.key); return st === "done" || st === "na"; });
                return (
                  <tr key={job.id} className="job-row">
                    <td style={{ ...S.jobCell, background: allDone ? "rgba(34,197,94,0.07)" : "#161d2e" }}>
                      <div style={S.jobName}>{job.name}</div>
                      {job.client_name && <div style={S.jobClient}>{job.client_name}</div>}
                      <button
                        className="edit-job-btn"
                        style={S.editJobBtn}
                        onClick={() => { setEditJob(job); setEditForm({ name: job.name, client_name: job.client_name || "", description: job.description || "" }); }}
                      >✏️ edit</button>
                    </td>
                    {STEPS.map((step) => {
                      const status = getStatus(job.id, step.key);
                      const rec = getRec(job.id, step.key);
                      const stStyle = ST[status] || ST.pending;
                      return (
                        <td key={step.key} style={S.noteCell}>
                          <div
                            className="note-card"
                            style={{ ...S.note, background: stStyle.bg, borderColor: stStyle.border, borderTopColor: stStyle.topBorder }}
                            onClick={() => openCell(job, step)}
                          >
                            <div style={{ ...S.noteLabel, color: stStyle.text }}>{stStyle.label}</div>
                            {rec?.notes && <div style={S.noteSnip}>{rec.notes.length > 28 ? rec.notes.slice(0,28)+"…" : rec.notes}</div>}
                            {rec?.completed_by && <div style={S.noteBy}>✓ {rec.completed_by}</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cell && (
        <div style={S.overlay} onClick={(e) => e.target===e.currentTarget && setCell(null)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div>
                <div style={S.modalTitle}>{cell.step.label.replace("\n"," ")}</div>
                <div style={S.modalSub}>{cell.job.name}{cell.job.client_name ? ` — ${cell.job.client_name}` : ""}</div>
              </div>
              <button style={S.closeBtn} onClick={() => setCell(null)}>✕</button>
            </div>
            <div style={S.statusGrid}>
              {Object.entries(ST).map(([key, stStyle]) => (
                <button key={key} style={{ ...S.statusBtn, background: stStyle.bg, borderColor: popStatus===key ? stStyle.topBorder : stStyle.border, color: stStyle.text, fontWeight: popStatus===key ? 700 : 400, outline: popStatus===key ? `2px solid ${stStyle.topBorder}` : "none", outlineOffset: 2 }} onClick={() => setPopStatus(key)}>
                  {stStyle.label}
                </button>
              ))}
            </div>
            <label style={S.lbl}>Completed By</label>
            <input style={S.inp} value={popBy} onChange={(e) => setPopBy(e.target.value)} placeholder="Who actioned this?" />
            <label style={S.lbl}>Notes</label>
            <textarea style={{ ...S.inp, resize: "vertical", minHeight: 80 }} value={popNotes} onChange={(e) => setPopNotes(e.target.value)} placeholder="Add details, dates, reference numbers…" rows={3} />
            <div style={S.modalFoot}>
              <button style={S.btnCancel} onClick={() => setCell(null)}>Cancel</button>
              <button style={S.btnSave} onClick={saveCell} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div style={S.overlay} onClick={(e) => e.target===e.currentTarget && setShowNew(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>New Production Job</div>
              <button style={S.closeBtn} onClick={() => setShowNew(false)}>✕</button>
            </div>
            <label style={S.lbl}>Job Name *</label>
            <input style={S.inp} value={form.name} onChange={(e) => setForm((p) => ({...p, name: e.target.value}))} placeholder="e.g. Smith Residence" autoFocus />
            <label style={S.lbl}>Client Name</label>
            <input style={S.inp} value={form.client_name} onChange={(e) => setForm((p) => ({...p, client_name: e.target.value}))} placeholder="Client name" />
            <label style={S.lbl}>Description</label>
            <textarea style={{ ...S.inp, resize: "vertical" }} value={form.description} onChange={(e) => setForm((p) => ({...p, description: e.target.value}))} placeholder="Optional notes…" rows={2} />
            <div style={S.modalFoot}>
              <button style={S.btnCancel} onClick={() => setShowNew(false)}>Cancel</button>
              <button style={S.btnSave} onClick={createJob} disabled={saving || !form.name.trim()}>{saving ? "Creating…" : "Create Job"}</button>
            </div>
          </div>
        </div>
      )}

      {editJob && (
        <div style={S.overlay} onClick={(e) => e.target===e.currentTarget && setEditJob(null)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>Edit Job</div>
              <button style={S.closeBtn} onClick={() => setEditJob(null)}>✕</button>
            </div>
            <label style={S.lbl}>Job Name *</label>
            <input style={S.inp} value={editForm.name} onChange={(e) => setEditForm((p) => ({...p, name: e.target.value}))} />
            <label style={S.lbl}>Client Name</label>
            <input style={S.inp} value={editForm.client_name} onChange={(e) => setEditForm((p) => ({...p, client_name: e.target.value}))} />
            <label style={S.lbl}>Description</label>
            <textarea style={{ ...S.inp, resize: "vertical" }} value={editForm.description} onChange={(e) => setEditForm((p) => ({...p, description: e.target.value}))} rows={2} />
            <div style={{ ...S.modalFoot, justifyContent: "space-between" }}>
              <button style={{ ...S.btnCancel, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => deleteJob(editJob.id)}>Delete Job</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={S.btnCancel} onClick={() => setEditJob(null)}>Cancel</button>
                <button style={S.btnSave} onClick={saveEditJob} disabled={saving || !editForm.name?.trim()}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { padding: "24px 20px", minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" },
  loadWrap:   { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" },
  spinner:    { width: 36, height: 36, border: "3px solid #1e293b", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  header:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 },
  title:      { fontSize: 22, fontWeight: 600, margin: 0, color: "#f1f5f9" },
  sub:        { fontSize: 16, color: "#94a3b8", marginTop: 5 },
  addBtn:     { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  filterRow:  { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  filterOff:  { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 20, padding: "6px 16px", fontSize: 16, cursor: "pointer" },
  filterOn:   { background: "#6366f1", color: "#fff", border: "1px solid #6366f1", borderRadius: 20, padding: "6px 16px", fontSize: 16, cursor: "pointer", fontWeight: 600 },
  empty:      { textAlign: "center", color: "#475569", padding: "60px 20px", fontSize: 16 },
  boardWrap:  { overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 185px)", borderRadius: 12, border: "1px solid #1e293b" },
  table:      { borderCollapse: "collapse", width: "100%" },
  cornerTh:   { position: "sticky", top: 0, left: 0, zIndex: 4, background: "#0d1424", padding: "12px 16px", textAlign: "left", fontSize: 16, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #1e293b", borderRight: "1px solid #1e293b", minWidth: 170, whiteSpace: "nowrap" },
  stepTh:     { position: "sticky", top: 0, zIndex: 3, background: "#0d1424", padding: "10px 4px", textAlign: "center", fontSize: 16, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #1e293b", minWidth: 88 },
  jobCell:    { position: "sticky", left: 0, zIndex: 1, padding: "10px 14px", borderRight: "1px solid #1e293b", minWidth: 170, verticalAlign: "middle", borderBottom: "1px solid #111827" },
  jobName:    { fontWeight: 600, fontSize: 16, color: "#e2e8f0", lineHeight: 1.3 },
  jobClient:  { fontSize: 16, color: "#64748b", marginTop: 2 },
  editJobBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "3px 6px", marginTop: 4, color: "#64748b", display: "block" },
  noteCell:   { padding: "5px 4px", verticalAlign: "top", borderBottom: "1px solid #111827" },
  note:       { minHeight: 70, borderRadius: 3, border: "1px solid", borderTop: "4px solid", padding: "8px 9px", cursor: "pointer", boxShadow: "2px 3px 8px rgba(0,0,0,0.25)", transition: "transform 0.12s ease, box-shadow 0.12s ease", display: "flex", flexDirection: "column", gap: 3 },
  noteLabel:  { fontSize: 16, fontWeight: 600, letterSpacing: "0.02em" },
  noteSnip:   { fontSize: 16, color: "#475569", lineHeight: 1.3 },
  noteBy:     { fontSize: 16, color: "#9ca3af", marginTop: 2 },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal:      { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: "26px 28px", width: "100%", maxWidth: 460, boxShadow: "0 30px 60px rgba(0,0,0,0.6)" },
  modalHead:  { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 600, color: "#f1f5f9" },
  modalSub:   { fontSize: 16, color: "#94a3b8", marginTop: 3 },
  closeBtn:   { background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 },
  statusGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 },
  statusBtn:  { border: "2px solid", borderRadius: 8, padding: "10px 8px", fontSize: 16, cursor: "pointer", textAlign: "center", transition: "all 0.12s" },
  lbl:        { display: "block", fontSize: 16, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 14 },
  inp:        { width: "100%", background: "#0f1117", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 16, boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  modalFoot:  { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 },
  btnCancel:  { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "10px 18px", fontSize: 16, cursor: "pointer" },
  btnSave:    { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
};
