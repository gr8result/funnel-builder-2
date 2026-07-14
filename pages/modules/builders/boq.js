import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const STATUS_OPTIONS = [
  { value: "all", label: "All items" },
  { value: "active", label: "Active" },
  { value: "quote_required", label: "Quote required" },
  { value: "excluded", label: "Excluded" },
  { value: "archived", label: "Archived" },
];

export default function BoqSnapshotViewerPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [procurementItems, setProcurementItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
        .select("id, project_name, client_name, site_address, status, contract_total, original_estimate_total, currency, updated_at, created_at")
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
        .select("id, snapshot_number, snapshot_label, status, source_quote_number, source_quote_date, source_workbook_file_name, base_line_item_subtotal, preliminaries_total, overheads_total, margin_total, profit_total, gst_total, fees_total, sales_commission_total, final_quote_total, summary, created_at")
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
      setSections([]);
      setItems([]);
      setProcurementItems([]);
      setSuppliers([]);
      return;
    }

    let cancelled = false;
    async function loadBoq() {
      setLoading(true);
      setError("");
      const [sectionResult, itemResult, procurementResult, supplierResult] = await Promise.all([
        supabase
          .from("builder_boq_sections")
          .select("id, source_section_key, source_section_name, display_name, section_number, sort_order, subtotal, status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("builder_boq_items")
          .select("id, section_id, supplier_id, source_quote_row_id, source_excel_row, source_section_key, source_section_name, item_name, description, quantity, unit, unit_rate, line_total, rate_source, line_type, cost_code, sort_order, status, source_row, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("builder_procurement_items")
          .select("id, boq_item_id, supplier_id, source_quote_row_id, item_name, section_name, quantity, unit, estimated_rate, estimated_total, order_status, delivery_status, metadata")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .eq("snapshot_id", selectedSnapshotId),
        supabase
          .from("builder_suppliers")
          .select("id, name, trade_category")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;
      const firstError = sectionResult.error || itemResult.error || procurementResult.error || supplierResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load BOQ snapshot.");
        setSections([]);
        setItems([]);
        setProcurementItems([]);
        setSuppliers([]);
      } else {
        setSections(sectionResult.data || []);
        setItems(itemResult.data || []);
        setProcurementItems(procurementResult.data || []);
        setSuppliers(supplierResult.data || []);
      }
      setLoading(false);
    }

    loadBoq();
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

  const procurementByQuoteRowId = useMemo(() => {
    const map = new Map();
    procurementItems.forEach((item) => {
      if (item.source_quote_row_id && !map.has(item.source_quote_row_id)) {
        map.set(item.source_quote_row_id, item);
      }
    });
    return map;
  }, [procurementItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!term) return true;
      const procurement = item.source_quote_row_id ? procurementByQuoteRowId.get(item.source_quote_row_id) : null;
      const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
      return [
        item.item_name,
        item.description,
        item.unit,
        item.rate_source,
        item.line_type,
        item.cost_code,
        item.source_section_name,
        item.source_excel_row,
        item.source_quote_row_id,
        supplier?.name,
        procurement?.metadata?.supplier,
        procurement?.item_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [items, procurementByQuoteRowId, search, statusFilter, supplierById]);

  const sectionsWithItems = useMemo(() => {
    const itemsBySection = new Map();
    filteredItems.forEach((item) => {
      const key = item.section_id || item.source_section_key || "unsectioned";
      const group = itemsBySection.get(key) || [];
      group.push(item);
      itemsBySection.set(key, group);
    });

    const rows = sections.map((section) => ({
      section,
      items: itemsBySection.get(section.id) || itemsBySection.get(section.source_section_key) || [],
    }));
    const knownItemIds = new Set(rows.flatMap((row) => row.items.map((item) => item.id)));
    const unsectioned = filteredItems.filter((item) => !knownItemIds.has(item.id));
    if (unsectioned.length) {
      rows.push({
        section: {
          id: "unsectioned",
          display_name: "Unsectioned Items",
          source_section_name: "Unsectioned Items",
          subtotal: unsectioned.reduce((sum, item) => sum + numberValue(item.line_total), 0),
          status: "active",
        },
        items: unsectioned,
      });
    }
    return rows.filter((row) => row.items.length > 0 || !search.trim());
  }, [filteredItems, search, sections]);

  const visibleTotals = useMemo(() => {
    return filteredItems.reduce(
      (totals, item) => {
        totals.cost += costTotalForItem(item);
        totals.sell += sellTotalForItem(item);
        totals.count += 1;
        return totals;
      },
      { cost: 0, sell: 0, count: 0 }
    );
  }, [filteredItems]);

  return (
    <>
      <Head>
        <title>BOQ Snapshot Viewer</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Project Commercials</div>
            <h1 style={styles.title}>BOQ Snapshot Viewer</h1>
            <p style={styles.subtitle}>
              Review synced Estimate Builder snapshots without changing the source workbook.
            </p>
          </div>
          <div style={styles.heroActions}>
            <Link href="/modules/estimate-builder" style={styles.primaryLink}>
              Back to Estimate Builder
            </Link>
          </div>
        </header>

        <section style={styles.controls}>
          <label style={styles.field}>
            <span style={styles.label}>Commercial project</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              style={styles.select}
              disabled={workspaceLoading || loading || !projects.length}
            >
              {!projects.length ? <option value="">No synced projects found</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name || "Untitled Project"}
                  {project.client_name ? ` - ${project.client_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Estimate snapshot</span>
            <select
              value={selectedSnapshotId}
              onChange={(event) => setSelectedSnapshotId(event.target.value)}
              style={styles.select}
              disabled={workspaceLoading || loading || !snapshots.length}
            >
              {!snapshots.length ? <option value="">No snapshots found</option> : null}
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  Snapshot {snapshot.snapshot_number}
                  {snapshot.status ? ` - ${titleCase(snapshot.status)}` : ""}
                  {snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Search BOQ</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, section, supplier, source row..."
              style={styles.input}
            />
          </label>

          <label style={styles.fieldSmall}>
            <span style={styles.label}>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {workspaceLoading ? <div style={styles.notice}>Loading workspace...</div> : null}
        {!workspaceLoading && !workspaceId ? <div style={styles.notice}>Choose an active workspace to view commercial snapshots.</div> : null}

        <section style={styles.summaryGrid}>
          <SummaryCard label="Workspace" value={activeWorkspace?.name || "Active workspace"} helper={selectedProject?.status ? titleCase(selectedProject.status) : ""} />
          <SummaryCard label="Project" value={selectedProject?.project_name || "No project selected"} helper={selectedProject?.site_address || selectedProject?.client_name || ""} />
          <SummaryCard label="Snapshot" value={selectedSnapshot ? `Version ${selectedSnapshot.snapshot_number}` : "No snapshot"} helper={snapshotHelper(selectedSnapshot)} />
          <SummaryCard label="Project Total" value={money(selectedSnapshot?.final_quote_total, selectedProject?.currency)} helper="Saved snapshot total" emphasis />
        </section>

        <section style={styles.totalPanel}>
          <div>
            <h2 style={styles.panelTitle}>Snapshot totals</h2>
            <p style={styles.panelText}>These values are read from the synced Estimate Builder commercial snapshot.</p>
          </div>
          <div style={styles.totalList}>
            <MiniTotal label="Line subtotal" value={money(selectedSnapshot?.base_line_item_subtotal, selectedProject?.currency)} />
            <MiniTotal label="Preliminaries" value={money(selectedSnapshot?.preliminaries_total, selectedProject?.currency)} />
            <MiniTotal label="Overheads" value={money(selectedSnapshot?.overheads_total, selectedProject?.currency)} />
            <MiniTotal label="Margin" value={money(selectedSnapshot?.margin_total, selectedProject?.currency)} />
            <MiniTotal label="GST" value={money(selectedSnapshot?.gst_total, selectedProject?.currency)} />
            <MiniTotal label="Visible sell total" value={money(visibleTotals.sell, selectedProject?.currency)} />
          </div>
        </section>

        <section style={styles.tableShell}>
          <div style={styles.tableHeader}>
            <div>
              <h2 style={styles.panelTitle}>BOQ sections and items</h2>
              <p style={styles.panelText}>
                {visibleTotals.count} visible item{visibleTotals.count === 1 ? "" : "s"} across {sectionsWithItems.length} section{sectionsWithItems.length === 1 ? "" : "s"}.
              </p>
            </div>
            {loading ? <span style={styles.loadingPill}>Loading...</span> : <span style={styles.readOnlyPill}>Read-only</span>}
          </div>

          {!loading && selectedProjectId && selectedSnapshotId && !filteredItems.length ? (
            <div style={styles.empty}>
              No BOQ items match this snapshot/filter yet. Sync an Estimate Builder workbook or clear the current filter.
            </div>
          ) : null}

          {sectionsWithItems.map(({ section, items: sectionItems }) => (
            <div key={section.id || section.source_section_key} style={styles.sectionBlock}>
              <div style={styles.sectionHeader}>
                <div>
                  <h3 style={styles.sectionTitle}>{section.display_name || section.source_section_name || "Untitled Section"}</h3>
                  <p style={styles.sectionMeta}>
                    {sectionItems.length} item{sectionItems.length === 1 ? "" : "s"}
                    {section.status ? ` - ${titleCase(section.status)}` : ""}
                  </p>
                </div>
                <strong style={styles.sectionTotal}>{money(sectionItems.reduce((sum, item) => sum + sellTotalForItem(item), 0), selectedProject?.currency)}</strong>
              </div>
              <div style={styles.tableScroller}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <Th>Description</Th>
                      <Th compact>Qty</Th>
                      <Th compact>Unit</Th>
                      <Th numeric>Rate</Th>
                      <Th numeric>Cost Total</Th>
                      <Th numeric>Sell Total</Th>
                      <Th>Supplier / Source</Th>
                      <Th compact>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionItems.map((item) => {
                      const procurement = item.source_quote_row_id ? procurementByQuoteRowId.get(item.source_quote_row_id) : null;
                      const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
                      return (
                        <tr key={item.id}>
                          <td style={styles.descriptionCell}>
                            <strong>{item.item_name || item.description || "Untitled item"}</strong>
                            <span>{item.description && item.description !== item.item_name ? item.description : sourceRowLabel(item)}</span>
                          </td>
                          <td style={styles.compactCell}>{formatNumber(item.quantity)}</td>
                          <td style={styles.compactCell}>{item.unit || "-"}</td>
                          <td style={styles.numericCell}>{money(item.unit_rate, selectedProject?.currency)}</td>
                          <td style={styles.numericCell}>{money(costTotalForItem(item), selectedProject?.currency)}</td>
                          <td style={styles.numericCell}>{money(sellTotalForItem(item), selectedProject?.currency)}</td>
                          <td style={styles.sourceCell}>
                            <strong>{supplier?.name || procurement?.metadata?.supplier || item.rate_source || "Snapshot"}</strong>
                            <span>{sourceRowLabel(item)}</span>
                          </td>
                          <td style={styles.compactCell}>
                            <span style={{ ...styles.statusPill, ...statusStyle(item.status) }}>{titleCase(item.status || "active")}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
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

function Th({ children, compact = false, numeric = false }) {
  return <th style={{ ...styles.th, ...(compact ? styles.compactTh : {}), ...(numeric ? styles.numericTh : {}) }}>{children}</th>;
}

function snapshotHelper(snapshot) {
  if (!snapshot) return "";
  const parts = [];
  if (snapshot.status) parts.push(titleCase(snapshot.status));
  if (snapshot.source_quote_number) parts.push(snapshot.source_quote_number);
  if (snapshot.created_at) parts.push(new Date(snapshot.created_at).toLocaleDateString());
  return parts.join(" - ");
}

function sourceRowLabel(item) {
  const parts = [];
  if (item.source_excel_row) parts.push(`Row ${item.source_excel_row}`);
  if (item.source_quote_row_id) parts.push(item.source_quote_row_id);
  if (item.line_type) parts.push(item.line_type);
  return parts.join(" - ") || "Synced snapshot row";
}

function costTotalForItem(item) {
  const source = item?.source_row || {};
  return firstNumber(
    source.costTotal,
    source.totalCost,
    source.importedCost,
    source.baseCost,
    item?.line_total
  );
}

function sellTotalForItem(item) {
  const source = item?.source_row || {};
  return firstNumber(
    source.sellTotal,
    source.finalSellTotal,
    source.totalSell,
    source.total,
    source.cost,
    item?.line_total
  );
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  if (status === "quote_required") return { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" };
  if (status === "excluded" || status === "archived") return { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" };
  return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: 18,
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a 0%, #172554 48%, #064e3b 100%)",
    color: "#ffffff",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "22px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "4px 0",
    fontSize: 38,
    lineHeight: 1.05,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 15,
    maxWidth: 620,
  },
  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryLink: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 8,
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  controls: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  fieldSmall: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 140,
  },
  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 11px",
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 11px",
    fontSize: 14,
    fontWeight: 700,
  },
  error: {
    marginTop: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 12px",
    fontWeight: 800,
  },
  notice: {
    marginTop: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e40af",
    borderRadius: 8,
    padding: "10px 12px",
    fontWeight: 800,
  },
  summaryGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 96,
  },
  summaryCardEmphasis: {
    borderColor: "#99f6e4",
    background: "#f0fdfa",
  },
  totalPanel: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  panelTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 800,
  },
  panelText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
  },
  totalList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10,
    minWidth: 280,
    flex: "1 1 480px",
  },
  miniTotal: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 11px",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  tableShell: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 16,
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },
  loadingPill: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  readOnlyPill: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  empty: {
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    background: "#f8fafc",
    color: "#475569",
    padding: 18,
    fontWeight: 700,
  },
  sectionBlock: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 12,
  },
  sectionHeader: {
    background: "#0f172a",
    color: "#ffffff",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },
  sectionMeta: {
    margin: "3px 0 0",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 700,
  },
  sectionTotal: {
    color: "#67e8f9",
    whiteSpace: "nowrap",
  },
  tableScroller: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 1060,
    borderCollapse: "collapse",
  },
  th: {
    background: "#f8fafc",
    color: "#334155",
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 11px",
    textAlign: "left",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  compactTh: {
    width: 90,
  },
  numericTh: {
    width: 130,
    textAlign: "right",
  },
  descriptionCell: {
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 11px",
    minWidth: 260,
    verticalAlign: "top",
  },
  compactCell: {
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 11px",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    fontWeight: 700,
  },
  numericCell: {
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 11px",
    whiteSpace: "nowrap",
    textAlign: "right",
    verticalAlign: "top",
    fontWeight: 800,
  },
  sourceCell: {
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 11px",
    minWidth: 190,
    verticalAlign: "top",
  },
  statusPill: {
    border: "1px solid",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 900,
  },
};
