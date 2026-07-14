import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const STATUS_OPTIONS = [
  "not_started",
  "quote_required",
  "ready_to_order",
  "ordered",
  "partially_delivered",
  "delivered",
  "delayed",
  "cancelled",
];

export default function BuilderProcurementSchedulePage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [procurementItems, setProcurementItems] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const [loading, setLoading] = useState(false);
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
        setSelectedSnapshotId((current) => rows.find((snapshot) => snapshot.id === current)?.id || rows[0]?.id || "");
      }
      setLoading(false);
    }

    loadSnapshots();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) {
      setProcurementItems([]);
      setBoqItems([]);
      setPurchaseOrders([]);
      setPurchaseOrderItems([]);
      setSuppliers([]);
      setDrafts({});
      return;
    }

    let cancelled = false;
    async function loadSchedule() {
      setLoading(true);
      setError("");
      const [procurementResult, boqResult, poResult, poItemResult, supplierResult] = await Promise.all([
        supabase
          .from("builder_procurement_items")
          .select("id, boq_item_id, supplier_id, source_quote_row_id, source_procurement_item_id, item_name, description, section_name, procurement_category, quantity, unit, estimated_rate, estimated_total, required_by, order_by, order_status, delivery_status, status, source_item, metadata, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("required_by", { ascending: true, nullsFirst: false }),
        supabase
          .from("builder_boq_items")
          .select("id, source_quote_row_id, source_section_name, item_name, description, quantity, unit, line_total, status")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_purchase_orders")
          .select("id, snapshot_id, po_number, supplier_id, supplier_name, status, required_by, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_purchase_order_items")
          .select("id, purchase_order_id, snapshot_id, boq_item_id, procurement_item_id, source_quote_row_id, description, quantity_ordered, unit, unit_cost, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_suppliers")
          .select("id, name, email, phone, trade_category, status")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = procurementResult.error || boqResult.error || poResult.error || poItemResult.error || supplierResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load procurement schedule.");
        setProcurementItems([]);
        setBoqItems([]);
        setPurchaseOrders([]);
        setPurchaseOrderItems([]);
        setSuppliers([]);
      } else {
        const procurementRows = procurementResult.data || [];
        setProcurementItems(procurementRows);
        setBoqItems(boqResult.data || []);
        setPurchaseOrders(poResult.data || []);
        setPurchaseOrderItems(poItemResult.data || []);
        setSuppliers(supplierResult.data || []);
        setDrafts(Object.fromEntries(procurementRows.map((item) => [item.id, draftFromItem(item)])));
      }
      setLoading(false);
    }

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId, selectedSnapshotId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null,
    [snapshots, selectedSnapshotId]
  );

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );

  const boqById = useMemo(
    () => new Map(boqItems.map((item) => [item.id, item])),
    [boqItems]
  );

  const poById = useMemo(
    () => new Map(purchaseOrders.map((po) => [po.id, po])),
    [purchaseOrders]
  );

  const poLinkByProcurementId = useMemo(() => {
    const map = new Map();
    purchaseOrderItems.forEach((item) => {
      if (item.procurement_item_id && !map.has(item.procurement_item_id)) map.set(item.procurement_item_id, item);
    });
    return map;
  }, [purchaseOrderItems]);

  const poLinkByQuoteRowId = useMemo(() => {
    const map = new Map();
    purchaseOrderItems.forEach((item) => {
      if (item.source_quote_row_id && !map.has(item.source_quote_row_id)) map.set(item.source_quote_row_id, item);
    });
    return map;
  }, [purchaseOrderItems]);

  const enrichedItems = useMemo(() => {
    return procurementItems.map((item) => {
      const draft = drafts[item.id] || draftFromItem(item);
      const boq = item.boq_item_id ? boqById.get(item.boq_item_id) : null;
      const poItem = poLinkByProcurementId.get(item.id) || poLinkByQuoteRowId.get(item.source_quote_row_id) || null;
      const po = poItem ? poById.get(poItem.purchase_order_id) : null;
      const scheduleStatus = draft.scheduleStatus || scheduleStatusForItem(item);
      return {
        ...item,
        draft,
        boq,
        po,
        poItem,
        scheduleStatus,
        supplierName: supplierById.get(item.supplier_id)?.name || item.metadata?.supplier || item.source_item?.supplier || item.procurement_category || "No supplier/source",
        description: item.description || item.item_name || boq?.description || boq?.item_name || "Untitled procurement item",
        isOverdue: isOverdue(draft.requiredBy, scheduleStatus),
        isDelayed: scheduleStatus === "delayed",
      };
    });
  }, [boqById, drafts, poById, poLinkByProcurementId, poLinkByQuoteRowId, procurementItems, supplierById]);

  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      if (supplierFilter !== "all" && String(item.supplier_id || item.supplierName) !== supplierFilter) return false;
      if (statusFilter !== "all" && item.scheduleStatus !== statusFilter) return false;
      if (dateFrom && (item.draft.requiredBy || "") < dateFrom) return false;
      if (dateTo && (item.draft.requiredBy || "") > dateTo) return false;
      return true;
    });
  }, [dateFrom, dateTo, enrichedItems, statusFilter, supplierFilter]);

  const summary = useMemo(() => {
    return enrichedItems.reduce(
      (totals, item) => {
        totals.count += 1;
        if (item.isOverdue) totals.overdue += 1;
        if (item.isDelayed) totals.delayed += 1;
        if (item.po) totals.linkedPo += 1;
        if (item.scheduleStatus === "delivered") totals.delivered += 1;
        return totals;
      },
      { count: 0, overdue: 0, delayed: 0, linkedPo: 0, delivered: 0 }
    );
  }, [enrichedItems]);

  function updateDraft(id, field, value) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }));
  }

  async function saveItem(item) {
    if (!workspaceId) return;
    const draft = drafts[item.id] || draftFromItem(item);
    const statusMapping = dbStatusForSchedule(draft.scheduleStatus);
    setSavingId(item.id);
    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const payload = {
      required_by: draft.requiredBy || null,
      order_by: draft.orderBy || null,
      order_status: statusMapping.order_status,
      delivery_status: statusMapping.delivery_status,
      status: statusMapping.status,
      metadata: {
        ...(item.metadata || {}),
        scheduleStatus: draft.scheduleStatus,
        expectedDeliveryDate: draft.expectedDeliveryDate || null,
        actualDeliveryDate: draft.actualDeliveryDate || null,
        scheduleNotes: draft.notes || "",
      },
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("builder_procurement_items")
      .update(payload)
      .eq("workspace_id", workspaceId)
      .eq("id", item.id)
      .select("id, boq_item_id, supplier_id, source_quote_row_id, source_procurement_item_id, item_name, description, section_name, procurement_category, quantity, unit, estimated_rate, estimated_total, required_by, order_by, order_status, delivery_status, status, source_item, metadata, updated_at")
      .single();

    if (updateError) {
      setError(updateError.message || "Could not update procurement schedule item.");
    } else {
      setProcurementItems((current) => current.map((row) => row.id === item.id ? data : row));
      setDrafts((current) => ({ ...current, [item.id]: draftFromItem(data) }));
      setSuccess(`Updated procurement schedule for ${data.item_name || data.description || "item"}.`);
    }
    setSavingId("");
  }

  return (
    <>
      <Head>
        <title>Procurement Schedule</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Procurement Schedule</h1>
            <p style={styles.subtitle}>Track ordering and delivery dates from synced procurement snapshot items without changing BOQ pricing.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/purchase-orders" style={styles.secondaryLink}>Purchase Orders</Link>
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

          <label style={styles.field}>
            <span style={styles.label}>Supplier</span>
            <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} style={styles.select}>
              <option value="all">All suppliers/sources</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              <option value="No supplier/source">No supplier/source</option>
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Required from</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={styles.input} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Required to</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={styles.input} />
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}
        {!workspaceLoading && !workspaceId ? <div style={styles.notice}>Choose an active workspace to manage the procurement schedule.</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedSnapshot ? `Snapshot ${selectedSnapshot.snapshot_number}` : "No snapshot"} />
          <SummaryCard label="Procurement items" value={summary.count} helper={`${filteredItems.length} currently visible`} />
          <SummaryCard label="Linked POs" value={summary.linkedPo} helper="Items with PO links" />
          <SummaryCard label="Overdue" value={summary.overdue} helper="Required date has passed" danger={summary.overdue > 0} />
          <SummaryCard label="Delayed" value={summary.delayed} helper="Marked delayed" danger={summary.delayed > 0} />
          <SummaryCard label="Delivered" value={summary.delivered} helper="Completed procurement" emphasis />
        </section>

        <section style={styles.tableShell}>
          <div style={styles.tableHeader}>
            <div>
              <h2 style={styles.panelTitle}>Schedule items</h2>
              <p style={styles.panelText}>Editing updates schedule fields on `builder_procurement_items` only. Original BOQ and snapshot pricing are untouched.</p>
            </div>
            {loading ? <span style={styles.loadingPill}>Loading...</span> : <span style={styles.editPill}>Schedule editable</span>}
          </div>

          {!filteredItems.length ? <div style={styles.empty}>No procurement items match this project/snapshot/filter.</div> : null}

          <div style={styles.tableScroller}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Item description</Th>
                  <Th>Supplier/source</Th>
                  <Th compact>Qty</Th>
                  <Th compact>Unit</Th>
                  <Th>Required by</Th>
                  <Th>Order by</Th>
                  <Th>Expected delivery</Th>
                  <Th>Actual delivery</Th>
                  <Th>Status</Th>
                  <Th>Linked PO</Th>
                  <Th>Notes</Th>
                  <Th compact>Action</Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const draft = item.draft;
                  return (
                    <tr key={item.id} style={item.isDelayed ? styles.delayedRow : item.isOverdue ? styles.overdueRow : undefined}>
                      <td style={styles.descriptionCell}>
                        <strong>{item.description}</strong>
                        <span>{item.section_name || item.boq?.source_section_name || item.source_quote_row_id || "Synced procurement item"}</span>
                      </td>
                      <td style={styles.cell}>{item.supplierName}</td>
                      <td style={styles.compactCell}>{formatNumber(item.quantity)}</td>
                      <td style={styles.compactCell}>{item.unit || "-"}</td>
                      <td style={styles.cell}><input type="date" value={draft.requiredBy} onChange={(event) => updateDraft(item.id, "requiredBy", event.target.value)} style={styles.tableInput} /></td>
                      <td style={styles.cell}><input type="date" value={draft.orderBy} onChange={(event) => updateDraft(item.id, "orderBy", event.target.value)} style={styles.tableInput} /></td>
                      <td style={styles.cell}><input type="date" value={draft.expectedDeliveryDate} onChange={(event) => updateDraft(item.id, "expectedDeliveryDate", event.target.value)} style={styles.tableInput} /></td>
                      <td style={styles.cell}><input type="date" value={draft.actualDeliveryDate} onChange={(event) => updateDraft(item.id, "actualDeliveryDate", event.target.value)} style={styles.tableInput} /></td>
                      <td style={styles.cell}>
                        <select value={draft.scheduleStatus} onChange={(event) => updateDraft(item.id, "scheduleStatus", event.target.value)} style={styles.tableSelect}>
                          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                        </select>
                      </td>
                      <td style={styles.cell}>
                        {item.po ? (
                          <div style={styles.poBadge}>
                            <strong>{item.po.po_number}</strong>
                            <span>{titleCase(displayPoStatus(item.po))}</span>
                          </div>
                        ) : (
                          <span style={styles.muted}>No PO</span>
                        )}
                      </td>
                      <td style={styles.notesCell}>
                        <textarea value={draft.notes} onChange={(event) => updateDraft(item.id, "notes", event.target.value)} rows={2} style={styles.tableTextarea} />
                      </td>
                      <td style={styles.compactCell}>
                        <button type="button" onClick={() => saveItem(item)} disabled={savingId === item.id} style={{ ...styles.saveButton, ...(savingId === item.id ? styles.disabledButton : {}) }}>
                          {savingId === item.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function draftFromItem(item) {
  return {
    requiredBy: item.required_by || "",
    orderBy: item.order_by || "",
    expectedDeliveryDate: item.metadata?.expectedDeliveryDate || "",
    actualDeliveryDate: item.metadata?.actualDeliveryDate || "",
    scheduleStatus: item.metadata?.scheduleStatus || scheduleStatusForItem(item),
    notes: item.metadata?.scheduleNotes || item.metadata?.notes || item.source_item?.notes || "",
  };
}

function scheduleStatusForItem(item) {
  if (item.metadata?.scheduleStatus) return item.metadata.scheduleStatus;
  if (item.status === "cancelled" || item.delivery_status === "cancelled") return "cancelled";
  if (item.status === "delivered" || item.delivery_status === "delivered") return "delivered";
  if (item.delivery_status === "partially_delivered" || item.delivery_status === "part_received") return "partially_delivered";
  if (item.status === "ordered" || item.order_status === "ordered") return "ordered";
  if (item.status === "quote_required") return "quote_required";
  if (item.order_status === "ready_to_order") return "ready_to_order";
  return "not_started";
}

function dbStatusForSchedule(status) {
  if (status === "cancelled") return { status: "cancelled", order_status: "cancelled", delivery_status: "cancelled" };
  if (status === "delivered") return { status: "delivered", order_status: "ordered", delivery_status: "delivered" };
  if (status === "partially_delivered") return { status: "ordered", order_status: "ordered", delivery_status: "partially_delivered" };
  if (status === "ordered" || status === "delayed") return { status: "ordered", order_status: "ordered", delivery_status: status === "delayed" ? "delayed" : "pending" };
  if (status === "quote_required") return { status: "active", order_status: "quote_required", delivery_status: "not_required_yet" };
  if (status === "ready_to_order") return { status: "active", order_status: "ready_to_order", delivery_status: "not_required_yet" };
  return { status: "active", order_status: "not_started", delivery_status: "not_required_yet" };
}

function displayPoStatus(po) {
  const uiStatus = po?.metadata?.uiStatus;
  if (uiStatus) return uiStatus;
  if (po?.status === "part_received") return "partially_delivered";
  if (po?.status === "received") return "delivered";
  return po?.status || "draft";
}

function isOverdue(dateValue, status) {
  if (!dateValue || ["delivered", "cancelled"].includes(status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateValue}T00:00:00`);
  return date < today;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(number);
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function Th({ children, compact = false }) {
  return <th style={{ ...styles.th, ...(compact ? styles.compactTh : {}) }}>{children}</th>;
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
  controls: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  label: { color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  success: { marginTop: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  summaryCardDanger: { borderColor: "#fecaca", background: "#fff1f2" },
  tableShell: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  loadingPill: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  editPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  tableScroller: { width: "100%", overflowX: "auto" },
  table: { width: "100%", minWidth: 1480, borderCollapse: "collapse" },
  th: { background: "#f8fafc", color: "#334155", borderBottom: "1px solid #e2e8f0", padding: "10px 11px", textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  compactTh: { width: 90 },
  descriptionCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", minWidth: 250, verticalAlign: "top" },
  cell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", minWidth: 130, verticalAlign: "top", fontWeight: 700 },
  compactCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: 800 },
  notesCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", minWidth: 220, verticalAlign: "top" },
  overdueRow: { background: "#fff7ed" },
  delayedRow: { background: "#fff1f2" },
  tableInput: { width: "100%", minWidth: 120, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 9px", fontWeight: 700 },
  tableSelect: { width: "100%", minWidth: 150, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 9px", fontWeight: 700, background: "#ffffff" },
  tableTextarea: { width: "100%", minWidth: 210, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 9px", fontWeight: 700, resize: "vertical" },
  poBadge: { display: "flex", flexDirection: "column", gap: 3, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "7px 9px" },
  muted: { color: "#94a3b8", fontWeight: 800 },
  saveButton: { background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
};

