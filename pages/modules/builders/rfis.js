import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "open" },
  { value: "open", label: "Open", db: "open" },
  { value: "awaiting_client", label: "Awaiting Client", db: "open" },
  { value: "awaiting_builder", label: "Awaiting Builder", db: "open" },
  { value: "answered", label: "Answered", db: "answered" },
  { value: "closed", label: "Closed", db: "closed" },
  { value: "cancelled", label: "Cancelled", db: "cancelled" },
];

const initialForm = {
  rfiNumber: "",
  title: "",
  question: "",
  requestedBy: "",
  requestedByEmail: "",
  assignedTo: "",
  priority: "normal",
  status: "open",
  requiredResponseDate: "",
  responseDate: "",
  response: "",
  sourceQuoteRowId: "",
  variationId: "",
  selectionId: "",
  documentId: "",
  notes: "",
};

export default function BuilderRfisPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [rfis, setRfis] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [variations, setVariations] = useState([]);
  const [selections, setSelections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
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
        .select("id, project_name, client_name, client_email, site_address, status, currency, updated_at, created_at")
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
      setRfis([]);
      setBoqItems([]);
      setVariations([]);
      setSelections([]);
      setDocuments([]);
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, rfiResult, boqResult, variationResult, selectionResult, documentResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_rfis")
          .select("id, snapshot_id, boq_item_id, client_selection_id, source_quote_row_id, rfi_number, subject, question, answer, status, priority, asked_by_name, asked_by_email, due_date, answered_at, closed_at, metadata, notes, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_boq_items")
          .select("id, snapshot_id, source_quote_row_id, source_section_name, item_name, description, status, sort_order")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("sort_order", { ascending: true }),
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
        supabase
          .from("builder_project_documents")
          .select("id, snapshot_id, title, document_type, status, public_url, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || rfiResult.error || boqResult.error || variationResult.error || selectionResult.error || documentResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load RFIs.");
        setSnapshots([]);
        setRfis([]);
        setBoqItems([]);
        setVariations([]);
        setSelections([]);
        setDocuments([]);
      } else {
        setSnapshots(snapshotResult.data || []);
        setRfis(rfiResult.data || []);
        setBoqItems(boqResult.data || []);
        setVariations(variationResult.data || []);
        setSelections(selectionResult.data || []);
        setDocuments(documentResult.data || []);
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
      rfiNumber: current.rfiNumber || nextRfiNumber(rfis),
      requestedBy: current.requestedBy || project?.client_name || "",
      requestedByEmail: current.requestedByEmail || project?.client_email || "",
    }));
  }, [projects, rfis, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const visibleBoqItems = useMemo(
    () => boqItems.filter((item) => !selectedSnapshotId || item.snapshot_id === selectedSnapshotId),
    [boqItems, selectedSnapshotId]
  );

  const visibleVariations = useMemo(
    () => variations.filter((variation) => !selectedSnapshotId || variation.snapshot_id === selectedSnapshotId),
    [selectedSnapshotId, variations]
  );

  const visibleSelections = useMemo(
    () => selections.filter((selection) => !selectedSnapshotId || selection.snapshot_id === selectedSnapshotId),
    [selectedSnapshotId, selections]
  );

  const visibleDocuments = useMemo(
    () => documents.filter((document) => !selectedSnapshotId || !document.snapshot_id || document.snapshot_id === selectedSnapshotId),
    [documents, selectedSnapshotId]
  );

  const filteredRfis = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rfis.filter((rfi) => {
      const status = displayStatus(rfi);
      if (selectedSnapshotId && rfi.snapshot_id !== selectedSnapshotId) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (priorityFilter !== "all" && rfi.priority !== priorityFilter) return false;
      if (!term) return true;
      return [rfi.rfi_number, rfi.subject, rfi.question, rfi.answer, rfi.asked_by_name, rfi.asked_by_email, rfi.source_quote_row_id, rfi.metadata?.assignedTo, rfi.metadata?.notes, rfi.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [priorityFilter, rfis, search, selectedSnapshotId, statusFilter]);

  const groupedRfis = useMemo(() => {
    const groups = new Map(STATUS_OPTIONS.map((status) => [status.value, []]));
    filteredRfis.forEach((rfi) => {
      const status = displayStatus(rfi);
      if (!groups.has(status)) groups.set(status, []);
      groups.get(status).push(rfi);
    });
    return Array.from(groups.entries())
      .map(([status, rows]) => ({ status, rows }))
      .filter((group) => group.rows.length || statusFilter === "all");
  }, [filteredRfis, statusFilter]);

  const summary = useMemo(() => {
    return filteredRfis.reduce(
      (totals, rfi) => {
        totals.count += 1;
        if (isOverdue(rfi)) totals.overdue += 1;
        if (rfi.priority === "urgent") totals.urgent += 1;
        if (["answered", "closed"].includes(displayStatus(rfi))) totals.answered += 1;
        return totals;
      },
      { count: 0, overdue: 0, urgent: 0, answered: 0 }
    );
  }, [filteredRfis]);

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "sourceQuoteRowId") {
        const source = visibleBoqItems.find((item) => item.source_quote_row_id === value || item.id === value);
        if (source) {
          next.title = next.title || `RFI - ${source.item_name || source.description || "BOQ item"}`;
        }
      }
      return next;
    });
  }

  async function createRfi() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating an RFI.");
      return;
    }
    if (!selectedProjectId) {
      setError("Select a commercial project first.");
      return;
    }
    if (!form.rfiNumber.trim() || !form.title.trim() || !form.question.trim()) {
      setError("RFI number, title and question are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const source = form.sourceQuoteRowId
      ? visibleBoqItems.find((item) => item.source_quote_row_id === form.sourceQuoteRowId || item.id === form.sourceQuoteRowId)
      : null;
    const status = statusOption(form.status);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId || null,
      boq_item_id: source?.id || null,
      client_selection_id: form.selectionId || null,
      source_quote_row_id: source?.source_quote_row_id || form.sourceQuoteRowId.trim() || null,
      rfi_number: form.rfiNumber.trim(),
      subject: form.title.trim(),
      question: form.question.trim(),
      answer: form.response.trim(),
      status: status.db,
      priority: form.priority,
      asked_by_name: form.requestedBy.trim(),
      asked_by_email: form.requestedByEmail.trim(),
      assigned_to: null,
      due_date: form.requiredResponseDate || null,
      answered_at: ["answered", "closed"].includes(form.status) && form.responseDate ? new Date(`${form.responseDate}T00:00:00`).toISOString() : null,
      closed_at: form.status === "closed" ? new Date().toISOString() : null,
      metadata: {
        uiStatus: form.status,
        assignedTo: form.assignedTo.trim(),
        responseDate: form.responseDate || null,
        relatedVariationId: form.variationId || null,
        relatedSelectionId: form.selectionId || null,
        relatedDocumentId: form.documentId || null,
        notes: form.notes.trim(),
        source: "builders_rfis_page",
      },
      notes: form.notes.trim(),
      created_by: userId,
      updated_by: userId,
    };

    const { data, error: insertError } = await supabase
      .from("builder_rfis")
      .insert(payload)
      .select("id, snapshot_id, boq_item_id, client_selection_id, source_quote_row_id, rfi_number, subject, question, answer, status, priority, asked_by_name, asked_by_email, due_date, answered_at, closed_at, metadata, notes, created_at, updated_at")
      .single();

    if (insertError) {
      setError(insertError.message || "Could not create RFI.");
    } else {
      setRfis((current) => [data, ...current]);
      setForm({ ...initialForm, rfiNumber: nextRfiNumber([data, ...rfis]), requestedBy: selectedProject?.client_name || "", requestedByEmail: selectedProject?.client_email || "" });
      setSuccess(`RFI ${data.rfi_number} created.`);
    }
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>RFIs / Client Questions</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>RFI / Client Questions</h1>
            <p style={styles.subtitle}>Track questions, clarifications and client responses without modifying the estimate snapshot.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/document-vault" style={styles.secondaryLink}>Document Vault</Link>
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
                <option key={project.id} value={project.id}>{project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Estimate snapshot optional</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} style={styles.select}>
              <option value="">All / project level</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}</option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Priority</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={styles.select}>
              <option value="all">All priorities</option>
              {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search RFI number, question, answer..." style={styles.input} />
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}

        <section style={styles.snapshotNote}>
          <strong>Commercial rule:</strong>
          <span>RFI records are clarification records and do not modify the estimate snapshot.</span>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedSnapshotId ? "Snapshot filtered" : "Project level"} />
          <SummaryCard label="RFIs" value={summary.count} helper="Visible records" />
          <SummaryCard label="Answered / closed" value={summary.answered} helper="Resolved records" emphasis />
          <SummaryCard label="Urgent" value={summary.urgent} helper="Urgent priority" danger={summary.urgent > 0} />
          <SummaryCard label="Overdue" value={summary.overdue} helper="Past response due date" danger={summary.overdue > 0} />
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create RFI / question</h2>
                <p style={styles.panelText}>Link questions to BOQ rows, variations, selections or documents where useful.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>RFI number</span>
                <input value={form.rfiNumber} onChange={(event) => updateForm("rfiNumber", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Title</span>
                <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Question</span>
                <textarea value={form.question} onChange={(event) => updateForm("question", event.target.value)} rows={4} style={styles.textarea} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Requested by</span>
                <input value={form.requestedBy} onChange={(event) => updateForm("requestedBy", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Requested by email</span>
                <input value={form.requestedByEmail} onChange={(event) => updateForm("requestedByEmail", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Assigned to</span>
                <input value={form.assignedTo} onChange={(event) => updateForm("assignedTo", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Priority</span>
                <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value)} style={styles.select}>
                  {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Required response date</span>
                <input type="date" value={form.requiredResponseDate} onChange={(event) => updateForm("requiredResponseDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Response date</span>
                <input type="date" value={form.responseDate} onChange={(event) => updateForm("responseDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Response / answer</span>
                <textarea value={form.response} onChange={(event) => updateForm("response", event.target.value)} rows={4} style={styles.textarea} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related BOQ row optional</span>
                <select value={form.sourceQuoteRowId} onChange={(event) => updateForm("sourceQuoteRowId", event.target.value)} style={styles.select}>
                  <option value="">No BOQ row</option>
                  {visibleBoqItems.map((item) => <option key={item.id} value={item.source_quote_row_id || item.id}>{item.source_quote_row_id || item.id} - {item.item_name || item.description}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related variation optional</span>
                <select value={form.variationId} onChange={(event) => updateForm("variationId", event.target.value)} style={styles.select}>
                  <option value="">No variation</option>
                  {visibleVariations.map((variation) => <option key={variation.id} value={variation.id}>{variation.variation_number} - {variation.title}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related selection optional</span>
                <select value={form.selectionId} onChange={(event) => updateForm("selectionId", event.target.value)} style={styles.select}>
                  <option value="">No selection</option>
                  {visibleSelections.map((selection) => <option key={selection.id} value={selection.id}>{titleCase(selection.category)} - {selection.title}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Related document optional</span>
                <select value={form.documentId} onChange={(event) => updateForm("documentId", event.target.value)} style={styles.select}>
                  <option value="">No document</option>
                  {visibleDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
                </select>
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} style={styles.textarea} />
              </label>
            </div>

            <button type="button" onClick={createRfi} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create RFI"}
            </button>
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>RFIs by status</h2>
                <p style={styles.panelText}>Overdue RFIs are highlighted by required response date.</p>
              </div>
              <span style={styles.readOnlyPill}>{filteredRfis.length} RFI{filteredRfis.length === 1 ? "" : "s"}</span>
            </div>

            {!filteredRfis.length ? <div style={styles.empty}>No RFIs found for this project/filter.</div> : null}

            <div style={styles.groupList}>
              {groupedRfis.map((group) => (
                <section key={group.status} style={styles.group}>
                  <div style={styles.groupHeader}>
                    <h3 style={styles.groupTitle}>{titleCase(group.status)}</h3>
                    <span>{group.rows.length}</span>
                  </div>
                  {group.rows.map((rfi) => {
                    const overdue = isOverdue(rfi);
                    const status = displayStatus(rfi);
                    return (
                      <article key={rfi.id} style={{ ...styles.rfiCard, ...(overdue ? styles.overdueCard : {}) }}>
                        <div style={styles.cardHeader}>
                          <div>
                            <h4 style={styles.cardTitle}>{rfi.rfi_number} - {rfi.subject}</h4>
                            <p style={styles.cardMeta}>{rfi.asked_by_name || "Unknown requester"}{rfi.source_quote_row_id ? ` - ${rfi.source_quote_row_id}` : ""}</p>
                          </div>
                          <span style={{ ...styles.statusPill, ...priorityStyle(rfi.priority, overdue) }}>{overdue ? "Overdue" : titleCase(rfi.priority)}</span>
                        </div>
                        <p style={styles.questionText}>{rfi.question}</p>
                        {rfi.answer ? <p style={styles.answerText}>{rfi.answer}</p> : null}
                        <div style={styles.detailGrid}>
                          <span>Status: {titleCase(status)}</span>
                          <span>Assigned: {rfi.metadata?.assignedTo || "-"}</span>
                          <span>Due: {rfi.due_date || "-"}</span>
                          <span>Response: {rfi.metadata?.responseDate || dateOnly(rfi.answered_at) || "-"}</span>
                          <span>Variation: {rfi.metadata?.relatedVariationId ? "Linked" : "-"}</span>
                          <span>Document: {rfi.metadata?.relatedDocumentId ? "Linked" : "-"}</span>
                        </div>
                        {rfi.notes ? <p style={styles.notes}>{rfi.notes}</p> : null}
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

function statusOption(value) {
  return STATUS_OPTIONS.find((status) => status.value === value) || STATUS_OPTIONS[1];
}

function displayStatus(rfi) {
  return rfi?.metadata?.uiStatus || fromDbStatus(rfi?.status);
}

function fromDbStatus(status) {
  return status || "open";
}

function nextRfiNumber(existing = []) {
  const year = new Date().getFullYear();
  const max = existing.reduce((highest, rfi) => {
    const match = String(rfi.rfi_number || "").match(/RFI-\d{4}-(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `RFI-${year}-${String(max + 1).padStart(4, "0")}`;
}

function isOverdue(rfi) {
  const status = displayStatus(rfi);
  if (!rfi?.due_date || ["answered", "closed", "cancelled"].includes(status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${rfi.due_date}T00:00:00`) < today;
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

function priorityStyle(priority, overdue) {
  if (overdue || priority === "urgent") return { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" };
  if (priority === "high") return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
  if (priority === "low") return { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" };
  return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
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
  rfiCard: { padding: 13, borderBottom: "1px solid #e2e8f0", background: "#ffffff" },
  overdueCard: { background: "#fff1f2" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  cardMeta: { margin: "3px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  questionText: { margin: "9px 0", color: "#334155", fontSize: 14, fontWeight: 700 },
  answerText: { margin: "9px 0", color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 9, fontSize: 14, fontWeight: 700 },
  detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, color: "#475569", fontSize: 13, fontWeight: 750 },
  notes: { margin: "10px 0 0", color: "#334155", fontSize: 14, fontWeight: 650 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

