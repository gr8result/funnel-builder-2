import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const PO_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "draft" },
  { value: "issued", label: "Issued", db: "issued" },
  { value: "confirmed", label: "Confirmed", db: "issued" },
  { value: "partially_delivered", label: "Partially Delivered", db: "part_received" },
  { value: "delivered", label: "Delivered", db: "received" },
  { value: "cancelled", label: "Cancelled", db: "cancelled" },
];

const GST_RATE = 10;

const initialPoForm = {
  poNumber: "",
  status: "draft",
  supplierId: "",
  supplierName: "",
  issueDate: todayDate(),
  requiredBy: "",
  deliveryAddress: "",
  notes: "",
};

export default function BuilderPurchaseOrdersPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [procurementItems, setProcurementItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialPoForm);
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
      setSelectedSnapshotId("");
      setPurchaseOrders([]);
      setPurchaseOrderItems([]);
      return;
    }
    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, poResult, poItemResult, supplierResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_purchase_orders")
          .select("id, po_number, supplier_id, supplier_name, status, issue_date, required_by, delivery_address, notes, subtotal, gst_total, total, metadata, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_purchase_order_items")
          .select("id, purchase_order_id, snapshot_id, boq_item_id, procurement_item_id, source_quote_row_id, source_procurement_item_id, description, quantity_ordered, quantity_received, unit, unit_cost, gst_rate, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: true }),
        supabase
          .from("builder_suppliers")
          .select("id, name, email, phone, trade_category, status")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || poResult.error || poItemResult.error || supplierResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load purchase order data.");
        setSnapshots([]);
        setPurchaseOrders([]);
        setPurchaseOrderItems([]);
        setSuppliers([]);
      } else {
        const snapshotRows = snapshotResult.data || [];
        setSnapshots(snapshotRows);
        setSelectedSnapshotId((current) => snapshotRows.find((snapshot) => snapshot.id === current)?.id || snapshotRows[0]?.id || "");
        setPurchaseOrders(poResult.data || []);
        setPurchaseOrderItems(poItemResult.data || []);
        setSuppliers(supplierResult.data || []);
      }
      setLoading(false);
    }
    loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) {
      setBoqItems([]);
      setProcurementItems([]);
      setSelectedItemKeys([]);
      return;
    }
    let cancelled = false;
    async function loadSnapshotItems() {
      setLoading(true);
      setError("");
      const [boqResult, procurementResult] = await Promise.all([
        supabase
          .from("builder_boq_items")
          .select("id, supplier_id, source_quote_row_id, source_excel_row, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, rate_source, line_type, cost_code, sort_order, status, source_row, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("builder_procurement_items")
          .select("id, boq_item_id, supplier_id, source_quote_row_id, source_procurement_item_id, item_name, description, section_name, procurement_category, quantity, unit, estimated_rate, estimated_total, required_by, order_by, order_status, delivery_status, status, source_item, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = boqResult.error || procurementResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load synced BOQ/procurement items.");
        setBoqItems([]);
        setProcurementItems([]);
      } else {
        setBoqItems(boqResult.data || []);
        setProcurementItems(procurementResult.data || []);
        setSelectedItemKeys([]);
      }
      setLoading(false);
    }
    loadSnapshotItems();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId, selectedSnapshotId]);

  useEffect(() => {
    const project = projects.find((row) => row.id === selectedProjectId);
    setForm((current) => ({
      ...current,
      poNumber: current.poNumber || nextPoNumber(purchaseOrders),
      deliveryAddress: current.deliveryAddress || project?.site_address || "",
    }));
  }, [projects, purchaseOrders, selectedProjectId]);

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

  const availableItems = useMemo(
    () => buildAvailableItems({ boqItems, procurementItems, supplierById }),
    [boqItems, procurementItems, supplierById]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableItems;
    return availableItems.filter((item) =>
      [
        item.description,
        item.sectionName,
        item.sourceQuoteRowId,
        item.sourceProcurementItemId,
        item.supplierName,
        item.sourceLabel,
        item.unit,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [availableItems, search]);

  const selectedItems = useMemo(() => {
    const selected = new Set(selectedItemKeys);
    return availableItems.filter((item) => selected.has(item.key));
  }, [availableItems, selectedItemKeys]);

  const groupedItems = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      const key = item.supplierId || item.supplierName || item.sourceLabel || "No supplier assigned";
      const group = groups.get(key) || { key, label: item.supplierName || item.sourceLabel || "No supplier assigned", items: [], total: 0 };
      group.items.push(item);
      group.total += item.totalCost;
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredItems]);

  const poItemsByPoId = useMemo(() => {
    const map = new Map();
    purchaseOrderItems.forEach((item) => {
      const group = map.get(item.purchase_order_id) || [];
      group.push(item);
      map.set(item.purchase_order_id, group);
    });
    return map;
  }, [purchaseOrderItems]);

  const selectedSupplier = form.supplierId ? supplierById.get(form.supplierId) : null;
  const selectedTotals = useMemo(() => calculateTotals(selectedItems), [selectedItems]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleItem(key) {
    setSelectedItemKeys((current) => current.includes(key) ? current.filter((itemKey) => itemKey !== key) : [...current, key]);
  }

  function selectGroup(groupItems) {
    const keys = groupItems.map((item) => item.key);
    setSelectedItemKeys((current) => Array.from(new Set([...current, ...keys])));
  }

  function clearSelection() {
    setSelectedItemKeys([]);
  }

  function applySupplierFromGroup(groupItems) {
    const firstWithSupplier = groupItems.find((item) => item.supplierId || item.supplierName);
    if (!firstWithSupplier) return;
    setForm((current) => ({
      ...current,
      supplierId: firstWithSupplier.supplierId || "",
      supplierName: firstWithSupplier.supplierName || current.supplierName,
    }));
  }

  async function createPurchaseOrder() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating a purchase order.");
      return;
    }
    if (!selectedProjectId || !selectedSnapshotId) {
      setError("Select a commercial project and estimate snapshot first.");
      return;
    }
    if (!selectedItems.length) {
      setError("Select at least one synced BOQ/procurement item.");
      return;
    }
    const supplierName = selectedSupplier?.name || form.supplierName.trim();
    if (!form.supplierId && !supplierName) {
      setError("Select an existing supplier or enter a supplier/source name.");
      return;
    }
    if (!form.poNumber.trim()) {
      setError("Enter a PO number.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const statusMapping = statusOption(form.status);
    const totals = calculateTotals(selectedItems);
    const poPayload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId,
      supplier_id: form.supplierId || null,
      po_number: form.poNumber.trim(),
      status: statusMapping.db,
      supplier_name: supplierName,
      supplier_email: selectedSupplier?.email || null,
      issue_date: form.issueDate || null,
      required_by: form.requiredBy || null,
      issued_at: statusMapping.db === "issued" ? new Date().toISOString() : null,
      subtotal: totals.subtotal,
      gst_total: totals.gst,
      total: totals.total,
      delivery_address: form.deliveryAddress.trim(),
      notes: form.notes.trim(),
      metadata: {
        uiStatus: form.status,
        source: "builders_purchase_orders_page",
        selectedItemCount: selectedItems.length,
      },
      created_by: userId,
      updated_by: userId,
    };

    const { data: insertedPo, error: poError } = await supabase
      .from("builder_purchase_orders")
      .insert(poPayload)
      .select("*")
      .single();

    if (poError) {
      setSaving(false);
      setError(poError.message || "Could not create purchase order.");
      return;
    }

    const itemPayloads = selectedItems.map((item) => ({
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      purchase_order_id: insertedPo.id,
      snapshot_id: selectedSnapshotId,
      boq_item_id: item.boqItemId || null,
      procurement_item_id: item.procurementItemId || null,
      source_quote_row_id: item.sourceQuoteRowId || null,
      source_procurement_item_id: item.sourceProcurementItemId || null,
      description: item.description || "Untitled purchase order item",
      quantity_ordered: item.quantity,
      quantity_received: 0,
      unit: item.unit || null,
      unit_cost: item.unitCost,
      gst_rate: GST_RATE,
      line_total: item.totalCost,
      status: form.status === "draft" ? "draft" : "ordered",
      metadata: {
        supplierName: item.supplierName,
        sourceLabel: item.sourceLabel,
        sectionName: item.sectionName,
        source: item.source,
      },
      created_by: userId,
    }));

    const { error: itemError } = await supabase
      .from("builder_purchase_order_items")
      .insert(itemPayloads);

    if (itemError) {
      await supabase.from("builder_purchase_orders").delete().eq("workspace_id", workspaceId).eq("id", insertedPo.id);
      setSaving(false);
      setError(itemError.message || "Could not create purchase order items.");
      return;
    }

    setPurchaseOrders((current) => [insertedPo, ...current]);
    const { data: refreshedItems } = await supabase
      .from("builder_purchase_order_items")
      .select("id, purchase_order_id, snapshot_id, boq_item_id, procurement_item_id, source_quote_row_id, source_procurement_item_id, description, quantity_ordered, quantity_received, unit, unit_cost, gst_rate, line_total, status, metadata")
      .eq("workspace_id", workspaceId)
      .eq("purchase_order_id", insertedPo.id)
      .order("created_at", { ascending: true });
    setPurchaseOrderItems((current) => [...current, ...(refreshedItems || [])]);
    setSelectedItemKeys([]);
    setForm({
      ...initialPoForm,
      poNumber: nextPoNumber([insertedPo, ...purchaseOrders]),
      deliveryAddress: selectedProject?.site_address || "",
      issueDate: todayDate(),
    });
    setSuccess(`Purchase order ${insertedPo.po_number} created with ${itemPayloads.length} item${itemPayloads.length === 1 ? "" : "s"}.`);
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Builder Purchase Orders</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Purchase Orders</h1>
            <p style={styles.subtitle}>Create supplier purchase orders from synced BOQ and procurement snapshot items.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/boq" style={styles.secondaryLink}>View BOQ Snapshot</Link>
            <Link href="/modules/estimate-builder" style={styles.primaryLink}>Back to Estimate Builder</Link>
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
            <span style={styles.label}>Search items</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, supplier, source row..." style={styles.input} />
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}
        {!workspaceLoading && !workspaceId ? <div style={styles.notice}>Choose an active workspace to create purchase orders.</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedProject?.site_address || selectedProject?.client_name || ""} />
          <SummaryCard label="Snapshot" value={selectedSnapshot ? `Version ${selectedSnapshot.snapshot_number}` : "No snapshot"} helper={selectedSnapshot?.source_quote_number || ""} />
          <SummaryCard label="Selected PO Total" value={money(selectedTotals.total, selectedProject?.currency)} helper={`${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"}`} emphasis />
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Available BOQ/procurement items</h2>
                <p style={styles.panelText}>Grouped by supplier/source where available. Items come from the selected synced snapshot.</p>
              </div>
              <button type="button" onClick={clearSelection} style={styles.textButton}>Clear selection</button>
            </div>

            {!loading && !filteredItems.length ? (
              <div style={styles.empty}>No synced BOQ/procurement items found for this snapshot or filter.</div>
            ) : null}

            {groupedItems.map((group) => (
              <div key={group.key} style={styles.group}>
                <div style={styles.groupHeader}>
                  <div>
                    <h3 style={styles.groupTitle}>{group.label}</h3>
                    <p style={styles.groupMeta}>{group.items.length} item{group.items.length === 1 ? "" : "s"} - {money(group.total, selectedProject?.currency)}</p>
                  </div>
                  <div style={styles.groupActions}>
                    <button type="button" onClick={() => applySupplierFromGroup(group.items)} style={styles.smallButton}>Use supplier</button>
                    <button type="button" onClick={() => selectGroup(group.items)} style={styles.smallButtonPrimary}>Select group</button>
                  </div>
                </div>
                <div style={styles.itemList}>
                  {group.items.map((item) => {
                    const checked = selectedItemKeys.includes(item.key);
                    return (
                      <label key={item.key} style={{ ...styles.itemRow, ...(checked ? styles.itemRowSelected : {}) }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleItem(item.key)} />
                        <span style={styles.itemMain}>
                          <strong>{item.description}</strong>
                          <small>{item.sectionName || item.sourceLabel} {item.sourceQuoteRowId ? `- ${item.sourceQuoteRowId}` : ""}</small>
                        </span>
                        <span style={styles.itemQty}>{formatNumber(item.quantity)} {item.unit || ""}</span>
                        <span style={styles.itemMoney}>{money(item.totalCost, selectedProject?.currency)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create purchase order</h2>
                <p style={styles.panelText}>Read-only source items, new commercial PO records.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>PO number</span>
                <input value={form.poNumber} onChange={(event) => updateForm("poNumber", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {PO_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Supplier</span>
                <select
                  value={form.supplierId}
                  onChange={(event) => {
                    const supplier = suppliers.find((row) => row.id === event.target.value);
                    setForm((current) => ({ ...current, supplierId: event.target.value, supplierName: supplier?.name || current.supplierName }));
                  }}
                  style={styles.select}
                >
                  <option value="">No existing supplier selected</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Supplier/source name</span>
                <input value={form.supplierName} onChange={(event) => updateForm("supplierName", event.target.value)} placeholder="Enter supplier if not in list" style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Issue date</span>
                <input type="date" value={form.issueDate} onChange={(event) => updateForm("issueDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Required by</span>
                <input type="date" value={form.requiredBy} onChange={(event) => updateForm("requiredBy", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Delivery address</span>
                <input value={form.deliveryAddress} onChange={(event) => updateForm("deliveryAddress", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} style={styles.textarea} rows={4} />
              </label>
            </div>

            <div style={styles.totalBox}>
              <MiniTotal label="Subtotal" value={money(selectedTotals.subtotal, selectedProject?.currency)} />
              <MiniTotal label="GST" value={money(selectedTotals.gst, selectedProject?.currency)} />
              <MiniTotal label="Total" value={money(selectedTotals.total, selectedProject?.currency)} />
            </div>

            <button type="button" onClick={createPurchaseOrder} disabled={saving || loading || !selectedItems.length} style={{ ...styles.createButton, ...((saving || loading || !selectedItems.length) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create Purchase Order"}
            </button>
          </aside>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Existing purchase orders</h2>
              <p style={styles.panelText}>Commercial purchase orders already created for the selected project.</p>
            </div>
            <span style={styles.readOnlyPill}>{purchaseOrders.length} PO{purchaseOrders.length === 1 ? "" : "s"}</span>
          </div>

          {!purchaseOrders.length ? <div style={styles.empty}>No purchase orders have been created for this project yet.</div> : null}

          <div style={styles.poGrid}>
            {purchaseOrders.map((po) => {
              const poItems = poItemsByPoId.get(po.id) || [];
              return (
                <article key={po.id} style={styles.poCard}>
                  <div style={styles.poCardHeader}>
                    <div>
                      <h3 style={styles.poTitle}>{po.po_number}</h3>
                      <p style={styles.poMeta}>{po.supplier_name || supplierById.get(po.supplier_id)?.name || "No supplier"} - {poItems.length} item{poItems.length === 1 ? "" : "s"}</p>
                    </div>
                    <span style={{ ...styles.statusPill, ...statusStyle(displayStatus(po)) }}>{titleCase(displayStatus(po))}</span>
                  </div>
                  <div style={styles.poFacts}>
                    <MiniTotal label="Subtotal" value={money(po.subtotal, selectedProject?.currency)} />
                    <MiniTotal label="GST" value={money(po.gst_total, selectedProject?.currency)} />
                    <MiniTotal label="Total" value={money(po.total, selectedProject?.currency)} />
                  </div>
                  <div style={styles.poLines}>
                    {poItems.slice(0, 4).map((item) => (
                      <div key={item.id} style={styles.poLine}>
                        <span>{item.description}</span>
                        <strong>{money(item.line_total, selectedProject?.currency)}</strong>
                      </div>
                    ))}
                    {poItems.length > 4 ? <small style={styles.moreText}>+ {poItems.length - 4} more item{poItems.length - 4 === 1 ? "" : "s"}</small> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

function buildAvailableItems({ boqItems, procurementItems, supplierById }) {
  const procurementByBoqId = new Map();
  const procurementByQuoteRow = new Map();
  procurementItems.forEach((item) => {
    if (item.boq_item_id && !procurementByBoqId.has(item.boq_item_id)) procurementByBoqId.set(item.boq_item_id, item);
    if (item.source_quote_row_id && !procurementByQuoteRow.has(item.source_quote_row_id)) procurementByQuoteRow.set(item.source_quote_row_id, item);
  });

  const rows = boqItems.map((boq) => {
    const procurement = procurementByBoqId.get(boq.id) || procurementByQuoteRow.get(boq.source_quote_row_id) || null;
    return normaliseSourceItem({ boq, procurement, supplierById });
  });

  const seenProcurementIds = new Set(rows.map((row) => row.procurementItemId).filter(Boolean));
  procurementItems.forEach((procurement) => {
    if (!seenProcurementIds.has(procurement.id)) {
      rows.push(normaliseSourceItem({ procurement, supplierById }));
    }
  });
  return rows.filter((row) => row.status !== "archived" && row.status !== "removed_from_quote");
}

function normaliseSourceItem({ boq = null, procurement = null, supplierById }) {
  const sourceRow = boq?.source_row || {};
  const supplierId = procurement?.supplier_id || boq?.supplier_id || "";
  const supplier = supplierId ? supplierById.get(supplierId) : null;
  const supplierName = supplier?.name || procurement?.metadata?.supplier || sourceRow.supplier || boq?.rate_source || "";
  const quantity = firstNumber(procurement?.quantity, boq?.quantity);
  const totalCost = firstNumber(procurement?.estimated_total, sourceRow.costTotal, sourceRow.totalCost, sourceRow.importedCost, sourceRow.cost, boq?.line_total);
  const unitCost = firstNumber(procurement?.estimated_rate, boq?.unit_rate, quantity ? totalCost / quantity : 0);
  const description = procurement?.description || procurement?.item_name || boq?.description || boq?.item_name || "Untitled item";
  return {
    key: `${boq?.id || "proc"}:${procurement?.id || boq?.source_quote_row_id || boq?.id}`,
    source: procurement && boq ? "boq_procurement" : procurement ? "procurement" : "boq",
    boqItemId: boq?.id || procurement?.boq_item_id || "",
    procurementItemId: procurement?.id || "",
    supplierId,
    supplierName,
    sourceQuoteRowId: procurement?.source_quote_row_id || boq?.source_quote_row_id || "",
    sourceProcurementItemId: procurement?.source_procurement_item_id || "",
    sectionName: procurement?.section_name || boq?.source_section_name || "",
    sourceLabel: supplierName || procurement?.procurement_category || boq?.rate_source || "No supplier assigned",
    description,
    quantity,
    unit: procurement?.unit || boq?.unit || "",
    unitCost,
    totalCost,
    status: procurement?.status || boq?.status || "active",
  };
}

function calculateTotals(items) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0));
  const gst = roundMoney(subtotal * (GST_RATE / 100));
  return { subtotal, gst, total: roundMoney(subtotal + gst) };
}

function nextPoNumber(existing = []) {
  const year = new Date().getFullYear();
  const max = existing.reduce((highest, po) => {
    const match = String(po.po_number || "").match(/PO-\d{4}-(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `PO-${year}-${String(max + 1).padStart(4, "0")}`;
}

function displayStatus(po) {
  return po?.metadata?.uiStatus || fromDbStatus(po?.status);
}

function fromDbStatus(status) {
  if (status === "part_received") return "partially_delivered";
  if (status === "received") return "delivered";
  if (status === "closed") return "delivered";
  return status || "draft";
}

function statusOption(value) {
  return PO_STATUS_OPTIONS.find((option) => option.value === value) || PO_STATUS_OPTIONS[0];
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(number);
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
  if (status === "issued" || status === "confirmed") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (status === "partially_delivered") return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
  if (status === "delivered") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
  if (status === "cancelled") return { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" };
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
  subtitle: { margin: 0, color: "#cbd5e1", fontSize: 15, maxWidth: 660 },
  heroActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  primaryLink: { background: "#ffffff", color: "#0f172a", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  secondaryLink: { background: "rgba(15, 23, 42, 0.35)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8, padding: "10px 14px", textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" },
  controls: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0, gridColumn: "1 / -1" },
  label: { color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  textarea: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700, resize: "vertical" },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  success: { marginTop: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  workspaceGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 0.65fr)", gap: 16, alignItems: "start" },
  panel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, marginTop: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  textButton: { background: "transparent", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 8, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  smallButton: { background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 8, padding: "7px 9px", fontWeight: 800, cursor: "pointer" },
  smallButtonPrimary: { background: "#0f172a", border: "1px solid #0f172a", color: "#ffffff", borderRadius: 8, padding: "7px 9px", fontWeight: 800, cursor: "pointer" },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  group: { border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginTop: 12 },
  groupHeader: { background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  groupTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  groupMeta: { margin: "3px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  groupActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  itemList: { display: "flex", flexDirection: "column" },
  itemRow: { display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) 120px 130px", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #e2e8f0", cursor: "pointer" },
  itemRowSelected: { background: "#eff6ff" },
  itemMain: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  itemQty: { color: "#334155", fontWeight: 800, textAlign: "right", whiteSpace: "nowrap" },
  itemMoney: { color: "#0f172a", fontWeight: 900, textAlign: "right", whiteSpace: "nowrap" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  totalBox: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4 },
  createButton: { width: "100%", marginTop: 14, background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: 8, padding: "12px 14px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  readOnlyPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  poGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  poCard: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#ffffff" },
  poCardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  poTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  poMeta: { margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  poFacts: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 },
  poLines: { marginTop: 12, borderTop: "1px solid #e2e8f0" },
  poLine: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 700 },
  moreText: { display: "block", marginTop: 8, color: "#64748b", fontWeight: 800 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

