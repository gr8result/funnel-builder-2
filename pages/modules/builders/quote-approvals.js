import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const APPROVAL_TYPES = [
  { value: "quote_acceptance", label: "Quote Acceptance", db: "original_quote" },
  { value: "variation_approval", label: "Variation Approval", db: "variation" },
  { value: "selection_approval", label: "Selection Approval", db: "selection" },
  { value: "exclusion_acceptance", label: "Exclusion Acceptance", db: "other" },
  { value: "change_authority", label: "Change Authority", db: "other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "pending" },
  { value: "sent", label: "Sent", db: "sent" },
  { value: "viewed", label: "Viewed", db: "sent" },
  { value: "signed", label: "Signed", db: "approved" },
  { value: "rejected", label: "Rejected", db: "declined" },
  { value: "cancelled", label: "Cancelled", db: "void" },
];

const initialForm = {
  approvalType: "quote_acceptance",
  signerName: "",
  signerEmail: "",
  signerPhone: "",
  status: "draft",
  signedDate: "",
  signerIp: "",
  notes: "",
  variationId: "",
  selectionId: "",
  documentUrl: "",
  documentHash: "",
};

export default function BuilderQuoteApprovalsPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [variations, setVariations] = useState([]);
  const [selections, setSelections] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        .select("id, project_name, client_name, client_email, client_phone, site_address, status, currency, updated_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load commercial projects.");
        setProjects([]);
        setSelectedProjectId("");
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
      setApprovals([]);
      setVariations([]);
      setSelections([]);
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, approvalResult, variationResult, selectionResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, base_line_item_subtotal, preliminaries_total, overheads_total, margin_total, profit_total, gst_total, fees_total, final_quote_total, summary, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_quote_approvals")
          .select("id, snapshot_id, approval_number, approval_type, status, approved_amount, signer_name, signer_email, signer_ip, signed_at, document_url, document_hash, approval_snapshot, metadata, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_variations")
          .select("id, snapshot_id, variation_number, title, status, total, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_client_selections")
          .select("id, snapshot_id, category, title, status, allowance_amount, selected_product_name, selected_details, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || approvalResult.error || variationResult.error || selectionResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load quote approvals.");
        setSnapshots([]);
        setApprovals([]);
        setVariations([]);
        setSelections([]);
      } else {
        const snapshotRows = snapshotResult.data || [];
        setSnapshots(snapshotRows);
        setSelectedSnapshotId((current) => snapshotRows.find((snapshot) => snapshot.id === current)?.id || snapshotRows[0]?.id || "");
        setApprovals(approvalResult.data || []);
        setVariations(variationResult.data || []);
        setSelections(selectionResult.data || []);
      }
      setLoading(false);
    }

    loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    const project = projects.find((row) => row.id === selectedProjectId);
    setForm((current) => ({
      ...current,
      signerName: current.signerName || project?.client_name || "",
      signerEmail: current.signerEmail || project?.client_email || "",
      signerPhone: current.signerPhone || project?.client_phone || "",
    }));
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null,
    [snapshots, selectedSnapshotId]
  );

  const visibleApprovals = useMemo(
    () => approvals.filter((approval) => !selectedSnapshotId || approval.snapshot_id === selectedSnapshotId),
    [approvals, selectedSnapshotId]
  );

  const visibleVariations = useMemo(
    () => variations.filter((variation) => !selectedSnapshotId || variation.snapshot_id === selectedSnapshotId),
    [selectedSnapshotId, variations]
  );

  const visibleSelections = useMemo(
    () => selections.filter((selection) => !selectedSnapshotId || selection.snapshot_id === selectedSnapshotId),
    [selectedSnapshotId, selections]
  );

  const approvalSummary = useMemo(() => {
    return visibleApprovals.reduce(
      (totals, approval) => {
        totals.count += 1;
        if (displayStatus(approval) === "signed") totals.signed += 1;
        if (displayStatus(approval) === "sent" || displayStatus(approval) === "viewed") totals.pending += 1;
        totals.amount += Number(approval.approved_amount || 0);
        return totals;
      },
      { count: 0, signed: 0, pending: 0, amount: 0 }
    );
  }, [visibleApprovals]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createApproval() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating an approval record.");
      return;
    }
    if (!selectedProjectId || !selectedSnapshotId) {
      setError("Select a commercial project and estimate snapshot first.");
      return;
    }
    if (!form.signerName.trim() || !form.signerEmail.trim()) {
      setError("Signer name and signer email are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const type = approvalTypeOption(form.approvalType);
    const status = statusOption(form.status);
    const relatedVariation = form.variationId ? variations.find((variation) => variation.id === form.variationId) : null;
    const relatedSelection = form.selectionId ? selections.find((selection) => selection.id === form.selectionId) : null;
    const approvedAmount = approvedAmountFor({ snapshot: selectedSnapshot, variation: relatedVariation, selection: relatedSelection });
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId,
      approval_number: nextApprovalNumber(approvals),
      approval_type: type.db,
      status: status.db,
      approved_amount: approvedAmount,
      signer_name: form.signerName.trim(),
      signer_email: form.signerEmail.trim(),
      signer_ip: form.signerIp.trim(),
      signed_at: form.status === "signed" && form.signedDate ? new Date(`${form.signedDate}T00:00:00`).toISOString() : null,
      document_url: form.documentUrl.trim(),
      document_hash: form.documentHash.trim(),
      approval_snapshot: {
        project: selectedProject,
        snapshot: selectedSnapshot,
        relatedVariation,
        relatedSelection,
      },
      metadata: {
        uiApprovalType: form.approvalType,
        uiStatus: form.status,
        signerPhone: form.signerPhone.trim(),
        notes: form.notes.trim(),
        relatedVariationId: form.variationId || null,
        relatedSelectionId: form.selectionId || null,
        source: "builders_quote_approvals_page",
      },
      created_by: userId,
      updated_by: userId,
    };

    const { data, error: insertError } = await supabase
      .from("builder_quote_approvals")
      .insert(payload)
      .select("id, snapshot_id, approval_number, approval_type, status, approved_amount, signer_name, signer_email, signer_ip, signed_at, document_url, document_hash, approval_snapshot, metadata, created_at, updated_at")
      .single();

    if (insertError) {
      setError(insertError.message || "Could not create approval record.");
    } else {
      setApprovals((current) => [data, ...current]);
      setForm({
        ...initialForm,
        signerName: selectedProject?.client_name || "",
        signerEmail: selectedProject?.client_email || "",
        signerPhone: selectedProject?.client_phone || "",
      });
      setSuccess(`Approval record ${data.approval_number} created.`);
    }
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Quote Approvals</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Quote Approvals / Signed Documents</h1>
            <p style={styles.subtitle}>Store durable acceptance, approval and authority records without changing the original estimate snapshot.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/variations" style={styles.secondaryLink}>Variations</Link>
            <Link href="/modules/builders/client-selections" style={styles.secondaryLink}>Selections</Link>
            <Link href="/modules/builders/budget-vs-actual" style={styles.primaryLink}>Budget vs Actual</Link>
          </div>
        </header>

        <section style={styles.controls}>
          <label style={styles.field}>
            <span style={styles.label}>Commercial project</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !projects.length}>
              {!projects.length ? <option value="">No synced projects found</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Estimate snapshot</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !snapshots.length}>
              {!snapshots.length ? <option value="">No snapshots found</option> : null}
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  Snapshot {snapshot.snapshot_number}{snapshot.status ? ` - ${titleCase(snapshot.status)}` : ""}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}

        <section style={styles.snapshotNote}>
          <strong>Commercial rule:</strong>
          <span>Approval records are durable commercial records and do not modify the original estimate snapshot.</span>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Snapshot total" value={money(selectedSnapshot?.final_quote_total, selectedProject?.currency)} helper={selectedSnapshot ? `Snapshot ${selectedSnapshot.snapshot_number}` : "No snapshot"} />
          <SummaryCard label="Approvals" value={approvalSummary.count} helper={`${approvalSummary.signed} signed`} />
          <SummaryCard label="Sent / viewed" value={approvalSummary.pending} helper="Awaiting signature" />
          <SummaryCard label="Approved amount" value={money(approvalSummary.amount, selectedProject?.currency)} helper="All visible approvals" emphasis />
        </section>

        <section style={styles.totalPanel}>
          <div>
            <h2 style={styles.panelTitle}>Quote / estimate snapshot summary</h2>
            <p style={styles.panelText}>Source quote {selectedSnapshot?.source_quote_number || "-"} from {selectedSnapshot?.source_quote_date || "no quote date"}.</p>
          </div>
          <div style={styles.totalList}>
            <MiniTotal label="Line subtotal" value={money(selectedSnapshot?.base_line_item_subtotal, selectedProject?.currency)} />
            <MiniTotal label="Preliminaries" value={money(selectedSnapshot?.preliminaries_total, selectedProject?.currency)} />
            <MiniTotal label="Overheads" value={money(selectedSnapshot?.overheads_total, selectedProject?.currency)} />
            <MiniTotal label="Margin" value={money(selectedSnapshot?.margin_total, selectedProject?.currency)} />
            <MiniTotal label="GST" value={money(selectedSnapshot?.gst_total, selectedProject?.currency)} />
            <MiniTotal label="Final quote" value={money(selectedSnapshot?.final_quote_total, selectedProject?.currency)} />
          </div>
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create approval record</h2>
                <p style={styles.panelText}>Capture signed document references and related commercial context.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Approval type</span>
                <select value={form.approvalType} onChange={(event) => updateForm("approvalType", event.target.value)} style={styles.select}>
                  {APPROVAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Approval status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Signer name</span>
                <input value={form.signerName} onChange={(event) => updateForm("signerName", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Signer email</span>
                <input value={form.signerEmail} onChange={(event) => updateForm("signerEmail", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Signer phone</span>
                <input value={form.signerPhone} onChange={(event) => updateForm("signerPhone", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Signed date</span>
                <input type="date" value={form.signedDate} onChange={(event) => updateForm("signedDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>IP address</span>
                <input value={form.signerIp} onChange={(event) => updateForm("signerIp", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Document hash</span>
                <input value={form.documentHash} onChange={(event) => updateForm("documentHash", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Document URL</span>
                <input value={form.documentUrl} onChange={(event) => updateForm("documentUrl", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related variation optional</span>
                <select value={form.variationId} onChange={(event) => updateForm("variationId", event.target.value)} style={styles.select}>
                  <option value="">No related variation</option>
                  {visibleVariations.map((variation) => (
                    <option key={variation.id} value={variation.id}>{variation.variation_number} - {variation.title}</option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related selection optional</span>
                <select value={form.selectionId} onChange={(event) => updateForm("selectionId", event.target.value)} style={styles.select}>
                  <option value="">No related selection</option>
                  {visibleSelections.map((selection) => (
                    <option key={selection.id} value={selection.id}>{titleCase(selection.category)} - {selection.title}</option>
                  ))}
                </select>
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} style={styles.textarea} />
              </label>
            </div>

            <button type="button" onClick={createApproval} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create Approval Record"}
            </button>
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Existing approvals</h2>
                <p style={styles.panelText}>Durable commercial approval records for this project/snapshot.</p>
              </div>
              <span style={styles.readOnlyPill}>{visibleApprovals.length} approval{visibleApprovals.length === 1 ? "" : "s"}</span>
            </div>

            {!visibleApprovals.length ? <div style={styles.empty}>No approval records found for this project/snapshot.</div> : null}

            <div style={styles.approvalList}>
              {visibleApprovals.map((approval) => {
                const status = displayStatus(approval);
                return (
                  <article key={approval.id} style={styles.approvalCard}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{approval.approval_number || "Approval"}</h3>
                        <p style={styles.cardMeta}>{approval.signer_name} - {approval.signer_email}</p>
                      </div>
                      <span style={{ ...styles.statusPill, ...statusStyle(status) }}>{titleCase(status)}</span>
                    </div>
                    <div style={styles.cardTotals}>
                      <MiniTotal label="Type" value={titleCase(approval.metadata?.uiApprovalType || approval.approval_type)} />
                      <MiniTotal label="Amount" value={money(approval.approved_amount, selectedProject?.currency)} />
                      <MiniTotal label="Signed" value={approval.signed_at ? dateOnly(approval.signed_at) : "-"} />
                    </div>
                    <div style={styles.detailList}>
                      <span>Phone: {approval.metadata?.signerPhone || "-"}</span>
                      <span>IP: {approval.signer_ip || "-"}</span>
                      <span>Document: {approval.document_url ? "Linked" : "No URL"}</span>
                      <span>Hash: {approval.document_hash || "-"}</span>
                    </div>
                    {approval.metadata?.notes ? <p style={styles.notes}>{approval.metadata.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

function approvalTypeOption(value) {
  return APPROVAL_TYPES.find((type) => type.value === value) || APPROVAL_TYPES[0];
}

function statusOption(value) {
  return STATUS_OPTIONS.find((status) => status.value === value) || STATUS_OPTIONS[0];
}

function displayStatus(approval) {
  return approval?.metadata?.uiStatus || fromDbStatus(approval?.status);
}

function fromDbStatus(status) {
  if (status === "pending") return "draft";
  if (status === "approved") return "signed";
  if (status === "declined") return "rejected";
  if (status === "void") return "cancelled";
  return status || "draft";
}

function approvedAmountFor({ snapshot, variation, selection }) {
  if (variation) return numberValue(variation.total);
  if (selection) return numberValue(selection.selected_details?.selectedCost || selection.allowance_amount);
  return numberValue(snapshot?.final_quote_total);
}

function nextApprovalNumber(existing = []) {
  const year = new Date().getFullYear();
  const max = existing.reduce((highest, approval) => {
    const match = String(approval.approval_number || "").match(/APP-\d{4}-(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `APP-${year}-${String(max + 1).padStart(4, "0")}`;
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value, currency = "AUD") {
  const number = Number(value);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status) {
  if (status === "signed") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
  if (status === "sent" || status === "viewed") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (status === "rejected" || status === "cancelled") return { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" };
  return { background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" };
}

function SummaryCard({ label, value, helper, emphasis = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(emphasis ? styles.summaryCardEmphasis : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function MiniTotal({ label, value }) {
  return (
    <div style={styles.miniTotal}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", padding: 18 },
  hero: { background: "linear-gradient(135deg, #0f172a 0%, #172554 48%, #064e3b 100%)", color: "#ffffff", border: "1px solid #1e293b", borderRadius: 12, padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)" },
  eyebrow: { color: "#67e8f9", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: "4px 0", fontSize: 38, lineHeight: 1.05, fontWeight: 800 },
  subtitle: { margin: 0, color: "#cbd5e1", fontSize: 15, maxWidth: 760 },
  heroActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  primaryLink: { background: "#ffffff", color: "#0f172a", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  secondaryLink: { background: "rgba(15, 23, 42, 0.35)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  controls: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0, gridColumn: "1 / -1" },
  label: { color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700, resize: "vertical" },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  success: { marginTop: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  snapshotNote: { marginTop: 12, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, flexWrap: "wrap", fontWeight: 800 },
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  totalPanel: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" },
  totalList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, minWidth: 300, flex: "1 1 640px" },
  workspaceGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.95fr)", gap: 16, alignItems: "start" },
  panel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4 },
  createButton: { width: "100%", marginTop: 14, background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: 8, padding: "12px 14px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  readOnlyPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  approvalList: { display: "flex", flexDirection: "column", gap: 12 },
  approvalCard: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#ffffff" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  cardMeta: { margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  cardTotals: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 },
  detailList: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, color: "#475569", fontSize: 13, fontWeight: 750 },
  notes: { margin: "10px 0 0", color: "#334155", fontSize: 14, fontWeight: 650 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

