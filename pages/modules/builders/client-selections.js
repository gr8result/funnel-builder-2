import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, ExternalLink, FileUp, PackagePlus } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";
import {
  KITCHEN_AREA_LABEL,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  areaTotals,
  createSelectionPayloadFromProduct,
  filtersForRequirement,
  kitchenRequirementByKey,
  priceStateForProduct,
  productAllowance,
  productClientPrice,
  productsForRequirement,
  projectTotals,
  requirementFinancials,
  requirementImage,
  selectedByRequirement,
  statusForRequirement,
  statusTone,
  variationFor,
} from "../../../lib/builders/clientSelectionWorkflow";
import {
  DEFAULT_WARNING_THRESHOLD_PERCENT,
  calculateSessionBudget,
  numberValue,
  roundMoney,
} from "../../../lib/builders/selectionBudget";
import { familyByKey } from "../../../lib/product-library/catalogueModel";

const INTERNAL_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff", "interior_designer"]);
const SELECTION_COLUMNS = "id, session_id, snapshot_id, category, subcategory, room, title, description, allowance_amount, selected_product_name, selected_supplier_name, selected_colour, selected_finish, selected_details, status, selected_at, metadata, created_at, updated_at, brand, product_name, model_number, image_url, specification_url, finish, colour, included_allowance, client_selection_price, calculated_client_selection_price, variation_amount, selection_status, is_active";
const SESSION_COLUMNS = "id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, warning_threshold_percent, selection_budget_status, status, metadata, created_at, updated_at";
const PRODUCT_COLUMNS = "*, builder_product_suppliers(supplier_name), builder_product_manufacturers(manufacturer_name), builder_product_categories(category_name)";

export default function BuilderClientSelectionsPage() {
  const { workspaceId, role, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selections, setSelections] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [screen, setScreen] = useState("areas");
  const [selectedRequirementKey, setSelectedRequirementKey] = useState("");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isInternal = INTERNAL_ROLES.has(role);
  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const selectedSnapshot = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null, [snapshots, selectedSnapshotId]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId) || null, [sessions, selectedSessionId]);

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
        setError(loadError.message || "Could not load projects.");
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
      setSessions([]);
      setSelections([]);
      setProducts([]);
      setSelectedSnapshotId("");
      setSelectedSessionId("");
      return;
    }
    let cancelled = false;
    async function loadProjectData() {
      setLoading(true);
      setError("");
      const [snapshotResult, sessionResult, selectionResult, productResult] = await Promise.all([
        supabase
          .from("builder_estimate_snapshots")
          .select("id, snapshot_number, snapshot_label, status, source_quote_number, final_quote_total, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("snapshot_number", { ascending: false }),
        supabase
          .from("builder_selection_sessions")
          .select(SESSION_COLUMNS)
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("builder_client_selections")
          .select(SELECTION_COLUMNS)
          .eq("workspace_id", workspaceId)
          .eq("project_id", selectedProjectId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("builder_products")
          .select(PRODUCT_COLUMNS)
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .order("updated_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const firstError = snapshotResult.error || sessionResult.error || selectionResult.error || productResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load Client Selections.");
        setSnapshots([]);
        setSessions([]);
        setSelections([]);
        setProducts([]);
      } else {
        const snapshotRows = snapshotResult.data || [];
        const sessionRows = sessionResult.data || [];
        setSnapshots(snapshotRows);
        setSessions(sessionRows);
        setSelections(selectionResult.data || []);
        setProducts((productResult.data || []).map(mapDbProductToEntity));
        setSelectedSnapshotId((current) => snapshotRows.find((snapshot) => snapshot.id === current)?.id || sessionRows[0]?.snapshot_id || snapshotRows[0]?.id || "");
        setSelectedSessionId((current) => sessionRows.find((session) => session.id === current)?.id || sessionRows[0]?.id || "");
      }
      setLoading(false);
    }
    loadProjectData();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  const sessionSelections = useMemo(() => {
    return selections.filter((selection) => {
      if (selectedSessionId) return selection.session_id === selectedSessionId;
      if (selectedSnapshotId) return selection.snapshot_id === selectedSnapshotId;
      return true;
    });
  }, [selectedSessionId, selectedSnapshotId, selections]);

  const activeSelections = useMemo(
    () => sessionSelections.filter((selection) => selection.is_active !== false && !["replaced", "removed"].includes(selection.selection_status || selection.status)),
    [sessionSelections]
  );
  const selectedMap = useMemo(() => selectedByRequirement(activeSelections), [activeSelections]);
  const kitchenTotals = useMemo(() => areaTotals(KITCHEN_REQUIREMENTS, selectedMap), [selectedMap]);
  const runningProjectTotals = useMemo(() => projectTotals([kitchenTotals]), [kitchenTotals]);
  const selectionBudget = useMemo(() => {
    const originalEstimateTotal = selectedSession?.original_estimate_total || selectedSnapshot?.final_quote_total || selectedProject?.original_estimate_total || selectedProject?.contract_total || 0;
    return calculateSessionBudget({
      originalEstimateTotal,
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling || 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: activeSelections,
    });
  }, [activeSelections, selectedProject, selectedSession, selectedSnapshot]);
  const selectedRequirement = useMemo(() => kitchenRequirementByKey(selectedRequirementKey) || KITCHEN_REQUIREMENTS[0], [selectedRequirementKey]);
  const requirementProducts = useMemo(() => productsForRequirement(products, selectedRequirement), [products, selectedRequirement]);
  const availableFilters = useMemo(() => filtersForRequirement(selectedRequirement, requirementProducts), [selectedRequirement, requirementProducts]);
  const visibleProducts = useMemo(() => {
    return requirementProducts.filter((product) => {
      return availableFilters.every((filter) => {
        const selected = filters[filter.key];
        if (!selected) return true;
        const entity = product.metadata?.productEntity || product;
        return (entity[filter.key] || product[filter.key] || product.metadata?.[filter.key] || "") === selected;
      });
    });
  }, [availableFilters, filters, requirementProducts]);

  function openKitchenChecklist() {
    setScreen("checklist");
    setSelectedRequirementKey("");
    setFilters({});
  }

  function openRequirement(requirementKey) {
    setSelectedRequirementKey(requirementKey);
    setScreen("product");
    setFilters({});
  }

  async function ensureSession() {
    if (selectedSession) return selectedSession;
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) throw new Error("Select a project and estimate snapshot first.");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const originalEstimateTotal = numberValue(selectedSnapshot?.final_quote_total || selectedProject?.original_estimate_total || selectedProject?.contract_total);
    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      snapshot_id: selectedSnapshotId,
      session_name: `${selectedProject?.project_name || "Project"} Selections`,
      original_estimate_total: originalEstimateTotal,
      private_upgrade_ceiling: 0,
      current_net_selection_variation: 0,
      current_updated_estimate_total: originalEstimateTotal,
      warning_threshold_percent: DEFAULT_WARNING_THRESHOLD_PERCENT,
      selection_budget_status: "within_budget",
      status: "draft",
      metadata: { source: "client_selection_checklist" },
      created_by: userId,
      updated_by: userId,
    };
    const { data, error: insertError } = await supabase.from("builder_selection_sessions").insert(payload).select(SESSION_COLUMNS).single();
    if (insertError) throw insertError;
    setSessions((current) => [data, ...current]);
    setSelectedSessionId(data.id);
    return data;
  }

  async function selectProduct(product) {
    if (!workspaceId || !selectedProjectId || !selectedSnapshotId) {
      setError("Select a project and estimate snapshot first.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const session = await ensureSession();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const payload = createSelectionPayloadFromProduct({
        workspaceId,
        projectId: selectedProjectId,
        snapshotId: selectedSnapshotId,
        sessionId: session.id,
        requirement: selectedRequirement,
        product,
        userId,
      });
      const previous = selectedMap.get(selectedRequirement.requirementKey);
      if (previous?.id) {
        const { error: previousError } = await supabase
          .from("builder_client_selections")
          .update({ selection_status: "replaced", status: "changed", is_active: false, updated_by: userId, updated_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("id", previous.id);
        if (previousError) throw previousError;
      }
      const { data: inserted, error: insertError } = await supabase.from("builder_client_selections").insert(payload).select(SELECTION_COLUMNS).single();
      if (insertError) throw insertError;

      const nextSelections = [inserted, ...selections.map((selection) => previous?.id === selection.id ? { ...selection, selection_status: "replaced", status: "changed", is_active: false } : selection)];
      setSelections(nextSelections);
      await persistBudget(session.id, nextSelections.filter((selection) => selection.session_id === session.id && selection.is_active !== false && !["replaced", "removed"].includes(selection.selection_status || selection.status)), userId);
      setSuccess(`${selectedRequirement.label} selection saved.`);
    } catch (saveError) {
      setError(saveError.message || "Could not save product selection.");
    } finally {
      setSaving(false);
    }
  }

  async function persistBudget(sessionId, rows, userId) {
    if (!sessionId) return;
    const nextBudget = calculateSessionBudget({
      originalEstimateTotal: selectionBudget.originalEstimateTotal,
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling || 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: rows,
    });
    const payload = {
      current_net_selection_variation: nextBudget.currentNetSelectionVariation,
      current_updated_estimate_total: nextBudget.currentUpdatedEstimateTotal,
      selection_budget_status: nextBudget.selectionBudgetStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    const { data, error: updateError } = await supabase.from("builder_selection_sessions").update(payload).eq("workspace_id", workspaceId).eq("id", sessionId).select(SESSION_COLUMNS).single();
    if (updateError) throw updateError;
    setSessions((current) => current.map((session) => session.id === sessionId ? data : session));
  }

  const bannerArea = screen === "areas" ? "Interior" : KITCHEN_AREA_LABEL;
  const bannerSelection = screen === "product" ? selectedRequirement.label : screen === "checklist" ? "Selection Checklist" : "Areas";

  return (
    <>
      <Head>
        <title>Inclusions & Selections</title>
      </Head>
      <main style={styles.page}>
        <header style={styles.banner}>
          <div>
            <div style={styles.eyebrow}>Inclusions & Selections</div>
            <h1 style={styles.title}>{selectedProject?.project_name || "Select a Project"}</h1>
            <p style={styles.subtitle}>{selectedProject?.client_name || "Client"}{selectedSnapshot?.source_quote_number ? ` · Job ${selectedSnapshot.source_quote_number}` : ""}</p>
          </div>
          <div style={styles.bannerMeta}>
            <span>Current Area: <strong>{bannerArea}</strong></span>
            <span>Current Selection: <strong>{bannerSelection}</strong></span>
            {screen === "product" ? <button type="button" onClick={openKitchenChecklist} style={styles.bannerButton}><ArrowLeft size={16} />Back to Kitchen</button> : null}
          </div>
        </header>

        <section style={styles.controls}>
          <label style={styles.field}>
            <span style={styles.label}>Project</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !projects.length}>
              {!projects.length ? <option value="">No projects found</option> : null}
              {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Estimate Snapshot</span>
            <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !snapshots.length}>
              {!snapshots.length ? <option value="">No snapshots found</option> : null}
              {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Selections Session</span>
            <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} style={styles.select} disabled={workspaceLoading || loading || !sessions.length}>
              {!sessions.length ? <option value="">New session will be created</option> : null}
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.session_name || "Client Selections"} - {titleCase(session.status)}</option>)}
            </select>
          </label>
          <div style={styles.headerLinks}>
            <Link href="/modules/builders/product-library" style={styles.secondaryLink}>Product Library</Link>
            {isInternal ? <Link href="/modules/builders/selections-book" style={styles.secondaryLink}>Selections Book</Link> : null}
          </div>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        {workspaceLoading || loading ? <div style={styles.notice}>Loading selections...</div> : null}

        <RunningSummary areaTotals={kitchenTotals} projectTotals={runningProjectTotals} currency={selectedProject?.currency} />

        {screen === "areas" ? (
          <AreasView totals={kitchenTotals} onOpenKitchen={openKitchenChecklist} currency={selectedProject?.currency} />
        ) : null}
        {screen === "checklist" ? (
          <KitchenChecklist
            requirements={KITCHEN_REQUIREMENTS}
            selectedMap={selectedMap}
            totals={kitchenTotals}
            currency={selectedProject?.currency}
            onOpenRequirement={openRequirement}
          />
        ) : null}
        {screen === "product" ? (
          <ProductSelectionView
            requirement={selectedRequirement}
            requirements={KITCHEN_REQUIREMENTS}
            selectedMap={selectedMap}
            products={visibleProducts}
            allProducts={requirementProducts}
            filters={filters}
            setFilters={setFilters}
            availableFilters={availableFilters}
            currency={selectedProject?.currency}
            saving={saving}
            onOpenRequirement={openRequirement}
            onBack={openKitchenChecklist}
            onSelect={selectProduct}
          />
        ) : null}
      </main>
    </>
  );
}

function AreasView({ totals, onOpenKitchen, currency }) {
  const complete = totals.completed === totals.total;
  return (
    <section style={styles.areaGrid}>
      <button type="button" onClick={onOpenKitchen} style={styles.areaCard}>
        <div>
          <span style={styles.areaEyebrow}>Interior</span>
          <h2 style={styles.areaTitle}>Kitchen {complete ? "✓" : ""}</h2>
          <p style={styles.panelText}>{totals.completed} / {totals.total} selections complete</p>
        </div>
        <div style={styles.areaTotals}>
          <MiniTotal label="Allowance" value={money(totals.allowance, currency)} />
          <MiniTotal label="Selected" value={money(totals.selected, currency)} />
          <MiniTotal label={totals.variation < 0 ? "Credit" : "Variation"} value={signedMoney(totals.variation, currency)} tone={totals.variation > 0 ? "bad" : totals.variation < 0 ? "good" : ""} />
        </div>
        <ChevronRight size={22} />
      </button>
      {["Bathroom 0/12", "Ensuite 0/10", "Laundry 0/6", "Bedrooms 0/15"].map((label) => (
        <div key={label} style={styles.futureArea}>{label}</div>
      ))}
    </section>
  );
}

function KitchenChecklist({ requirements, selectedMap, totals, currency, onOpenRequirement }) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Kitchen Selection Checklist</h2>
          <p style={styles.panelText}>{totals.completed} of {totals.total} completed</p>
        </div>
        <div style={styles.compactTotals}>
          <MiniTotal label="Allowance Total" value={money(totals.allowance, currency)} />
          <MiniTotal label="Selected Total" value={money(totals.selected, currency)} />
          <MiniTotal label={totals.variation < 0 ? "Current Credit" : "Current Variation"} value={signedMoney(totals.variation, currency)} tone={totals.variation > 0 ? "bad" : totals.variation < 0 ? "good" : ""} />
        </div>
      </div>
      <div style={styles.checklistRows}>
        {requirements.map((requirement) => {
          const selection = selectedMap.get(requirement.requirementKey);
          return (
            <RequirementRow
              key={requirement.requirementKey}
              requirement={requirement}
              selection={selection}
              currency={currency}
              onOpen={() => onOpenRequirement(requirement.requirementKey)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProductSelectionView({ requirement, requirements, selectedMap, products, allProducts, filters, setFilters, availableFilters, currency, saving, onOpenRequirement, onBack, onSelect }) {
  return (
    <section style={styles.selectionLayout}>
      <aside style={styles.progressNav}>
        <div style={styles.navHeader}>
          <h2>{KITCHEN_AREA_LABEL}</h2>
          <button type="button" onClick={onBack} style={styles.textButton}><ArrowLeft size={15} />Back</button>
        </div>
        {requirements.map((item) => {
          const status = statusForRequirement(item, selectedMap.get(item.requirementKey));
          const active = item.requirementKey === requirement.requirementKey;
          return (
            <button key={item.requirementKey} type="button" onClick={() => onOpenRequirement(item.requirementKey)} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}>
              <StatusDot status={status} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>
      <section style={styles.productPanel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Kitchen / {requirement.label}</h2>
            <p style={styles.panelText}>{products.length} product{products.length === 1 ? "" : "s"} matched from the shared Product Library.</p>
          </div>
          <button type="button" onClick={onBack} style={styles.primaryLightButton}><ArrowLeft size={16} />Back to Kitchen</button>
        </div>
        {availableFilters.length ? (
          <div style={styles.filterBar}>
            {availableFilters.map((filter) => (
              <label key={filter.key} style={styles.filterField}>
                <span style={styles.label}>{filter.label}</span>
                <select value={filters[filter.key] || ""} onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))} style={styles.select}>
                  <option value="">All</option>
                  {filter.values.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        {!allProducts.length ? (
          <div style={styles.empty}>
            <strong>No products have been added for {requirement.label}.</strong>
            <div style={styles.emptyActions}>
              <Link href="/modules/builders/product-library" style={styles.primaryDarkButton}><PackagePlus size={16} />Add Product</Link>
              <Link href="/modules/builders/product-library" style={styles.utilityButton}><FileUp size={16} />Import Products</Link>
              <button type="button" onClick={onBack} style={styles.utilityButton}>Back to Kitchen</button>
            </div>
          </div>
        ) : null}
        {allProducts.length && !products.length ? <div style={styles.empty}>No {requirement.label} products match the selected filters.</div> : null}
        <div style={styles.productGrid}>
          {products.map((product) => (
            <ProductCard key={product.productId || product.id || product.productCode} requirement={requirement} product={product} currency={currency} saving={saving} onSelect={() => onSelect(product)} />
          ))}
        </div>
      </section>
    </section>
  );
}

function RequirementRow({ requirement, selection, currency, onOpen }) {
  const status = statusForRequirement(requirement, selection);
  const financials = requirementFinancials(requirement, selection);
  const productName = selection?.selected_product_name || selection?.product_name || "";
  return (
    <article style={{ ...styles.requirementRow, ...styles[`row_${statusTone(status)}`] }}>
      <StatusDot status={status} />
      <img src={requirementImage(requirement, selection)} alt="" style={styles.requirementImage} />
      <div style={styles.requirementMain}>
        <h3>{requirement.label}</h3>
        <p>{productName ? `Selected: ${productName}` : "Not selected"}</p>
        {selection?.selected_details?.priceState ? <span style={styles.priceState}>{selection.selected_details.priceState}</span> : null}
      </div>
      <div style={styles.rowMoney}>
        <span>Allowance {money(financials.allowance, currency)}</span>
        <span>Selected {selection ? money(financials.selectedPrice, currency) : "Not selected"}</span>
        <strong>{signedMoney(financials.variation, currency)}</strong>
      </div>
      <button type="button" onClick={onOpen} style={status === "complete" ? styles.selectButton : styles.primaryDarkButton}>{selection ? "Change Selection" : "Select"}</button>
    </article>
  );
}

function ProductCard({ requirement, product, currency, saving, onSelect }) {
  const state = priceStateForProduct(product);
  const price = productClientPrice(product);
  const allowance = productAllowance(product, requirement);
  const quantity = requirement.defaultQuantity || 1;
  const variation = variationFor({ selectedPrice: price, allowance, quantity });
  const entity = product.metadata?.productEntity || product;
  return (
    <article style={styles.productCard}>
      <img src={requirementImage(requirement, product)} alt={entity.productName || "Product"} style={styles.productImage} />
      <div style={styles.productBody}>
        <div>
          <p style={styles.cardMeta}>{entity.brand || entity.supplier || "Product Library"}</p>
          <h3 style={styles.cardTitle}>{entity.productName || product.product_name}</h3>
          <p style={styles.cardMeta}>{entity.model ? `Model ${entity.model}` : entity.range || "Model not recorded"}</p>
        </div>
        <p style={styles.descriptionText}>{entity.description || product.description || "Product details available from the supplier."}</p>
        <p style={styles.finishLine}>{[entity.finish, entity.colour, entity.size || entity.width].filter(Boolean).join(" / ") || "Variant to be confirmed"}</p>
        <div style={styles.cardTotals}>
          <MiniTotal label="Price" value={state === PRICE_STATES.current ? money(price, currency) : state} tone={state === PRICE_STATES.current ? "" : "warn"} />
          <MiniTotal label="Allowance" value={money(allowance, currency)} />
          <MiniTotal label={variation < 0 ? "Credit" : "Upgrade"} value={signedMoney(variation, currency)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} />
        </div>
        <div style={styles.productActions}>
          <button type="button" onClick={onSelect} disabled={saving} style={styles.selectButton}>{saving ? "Saving..." : "Add To My Selections"}</button>
          {entity.specificationURL ? <a href={entity.specificationURL} target="_blank" rel="noreferrer" style={styles.utilityButton}>View Details</a> : <span style={styles.disabledButton}>View Details</span>}
          {entity.officialProductURL || entity.supplierURL ? <a href={entity.officialProductURL || entity.supplierURL} target="_blank" rel="noreferrer" style={styles.utilityButton}>Official Page <ExternalLink size={14} /></a> : null}
        </div>
      </div>
    </article>
  );
}

function RunningSummary({ areaTotals: kitchen, projectTotals: project, currency }) {
  return (
    <section style={styles.runningDock}>
      <div>
        <span style={styles.label}>Selection Budget</span>
        <strong>{project.completed} / {project.total} completed</strong>
      </div>
      <MiniTotal label="Total Allowances" value={money(project.allowance, currency)} />
      <MiniTotal label="Selections To Date" value={money(project.selected, currency)} />
      <MiniTotal label="Current Variation" value={signedMoney(project.variation, currency)} tone={project.variation > 0 ? "bad" : project.variation < 0 ? "good" : ""} />
      <MiniTotal label="Kitchen Variation" value={signedMoney(kitchen.variation, currency)} tone={kitchen.variation > 0 ? "bad" : kitchen.variation < 0 ? "good" : ""} />
    </section>
  );
}

function StatusDot({ status }) {
  return <span style={{ ...styles.statusDot, ...styles[`dot_${statusTone(status)}`] }}>{status === "complete" ? <Check size={14} /> : null}</span>;
}

function MiniTotal({ label, value, tone = "" }) {
  return (
    <div style={{ ...styles.miniTotal, ...(tone === "bad" ? styles.miniTotalBad : {}), ...(tone === "good" ? styles.miniTotalGood : {}), ...(tone === "warn" ? styles.miniTotalWarn : {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function mapDbProductToEntity(product) {
  const entity = product.metadata?.productEntity || {};
  const supplier = product.builder_product_suppliers?.supplier_name || entity.supplier || "";
  const brand = product.builder_product_manufacturers?.manufacturer_name || entity.brand || "";
  const family = familyByKey(entity.familyKey || product.metadata?.familyKey || product.selection_type);
  return {
    ...entity,
    raw: product,
    id: product.id,
    productId: product.id,
    productCode: product.sku || entity.productCode || "",
    organisationId: product.workspace_id || entity.organisationId || "",
    linkedQuoteItemCode: product.quote_structure_row_id || entity.linkedQuoteItemCode || family?.linkedQuoteItemCode || "",
    familyKey: entity.familyKey || product.metadata?.familyKey || product.selection_type || "",
    topLevelArea: entity.topLevelArea || product.metadata?.topLevelArea || family?.topLevelArea || "",
    category: product.builder_product_categories?.category_name || entity.category || product.quote_structure_section || family?.category || "",
    subcategory: entity.subcategory || product.selection_type || family?.subcategory || "",
    productName: product.product_name || entity.productName || "",
    supplier,
    brand,
    range: entity.range || product.metadata?.range || "",
    model: product.model || entity.model || "",
    description: product.description || entity.description || "",
    colour: entity.colour || product.metadata?.colour || "",
    finish: entity.finish || product.metadata?.finish || "",
    size: entity.size || product.metadata?.size || "",
    width: entity.width || product.metadata?.width || "",
    fuelType: entity.fuelType || product.metadata?.fuelType || "",
    variants: entity.variants || [],
    primaryImage: product.primary_image_url || entity.primaryImage || family?.image || "",
    officialProductURL: product.product_url || entity.officialProductURL || "",
    specificationURL: product.datasheet_pdf_url || entity.specificationURL || "",
    supplierURL: product.supplier_website_url || entity.supplierURL || "",
    clientPrice: entity.clientPrice || Number(product.upgrade_cost || 0),
    allowance: entity.allowance || Number(product.base_allowance || 0),
    builderCost: entity.builderCost || Number(product.base_allowance || 0),
    RRP: entity.RRP || 0,
    upgradePrice: Number(product.upgrade_cost || 0),
    priceStatus: entity.priceStatus || product.metadata?.priceStatus || (Number(product.upgrade_cost || 0) ? PRICE_STATES.current : PRICE_STATES.pending),
    priceReviewRequired: entity.priceReviewRequired || (!Number(product.upgrade_cost || 0) && !Number(product.base_allowance || 0)),
    metadata: { ...product.metadata, productEntity: entity },
  };
}

function money(value, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: currency || "AUD", maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function signedMoney(value, currency = "AUD") {
  const number = roundMoney(value);
  if (number === 0) return money(0, currency);
  return `${number > 0 ? "+" : "-"}${money(Math.abs(number), currency)}`;
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb", color: "#111827", padding: 18 },
  banner: { background: "#111827", color: "#fff", borderRadius: 8, padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", boxShadow: "0 18px 45px rgba(17,24,39,.16)" },
  eyebrow: { color: "#5eead4", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" },
  title: { margin: "4px 0", fontSize: 32, lineHeight: 1.08, fontWeight: 900 },
  subtitle: { margin: 0, color: "#cbd5e1", fontWeight: 700 },
  bannerMeta: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontSize: 14, color: "#e5e7eb", fontWeight: 700 },
  bannerButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#111827", border: "1px solid #fff", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  controls: { marginTop: 16, background: "#fff", border: "1px solid #d7dee8", borderRadius: 8, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  label: { color: "#475569", fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" },
  select: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#111827", padding: "10px 11px", fontSize: 14, fontWeight: 750 },
  headerLinks: { display: "flex", gap: 8, flexWrap: "wrap" },
  secondaryLink: { background: "#fff", color: "#111827", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", textDecoration: "none", fontWeight: 850 },
  error: { marginTop: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "10px 12px", fontWeight: 850 },
  success: { marginTop: 12, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 8, padding: "10px 12px", fontWeight: 850 },
  notice: { marginTop: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontWeight: 850 },
  runningDock: { position: "sticky", top: 0, zIndex: 5, marginTop: 16, background: "rgba(245,247,251,.94)", backdropFilter: "blur(8px)", padding: "8px 0", display: "grid", gridTemplateColumns: "minmax(150px,.8fr) repeat(4,minmax(150px,1fr))", gap: 10, alignItems: "stretch" },
  panel: { marginTop: 16, background: "#fff", border: "1px solid #d7dee8", borderRadius: 8, padding: 16 },
  panelHeader: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 900 },
  panelText: { margin: "4px 0 0", color: "#64748b", fontSize: 14, fontWeight: 650 },
  compactTotals: { display: "grid", gridTemplateColumns: "repeat(3,minmax(140px,1fr))", gap: 8, minWidth: 460 },
  miniTotal: { border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 11px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  miniTotalBad: { borderColor: "#fed7aa", background: "#fff7ed", color: "#9a3412" },
  miniTotalGood: { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" },
  miniTotalWarn: { borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" },
  areaGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(320px,1.2fr) repeat(auto-fit,minmax(180px,1fr))", gap: 12 },
  areaCard: { textAlign: "left", border: "1px solid #0f766e", background: "#fff", borderRadius: 8, padding: 16, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, alignItems: "center", cursor: "pointer" },
  areaEyebrow: { color: "#0f766e", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  areaTitle: { margin: "4px 0", fontSize: 24, fontWeight: 900 },
  areaTotals: { display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 8 },
  futureArea: { border: "1px solid #d7dee8", borderRadius: 8, background: "#fff", padding: 16, color: "#64748b", fontWeight: 850 },
  checklistRows: { display: "grid", gap: 10 },
  requirementRow: { border: "1px solid #d7dee8", borderRadius: 8, background: "#fff", padding: 12, display: "grid", gridTemplateColumns: "28px 74px minmax(180px,1fr) minmax(180px,.8fr) auto", gap: 12, alignItems: "center" },
  row_grey: { borderColor: "#d7dee8" },
  row_amber: { borderColor: "#fde68a", background: "#fffbeb" },
  row_green: { borderColor: "#a7f3d0", background: "#f0fdf4" },
  row_red: { borderColor: "#fecaca", background: "#fff1f2" },
  requirementImage: { width: 74, height: 58, borderRadius: 8, objectFit: "cover", background: "#e2e8f0" },
  requirementMain: { minWidth: 0 },
  priceState: { display: "inline-flex", marginTop: 5, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 999, padding: "3px 7px", fontSize: 12, fontWeight: 850 },
  rowMoney: { display: "flex", flexDirection: "column", gap: 4, color: "#475569", fontSize: 13, fontWeight: 750 },
  statusDot: { width: 24, height: 24, borderRadius: 999, border: "2px solid", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  dot_grey: { background: "#f1f5f9", color: "#64748b", borderColor: "#cbd5e1" },
  dot_amber: { background: "#fef3c7", color: "#92400e", borderColor: "#f59e0b" },
  dot_green: { background: "#dcfce7", color: "#15803d", borderColor: "#22c55e" },
  dot_red: { background: "#fee2e2", color: "#b91c1c", borderColor: "#ef4444" },
  selectionLayout: { marginTop: 16, display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 16, alignItems: "start" },
  progressNav: { position: "sticky", top: 92, background: "#fff", border: "1px solid #d7dee8", borderRadius: 8, padding: 12 },
  navHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  textButton: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: "#0f766e", border: 0, padding: 0, fontWeight: 900, cursor: "pointer" },
  navItem: { width: "100%", display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid transparent", borderRadius: 8, padding: "8px 9px", color: "#111827", fontWeight: 800, cursor: "pointer", textAlign: "left" },
  navItemActive: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" },
  productPanel: { background: "#fff", border: "1px solid #d7dee8", borderRadius: 8, padding: 16 },
  primaryLightButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "#f8fafc", color: "#111827", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  filterBar: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 },
  filterField: { display: "flex", flexDirection: "column", gap: 6 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", color: "#475569", padding: 18, fontWeight: 800 },
  emptyActions: { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 },
  productCard: { border: "1px solid #d7dee8", borderRadius: 8, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" },
  productImage: { width: "100%", aspectRatio: "16 / 10", objectFit: "cover", background: "#e2e8f0" },
  productBody: { padding: 13, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  cardMeta: { margin: "2px 0", color: "#64748b", fontSize: 13, fontWeight: 750 },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  descriptionText: { margin: 0, color: "#334155", fontSize: 14, fontWeight: 650, lineHeight: 1.45 },
  finishLine: { margin: 0, color: "#111827", fontSize: 13, fontWeight: 850 },
  cardTotals: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 },
  productActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" },
  selectButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "#0f766e", color: "#fff", border: "1px solid #0f766e", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer", textDecoration: "none" },
  primaryDarkButton: { display: "inline-flex", alignItems: "center", gap: 7, background: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer", textDecoration: "none" },
  utilityButton: { display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#111827", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px", fontWeight: 850, cursor: "pointer", textDecoration: "none" },
  disabledButton: { border: "1px solid #e2e8f0", borderRadius: 8, color: "#94a3b8", padding: "9px 11px", fontWeight: 850 },
};
