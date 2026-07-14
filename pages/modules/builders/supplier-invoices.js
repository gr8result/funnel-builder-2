import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const GST_RATE = 10;

const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "draft" },
  { value: "received", label: "Received", db: "received" },
  { value: "approved", label: "Approved", db: "approved" },
  { value: "paid", label: "Paid", db: "paid" },
  { value: "disputed", label: "Disputed", db: "disputed" },
  { value: "cancelled", label: "Cancelled", db: "void" },
];

const initialInvoiceForm = {
  invoiceNumber: "",
  supplierId: "",
  supplierName: "",
  purchaseOrderId: "",
  invoiceDate: todayDate(),
  dueDate: "",
  status: "received",
  notes: "",
};

const emptyLineItem = {
  description: "",
  quantity: 1,
  unit: "ea",
  unitCost: 0,
  gstRate: GST_RATE,
  purchaseOrderItemId: "",
  sourceQuoteRowId: "",
};

export default function BuilderSupplierInvoicesPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [form, setForm] = useState(initialInvoiceForm);
  const [lineItems, setLineItems] = useState([{ ...emptyLineItem }]);
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
      setSuppliers([]);
      setPurchaseOrders([]);
      setPurchaseOrderItems([]);
      setInvoices([]);
      setInvoiceItems([]);
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [supplierResult, poResult, poItemResult, invoiceResult, invoiceItemResult] = await Promise.all([
        supabase
          .from("builder_suppliers")
          .select("id, name, email, phone, trade_category, status")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
        supabase
          .from("builder_purchase_orders")
          .select("id, snapshot_id, po_number, supplier_id, supplier_name, status, subtotal, gst_total, total, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_purchase_order_items")
          .select("id, purchase_order_id, snapshot_id, boq_item_id, procurement_item_id, source_quote_row_id, description, quantity_ordered, unit, unit_cost, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: true }),
        supabase
          .from("builder_supplier_invoices")
          .select("id, purchase_order_id, supplier_id, supplier_name, invoice_number, status, invoice_date, due_date, approved_at, paid_at, subtotal, gst_total, total, metadata, notes, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_supplier_invoice_items")
          .select("id, supplier_invoice_id, purchase_order_item_id, boq_item_id, source_quote_row_id, description, quantity, unit, unit_cost, gst_rate, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = supplierResult.error || poResult.error || poItemResult.error || invoiceResult.error || invoiceItemResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load supplier invoice data.");
        setSuppliers([]);
        setPurchaseOrders([]);
        setPurchaseOrderItems([]);
        setInvoices([]);
        setInvoiceItems([]);
      } else {
        setSuppliers(supplierResult.data || []);
        setPurchaseOrders(poResult.data || []);
        setPurchaseOrderItems(poItemResult.data || []);
        setInvoices(invoiceResult.data || []);
        setInvoiceItems(invoiceItemResult.data || []);
      }
      setLoading(false);
    }

    loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      invoiceNumber: current.invoiceNumber || nextInvoiceNumber(invoices),
      supplierId: selectedSupplierId || current.supplierId,
    }));
  }, [invoices, selectedSupplierId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );

  const purchaseOrderById = useMemo(
    () => new Map(purchaseOrders.map((po) => [po.id, po])),
    [purchaseOrders]
  );

  const poItemsByPoId = useMemo(() => {
    const map = new Map();
    purchaseOrderItems.forEach((item) => {
      const group = map.get(item.purchase_order_id) || [];
      group.push(item);
      map.set(item.purchase_order_id, group);
    });
    return map;
  }, [purchaseOrderItems]);

  const invoiceItemsByInvoiceId = useMemo(() => {
    const map = new Map();
    invoiceItems.forEach((item) => {
      const group = map.get(item.supplier_invoice_id) || [];
      group.push(item);
      map.set(item.supplier_invoice_id, group);
    });
    return map;
  }, [invoiceItems]);

  const visibleInvoices = useMemo(() => {
    if (!selectedSupplierId) return invoices;
    return invoices.filter((invoice) => invoice.supplier_id === selectedSupplierId);
  }, [invoices, selectedSupplierId]);

  const selectedSupplier = form.supplierId ? supplierById.get(form.supplierId) : null;
  const selectedPo = form.purchaseOrderId ? purchaseOrderById.get(form.purchaseOrderId) : null;
  const calculated = useMemo(() => calculateInvoiceItems(lineItems), [lineItems]);

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "supplierId") {
        const supplier = supplierById.get(value);
        next.supplierName = supplier?.name || next.supplierName;
        setSelectedSupplierId(value);
      }
      if (field === "purchaseOrderId") {
        const po = purchaseOrderById.get(value);
        next.supplierId = po?.supplier_id || next.supplierId;
        next.supplierName = po?.supplier_name || supplierById.get(po?.supplier_id)?.name || next.supplierName;
        if (po?.supplier_id) setSelectedSupplierId(po.supplier_id);
      }
      return next;
    });
  }

  function updateLineItem(index, field, value) {
    setLineItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "purchaseOrderItemId") {
        const poItem = purchaseOrderItems.find((row) => row.id === value);
        if (poItem) {
          next.description = poItem.description || next.description;
          next.quantity = poItem.quantity_ordered || next.quantity;
          next.unit = poItem.unit || next.unit;
          next.unitCost = poItem.unit_cost || next.unitCost;
          next.sourceQuoteRowId = poItem.source_quote_row_id || next.sourceQuoteRowId;
        }
      }
      return next;
    }));
  }

  function addLineItem() {
    setLineItems((current) => [...current, { ...emptyLineItem }]);
  }

  function removeLineItem(index) {
    setLineItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addPoItemsToInvoice() {
    const rows = poItemsByPoId.get(form.purchaseOrderId) || [];
    if (!rows.length) return;
    setLineItems(rows.map((row) => ({
      description: row.description || "",
      quantity: row.quantity_ordered || 1,
      unit: row.unit || "ea",
      unitCost: row.unit_cost || 0,
      gstRate: GST_RATE,
      purchaseOrderItemId: row.id,
      sourceQuoteRowId: row.source_quote_row_id || "",
    })));
  }

  async function createInvoice() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating an invoice.");
      return;
    }
    if (!selectedProjectId) {
      setError("Select a commercial project first.");
      return;
    }
    const supplierName = selectedSupplier?.name || form.supplierName.trim();
    if (!form.supplierId && !supplierName) {
      setError("Select a supplier or enter a supplier name.");
      return;
    }
    if (!form.invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    const items = calculated.items.filter((item) => item.description.trim());
    if (!items.length) {
      setError("Add at least one invoice line item.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const status = statusOption(form.status);
    const invoicePayload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      purchase_order_id: form.purchaseOrderId || null,
      supplier_id: form.supplierId || null,
      supplier_name: supplierName,
      invoice_number: form.invoiceNumber.trim(),
      status: status.db,
      invoice_date: form.invoiceDate || null,
      due_date: form.dueDate || null,
      approved_at: form.status === "approved" || form.status === "paid" ? new Date().toISOString() : null,
      paid_at: form.status === "paid" ? new Date().toISOString() : null,
      subtotal: calculated.subtotal,
      gst_total: calculated.gst,
      total: calculated.total,
      metadata: {
        uiStatus: form.status,
        source: "builders_supplier_invoices_page",
      },
      notes: form.notes.trim(),
      created_by: userId,
      updated_by: userId,
      approved_by: form.status === "approved" || form.status === "paid" ? userId : null,
    };

    const { data: insertedInvoice, error: invoiceError } = await supabase
      .from("builder_supplier_invoices")
      .insert(invoicePayload)
      .select("*")
      .single();

    if (invoiceError) {
      setSaving(false);
      setError(invoiceError.message || "Could not create supplier invoice.");
      return;
    }

    const itemPayloads = items.map((item) => {
      const poItem = item.purchaseOrderItemId ? purchaseOrderItems.find((row) => row.id === item.purchaseOrderItemId) : null;
      return {
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        supplier_invoice_id: insertedInvoice.id,
        purchase_order_item_id: item.purchaseOrderItemId || null,
        boq_item_id: poItem?.boq_item_id || null,
        source_quote_row_id: item.sourceQuoteRowId || null,
        description: item.description.trim(),
        quantity: item.quantity,
        unit: item.unit || null,
        unit_cost: item.unitCost,
        gst_rate: item.gstRate,
        line_total: item.lineTotal,
        status: form.status === "cancelled" ? "void" : form.status === "disputed" ? "disputed" : "active",
        metadata: {
          source: "builders_supplier_invoices_page",
          purchaseOrderNumber: selectedPo?.po_number || null,
        },
        created_by: userId,
      };
    });

    const { error: itemError } = await supabase
      .from("builder_supplier_invoice_items")
      .insert(itemPayloads);

    if (itemError) {
      await supabase.from("builder_supplier_invoices").delete().eq("workspace_id", workspaceId).eq("id", insertedInvoice.id);
      setSaving(false);
      setError(itemError.message || "Could not create supplier invoice line items.");
      return;
    }

    const { data: refreshedItems } = await supabase
      .from("builder_supplier_invoice_items")
      .select("id, supplier_invoice_id, purchase_order_item_id, boq_item_id, source_quote_row_id, description, quantity, unit, unit_cost, gst_rate, line_total, status, metadata")
      .eq("workspace_id", workspaceId)
      .eq("supplier_invoice_id", insertedInvoice.id)
      .order("created_at", { ascending: true });

    setInvoices((current) => [insertedInvoice, ...current]);
    setInvoiceItems((current) => [...current, ...(refreshedItems || [])]);
    setForm({
      ...initialInvoiceForm,
      invoiceNumber: nextInvoiceNumber([insertedInvoice, ...invoices]),
      supplierId: form.supplierId,
      supplierName,
      invoiceDate: todayDate(),
    });
    setLineItems([{ ...emptyLineItem }]);
    setSuccess(`Supplier invoice ${insertedInvoice.invoice_number} created and available to Budget vs Actual.`);
    setSaving(false);
  }

  const visibleTotals = useMemo(() => {
    return visibleInvoices.reduce(
      (totals, invoice) => {
        if (displayStatus(invoice) !== "cancelled") {
          totals.subtotal += numberValue(invoice.subtotal);
          totals.gst += numberValue(invoice.gst_total);
          totals.total += numberValue(invoice.total);
        }
        return totals;
      },
      { subtotal: 0, gst: 0, total: 0 }
    );
  }, [visibleInvoices]);

  return (
    <>
      <Head>
        <title>Supplier Invoices</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Supplier Invoices</h1>
            <p style={styles.subtitle}>Capture supplier invoice actuals against projects and purchase order lines for Budget vs Actual reporting.</p>
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
            <span style={styles.label}>Supplier filter</span>
            <select value={selectedSupplierId} onChange={(event) => setSelectedSupplierId(event.target.value)} style={styles.select}>
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedProject?.site_address || selectedProject?.client_name || ""} />
          <SummaryCard label="Invoice subtotal" value={money(visibleTotals.subtotal, selectedProject?.currency)} helper={`${visibleInvoices.length} invoice${visibleInvoices.length === 1 ? "" : "s"}`} />
          <SummaryCard label="Invoice total" value={money(visibleTotals.total, selectedProject?.currency)} helper="Feeds Budget vs Actual" emphasis />
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create supplier invoice</h2>
                <p style={styles.panelText}>Link to a purchase order or enter standalone invoice lines.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Invoice number</span>
                <input value={form.invoiceNumber} onChange={(event) => updateForm("invoiceNumber", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {INVOICE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Supplier</span>
                <select value={form.supplierId} onChange={(event) => updateForm("supplierId", event.target.value)} style={styles.select}>
                  <option value="">No existing supplier selected</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Supplier name</span>
                <input value={form.supplierName} onChange={(event) => updateForm("supplierName", event.target.value)} placeholder="Enter supplier if not in list" style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Link purchase order optional</span>
                <select value={form.purchaseOrderId} onChange={(event) => updateForm("purchaseOrderId", event.target.value)} style={styles.select}>
                  <option value="">No linked purchase order</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier_name || supplierById.get(po.supplier_id)?.name || "No supplier"} - {money(po.total, selectedProject?.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Invoice date</span>
                <input type="date" value={form.invoiceDate} onChange={(event) => updateForm("invoiceDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Due date</span>
                <input type="date" value={form.dueDate} onChange={(event) => updateForm("dueDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} style={styles.textarea} />
              </label>
            </div>

            <div style={styles.lineHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Invoice line items</h3>
                <p style={styles.panelText}>Optional PO item links keep actual costs traceable to committed costs.</p>
              </div>
              <div style={styles.lineActions}>
                <button type="button" onClick={addPoItemsToInvoice} disabled={!form.purchaseOrderId} style={styles.smallButton}>Use PO items</button>
                <button type="button" onClick={addLineItem} style={styles.smallButtonPrimary}>Add item</button>
              </div>
            </div>

            <div style={styles.lineItems}>
              {calculated.items.map((item, index) => (
                <div key={index} style={styles.lineItem}>
                  <label style={styles.fieldWide}>
                    <span style={styles.label}>Description</span>
                    <input value={lineItems[index].description} onChange={(event) => updateLineItem(index, "description", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>PO item</span>
                    <select value={lineItems[index].purchaseOrderItemId} onChange={(event) => updateLineItem(index, "purchaseOrderItemId", event.target.value)} style={styles.select}>
                      <option value="">No PO item</option>
                      {purchaseOrderItems.map((poItem) => (
                        <option key={poItem.id} value={poItem.id}>
                          {purchaseOrderById.get(poItem.purchase_order_id)?.po_number || "PO"} - {poItem.description}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Source row</span>
                    <input value={lineItems[index].sourceQuoteRowId} onChange={(event) => updateLineItem(index, "sourceQuoteRowId", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Qty</span>
                    <input type="number" step="0.0001" value={lineItems[index].quantity} onChange={(event) => updateLineItem(index, "quantity", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Unit</span>
                    <input value={lineItems[index].unit} onChange={(event) => updateLineItem(index, "unit", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Unit cost</span>
                    <input type="number" step="0.01" value={lineItems[index].unitCost} onChange={(event) => updateLineItem(index, "unitCost", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>GST %</span>
                    <input type="number" step="0.01" value={lineItems[index].gstRate} onChange={(event) => updateLineItem(index, "gstRate", event.target.value)} style={styles.input} />
                  </label>

                  <div style={styles.lineTotals}>
                    <MiniTotal label="GST" value={money(item.gst, selectedProject?.currency)} />
                    <MiniTotal label="Total" value={money(item.total, selectedProject?.currency)} />
                  </div>

                  <button type="button" onClick={() => removeLineItem(index)} style={styles.removeButton} disabled={lineItems.length === 1}>Remove</button>
                </div>
              ))}
            </div>

            <div style={styles.totalBox}>
              <MiniTotal label="Subtotal" value={money(calculated.subtotal, selectedProject?.currency)} />
              <MiniTotal label="GST" value={money(calculated.gst, selectedProject?.currency)} />
              <MiniTotal label="Total" value={money(calculated.total, selectedProject?.currency)} />
            </div>

            <button type="button" onClick={createInvoice} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create Supplier Invoice"}
            </button>
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Existing invoices</h2>
                <p style={styles.panelText}>These actual costs feed Budget vs Actual.</p>
              </div>
              <span style={styles.readOnlyPill}>{visibleInvoices.length} invoice{visibleInvoices.length === 1 ? "" : "s"}</span>
            </div>

            {!visibleInvoices.length ? <div style={styles.empty}>No supplier invoices found for this project/filter.</div> : null}

            <div style={styles.invoiceList}>
              {visibleInvoices.map((invoice) => {
                const rows = invoiceItemsByInvoiceId.get(invoice.id) || [];
                const uiStatus = displayStatus(invoice);
                return (
                  <article key={invoice.id} style={styles.invoiceCard}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{invoice.invoice_number}</h3>
                        <p style={styles.cardMeta}>{invoice.supplier_name || supplierById.get(invoice.supplier_id)?.name || "No supplier"} - {rows.length} item{rows.length === 1 ? "" : "s"}</p>
                      </div>
                      <span style={{ ...styles.statusPill, ...statusStyle(uiStatus) }}>{titleCase(uiStatus)}</span>
                    </div>
                    <div style={styles.cardTotals}>
                      <MiniTotal label="Subtotal" value={money(invoice.subtotal, selectedProject?.currency)} />
                      <MiniTotal label="GST" value={money(invoice.gst_total, selectedProject?.currency)} />
                      <MiniTotal label="Total" value={money(invoice.total, selectedProject?.currency)} />
                    </div>
                    <div style={styles.cardLines}>
                      {rows.slice(0, 4).map((row) => (
                        <div key={row.id} style={styles.cardLine}>
                          <span>{row.description}</span>
                          <strong>{money(row.line_total, selectedProject?.currency)}</strong>
                        </div>
                      ))}
                      {rows.length > 4 ? <small style={styles.moreText}>+ {rows.length - 4} more item{rows.length - 4 === 1 ? "" : "s"}</small> : null}
                    </div>
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

function calculateInvoiceItems(items) {
  const calculated = items.map((item) => {
    const quantity = numberValue(item.quantity);
    const unitCost = numberValue(item.unitCost);
    const gstRate = numberValue(item.gstRate);
    const lineTotal = roundMoney(quantity * unitCost);
    const gst = roundMoney(lineTotal * (gstRate / 100));
    return { ...item, quantity, unitCost, gstRate, lineTotal, gst, total: roundMoney(lineTotal + gst) };
  });
  const subtotal = roundMoney(calculated.reduce((sum, item) => sum + item.lineTotal, 0));
  const gst = roundMoney(calculated.reduce((sum, item) => sum + item.gst, 0));
  return { items: calculated, subtotal, gst, total: roundMoney(subtotal + gst) };
}

function nextInvoiceNumber(existing = []) {
  const year = new Date().getFullYear();
  const max = existing.reduce((highest, invoice) => {
    const match = String(invoice.invoice_number || "").match(/INV-\d{4}-(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `INV-${year}-${String(max + 1).padStart(4, "0")}`;
}

function displayStatus(invoice) {
  return invoice?.metadata?.uiStatus || fromDbStatus(invoice?.status);
}

function fromDbStatus(status) {
  if (status === "void") return "cancelled";
  return status || "draft";
}

function statusOption(value) {
  return INVOICE_STATUS_OPTIONS.find((option) => option.value === value) || INVOICE_STATUS_OPTIONS[0];
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
  if (status === "approved" || status === "paid") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
  if (status === "received") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (status === "disputed") return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
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
  subtitle: { margin: 0, color: "#cbd5e1", fontSize: 15, maxWidth: 720 },
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
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  workspaceGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(340px, 0.8fr)", gap: 16, alignItems: "start" },
  panel: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  lineHeader: { marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  lineActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  smallButton: { background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 8, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  smallButtonPrimary: { background: "#0f172a", border: "1px solid #0f172a", color: "#ffffff", borderRadius: 8, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  lineItems: { display: "flex", flexDirection: "column", gap: 12, marginTop: 12 },
  lineItem: { border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10 },
  lineTotals: { gridColumn: "1 / span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  removeButton: { alignSelf: "end", background: "#ffffff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800, cursor: "pointer" },
  totalBox: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4 },
  createButton: { width: "100%", marginTop: 14, background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a", borderRadius: 8, padding: "12px 14px", fontWeight: 900, cursor: "pointer" },
  disabledButton: { opacity: 0.55, cursor: "not-allowed" },
  readOnlyPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  invoiceList: { display: "flex", flexDirection: "column", gap: 12 },
  invoiceCard: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#ffffff" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  cardMeta: { margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  cardTotals: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 },
  cardLines: { marginTop: 12, borderTop: "1px solid #e2e8f0" },
  cardLine: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 700 },
  moreText: { display: "block", marginTop: 8, color: "#64748b", fontWeight: 800 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

