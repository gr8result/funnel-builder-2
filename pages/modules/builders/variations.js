import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const GST_RATE = 10;

const VARIATION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", db: "draft" },
  { value: "sent", label: "Sent", db: "submitted" },
  { value: "approved", label: "Approved", db: "approved" },
  { value: "rejected", label: "Rejected", db: "rejected" },
  { value: "cancelled", label: "Cancelled", db: "void" },
];

const initialVariationForm = {
  variationNumber: "",
  title: "",
  clientName: "",
  reason: "",
  status: "draft",
  requestedDate: todayDate(),
  approvedDate: "",
  notes: "",
};

const emptyLineItem = {
  description: "",
  quantity: 1,
  unit: "ea",
  unitCost: 0,
  marginPercentage: 20,
  sellPrice: 0,
  sourceQuoteRowId: "",
};

export default function BuilderVariationsPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [variations, setVariations] = useState([]);
  const [variationItems, setVariationItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [form, setForm] = useState(initialVariationForm);
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
        .select("id, project_name, client_name, site_address, status, currency, original_estimate_total, contract_total, updated_at, created_at")
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
      setVariations([]);
      setVariationItems([]);
      return;
    }

    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, variationResult, itemResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_variations")
          .select("id, project_id, snapshot_id, variation_number, title, reason, status, subtotal, gst_total, total, margin_total, submitted_at, approved_at, approved_by_name, approved_by_email, metadata, notes, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_variation_items")
          .select("id, variation_id, snapshot_id, boq_item_id, source_quote_row_id, source_section_name, description, quantity, unit, unit_cost, unit_price, gst_rate, cost_total, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = snapshotResult.error || variationResult.error || itemResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load variations.");
        setSnapshots([]);
        setVariations([]);
        setVariationItems([]);
      } else {
        const snapshotRows = snapshotResult.data || [];
        setSnapshots(snapshotRows);
        setSelectedSnapshotId((current) => snapshotRows.find((snapshot) => snapshot.id === current)?.id || snapshotRows[0]?.id || "");
        setVariations(variationResult.data || []);
        setVariationItems(itemResult.data || []);
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
      return;
    }

    let cancelled = false;
    async function loadBoqItems() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_boq_items")
        .select("id, source_quote_row_id, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, sort_order")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .eq("snapshot_id", selectedSnapshotId)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load snapshot BOQ items.");
        setBoqItems([]);
      } else {
        setBoqItems(data || []);
      }
      setLoading(false);
    }

    loadBoqItems();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId, selectedSnapshotId]);

  useEffect(() => {
    const project = projects.find((row) => row.id === selectedProjectId);
    setForm((current) => ({
      ...current,
      variationNumber: current.variationNumber || nextVariationNumber(variations),
      clientName: current.clientName || project?.client_name || "",
    }));
  }, [projects, selectedProjectId, variations]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null,
    [snapshots, selectedSnapshotId]
  );

  const lineItemTotals = useMemo(() => calculateLineItems(lineItems), [lineItems]);

  const variationItemsByVariationId = useMemo(() => {
    const map = new Map();
    variationItems.forEach((item) => {
      const rows = map.get(item.variation_id) || [];
      rows.push(item);
      map.set(item.variation_id, rows);
    });
    return map;
  }, [variationItems]);

  const variationBuckets = useMemo(() => {
    return variations.reduce(
      (totals, variation) => {
        const uiStatus = displayStatus(variation);
        if (uiStatus === "approved") totals.approved += Number(variation.total || 0);
        if (uiStatus === "draft" || uiStatus === "sent") totals.pending += Number(variation.total || 0);
        if (uiStatus === "rejected" || uiStatus === "cancelled") totals.notProceeding += Number(variation.total || 0);
        return totals;
      },
      { approved: 0, pending: 0, notProceeding: 0 }
    );
  }, [variations]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLineItem(index, field, value) {
    setLineItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "unitCost" || field === "marginPercentage") {
        const unitCost = numberValue(field === "unitCost" ? value : next.unitCost);
        const margin = numberValue(field === "marginPercentage" ? value : next.marginPercentage);
        next.sellPrice = roundMoney(unitCost * (1 + margin / 100));
      }
      if (field === "sourceQuoteRowId") {
        const source = boqItems.find((row) => row.source_quote_row_id === value);
        if (source) {
          next.description = next.description || source.description || source.item_name || "";
          next.quantity = next.quantity || source.quantity || 1;
          next.unit = next.unit || source.unit || "";
          next.unitCost = next.unitCost || source.unit_rate || 0;
          next.sellPrice = next.sellPrice || source.unit_rate || 0;
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

  async function createVariation() {
    if (!workspaceId) {
      setError("Choose an active workspace before creating a variation.");
      return;
    }
    if (!selectedProjectId || !selectedSnapshotId) {
      setError("Select a commercial project and estimate snapshot first.");
      return;
    }
    if (!form.variationNumber.trim() || !form.title.trim()) {
      setError("Variation number and title are required.");
      return;
    }

    const calculatedItems = calculateLineItems(lineItems).items.filter((item) => item.description.trim());
    if (!calculatedItems.length) {
      setError("Add at least one variation line item.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const statusMapping = statusOption(form.status);
    const totals = calculateTotals(calculatedItems);
    const variationPayload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId,
      variation_number: form.variationNumber.trim(),
      title: form.title.trim(),
      reason: form.reason.trim(),
      status: statusMapping.db,
      subtotal: totals.sellSubtotal,
      gst_total: totals.gst,
      total: totals.totalSellWithGst,
      margin_total: totals.marginTotal,
      submitted_at: form.status === "sent" ? new Date().toISOString() : null,
      approved_at: form.status === "approved" && form.approvedDate ? new Date(`${form.approvedDate}T00:00:00`).toISOString() : null,
      approved_by_name: form.status === "approved" ? form.clientName.trim() : null,
      metadata: {
        uiStatus: form.status,
        requestedDate: form.requestedDate || null,
        approvedDate: form.approvedDate || null,
        clientName: form.clientName.trim(),
        source: "builders_variations_page",
        originalSnapshotId: selectedSnapshotId,
        originalSnapshotNumber: selectedSnapshot?.snapshot_number || null,
        totalCost: totals.costSubtotal,
        totalSellExGst: totals.sellSubtotal,
      },
      notes: form.notes.trim(),
      created_by: userId,
      updated_by: userId,
    };

    const { data: insertedVariation, error: variationError } = await supabase
      .from("builder_variations")
      .insert(variationPayload)
      .select("*")
      .single();

    if (variationError) {
      setSaving(false);
      setError(variationError.message || "Could not create variation.");
      return;
    }

    const itemPayloads = calculatedItems.map((item) => {
      const source = item.sourceQuoteRowId
        ? boqItems.find((row) => row.source_quote_row_id === item.sourceQuoteRowId)
        : null;
      return {
        workspace_id: workspaceId,
        project_id: selectedProjectId,
        variation_id: insertedVariation.id,
        snapshot_id: selectedSnapshotId,
        boq_item_id: source?.id || null,
        source_quote_row_id: item.sourceQuoteRowId || null,
        source_section_name: source?.source_section_name || null,
        description: item.description.trim(),
        quantity: item.quantity,
        unit: item.unit || null,
        unit_cost: item.unitCost,
        unit_price: item.sellPrice,
        gst_rate: GST_RATE,
        cost_total: item.totalCost,
        line_total: item.totalSell,
        status: "active",
        metadata: {
          marginPercentage: item.marginPercentage,
          source: "builders_variations_page",
        },
        created_by: userId,
      };
    });

    const { error: itemError } = await supabase
      .from("builder_variation_items")
      .insert(itemPayloads);

    if (itemError) {
      await supabase.from("builder_variations").delete().eq("workspace_id", workspaceId).eq("id", insertedVariation.id);
      setSaving(false);
      setError(itemError.message || "Could not create variation line items.");
      return;
    }

    const { data: refreshedItems } = await supabase
      .from("builder_variation_items")
      .select("id, variation_id, snapshot_id, boq_item_id, source_quote_row_id, source_section_name, description, quantity, unit, unit_cost, unit_price, gst_rate, cost_total, line_total, status, metadata")
      .eq("workspace_id", workspaceId)
      .eq("variation_id", insertedVariation.id)
      .order("created_at", { ascending: true });

    setVariations((current) => [insertedVariation, ...current]);
    setVariationItems((current) => [...current, ...(refreshedItems || [])]);
    setForm({
      ...initialVariationForm,
      variationNumber: nextVariationNumber([insertedVariation, ...variations]),
      clientName: selectedProject?.client_name || "",
      requestedDate: todayDate(),
    });
    setLineItems([{ ...emptyLineItem }]);
    setSuccess(`Variation ${insertedVariation.variation_number} created. Approved variations are tracked separately from the original snapshot.`);
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Builder Variations</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Variations</h1>
            <p style={styles.subtitle}>Create positive or negative variations without changing the original Estimate Builder snapshot.</p>
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
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}
        {!workspaceLoading && !workspaceId ? <div style={styles.notice}>Choose an active workspace to manage variations.</div> : null}

        <section style={styles.snapshotNote}>
          <strong>Commercial rule:</strong>
          <span>Approved variations add to the original estimate snapshot. They do not overwrite BOQ items or change the Estimate Builder workbook.</span>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Original Snapshot" value={money(selectedSnapshot?.final_quote_total, selectedProject?.currency)} helper={selectedSnapshot ? `Snapshot ${selectedSnapshot.snapshot_number}` : "No snapshot"} />
          <SummaryCard label="Approved Variations" value={money(variationBuckets.approved, selectedProject?.currency)} helper="Adds to contract value" emphasis />
          <SummaryCard label="Draft / Sent" value={money(variationBuckets.pending, selectedProject?.currency)} helper="Not yet approved" />
          <SummaryCard label="Current Contract View" value={money(numberValue(selectedSnapshot?.final_quote_total) + variationBuckets.approved, selectedProject?.currency)} helper="Snapshot plus approved variations" emphasis />
        </section>

        <section style={styles.workspaceGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Create variation</h2>
                <p style={styles.panelText}>Variation records are separate from the synced BOQ snapshot.</p>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Variation number</span>
                <input value={form.variationNumber} onChange={(event) => updateForm("variationNumber", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} style={styles.select}>
                  {VARIATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Title</span>
                <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="e.g. Upgrade kitchen joinery" style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Client/customer</span>
                <input value={form.clientName} onChange={(event) => updateForm("clientName", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Reason</span>
                <input value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} placeholder="Client request, site condition, omission..." style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Requested date</span>
                <input type="date" value={form.requestedDate} onChange={(event) => updateForm("requestedDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Approved date</span>
                <input type="date" value={form.approvedDate} onChange={(event) => updateForm("approvedDate", event.target.value)} style={styles.input} />
              </label>

              <label style={styles.fieldWide}>
                <span style={styles.label}>Notes</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} style={styles.textarea} />
              </label>
            </div>

            <div style={styles.lineHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Variation line items</h3>
                <p style={styles.panelText}>Use negative quantities or prices for credits.</p>
              </div>
              <button type="button" onClick={addLineItem} style={styles.smallButtonPrimary}>Add item</button>
            </div>

            <div style={styles.lineItems}>
              {lineItemTotals.items.map((item, index) => (
                <div key={index} style={styles.lineItem}>
                  <label style={styles.fieldWide}>
                    <span style={styles.label}>Description</span>
                    <input value={lineItems[index].description} onChange={(event) => updateLineItem(index, "description", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Source row</span>
                    <select value={lineItems[index].sourceQuoteRowId} onChange={(event) => updateLineItem(index, "sourceQuoteRowId", event.target.value)} style={styles.select}>
                      <option value="">No source row</option>
                      {boqItems.map((boq) => (
                        <option key={boq.id} value={boq.source_quote_row_id || boq.id}>
                          {boq.source_quote_row_id || boq.source_excel_row || boq.id} - {boq.item_name || boq.description}
                        </option>
                      ))}
                    </select>
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
                    <span style={styles.label}>Margin %</span>
                    <input type="number" step="0.01" value={lineItems[index].marginPercentage} onChange={(event) => updateLineItem(index, "marginPercentage", event.target.value)} style={styles.input} />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Sell price</span>
                    <input type="number" step="0.01" value={lineItems[index].sellPrice} onChange={(event) => updateLineItem(index, "sellPrice", event.target.value)} style={styles.input} />
                  </label>

                  <div style={styles.lineTotals}>
                    <MiniTotal label="Total cost" value={money(item.totalCost, selectedProject?.currency)} />
                    <MiniTotal label="Total sell" value={money(item.totalSell, selectedProject?.currency)} />
                  </div>

                  <button type="button" onClick={() => removeLineItem(index)} style={styles.removeButton} disabled={lineItems.length === 1}>Remove</button>
                </div>
              ))}
            </div>

            <div style={styles.totalBox}>
              <MiniTotal label="Total cost" value={money(lineItemTotals.costSubtotal, selectedProject?.currency)} />
              <MiniTotal label="Total sell ex GST" value={money(lineItemTotals.sellSubtotal, selectedProject?.currency)} />
              <MiniTotal label="GST" value={money(lineItemTotals.gst, selectedProject?.currency)} />
              <MiniTotal label="Total sell inc GST" value={money(lineItemTotals.totalSellWithGst, selectedProject?.currency)} />
            </div>

            <button type="button" onClick={createVariation} disabled={saving || loading} style={{ ...styles.createButton, ...((saving || loading) ? styles.disabledButton : {}) }}>
              {saving ? "Creating..." : "Create Variation"}
            </button>
          </div>

          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Existing variations</h2>
                <p style={styles.panelText}>Approved totals are separated from draft and sent variations.</p>
              </div>
              <span style={styles.readOnlyPill}>{variations.length} variation{variations.length === 1 ? "" : "s"}</span>
            </div>

            {!variations.length ? <div style={styles.empty}>No variations have been created for this project yet.</div> : null}

            <div style={styles.variationList}>
              {variations.map((variation) => {
                const items = variationItemsByVariationId.get(variation.id) || [];
                const uiStatus = displayStatus(variation);
                return (
                  <article key={variation.id} style={styles.variationCard}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{variation.variation_number}</h3>
                        <p style={styles.cardMeta}>{variation.title}</p>
                      </div>
                      <span style={{ ...styles.statusPill, ...statusStyle(uiStatus) }}>{titleCase(uiStatus)}</span>
                    </div>
                    <p style={styles.reasonText}>{variation.reason || variation.notes || "No reason recorded."}</p>
                    <div style={styles.cardTotals}>
                      <MiniTotal label="Cost" value={money(items.reduce((sum, item) => sum + numberValue(item.cost_total), 0), selectedProject?.currency)} />
                      <MiniTotal label="Sell ex GST" value={money(variation.subtotal, selectedProject?.currency)} />
                      <MiniTotal label="Total" value={money(variation.total, selectedProject?.currency)} />
                    </div>
                    <div style={styles.cardLines}>
                      {items.slice(0, 4).map((item) => (
                        <div key={item.id} style={styles.cardLine}>
                          <span>{item.description}</span>
                          <strong>{money(item.line_total, selectedProject?.currency)}</strong>
                        </div>
                      ))}
                      {items.length > 4 ? <small style={styles.moreText}>+ {items.length - 4} more item{items.length - 4 === 1 ? "" : "s"}</small> : null}
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

function calculateLineItems(items) {
  const calculated = items.map((item) => {
    const quantity = numberValue(item.quantity);
    const unitCost = numberValue(item.unitCost);
    const sellPrice = numberValue(item.sellPrice);
    const totalCost = roundMoney(quantity * unitCost);
    const totalSell = roundMoney(quantity * sellPrice);
    return {
      ...item,
      quantity,
      unitCost,
      marginPercentage: numberValue(item.marginPercentage),
      sellPrice,
      totalCost,
      totalSell,
    };
  });
  return { items: calculated, ...calculateTotals(calculated) };
}

function calculateTotals(items) {
  const costSubtotal = roundMoney(items.reduce((sum, item) => sum + numberValue(item.totalCost), 0));
  const sellSubtotal = roundMoney(items.reduce((sum, item) => sum + numberValue(item.totalSell), 0));
  const marginTotal = roundMoney(sellSubtotal - costSubtotal);
  const gst = roundMoney(sellSubtotal * (GST_RATE / 100));
  return { costSubtotal, sellSubtotal, marginTotal, gst, totalSellWithGst: roundMoney(sellSubtotal + gst) };
}

function nextVariationNumber(existing = []) {
  const max = existing.reduce((highest, variation) => {
    const match = String(variation.variation_number || "").match(/VAR-(\d+)/i);
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `VAR-${String(max + 1).padStart(4, "0")}`;
}

function displayStatus(variation) {
  return variation?.metadata?.uiStatus || fromDbStatus(variation?.status);
}

function fromDbStatus(status) {
  if (status === "submitted") return "sent";
  if (status === "void") return "cancelled";
  return status || "draft";
}

function statusOption(value) {
  return VARIATION_STATUS_OPTIONS.find((option) => option.value === value) || VARIATION_STATUS_OPTIONS[0];
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
  if (status === "sent") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  if (status === "approved") return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
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
  subtitle: { margin: 0, color: "#cbd5e1", fontSize: 15, maxWidth: 720 },
  heroActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
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
  variationList: { display: "flex", flexDirection: "column", gap: 12 },
  variationCard: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#ffffff" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  cardMeta: { margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 },
  reasonText: { margin: "10px 0", color: "#334155", fontSize: 14, fontWeight: 650 },
  cardTotals: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 },
  cardLines: { marginTop: 12, borderTop: "1px solid #e2e8f0" },
  cardLine: { display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 700 },
  moreText: { display: "block", marginTop: 8, color: "#64748b", fontWeight: 800 },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" },
};

