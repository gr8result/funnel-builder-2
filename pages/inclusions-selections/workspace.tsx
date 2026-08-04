import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ApplyToDialog } from "../../src/modules/inclusions-selections/components/ApplyToDialog";
import { ApplyToPreview } from "../../src/modules/inclusions-selections/components/ApplyToPreview";
import { CategoryNavigationPanel } from "../../src/modules/inclusions-selections/components/CategoryNavigationPanel";
import { ProductSelectionModal } from "../../src/modules/inclusions-selections/components/ProductSelectionModal";
import { RoomNavigationPanel } from "../../src/modules/inclusions-selections/components/RoomNavigationPanel";
import { InclusionsSelectionsNoFileState } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsNoFileState";
import { InclusionsSelectionsProjectBanner } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { WorkspaceProgressSummary } from "../../src/modules/inclusions-selections/components/WorkspaceProgressSummary";
import { WorkspaceStageActions } from "../../src/modules/inclusions-selections/components/WorkspaceStageActions";
import { WorkspaceValidationSummary } from "../../src/modules/inclusions-selections/components/WorkspaceValidationSummary";
import { WorkspaceViewSwitcher } from "../../src/modules/inclusions-selections/components/WorkspaceViewSwitcher";
import { InMemoryProductSelectionCatalogueAdapter } from "../../src/modules/inclusions-selections/products/inMemoryProductSelectionCatalogueAdapter";
import type { ProductReference, ProductVariantReference } from "../../src/modules/inclusions-selections/products/productReferenceTypes";
import type { ProductSearchFilters, SupplierReference } from "../../src/modules/inclusions-selections/products/productSelectionCatalogueAdapter";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import {
  reconcileProjectRequirements,
  saveTemplateStage,
} from "../../src/modules/inclusions-selections/services/templateStageService";
import {
  applySelectionToTargets,
  createProjectSelection,
  getRequirementWorkspaceRows,
  loadCategoryView,
  loadRoomView,
  loadSelectionWorkspace,
  previewApplyTo,
  saveWorkspaceDraft,
  validateSelectionWorkspace,
} from "../../src/modules/inclusions-selections/services/selectionWorkspaceService";
import type { ApplyToPreview as ApplyToPreviewModel, ApplyToScope, SelectionWorkspaceState, WorkspaceView } from "../../src/modules/inclusions-selections/services/selectionWorkspaceService";
import type { DomainIssue, DomainResult } from "../../src/modules/inclusions-selections/validation/errors";

const productAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizedNavText(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function navigatorAreaMatches(areaName: string, requestedArea: string): boolean {
  if (!requestedArea) return false;
  const area = normalizedNavText(areaName);
  const requested = normalizedNavText(requestedArea).replace(/\bs\b$/, "");
  return area.includes(requested) || requested.includes(area.replace(/\bs\b$/, ""));
}

function navigatorRequirementMatches(title: string, productType: string): boolean {
  if (!productType) return false;
  const requirement = normalizedNavText(title);
  const requested = normalizedNavText(productType).replace(/\bs\b$/, "");
  return requirement.includes(requested) || requested.includes(requirement.replace(/\bs\b$/, ""));
}

export default function InclusionsSelectionsWorkspacePage() {
  const router = useRouter();
  const [state, setState] = useState<SelectionWorkspaceState | null>(null);
  const [issues, setIssues] = useState<DomainIssue[]>([]);
  const [view, setView] = useState<WorkspaceView>("room");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductReference[]>([]);
  const [variants, setVariants] = useState<ProductVariantReference[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierReference[]>([]);
  const [pickerRequirementId, setPickerRequirementId] = useState("");
  const [pickerFilters, setPickerFilters] = useState<ProductSearchFilters>({});
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerVariantId, setPickerVariantId] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerMessage, setPickerMessage] = useState("");
  const [pickerError, setPickerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [applyScope, setApplyScope] = useState<ApplyToScope>("this_requirement");
  const [applySourceRequirementId, setApplySourceRequirementId] = useState("");
  const [applyPreview, setApplyPreview] = useState<ApplyToPreviewModel | null>(null);
  const [selectedApplyTargets, setSelectedApplyTargets] = useState<string[]>([]);
  const [navigatorRequestKey, setNavigatorRequestKey] = useState("");

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);

  useEffect(() => {
    if (!router.isReady || !context.organisationId || !context.projectId) return;
    let cancelled = false;
    loadSelectionWorkspace(context as ProjectSelectionContext).then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setView(loaded.draftState.selectedView);
      const requestedArea = queryValue(router.query.area);
      const areaFromNavigator = loaded.templateStage.areaRegister.areas.find((area) => navigatorAreaMatches(area.name, requestedArea));
      const kitchen = loaded.templateStage.areaRegister.areas.find((area) => area.name.toLowerCase() === "kitchen");
      setSelectedAreaId(areaFromNavigator?.id ?? loaded.draftState.selectedAreaId ?? kitchen?.id ?? loaded.templateStage.areaRegister.areas[0]?.id ?? "");
      setSelectedCategory(loaded.requirements[0]?.category ?? "");
      setIssues(validateSelectionWorkspace(loaded, true).issues);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, context.organisationId, context.projectId, router.query.area]);

  useEffect(() => {
    if (!router.isReady || !state || !selectedAreaId || pickerRequirementId) return;
    const productType = queryValue(router.query.productType);
    if (!productType) return;
    const requestKey = `${queryValue(router.query.area)}|${productType}`;
    if (navigatorRequestKey === requestKey) return;
    const rows = getRequirementWorkspaceRows(state, { areaId: selectedAreaId });
    const matchingRow = rows.find((row) => navigatorRequirementMatches(row.requirement.title, productType));
    if (!matchingRow) return;
    setNavigatorRequestKey(requestKey);
    openProductPicker(matchingRow.requirement.id);
  }, [router.isReady, router.query.area, router.query.productType, state, selectedAreaId, pickerRequirementId, navigatorRequestKey]);

  function applyResult(result: DomainResult<SelectionWorkspaceState>) {
    setIssues(result.issues);
    if (result.ok && result.value) {
      setState(result.value);
      return true;
    }
    return false;
  }

  async function loadPickerProducts(requirementId: string, filters: ProductSearchFilters = pickerFilters) {
    if (!state) return;
    const requirement = state.requirements.find((item) => item.id === requirementId);
    if (!requirement) return;
    setPickerLoading(true);
    const nextProducts = await productAdapter.searchCompatibleProducts(requirement, filters);
    setProducts(nextProducts);
    const supplierRows = await Promise.all([...new Set(nextProducts.map((product) => product.supplierId).filter(Boolean) as string[])].map((supplierId) => productAdapter.getSupplier(supplierId)));
    setSuppliers(supplierRows.filter((supplier): supplier is SupplierReference => Boolean(supplier)));
    setPickerLoading(false);
  }

  async function openProductPicker(requirementId: string) {
    const currentSelection = state?.selections.find((selection) => selection.requirementId === requirementId);
    setPickerRequirementId(requirementId);
    setPickerFilters({});
    setPickerProductId(currentSelection?.value.productReferenceId ?? "");
    setPickerVariantId(currentSelection?.value.variantId ?? "");
    setPickerMessage("");
    setPickerError("");
    setVariants(currentSelection?.value.productReferenceId ? await productAdapter.listVariants(currentSelection.value.productReferenceId) : []);
    await loadPickerProducts(requirementId, {});
  }

  async function updatePickerFilters(nextFilters: ProductSearchFilters) {
    setPickerFilters(nextFilters);
    if (pickerRequirementId) await loadPickerProducts(pickerRequirementId, nextFilters);
  }

  async function choosePickerProduct(productId: string) {
    setPickerProductId(productId);
    setPickerVariantId("");
    setVariants(await productAdapter.listVariants(productId));
  }

  async function selectProduct(requirementId: string, productId: string, variantId?: string) {
    if (!state) return;
    const product = await productAdapter.getProduct(productId);
    const productVariants = await productAdapter.listVariants(productId);
    if (product?.requiresVariant && !variantId && productVariants.length > 0) {
      setPickerError("Choose a variant before selecting this product.");
      setPickerProductId(productId);
      setVariants(productVariants);
      return;
    }
    const result = await createProjectSelection(state, requirementId, productId, variantId, productAdapter);
    if (!applyResult(result) || !result.value) {
      setPickerError(result.issues[0]?.message ?? "Could not select this product.");
      return;
    }
    const saved = await saveWorkspaceDraft(result.value);
    if (saved.ok && saved.value) setState(saved.value);
    setPickerMessage(`${product?.name ?? "Product"} selected.`);
    setPickerRequirementId("");
  }

  async function handleSave() {
    if (!state) return;
    setSaving(true);
    const saved = await saveWorkspaceDraft(state);
    setSaving(false);
    applyResult(saved);
  }

  async function handleGenerateRequirements() {
    if (!state) return;
    const reconciled = reconcileProjectRequirements(state.templateStage);
    if (!reconciled.ok || !reconciled.value) {
      setIssues(reconciled.issues);
      return;
    }
    setSaving(true);
    const saved = await saveTemplateStage(reconciled.value);
    const reloaded = await loadSelectionWorkspace(state.context);
    setSaving(false);
    if (!saved.ok) {
      setIssues(saved.issues);
      return;
    }
    const kitchen = reloaded.templateStage.areaRegister.areas.find((area) => area.name.toLowerCase() === "kitchen");
    setState(reloaded);
    setSelectedAreaId(kitchen?.id ?? reloaded.templateStage.areaRegister.areas[0]?.id ?? "");
    setIssues(validateSelectionWorkspace(reloaded, true).issues);
  }

  async function handleApplyPreview(sourceRequirementId = applySourceRequirementId) {
    if (!state || !sourceRequirementId) return;
    const preview = await previewApplyTo(state, sourceRequirementId, applyScope, selectedAreaId ? [selectedAreaId] : [], productAdapter);
    setApplyPreview(preview);
    setSelectedApplyTargets(preview.compatibleTargets.map((target) => target.requirementId));
  }

  function handleApplyConfirm() {
    if (!state || !applyPreview) return;
    applyResult(applySelectionToTargets(state, applyPreview, selectedApplyTargets));
    setApplyPreview(null);
  }

  async function handleContinue() {
    if (!state) return;
    const validation = validateSelectionWorkspace(state, false);
    if (!applyResult(validation)) return;
    setSaving(true);
    const saved = await saveWorkspaceDraft(state);
    setSaving(false);
    if (!applyResult(saved)) return;
    router.push(hrefForStage("review", state.context));
  }

  if (router.isReady && (!context.organisationId || !context.projectId)) {
    return (
      <main className="selectionWorkspacePage">
        <InclusionsSelectionsProjectBanner currentStage="workspace" context={context} />
        <InclusionsSelectionsStageNav currentStage="workspace" context={context} />
        <InclusionsSelectionsNoFileState context={context} />
        <style jsx global>{workspaceStyles}</style>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="selectionWorkspacePage">
        <InclusionsSelectionsProjectBanner currentStage="workspace" context={context} />
        <InclusionsSelectionsStageNav currentStage="workspace" context={context} />
        <section className="requiredState"><h1>Inclusions and Selections Workspace</h1><p>Loading selection workspace.</p></section>
        <style jsx global>{workspaceStyles}</style>
      </main>
    );
  }

  const roomGroups = loadRoomView(state);
  const categoryGroups = loadCategoryView(state);
  const allRows = getRequirementWorkspaceRows(state);
  const rows = getRequirementWorkspaceRows(state, { areaId: view === "room" ? selectedAreaId : undefined, category: view === "category" ? selectedCategory : undefined, search });
  const selectedArea = state.templateStage.areaRegister.areas.find((area) => area.id === selectedAreaId);
  const selectedRows = allRows.filter((row) => row.area.id === selectedAreaId);
  const selectedComplete = selectedRows.filter((row) => row.selection?.selectionStatus === "complete").length;
  const validation = validateSelectionWorkspace(state, false);

  if (state.requirements.length === 0) {
    const hasAreas = state.templateStage.areaRegister.areas.length > 0;
    return (
      <main className="selectionWorkspacePage">
        <InclusionsSelectionsProjectBanner currentStage="workspace" context={state.context} />
        <InclusionsSelectionsStageNav currentStage="workspace" context={state.context} />
        <section className="generateRequirementsState">
          <span className="modalEyebrow">{hasAreas ? "Selections are being prepared" : "Create areas first"}</span>
          <h1>{hasAreas ? "Prepare Selection Items" : "Create Areas First"}</h1>
          <p>{hasAreas ? "Choose an area first, then the system will prepare the product choices for that room or exterior item." : "Create or load project areas before opening the selection workspace."}</p>
          <div>
            <button type="button" onClick={() => router.push(hrefForStage("areas", state.context))}>Back to Areas</button>
            {hasAreas ? <button type="button" onClick={() => router.push(hrefForStage("templates", state.context))}>Choose Area</button> : null}
            {hasAreas ? <button type="button" className="primaryButton" disabled={saving} onClick={handleGenerateRequirements}>{saving ? "Preparing" : "Prepare Selection Items"}</button> : null}
          </div>
        </section>
        <style jsx global>{workspaceStyles}</style>
      </main>
    );
  }

  return (
    <main className="selectionWorkspacePage">
      <InclusionsSelectionsProjectBanner currentStage="workspace" context={state.context} />
      <InclusionsSelectionsStageNav currentStage="workspace" context={state.context} />
      <section className="kitchenHero">
        <div>
          <span className="modalEyebrow">Stage 3 Selection Workspace</span>
          <h1>{selectedArea?.name ?? "Kitchen"}</h1>
          <p>Choose each item in the room. Click Oven, pick an oven, and the tile updates with product, supplier, allowance and variation.</p>
        </div>
        <div className="kitchenHeroStats">
          <strong>{selectedComplete}/{selectedRows.length}</strong>
          <span>completed</span>
        </div>
      </section>
      <div className="builderWorkspaceLayout">
        <section className="kitchenSelectionSurface">
          <div className="areaRibbon" aria-label="Areas">
            {state.templateStage.areaRegister.areas.map((area) => (
              <button key={area.id} type="button" className={selectedAreaId === area.id ? "selected" : ""} onClick={() => setSelectedAreaId(area.id)}>
                {area.name}
              </button>
            ))}
          </div>
          <div className="roomToolbar">
            <div>
              <h2>{selectedArea?.name ?? "Room"}</h2>
              <p>Choose the next product type.</p>
            </div>
            <div className="roomToolbarActions">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this room" />
              <button type="button" onClick={() => setSearch("")}>Clear</button>
            </div>
          </div>
          {rows.length === 0 ? <p className="emptyRoomState">No selection items match this room/search.</p> : null}
          <div className="selectionItemList">
            {rows.map((row) => {
              const productName = row.selection?.value.productName ?? row.selection?.value.customSelectionName;
              const meta = [row.selection?.value.brand, row.selection?.value.model, row.selection?.value.supplierName].filter(Boolean).join(" / ");
              const allowance = row.selection?.allowance?.amount ?? row.selection?.value.allowance?.amount;
              const selected = row.selection?.selectedPrice?.amount ?? row.selection?.value.clientPrice?.amount;
              const variation = row.selection?.variation?.amount ?? 0;
              return (
                <button type="button" key={row.requirement.id} className={productName ? "selectionItemRow selected" : "selectionItemRow"} onClick={() => openProductPicker(row.requirement.id)}>
                  <span className={`tileStatus status-${row.selection?.selectionStatus ?? "not_started"}`}>{row.selection?.selectionStatus === "complete" ? "Done" : "Select"}</span>
                  <span className="tileImage">{productName ? (row.selection?.value.brand ?? productName).slice(0, 2).toUpperCase() : row.requirement.title.slice(0, 2).toUpperCase()}</span>
                  <span className="selectionItemCopy">
                    <strong>{row.requirement.title}</strong>
                    <span className="tileProduct">{productName ?? "Choose product"}</span>
                    <span className="tileMeta">{meta || row.requirement.category}</span>
                  </span>
                  <span className="tilePrice">Allowance {allowance === undefined ? "not set" : `$${allowance.toFixed(0)}`}<br />Selected {selected === undefined ? "pending" : `$${selected.toFixed(0)}`}</span>
                  <span className={variation > 0 ? "tileVariation upgrade" : variation < 0 ? "tileVariation credit" : "tileVariation"}>{variation > 0 ? `+$${variation.toFixed(0)} upgrade` : variation < 0 ? `$${variation.toFixed(0)} credit` : "Included"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <details className="advancedSettings">
        <summary>Advanced Settings</summary>
        <div className="advancedWorkspaceGrid">
          {view === "room" ? (
            <RoomNavigationPanel groups={roomGroups} rows={allRows} selectedAreaId={selectedAreaId} search={search} onSearch={setSearch} onSelectArea={setSelectedAreaId} onSelectRequirement={openProductPicker} onEditAreas={() => router.push(hrefForStage("areas", state.context))} />
          ) : (
            <CategoryNavigationPanel categories={categoryGroups} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
          )}
          <aside className="workspaceSide compactSide">
          <WorkspaceViewSwitcher value={view} onChange={(nextView) => {
            setView(nextView);
            setState({ ...state, draftState: { ...state.draftState, selectedView: nextView, savedStatus: "unsaved" } });
          }} />
          <WorkspaceProgressSummary state={state} />
          <ApplyToDialog scope={applyScope} onScope={setApplyScope} onPreview={handleApplyPreview} />
          <ApplyToPreview preview={applyPreview} selectedTargets={selectedApplyTargets} onToggleTarget={(requirementId) => setSelectedApplyTargets((current) => current.includes(requirementId) ? current.filter((id) => id !== requirementId) : [...current, requirementId])} onConfirm={handleApplyConfirm} />
          <WorkspaceValidationSummary issues={issues.length ? issues : validation.issues} />
        </aside>
        </div>
      </details>
      <WorkspaceStageActions
        saving={saving}
        canContinue={validation.ok}
        onSave={handleSave}
        onBack={() => router.push(hrefForStage("templates", state.context))}
        onReviewIncomplete={() => setIssues(validateSelectionWorkspace(state, false).issues)}
        onContinue={handleContinue}
      />
      {pickerRequirementId ? (
        <ProductSelectionModal
          row={getRequirementWorkspaceRows(state).find((row) => row.requirement.id === pickerRequirementId)!}
          products={products}
          variants={variants}
          suppliers={suppliers}
          filters={pickerFilters}
          selectedProductId={pickerProductId}
          selectedVariantId={pickerVariantId}
          loading={pickerLoading}
          successMessage={pickerMessage}
          errorMessage={pickerError}
          onFilterChange={updatePickerFilters}
          onChooseProduct={choosePickerProduct}
          onChooseVariant={setPickerVariantId}
          onSelect={(productId, variantId) => selectProduct(pickerRequirementId, productId, variantId)}
          onApplyToOtherRooms={() => {
            setApplySourceRequirementId(pickerRequirementId);
            setPickerRequirementId("");
            handleApplyPreview(pickerRequirementId);
          }}
          onClose={() => setPickerRequirementId("")}
        />
      ) : null}
      <style jsx global>{workspaceStyles}</style>
    </main>
  );
}

const workspaceStyles = `
  .selectionWorkspacePage { min-height: 100vh; background: #f5f7fa; color: #172033; padding: 28px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .workspaceHeader, .workspaceSummary, .viewSwitcher, .workspaceLayout, .builderWorkspaceLayout, .kitchenHero, .stageActions, .persistenceNote, .requiredState, .generateRequirementsState { max-width: 1320px; margin: 0 auto 16px; }
  .workspaceHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
  h2, h3 { margin: 0; letter-spacing: 0; }
  p { line-height: 1.5; }
  .workspaceHeader p, .muted, .sourceLine { color: #5d687c; }
  .workspaceSummary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  .workspaceSummary div, .navPanel, .workspaceMain, .workspaceSide, .requirementCard, .issuePanel, .validNotice, .kitchenHero, .kitchenSelectionSurface, .generateRequirementsState { background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; box-shadow: 0 1px 2px rgba(20,31,51,.04); }
  .workspaceSummary div { padding: 12px; }
  .workspaceSummary span { display: block; color: #657186; font-size: 12px; margin-bottom: 4px; }
  .workspaceLayout { display: grid; grid-template-columns: 300px minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
  .builderWorkspaceLayout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: start; }
  .navPanel, .workspaceMain, .workspaceSide { padding: 16px; }
  .workspaceSide, .requirementWorkspace, .navPanel { display: grid; gap: 12px; }
  input, select, button { min-height: 36px; border-radius: 6px; border: 1px solid #cfd8e5; background: #fff; color: #172033; font: inherit; }
  input, select { padding: 7px 9px; min-width: 0; }
  button { padding: 7px 12px; font-weight: 650; cursor: pointer; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primaryButton { background: #1c4f91; border-color: #1c4f91; color: #fff; }
  .viewSwitcher { display: flex; gap: 8px; }
  .viewSwitcher .selected, .navItem.selected, .productResult.selected { background: #eaf2fc; border-color: #1c4f91; }
  .navItem, .productResult { display: grid; gap: 4px; width: 100%; margin: 8px 0; text-align: left; background: #f8fafc; }
  .productResult { grid-template-columns: 42px minmax(0, 1fr); align-items: center; }
  .productResult strong, .productResult span:not(.productThumb) { grid-column: 2; }
  .productThumb { grid-row: 1 / span 4; display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 8px; background: #e9f3ef; color: #1e5f46; font-size: 12px; font-weight: 800; letter-spacing: 0; }
  .navItem span, .productResult span { color: #657186; font-size: 12px; }
  .roomListPanel details { border-top: 1px solid #eef2f7; padding-top: 10px; }
  .roomListPanel summary { cursor: pointer; color: #526072; font-weight: 800; margin-bottom: 6px; }
  .roomRequirementTree { display: grid; gap: 3px; margin: -2px 0 10px 12px; padding-left: 10px; border-left: 2px solid #e3e9f2; }
  .roomRequirementLink { min-height: 30px; display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 6px; text-align: left; border: 0; background: transparent; padding: 4px 6px; font-size: 13px; }
  .roomRequirementLink span { display: inline-grid; place-items: center; min-width: 34px; height: 18px; border-radius: 999px; background: #eef3f8; color: #526072; font-size: 10px; font-weight: 800; }
  .roomRequirementLink.status-complete span { background: #dff7ec; color: #126344; }
  .roomRequirementLink.status-needs_attention span, .roomRequirementLink.status-in_progress span { background: #fff4d6; color: #986200; }
  .kitchenHero { padding: 22px; display: flex; justify-content: space-between; gap: 20px; align-items: center; background: linear-gradient(90deg, #ffffff 0%, #f4f9f7 100%); }
  .kitchenHero h1 { font-size: 42px; }
  .kitchenHero p { margin: 0; max-width: 720px; color: #526072; }
  .kitchenHeroStats { min-width: 132px; border: 1px solid #dbe7e1; border-radius: 8px; padding: 14px; text-align: center; background: #fff; }
  .kitchenHeroStats strong { display: block; font-size: 32px; }
  .kitchenHeroStats span { color: #526072; font-weight: 750; }
  .kitchenSelectionSurface { padding: 18px; min-width: 0; }
  .areaRibbon { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .areaRibbon button { border-color: #d8e2ee; background: #fff; color: #17406f; }
  .areaRibbon button.selected { border-color: #1c4f91; background: #1c4f91; color: #fff; }
  .roomToolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 16px; }
  .roomToolbar p { margin: 4px 0 0; color: #657186; }
  .roomToolbarActions { display: flex; gap: 8px; align-items: center; }
  .roomToolbarActions input { width: 220px; }
  .selectionItemList { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .selectionItemRow { position: relative; width: 100%; min-height: 230px; text-align: left; padding: 14px; display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; background: #fff; border-color: #dce4ef; overflow: hidden; }
  .selectionItemRow:hover, .selectionItemRow:focus-visible { border-color: #1c4f91; box-shadow: 0 8px 20px rgba(21, 48, 84, .09); outline: none; }
  .selectionItemRow.selected { background: #fbfefd; border-color: #b8d9ca; }
  .tileStatus { justify-self: start; min-height: 24px; border-radius: 999px; padding: 3px 9px; background: #eef3f8; color: #526072; font-size: 12px; font-weight: 800; }
  .tileStatus.status-complete { background: #dff7ec; color: #126344; }
  .tileImage { display: grid; place-items: center; width: 100%; min-height: 104px; border-radius: 8px; background: #eaf2fc; color: #1c4f91; font-size: 28px; font-weight: 900; }
  .selectionItemCopy { display: grid; gap: 3px; min-width: 0; }
  .selectionItemCopy strong { font-size: 16px; overflow-wrap: anywhere; }
  .tileProduct { font-weight: 850; color: #172033; }
  .tileMeta, .tilePrice { color: #657186; font-size: 13px; }
  .tileVariation { justify-self: start; border-radius: 999px; padding: 5px 9px; background: #edf8f1; color: #126344; font-size: 13px; font-weight: 850; white-space: nowrap; }
  .tileVariation.upgrade { background: #fff3df; color: #925400; }
  .tileVariation.credit { background: #eaf2fc; color: #1c4f91; }
  .emptyRoomState, .generateRequirementsState p { color: #526072; }
  .generateRequirementsState { padding: 28px; display: grid; gap: 14px; }
  .generateRequirementsState div { display: flex; gap: 10px; flex-wrap: wrap; }
  .compactSide { display: grid; gap: 14px; }
  .advancedSettings { max-width: 1320px; margin: 0 auto 16px; background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 12px; }
  .advancedSettings summary { cursor: pointer; font-weight: 850; color: #17406f; }
  .advancedSettings[open] summary { margin-bottom: 14px; }
  .advancedWorkspaceGrid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px; align-items: start; }
  .workspaceFilters, .requirementHeader, .rowActions, .splitFields, .pricingSummary, .previewColumns { display: flex; gap: 8px; align-items: center; }
  .workspaceFilters { margin-bottom: 12px; }
  .workspaceFilters input { flex: 1; }
  .requirementCard { padding: 16px; display: grid; gap: 12px; }
  .requirementHeader { justify-content: space-between; align-items: flex-start; }
  .requirementHeader p { margin: 4px 0 0; color: #657186; }
  .statusPill { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 8px; border-radius: 999px; background: #eef3f8; font-size: 12px; font-weight: 700; text-transform: capitalize; }
  .status-complete { background: #e7f7f1; color: #126344; }
  .status-needs_attention { background: #fff1f1; color: #9b2c25; }
  .standardPanel, .productBrowser, .customSelectionEditor, .applyToDialog, .applyPreview, .pricingSummary, .locationList, .notesPanel { border: 1px solid #e7ecf3; border-radius: 8px; padding: 12px; display: grid; gap: 8px; }
  .selectedProductCard { border: 1px solid #dce7f3; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; gap: 12px; align-items: center; background: #f8fbff; }
  .selectedProductCard.empty { background: #fff; border-style: dashed; }
  .selectedProductImage, .modalProductImage { display: grid; place-items: center; border-radius: 8px; background: #e9f3ef; color: #1e5f46; font-weight: 800; min-height: 52px; }
  .selectedProductCard p { margin: 4px 0 0; color: #657186; }
  .statusDot { display: inline-grid; place-items: center; width: 22px; height: 22px; margin-right: 8px; border-radius: 999px; background: #eef3f8; color: #526072; font-size: 13px; }
  .statusDot.status-complete { background: #dff7ec; color: #126344; }
  .statusDot.status-needs_attention { background: #fff4d6; color: #986200; }
  .statusDot.status-in_progress { background: #fff4d6; color: #986200; }
  .productModalBackdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, .62); padding: 28px; display: grid; place-items: center; }
  .productModal { width: min(1180px, 100%); max-height: min(900px, calc(100vh - 56px)); overflow: auto; background: #fff; border-radius: 8px; box-shadow: 0 28px 80px rgba(10, 24, 48, .28); border: 1px solid #d8e1ee; }
  .productModalHeader { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 18px 20px; border-bottom: 1px solid #e3e9f2; background: #fff; }
  .modalEyebrow { display: block; color: #526072; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
  .productModalHeader h2 { margin: 4px 0; font-size: 26px; }
  .simplePickerControls { display: grid; gap: 12px; padding: 16px 18px 0; }
  .simplePickerControls input { width: 100%; min-height: 42px; }
  .brandPills, .quickFilters { display: flex; gap: 8px; flex-wrap: wrap; }
  .brandPills button, .quickFilters button { border-color: #d8e2ee; background: #fff; color: #17406f; }
  .brandPills button.active, .quickFilters button.active { border-color: #1c4f91; background: #1c4f91; color: #fff; }
  .productModalBody { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 18px; align-items: start; }
  .productFilters { display: grid; gap: 10px; position: sticky; top: 92px; }
  .productFilters label, .variantPicker { display: grid; gap: 5px; color: #526072; font-size: 13px; font-weight: 700; }
  .productGridPanel { min-width: 0; }
  .modalProductGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .modalProductCard { border: 1px solid #dfe6ef; border-radius: 8px; overflow: hidden; display: grid; background: #fff; }
  .modalProductCard.selected { border-color: #1c4f91; box-shadow: 0 0 0 2px rgba(28, 79, 145, .12); }
  .modalProductImage { min-height: 180px; aspect-ratio: 4 / 3; background: #eaf2fc; color: #1c4f91; overflow: hidden; }
  button.modalProductImage { border: 0; padding: 0; width: 100%; cursor: zoom-in; }
  .modalProductImage img, .detailImage img, .detailGallery img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .modalProductContent { display: grid; gap: 10px; padding: 14px; }
  .modalProductTop { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .modalProductTop h3 { font-size: 18px; margin: 2px 0; }
  .modalProductTop p, .modalProductContent p { margin: 0; color: #657186; font-size: 13px; }
  .productFacts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .productFacts div { border: 1px solid #edf1f6; border-radius: 6px; padding: 7px; }
  .productFacts dt { color: #657186; font-size: 11px; font-weight: 800; text-transform: uppercase; }
  .productFacts dd { margin: 2px 0 0; font-weight: 750; }
  .modalProductActions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .modalProductActions a { color: #1c4f91; font-weight: 750; text-decoration: none; }
  .disabledLink { color: #657186; font-weight: 750; }
  .modalProductGrid.hidden { display: none; }
  .productDetailView { display: grid; gap: 14px; }
  .backButton { justify-self: start; }
  .detailLayout { display: grid; grid-template-columns: minmax(220px, 360px) minmax(0, 1fr); gap: 18px; align-items: start; }
  .detailMedia { display: grid; gap: 10px; }
  .detailImage { min-height: 320px; border-radius: 8px; background: #eaf2fc; display: grid; place-items: center; color: #1c4f91; font-size: 42px; font-weight: 900; overflow: hidden; }
  .detailGallery { display: flex; gap: 8px; }
  .detailGallery span { width: 48px; height: 48px; border-radius: 6px; background: #eef3f8; display: grid; place-items: center; color: #526072; font-weight: 800; overflow: hidden; }
  .detailCopy { display: grid; gap: 12px; }
  .detailCopy h3 { font-size: 28px; }
  .detailFacts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .successNotice, .errorNotice { margin: 14px 18px 0; border-radius: 8px; padding: 10px 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
  .successNotice { background: #e9f8ef; color: #1d6d47; border: 1px solid #b7e2c6; }
  .errorNotice { background: #fff1f1; color: #9b2c25; border: 1px solid #ffd1d1; }
  .productResults { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .splitFields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .pricingSummary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rowActions { flex-wrap: wrap; }
  .previewColumns { align-items: flex-start; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .targetRow { display: flex; gap: 8px; margin: 6px 0; }
  .issuePanel, .validNotice { padding: 12px 14px; }
  .issuePanel { border-color: #ffd1d1; color: #9b2c25; }
  .validNotice { border-color: #b7e2c6; color: #1d6d47; background: #e9f8ef; }
  .stageActions { display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: 0; background: rgba(245,247,250,.95); padding: 14px 0; flex-wrap: wrap; }
  .persistenceNote { color: #657186; font-size: 13px; }
  @media (max-width: 1180px) { .selectionItemRow .tilePrice { display: none; } }
  @media (max-width: 1100px) { .workspaceLayout, .builderWorkspaceLayout, .workspaceSummary, .advancedWorkspaceGrid { grid-template-columns: 1fr; } .workspaceSide { order: 2; } }
  @media (max-width: 760px) { .selectionWorkspacePage { padding: 18px; } h1, .kitchenHero h1 { font-size: 28px; } .workspaceHeader, .workspaceFilters, .requirementHeader, .rowActions, .stageActions, .pricingSummary, .previewColumns, .selectedProductCard, .productModalHeader, .kitchenHero, .roomToolbar, .roomToolbarActions { align-items: stretch; flex-direction: column; grid-template-columns: 1fr; } .productResults, .splitFields, .productModalBody, .modalProductGrid, .modalProductCard, .productFacts, .selectionItemRow, .detailLayout, .detailFacts { grid-template-columns: 1fr; } .selectionItemRow { justify-items: start; } .tileVariation { justify-self: start; } .productResult { grid-template-columns: 38px minmax(0, 1fr); } .productModalBackdrop { padding: 0; align-items: stretch; } .productModal { width: 100%; min-height: 100vh; max-height: 100vh; border-radius: 0; } .productFilters { position: static; } .requirementCard { padding: 12px; } .roomToolbarActions input { width: 100%; } }
`;
