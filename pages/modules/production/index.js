// /pages/modules/production/index.js
// Production Flow — sticky-note board: jobs as rows, standard steps as columns
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

const DEFAULT_ST = {
  pending:     { bg: "#1e3a5f", topBorder: "#3b82f6", border: "#2563eb", text: "#93c5fd", label: "To Do" },
  in_progress: { bg: "#78350f", topBorder: "#f59e0b", border: "#d97706", text: "#fde68a", label: "In Progress" },
  done:        { bg: "#14532d", topBorder: "#22c55e", border: "#16a34a", text: "#86efac", label: "Done" },
  na:          { bg: "#1e293b", topBorder: "#475569", border: "#334155", text: "#64748b", label: "N / A" },
};

export default function ProductionBoard() {
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

  const [teamMembers, setTeamMembers] = useState([]);
  const [session, setSession]         = useState(null);

  // Editable status card colors — persisted in localStorage
  const [ST, setST] = useState(DEFAULT_ST);
  const [editST, setEditST]       = useState(null); // key being edited
  const [editSTForm, setEditSTForm] = useState({});

  const [showNew, setShowNew]     = useState(false);
  const [importMode, setImportMode] = useState(false); // true = pick from job board
  const [jobBoardJobs, setJobBoardJobs] = useState([]);
  const [selectedJobBoardId, setSelectedJobBoardId] = useState("");
  const [form, setForm]           = useState({ name: "", client_name: "", description: "" });

  const [editJob, setEditJob]     = useState(null);
  const [editForm, setEditForm]   = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    // Restore saved status card colors
    try {
      const saved = localStorage.getItem("prod_status_colors");
      if (saved) setST((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/production/team-members", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setTeamMembers(j.members || []); })
      .catch(() => {});
  }, [session]);

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

      {/* ── Banner ── */}
      <div style={S.banner}>
        <div style={S.bannerLeft}>
          <span style={S.bannerIcon}>⚙️</span>
          <div>
            <h1 style={S.bannerTitle}>Production Flow</h1>
            <p style={S.bannerDesc}>
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}&nbsp;·&nbsp;
              <span style={{ color: "#93c5fd" }}>🔵 {totalPending} to do</span>&nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🟡 {totalProgress} in progress</span>&nbsp;·&nbsp;
              <span style={{ color: "#86efac" }}>🟢 {totalDone} done</span>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            title="Customise status card colours"
            style={S.bannerCustomBtn}
            onClick={() => setEditST("pending")}
          >
            🎨 Card Colours
          </button>
          <Link href="/modules/construction"><button style={S.backBtn}>← Back</button></Link>
        </div>
      </div>

      <div style={S.filterRow}>
        {[["all","All Jobs"],["pending","🔵 To Do"],["in_progress","🟡 In Progress"],["done","🟢 Done"]].map(([val,label]) => (
          <button key={val} style={filter===val ? S.filterOn : S.filterOff} onClick={() => setFilter(val)}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={S.addBtn} onClick={() => { setShowNew(true); setImportMode(false); setSelectedJobBoardId(""); }}>+ New Job</button>
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

      {/* ── Status Card Color Editor ── */}
      {editST && (
        <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && setEditST(null)}>
          <div style={{ ...S.modal, maxWidth: 480 }}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>🎨 Customise Card Colours</div>
              <button style={S.closeBtn} onClick={() => setEditST(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px" }}>Click a card below to change its colours. Changes are saved locally for your browser.</p>
            {/* Card selector tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(ST).map(([key, st]) => (
                <button
                  key={key}
                  onClick={() => { setEditST(key); setEditSTForm({ bg: st.bg, topBorder: st.topBorder, border: st.border, text: st.text, label: st.label }); }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: `2px solid ${editST === key ? st.topBorder : "#334155"}`, background: st.bg, color: st.text, fontWeight: editST === key ? 700 : 400, cursor: "pointer", fontSize: 13 }}
                >
                  {st.label}
                </button>
              ))}
            </div>
            {/* Colour inputs for selected card */}
            {editSTForm.label && (() => {
              const stKey = editST;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "12px 16px", borderRadius: 8, background: editSTForm.bg, borderTop: `4px solid ${editSTForm.topBorder}`, border: `1px solid ${editSTForm.border}`, marginBottom: 8 }}>
                    <span style={{ color: editSTForm.text, fontWeight: 700, fontSize: 15 }}>{editSTForm.label} — preview</span>
                  </div>
                  {[{ k: "label", label: "Label text", type: "text" }, { k: "bg", label: "Background", type: "color" }, { k: "topBorder", label: "Top accent", type: "color" }, { k: "border", label: "Side border", type: "color" }, { k: "text", label: "Text colour", type: "color" }].map(({ k, label, type }) => (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#94a3b8" }}>
                      <span style={{ minWidth: 100 }}>{label}</span>
                      <input
                        type={type}
                        value={editSTForm[k] || ""}
                        onChange={(e) => setEditSTForm((f) => ({ ...f, [k]: e.target.value }))}
                        style={{ flex: 1, background: "#0f1117", border: "1px solid #334155", borderRadius: 6, color: "#f1f5f9", padding: type === "color" ? "2px" : "8px 10px", height: 36, cursor: type === "color" ? "pointer" : "text" }}
                      />
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button style={S.btnCancel} onClick={() => {
                      const reset = { ...ST };
                      const defaults = DEFAULT_ST;
                      reset[stKey] = defaults[stKey];
                      setST(reset);
                      try { localStorage.setItem("prod_status_colors", JSON.stringify(reset)); } catch {}
                      setEditST(null);
                    }}>Reset</button>
                    <button style={S.btnSave} onClick={() => {
                      const updated = { ...ST, [stKey]: { ...ST[stKey], ...editSTForm } };
                      setST(updated);
                      try { localStorage.setItem("prod_status_colors", JSON.stringify(updated)); } catch {}
                      setEditST(null);
                    }}>Save Colour</button>
                  </div>
                </div>
              );
            })()}
          </div>
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
            {teamMembers.length > 0 ? (
              <select
                style={{ ...S.inp, cursor: "pointer" }}
                value={popBy}
                onChange={(e) => setPopBy(e.target.value)}
              >
                <option value="">— Select team member —</option>
                {teamMembers.map((m) => (
                  <option key={m.user_id} value={m.name}>{m.name}</option>
                ))}
                {popBy && !teamMembers.some((m) => m.name === popBy) && (
                  <option value={popBy}>{popBy} (previous)</option>
                )}
              </select>
            ) : (
              <input style={S.inp} value={popBy} onChange={(e) => setPopBy(e.target.value)} placeholder="Who actioned this?" />
            )}
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

            {/* Import from Job Board toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                style={{ ...S.btnCancel, flex: 1, background: !importMode ? "#6366f1" : "transparent", color: !importMode ? "#fff" : "#94a3b8", borderColor: "#6366f1" }}
                onClick={() => setImportMode(false)}
              >
                Create New
              </button>
              <button
                style={{ ...S.btnCancel, flex: 1, background: importMode ? "#6366f1" : "transparent", color: importMode ? "#fff" : "#94a3b8", borderColor: "#6366f1" }}
                onClick={async () => {
                  setImportMode(true);
                  if (!jobBoardJobs.length && user) {
                    const { data } = await supabase.from("job_board_jobs").select("id,name,client").eq("user_id", user.id).order("created_at", { ascending: false });
                    setJobBoardJobs(data || []);
                  }
                }}
              >
                Import from Job Board
              </button>
            </div>

            {importMode ? (
              <>
                <label style={S.lbl}>Select Job Board Job</label>
                <select
                  style={{ ...S.inp, cursor: "pointer" }}
                  value={selectedJobBoardId}
                  onChange={(e) => {
                    setSelectedJobBoardId(e.target.value);
                    const jb = jobBoardJobs.find((j) => j.id === e.target.value);
                    if (jb) setForm({ name: jb.name || "", client_name: jb.client || "", description: "" });
                  }}
                >
                  <option value="">— Choose a job —</option>
                  {jobBoardJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}{j.client ? ` — ${j.client}` : ""}</option>
                  ))}
                </select>
                {selectedJobBoardId && (
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Job name and client will be copied across. You can edit them below.</div>
                )}
                <label style={{ ...S.lbl, marginTop: 12 }}>Job Name *</label>
                <input style={S.inp} value={form.name} onChange={(e) => setForm((p) => ({...p, name: e.target.value}))} />
                <label style={S.lbl}>Client Name</label>
                <input style={S.inp} value={form.client_name} onChange={(e) => setForm((p) => ({...p, client_name: e.target.value}))} />
              </>
            ) : (
              <>
                <label style={S.lbl}>Job Name *</label>
                <input style={S.inp} value={form.name} onChange={(e) => setForm((p) => ({...p, name: e.target.value}))} placeholder="e.g. Smith Residence" autoFocus />
                <label style={S.lbl}>Client Name</label>
                <input style={S.inp} value={form.client_name} onChange={(e) => setForm((p) => ({...p, client_name: e.target.value}))} placeholder="Client name" />
                <label style={S.lbl}>Description</label>
                <textarea style={{ ...S.inp, resize: "vertical" }} value={form.description} onChange={(e) => setForm((p) => ({...p, description: e.target.value}))} placeholder="Optional notes…" rows={2} />
              </>
            )}

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
  page:       { padding: "0", minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" },
  loadWrap:   { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" },
  spinner:    { width: 36, height: 36, border: "3px solid #1e293b", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  // Banner
  banner:          { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", padding: "22px 28px", marginBottom: 20 },
  bannerLeft:      { display: "flex", alignItems: "center", gap: 18 },
  bannerIcon:      { fontSize: 48, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", borderRadius: 999, width: 76, height: 76, flexShrink: 0 },
  bannerTitle:     { margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.1, color: "#fff" },
  bannerDesc:      { margin: "4px 0 0", fontSize: 14, opacity: 0.92, color: "#fff" },
  bannerCustomBtn: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  backBtn:         { background: "rgba(15,23,42,0.85)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "9px 18px", fontSize: 15, cursor: "pointer", whiteSpace: "nowrap" },
  // Content area
  contentPad: { padding: "0 20px 24px" },
  header:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 },
  title:      { fontSize: 22, fontWeight: 600, margin: 0, color: "#f1f5f9" },
  sub:        { fontSize: 14, color: "#94a3b8", marginTop: 5 },
  addBtn:     { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  filterRow:  { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", padding: "0 20px", alignItems: "center" },
  filterOff:  { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 20, padding: "6px 16px", fontSize: 13, cursor: "pointer" },
  filterOn:   { background: "#6366f1", color: "#fff", border: "1px solid #6366f1", borderRadius: 20, padding: "6px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 },
  empty:      { textAlign: "center", color: "#475569", padding: "60px 20px", fontSize: 14 },
  boardWrap:  { overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)", borderRadius: 12, border: "1px solid #1e293b", margin: "0 20px" },
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
