import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const DOCUMENT_TYPES = [
  { value: "plans", label: "Plans", db: "general" },
  { value: "engineering", label: "Engineering", db: "other" },
  { value: "approvals", label: "Approvals", db: "approval" },
  { value: "selections", label: "Selections", db: "selection" },
  { value: "signed_docs", label: "Signed Docs", db: "approval" },
  { value: "warranties", label: "Warranties", db: "other" },
  { value: "supplier_docs", label: "Supplier Docs", db: "supplier_invoice" },
  { value: "contracts", label: "Contracts", db: "contract" },
  { value: "other", label: "Other", db: "other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "active" },
  { value: "current", label: "Current", db: "active" },
  { value: "superseded", label: "Superseded", db: "active" },
  { value: "expired", label: "Expired", db: "active" },
  { value: "archived", label: "Archived", db: "archived" },
];

const initialForm = {
  title: "",
  documentType: "plans",
  description: "",
  fileUrl: "",
  storagePath: "",
  relatedApprovalId: "",
  relatedVariationId: "",
  relatedSelectionId: "",
  expiryDate: "",
  status: "current",
  notes: "",
};

export default function BuilderDocumentVaultPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [variations, setVariations] = useState([]);
  const [selections, setSelections] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
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
        .select("id, project_name, client_name, site_address, status, currency, updated_at, created_at")
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
      setDocuments([]);
      setApprovals([]);
      setVariations([]);
      setSelections([]);
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, documentResult, approvalResult, variationResult, selectionResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_project_documents")
          .select("id, snapshot_id, document_type, title, description, file_name, storage_path, public_url, related_table, related_record_id, status, metadata, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_quote_approvals")
          .select("id, snapshot_id, approval_number, approval_type, status, signer_name, document_url, metadata, created_at")
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
          .select("id, snapshot_id, category, title, status, selected_product_name, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || documentResult.error || approvalResult.error || variationResult.error || selectionResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load document vault.");
        setSnapshots([]);
        setDocuments([]);
        setApprovals([]);
        setVariations([]);
        setSelections([]);
      } else {
        setSnapshots(snapshotResult.data || []);
        setDocuments(documentResult.data || []);
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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const uiType = documentTypeFor(document);
      const uiStatus = statusFor(document);
      if (selectedSnapshotId && document.snapshot_id !== selectedSnapshotId) return false;
      if (typeFilter !== "all" && uiType !== typeFilter) return false;
      if (statusFilter !== "all" && uiStatus !== statusFilter) return false;
      if (!term) return true;
      return [
        document.title,
        document.description,
        document.public_url,
        document.storage_path,
        document.metadata?.notes,
        uiType,
        uiStatus,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [documents, search, selectedSnapshotId, statusFilter, typeFilter]);

  const groupedDocuments = useMemo(() => {
    const groups = new Map(DOCUMENT_TYPES.map((type) => [type.value, []]));
    visibleDocuments.forEach((document) => {
      const type = documentTypeFor(document);
      const key = DOCUMENT_TYPES.some((entry) => entry.value === type) ? type : "other";
      groups.get(key).push(document);
    });
    return Array.from(groups.entries())
      .map(([type, rows]) => ({ type, rows }))
      .filter((group) => group.rows.length || typeFilter === "all");
  }, [typeFilter, visibleDocuments]);

  const summary = useMemo(() => {
    return visibleDocuments.reduce(
      (totals, document) => {
        totals.count += 1;
        if (isExpired(document)) totals.expired += 1;
        if (statusFor(document) === "current") totals.current += 1;
        if (statusFor(document) === "archived") totals.archived += 1;
        return totals;
      },
      { count: 0, current: 0, expired: 0, archived: 0 }
    );
  }, [visibleDocuments]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createDocument() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating a document record.");
      return;
    }
    if (!selectedProjectId) {
      setError("Select a commercial project first.");
      return;
    }
    if (!form.title.trim() || !form.fileUrl.trim()) {
      setError("Document title and file URL are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const type = documentTypeOption(form.documentType);
    const status = statusOption(form.status);
    const related = relatedRecordFor(form);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId || null,
      document_type: type.db,
      title: form.title.trim(),
      description: form.description.trim(),
      file_name: fileNameFromUrl(form.fileUrl),
      storage_path: form.storagePath.trim(),
      public_url: form.fileUrl.trim(),
      related_table: related.table,
      related_record_id: related.id,
      status: status.db,
      metadata: {
        uiDocumentType: form.documentType,
        uiStatus: form.status,
        expiryDate: form.expiryDate || null,
        notes: form.notes.trim(),
        relatedApprovalId: form.relatedApprovalId || null,
        relatedVariationId: form.relatedVariationId || null,
        relatedSelectionId: form.relatedSelectionId || null,
        source: "builders_document_vault_page",
      },
      uploaded_by: userId,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error: insertError } = await supabase
      .from("builder_project_documents")
      .insert(payload)
      .select("id, snapshot_id, document_type, title, description, file_name, storage_path, public_url, related_table, related_record_id, status, metadata, created_at, updated_at")
      .single();

    if (insertError) {
      setError(insertError.message || "Could not create document record.");
    } else {
      setDocuments((current) => [data, ...current]);
      setForm({ ...initialForm, documentType: form.documentType });
      setSuccess(`Document "${data.title}" added to the vault.`);
    }
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Builders Document Vault</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Document Vault</h1>
            <p style={styles.subtitle}>Register plans, approvals, selections, contracts and signed documents without changing the estimate snapshot.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/quote-approvals" style={styles.secondaryLink}>Quote Approvals</Link>
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
            <span style={styles.label}>Estimate snapshot optional</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} style={styles.select}>
              <option value="">All / project level</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Type filter</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={styles.select}>
              <option value="all">All document types</option>
              {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status filter</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, URL, notes..." style={styles.input} />
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}

        <section style={styles.snapshotNote}>
          <strong>Commercial rule:</strong>
          <span>Document vault records do not modify the estimate snapshot or BOQ pricing.</span>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedSnapshotId ? "Snapshot filtered" : "Project level"} />
          <SummaryCard label="Documents" value={summary.count} helper="Visible records" />
          <SummaryCard label="Current" value={summary.current} helper="Active current docs" emphasis />
          <SummaryCard label="Expired" value={summary.expired} helper="Expiry date has passed" danger={summary.expired > 0} />
          <SummaryCard label="Archived" value={summary.archived} helper="Archived records" />
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create document record</h2>
                <p style={styles.panelText}>This records a document URL/path. Upload storage can be wired in separately.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.fieldWide}>
                <span style={styles.label}>Title</span>
                <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Document type</span>
                <select value={form.documentType} onChange={(event) => updateForm("documentType", event.target.value)} style={styles.select}>
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Description</span>
                <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={3} style={styles.textarea} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>File URL</span>
                <input value={form.fileUrl} onChange={(event) => updateForm("fileUrl", event.target.value)} placeholder="https://..." style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Storage path optional</span>
                <input value={form.storagePath} onChange={(event) => updateForm("storagePath", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related quote approval optional</span>
                <select value={form.relatedApprovalId} onChange={(event) => updateForm("relatedApprovalId", event.target.value)} style={styles.select}>
                  <option value="">No related approval</option>
                  {approvals.map((approval) => <option key={approval.id} value={approval.id}>{approval.approval_number || "Approval"} - {approval.signer_name || "Signer"}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related variation optional</span>
                <select value={form.relatedVariationId} onChange={(event) => updateForm("relatedVariationId", event.target.value)} style={styles.select}>
                  <option value="">No related variation</option>
                  {variations.map((variation) => <option key={variation.id} value={variation.id}>{variation.variation_number} - {variation.title}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related selection optional</span>
                <select value={form.relatedSelectionId} onChange={(event) => updateForm("relatedSelectionId", event.target.value)} style={styles.select}>
                  <option value="">No related selection</option>
                  {selections.map((selection) => <option key={selection.id} value={selection.id}>{titleCase(selection.category)} - {selection.title}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Expiry date optional</span>
                <input type="date" value={form.expiryDate} onChange={(event) => updateForm("expiryDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} style={styles.textarea} />
              </label>
            </div>

            <button type="button" onClick={createDocument} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create Document Record"}
            </button>
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Project documents</h2>
                <p style={styles.panelText}>Grouped by document type. Expired documents are highlighted.</p>
              </div>
              <span style={styles.readOnlyPill}>{visibleDocuments.length} document{visibleDocuments.length === 1 ? "" : "s"}</span>
            </div>

            {!visibleDocuments.length ? <div style={styles.empty}>No document records found for this project/filter.</div> : null}

            <div style={styles.groupList}>
              {groupedDocuments.map((group) => (
                <section key={group.type} style={styles.group}>
                  <div style={styles.groupHeader}>
                    <h3 style={styles.groupTitle}>{documentTypeOption(group.type).label}</h3>
                    <span>{group.rows.length}</span>
                  </div>
                  {group.rows.map((document) => {
                    const expired = isExpired(document);
                    const status = statusFor(document);
                    return (
                      <article key={document.id} style={{ ...styles.documentCard, ...(expired ? styles.expiredCard : {}) }}>
                        <div style={styles.cardHeader}>
                          <div>
                            <h4 style={styles.cardTitle}>{document.title}</h4>
                            <p style={styles.cardMeta}>{document.description || document.file_name || "No description"}</p>
                          </div>
                          <span style={{ ...styles.statusPill, ...statusStyle(status, expired) }}>{expired ? "Expired" : titleCase(status)}</span>
                        </div>
                        <div style={styles.detailGrid}>
                          <span>Expiry: {document.metadata?.expiryDate || "-"}</span>
                          <span>Storage: {document.storage_path || "-"}</span>
                          <span>Related: {relatedLabel(document)}</span>
                          <span>Created: {dateOnly(document.created_at) || "-"}</span>
                        </div>
                        <div style={styles.urlRow}>
                          {document.public_url ? <a href={document.public_url} target="_blank" rel="noreferrer">Open document</a> : <span>No file URL</span>}
                        </div>
                        {document.metadata?.notes ? <p style={styles.notes}>{document.metadata.notes}</p> : null}
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

function relatedRecordFor(form) {
  if (form.relatedApprovalId) return { table: "builder_quote_approvals", id: form.relatedApprovalId };
  if (form.relatedVariationId) return { table: "builder_variations", id: form.relatedVariationId };
  if (form.relatedSelectionId) return { table: "builder_client_selections", id: form.relatedSelectionId };
  return { table: null, id: null };
}

function relatedLabel(document) {
  if (document.related_table === "builder_quote_approvals") return "Quote approval";
  if (document.related_table === "builder_variations") return "Variation";
  if (document.related_table === "builder_client_selections") return "Selection";
  return "None";
}

function documentTypeOption(value) {
  return DOCUMENT_TYPES.find((type) => type.value === value) || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function statusOption(value) {
  return STATUS_OPTIONS.find((status) => status.value === value) || STATUS_OPTIONS[1];
}

function documentTypeFor(document) {
  return document?.metadata?.uiDocumentType || fromDbDocumentType(document?.document_type);
}

function fromDbDocumentType(type) {
  if (type === "approval") return "approvals";
  if (type === "selection") return "selections";
  if (type === "contract") return "contracts";
  if (type === "supplier_invoice") return "supplier_docs";
  return type === "other" || type === "general" ? "other" : "other";
}

function statusFor(document) {
  return document?.metadata?.uiStatus || fromDbStatus(document?.status);
}

function fromDbStatus(status) {
  if (status === "archived") return "archived";
  if (status === "deleted") return "archived";
  return "current";
}

function isExpired(document) {
  const expiry = document?.metadata?.expiryDate;
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${expiry}T00:00:00`) < today;
}

function fileNameFromUrl(value) {
  try {
    const url = new URL(value);
    const name = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(name || "");
  } catch {
    return String(value || "").split("/").filter(Boolean).pop() || "";
  }
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status, expired) {
  if (expired || status === "expired") return { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" };
  if (status === "current") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
  if (status === "superseded") return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
  if (status === "archived") return { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" };
  return { background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" };
}

function SummaryCard({ label, value, helper, emphasis = false, danger = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(emphasis ? styles.summaryCardEmphasis : {}), ...(danger ? styles.summaryCardDanger : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
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
  controls: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 },
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
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  summaryCardDanger: { borderColor: "#fecaca", background: "#fff1f2" },
  workspaceGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(380px, 1fr)", gap: 16, alignItems: "start" },
  panel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  createButton: { width: "100%", marginTop: 14, background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: 8, padding: "12px 14px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  readOnlyPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  groupList: { display: "flex", flexDirection: "column", gap: 12 },
  group: { border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" },
  groupHeader: { background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  groupTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  documentCard: { padding: 13, borderBottom: "1px solid #e2e8f0", background: "#ffffff" },
  expiredCard: { background: "#fff1f2" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  cardMeta: { margin: "3px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, color: "#475569", fontSize: 13, fontWeight: 750 },
  urlRow: { marginTop: 10, fontWeight: 900 },
  notes: { margin: "10px 0 0", color: "#334155", fontSize: 14, fontWeight: 650 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

