import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Download, ExternalLink, Eye, FileText, Home, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import ProjectCompactBanner from "../../../components/project-workspace/ProjectCompactBanner";
import { supabase } from "../../../utils/supabase-client";
import {
  ALL_GUIDED_REQUIREMENTS,
  APPLIANCE_AREA_LABEL,
  APPLIANCE_REQUIREMENTS,
  EXTERIOR_REQUIREMENTS,
  EXTERNAL_LIGHTING_CATEGORIES,
  EXTERNAL_LIGHTING_LOCATIONS,
  GARAGE_DOOR_WORKFLOW_STEPS,
  INTERIOR_REQUIREMENTS,
  KITCHEN_AREA_LABEL,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  areaTotals,
  createSelectionPayloadFromProduct,
  externalLightingCategory,
  externalLightingProductMatches,
  externalLightingScheduleWorkflowProduct,
  externalLightingSku,
  externalLightingWorkflowProduct,
  filtersForRequirement,
  garageDoorAccessoryOptions,
  garageDoorAutomationOptions,
  garageDoorColourById,
  garageDoorColourOptionsForProduct,
  garageDoorEnabledSupplierOptions,
  garageDoorFinishFamiliesForProduct,
  garageDoorProductsForSupplier,
  garageDoorProfileOptions,
  garageDoorRangeOptions,
  garageDoorSizeOptions,
  garageDoorWorkflowProduct,
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
import { GENERIC_IMAGE_URLS, familyByKey, normalizeMasterProductRecord } from "../../../lib/product-library/catalogueModel";
import exteriorFinishesCatalogue from "../../../data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
import windowsDoorsGarageCatalogue from "../../../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json";
import {
  createFinalInclusionsDocumentVersion,
  createProjectInclusionsSnapshot,
  isFinalInclusionsDocumentOutOfDate,
  renderFinalInclusionsScheduleHtml,
} from "../../../lib/builders/finalInclusionsSchedule";

const SELECTION_COLUMNS = "id, session_id, snapshot_id, category, subcategory, room, title, description, allowance_amount, selected_product_name, selected_supplier_name, selected_colour, selected_finish, selected_details, status, selected_at, metadata, created_at, updated_at, brand, product_name, model_number, image_url, specification_url, finish, colour, included_allowance, client_selection_price, calculated_client_selection_price, variation_amount, selection_status, is_active";
const SESSION_COLUMNS = "id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, warning_threshold_percent, selection_budget_status, status, metadata, created_at, updated_at";
const PRODUCT_COLUMNS = "*, builder_product_suppliers(supplier_name), builder_product_manufacturers(manufacturer_name), builder_product_categories(category_name)";
const ENTRY_DOORS_DASHBOARD_IMAGE_URL = "/images/product-library/entry-doors/entry-doors-dashboard-contemporary.webp";
const ENTRY_DOORS_DASHBOARD_IMAGE_ALT = "Contemporary timber entry door installed in a modern brick home";
const GARAGE_DOORS_DASHBOARD_IMAGE_URL = "/images/product-library/garage-doors/garage-doors-modern-flatline.webp";
const GARAGE_DOORS_DASHBOARD_IMAGE_ALT = "Modern black flatline sectional garage door installed on a contemporary home";
const EXTERNAL_LIGHTING_DASHBOARD_IMAGE_URL = "/images/product-library/external-lighting/external-lighting-dashboard-modern-entrance.webp";
const EXTERNAL_LIGHTING_DASHBOARD_IMAGE_ALT = "Exterior wall lighting illuminating a modern residential entrance";
const APPLIANCES_DASHBOARD_IMAGE_URL = "/images/client-selections/appliances-kitchen.jpeg";

const AREA_CARDS = [
  { key: "exterior", title: "Exterior", image: GENERIC_IMAGE_URLS.exterior, fallback: visualPlaceholder("Exterior", ""), requirements: EXTERIOR_REQUIREMENTS },
  { key: "interior", title: "Interior", image: GENERIC_IMAGE_URLS.interior, fallback: visualPlaceholder("Interior", ""), requirements: [...INTERIOR_REQUIREMENTS, ...KITCHEN_REQUIREMENTS, ...APPLIANCE_REQUIREMENTS] },
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

const SHARED_CLADDING_CATALOGUE_PRODUCTS = (exteriorFinishesCatalogue.products || [])
  .filter((product) => product.family_key === "cladding" || product.familyKey === "cladding")
  .map((product) => normalizeMasterProductRecord(product));
const SHARED_EXTERNAL_LIGHTING_CATALOGUE_PRODUCTS = (exteriorFinishesCatalogue.products || [])
  .filter((product) => product.family_key === "external-lighting" || product.familyKey === "external-lighting")
  .map((product) => normalizeMasterProductRecord(product));
const SHARED_GARAGE_DOOR_CATALOGUE_PRODUCTS = (windowsDoorsGarageCatalogue.products || [])
  .filter((product) => product.family_key === "garage-doors" || product.familyKey === "garage-doors")
  .map((product) => normalizeMasterProductRecord(product));
const DEMO_SELECTIONS_STORAGE_KEY = "clientSelections.demoSelections.v1";

export default function BuilderClientSelectionsPage() {
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selections, setSelections] = useState([]);
  const [demoSelections, setDemoSelections] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(DEMO_SELECTIONS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
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
        setSelectedProjectId((current) => rows.find((project) => project.id === current)?.id || "");
      }
      setLoading(false);
    }
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEMO_SELECTIONS_STORAGE_KEY, JSON.stringify(demoSelections.slice(0, 60)));
    } catch {
      // Demo persistence is best-effort only; live projects continue through Supabase.
    }
  }, [demoSelections, workspaceId]);

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
        setProducts(mergeSharedCladdingProducts((productResult.data || []).map(mapDbProductToEntity)));
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
  const applianceMap = useMemo(() => selectedByRequirement(activeSelections, APPLIANCE_REQUIREMENTS), [activeSelections]);
  const exteriorTotals = useMemo(() => areaTotals(EXTERIOR_REQUIREMENTS, selectedMap), [selectedMap]);
  const interiorTotals = useMemo(() => areaTotals(INTERIOR_REQUIREMENTS, selectedMap), [selectedMap]);
  const kitchenTotals = useMemo(() => areaTotals(KITCHEN_REQUIREMENTS, kitchenMap), [kitchenMap]);
  const applianceTotals = useMemo(() => areaTotals(APPLIANCE_REQUIREMENTS, applianceMap), [applianceMap]);
  const runningProjectTotals = useMemo(() => projectTotals([exteriorTotals, interiorTotals, kitchenTotals, applianceTotals]), [exteriorTotals, interiorTotals, kitchenTotals, applianceTotals]);
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

  const selectedRequirement = useMemo(() => guidedRequirementByKey(selectedRequirementKey) || KITCHEN_REQUIREMENTS[0], [selectedRequirementKey]);
  const activeRequirementList = selectedRequirement?.areaKey === "exterior" ? EXTERIOR_REQUIREMENTS : selectedRequirement?.areaKey === "appliances" ? APPLIANCE_REQUIREMENTS : KITCHEN_REQUIREMENTS;
  const requirementProducts = useMemo(() => {
    const matchedProducts = productsForRequirement(products, selectedRequirement);
    if (matchedProducts.length) return matchedProducts;
    if (selectedRequirement?.familyKey === "garage-doors") {
      return SHARED_GARAGE_DOOR_CATALOGUE_PRODUCTS.filter((product) => product.active !== false && !product.discontinued && !/jamb/i.test(`${product.productName} ${product.category} ${product.subcategory}`));
    }
    if (selectedRequirement?.familyKey === "external-lighting") {
      return SHARED_EXTERNAL_LIGHTING_CATALOGUE_PRODUCTS.filter((product) => product.active !== false && !product.discontinued);
    }
    if (selectedRequirement?.familyKey !== "cladding") return matchedProducts;
    return SHARED_CLADDING_CATALOGUE_PRODUCTS;
  }, [products, selectedRequirement]);
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

  function openAppliancesChecklist() {
    setSelectedArea("interior");
    setScreen("appliancesChecklist");
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
    if (requirement.requirementKey === "appliances") {
      openAppliancesChecklist();
      return;
    }
    openRequirement(requirement.requirementKey);
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
      setSuccess(`${selectedRequirement.label} selected. Return to the dashboard when ready.`);
      return true;
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
      setSuccess(`${selectedRequirement.label} selected. Return to the dashboard when ready.`);
      return true;
    } catch (saveError) {
      setError(saveError.message || "Could not save product selection.");
      return false;
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

  const areaTotalsByKey = { exterior: exteriorTotals, interior: projectTotals([interiorTotals, kitchenTotals, applianceTotals]) };
  const currentAreaTitle = selectedArea ? titleCase(selectedArea) : "Choose an Area";

  return (
    <>
      <Head><title>Inclusions & Selections</title></Head>
      <main className="showroom">
        <div className="showroomActions">
          <button type="button" className="backButton" onClick={screen === "areas" ? () => window.history.back() : openAreas}><ArrowLeft size={17} />Back</button>
        </div>
        <ProjectCompactBanner
          moduleTitle="Client Selections"
          moduleIcon={<Home size={48} strokeWidth={2.05} />}
          jobName={selectedProject?.project_name || ""}
          jobAddress={selectedProject?.site_address || ""}
          hasActiveJob={Boolean(selectedProject?.id)}
          accent="linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)"
        />

        <section className="setupControls">
          <label><span>Project</span><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={workspaceLoading || loading || !projects.length}>{!projects.length ? <option value="">No projects found</option> : null}{projects.map((project) => <option key={project.id} value={project.id}>{project.project_name || "Untitled Project"}{project.client_name ? ` - ${project.client_name}` : ""}</option>)}</select></label>
          <label><span>Estimate</span><select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)} disabled={workspaceLoading || loading || !snapshots.length}>{!snapshots.length ? <option value="">No snapshots found</option> : null}{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>Snapshot {snapshot.snapshot_number}{snapshot.source_quote_number ? ` - ${snapshot.source_quote_number}` : ""}</option>)}</select></label>
          <label><span>Session</span><select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} disabled={workspaceLoading || loading || !sessions.length}>{!sessions.length ? <option value="">New session will be created</option> : null}{sessions.map((session) => <option key={session.id} value={session.id}>{session.session_name || "Client Selections"} - {titleCase(session.status)}</option>)}</select></label>
        </section>

        {error ? <div className="alert error">{error}</div> : null}
        {success ? <div className="alert success">{success}</div> : null}
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
        {screen === "area" ? <AreaCategories areaKey={selectedArea} title={currentAreaTitle} selectedMap={selectedMap} kitchenTotals={kitchenTotals} applianceTotals={applianceTotals} onOpenCategory={openCategory} currency={selectedProject?.currency} /> : null}
        {screen === "checklist" ? <SelectionChecklist title={KITCHEN_AREA_LABEL} testId="showroom-kitchen-checklist" requirements={KITCHEN_REQUIREMENTS} selectedMap={kitchenMap} totals={kitchenTotals} currency={selectedProject?.currency} onOpenRequirement={openRequirement} /> : null}
        {screen === "appliancesChecklist" ? <SelectionChecklist title={APPLIANCE_AREA_LABEL} testId="showroom-appliances-checklist" requirements={APPLIANCE_REQUIREMENTS} selectedMap={applianceMap} totals={applianceTotals} currency={selectedProject?.currency} onOpenRequirement={openRequirement} /> : null}
        {screen === "product" ? (
          <ProductSelectionView
            requirement={selectedRequirement}
            requirements={activeRequirementList}
            selectedMap={selectedRequirement.areaKey === "exterior" ? selectedMap : selectedRequirement.areaKey === "appliances" ? applianceMap : kitchenMap}
            products={visibleProducts}
            libraryProductCount={requirementProducts.length}
            filters={filters}
            setFilters={setFilters}
            availableFilters={availableFilters}
            currency={selectedProject?.currency}
            saving={saving}
            onOpenRequirement={openRequirement}
            onBack={selectedRequirement.areaKey === "exterior" ? () => openArea("exterior") : selectedRequirement.areaKey === "appliances" ? openAppliancesChecklist : openKitchenChecklist}
            onDetail={setDetailProduct}
            onSelect={selectProduct}
            onSaveProgress={() => setSuccess("Progress saved.")}
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

function AreaCategories({ areaKey, title, selectedMap, kitchenTotals, applianceTotals, onOpenCategory, currency }) {
  const interiorRequirements = [
    INTERIOR_REQUIREMENTS[0],
    { ...APPLIANCE_REQUIREMENTS[0], requirementKey: "appliances", label: APPLIANCE_AREA_LABEL, areaKey: "interior", areaLabel: "Interior", familyKey: "appliances", imageKey: "ovens", imageUrl: APPLIANCES_DASHBOARD_IMAGE_URL },
    ...INTERIOR_REQUIREMENTS.slice(1),
  ];
  const requirements = areaKey === "exterior" ? EXTERIOR_REQUIREMENTS : interiorRequirements;
  return (
    <section className="showroomSection" data-testid={AREA_CATEGORY_TEST_IDS[areaKey] || "showroom-area-categories"}>
      <div className="sectionHeader"><span>{title}</span><h2>Choose a selection category</h2></div>
      <div className="categoryGrid">
        {requirements.map((requirement) => {
          const selection = selectedMap.get(requirement.requirementKey);
          const totals = requirement.requirementKey === "kitchen" ? kitchenTotals : requirement.requirementKey === "appliances" ? applianceTotals : null;
          const status = totals ? (totals.completed === totals.total ? "complete" : totals.completed ? "incomplete" : "not_started") : statusForRequirement(requirement, selection);
          return <CategoryCard key={requirement.requirementKey} requirement={requirement} status={status} selection={selection} totals={totals} currency={currency} onOpen={() => onOpenCategory(requirement)} />;
        })}
      </div>
    </section>
  );
}

function CategoryCard({ requirement, status, selection, totals, currency, onOpen }) {
  const fallback = visualPlaceholder(requirement.label, requirement.imageKey);
  const isEntryDoor = requirement.requirementKey === "entry-door";
  const isGarageDoor = requirement.requirementKey === "garage-door";
  const isExternalLighting = requirement.requirementKey === "external-lighting";
  const image = requirement.imageUrl || (isEntryDoor ? ENTRY_DOORS_DASHBOARD_IMAGE_URL : isGarageDoor ? GARAGE_DOORS_DASHBOARD_IMAGE_URL : isExternalLighting ? EXTERNAL_LIGHTING_DASHBOARD_IMAGE_URL : requirementImage(requirement));
  const alt = isEntryDoor ? ENTRY_DOORS_DASHBOARD_IMAGE_ALT : isGarageDoor ? GARAGE_DOORS_DASHBOARD_IMAGE_ALT : isExternalLighting ? EXTERNAL_LIGHTING_DASHBOARD_IMAGE_ALT : `${requirement.label} selections`;
  const label = status === "complete" ? "Selected" : status === "incomplete" ? "In Progress" : "Not Started";
  const lightingSummary = selection?.selected_details?.externalLightingSelection;
  const externalLightingSummary = lightingSummary?.dashboardSummary || (lightingSummary?.summary ? `${lightingSummary.summary.totalFittings || 0} fittings selected` : "");
  return (
    <button type="button" className={`categoryCard ${statusTone(status)} ${isEntryDoor ? "entryDoorCategoryCard" : ""} ${isGarageDoor ? "garageDoorCategoryCard" : ""} ${isExternalLighting ? "externalLightingCategoryCard" : ""}`} onClick={onOpen} data-image-key={requirement.imageKey} data-requirement-key={requirement.requirementKey}>
      <img src={image} alt={alt} onError={(event) => { event.currentTarget.src = fallback; }} />
      <div className="categoryBody">
        <div><h3>{requirement.label}</h3><p>{label}</p></div>
        {selection && !isExternalLighting ? <img className="selectedThumb" src={selection.image_url || image} alt="" onError={(event) => { event.currentTarget.src = fallback; }} /> : null}
        {totals ? <span>{totals.completed} / {totals.total} - {signedMoney(totals.variation, currency)}</span> : <span>{externalLightingSummary || selection?.selected_product_name || "Open showroom"}</span>}
      </div>
    </button>
  );
}

function SelectionChecklist({ title, testId, requirements, selectedMap, totals, currency, onOpenRequirement }) {
  return (
    <section className="showroomSection" data-testid={testId}>
      <div className="checklistHeader">
        <div><span>{title}</span><h2>Selection checklist</h2><p>{totals.completed} of {totals.total} complete</p></div>
        <div className="summaryTiles"><MiniTotal label="Allowance" value={money(totals.allowance, currency)} /><MiniTotal label="Selected" value={money(totals.selected, currency)} /><MiniTotal label="Variation" value={signedMoney(totals.variation, currency)} tone={totals.variation > 0 ? "bad" : totals.variation < 0 ? "good" : ""} /></div>
        <button type="button" className="visualiseButton"><Eye size={16} />Visualise Room</button>
      </div>
      <div className="checklistRows">
        {requirements.map((requirement) => <RequirementRow key={requirement.requirementKey} requirement={requirement} selection={selectedMap.get(requirement.requirementKey)} currency={currency} onOpen={() => onOpenRequirement(requirement.requirementKey)} />)}
      </div>
    </section>
  );
}

function ProductSelectionView({ requirement, requirements, selectedMap, products, libraryProductCount, filters, setFilters, availableFilters, currency, saving, onOpenRequirement, onBack, onDetail, onSelect, onSaveProgress }) {
  if (requirement.requirementKey === "external-lighting") {
    return <ExternalLightingSelectionWorkflow requirement={requirement} requirements={requirements} selectedMap={selectedMap} products={products} libraryProductCount={libraryProductCount} currency={currency} saving={saving} onOpenRequirement={onOpenRequirement} onBack={onBack} onSelect={onSelect} onSaveProgress={onSaveProgress} />;
  }
  if (requirement.requirementKey === "garage-door") {
    return <GarageDoorSelectionWorkflow requirement={requirement} requirements={requirements} selectedMap={selectedMap} products={products} libraryProductCount={libraryProductCount} currency={currency} saving={saving} onOpenRequirement={onOpenRequirement} onBack={onBack} onSelect={onSelect} onSaveProgress={onSaveProgress} />;
  }
  const returnToDashboardAfterSelect = requirement.requirementKey === "garage-door";
  const selectAndMaybeReturn = async (product) => {
    const saved = await onSelect(product);
    if (returnToDashboardAfterSelect) {
      if (saved === false) return;
      onBack();
      window.setTimeout(() => highlightSelectionDashboardCard(requirement.requirementKey), 120);
    }
  };
  return (
    <section className="productLayout" data-testid={`showroom-${requirement.requirementKey}-product-grid`}>
      <aside className="progressNav">
        <div className="navHeader"><h2>{requirement.areaLabel === "Exterior" ? "Exterior" : requirement.areaLabel || KITCHEN_AREA_LABEL}</h2><button type="button" onClick={onBack}><ArrowLeft size={15} />Back</button></div>
        {requirements.map((item) => {
          const status = statusForRequirement(item, selectedMap.get(item.requirementKey));
          return <button key={item.requirementKey} type="button" className={item.requirementKey === requirement.requirementKey ? "navItem active" : "navItem"} onClick={() => onOpenRequirement(item.requirementKey)}><StatusDot status={status} />{item.label}</button>;
        })}
      </aside>
      <section className="productPanel">
        <div className="productHeader">
          <div className="sectionHeader"><span>{requirement.areaLabel} / {requirement.label}</span><h2>Choose your product</h2><p>{libraryProductCount ? `${products.length} matching approved option${products.length === 1 ? "" : "s"}` : "Category-specific showroom placeholders until approved products are added."}</p></div>
          <button type="button" onClick={onBack}><ArrowLeft size={16} />{requirement.areaLabel === "Exterior" ? "Back to Exterior" : requirement.areaLabel === APPLIANCE_AREA_LABEL ? "Back to Appliances" : "Back to Kitchen"}</button>
        </div>
        {availableFilters.length ? <div className="filterBar">{availableFilters.map((filter) => <label key={filter.key}><span>{filter.label}</span><select value={filters[filter.key] || ""} onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}><option value="">All</option>{filter.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div> : null}
        {!libraryProductCount ? <div className="clientNote">Your builder will confirm final supplier availability for this category.</div> : null}
        <div className="productGrid">
          {products.map((product) => <ProductCard key={product.productId || product.id || product.productCode} requirement={requirement} product={product} currency={currency} saving={saving} onDetail={() => onDetail(product)} onSelect={() => selectAndMaybeReturn(product)} />)}
        </div>
        <div className="dashboardActions">
          <button type="button" className="primary" onClick={onBack}>Save and Return to Dashboard</button>
          <button type="button" onClick={onSaveProgress}>Save Progress</button>
        </div>
      </section>
    </section>
  );
}

function ExternalLightingSelectionWorkflow({ requirement, requirements, selectedMap, products, libraryProductCount, currency, saving, onOpenRequirement, onBack, onSelect, onSaveProgress }) {
  const selectedDetails = selectedMap.get(requirement.requirementKey)?.selected_details || {};
  const savedLighting = selectedDetails.externalLightingSelection || {};
  const categories = useMemo(() => EXTERNAL_LIGHTING_CATEGORIES.map((category) => ({ category, count: products.filter((product) => externalLightingCategory(product) === category).length })), [products]);
  const savedLines = Array.isArray(savedLighting.scheduleLines) ? savedLighting.scheduleLines : (savedLighting.productName ? [savedLighting] : []);
  const [activeCategory, setActiveCategory] = useState(categories.find((item) => item.count)?.category || categories[0]?.category || "");
  const [filters, setLightingFilters] = useState({ search: "", sensor: "", installationType: "", voltage: "" });
  const categoryProducts = useMemo(() => products.filter((product) => externalLightingProductMatches(product, { ...filters, category: activeCategory })), [products, filters, activeCategory]);
  const [scheduleLines, setScheduleLines] = useState(() => savedLines.map((line, index) => hydrateExternalLightingLine(line, products, index)));
  const [draftLine, setDraftLine] = useState(null);
  const previewProduct = useMemo(() => externalLightingScheduleWorkflowProduct(scheduleLines, requirement, { dashboardImage: EXTERNAL_LIGHTING_DASHBOARD_IMAGE_URL }), [scheduleLines, requirement]);
  const summary = previewProduct.externalLightingSelection.summary;
  const canConfirm = summary.totalProducts > 0 && summary.totalFittings > 0 && summary.missingLocations === 0;

  useEffect(() => {
    if (activeCategory && categories.some((item) => item.category === activeCategory)) return;
    setActiveCategory(categories.find((item) => item.count)?.category || categories[0]?.category || "");
  }, [activeCategory, categories]);

  function startDraft(product, line = null) {
    const attrs = product?.attributes || product?.metadata?.productEntity?.attributes || {};
    const quantity = Math.max(1, Math.trunc(numberValue(line?.quantity) || 1));
    setDraftLine({
      scheduleLineId: line?.scheduleLineId || "",
      product,
      productId: product?.productId || product?.id || "",
      productCode: product?.productCode || "",
      productName: product?.productName || "",
      sku: externalLightingSku(product),
      category: externalLightingCategory(product),
      finish: product?.finish || product?.colour || "",
      imageUrl: requirementImage(requirement, product),
      ipRating: attrs.ipRating || "",
      voltage: attrs.voltage || "",
      wattage: attrs.wattage || "",
      globeType: attrs.globeType || "",
      integratedLed: Boolean(attrs.integratedLed),
      sensorIncluded: Boolean(attrs.sensorIncluded),
      sensorType: attrs.sensorType || "",
      installationType: attrs.installationType || attrs.constructionSuitability || "",
      unitCost: productClientPrice(product),
      priceStatus: priceStateForProduct(product),
      quantity,
      locations: reconcileLightingLocations(line?.locations || defaultLightingLocations(quantity, attrs), quantity),
      notes: line?.notes || "",
    });
  }

  function updateDraft(patch) {
    setDraftLine((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.quantity != null) {
        const quantity = Math.max(1, Math.trunc(numberValue(patch.quantity) || 1));
        const defaultLocations = defaultLightingLocations(quantity, { sensorIncluded: current.sensorIncluded, sensorType: current.sensorType });
        next.locations = reconcileLightingLocations([...current.locations, ...defaultLocations.slice(current.locations.length)], quantity);
      }
      return next;
    });
  }

  function updateDraftLocation(index, patch) {
    setDraftLine((current) => current ? { ...current, locations: current.locations.map((location, itemIndex) => itemIndex === index ? { ...location, ...patch } : location) } : current);
  }

  function saveDraftLine() {
    if (!draftLine) return;
    const lineId = draftLine.scheduleLineId || `els-${Date.now()}`;
    const nextLine = { ...draftLine, scheduleLineId: lineId, quantity: Math.max(1, Math.trunc(numberValue(draftLine.quantity) || 1)) };
    setScheduleLines((current) => {
      const exists = current.some((line) => line.scheduleLineId === lineId);
      return exists ? current.map((line) => line.scheduleLineId === lineId ? nextLine : line) : [...current, nextLine];
    });
    setDraftLine(null);
  }

  function duplicateLine(line) {
    setScheduleLines((current) => [...current, { ...line, scheduleLineId: `els-${Date.now()}`, locations: line.locations.map((location, index) => ({ ...location, lightingPointId: `EL${String(current.length + index + 1).padStart(2, "0")}` })) }]);
  }

  function removeLine(line) {
    if (line.locations?.length && !window.confirm(`Remove ${line.productName} and its assigned lighting locations?`)) return;
    setScheduleLines((current) => current.filter((item) => item.scheduleLineId !== line.scheduleLineId));
  }

  async function confirmSelection() {
    if (!canConfirm || !previewProduct) return;
    const saved = await onSelect(previewProduct);
    if (saved === false) return;
    onBack();
    window.setTimeout(() => highlightSelectionDashboardCard(requirement.requirementKey), 120);
  }

  async function saveProgress() {
    if (!summary.totalProducts || !previewProduct) {
      onSaveProgress();
      return;
    }
    const saved = await onSelect(previewProduct);
    if (saved === false) return;
    setDraftLine(null);
  }

  return (
    <section className="productLayout externalLightingWorkflow" data-testid="showroom-external-lighting-product-grid">
      <aside className="progressNav">
        <div className="navHeader"><h2>Exterior</h2><button type="button" onClick={onBack}><ArrowLeft size={15} />Back</button></div>
        {requirements.map((item) => <button key={item.requirementKey} type="button" className={item.requirementKey === requirement.requirementKey ? "navItem active" : "navItem"} onClick={() => onOpenRequirement(item.requirementKey)}><StatusDot status={statusForRequirement(item, selectedMap.get(item.requirementKey))} />{item.label}</button>)}
      </aside>
      <section className="productPanel">
        <div className="productHeader">
          <div className="sectionHeader"><span>Exterior / External Lighting</span><h2>Beacon outdoor lighting schedule</h2><p>{libraryProductCount ? `${products.length} active Beacon exterior product${products.length === 1 ? "" : "s"} available` : "No approved Beacon exterior products found."}</p></div>
          <button type="button" onClick={onBack}><ArrowLeft size={16} />Back to Exterior</button>
        </div>
        <section className="lightingSchedulePanel" data-testid="external-lighting-selected-schedule">
          <div className="lightingScheduleHeader">
            <div><span>Your External Lighting Schedule</span><h3>{summary.totalProducts} product{summary.totalProducts === 1 ? "" : "s"} / {summary.totalFittings} fitting{summary.totalFittings === 1 ? "" : "s"}</h3></div>
            <div className="lightingSummaryTiles">
              <MiniTotal label="Assigned" value={`${summary.locationsAssigned}`} />
              <MiniTotal label="Missing" value={`${summary.missingLocations}`} tone={summary.missingLocations ? "warn" : "good"} />
              <MiniTotal label="Quotes" value={`${summary.quoteRequiredProducts}`} tone={summary.quoteRequiredProducts ? "warn" : ""} />
              <MiniTotal label="Product Cost" value={money(summary.selectedPrice, currency)} />
              <MiniTotal label="Allowance" value={money(summary.allowance, currency)} />
              <MiniTotal label="Variation" value={signedMoney(summary.variation, currency)} tone={summary.variation > 0 ? "bad" : summary.variation < 0 ? "good" : ""} />
            </div>
          </div>
          {scheduleLines.length ? <div className="lightingScheduleRows">{scheduleLines.map((line) => <LightingScheduleLine key={line.scheduleLineId} line={line} currency={currency} onEdit={() => startDraft(line.product || line, line)} onDuplicate={() => duplicateLine(line)} onRemove={() => removeLine(line)} />)}</div> : <div className="clientNote">Add at least one Beacon exterior light, then assign quantities and locations.</div>}
          {summary.missingLocations ? <div className="alert notice">{summary.missingLocations} lighting location{summary.missingLocations === 1 ? "" : "s"} still need{summary.missingLocations === 1 ? "s" : ""} to be assigned.</div> : null}
        </section>
        <div className="lightingCategoryGrid">{categories.map((item) => <button key={item.category} type="button" className={activeCategory === item.category ? "selected" : ""} onClick={() => setActiveCategory(item.category)}><strong>{item.category}</strong><span>{item.count} products</span></button>)}</div>
        <div className="lightingFilters">
          <label><span>Search name or SKU</span><input value={filters.search} onChange={(event) => setLightingFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Sentinel, flood, 2303181..." /></label>
          <label><span>Sensor</span><select value={filters.sensor} onChange={(event) => setLightingFilters((current) => ({ ...current, sensor: event.target.value }))}><option value="">All</option><option value="sensor">Sensor included</option><option value="no-sensor">No sensor</option></select></label>
          <label><span>Installation</span><select value={filters.installationType} onChange={(event) => setLightingFilters((current) => ({ ...current, installationType: event.target.value }))}><option value="">All</option><option>Fixed hardwired fitting</option><option>Low-voltage wired fitting</option><option>Solar fitting</option><option>Plug-in fitting</option></select></label>
          <label><span>Voltage</span><select value={filters.voltage} onChange={(event) => setLightingFilters((current) => ({ ...current, voltage: event.target.value }))}><option value="">All</option><option>240V</option><option>12V</option><option>12/24V</option><option>Solar</option><option>Not published by supplier</option></select></label>
        </div>
        <div className="clientNote">Showing {categoryProducts.length} matching Beacon product{categoryProducts.length === 1 ? "" : "s"}. IP rating and exposure limits must be confirmed from Beacon's current product page and by the electrician where the supplier has not published enough detail.</div>
        <div className="lightingProductGrid">
          {categoryProducts.map((product) => {
            const attrs = product.attributes || {};
            return (
              <article key={product.productId || product.id || product.productCode} className="lightingProductCard">
                <button type="button" className="lightingImageButton" onClick={() => startDraft(product)}><img src={requirementImage(requirement, product)} alt={product.productName || "Beacon exterior light"} onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} /></button>
                <div><strong>{product.productName}</strong><span>SKU {externalLightingSku(product)}</span><span>{externalLightingCategory(product)} / {product.finish || product.colour}</span></div>
                <div className="lightingBadges"><span>{attrs.ipRating || "IP not published"}</span><span>{attrs.integratedLed ? "Integrated LED" : attrs.globeType || "Globe not published"}</span>{attrs.sensorIncluded ? <span>Sensor</span> : null}<span>{money(productClientPrice(product), currency)}</span></div>
                <a href={product.officialProductURL || product.productUrl} target="_blank" rel="noreferrer">View Details</a>
                <button type="button" className="primary" onClick={() => startDraft(product)}>Add to Lighting Schedule</button>
              </article>
            );
          })}
        </div>
        {draftLine ? (
          <div className="lightingAssignment" data-testid="external-lighting-location-assignment">
            <div className="lightingSelectedProduct">
              <img src={draftLine.imageUrl} alt={draftLine.productName || "Selected Beacon exterior light"} onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} />
              <dl>
                <div><dt>Selected product</dt><dd>{draftLine.productName}</dd></div>
                <div><dt>Beacon SKU</dt><dd>{draftLine.sku}</dd></div>
                <div><dt>Category</dt><dd>{draftLine.category}</dd></div>
                <div><dt>Finish</dt><dd>{draftLine.finish}</dd></div>
                <div><dt>IP Rating</dt><dd>{draftLine.ipRating || "Not published by supplier"}</dd></div>
                <div><dt>Voltage</dt><dd>{draftLine.voltage || "Not published by supplier"}</dd></div>
                <div><dt>Installation</dt><dd>{draftLine.installationType || "Not published by supplier"}</dd></div>
                <div><dt>Unit Price</dt><dd>{money(draftLine.unitCost, currency)}</dd></div>
              </dl>
            </div>
            <div className="lightingQuantityPanel">
              <span>Quantity</span>
              <button type="button" onClick={() => updateDraft({ quantity: Math.max(1, Number(draftLine.quantity) - 1) })}>-</button>
              <input type="number" min="1" step="1" value={draftLine.quantity} onChange={(event) => updateDraft({ quantity: event.target.value })} />
              <button type="button" onClick={() => updateDraft({ quantity: Number(draftLine.quantity) + 1 })}>+</button>
              <strong>{money((numberValue(draftLine.unitCost) || 0) * (numberValue(draftLine.quantity) || 1), currency)}</strong>
            </div>
            <div className="lightingLocationRows">
              {draftLine.locations.map((location, index) => (
                <div key={`${location.lightingPointId}-${index}`} className="lightingLocationRow">
                  <label><span>Point ID</span><input value={location.lightingPointId} onChange={(event) => updateDraftLocation(index, { lightingPointId: event.target.value })} /></label>
                  <label><span>Location</span><select value={location.location} onChange={(event) => updateDraftLocation(index, { location: event.target.value })}>{EXTERNAL_LIGHTING_LOCATIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label><span>Position</span><input value={location.notes} onChange={(event) => updateDraftLocation(index, { notes: event.target.value })} placeholder="left side, right side..." /></label>
                  <label><span>Switching</span><input value={location.switching} onChange={(event) => updateDraftLocation(index, { switching: event.target.value })} /></label>
                </div>
              ))}
            </div>
            <div className="lightingSummary" data-testid="external-lighting-final-summary">
              <strong>{draftLine.quantity} fitting{Number(draftLine.quantity) === 1 ? "" : "s"} / {money((numberValue(draftLine.unitCost) || 0) * (numberValue(draftLine.quantity) || 1), currency)}</strong>
              <span>{draftLine.locations.length === Number(draftLine.quantity) ? "Locations reconcile with quantity." : `${Math.max(0, Number(draftLine.quantity) - draftLine.locations.length)} lighting location still needs to be assigned.`}</span>
              <div className="dashboardActions"><button type="button" onClick={() => setDraftLine(null)}>Add Another Light</button><button type="button" className="primary" onClick={saveDraftLine}>Add to Schedule</button></div>
            </div>
          </div>
        ) : null}
        <div className="dashboardActions"><button type="button" onClick={saveProgress}>Save Progress</button><button type="button" onClick={() => setDraftLine(null)}>Add Another Light</button><button type="button" className="primary" disabled={!canConfirm || saving} onClick={confirmSelection}>{saving ? "Saving..." : "Confirm External Lighting"}</button></div>
      </section>
    </section>
  );
}

function LightingScheduleLine({ line, currency, onEdit, onDuplicate, onRemove }) {
  const assigned = line.locations?.reduce((sum, location) => sum + (numberValue(location.quantity) || 1), 0) || 0;
  return (
    <article className="lightingScheduleLine" data-schedule-line-id={line.scheduleLineId}>
      <img src={line.imageUrl} alt={line.productName || "Beacon exterior light"} onError={(event) => { event.currentTarget.src = EXTERNAL_LIGHTING_DASHBOARD_IMAGE_URL; }} />
      <div>
        <strong>{line.productName}</strong>
        <span>SKU {line.sku} / {line.category} / {line.finish}</span>
        <em>{line.ipRating || "IP not published"} / Qty {line.quantity} / {assigned} assigned</em>
        <small>{line.locations?.map((location) => `${location.lightingPointId} ${location.location}${location.notes ? `, ${location.notes}` : ""}`).join("; ") || "No locations assigned"}</small>
      </div>
      <div className="lightingLineTotals">
        <span>{money(line.unitCost, currency)} each</span>
        <strong>{money((numberValue(line.unitCost) || 0) * (numberValue(line.quantity) || 1), currency)}</strong>
        <em>{line.priceStatus || "Current Price"}</em>
      </div>
      <div className="lightingLineActions">
        <button type="button" onClick={onEdit}>Edit</button>
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" onClick={onRemove}>Remove</button>
      </div>
    </article>
  );
}

function hydrateExternalLightingLine(line, products = [], index = 0) {
  const product = products.find((item) => [item.productId, item.id, item.productCode, externalLightingSku(item)].includes(line.productId || line.productCode || line.sku)) || line.product || line;
  const attrs = product.attributes || product.metadata?.productEntity?.attributes || {};
  const quantity = Math.max(1, Math.trunc(numberValue(line.quantity) || 1));
  return {
    scheduleLineId: line.scheduleLineId || `els-${Date.now()}-${index}`,
    product,
    productId: product.productId || product.id || line.productId || "",
    productCode: product.productCode || line.productCode || "",
    productName: line.productName || product.productName || "",
    sku: line.sku || externalLightingSku(product),
    category: line.category || externalLightingCategory(product),
    finish: line.finish || product.finish || product.colour || "",
    imageUrl: line.imageUrl || requirementImage({ familyKey: "external-lighting", requirementKey: "external-lighting" }, product),
    ipRating: line.ipRating || attrs.ipRating || "",
    voltage: line.voltage || attrs.voltage || "",
    wattage: line.wattage || attrs.wattage || "",
    globeType: line.globeType || attrs.globeType || "",
    integratedLed: Boolean(line.integratedLed ?? attrs.integratedLed),
    sensorIncluded: Boolean(line.sensorIncluded ?? attrs.sensorIncluded),
    sensorType: line.sensorType || attrs.sensorType || "",
    installationType: line.installationType || attrs.installationType || attrs.constructionSuitability || "",
    unitCost: numberValue(line.unitCost ?? line.unitPrice ?? productClientPrice(product)),
    priceStatus: line.priceStatus || priceStateForProduct(product),
    quantity,
    locations: reconcileLightingLocations(line.locations || [], quantity),
    notes: line.notes || "",
  };
}

function reconcileLightingLocations(locations = [], quantity = 1) {
  const count = Math.max(1, Math.trunc(numberValue(quantity) || 1));
  const next = locations.slice(0, count).map((location, index) => ({
    lightingPointId: location.lightingPointId || `EL${String(index + 1).padStart(2, "0")}`,
    floor: location.floor || "Ground",
    elevation: location.elevation || "",
    location: location.location || location.exactLocation || "Other custom location",
    quantity: 1,
    switching: location.switching || "By electrical schedule",
    sensorRequirement: location.sensorRequirement || "",
    notes: location.notes || "",
  }));
  while (next.length < count) {
    const index = next.length;
    next.push({
      lightingPointId: `EL${String(index + 1).padStart(2, "0")}`,
      floor: "Ground",
      elevation: "",
      location: "Other custom location",
      quantity: 1,
      switching: "By electrical schedule",
      sensorRequirement: "",
      notes: "",
    });
  }
  return next;
}

function defaultLightingLocations(quantity, attrs = {}) {
  const count = Math.max(1, Math.trunc(numberValue(quantity) || 1));
  if (attrs.sensorIncluded) return reconcileLightingLocations([{ lightingPointId: "EL03", location: "Garage exterior", switching: "Sensor/manual override", sensorRequirement: attrs.sensorType || "Sensor included" }], count);
  return reconcileLightingLocations([
    { lightingPointId: "EL01", location: "Front entry", notes: "left side", switching: "Entry switch" },
    { lightingPointId: "EL02", location: "Front entry", notes: "right side", switching: "Entry switch" },
  ], count);
}

function GarageDoorSelectionWorkflow({ requirement, requirements, selectedMap, products, libraryProductCount, currency, saving, onOpenRequirement, onBack, onSelect, onSaveProgress }) {
  const selectedDetails = selectedMap.get(requirement.requirementKey)?.selected_details || {};
  const savedGarage = selectedDetails.garageDoorSelection || {};
  const suppliers = useMemo(() => garageDoorEnabledSupplierOptions(products), [products]);
  const [step, setStep] = useState("supplier");
  const [supplierId, setSupplierId] = useState(savedGarage.supplierId || suppliers[0]?.supplierId || "");
  const supplierProducts = useMemo(() => garageDoorProductsForSupplier(products, supplierId), [products, supplierId]);
  const ranges = useMemo(() => garageDoorRangeOptions(products, supplierId), [products, supplierId]);
  const [range, setRange] = useState(savedGarage.range || ranges[0] || "");
  const rangeProducts = useMemo(() => supplierProducts.filter((product) => !range || product.range === range || product.model === range), [supplierProducts, range]);
  const [productId, setProductId] = useState(selectedDetails.productId || rangeProducts[0]?.id || rangeProducts[0]?.productId || "");
  const selectedProduct = useMemo(() => rangeProducts.find((product) => [product.id, product.productId, product.productCode].includes(productId)) || rangeProducts[0] || supplierProducts[0] || products[0] || null, [rangeProducts, supplierProducts, products, productId]);
  const profiles = useMemo(() => selectedProduct ? garageDoorProfileOptions(selectedProduct) : [], [selectedProduct]);
  const [profile, setProfile] = useState(savedGarage.profile || profiles[0] || "");
  const sizes = useMemo(() => selectedProduct ? garageDoorSizeOptions(selectedProduct) : [], [selectedProduct]);
  const [size, setSize] = useState(savedGarage.size || sizes[0] || "Project garage opening");
  const [location, setLocation] = useState(savedGarage.location || "GD01");
  const [openingWidth, setOpeningWidth] = useState(savedGarage.openingWidth || "");
  const [openingHeight, setOpeningHeight] = useState(savedGarage.openingHeight || "");
  const [colourSearch, setColourSearch] = useState("");
  const [finishFamily, setFinishFamily] = useState("");
  const colourOptions = useMemo(() => selectedProduct ? garageDoorColourOptionsForProduct(selectedProduct, { profile, search: colourSearch, family: finishFamily }) : [], [selectedProduct, profile, colourSearch, finishFamily]);
  const finishFamilies = useMemo(() => selectedProduct ? garageDoorFinishFamiliesForProduct(selectedProduct, profile) : [], [selectedProduct, profile]);
  const [colourId, setColourId] = useState(savedGarage.colourId || "");
  const selectedColour = garageDoorColourById(colourId);
  const automationOptions = useMemo(() => selectedProduct ? garageDoorAutomationOptions(selectedProduct) : [], [selectedProduct]);
  const accessoryOptions = useMemo(() => selectedProduct ? garageDoorAccessoryOptions(selectedProduct) : [], [selectedProduct]);
  const [automation, setAutomation] = useState(savedGarage.operation || automationOptions[0] || "");
  const [accessories, setAccessories] = useState(Array.isArray(savedGarage.accessories) ? savedGarage.accessories : ["Two remote controls"]);
  const [compatibilityNotice, setCompatibilityNotice] = useState("");
  const canConfirm = Boolean(selectedProduct && profile && size && automation && selectedColour && colourOptions.some((colour) => colour.colourId === selectedColour.colourId));
  const previewProduct = useMemo(() => selectedProduct ? garageDoorWorkflowProduct(selectedProduct, requirement, { colourId, profile, size, location, openingWidth, openingHeight, automation, accessories }) : null, [selectedProduct, requirement, colourId, profile, size, location, openingWidth, openingHeight, automation, accessories]);
  const financials = previewProduct ? requirementFinancials(requirement, { selected_details: { allowance: previewProduct.garageDoorSelection.allowance, selectedPrice: previewProduct.garageDoorSelection.quotedCost || 0, variationAmount: previewProduct.garageDoorSelection.variation || 0 } }) : { allowance: 0, selectedPrice: 0, variation: 0 };

  useEffect(() => {
    if (!suppliers.some((supplier) => supplier.supplierId === supplierId)) setSupplierId(suppliers[0]?.supplierId || "");
  }, [supplierId, suppliers]);

  useEffect(() => {
    if (!ranges.includes(range)) setRange(ranges[0] || "");
  }, [range, ranges]);

  useEffect(() => {
    const nextProduct = rangeProducts.find((product) => [product.id, product.productId, product.productCode].includes(productId));
    if (!nextProduct && rangeProducts[0]) setProductId(rangeProducts[0].id || rangeProducts[0].productId || rangeProducts[0].productCode);
  }, [productId, rangeProducts]);

  useEffect(() => {
    if (!profiles.includes(profile)) setProfile(profiles[0] || "");
  }, [profile, profiles]);

  useEffect(() => {
    if (!sizes.includes(size)) setSize(sizes[0] || "Project garage opening");
  }, [size, sizes]);

  useEffect(() => {
    if (!selectedColour || !selectedProduct) return;
    if (!colourOptions.some((colour) => colour.colourId === selectedColour.colourId)) {
      setColourId("");
      setCompatibilityNotice(`${selectedColour.officialName} was removed because it is not compatible with ${selectedProduct.range || selectedProduct.productName} ${profile}. Select a compatible colour.`);
    }
  }, [selectedColour, selectedProduct, profile, colourOptions]);

  async function confirmSelection() {
    if (!canConfirm || !previewProduct) return;
    const saved = await onSelect(previewProduct);
    if (saved === false) return;
    onBack();
    window.setTimeout(() => highlightSelectionDashboardCard(requirement.requirementKey), 120);
  }

  return (
    <section className="productLayout garageDoorWorkflow" data-testid="showroom-garage-door-product-grid">
      <aside className="progressNav">
        <div className="navHeader"><h2>Exterior</h2><button type="button" onClick={onBack}><ArrowLeft size={15} />Back</button></div>
        {requirements.map((item) => <button key={item.requirementKey} type="button" className={item.requirementKey === requirement.requirementKey ? "navItem active" : "navItem"} onClick={() => onOpenRequirement(item.requirementKey)}><StatusDot status={statusForRequirement(item, selectedMap.get(item.requirementKey))} />{item.label}</button>)}
      </aside>
      <section className="productPanel">
        <div className="productHeader">
          <div className="sectionHeader"><span>Exterior / Garage Doors</span><h2>Choose garage door specification</h2><p>{libraryProductCount ? `${libraryProductCount} enabled supplier product option${libraryProductCount === 1 ? "" : "s"}` : "No enabled garage-door products found."}</p></div>
          <button type="button" onClick={onBack}><ArrowLeft size={16} />Back to Exterior</button>
        </div>
        <div className="garageSteps">{GARAGE_DOOR_WORKFLOW_STEPS.map((item) => <button key={item.key} type="button" className={step === item.key ? "active" : ""} onClick={() => setStep(item.key)}>{item.label}</button>)}</div>
        {compatibilityNotice ? <div className="clientNote">{compatibilityNotice}</div> : null}
        {step === "supplier" ? <GarageChoiceGrid title="Supplier" items={suppliers.map((supplier) => ({ key: supplier.supplierId, title: supplier.label, meta: `${supplier.count} enabled product${supplier.count === 1 ? "" : "s"}` }))} selected={supplierId} onSelect={(key) => { setSupplierId(key); setStep("range"); setColourId(""); }} /> : null}
        {step === "range" ? <GarageChoiceGrid title="Door Type / Range" items={ranges.map((item) => ({ key: item, title: item, meta: supplierProducts.find((product) => product.range === item)?.configuration || "Garage door range" }))} selected={range} onSelect={(key) => { setRange(key); setStep("profile"); setColourId(""); }} /> : null}
        {step === "profile" ? <GarageChoiceGrid title="Profile / Design" items={profiles.map((item) => ({ key: item, title: item, meta: selectedProduct?.range || "" }))} selected={profile} onSelect={(key) => { setProfile(key); setStep("size"); }} /> : null}
        {step === "size" ? (
          <div className="garageFormPanel">
            <label><span>Garage door ID / location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
            <label><span>Opening width</span><input value={openingWidth} onChange={(event) => setOpeningWidth(event.target.value)} placeholder="e.g. 4800" /></label>
            <label><span>Opening height</span><input value={openingHeight} onChange={(event) => setOpeningHeight(event.target.value)} placeholder="e.g. 2400" /></label>
            <label><span>Configuration</span><select value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button type="button" className="primary" onClick={() => setStep("colour")}>Open Colour / Finish</button>
          </div>
        ) : null}
        {step === "colour" ? (
          <GarageColourSelector product={selectedProduct} profile={profile} colourOptions={colourOptions} finishFamilies={finishFamilies} finishFamily={finishFamily} search={colourSearch} selectedColour={selectedColour} onFamilyChange={setFinishFamily} onSearchChange={setColourSearch} onSelect={(colour) => setColourId(colour.colourId)} onClear={() => setColourId("")} onConfirm={() => setStep("automation")} />
        ) : null}
        {step === "automation" ? <GarageChoiceGrid title="Automation" items={automationOptions.map((item) => ({ key: item, title: item, meta: /quote/i.test(item) ? "Quote required" : "Included/manual" }))} selected={automation} onSelect={(key) => { setAutomation(key); setStep("accessories"); }} /> : null}
        {step === "accessories" ? (
          <div className="garageAccessoryGrid">{accessoryOptions.map((item) => {
            const selected = accessories.includes(item);
            return <button key={item} type="button" className={selected ? "selected" : ""} onClick={() => setAccessories((current) => selected ? current.filter((value) => value !== item) : [...current, item])}><strong>{item}</strong><span>{selected ? "Selected" : /quote/i.test(item) ? "Quote required" : "Select"}</span></button>;
          })}<button type="button" className="primary" onClick={() => setStep("review")}>Review and Confirm</button></div>
        ) : null}
        {step === "review" ? (
          <div className="garageReview" data-testid="garage-door-review">
            <img src={GARAGE_DOORS_DASHBOARD_IMAGE_URL} alt={previewProduct?.productName || "Garage door selection"} />
            <dl>
              <div><dt>Supplier</dt><dd>{previewProduct?.garageDoorSelection.supplier || "Select supplier"}</dd></div>
              <div><dt>Range</dt><dd>{previewProduct?.garageDoorSelection.range || "Select range"}</dd></div>
              <div><dt>Profile</dt><dd>{profile || "Select profile"}</dd></div>
              <div><dt>Colour</dt><dd>{selectedColour ? `${selectedColour.officialName} / ${selectedColour.finishFamily}` : "Colour required"}</dd></div>
              <div><dt>Size</dt><dd>{[openingWidth && `${openingWidth} wide`, openingHeight && `${openingHeight} high`, size].filter(Boolean).join(" / ")}</dd></div>
              <div><dt>Automation</dt><dd>{automation || "Select automation"}</dd></div>
              <div><dt>Accessories</dt><dd>{accessories.join(", ") || "None selected"}</dd></div>
              <div><dt>Pricing</dt><dd>{previewProduct?.priceStatus === PRICE_STATES.quoteRequired ? "Supplier quote required" : signedMoney(financials.variation, currency)}</dd></div>
            </dl>
            <div className="dashboardActions"><button type="button" onClick={onSaveProgress}>Save Progress</button><button type="button" className="primary" disabled={!canConfirm || saving} onClick={confirmSelection}>{saving ? "Saving..." : "Save and Return to Dashboard"}</button></div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function GarageChoiceGrid({ title, items, selected, onSelect }) {
  return <div className="garageChoiceBlock"><h3>{title}</h3><div className="garageChoiceGrid">{items.map((item) => <button key={item.key} type="button" className={selected === item.key ? "selected" : ""} onClick={() => onSelect(item.key)}><strong>{item.title}</strong><span>{item.meta}</span>{selected === item.key ? <b>Selected</b> : null}</button>)}</div></div>;
}

function GarageColourSelector({ product, profile, colourOptions, finishFamilies, finishFamily, search, selectedColour, onFamilyChange, onSearchChange, onSelect, onClear, onConfirm }) {
  const sourceUrl = product?.officialProductURL || product?.productUrl || "";
  const grouped = finishFamilies.map((family) => ({ family, colours: colourOptions.filter((colour) => colour.finishFamily === family) })).filter((group) => group.colours.length);
  return (
    <div className="garageColourPanel" data-testid="garage-door-colour-selector">
      <div className="garageColourToolbar">
        <label><span>Search colour</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Monument, Surfmist, timber..." /></label>
        <label><span>Finish family</span><select value={finishFamily} onChange={(event) => onFamilyChange(event.target.value)}><option value="">All compatible</option>{finishFamilies.map((family) => <option key={family} value={family}>{family}</option>)}</select></label>
        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">View official supplier colour chart</a> : null}
        <button type="button" onClick={onClear}>Clear selection</button>
      </div>
      <p className="garageColourWarning">On-screen colours are indicative. Confirm the final colour using the supplier's current physical sample before ordering.</p>
      <div className="garageColourGroups">
        {grouped.map((group) => <section key={group.family}><h3>{group.family}</h3><div className="garageColourGrid">{group.colours.map((colour) => {
          const selected = selectedColour?.colourId === colour.colourId;
          return <button key={colour.colourId} type="button" className={selected ? "selected" : ""} onClick={() => onSelect(colour)}><span className="garageSwatch" style={{ background: colour.swatchValue }}>{selected ? <Check size={22} /> : null}</span><strong>{colour.officialName}</strong><em>{colour.finishType}</em><small>{colour.supplierCode || "Supplier code not published"} / {colour.priceStatus}</small><small>{colour.compatibleProfiles.join(", ")}</small>{selected ? <b>Selected</b> : null}</button>;
        })}</div></section>)}
      </div>
      {selectedColour ? <div className="garageSelectedColour"><span className="garageSwatch" style={{ background: selectedColour.swatchValue }} /><div><strong>{selectedColour.officialName}</strong><small>{selectedColour.finishFamily} / {selectedColour.supplierName} / {selectedColour.priceStatus}</small></div><button type="button" className="primary" onClick={onConfirm}>Confirm colour</button></div> : <div className="clientNote">Select a compatible colour for {profile || "the selected profile"} before continuing.</div>}
    </div>
  );
}

function highlightSelectionDashboardCard(requirementKey) {
  const card = document.querySelector(`[data-requirement-key="${requirementKey}"]`);
  if (!card) return;
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.classList.add("recentlyCompleted");
  window.setTimeout(() => card.classList.remove("recentlyCompleted"), 1800);
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
  const selectLabel = requirement.requirementKey === "garage-door" ? "Save and Return to Dashboard" : "Select";
  return (
    <article className="productCard">
      <img src={requirementImage(requirement, product)} alt={entity.productName || "Product"} onError={(event) => { event.currentTarget.src = visualPlaceholder(requirement.label, requirement.imageKey); }} />
      <div className="productBody">
        <span>{entity.brand || entity.supplier || "Approved Range"}</span>
        <h3>{entity.productName || product.product_name}</h3>
        <p>{entity.model ? `Model ${entity.model}` : entity.range || "Model to be confirmed"}</p>
        <em>{[entity.colour, entity.finish, entity.size || entity.width].filter(Boolean).join(" / ") || "Finish to be confirmed"}</em>
        <div className="summaryTiles"><MiniTotal label="Price" value={state === PRICE_STATES.current ? money(price, currency) : state} tone={state === PRICE_STATES.current ? "" : "warn"} /><MiniTotal label="Allowance" value={money(allowance, currency)} /><MiniTotal label={variation < 0 ? "Credit" : "Upgrade"} value={signedMoney(variation, currency)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} /></div>
        <div className="cardActions"><button type="button" onClick={onDetail}>View Details</button><button type="button" className="primary" disabled={saving} onClick={onSelect}>{saving ? "Saving..." : selectLabel}</button></div>
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

function mergeSharedCladdingProducts(products = []) {
  const seenCodes = new Set(products.map((product) => String(product.productCode || product.sku || product.id || "").toLowerCase()).filter(Boolean));
  const sharedRows = SHARED_CLADDING_CATALOGUE_PRODUCTS.filter((product) => {
    const code = String(product.productCode || product.productId || "").toLowerCase();
    if (!code || seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });
  return [...products, ...sharedRows];
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
  .showroomActions { display: flex; justify-content: flex-start; align-items: center; gap: 10px; }
  .backButton, .showroom button, .showroom a { min-height: 38px; border-radius: 8px; font-weight: 900; cursor: pointer; text-decoration: none; }
  .backButton { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; padding: 9px 12px; }
  .sectionHeader span, .checklistHeader span, .runningBar span, .setupControls span, .miniTotal span, .finalScheduleTitle span { color: #0f766e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
  .sectionHeader h2, .checklistHeader h2 { margin: 4px 0; color: inherit; font-size: 30px; line-height: 1.08; letter-spacing: 0; }
  .sectionHeader p, .checklistHeader p { margin: 0; color: #64748b; font-weight: 750; }
  .setupControls { margin-top: 14px; display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 10px; align-items: end; background: #fff; border: 1px solid #d7e0e7; border-radius: 8px; padding: 12px; }
  .setupControls label, .filterBar label { display: grid; gap: 5px; }
  .setupControls select, .filterBar select { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #102033; padding: 10px; font-weight: 800; }
  .cardActions, .detailActions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .detailActions a, .cardActions button, .detailActions button, .dashboardActions button, .visualiseButton { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 9px 11px; }
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
  .showroomSection { margin-top: 16px; display: grid; gap: 18px; }
  .sectionHeader { display: grid; gap: 3px; }
  .areaGrid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 16px; }
  .showroom .areaCard { position: relative; min-height: clamp(320px, 24vw, 380px); overflow: hidden; border: 1px solid #d7e0e7; border-radius: 8px; background: #f8fafc; text-align: left; box-shadow: 0 18px 38px rgba(14,31,48,.12); transition: transform .16s ease, box-shadow .16s ease; }
  .areaCard:hover, .categoryCard:hover, .productCard:hover { transform: translateY(-2px); box-shadow: 0 22px 42px rgba(14,31,48,.16); }
  .areaCard img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(1.03) saturate(1.05); }
  .areaOverlay { position: absolute; inset: auto 0 0; display: grid; gap: 5px; padding: 22px; color: #fff; background: linear-gradient(180deg, rgba(11,29,47,0), rgba(11,29,47,.54)); }
  .areaOverlay h3 { margin: 0; font-size: 34px; letter-spacing: 0; }
  .areaOverlay p { margin: 0; color: #e2e8f0; font-weight: 850; }
  .categoryGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
  .categoryCard { overflow: hidden; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; text-align: left; color: #102033; padding: 0; transition: transform .16s ease, box-shadow .16s ease; box-shadow: 0 12px 26px rgba(14,31,48,.08); }
  .categoryCard > img { width: 100%; height: clamp(300px, 22vw, 360px); object-fit: cover; background: #e2e8f0; filter: brightness(1.03) saturate(1.05); }
  .categoryCard.entryDoorCategoryCard > img { object-position: 42% center; }
  .categoryCard.garageDoorCategoryCard > img { object-position: center 56%; }
  .categoryCard.recentlyCompleted { outline: 3px solid #14b8a6; box-shadow: 0 0 0 6px rgba(20,184,166,.2), 0 22px 42px rgba(14,31,48,.16); }
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
  .requirementRow button, .primary { border: 1px solid #0f766e !important; background: #0f766e !important; color: #fff !important; padding: 9px 12px; }
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
  .dashboardActions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .categoryCard.externalLightingCategoryCard > img { object-position: center 58%; }
  .externalLightingWorkflow .productPanel { gap: 16px; }
  .lightingSchedulePanel { display: grid; gap: 12px; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 14px; }
  .lightingScheduleHeader { display: grid; grid-template-columns: minmax(220px, .62fr) minmax(0, 1fr); gap: 12px; align-items: start; }
  .lightingScheduleHeader > div:first-child { display: grid; gap: 3px; }
  .lightingScheduleHeader span { color: #0f766e; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .lightingScheduleHeader h3 { margin: 0; color: #102033; font-size: 21px; line-height: 1.15; }
  .lightingSummaryTiles { display: grid; grid-template-columns: repeat(3, minmax(105px, 1fr)); gap: 8px; }
  .lightingScheduleRows { display: grid; gap: 9px; }
  .lightingScheduleLine { display: grid; grid-template-columns: 82px minmax(0, 1fr) minmax(120px, .25fr) auto; gap: 10px; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 10px; }
  .lightingScheduleLine > img { width: 82px; aspect-ratio: 4 / 3; object-fit: contain; border-radius: 8px; background: #eef2f6; }
  .lightingScheduleLine strong { display: block; color: #102033; line-height: 1.2; }
  .lightingScheduleLine span, .lightingScheduleLine em, .lightingScheduleLine small { display: block; margin-top: 3px; color: #64748b; font-size: 12px; font-style: normal; font-weight: 820; overflow-wrap: anywhere; }
  .lightingLineTotals { display: grid; gap: 3px; justify-items: end; text-align: right; }
  .lightingLineTotals strong { color: #0f766e; }
  .lightingLineActions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .lightingLineActions button { border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 7px 9px; font-size: 12px; }
  .lightingCategoryGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .lightingCategoryGrid button { display: grid; gap: 4px; min-height: 72px; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; color: #102033; padding: 11px; text-align: left; }
  .lightingCategoryGrid button.selected { border-color: #0f766e; background: #f0fdfa; box-shadow: inset 0 0 0 1px #0f766e; }
  .lightingCategoryGrid strong { font-size: 15px; line-height: 1.15; }
  .lightingCategoryGrid span { color: #64748b; font-size: 12px; font-weight: 850; }
  .lightingFilters { display: grid; grid-template-columns: minmax(220px, 1.1fr) repeat(3, minmax(150px, .7fr)); gap: 10px; align-items: end; border: 1px solid #d7e0e7; border-radius: 8px; background: #f8fafc; padding: 12px; }
  .lightingFilters label, .lightingLocationRow label { display: grid; gap: 5px; min-width: 0; }
  .lightingFilters span, .lightingLocationRow span { color: #0f766e; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .lightingFilters input, .lightingFilters select, .lightingLocationRow input, .lightingLocationRow select { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #102033; padding: 10px; font-weight: 800; }
  .lightingProductGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; max-height: 640px; overflow: auto; padding-right: 4px; }
  .lightingProductCard { display: grid; grid-template-rows: auto minmax(96px, 1fr) auto auto auto; gap: 10px; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 10px; color: #102033; }
  .lightingProductCard.selected { border-color: #0f766e; background: #f0fdfa; box-shadow: inset 0 0 0 1px #0f766e; }
  .lightingImageButton { width: 100%; min-height: 0; border: 0; background: #eef2f6; padding: 0; overflow: hidden; }
  .lightingImageButton img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #eef2f6; }
  .lightingProductCard strong { display: block; color: #102033; line-height: 1.2; }
  .lightingProductCard span { display: block; margin-top: 3px; color: #64748b; font-size: 12px; font-weight: 850; }
  .lightingProductCard a { color: #0f766e; font-size: 13px; font-weight: 900; }
  .lightingBadges { display: flex; gap: 6px; flex-wrap: wrap; align-content: start; }
  .lightingBadges span { margin: 0; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #334155; padding: 4px 8px; font-size: 11px; line-height: 1; }
  .lightingAssignment { display: grid; gap: 12px; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 14px; }
  .lightingSelectedProduct { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 14px; align-items: start; }
  .lightingSelectedProduct img { width: 100%; aspect-ratio: 4 / 3; object-fit: contain; border-radius: 8px; background: #eef2f6; }
  .lightingSelectedProduct dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
  .lightingSelectedProduct dl div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px; min-width: 0; }
  .lightingSelectedProduct dt { color: #64748b; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .lightingSelectedProduct dd { margin: 3px 0 0; color: #102033; font-weight: 900; overflow-wrap: anywhere; }
  .lightingBulkActions { display: flex; gap: 8px; flex-wrap: wrap; }
  .lightingBulkActions button { border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 9px 11px; }
  .lightingQuantityPanel { display: grid; grid-template-columns: auto 38px 90px 38px minmax(110px, auto); gap: 8px; align-items: center; justify-content: start; }
  .lightingQuantityPanel span { color: #0f766e; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .lightingQuantityPanel button { width: 38px; height: 38px; border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 0; }
  .lightingQuantityPanel input { width: 90px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #102033; padding: 9px; text-align: center; font-weight: 900; }
  .lightingQuantityPanel strong { color: #0f766e; }
  .lightingLocationRows { display: grid; gap: 8px; }
  .lightingLocationRow { display: grid; grid-template-columns: minmax(90px, .45fr) minmax(150px, .7fr) minmax(160px, 1fr) minmax(160px, 1fr); gap: 8px; align-items: end; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 10px; }
  .lightingSummary { display: grid; gap: 6px; border: 1px solid #a7f3d0; border-radius: 8px; background: #ecfdf5; color: #047857; padding: 12px; }
  .lightingSummary strong { color: #064e3b; font-size: 20px; }
  .lightingSummary span { color: #047857; font-weight: 850; }
  .garageDoorWorkflow .productPanel { gap: 16px; }
  .garageSteps { display: flex; gap: 8px; flex-wrap: wrap; }
  .garageSteps button { border: 1px solid #cbd5e1; background: #fff; color: #102033; padding: 8px 10px; }
  .garageSteps button.active { border-color: #0f766e; background: #ccfbf1; color: #115e59; }
  .garageChoiceBlock, .garageFormPanel, .garageColourPanel, .garageReview { display: grid; gap: 12px; }
  .garageChoiceBlock h3, .garageColourGroups h3 { margin: 0; color: #102033; font-size: 20px; }
  .garageChoiceGrid, .garageAccessoryGrid, .garageColourGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .garageChoiceGrid button, .garageAccessoryGrid button, .garageColourGrid button { position: relative; display: grid; gap: 7px; min-height: 120px; border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; color: #102033; text-align: left; padding: 12px; }
  .garageChoiceGrid button.selected, .garageAccessoryGrid button.selected, .garageColourGrid button.selected { border-color: #0f766e; background: #f0fdfa; box-shadow: 0 0 0 3px rgba(15,118,110,.18), inset 0 0 0 1px #0f766e; }
  .garageChoiceGrid strong, .garageAccessoryGrid strong, .garageColourGrid strong { font-size: 18px; line-height: 1.15; }
  .garageChoiceGrid span, .garageAccessoryGrid span, .garageColourGrid em, .garageColourGrid small, .garageSelectedColour small { color: #64748b; font-style: normal; font-size: 13px; font-weight: 800; }
  .garageChoiceGrid b, .garageColourGrid b { justify-self: start; border: 1px solid #5eead4; border-radius: 999px; background: #ccfbf1; color: #115e59; padding: 3px 8px; font-size: 11px; line-height: 1; }
  .garageFormPanel { grid-template-columns: repeat(4, minmax(160px, 1fr)); align-items: end; }
  .garageFormPanel label, .garageColourToolbar label { display: grid; gap: 5px; }
  .garageFormPanel label span, .garageColourToolbar span { color: #0f766e; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .garageFormPanel input, .garageFormPanel select, .garageColourToolbar input, .garageColourToolbar select { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #102033; padding: 10px; font-weight: 800; }
  .garageColourToolbar { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(180px, .7fr) auto auto; gap: 10px; align-items: end; border: 1px solid #d7e0e7; border-radius: 8px; background: #f8fafc; padding: 12px; }
  .garageColourToolbar a { color: #0f766e; font-weight: 900; }
  .garageColourWarning { margin: 0; border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; color: #92400e; padding: 10px 12px; font-weight: 850; }
  .garageColourGroups { display: grid; gap: 14px; }
  .garageSwatch { display: grid; place-items: center; width: 100%; height: 82px; border: 1px solid rgba(15,23,42,.18); border-radius: 8px; color: #fff; text-shadow: 0 1px 3px rgba(15,23,42,.55); }
  .garageSelectedColour { display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; gap: 12px; align-items: center; border: 1px solid #0f766e; border-radius: 8px; background: #f0fdfa; padding: 12px; }
  .garageSelectedColour .garageSwatch { height: 70px; }
  .garageReview { grid-template-columns: minmax(220px, .7fr) minmax(0, 1fr); border: 1px solid #d7e0e7; border-radius: 8px; background: #fff; padding: 14px; }
  .garageReview img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .garageReview dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
  .garageReview dt { color: #64748b; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .garageReview dd { margin: 3px 0 0; color: #102033; font-weight: 900; }
  .garageReview .dashboardActions { grid-column: 1 / -1; }
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
  @media (max-width: 980px) { .categoryCard > img { height: clamp(240px, 36vw, 300px); } }
  @media (max-width: 720px) { .showroom { padding: 12px; } .areaGrid, .categoryGrid, .productGrid, .summaryTiles, .runningBar, .lightingScheduleHeader, .lightingSummaryTiles, .lightingScheduleLine, .lightingFilters, .lightingSelectedProduct, .lightingSelectedProduct dl, .lightingQuantityPanel, .lightingLocationRow, .garageFormPanel, .garageColourToolbar, .garageSelectedColour, .garageReview, .garageReview dl { grid-template-columns: 1fr; } .showroom .areaCard { min-height: clamp(240px, 72vw, 300px); } .categoryCard > img { height: clamp(200px, 64vw, 240px); } .lightingLineTotals { justify-items: start; text-align: left; } .lightingLineActions { justify-content: flex-start; } .requirementRow { grid-template-columns: 26px 64px minmax(0,1fr); } .rowMoney, .requirementRow button { grid-column: 1 / -1; } .setupControls { grid-template-columns: 1fr; } }
`;
