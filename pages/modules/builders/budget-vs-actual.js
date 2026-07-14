import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

export default function BuilderBudgetVsActualPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [variations, setVariations] = useState([]);
  const [variationItems, setVariationItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [supplierInvoiceItems, setSupplierInvoiceItems] = useState([]);
  const [invoiceTablesAvailable, setInvoiceTablesAvailable] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, base_line_item_subtotal, preliminaries_total, overheads_total, margin_total, profit_total, gst_total, fees_total, sales_commission_total, final_quote_total, summary, created_at")
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
      setBoqItems([]);
      setVariations([]);
      setVariationItems([]);
      setPurchaseOrders([]);
      setPurchaseOrderItems([]);
      setSupplierInvoices([]);
      setSupplierInvoiceItems([]);
      return;
    }

    let cancelled = false;
    async function loadBudgetData() {
      setLoading(true);
      setError("");

      const [boqResult, variationResult, variationItemResult, poResult, poItemResult, invoiceResult, invoiceItemResult] = await Promise.all([
        supabase
          .from("builder_boq_items")
          .select("id, source_quote_row_id, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, status, sort_order")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("builder_variations")
          .select("id, snapshot_id, variation_number, title, status, subtotal, gst_total, total, margin_total, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_variation_items")
          .select("id, variation_id, snapshot_id, boq_item_id, source_quote_row_id, source_section_name, description, quantity, unit, unit_cost, unit_price, cost_total, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_purchase_orders")
          .select("id, snapshot_id, po_number, supplier_id, supplier_name, status, subtotal, gst_total, total, metadata, created_at")
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
          .from("builder_supplier_invoices")
          .select("id, purchase_order_id, supplier_id, supplier_name, invoice_number, status, subtotal, gst_total, total, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId),
        supabase
          .from("builder_supplier_invoice_items")
          .select("id, supplier_invoice_id, purchase_order_item_id, boq_item_id, source_quote_row_id, description, quantity, unit, unit_cost, line_total, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId),
      ]);

      if (cancelled) return;
      const firstCoreError = boqResult.error || variationResult.error || variationItemResult.error || poResult.error || poItemResult.error;
      if (firstCoreError) {
        setError(firstCoreError.message || "Could not load budget vs actual data.");
        setBoqItems([]);
        setVariations([]);
        setVariationItems([]);
        setPurchaseOrders([]);
        setPurchaseOrderItems([]);
      } else {
        setBoqItems(boqResult.data || []);
        setVariations(variationResult.data || []);
        setVariationItems(variationItemResult.data || []);
        setPurchaseOrders(poResult.data || []);
        setPurchaseOrderItems(poItemResult.data || []);
      }

      if (invoiceResult.error || invoiceItemResult.error) {
        setInvoiceTablesAvailable(false);
        setSupplierInvoices([]);
        setSupplierInvoiceItems([]);
      } else {
        setInvoiceTablesAvailable(true);
        setSupplierInvoices(invoiceResult.data || []);
        setSupplierInvoiceItems(invoiceItemResult.data || []);
      }
      setLoading(false);
    }

    loadBudgetData();
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

  const report = useMemo(() => buildBudgetReport({
    snapshot: selectedSnapshot,
    boqItems,
    variations,
    variationItems,
    purchaseOrders,
    purchaseOrderItems,
    supplierInvoices,
    supplierInvoiceItems,
  }), [boqItems, purchaseOrderItems, purchaseOrders, selectedSnapshot, supplierInvoiceItems, supplierInvoices, variationItems, variations]);

  const filteredSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return report.sections;
    return report.sections.filter((section) =>
      [section.name, section.key]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [report.sections, search]);

  return (
    <>
      <Head>
        <title>Budget vs Actual</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>Budget vs Actual</h1>
            <p style={styles.subtitle}>Read-only commercial view of original snapshot budget, approved variations, committed purchase orders, and supplier invoice actuals.</p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/builders/boq" style={styles.secondaryLink}>View BOQ Snapshot</Link>
            <Link href="/modules/builders/purchase-orders" style={styles.secondaryLink}>Purchase Orders</Link>
            <Link href="/modules/builders/variations" style={styles.primaryLink}>Variations</Link>
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
            <span style={styles.label}>Search sections</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search BOQ section..." style={styles.input} />
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}
        {!workspaceLoading && !workspaceId ? <div style={styles.notice}>Choose an active workspace to view budget vs actuals.</div> : null}
        {!invoiceTablesAvailable ? <div style={styles.notice}>Supplier invoice tables are not available yet. Actual invoiced values are shown as zero.</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Original estimate" value={money(report.originalEstimate, selectedProject?.currency)} helper={selectedSnapshot ? `Snapshot ${selectedSnapshot.snapshot_number}` : "No snapshot"} />
          <SummaryCard label="Approved variations" value={money(report.approvedVariations, selectedProject?.currency)} helper="Approved only" />
          <SummaryCard label="Revised budget" value={money(report.revisedBudget, selectedProject?.currency)} helper="Original plus approved variations" emphasis />
          <SummaryCard label="PO committed" value={money(report.poCommitted, selectedProject?.currency)} helper={`${purchaseOrders.length} purchase order${purchaseOrders.length === 1 ? "" : "s"}`} />
          <SummaryCard label="Actual invoiced" value={money(report.actualInvoiced, selectedProject?.currency)} helper={`${supplierInvoices.length} supplier invoice${supplierInvoices.length === 1 ? "" : "s"}`} />
          <SummaryCard label="Remaining budget" value={money(report.remainingBudget, selectedProject?.currency)} helper={report.remainingBudget < 0 ? "Over committed/actual" : "Budget remaining"} emphasis={report.remainingBudget >= 0} danger={report.remainingBudget < 0} />
          <SummaryCard label="Forecast profit" value={money(report.forecastProfit, selectedProject?.currency)} helper={`${formatPercent(report.forecastMargin)} forecast margin`} emphasis={report.forecastProfit >= 0} danger={report.forecastProfit < 0} />
        </section>

        <section style={styles.totalPanel}>
          <div>
            <h2 style={styles.panelTitle}>Commercial summary</h2>
            <p style={styles.panelText}>Forecast cost uses the larger of committed PO costs and actual invoiced costs. Profit impact compares revised budget against forecast cost.</p>
          </div>
          <div style={styles.totalList}>
            <MiniTotal label="Original snapshot profit" value={money(report.originalProfit, selectedProject?.currency)} />
            <MiniTotal label="Forecast final cost" value={money(report.forecastCost, selectedProject?.currency)} />
            <MiniTotal label="Cost variance" value={money(report.costVariance, selectedProject?.currency)} tone={report.costVariance > 0 ? "bad" : "good"} />
            <MiniTotal label="Profit impact" value={money(report.profitImpact, selectedProject?.currency)} tone={report.profitImpact < 0 ? "bad" : "good"} />
          </div>
        </section>

        <section style={styles.tableShell}>
          <div style={styles.tableHeader}>
            <div>
              <h2 style={styles.panelTitle}>BOQ section breakdown</h2>
              <p style={styles.panelText}>{filteredSections.length} section{filteredSections.length === 1 ? "" : "s"} shown. Over-budget sections are highlighted.</p>
            </div>
            {loading ? <span style={styles.loadingPill}>Loading...</span> : <span style={styles.readOnlyPill}>Read-only</span>}
          </div>

          {!filteredSections.length ? <div style={styles.empty}>No BOQ sections found for this snapshot/filter.</div> : null}

          <div style={styles.tableScroller}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>BOQ Section</Th>
                  <Th numeric>Original Budget</Th>
                  <Th numeric>Approved Variations</Th>
                  <Th numeric>Revised Budget</Th>
                  <Th numeric>PO Committed</Th>
                  <Th numeric>Actual Invoiced</Th>
                  <Th numeric>Forecast Cost</Th>
                  <Th numeric>Remaining</Th>
                  <Th numeric>Variance</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {filteredSections.map((section) => (
                  <tr key={section.key} style={section.overBudget ? styles.overBudgetRow : undefined}>
                    <td style={styles.nameCell}>
                      <strong>{section.name}</strong>
                      <span>{section.itemCount} BOQ item{section.itemCount === 1 ? "" : "s"}</span>
                    </td>
                    <td style={styles.numericCell}>{money(section.originalBudget, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.approvedVariations, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.revisedBudget, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.poCommitted, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.actualInvoiced, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.forecastCost, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.remainingBudget, selectedProject?.currency)}</td>
                    <td style={styles.numericCell}>{money(section.costVariance, selectedProject?.currency)}</td>
                    <td style={styles.stateCell}>
                      <span style={{ ...styles.statusPill, ...(section.overBudget ? styles.statusBad : styles.statusGood) }}>
                        {section.overBudget ? "Over budget" : "Within budget"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function buildBudgetReport({
  snapshot,
  boqItems,
  variations,
  variationItems,
  purchaseOrders,
  purchaseOrderItems,
  supplierInvoices,
  supplierInvoiceItems,
}) {
  const approvedVariationIds = new Set(
    variations
      .filter((variation) => displayStatus(variation) === "approved")
      .map((variation) => variation.id)
  );
  const activePoIds = new Set(
    purchaseOrders
      .filter((po) => !["cancelled", "void"].includes(String(po.status || "").toLowerCase()))
      .map((po) => po.id)
  );
  const activeInvoiceIds = new Set(
    supplierInvoices
      .filter((invoice) => !["draft", "disputed", "void"].includes(String(invoice.status || "").toLowerCase()))
      .map((invoice) => invoice.id)
  );

  const boqById = new Map(boqItems.map((item) => [item.id, item]));
  const boqByQuoteRow = new Map();
  boqItems.forEach((item) => {
    if (item.source_quote_row_id) boqByQuoteRow.set(item.source_quote_row_id, item);
  });

  const sections = new Map();
  function ensureSection(key, name) {
    const resolvedKey = key || name || "unsectioned";
    if (!sections.has(resolvedKey)) {
      sections.set(resolvedKey, {
        key: resolvedKey,
        name: name || "Unsectioned",
        itemCount: 0,
        originalBudget: 0,
        approvedVariations: 0,
        poCommitted: 0,
        actualInvoiced: 0,
      });
    }
    return sections.get(resolvedKey);
  }

  boqItems.forEach((item) => {
    const section = ensureSection(item.source_section_key, item.source_section_name);
    section.itemCount += 1;
    section.originalBudget += numberValue(item.line_total);
  });

  variationItems
    .filter((item) => approvedVariationIds.has(item.variation_id) && item.status !== "cancelled")
    .forEach((item) => {
      const source = item.boq_item_id ? boqById.get(item.boq_item_id) : boqByQuoteRow.get(item.source_quote_row_id);
      const section = ensureSection(source?.source_section_key || item.source_section_name, source?.source_section_name || item.source_section_name || "Variation Only");
      section.approvedVariations += numberValue(item.line_total);
    });

  purchaseOrderItems
    .filter((item) => activePoIds.has(item.purchase_order_id) && item.status !== "cancelled")
    .forEach((item) => {
      const source = item.boq_item_id ? boqById.get(item.boq_item_id) : boqByQuoteRow.get(item.source_quote_row_id);
      const section = ensureSection(source?.source_section_key, source?.source_section_name || item.metadata?.sectionName || "Purchase Orders");
      section.poCommitted += numberValue(item.line_total);
    });

  supplierInvoiceItems
    .filter((item) => activeInvoiceIds.has(item.supplier_invoice_id) && !["excluded", "disputed", "void"].includes(String(item.status || "").toLowerCase()))
    .forEach((item) => {
      const source = item.boq_item_id ? boqById.get(item.boq_item_id) : boqByQuoteRow.get(item.source_quote_row_id);
      const section = ensureSection(source?.source_section_key, source?.source_section_name || "Supplier Invoices");
      section.actualInvoiced += numberValue(item.line_total);
    });

  const sectionRows = Array.from(sections.values())
    .map((section) => {
      const revisedBudget = section.originalBudget + section.approvedVariations;
      const forecastCost = Math.max(section.poCommitted, section.actualInvoiced);
      const remainingBudget = revisedBudget - forecastCost;
      const costVariance = forecastCost - revisedBudget;
      return {
        ...section,
        originalBudget: roundMoney(section.originalBudget),
        approvedVariations: roundMoney(section.approvedVariations),
        poCommitted: roundMoney(section.poCommitted),
        actualInvoiced: roundMoney(section.actualInvoiced),
        revisedBudget: roundMoney(revisedBudget),
        forecastCost: roundMoney(forecastCost),
        remainingBudget: roundMoney(remainingBudget),
        costVariance: roundMoney(costVariance),
        overBudget: costVariance > 0,
      };
    })
    .sort((a, b) => {
      if (a.overBudget !== b.overBudget) return a.overBudget ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const approvedVariations = variations
    .filter((variation) => displayStatus(variation) === "approved")
    .reduce((sum, variation) => sum + numberValue(variation.total), 0);
  const poCommitted = purchaseOrderItems
    .filter((item) => activePoIds.has(item.purchase_order_id) && item.status !== "cancelled")
    .reduce((sum, item) => sum + numberValue(item.line_total), 0);
  const actualInvoiced = supplierInvoiceItems
    .filter((item) => activeInvoiceIds.has(item.supplier_invoice_id) && !["excluded", "disputed", "void"].includes(String(item.status || "").toLowerCase()))
    .reduce((sum, item) => sum + numberValue(item.line_total), 0);

  const originalEstimate = numberValue(snapshot?.final_quote_total);
  const originalProfit = numberValue(snapshot?.profit_total);
  const revisedBudget = originalEstimate + approvedVariations;
  const forecastCost = Math.max(poCommitted, actualInvoiced);
  const remainingBudget = revisedBudget - forecastCost;
  const costVariance = forecastCost - revisedBudget;
  const forecastProfit = revisedBudget - forecastCost;
  const profitImpact = forecastProfit - originalProfit;
  const forecastMargin = revisedBudget ? forecastProfit / revisedBudget : 0;

  return {
    originalEstimate: roundMoney(originalEstimate),
    originalProfit: roundMoney(originalProfit),
    approvedVariations: roundMoney(approvedVariations),
    revisedBudget: roundMoney(revisedBudget),
    poCommitted: roundMoney(poCommitted),
    actualInvoiced: roundMoney(actualInvoiced),
    forecastCost: roundMoney(forecastCost),
    remainingBudget: roundMoney(remainingBudget),
    costVariance: roundMoney(costVariance),
    forecastProfit: roundMoney(forecastProfit),
    profitImpact: roundMoney(profitImpact),
    forecastMargin,
    sections: sectionRows,
  };
}

function displayStatus(row) {
  const uiStatus = row?.metadata?.uiStatus;
  if (uiStatus) return uiStatus;
  if (row?.status === "submitted") return "sent";
  if (row?.status === "void") return "cancelled";
  return row?.status || "draft";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatPercent(value) {
  const number = Number(value);
  return `${((Number.isFinite(number) ? number : 0) * 100).toFixed(1)}%`;
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

function SummaryCard({ label, value, helper, emphasis = false, danger = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(emphasis ? styles.summaryCardEmphasis : {}), ...(danger ? styles.summaryCardDanger : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function MiniTotal({ label, value, tone = "" }) {
  return (
    <div style={{ ...styles.miniTotal, ...(tone === "bad" ? styles.miniTotalBad : {}), ...(tone === "good" ? styles.miniTotalGood : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Th({ children, numeric = false }) {
  return <th style={{ ...styles.th, ...(numeric ? styles.numericTh : {}) }}>{children}</th>;
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
  label: { color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#0f172a", padding: "10px 11px", fontSize: 14, fontWeight: 700 },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 800 },
  summaryGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 },
  summaryCard: { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6, minHeight: 96 },
  summaryCardEmphasis: { borderColor: "#99f6e4", background: "#f0fdfa" },
  summaryCardDanger: { borderColor: "#fecaca", background: "#fff1f2" },
  totalPanel: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" },
  panelTitle: { margin: 0, fontSize: 20, lineHeight: 1.2, fontWeight: 800 },
  panelText: { margin: "5px 0 0", color: "#64748b", fontSize: 14, fontWeight: 600 },
  totalList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, minWidth: 300, flex: "1 1 560px" },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4 },
  miniTotalBad: { borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" },
  miniTotalGood: { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" },
  tableShell: { marginTop: 16, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  loadingPill: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  readOnlyPill: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 700 },
  tableScroller: { width: "100%", overflowX: "auto" },
  table: { width: "100%", minWidth: 1180, borderCollapse: "collapse" },
  th: { background: "#f8fafc", color: "#334155", borderBottom: "1px solid #e2e8f0", padding: "10px 11px", textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  numericTh: { textAlign: "right" },
  nameCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", minWidth: 220, verticalAlign: "top" },
  numericCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", whiteSpace: "nowrap", textAlign: "right", verticalAlign: "top", fontWeight: 800 },
  stateCell: { borderBottom: "1px solid #e2e8f0", padding: "10px 11px", whiteSpace: "nowrap", verticalAlign: "top" },
  overBudgetRow: { background: "#fff7ed" },
  statusPill: { border: "1px solid", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900 },
  statusGood: { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" },
  statusBad: { background: "#fff1f2", color: "#b91c1c", borderColor: "#fecaca" },
};

