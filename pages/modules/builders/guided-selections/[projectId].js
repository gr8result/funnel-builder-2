import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { supabase } from "../../../../utils/supabase-client";
import {
  DEFAULT_WARNING_THRESHOLD_PERCENT,
  calculateSelectionVariation,
  calculateSessionBudget,
  buildSelectionSnapshot,
  hasActiveDraftVariation,
  numberValue,
  roundMoney,
} from "../../../../lib/builders/selectionBudget";
import { INTERNAL_ROLES, COST_ROLES } from "../../../../lib/product-library/constants";
import SelectionChecklistNav from "../../../../components/product-library/SelectionChecklistNav";
import GuidedSelectionWorkspace from "../../../../components/product-library/GuidedSelectionWorkspace";
import RunningSelectionsSummary from "../../../../components/product-library/RunningSelectionsSummary";
import ChecklistAdminPanel from "../../../../components/product-library/ChecklistAdminPanel";

const SUMMARY_COLLAPSE_KEY = "gr8:guidedSelections:summaryCollapsed";

export default function GuidedSelectionsPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const { workspaceId, role, loading: workspaceLoading } = useWorkspace();

  const isInternal = INTERNAL_ROLES.has(role);
  const canViewCosts = COST_ROLES.has(role);

  const [project, setProject] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [session, setSession] = useState(null);
  const [selections, setSelections] = useState([]);
  const [budgetSettings, setBudgetSettings] = useState(null);
  const [activeItemId, setActiveItemId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [checklistAdminOpen, setChecklistAdminOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(SUMMARY_COLLAPSE_KEY) === "1"; } catch { return false; }
  });

  function setSummaryCollapsed(next) {
    setSummaryCollapsedState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      try { localStorage.setItem(SUMMARY_COLLAPSE_KEY, value ? "1" : "0"); } catch {}
      return value;
    });
  }

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const manufacturerById = useMemo(() => new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name])), [manufacturers]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name])), [suppliers]);

  const activeSelections = useMemo(() => selections.filter((selection) => selection.is_active !== false), [selections]);
  const selectedByItemId = useMemo(() => {
    const map = new Map();
    activeSelections.forEach((selection) => {
      const itemId = selection.metadata?.checklist_item_id;
      if (itemId) map.set(itemId, selection);
    });
    return map;
  }, [activeSelections]);

  const enabledChecklistItems = useMemo(() => checklistItems.filter((item) => item.active), [checklistItems]);
  const activeItem = useMemo(() => enabledChecklistItems.find((item) => item.id === activeItemId) || null, [enabledChecklistItems, activeItemId]);
  const activeCategory = activeItem ? categoryById.get(activeItem.category_id) : null;
  const activeProducts = useMemo(() => {
    if (!activeItem?.category_id) return [];
    return products.filter((product) => product.category_id === activeItem.category_id);
  }, [products, activeItem]);
  const activeSelectionForItem = activeItem ? selectedByItemId.get(activeItem.id) : null;

  // Load project + checklist + catalogue once per project.
  useEffect(() => {
    if (!workspaceId || !projectId) return;
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError("");
      const [projectResult, checklistResult, categoryResult, productResult, manufacturerResult, supplierResult, settingsResult] = await Promise.all([
        supabase.from("builder_commercial_projects").select("id, project_name, client_name, site_address, status, currency, original_estimate_total, contract_total, pricing_tier").eq("workspace_id", workspaceId).eq("id", projectId).maybeSingle(),
        supabase.from("builder_selection_checklist_items").select("id, workspace_id, selection_group, room, item_label, category_id, required, active, sort_order").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("sort_order", { ascending: true }),
        supabase.from("builder_product_categories").select("id, category_key, category_name, selection_group, selection_control_type").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`),
        supabase.from("builder_products").select("id, product_name, category_id, manufacturer_id, supplier_id, model, colour, finish, primary_image_url, product_url, verification_status, cost_price, base_allowance, upgrade_value_mode, upgrade_cost, pricing_tier, standard_included, client_notes").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).in("library_scope", ["CLIENT_SELECTION", "BOTH"]).eq("active", true).eq("available_for_selection", true),
        supabase.from("builder_product_manufacturers").select("id, manufacturer_name").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`),
        supabase.from("builder_product_suppliers").select("id, supplier_name").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`),
        supabase.from("builder_selection_budget_settings").select("*").eq("workspace_id", workspaceId).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      const firstError = projectResult.error || checklistResult.error || categoryResult.error || productResult.error || manufacturerResult.error || supplierResult.error;
      if (firstError) {
        setError(firstError.message || "Could not load guided selections.");
        setLoading(false);
        return;
      }
      setProject(projectResult.data || null);
      setChecklistItems(checklistResult.data || []);
      setCategories(categoryResult.data || []);
      setProducts(productResult.data || []);
      setManufacturers(manufacturerResult.data || []);
      setSuppliers(supplierResult.data || []);
      setBudgetSettings((settingsResult.data || [])[0] || null);
      setActiveItemId((current) => current || (checklistResult.data || [])[0]?.id || "");
      setLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [workspaceId, projectId]);

  // Load or create the selection session + its selections.
  useEffect(() => {
    if (!workspaceId || !projectId) return;
    let cancelled = false;
    async function loadSession() {
      const { data: existing } = await supabase
        .from("builder_selection_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      let sessionRow = (existing || [])[0] || null;
      if (!sessionRow && project) {
        const originalEstimateTotal = numberValue(project.original_estimate_total || project.contract_total);
        const { data: created, error: createError } = await supabase
          .from("builder_selection_sessions")
          .insert({
            workspace_id: workspaceId,
            project_id: projectId,
            session_name: `${project.project_name || "Project"} Guided Selections`,
            original_estimate_total: originalEstimateTotal,
            current_updated_estimate_total: originalEstimateTotal,
            warning_threshold_percent: DEFAULT_WARNING_THRESHOLD_PERCENT,
          })
          .select("*")
          .single();
        if (createError) { setError(createError.message || "Could not start a selections session."); return; }
        sessionRow = created;
      }
      if (!cancelled && sessionRow) {
        setSession(sessionRow);
        const { data: selectionRows } = await supabase
          .from("builder_client_selections")
          .select("id, session_id, product_id, category, subcategory, room, title, selected_product_name, brand, model_number, colour, finish, image_url, included_allowance, builder_cost, variation_amount, selection_status, is_active, metadata, selection_snapshot, created_at")
          .eq("workspace_id", workspaceId)
          .eq("project_id", projectId)
          .eq("session_id", sessionRow.id);
        if (!cancelled) setSelections(selectionRows || []);
      }
    }
    loadSession();
    return () => { cancelled = true; };
  }, [workspaceId, projectId, project]);

  const budget = useMemo(() => calculateSessionBudget({
    originalEstimateTotal: session?.original_estimate_total || project?.original_estimate_total || 0,
    privateUpgradeCeiling: session?.private_upgrade_ceiling || 0,
    warningThresholdPercent: session?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
    selections: activeSelections,
  }), [session, project, activeSelections]);

  const totalUpgrades = useMemo(() => roundMoney(activeSelections.reduce((total, selection) => total + Math.max(0, numberValue(selection.variation_amount)), 0)), [activeSelections]);
  const totalCredits = useMemo(() => roundMoney(activeSelections.reduce((total, selection) => total + Math.max(0, -numberValue(selection.variation_amount)), 0)), [activeSelections]);
  const requiredMissingCount = useMemo(() => enabledChecklistItems.filter((item) => item.required && !selectedByItemId.has(item.id)).length, [enabledChecklistItems, selectedByItemId]);

  async function persistSessionTotals(nextSelections) {
    const nextBudget = calculateSessionBudget({
      originalEstimateTotal: session?.original_estimate_total || project?.original_estimate_total || 0,
      privateUpgradeCeiling: session?.private_upgrade_ceiling || 0,
      warningThresholdPercent: session?.warning_threshold_percent || DEFAULT_WARNING_THRESHOLD_PERCENT,
      selections: nextSelections.filter((selection) => selection.is_active !== false),
    });
    await supabase
      .from("builder_selection_sessions")
      .update({
        current_net_selection_variation: nextBudget.currentNetSelectionVariation,
        current_updated_estimate_total: nextBudget.currentUpdatedEstimateTotal,
        selection_budget_status: nextBudget.selectionBudgetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", session.id);
  }

  async function handleSelectProduct(product) {
    if (!activeItem || !session) return;
    setSaving(true);
    setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const allowance = numberValue(product.base_allowance);
      const pricing = calculateSelectionVariation({
        allowance,
        selectedProduct: { builderCost: product.cost_price, installationCost: 0 },
        quantity: 1,
        projectPricingSettings: budgetSettings || {},
      });
      const snapshot = buildSelectionSnapshot(
        { ...product, supplier_name: supplierById.get(product.supplier_id), brand: manufacturerById.get(product.manufacturer_id) },
        { includedAllowance: allowance, builderCost: product.cost_price, variationAmount: pricing.clientVariationTotal }
      );

      // Replace any prior selection for this exact checklist item first.
      const prior = selectedByItemId.get(activeItem.id);
      if (prior) {
        await supabase.from("builder_client_selections").update({ is_active: false, selection_status: "replaced", updated_by: userId, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", prior.id);
      }

      const payload = {
        workspace_id: workspaceId,
        project_id: projectId,
        session_id: session.id,
        product_id: product.id,
        category: activeCategory?.category_key || activeItem.item_label,
        subcategory: activeCategory?.category_name || null,
        room: activeItem.room || null,
        title: activeItem.item_label,
        selected_product_name: product.product_name,
        selected_supplier_id: product.supplier_id || null,
        selected_supplier_name: supplierById.get(product.supplier_id) || null,
        selected_colour: product.colour || null,
        selected_finish: product.finish || null,
        brand: manufacturerById.get(product.manufacturer_id) || null,
        product_name: product.product_name,
        model_number: product.model || null,
        colour: product.colour || null,
        finish: product.finish || null,
        image_url: product.primary_image_url || null,
        included_allowance: allowance,
        allowance_amount: allowance,
        builder_cost: numberValue(product.cost_price),
        variation_amount: pricing.clientVariationTotal,
        selection_snapshot: snapshot,
        selection_status: "selected",
        status: "selected",
        is_active: true,
        is_included_selection: pricing.clientVariationTotal === 0,
        selected_at: new Date().toISOString(),
        metadata: { checklist_item_id: activeItem.id, source: "guided_selections" },
        created_by: userId,
        updated_by: userId,
      };
      const { data: created, error: insertError } = await supabase.from("builder_client_selections").insert(payload).select("*").single();
      if (insertError) throw insertError;

      const nextSelections = [...selections.map((row) => (row.id === prior?.id ? { ...row, is_active: false } : row)), created];
      setSelections(nextSelections);
      await persistSessionTotals(nextSelections);
    } catch (selectError) {
      setError(selectError?.message || "Could not save this selection.");
    } finally {
      setSaving(false);
    }
  }

  function goToNextIncomplete() {
    const currentIndex = enabledChecklistItems.findIndex((item) => item.id === activeItemId);
    const next = enabledChecklistItems.slice(currentIndex + 1).find((item) => !selectedByItemId.has(item.id))
      || enabledChecklistItems.find((item) => !selectedByItemId.has(item.id));
    if (next) setActiveItemId(next.id);
  }

  async function handleFinalise() {
    const missing = enabledChecklistItems.filter((item) => item.required && !selectedByItemId.has(item.id));
    if (missing.length) {
      setError(`${missing.length} required selection(s) still need to be made: ${missing.slice(0, 5).map((item) => item.item_label).join(", ")}${missing.length > 5 ? "..." : ""}`);
      return;
    }
    if (!isInternal) {
      setError("Only builder and designer roles can finalise client selections.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data: variationRows } = await supabase.from("builder_variations").select("id, variation_number, status").eq("workspace_id", workspaceId).eq("id", session?.variation_id || "").limit(1);
      const existingVariation = (variationRows || [])[0] || null;
      if (hasActiveDraftVariation(session, existingVariation)) {
        setSuccess(`This project already has a ${existingVariation?.status || "draft"} variation (${existingVariation?.variation_number || "in progress"}). Review it in Variations.`);
        return;
      }
      await supabase.from("builder_selection_sessions").update({ status: "summary_ready", updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", session.id);
      setSuccess("Client selections finalised. Use Prepare Quote Update to send the variation for office review.");
    } catch (finaliseError) {
      setError(finaliseError?.message || "Could not finalise selections.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChecklistItem(fields) {
    const { data, error: createError } = await supabase.from("builder_selection_checklist_items").insert(fields).select("*").single();
    if (createError) throw createError;
    setChecklistItems((current) => [...current, data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  }

  async function handleUpdateChecklistItem(itemId, fields) {
    const { data, error: updateError } = await supabase
      .from("builder_selection_checklist_items")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", itemId)
      .select("*")
      .single();
    if (updateError) { setError(updateError.message || "Could not update this checklist item."); return; }
    setChecklistItems((current) => current.map((item) => (item.id === itemId ? data : item)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  }

  async function handleDeactivateChecklistItem(itemId) {
    await handleUpdateChecklistItem(itemId, { active: false });
  }

  if (workspaceLoading || loading) {
    return <main className="page"><p className="loading">Loading guided selections...</p><style jsx>{`.page{padding:40px;color:#93a4bd;background:#0b1220;min-height:100vh}`}</style></main>;
  }

  return (
    <>
      <Head><title>{project?.project_name ? `${project.project_name} — Client Selections` : "Guided Client Selections"}</title></Head>
      <main className="page">
        <header className="topbar">
          <div>
            <p className="eyebrow">Client Selections Appointment</p>
            <h1>{project?.project_name || "Project"}</h1>
            <span className="meta">{project?.client_name}{project?.site_address ? ` · ${project.site_address}` : ""}</span>
          </div>
          <div className="topActions">
            {isInternal && <button type="button" className="manageChecklistButton" onClick={() => setChecklistAdminOpen(true)}>Manage Checklist</button>}
            <Link href="/modules/builders/product-library">Client Selections Library</Link>
            <Link href="/modules/builders/selections-book">Office Review Table</Link>
          </div>
        </header>

        {isInternal && (
          <ChecklistAdminPanel
            open={checklistAdminOpen}
            items={checklistItems}
            categories={categories}
            workspaceId={workspaceId}
            onClose={() => setChecklistAdminOpen(false)}
            onCreate={handleCreateChecklistItem}
            onUpdate={handleUpdateChecklistItem}
            onDeactivate={handleDeactivateChecklistItem}
          />
        )}

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className={`layout ${summaryCollapsed ? "summaryCollapsed" : ""}`}>
          <section className="checklistPane">
            <SelectionChecklistNav items={enabledChecklistItems} selectedByItemId={selectedByItemId} activeItemId={activeItemId} onSelectItem={(item) => setActiveItemId(item.id)} />
          </section>

          <section className="workspacePane">
            <GuidedSelectionWorkspace
              checklistItem={activeItem}
              category={activeCategory}
              products={activeProducts}
              manufacturerById={manufacturerById}
              supplierById={supplierById}
              selectedProductId={activeSelectionForItem?.product_id}
              canViewCosts={canViewCosts}
              onSelectProduct={handleSelectProduct}
            />
            {activeItem && (
              <div className="itemActions">
                <button type="button" className="ghost" onClick={goToNextIncomplete}>Skip for Now</button>
                <button type="button" className="primary" onClick={goToNextIncomplete} disabled={!activeSelectionForItem}>Save and Next</button>
              </div>
            )}
          </section>

          <section className="summaryPane">
            <RunningSelectionsSummary
              completedCount={selectedByItemId.size}
              totalCount={enabledChecklistItems.length}
              requiredMissingCount={requiredMissingCount}
              totalUpgrades={totalUpgrades}
              totalCredits={totalCredits}
              netVariation={budget.currentNetSelectionVariation}
              collapsed={summaryCollapsed}
              onToggleCollapsed={() => setSummaryCollapsed((current) => !current)}
              onSaveProgress={() => setSuccess("Progress saved.")}
              onFinalise={handleFinalise}
              onGenerateSchedule={() => router.push(`/modules/builders/inclusions-schedule/${projectId}`)}
              onPrepareQuoteUpdate={() => router.push(`/modules/builders/client-selections?projectId=${projectId}`)}
              saving={saving}
              finalised={session?.status === "summary_ready" || session?.status === "variation_created"}
            />
          </section>
        </div>
      </main>

      <style jsx>{`
        .page { min-height: 100vh; background: #0b1220; color: #e5eefb; padding: 20px 24px 40px; }
        .topbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px 16px; margin-bottom: 16px; }
        .eyebrow { margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #7dd3fc; }
        .topbar h1 { margin: 4px 0 2px; font-size: 24px; }
        .meta { color: #93a4bd; font-size: 13px; }
        .topActions { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
        .topActions :global(a) { color: #93a4bd; font-size: 13px; font-weight: 700; text-decoration: none; }
        .topActions :global(a:hover) { color: #e5eefb; }
        .manageChecklistButton { background: transparent; border: 1px solid rgba(148,163,184,0.35); color: #e5eefb; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .manageChecklistButton:hover { border-color: #7dd3fc; color: #7dd3fc; }
        .alert { padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
        .alert.error { background: rgba(127,29,29,0.25); border: 1px solid rgba(248,113,113,0.4); color: #fecaca; }
        .alert.success { background: rgba(21,128,61,0.2); border: 1px solid rgba(74,222,128,0.4); color: #bbf7d0; }
        .layout { display: grid; grid-template-columns: 280px minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
        .layout.summaryCollapsed { grid-template-columns: 280px minmax(0, 1fr) 56px; }
        .checklistPane { background: #0b1626; border: 1px solid rgba(148,163,184,0.18); border-radius: 12px; padding: 14px; height: calc(100vh - 150px); overflow: hidden; }
        .workspacePane { display: grid; gap: 14px; align-content: start; }
        .itemActions { display: flex; justify-content: flex-end; gap: 10px; }
        .itemActions button { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 800; cursor: pointer; }
        .itemActions .ghost { background: transparent; border: 1px solid rgba(148,163,184,0.35); color: #e5eefb; }
        .itemActions .primary { background: #16a34a; color: #fff; }
        .itemActions button:disabled { opacity: 0.5; cursor: not-allowed; }
        .summaryPane { position: sticky; top: 20px; background: #0b1626; border: 1px solid rgba(148,163,184,0.18); border-radius: 12px; padding: 14px; height: calc(100vh - 150px); }
        @media (max-width: 1180px) {
          .layout, .layout.summaryCollapsed { grid-template-columns: 220px minmax(0, 1fr); grid-template-areas: "checklist workspace" "summary summary"; }
          .checklistPane { grid-area: checklist; }
          .workspacePane { grid-area: workspace; }
          .summaryPane { grid-area: summary; height: auto; max-height: 40vh; position: static; }
        }
        @media (max-width: 780px) {
          .page { padding: 14px 14px 32px; }
          .layout, .layout.summaryCollapsed { grid-template-columns: 1fr; grid-template-areas: "checklist" "workspace" "summary"; }
          .checklistPane { height: auto; max-height: 45vh; }
          .topbar h1 { font-size: 20px; }
          .itemActions { flex-wrap: wrap; }
          .itemActions button { flex: 1 1 auto; }
        }
      `}</style>
    </>
  );
}
