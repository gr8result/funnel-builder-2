import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, ExternalLink, Eye, FileText, Home, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";
import {
  ALL_GUIDED_REQUIREMENTS,
  EXTERIOR_REQUIREMENTS,
  INTERIOR_REQUIREMENTS,
  KITCHEN_AREA_LABEL,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  areaTotals,
  createSelectionPayloadFromProduct,
  filtersForRequirement,
  guidedRequirementByKey,
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
import { GENERIC_IMAGE_URLS, familyByKey } from "../../../lib/product-library/catalogueModel";
import {
  createFinalInclusionsDocumentVersion,
  createProjectInclusionsSnapshot,
  isFinalInclusionsDocumentOutOfDate,
  renderFinalInclusionsScheduleHtml,
} from "../../../lib/builders/finalInclusionsSchedule";

const SELECTION_COLUMNS = "id, session_id, snapshot_id, category, subcategory, room, title, description, allowance_amount, selected_product_name, selected_supplier_name, selected_colour, selected_finish, selected_details, status, selected_at, metadata, created_at, updated_at, brand, product_name, model_number, image_url, specification_url, finish, colour, included_allowance, client_selection_price, calculated_client_selection_price, variation_amount, selection_status, is_active";
const SESSION_COLUMNS = "id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, warning_threshold_percent, selection_budget_status, status, metadata, created_at, updated_at";
const PRODUCT_COLUMNS = "*, builder_product_suppliers(supplier_name), builder_product_manufacturers(manufacturer_name), builder_product_categories(category_name)";

const AREA_CARDS = [
  { key: "exterior", title: "Exterior", image: GENERIC_IMAGE_URLS.exterior, fallback: visualPlaceholder("Exterior", ""), requirements: EXTERIOR_REQUIREMENTS },
  { key: "interior", title: "Interior", image: GENERIC_IMAGE_URLS.interior, fallback: visualPlaceholder("Interior", ""), requirements: [...INTERIOR_REQUIREMENTS, ...KITCHEN_REQUIREMENTS] },
];
const AREA_CATEGORY_TEST_IDS = {
  exterior: "showroom-exterior-categories",
  interior: "showroom-interior-categories",
};

const DEMO_PRODUCTS = {
  oven: [
    demoProduct("westinghouse-900-oven", "Westinghouse", "900mm Built-In Oven", "WVE916SC", "Stainless Steel", 1200, 1450, visualPlaceholder("Oven", "stainless built-in oven")),
    demoProduct("bosch-serie-6-oven", "Bosch", "Serie 6 Built-In Oven", "HBA534BS0A", "Stainless Steel", 1200, 1780, visualPlaceholder("Oven", "premium wall oven")),
    demoProduct("smeg-classic-oven", "Smeg", "Classic Built-In Oven", "SFA6301TVX", "Stainless Steel", 1200, 2380, visualPlaceholder("Oven", "classic appliance")),
  ],
  bricks: [
    demoProduct("austral-brick", "Austral", "La Paloma Face Brick", "Miro", "White / Textured", 0, 0, visualPlaceholder("Bricks", "brick wall swatches")),
    demoProduct("pg-h-brick", "PGH", "Morada Brick", "Cuero", "Warm red / Textured", 0, 650, visualPlaceholder("Bricks", "warm face brick")),
  ],
  roofing: [
    demoProduct("colorbond-corrugated", "Colorbond", "Corrugated Roofing", "Classic", "Monument", 0, 0, GENERIC_IMAGE_URLS.roofing, swatches(["Monument", "#252a2e"], ["Surfmist", "#dddcd2"], ["Woodland Grey", "#4d5148"])),
    demoProduct("colorbond-standing-seam", "Colorbond", "Architectural Standing Seam", "Premium", "Monument", 0, 4200, GENERIC_IMAGE_URLS.roofing, swatches(["Monument", "#252a2e"], ["Basalt", "#6b6e70"], ["Dune", "#b8ad9c"])),
  ],
};

export default function BuilderClientSelectionsPage() {
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selections, setSelections] = useState([]);
  const [demoSelections, setDemoSelections] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [screen, setScreen] = useState("areas");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedRequirementKey, setSelectedRequirementKey] = useState("");
  const [detailProduct, setDetailProduct] = useState(null);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [finalScheduleDocument, setFinalScheduleDocument] = useState(null);
  const [finalScheduleGenerating, setFinalScheduleGenerating] = useState(false);

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
        supabase.from("builder_estimate_snapshots").select("id, snapshot_number, snapshot_label, status, source_quote_number, final_quote_total, created_at").eq("workspace_id", workspaceId).eq("project_id", selectedProjectId).order("snapshot_number", { ascending: false }),
        supabase.from("builder_selection_sessions").select(SESSION_COLUMNS).eq("workspace_id", workspaceId).eq("project_id", selectedProjectId).order("created_at", { ascending: false }),
        supabase.from("builder_client_selections").select(SELECTION_COLUMNS).eq("workspace_id", workspaceId).eq("project_id", selectedProjectId).order("updated_at", { ascending: false }),
        supabase.from("builder_products").select(PRODUCT_COLUMNS).eq("workspace_id", workspaceId).eq("active", true).order("updated_at", { ascending: false }),
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

  const persistedSelections = workspaceId ? selections : demoSelections;
  const sessionSelections = useMemo(() => persistedSelections.filter((selection) => {
    if (selectedSessionId) return selection.session_id === selectedSessionId;
    if (selectedSnapshotId) return selection.snapshot_id === selectedSnapshotId;
    return true;
  }), [selectedSessionId, selectedSnapshotId, persistedSelections]);
  const activeSelections = useMemo(() => sessionSelections.filter((selection) => selection.is_active !== false && !["replaced", "removed"].includes(selection.selection_status || selection.status)), [sessionSelections]);
  const selectedMap = useMemo(() => selectedByRequirement(activeSelections, ALL_GUIDED_REQUIREMENTS), [activeSelections]);
  const kitchenMap = useMemo(() => selectedByRequirement(activeSelections, KITCHEN_REQUIREMENTS), [activeSelections]);
  const exteriorTotals = useMemo(() => areaTotals(EXTERIOR_REQUIREMENTS, selectedMap), [selectedMap]);
  const interiorTotals = useMemo(() => areaTotals(INTERIOR_REQUIREMENTS, selectedMap), [selectedMap]);
  const kitchenTotals = useMemo(() => areaTotals(KITCHEN_REQUIREMENTS, kitchenMap), [kitchenMap]);
  const runningProjectTotals = useMemo(() => projectTotals([exteriorTotals, interiorTotals, kitchenTotals]), [exteriorTotals, interiorTotals, kitchenTotals]);
  const selectionBudget = useMemo(() => {
    const originalEstimateTotal = selectedSession?.original_estimate_total || selectedSnapshot?.final_quote_total || selectedProject?.original_estimate_total || selectedProject?.contract_total || 0;
    return calculateSessionBudget({
      originalEstimateTotal,
      privateUpgradeCeiling: selectedSession?.private_upgrade_ceiling || 0,
      warningThresholdPercent: selectedSession?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: activeSelections,
    });
  }, [activeSelections, selectedProject, selectedSession, selectedSnapshot]);
  const finalScheduleSnapshot = useMemo(() => createProjectInclusionsSnapshot({
    project: selectedProject || { id: selectedProjectId || "demo-project", project_name: "Project Selections", currency: "AUD" },
    workspaceId: workspaceId || "demo-workspace",
    selections: activeSelections,
    session: selectedSession || { id: selectedSessionId || "demo-session", project_id: selectedProjectId || "demo-project", snapshot_id: selectedSnapshotId || "demo-snapshot", status: activeSelections.length ? "ready" : "draft" },
    estimateSnapshot: selectedSnapshot || { id: selectedSnapshotId || "demo-snapshot" },
    generatedBy: "client-selections-ui",
    masterTemplate: { id: "premier-inclusions-master", version: "native-master", pageCount: 10 },
    masterPdfRef: { storagePath: "standard-inclusions/premier-inclusions-master.pdf", pageCount: 10 },
  }), [activeSelections, selectedProject, selectedProjectId, selectedSession, selectedSessionId, selectedSnapshot, selectedSnapshotId, workspaceId]);
  const finalScheduleOutOfDate = useMemo(() => isFinalInclusionsDocumentOutOfDate(finalScheduleDocument, activeSelections), [activeSelections, finalScheduleDocument]);

  const selectedRequirement = useMemo(() => guidedRequirementByKey(selectedRequirementKey) || KITCHEN_REQUIREMENTS[7], [selectedRequirementKey]);
  const activeRequirementList = selectedRequirement?.areaKey === "exterior" ? EXTERIOR_REQUIREMENTS : KITCHEN_REQUIREMENTS;
  const requirementProducts = useMemo(() => productsForRequirement(products, selectedRequirement), [products, selectedRequirement]);
  const availableFilters = useMemo(() => filtersForRequirement(selectedRequirement, requirementProducts), [selectedRequirement, requirementProducts]);
  const visibleProducts = useMemo(() => {
    const filtered = requirementProducts.filter((product) => availableFilters.every((filter) => {
      const selected = filters[filter.key];
      if (!selected) return true;
      const entity = product.metadata?.productEntity || product;
      return (entity[filter.key] || product[filter.key] || product.metadata?.[filter.key] || "") === selected;
    }));
    return filtered.length ? filtered : placeholderProducts(selectedRequirement);
  }, [availableFilters, filters, requirementProducts, selectedRequirement]);

  function openAreas() {
    setScreen("areas");
    setSelectedArea("");
    setSelectedRequirementKey("");
    setDetailProduct(null);
  }

  function openArea(areaKey) {
    setSelectedArea(areaKey);
    setScreen("area");
    setSelectedRequirementKey("");
    setDetailProduct(null);
  }

  function openKitchenChecklist() {
    setSelectedArea("interior");
    setScreen("checklist");
    setSelectedRequirementKey("");
    setDetailProduct(null);
    setFilters({});
  }

  function openRequirement(requirementKey) {
    setSelectedRequirementKey(requirementKey);
    setScreen("product");
    setDetailProduct(null);
    setFilters({});
  }

  function openCategory(requirement) {
    if (requirement.requirementKey === "kitchen") {
      openKitchenChecklist();
      return;
    }
    openRequirement(requirement.requirementKey);
  }

  function nextRequirementKey() {
    const index = activeRequirementList.findIndex((item) => item.requirementKey === selectedRequirement.requirementKey);
    return activeRequirementList[index + 1]?.requirementKey || "";
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
      metadata: { source: "client_selection_showroom" },
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
      const payload = {
        ...createSelectionPayloadFromProduct({
          workspaceId: workspaceId || "demo-workspace",
          projectId: selectedProjectId || "demo-project",
          snapshotId: selectedSnapshotId || "demo-snapshot",
          sessionId: selectedSessionId || "demo-session",
          requirement: selectedRequirement,
          product,
          userId: null,
        }),
        id: `demo-${selectedRequirement.requirementKey}-${Date.now()}`,
      };
      setDemoSelections((current) => [payload, ...current.map((selection) => selection.selected_details?.requirementKey === selectedRequirement.requirementKey ? { ...selection, selection_status: "replaced", status: "changed", is_active: false } : selection)]);
      setSuccess(`${selectedRequirement.label} selected. ${nextRequirementKey() ? `Next: ${guidedRequirementByKey(nextRequirementKey())?.label}` : "Area complete."}`);
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
        const { error: previousError } = await supabase.from("builder_client_selections").update({ selection_status: "replaced", status: "changed", is_active: false, updated_by: userId, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", previous.id);
        if (previousError) throw previousError;
      }
      const { data: inserted, error: insertError } = await supabase.from("builder_client_selections").insert(payload).select(SELECTION_COLUMNS).single();
      if (insertError) throw insertError;
      const nextSelections = [inserted, ...selections.map((selection) => previous?.id === selection.id ? { ...selection, selection_status: "replaced", status: "changed", is_active: false } : selection)];
      setSelections(nextSelections);
      await persistBudget(session.id, nextSelections.filter((selection) => selection.session_id === session.id && selection.is_active !== false && !["replaced", "removed"].includes(selection.selection_status || selection.status)), userId);
      setSuccess(`${selectedRequirement.label} selected. ${nextRequirementKey() ? `Next: ${guidedRequirementByKey(nextRequirementKey())?.label}` : "Area complete."}`);
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

  async function generateFinalSchedule() {
    if (!workspaceId || !selectedProjectId) {
      setError("Select a project before generating the Final Inclusions Schedule PDF.");
      return;
    }
    setFinalScheduleGenerating(true);
    setError("");
    setSuccess("");
    const generatedAt = new Date().toISOString();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      if (!token) throw new Error("Sign in before generating the Final Inclusions Schedule.");
      const response = await fetch("/api/builders/final-inclusions-schedule/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          projectId: selectedProjectId,
          sessionId: selectedSessionId,
          snapshotId: selectedSnapshotId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Final selections schedule could not be generated.");
      setFinalScheduleDocument(payload.document);
      setSuccess(`${payload.document?.title || "Final Inclusions Schedule"} v${payload.document?.version || ""} generated and stored.`);
    } catch (generateError) {
      const fallbackDocument = createFinalInclusionsDocumentVersion({
        snapshot: finalScheduleSnapshot,
        previousDocuments: finalScheduleDocument ? [finalScheduleDocument] : [],
        generatedAt,
      });
      setFinalScheduleDocument({ ...fallbackDocument, status: "failed", metadata: { ...fallbackDocument.metadata, status: "failed", failure: generateError.message } });
      setError(generateError.message || "Final selections schedule could not be generated.");
    } finally {
      setFinalScheduleGenerating(false);
    }
  }

  function downloadFinalScheduleHtml() {
    const document = finalScheduleDocument || createFinalInclusionsDocumentVersion({ snapshot: finalScheduleSnapshot, generatedAt: new Date().toISOString() });
    const html = renderFinalInclusionsScheduleHtml(document.metadata.selectionSnapshot);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = document.fileName.replace(/\.pdf$/i, ".html");
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    if (!finalScheduleDocument) setFinalScheduleDocument(document);
  }

  const areaTotalsByKey = { exterior: exteriorTotals, interior: projectTotals([interiorTotals, kitchenTotals]) };
  const currentAreaTitle = selectedArea ? titleCase(selectedArea) : "Choose an Area";

  return (
    <>
      <Head><title>Inclusions & Selections</title></Head>
      <main className="showroom">
        <header className="showroomBanner">
          <button type="button" className="backButton" onClick={screen === "areas" ? () => window.history.back() : openAreas}><ArrowLeft size={17} />Back</button>
          <div className="bannerIcon"><Home size={24} /></div>
          <div className="bannerCopy">
            <span>INCLUSIONS & SELECTIONS</span>
            <h1>{selectedProject?.project_name || "Project Selections"}</h1>
            <p>{selectedSnapshot?.source_quote_number ? `Job ${selectedSnapshot.source_quote_number}` : "Job number pending"} - {selectedProject?.client_name || "Client"} - {selectedProject?.site_address || "Site address pending"}</p>
          </div>
          <div className="bannerMeta">
            <span>Progress <strong>{runningProjectTotals.completed} / {runningProjectTotals.total}</strong></span>
            <span>Current Variation <strong className={runningProjectTotals.variation > 0 ? "upgradeText" : runningProjectTotals.variation < 0 ? "creditText" : ""}>{signedMoney(runningProjectTotals.variation, selectedProject?.currency)}</strong></span>
            <em>{saving ? "Saving..." : success ? "Saved" : "Ready"}</em>
          </div>
        </header>

        <section className="setupControls">
          <label><span>Project</span><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={workspaceLoading || loading || !projects.length}>{!projects.length ? <option value="">No projects found</option> : null}{projects.map((project) => <option key={project.id} value={project.id}>{project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}</option>)}</select></label>
          <label><span>Estimate</span><select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} disabled={workspaceLoading || loading || !snapshots.length}>{!snapshots.length ? <option value="">No snapshots found</option> : null}{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}</option>)}</select></label>
          <label><span>Session</span><select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} disabled={workspaceLoading || loading || !sessions.length}>{!sessions.length ? <option value="">New session will be created</option> : null}{sessions.map((session) => <option key={session.id} value={session.id}>{session.session_name || "Client Selections"} - {titleCase(session.status)}</option>)}</select></label>
        </section>

        {error ? <div className="alert error">{error}</div> : null}
        {success ? <div className="alert success">{success} {nextRequirementKey() && screen === "product" ? <button type="button" onClick={() => openRequirement(nextRequirementKey())}>Next: {guidedRequirementByKey(nextRequirementKey())?.label}</button> : null}</div> : null}
        {workspaceLoading || loading ? <div className="alert notice">Loading selections...</div> : null}

        <RunningSummary project={runningProjectTotals} currency={selectedProject?.currency} />
        <FinalInclusionsSchedulePanel
          snapshot={finalScheduleSnapshot}
          document={finalScheduleDocument}
          outOfDate={finalScheduleOutOfDate}
          generating={finalScheduleGenerating}
          currency={selectedProject?.currency}
          onGenerate={generateFinalSchedule}
          onDownload={downloadFinalScheduleHtml}
        />

        {screen === "areas" ? <AreasView totalsByKey={areaTotalsByKey} onOpenArea={openArea} currency={selectedProject?.currency} /> : null}
        {screen === "area" ? <AreaCategories areaKey={selectedArea} title={currentAreaTitle} selectedMap={selectedMap} kitchenTotals={kitchenTotals} onOpenCategory={openCategory} currency={selectedProject?.currency} /> : null}
        {screen === "checklist" ? <KitchenChecklist selectedMap={kitchenMap} totals={kitchenTotals} currency={selectedProject?.currency} onOpenRequirement={openRequirement} /> : null}
        {screen === "product" ? (
          <ProductSelectionView
            requirement={selectedRequirement}
            requirements={activeRequirementList}
            selectedMap={selectedRequirement.areaKey === "exterior" ? selectedMap : kitchenMap}
            products={visibleProducts}
            libraryProductCount={requirementProducts.length}
            filters={filters}
            setFilters={setFilters}
            availableFilters={availableFilters}
            currency={selectedProject?.currency}
            saving={saving}
            onOpenRequirement={openRequirement}
            onBack={selectedRequirement.areaKey === "exterior" ? () => openArea("exterior") : openKitchenChecklist}
            onDetail={setDetailProduct}
            onSelect={selectProduct}
            onNext={() => nextRequirementKey() ? openRequirement(nextRequirementKey()) : openArea(selectedRequirement.areaKey)}
          />
        ) : null}
        {detailProduct ? <ProductDetails product={detailProduct} requirement={selectedRequirement} currency={selectedProject?.currency} saving={saving} onClose={() => setDetailProduct(null)} onSelect={() => { selectProduct(detailProduct); setDetailProduct(null); }} /> : null}
      </main>
      <style jsx global>{showroomCss}</style>
    </>
  );
}

BuilderClientSelectionsPage.disableLayout = true;

function AreasView({ totalsByKey, onOpenArea, currency }) {
  return (
    <section className="showroomSection" data-testid="showroom-choose-area">
      <div className="sectionHeader"><span>Choose an Area</span><h2>Professional selections showroom</h2></div>
      <div className="areaGrid">
        {AREA_CARDS.map((area) => {
          const totals = totalsByKey[area.key] || { completed: 0, total: area.requirements.length, variation: 0 };
          return (
            <button key={area.key} type="button" className="areaCard" onClick={() => onOpenArea(area.key)}>
              <img src={area.fallback || area.image} alt={`${area.title} residential selections`} onError={(event) => { event.currentTarget.src = area.fallback; }} />
              <div className="areaOverlay">
                <h3>{area.title}</h3>
                <p>{totals.completed} of {totals.total} selections complete</p>
                <span className={totals.variation > 0 ? "upgradeText" : totals.variation < 0 ? "creditText" : ""}>{signedMoney(totals.variation, currency)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AreaCategories({ areaKey, title, selectedMap, kitchenTotals, onOpenCategory, currency }) {
  const requirements = areaKey === "exterior" ? EXTERIOR_REQUIREMENTS : INTERIOR_REQUIREMENTS;
  return (
    <section className="showroomSection" data-testid={AREA_CATEGORY_TEST_IDS[areaKey] || "showroom-area-categories"}>
      <div className="sectionHeader"><span>{title}</span><h2>Choose a selection category</h2></div>
      <div className="categoryGrid">
        {requirements.map((requirement) => {
          const selection = selectedMap.get(requirement.requirementKey);
          const totals = requirement.requirementKey === "kitchen" ? kitchenTotals : null;
          const status = requirement.requirementKey === "kitchen" && totals.completed ? (totals.completed === totals.total ? "complete" : "incomplete") : statusForRequirement(requirement, selection);
          return <CategoryCard key={requirement.requirementKey} requirement={requirement} status={status} selection={selection} totals={totals} currency={currency} onOpen={() => onOpenCategory(requirement)} />;
        })}
      </div>
    </section>
  );
}

function CategoryCard({ requirement, status, selection, totals, currency, onOpen }) {
  const fallback = visualPlaceholder(requirement.label, requirement.imageKey);
  const image = requirementImage(requirement);
  const label = status === "complete" ? "Selected" : status === "incomplete" ? "In Progress" : "Not Started";
  return (
    <button type="button" className={`categoryCard ${statusTone(status)}`} onClick={onOpen} data-image-key={requirement.imageKey}>
      <img src={image} alt={`${requirement.label} selections`} onError={(event) => { event.currentTarget.src = fallback; }} />
      <div className="categoryBody">
        <div><h3>{requirement.label}</h3><p>{label}</p></div>
        {selection ? <img className="selectedThumb" src={selection.image_url || image} alt="" onError={(event) => { event.currentTarget.src = fallback; }} /> : null}
        {totals ? <span>{totals.completed} / {totals.total} - {signedMoney(totals.variation, currency)}</span> : <span>{selection?.selected_product_name || "Open showroom"}</span>}
      </div>
    </button>
  );
}

function KitchenChecklist({ selectedMap, totals, currency, onOpenRequirement }) {
  return (
    <section className="showroomSection" data-testid="showroom-kitchen-checklist">
      <div className="checklistHeader">
        <div><span>KITCHEN</span><h2>Selection checklist</h2><p>{totals.completed} of {totals.total} complete</p></div>
        <div className="summaryTiles"><MiniTotal label="Allowance" value={money(totals.allowance, currency)} /><MiniTotal label="Selected" value={money(totals.selected, currency)} /><MiniTotal label="Variation" value={signedMoney(totals.variation, currency)} tone={totals.variation > 0 ? "bad" : totals.variation < 0 ? "good" : ""} /></div>
        <button type="button" className="visualiseButton"><Eye size={16} />Visualise Room</button>
      </div>
      <div className="checklistRows">
        {KITCHEN_REQUIREMENTS.map((requirement) => <RequirementRow key={requirement.requirementKey} requirement={requirement} selection={selectedMap.get(requirement.requirementKey)} currency={currency} onOpen={() => onOpenRequirement(requirement.requirementKey)} />)}
      </div>
    </section>
  );
}

function ProductSelectionView({ requirement, requirements, selectedMap, products, libraryProductCount, filters, setFilters, availableFilters, currency, saving, onOpenRequirement, onBack, onDetail, onSelect, onNext }) {
  return (
    <section className="productLayout" data-testid={`showroom-${requirement.requirementKey}-product-grid`}>
      <aside className="progressNav">
        <div className="navHeader"><h2>{requirement.areaLabel === "Exterior" ? "Exterior" : KITCHEN_AREA_LABEL}</h2><button type="button" onClick={onBack}><ArrowLeft size={15} />Back</button></div>
        {requirements.map((item) => {
          const status = statusForRequirement(item, selectedMap.get(item.requirementKey));
          return <button key={item.requirementKey} type="button" className={item.requirementKey === requirement.requirementKey ? "navItem active" : "navItem"} onClick={() => onOpenRequirement(item.requirementKey)}><StatusDot status={status} />{item.label}</button>;
        })}
      </aside>
      <section className="productPanel">
        <div className="productHeader">
          <div className="sectionHeader"><span>{requirement.areaLabel} / {requirement.label}</span><h2>Choose your product</h2><p>{libraryProductCount ? `${products.length} matching approved option${products.length === 1 ? "" : "s"}` : "Category-specific showroom placeholders until approved products are added."}</p></div>
          <button type="button" onClick={onBack}><ArrowLeft size={16} />{requirement.areaLabel === "Exterior" ? "Back to Exterior" : "Back to Kitchen"}</button>
        </div>
        {availableFilters.length ? <div className="filterBar">{availableFilters.map((filter) => <label key={filter.key}><span>{filter.label}</span><select value={filters[filter.key] || ""} onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}><option value="">All</option>{filter.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div> : null}
        {!libraryProductCount ? <div className="clientNote">Your builder will confirm final supplier availability for this category.</div> : null}
        <div className="productGrid">
          {products.map((product) => <ProductCard key={product.productId || product.id || product.productCode} requirement={requirement} product={product} currency={currency} saving={saving} onDetail={() => onDetail(product)} onSelect={() => onSelect(product)} />)}
        </div>
        <button type="button" className="nextButton" onClick={onNext}>Next Selection <ChevronRight size={16} /></button>
      </section>
    </section>
  );
}

function RequirementRow({ requirement, selection, currency, onOpen }) {
  const status = statusForRequirement(requirement, selection);
  const financials = requirementFinancials(requirement, selection);
  const productName = selection?.selected_product_name || selection?.product_name || "";
  const thumbnail = selection?.image_url || visualPlaceholder(requirement.label, requirement.imageKey);
  return (
    <article className={`requirementRow ${statusTone(status)}`} data-testid={`selection-row-${requirement.requirementKey}`}>
      <StatusDot status={status} />
      <img src={thumbnail} alt="" onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} />
      <div className="rowMain"><h3>{requirement.label}</h3><p>{productName || "Not selected"}</p>{selection?.selected_finish || selection?.finish ? <em>{selection.selected_finish || selection.finish}</em> : null}</div>
      <div className="rowMoney"><span>Allowance {money(financials.allowance, currency)}</span><span>Selected {selection ? money(financials.selectedPrice, currency) : "Not selected"}</span><strong className={financials.variation > 0 ? "upgradeText" : financials.variation < 0 ? "creditText" : ""}>{signedMoney(financials.variation, currency)}</strong></div>
      <button type="button" onClick={onOpen}>{selection ? "Change" : "Select"}</button>
    </article>
  );
}

function ProductCard({ requirement, product, currency, saving, onDetail, onSelect }) {
  const state = priceStateForProduct(product);
  const price = productClientPrice(product);
  const allowance = productAllowance(product, requirement);
  const variation = state === PRICE_STATES.current ? variationFor({ selectedPrice: price, allowance, quantity: requirement.defaultQuantity || 1 }) : 0;
  const entity = product.metadata?.productEntity || product;
  return (
    <article className="productCard">
      <img src={requirementImage(requirement, product)} alt={entity.productName || "Product"} onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} />
      <div className="productBody">
        <span>{entity.brand || entity.supplier || "Approved Range"}</span>
        <h3>{entity.productName || product.product_name}</h3>
        <p>{entity.model ? `Model ${entity.model}` : entity.range || "Model to be confirmed"}</p>
        <em>{[entity.colour, entity.finish, entity.size || entity.width].filter(Boolean).join(" / ") || "Finish to be confirmed"}</em>
        <div className="summaryTiles"><MiniTotal label="Price" value={state === PRICE_STATES.current ? money(price, currency) : state} tone={state === PRICE_STATES.current ? "" : "warn"} /><MiniTotal label="Allowance" value={money(allowance, currency)} /><MiniTotal label={variation < 0 ? "Credit" : "Upgrade"} value={signedMoney(variation, currency)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} /></div>
        <div className="cardActions"><button type="button" onClick={onDetail}>View Details</button><button type="button" className="primary" disabled={saving} onClick={onSelect}>{saving ? "Saving..." : "Select"}</button></div>
      </div>
    </article>
  );
}

function ProductDetails({ product, requirement, currency, saving, onClose, onSelect }) {
  const entity = product.metadata?.productEntity || product;
  const state = priceStateForProduct(product);
  const price = productClientPrice(product);
  const allowance = productAllowance(product, requirement);
  const variation = state === PRICE_STATES.current ? variationFor({ selectedPrice: price, allowance, quantity: requirement.defaultQuantity || 1 }) : 0;
  const swatchValues = product.colourSwatches || entity.colourSwatches || product.swatches || [];
  return (
    <div className="modalScrim" data-testid="showroom-product-detail">
      <section className="detailPanel">
        <div className="detailGallery"><img src={requirementImage(requirement, product)} alt={entity.productName || "Product"} onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} /><div>{[requirementImage(requirement, product), ...(entity.galleryImages || [])].slice(0, 4).map((image) => <img key={image} src={image} alt="" onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} />)}</div></div>
        <div className="detailInfo">
          <span>{entity.brand || entity.supplier || "Approved Range"}</span>
          <h2>{entity.productName || product.product_name}</h2>
          <dl>{detail("Model", entity.model)}{detail("Range", entity.range)}{detail("Colour", entity.colour)}{detail("Finish", entity.finish)}{detail("Size", entity.size || entity.width)}{detail("Dimensions", entity.dimensions?.label || entity.dimensions)}</dl>
          {swatchValues.length ? <div className="swatches"><strong>Colour</strong>{swatchValues.map((item) => <span key={item.name || item.label} title={item.name || item.label} style={{ background: item.value || item.hex || item.colour }} />)}</div> : null}
          <div className="summaryTiles"><MiniTotal label="Price" value={state === PRICE_STATES.current ? money(price, currency) : state} tone={state === PRICE_STATES.current ? "" : "warn"} /><MiniTotal label="Allowance" value={money(allowance, currency)} /><MiniTotal label={variation < 0 ? "Credit" : "Upgrade"} value={signedMoney(variation, currency)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} /></div>
          <div className="detailActions">{entity.officialProductURL ? <a href={entity.officialProductURL} target="_blank" rel="noreferrer">View Official Product Page <ExternalLink size={14} /></a> : null}<button type="button" className="primary" disabled={saving} onClick={onSelect}>Select This Product</button><button type="button" onClick={onClose}>Back</button></div>
        </div>
      </section>
    </div>
  );
}

function RunningSummary({ project, currency }) {
  return <section className="runningBar" data-testid="showroom-running-variation"><div><span>SELECTIONS SUMMARY</span><strong>{project.completed} / {project.total}</strong></div><MiniTotal label="Allowance" value={money(project.allowance, currency)} /><MiniTotal label="Selected" value={money(project.selected, currency)} /><MiniTotal label="Variation" value={signedMoney(project.variation, currency)} tone={project.variation > 0 ? "bad" : project.variation < 0 ? "good" : ""} /></section>;
}

function FinalInclusionsSchedulePanel({ snapshot, document, outOfDate, generating, currency, onGenerate, onDownload }) {
  const variation = snapshot?.summary?.currentNetSelectionVariation || 0;
  const generatedLabel = document?.uploadedAt ? new Date(document.uploadedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "";
  const pdfUrl = document?.publicUrl || document?.public_url || "";
  const generated = document && document.status !== "failed";
  const failed = document?.status === "failed";
  return (
    <section className="finalSchedulePanel" data-testid="final-inclusions-schedule-panel">
      <div className="finalScheduleTitle">
        <span><FileText size={17} />PROJECT INCLUSIONS</span>
        <h2>Final Inclusions Schedule</h2>
        <p>{generating ? "Generating PDF..." : failed ? "Final selections schedule could not be generated." : generated ? `Generated v${document.version}${generatedLabel ? ` - ${generatedLabel}` : ""}` : "Generate the client-facing inclusions schedule from the current approved selections."}</p>
      </div>
      <div className="summaryTiles">
        <MiniTotal label="Selections" value={String(snapshot?.summary?.productCount || 0)} />
        <MiniTotal label="Dynamic Pages" value={String(snapshot?.summary?.dynamicPageCount || 0)} />
        <MiniTotal label="Template Pages" value={String(snapshot?.summary?.masterPageCount || 0)} />
        <MiniTotal label="Variation" value={signedMoney(variation, currency)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} />
      </div>
      {document ? (
        <div className={failed || outOfDate ? "scheduleStatus warn" : "scheduleStatus"}>
          <strong>{failed ? "Failed" : outOfDate ? "Out of date" : "Current"}</strong>
          <span>{document.storagePath}</span>
        </div>
      ) : null}
      <div className="finalScheduleActions">
        <button type="button" className="primary" disabled={generating} onClick={onGenerate}>{generating ? <RefreshCw size={16} /> : document ? <RefreshCw size={16} /> : <FileText size={16} />}{generating ? "Generating PDF..." : outOfDate ? "Generate Updated Schedule" : document ? "Regenerate PDF" : "Generate Final Schedule"}</button>
        {pdfUrl && !failed ? <a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open Final Schedule</a> : null}
        {pdfUrl && !failed ? <a href={pdfUrl} download={document.fileName || "final-inclusions-schedule.pdf"}><Download size={16} />Download PDF</a> : null}
        <button type="button" onClick={onDownload}><Download size={16} />HTML Preview</button>
      </div>
    </section>
  );
}

function MiniTotal({ label, value, tone = "" }) {
  return <div className={`miniTotal ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function StatusDot({ status }) {
  return <span className={`statusDot ${statusTone(status)}`}>{status === "complete" ? <Check size={14} /> : null}</span>;
}

function detail(label, value) {
  if (!value || typeof value === "object") return null;
  return <div key={label}><dt>{label}</dt><dd>{value}</dd></div>;
}

function placeholderProducts(requirement) {
  return DEMO_PRODUCTS[requirement.requirementKey] || [
    demoProduct(`${requirement.requirementKey}-allowance`, "Approved Range", `${requirement.label} Selection`, "Allowance", "Quote Required", requirement.defaultAllowance, 0, visualPlaceholder(requirement.label, requirement.imageKey)),
  ];
}

function demoProduct(id, brand, productName, model, finish, allowance, clientPrice, primaryImage, colourSwatches = []) {
  return {
    id,
    productId: id,
    productCode: id.toUpperCase(),
    familyKey: "",
    topLevelArea: "",
    brand,
    productName,
    model,
    finish,
    colour: finish,
    primaryImage,
    officialProductURL: "",
    specificationURL: "",
    clientPrice,
    allowance,
    priceStatus: clientPrice || allowance ? PRICE_STATES.current : PRICE_STATES.quoteRequired,
    colourSwatches,
    metadata: { productEntity: { id, productId: id, brand, productName, model, finish, colour: finish, primaryImage, clientPrice, allowance, priceStatus: clientPrice || allowance ? PRICE_STATES.current : PRICE_STATES.quoteRequired, colourSwatches } },
  };
}

function swatches(...values) {
  return values.map(([name, value]) => ({ name, value }));
}

function visualPlaceholder(title, subtitle) {
  const cleanTitle = String(title || "Selection").replace(/[<&>]/g, "");
  const cleanSubtitle = String(subtitle ?? "showroom preview").replace(/[<&>]/g, "");
  const palette = placeholderPalette(cleanTitle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <rect width="900" height="560" fill="${palette.bg}"/>
      <rect x="50" y="52" width="800" height="456" rx="18" fill="${palette.surface}" stroke="${palette.stroke}" stroke-width="3"/>
      <rect x="96" y="110" width="708" height="74" rx="8" fill="${palette.accent}" opacity=".18"/>
      <rect x="96" y="220" width="320" height="180" rx="10" fill="${palette.accent}" opacity=".26"/>
      <rect x="452" y="220" width="352" height="34" rx="8" fill="${palette.accent}" opacity=".34"/>
      <rect x="452" y="278" width="264" height="28" rx="8" fill="${palette.stroke}" opacity=".36"/>
      <rect x="452" y="330" width="310" height="28" rx="8" fill="${palette.stroke}" opacity=".24"/>
      <circle cx="702" cy="390" r="52" fill="${palette.accent}" opacity=".22"/>
      <text x="96" y="160" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="${palette.text}">${cleanTitle}</text>
      <text x="96" y="448" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="${palette.muted}">${cleanSubtitle}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function placeholderPalette(value) {
  const key = String(value || "").toLowerCase();
  if (key.includes("brick")) return { bg: "#efe7dc", surface: "#fbf8f3", accent: "#a85032", stroke: "#d8b9a1", text: "#3b251c", muted: "#785341" };
  if (key.includes("roof")) return { bg: "#dfe5e7", surface: "#f8fafb", accent: "#303a42", stroke: "#aebbc0", text: "#16232b", muted: "#51616a" };
  if (key.includes("kitchen") || key.includes("oven")) return { bg: "#e8ece7", surface: "#ffffff", accent: "#0f766e", stroke: "#b7cdc8", text: "#0b1d2f", muted: "#496a66" };
  if (key.includes("bath") || key.includes("ensuite") || key.includes("toilet")) return { bg: "#e7eef0", surface: "#ffffff", accent: "#527d8c", stroke: "#b7cbd1", text: "#102033", muted: "#526f78" };
  if (key.includes("door") || key.includes("garage")) return { bg: "#e8e3dc", surface: "#fffaf2", accent: "#8b6f4e", stroke: "#d2c0aa", text: "#2f241b", muted: "#665444" };
  if (key.includes("paint") || key.includes("colour")) return { bg: "#ebe9ef", surface: "#ffffff", accent: "#6d5f9a", stroke: "#cbc6da", text: "#1f2937", muted: "#625b73" };
  return { bg: "#e8edf0", surface: "#ffffff", accent: "#d6a23a", stroke: "#cbd5e1", text: "#102033", muted: "#516173" };
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
  return String(value || "").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const showroomCss = `
  .showroom { min-height: 100vh; background: #f4f7f8; color: #102033; padding: 18px; font-family: Inter, Arial, sans-serif; }
  .showroomBanner { display: grid; grid-template-columns: auto 50px minmax(0,1fr) auto; gap: 14px; align-items: center; background: #0b1d2f; color: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 18px 44px rgba(14,31,48,.16); }
  .backButton, .showroom button, .showroom a { min-height: 38px; border-radius: 8px; font-weight: 900; cursor: pointer; text-decoration: none; }
  .backButton { display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: #fff; padding: 9px 12px; }
  .bannerIcon { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 8px; background: #d6a23a; color: #0b1d2f; }
  .bannerCopy span, .sectionHeader span, .checklistHeader span, .runningBar span, .setupControls span, .miniTotal span, .finalScheduleTitle span { color: #0f766e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
  .bannerCopy h1, .sectionHeader h2, .checklistHeader h2 { margin: 4px 0; color: inherit; font-size: 30px; line-height: 1.08; letter-spacing: 0; }
  .bannerCopy p, .sectionHeader p, .checklistHeader p { margin: 0; color: #64748b; font-weight: 750; }
  .bannerCopy p { color: #dbe5ee; }
  .bannerMeta { display: grid; gap: 5px; justify-items: end; color: #dbe5ee; font-size: 13px; font-weight: 800; }
  .bannerMeta strong { color: #fff; }
  .bannerMeta em { color: #86efac; font-style: normal; }
  .setupControls { margin-top: 14px; display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 10px; align-items: end; background: #fff; border: 1px solid #d7e0e7; border-radius: 8px; padding: 12px; }
  .setupControls label, .filterBar label { display: grid; gap: 5px; }
  .setupControls select, .filterBar select { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #102033; padding: 10px; font-weight: 800; }
  .cardActions, .detailActions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .detailActions a, .cardActions button, .detailActions button, .nextButton, .visualiseButton { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 9px 11px; }
  .clientNote { border: 1px solid #d7e0e7; background: #f8fafc; color: #475569; border-radius: 8px; padding: 10px 12px; font-weight: 800; }
  .alert { margin-top: 12px; border-radius: 8px; padding: 10px 12px; font-weight: 850; }
  .alert.error { border: 1px solid #fecaca; background: #fff1f2; color: #b91c1c; }
  .alert.success { display: flex; justify-content: space-between; gap: 10px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #047857; }
  .alert.success button { border: 1px solid #0f766e; background: #0f766e; color: #fff; padding: 7px 10px; }
  .alert.notice { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; }
  .runningBar { position: sticky; top: 0; z-index: 10; margin-top: 14px; display: grid; grid-template-columns: minmax(160px,.85fr) repeat(3,minmax(150px,1fr)); gap: 10px; background: rgba(244,247,248,.94); backdrop-filter: blur(8px); padding: 8px 0; }
  .runningBar > div:first-child, .miniTotal { display: grid; gap: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 10px 11px; min-width: 0; }
  .runningBar > div:first-child strong, .miniTotal strong { color: #102033; font-size: 18px; }
  .miniTotal.bad strong, .upgradeText { color: #c2410c !important; }
  .miniTotal.good strong, .creditText { color: #15803d !important; }
  .miniTotal.warn { background: #fffbeb; border-color: #fde68a; }
  .finalSchedulePanel { margin-top: 12px; display: grid; grid-template-columns: minmax(220px,.9fr) minmax(360px,1.4fr) minmax(220px,.8fr); gap: 12px; align-items: center; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 14px; }
  .finalScheduleTitle { display: grid; gap: 5px; min-width: 0; }
  .finalScheduleTitle span { display: inline-flex; align-items: center; gap: 7px; }
  .finalScheduleTitle h2 { margin: 0; color: #102033; font-size: 23px; line-height: 1.1; }
  .finalScheduleTitle p { margin: 0; color: #64748b; font-weight: 750; }
  .scheduleStatus { grid-column: 1 / 3; display: grid; gap: 3px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #047857; border-radius: 8px; padding: 10px 12px; min-width: 0; }
  .scheduleStatus.warn { border-color: #fde68a; background: #fffbeb; color: #b45309; }
  .scheduleStatus span { overflow-wrap: anywhere; color: inherit; font-size: 12px; font-weight: 800; }
  .finalScheduleActions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  .finalScheduleActions button, .finalScheduleActions a { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 9px 11px; }
  .finalScheduleActions button.primary { border-color: #0f766e; background: #0f766e; color: #fff; }
  .showroomSection { margin-top: 16px; display: grid; gap: 14px; }
  .sectionHeader { display: grid; gap: 3px; }
  .areaGrid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 16px; }
  .showroom .areaCard { position: relative; min-height: 310px; overflow: hidden; border: 1px solid #d7e0e7; border-radius: 8px; background: #102033; text-align: left; box-shadow: 0 18px 38px rgba(14,31,48,.14); transition: transform .16s ease, box-shadow .16s ease; }
  .areaCard:hover, .categoryCard:hover, .productCard:hover { transform: translateY(-2px); box-shadow: 0 22px 42px rgba(14,31,48,.16); }
  .areaCard img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .areaOverlay { position: absolute; inset: auto 0 0; display: grid; gap: 5px; padding: 22px; color: #fff; background: linear-gradient(180deg, rgba(11,29,47,0), rgba(11,29,47,.88)); }
  .areaOverlay h3 { margin: 0; font-size: 34px; letter-spacing: 0; }
  .areaOverlay p { margin: 0; color: #e2e8f0; font-weight: 850; }
  .categoryGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .categoryCard { overflow: hidden; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; text-align: left; color: #102033; padding: 0; transition: transform .16s ease, box-shadow .16s ease; }
  .categoryCard > img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #e2e8f0; }
  .categoryBody { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; padding: 12px; align-items: center; }
  .categoryBody h3, .productBody h3, .rowMain h3 { margin: 0; color: #102033; letter-spacing: 0; }
  .categoryBody p, .categoryBody span, .productBody p, .rowMain p { margin: 3px 0 0; color: #64748b; font-weight: 750; }
  .selectedThumb { width: 46px !important; height: 38px !important; border-radius: 8px; object-fit: cover; }
  .categoryCard.green { border-color: #86efac; }
  .categoryCard.amber { border-color: #fbbf24; }
  .categoryCard.red { border-color: #fecaca; }
  .checklistHeader { display: grid; grid-template-columns: minmax(0,1fr) minmax(420px,.8fr) auto; gap: 14px; align-items: start; border: 1px solid #d7e0e7; background: #fff; border-radius: 8px; padding: 16px; }
  .summaryTiles { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
  .visualiseButton { white-space: nowrap; }
  .checklistRows { display: grid; gap: 10px; }
  .requirementRow { display: grid; grid-template-columns: 28px 78px minmax(160px,1fr) minmax(170px,.7fr) auto; gap: 12px; align-items: center; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 12px; }
  .requirementRow.green { border-color: #86efac; background: #f0fdf4; }
  .requirementRow.amber { border-color: #fde68a; background: #fffbeb; }
  .requirementRow.red { border-color: #fecaca; background: #fff1f2; }
  .requirementRow > img { width: 78px; height: 58px; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .rowMain em { display: block; margin-top: 3px; color: #0f766e; font-style: normal; font-weight: 850; }
  .rowMoney { display: grid; gap: 3px; color: #475569; font-size: 13px; font-weight: 800; }
  .requirementRow button, .primary, .nextButton { border: 1px solid #0f766e !important; background: #0f766e !important; color: #fff !important; padding: 9px 12px; }
  .statusDot { width: 24px; height: 24px; display: inline-grid; place-items: center; border-radius: 999px; border: 2px solid #cbd5e1; background: #f1f5f9; color: #64748b; }
  .statusDot.green { border-color: #22c55e; background: #dcfce7; color: #15803d; }
  .statusDot.amber { border-color: #f59e0b; background: #fef3c7; color: #92400e; }
  .statusDot.red { border-color: #ef4444; background: #fee2e2; color: #b91c1c; }
  .productLayout { margin-top: 16px; display: grid; grid-template-columns: 270px minmax(0,1fr); gap: 16px; align-items: start; }
  .progressNav, .productPanel { border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 14px; }
  .progressNav { position: sticky; top: 86px; display: grid; gap: 6px; }
  .navHeader { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .navHeader h2 { margin: 0; font-size: 20px; }
  .navHeader button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: #0f766e; padding: 0; }
  .navItem { width: 100%; display: flex; align-items: center; gap: 8px; border: 1px solid transparent; background: #fff; color: #102033; padding: 8px; text-align: left; }
  .navItem.active { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
  .productPanel { display: grid; gap: 14px; }
  .productHeader { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .productHeader button { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 9px 11px; }
  .filterBar { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .productGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
  .productCard { overflow: hidden; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; display: grid; transition: transform .16s ease, box-shadow .16s ease; }
  .productCard > img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #e2e8f0; }
  .productBody { display: grid; gap: 9px; padding: 13px; }
  .productBody span { color: #0f766e; font-weight: 950; font-size: 13px; }
  .productBody em { color: #334155; font-style: normal; font-weight: 850; }
  .cardActions { margin-top: 2px; }
  .modalScrim { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 20px; background: rgba(11,29,47,.56); }
  .detailPanel { width: min(980px, 96vw); max-height: 92vh; overflow: auto; display: grid; grid-template-columns: minmax(280px,.9fr) minmax(320px,1fr); gap: 18px; border-radius: 8px; background: #fff; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,.24); }
  .detailGallery > img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .detailGallery div { margin-top: 8px; display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
  .detailGallery div img { width: 100%; aspect-ratio: 1; border-radius: 8px; object-fit: cover; }
  .detailInfo { display: grid; gap: 12px; align-content: start; }
  .detailInfo > span { color: #0f766e; font-weight: 950; text-transform: uppercase; font-size: 12px; letter-spacing: .06em; }
  .detailInfo h2 { margin: 0; color: #102033; font-size: 30px; line-height: 1.1; }
  .detailInfo dl { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin: 0; }
  .detailInfo dl div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px; }
  .detailInfo dt { color: #64748b; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .detailInfo dd { margin: 3px 0 0; font-weight: 850; }
  .swatches { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .swatches strong { margin-right: 4px; }
  .swatches span { width: 32px; height: 32px; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; }
  @media (max-width: 1020px) { .setupControls, .checklistHeader, .productLayout, .detailPanel, .finalSchedulePanel { grid-template-columns: 1fr; } .progressNav { position: static; } .runningBar { grid-template-columns: repeat(2, minmax(0,1fr)); } .scheduleStatus { grid-column: auto; } .finalScheduleActions { justify-content: flex-start; } }
  @media (max-width: 720px) { .showroom { padding: 12px; } .showroomBanner { grid-template-columns: 1fr; } .bannerMeta { justify-items: start; } .areaGrid, .categoryGrid, .productGrid, .summaryTiles, .runningBar { grid-template-columns: 1fr; } .requirementRow { grid-template-columns: 26px 64px minmax(0,1fr); } .rowMoney, .requirementRow button { grid-column: 1 / -1; } .setupControls { grid-template-columns: 1fr; } }
`;
