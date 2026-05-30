// /pages/modules/projects/index.js
// Project Workflow Tracker — dashboard listing all jobs
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

const JOB_TYPES = [
  "New Build", "Renovation", "Extension", "Commercial",
  "Duplex", "Knock Down Rebuild", "Other",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v) {
  if (!v) return null;
  return "$" + Number(v).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsDashboard() {
  const router = useRouter();
  const [user, setUser]               = useState(null);
  const [projects, setProjects]       = useState([]);
  const [taskSummary, setTaskSummary] = useState({});
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm] = useState({
    client_name: "", job_address: "", job_type: "New Build", contract_value: "", notes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProjects(data || []);

      if (data?.length) {
        const ids = data.map((p) => p.id);
        const { data: taskRows } = await supabase
          .from("project_tasks")
          .select("project_id, status")
          .in("project_id", ids);
        const summary = {};
        (taskRows || []).forEach((t) => {
          if (!summary[t.project_id]) summary[t.project_id] = { done: 0, total: 0 };
          if (t.status !== "na") summary[t.project_id].total++;
          if (t.status === "done") summary[t.project_id].done++;
        });
        setTaskSummary(summary);
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id:        user.id,
          client_name:    form.client_name.trim(),
          job_address:    form.job_address.trim(),
          job_type:       form.job_type,
          contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
          notes:          form.notes.trim(),
          current_phase:  "sales",
          status:         "active",
        })
        .select()
        .single();
      if (error) throw error;
      router.push(`/modules/projects/${data.id}`);
    } catch (err) {
      alert("Error creating project: " + err.message);
      setSaving(false);
    }
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.current_phase === filter);
  const phaseCounts = Object.fromEntries(
    PHASES.map((ph) => [ph.key, projects.filter((p) => p.current_phase === ph.key).length])
  );

  return (
    <>
      <Head><title>Projects — Workflow Tracker</title></Head>
      <main style={S.page}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div>
            <h1 style={S.pageTitle}>🏗️ Project Workflow Tracker</h1>
            <p style={S.pageSub}>Track every job from first contact through to handover — nothing missed.</p>
          </div>
          <button style={S.primaryBtn} onClick={() => setShowNew(true)}>+ New Project</button>
        </div>

        {/* ── Stats Strip ────────────────────────────────────────────── */}
        <div style={S.statsRow}>
          {PHASES.map((ph) => (
            <button
              key={ph.key}
              style={{
                ...S.statCard,
                borderTop: `3px solid ${ph.color}`,
                background: filter === ph.key ? ph.color + "18" : "#1a1a2e",
              }}
              onClick={() => setFilter(filter === ph.key ? "all" : ph.key)}
            >
              <span style={{ fontSize: 26 }}>{ph.emoji}</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: ph.color }}>{phaseCounts[ph.key] || 0}</span>
              <span style={{ fontSize: 16, color: "#9ca3af" }}>{ph.label}</span>
            </button>
          ))}
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────────── */}
        <div style={S.filterBar}>
          {[{ key: "all", label: "All Jobs", emoji: "📁" }, ...PHASES].map((t) => (
            <button
              key={t.key}
              style={{ ...S.filterBtn, ...(filter === t.key ? S.filterBtnActive : {}) }}
              onClick={() => setFilter(t.key)}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* ── Project Grid ───────────────────────────────────────────── */}
        {loading ? (
          <div style={S.center}>Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div style={S.center}>
            {filter === "all" ? (
              <>No projects yet.{" "}
                <span style={{ color: "#3b82f6", cursor: "pointer" }} onClick={() => setShowNew(true)}>
                  Create your first one →
                </span>
              </>
            ) : (
              `No jobs in the ${filter} phase.`
            )}
          </div>
        ) : (
          <div style={S.grid}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} taskSummary={taskSummary[p.id]} />
            ))}
          </div>
        )}

      </main>

      {/* ── New Project Modal ──────────────────────────────────────────── */}
      {showNew && (
        <div style={S.overlay} onClick={() => setShowNew(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>New Project</h2>

            <label style={S.fieldLabel}>
              Client / Job Name <span style={{ color: "#ef4444" }}>*</span>
              <input
                style={S.input} autoFocus
                placeholder="e.g. Smith Residence — New Build"
                value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              />
            </label>

            <label style={S.fieldLabel}>
              Job Address
              <input
                style={S.input}
                placeholder="123 Example St, Suburb STATE"
                value={form.job_address}
                onChange={(e) => setForm((f) => ({ ...f, job_address: e.target.value }))}
              />
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Job Type
                <select
                  style={S.input}
                  value={form.job_type}
                  onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}
                >
                  {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Contract Value ($)
                <input
                  style={S.input} type="number"
                  placeholder="450000"
                  value={form.contract_value}
                  onChange={(e) => setForm((f) => ({ ...f, contract_value: e.target.value }))}
                />
              </label>
            </div>

            <label style={S.fieldLabel}>
              Notes
              <textarea
                style={{ ...S.input, minHeight: 64, resize: "vertical" }}
                placeholder="Any initial notes about the job…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button style={S.cancelBtn} onClick={() => setShowNew(false)}>Cancel</button>
              <button
                style={{ ...S.primaryBtn, opacity: (!form.client_name.trim() || saving) ? 0.5 : 1 }}
                disabled={!form.client_name.trim() || saving}
                onClick={createProject}
              >
                {saving ? "Creating…" : "Create Project →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project: p, taskSummary: ts }) {
  const ph    = PHASES.find((x) => x.key === p.current_phase) || PHASES[0];
  const done  = ts?.done  || 0;
  const total = ts?.total || 0;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <Link href={`/modules/projects/${p.id}`} style={S.card}>
      {/* Phase & status row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ ...S.phasePill, background: ph.color + "22", color: ph.color, border: `1px solid ${ph.color}44` }}>
          {ph.emoji} {ph.label}
        </span>
        <span style={{
          fontSize: 16, padding: "3px 9px", borderRadius: 12, color: "#fff", textTransform: "capitalize",
          background: p.status === "active" ? "#22c55e" : p.status === "on_hold" ? "#f59e0b" : "#6b7280",
        }}>
          {p.status}
        </span>
      </div>

      <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>{p.client_name}</div>
      {p.job_address && <div style={{ fontSize: 16, color: "#9ca3af", marginBottom: 8 }}>{p.job_address}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={S.metaTag}>{p.job_type}</span>
        {p.contract_value && <span style={{ ...S.metaTag, color: "#22c55e" }}>{fmtCurrency(p.contract_value)}</span>}
      </div>

      {total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${pct}%`, background: pct === 100 ? "#22c55e" : ph.color }} />
          </div>
          <div style={{ fontSize: 16, color: "#9ca3af", marginTop: 4 }}>
            {done}/{total} tasks · {pct}% complete
          </div>
        </div>
      )}
    </Link>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:     { minHeight: "100vh", background: "#0f0f1a", color: "#f1f5f9", padding: "32px 28px", fontFamily: "system-ui, -apple-system, sans-serif" },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 },
  pageTitle:{ fontSize: 26, fontWeight: 600, margin: 0 },
  pageSub:  { fontSize: 16, color: "#9ca3af", marginTop: 4, marginBottom: 0 },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 24 },
  statCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "18px 12px", borderRadius: 14, cursor: "pointer", border: "none", textAlign: "center" },

  filterBar:       { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  filterBtn:       { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 20, padding: "6px 14px", fontSize: 16, cursor: "pointer" },
  filterBtnActive: { background: "#3b82f6", color: "#fff", border: "1px solid #3b82f6" },

  grid:         { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card:         { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textDecoration: "none", color: "inherit", display: "block" },
  phasePill:    { fontSize: 16, fontWeight: 600, padding: "4px 10px", borderRadius: 20 },
  metaTag:      { fontSize: 16, background: "#0f172a", padding: "3px 10px", borderRadius: 8, color: "#94a3b8" },
  progressBar:  { height: 6, background: "#0f172a", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.4s" },

  center: { textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 16 },

  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:      { background: "#1a1a2e", border: "1px solid #334155", borderRadius: 18, padding: 28, width: "min(520px, 95vw)", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: 600, color: "#f1f5f9", margin: 0 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 16, color: "#94a3b8", fontWeight: 500 },
  input:      { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", padding: "10px 12px", fontSize: 16, outline: "none" },
  primaryBtn: { background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  cancelBtn:  { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 10, padding: "10px 20px", fontSize: 16, cursor: "pointer" },
};
