import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

export default function ConvertToLiveProjectPage() {
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [preflight, setPreflight] = useState(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const acceptedSnapshots = useMemo(
    () => snapshots.filter((snapshot) => ["accepted", "approved", "signed"].includes(String(snapshot.status || "").toLowerCase())),
    [snapshots]
  );

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }
    let cancelled = false;
    async function loadProjects() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_commercial_projects")
        .select("id, project_name, client_name, site_address, status, updated_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load commercial projects.");
        setProjects([]);
      } else {
        const rows = data || [];
        setProjects(rows);
        setSelectedProjectId((current) => rows.find((project) => project.id === current)?.id || rows[0]?.id || "");
      }
      setLoading(false);
    }
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId) {
      setSnapshots([]);
      setSelectedSnapshotId("");
      return;
    }
    let cancelled = false;
    async function loadSnapshots() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_estimate_snapshots")
        .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, final_quote_total, created_at")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .order("snapshot_number", { ascending: false });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load estimate snapshots.");
        setSnapshots([]);
        setSelectedSnapshotId("");
      } else {
        const rows = data || [];
        setSnapshots(rows);
        const accepted = rows.find((snapshot) => ["accepted", "approved", "signed"].includes(String(snapshot.status || "").toLowerCase()));
        setSelectedSnapshotId((current) => rows.find((snapshot) => snapshot.id === current)?.id || accepted?.id || rows[0]?.id || "");
      }
      setLoading(false);
    }
    loadSnapshots();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    setPreflight(null);
    setResult(null);
    setConfirmed(false);
    if (workspaceId && selectedProjectId && selectedSnapshotId) runPreflight();
  }, [workspaceId, selectedProjectId, selectedSnapshotId]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("You must be signed in.");
    return {
      Authorization: `Bearer ${token}`,
      "x-workspace-id": workspaceId,
    };
  }

  async function runPreflight() {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) return;
    setChecking(true);
    setError("");
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        commercial_project_id: selectedProjectId,
        estimate_snapshot_id: selectedSnapshotId,
      });
      const response = await fetch(`/api/builders/convert-to-live-project?${params.toString()}`, { headers });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Preflight check failed.");
      setPreflight(payload.preflight);
    } catch (preflightError) {
      setError(preflightError.message || "Preflight check failed.");
    }
    setChecking(false);
  }

  async function convertToLiveProject() {
    if (!confirmed) {
      setError("Confirm the conversion before continuing.");
      return;
    }
    setConverting(true);
    setError("");
    setResult(null);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/builders/convert-to-live-project", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          commercial_project_id: selectedProjectId,
          estimate_snapshot_id: selectedSnapshotId,
          allow_duplicate: allowDuplicate,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        if (payload?.duplicate) setPreflight(payload.preflight);
        throw new Error(payload?.error || "Conversion failed.");
      }
      setResult(payload);
      setPreflight(payload.preflight || preflight);
      setConfirmed(false);
    } catch (convertError) {
      setError(convertError.message || "Conversion failed.");
    }
    setConverting(false);
  }

  return (
    <>
      <Head>
        <title>Convert Quote to Live Project</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Estimate Builder Commercials</p>
            <h1 style={styles.title}>Convert Quote to Live Project</h1>
            <p style={styles.subtitle}>Create a live operational job from an accepted commercial snapshot without modifying the original estimate workbook or snapshot.</p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={runPreflight} disabled={checking || !selectedSnapshotId}>
            {checking ? "Checking..." : "Refresh Preflight"}
          </button>
        </header>

        <section style={styles.selectorGrid}>
          <label style={styles.field}>
            <span>Commercial project</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={workspaceLoading || loading} style={styles.input}>
              {!projects.length ? <option value="">No commercial projects found</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name || project.client_name || "Untitled Project"}</option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            <span>Accepted estimate snapshot</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} disabled={!snapshots.length} style={styles.input}>
              {!snapshots.length ? <option value="">No snapshots found</option> : null}
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  Snapshot {snapshot.snapshot_number || ""}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""} ({snapshot.status || "draft"})
                </option>
              ))}
            </select>
            {snapshots.length && !acceptedSnapshots.length ? <small style={styles.warningText}>No accepted snapshots found. You can inspect preflight, but conversion will warn.</small> : null}
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {checking ? <div style={styles.info}>Running conversion preflight...</div> : null}

        <section style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Preflight Summary</h2>
            {preflight ? (
              <div style={styles.summaryGrid}>
                <Metric label="Project name" value={preflight.project_name} />
                <Metric label="Client" value={preflight.client || selectedProject?.client_name || "-"} />
                <Metric label="Site address" value={preflight.site_address || selectedProject?.site_address || "-"} />
                <Metric label="Estimate total" value={money(preflight.estimate_total)} />
                <Metric label="Approved variations" value={money(preflight.approved_variations)} />
                <Metric label="Revised contract value" value={money(preflight.revised_contract_value)} strong />
                <Metric label="BOQ items" value={preflight.boq_item_count} />
                <Metric label="Procurement items" value={preflight.procurement_item_count} />
                <Metric label="Selections" value={preflight.selection_count} />
              </div>
            ) : (
              <p style={styles.muted}>Select a commercial project and accepted snapshot to see the conversion preflight.</p>
            )}
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>What Will Be Created</h2>
            <ul style={styles.list}>
              {(preflight?.will_create || [
                "Project Hub record",
                "Job Board job",
                "Gantt/production programme",
                "Commercial dashboard links",
                "Procurement schedule links",
                "Draft work orders / production tasks where supported",
              ]).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Warnings</h2>
          {preflight?.warnings?.length ? (
            <div style={styles.warningList}>
              {preflight.warnings.map((warning) => <div key={warning} style={styles.warning}>{warning}</div>)}
            </div>
          ) : (
            <p style={styles.ok}>No blocking warnings found.</p>
          )}
          {preflight?.existing_conversion ? (
            <label style={styles.checkRow}>
              <input type="checkbox" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} />
              <span>Create another live project version even though a matching conversion already exists.</span>
            </label>
          ) : null}
          <label style={styles.checkRow}>
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I understand this is a one-way import into live operational modules and will not modify the original estimate workbook or snapshot.</span>
          </label>
          <button type="button" style={styles.primaryButton} onClick={convertToLiveProject} disabled={!selectedSnapshotId || !confirmed || converting}>
            {converting ? "Converting..." : "Convert Quote to Live Project"}
          </button>
        </section>

        {result ? (
          <section style={styles.success}>
            <h2 style={styles.cardTitle}>Live Project Created</h2>
            <div style={styles.resultGrid}>
              {Object.entries(result.ids || {}).map(([key, value]) => (
                <Metric key={key} label={key} value={Array.isArray(value) ? `${value.length} records` : value || "-"} />
              ))}
            </div>
            {result.warnings?.length ? (
              <div style={styles.warningList}>
                {result.warnings.map((warning) => <div key={warning} style={styles.warning}>{warning}</div>)}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </>
  );
}

function Metric({ label, value, strong = false }) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong style={strong ? styles.strongMetric : null}>{value ?? "-"}</strong>
    </div>
  );
}

function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

const styles = {
  page: { minHeight: "100vh", background: "#eef2f7", padding: 24, color: "#0f172a" },
  header: { background: "#0f172a", color: "#ffffff", borderRadius: 14, padding: 22, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" },
  eyebrow: { margin: 0, color: "#67e8f9", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: "4px 0", fontSize: 34, fontWeight: 900 },
  subtitle: { margin: 0, color: "#cbd5e1", maxWidth: 820, lineHeight: 1.5 },
  selectorGrid: { marginTop: 14, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase" },
  input: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 11px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 700 },
  grid: { marginTop: 14, display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 14, alignItems: "start" },
  card: { marginTop: 14, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 16, boxShadow: "0 14px 34px rgba(15,23,42,0.06)" },
  cardTitle: { margin: "0 0 12px", fontSize: 20, fontWeight: 900 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 },
  metric: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 11, display: "flex", flexDirection: "column", gap: 5, background: "#f8fafc" },
  strongMetric: { color: "#047857", fontSize: 18 },
  list: { margin: 0, paddingLeft: 22, color: "#334155", lineHeight: 1.8, fontWeight: 700 },
  muted: { color: "#64748b", fontWeight: 700 },
  warningText: { color: "#b45309", textTransform: "none", fontWeight: 800 },
  warningList: { display: "grid", gap: 8 },
  warning: { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: "9px 11px", fontWeight: 800 },
  ok: { border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "9px 11px", fontWeight: 800 },
  error: { marginTop: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 900 },
  info: { marginTop: 14, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "10px 12px", fontWeight: 900 },
  success: { marginTop: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16 },
  checkRow: { marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", fontWeight: 800, lineHeight: 1.45 },
  primaryButton: { marginTop: 14, border: "1px solid #16a34a", background: "#22c55e", color: "#052e16", borderRadius: 9, padding: "11px 15px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #475569", background: "#1e293b", color: "#ffffff", borderRadius: 9, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
};
