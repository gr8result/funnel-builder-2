import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ApplyToDialog } from "../../src/modules/inclusions-selections/components/ApplyToDialog";
import { ApplyToPreview } from "../../src/modules/inclusions-selections/components/ApplyToPreview";
import { CategoryNavigationPanel } from "../../src/modules/inclusions-selections/components/CategoryNavigationPanel";
import type { CustomSelectionDraft } from "../../src/modules/inclusions-selections/components/CustomSelectionEditor";
import { ProductSelectionModal } from "../../src/modules/inclusions-selections/components/ProductSelectionModal";
import { RequirementWorkspace } from "../../src/modules/inclusions-selections/components/RequirementWorkspace";
import { RoomNavigationPanel } from "../../src/modules/inclusions-selections/components/RoomNavigationPanel";
import { SelectionWorkspaceHeader } from "../../src/modules/inclusions-selections/components/SelectionWorkspaceHeader";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { WorkspaceProgressSummary } from "../../src/modules/inclusions-selections/components/WorkspaceProgressSummary";
import { WorkspaceStageActions } from "../../src/modules/inclusions-selections/components/WorkspaceStageActions";
import { WorkspaceValidationSummary } from "../../src/modules/inclusions-selections/components/WorkspaceValidationSummary";
import { WorkspaceViewSwitcher } from "../../src/modules/inclusions-selections/components/WorkspaceViewSwitcher";
import { InMemoryProductSelectionCatalogueAdapter } from "../../src/modules/inclusions-selections/products/inMemoryProductSelectionCatalogueAdapter";
import type { ProductReference, ProductVariantReference } from "../../src/modules/inclusions-selections/products/productReferenceTypes";
import type { ProductSearchFilters, SupplierReference } from "../../src/modules/inclusions-selections/products/productSelectionCatalogueAdapter";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import {
  applySelectionToTargets,
  clearProjectSelection,
  createCustomSelection,
  createProjectSelection,
  getRequirementWorkspaceRows,
  loadCategoryView,
  loadRoomView,
  loadSelectionWorkspace,
  previewApplyTo,
  resetSelectionToInherited,
  saveWorkspaceDraft,
  updateRequirementStatus,
  validateSelectionWorkspace,
} from "../../src/modules/inclusions-selections/services/selectionWorkspaceService";
import type { ApplyToPreview as ApplyToPreviewModel, ApplyToScope, RequirementSelectionStatus, SelectionWorkspaceState, WorkspaceView } from "../../src/modules/inclusions-selections/services/selectionWorkspaceService";
import type { DomainIssue, DomainResult } from "../../src/modules/inclusions-selections/validation/errors";

const productAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");

const defaultCustomDraft: CustomSelectionDraft = {
  name: "",
  description: "",
  quantity: 1,
  unit: "each",
  clientPrice: 0,
  allowance: 0,
};

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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState<CustomSelectionDraft>(defaultCustomDraft);
  const [saving, setSaving] = useState(false);
  const [applyScope, setApplyScope] = useState<ApplyToScope>("this_requirement");
  const [applySourceRequirementId, setApplySourceRequirementId] = useState("");
  const [applyPreview, setApplyPreview] = useState<ApplyToPreviewModel | null>(null);
  const [selectedApplyTargets, setSelectedApplyTargets] = useState<string[]>([]);

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);

  useEffect(() => {
    if (!router.isReady || !context.organisationId || !context.projectId) return;
    let cancelled = false;
    loadSelectionWorkspace(context as ProjectSelectionContext).then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setView(loaded.draftState.selectedView);
      setSelectedAreaId(loaded.draftState.selectedAreaId ?? loaded.templateStage.areaRegister.areas[0]?.id ?? "");
      setSelectedCategory(loaded.requirements[0]?.category ?? "");
      setIssues(validateSelectionWorkspace(loaded, true).issues);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, context.organisationId, context.projectId]);

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
    setCompareIds([]);
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
    if (product?.defaultVariantId && !variantId && productVariants.length > 0) {
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
        <InclusionsSelectionsStageNav currentStage="workspace" context={context} />
        <section className="requiredState"><h1>Inclusions and Selections Workspace</h1><p>{PROJECT_REQUIRED_MESSAGE}</p></section>
        <style jsx global>{workspaceStyles}</style>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="selectionWorkspacePage">
        <InclusionsSelectionsStageNav currentStage="workspace" context={context} />
        <section className="requiredState"><h1>Inclusions and Selections Workspace</h1><p>Loading selection workspace.</p></section>
        <style jsx global>{workspaceStyles}</style>
      </main>
    );
  }

  const roomGroups = loadRoomView(state);
  const categoryGroups = loadCategoryView(state);
  const rows = getRequirementWorkspaceRows(state, { areaId: view === "room" ? selectedAreaId : undefined, category: view === "category" ? selectedCategory : undefined, search });
  const validation = validateSelectionWorkspace(state, false);

  return (
    <main className="selectionWorkspacePage">
      <InclusionsSelectionsStageNav currentStage="workspace" context={state.context} />
      <SelectionWorkspaceHeader onBackToTemplates={() => router.push(hrefForStage("templates", state.context))} />
      <WorkspaceProgressSummary state={state} />
      <WorkspaceViewSwitcher value={view} onChange={(nextView) => {
        setView(nextView);
        setState({ ...state, draftState: { ...state.draftState, selectedView: nextView, savedStatus: "unsaved" } });
      }} />
      <div className="workspaceLayout">
        {view === "room" ? (
          <RoomNavigationPanel groups={roomGroups} rows={getRequirementWorkspaceRows(state)} selectedAreaId={selectedAreaId} search={search} onSearch={setSearch} onSelectArea={setSelectedAreaId} onSelectRequirement={openProductPicker} onEditAreas={() => router.push(hrefForStage("areas", state.context))} />
        ) : (
          <CategoryNavigationPanel categories={categoryGroups} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        )}
        <section className="workspaceMain">
          <div className="workspaceFilters">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room, requirement, product, brand, supplier or colour" />
            <button type="button" onClick={() => setSearch("")}>Reset Filters</button>
          </div>
          <RequirementWorkspace
            rows={rows}
            notes={state.notes}
            customDraft={customDraft}
            onCustomDraft={setCustomDraft}
            onSaveCustom={(requirementId) => applyResult(createCustomSelection(state, requirementId, { ...customDraft, category: state.requirements.find((requirement) => requirement.id === requirementId)?.category ?? "allowance" }))}
            onOpenProductPicker={openProductPicker}
            onStatus={(requirementId: string, status: RequirementSelectionStatus, reason?: string) => applyResult(updateRequirementStatus(state, requirementId, status, reason))}
            onClear={(requirementId) => applyResult(clearProjectSelection(state, requirementId))}
            onReset={(requirementId) => applyResult(resetSelectionToInherited(state, requirementId))}
            onApplyTo={(requirementId) => setApplySourceRequirementId(requirementId)}
          />
        </section>
        <aside className="workspaceSide">
          <ApplyToDialog scope={applyScope} onScope={setApplyScope} onPreview={handleApplyPreview} />
          <ApplyToPreview preview={applyPreview} selectedTargets={selectedApplyTargets} onToggleTarget={(requirementId) => setSelectedApplyTargets((current) => current.includes(requirementId) ? current.filter((id) => id !== requirementId) : [...current, requirementId])} onConfirm={handleApplyConfirm} />
          <WorkspaceValidationSummary issues={issues.length ? issues : validation.issues} />
        </aside>
      </div>
      <WorkspaceStageActions
        saving={saving}
        canContinue={validation.ok}
        onSave={handleSave}
        onBack={() => router.push(hrefForStage("templates", state.context))}
        onReviewIncomplete={() => setIssues(validateSelectionWorkspace(state, false).issues)}
        onContinue={handleContinue}
      />
      <p className="persistenceNote">Selections, room locations, notes, attachments and workspace draft state use browser-scoped repositories until approved database adapters are added.</p>
      {pickerRequirementId ? (
        <ProductSelectionModal
          row={getRequirementWorkspaceRows(state).find((row) => row.requirement.id === pickerRequirementId)!}
          products={products}
          variants={variants}
          suppliers={suppliers}
          filters={pickerFilters}
          selectedProductId={pickerProductId}
          selectedVariantId={pickerVariantId}
          compareIds={compareIds}
          loading={pickerLoading}
          successMessage={pickerMessage}
          errorMessage={pickerError}
          onFilterChange={updatePickerFilters}
          onChooseProduct={choosePickerProduct}
          onChooseVariant={setPickerVariantId}
          onSelect={(productId, variantId) => selectProduct(pickerRequirementId, productId, variantId)}
          onToggleCompare={(productId) => setCompareIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId])}
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
  .workspaceHeader, .workspaceSummary, .viewSwitcher, .workspaceLayout, .stageActions, .persistenceNote, .requiredState { max-width: 1320px; margin: 0 auto 16px; }
  .workspaceHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
  h2, h3 { margin: 0; letter-spacing: 0; }
  p { line-height: 1.5; }
  .workspaceHeader p, .muted, .sourceLine { color: #5d687c; }
  .workspaceSummary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  .workspaceSummary div, .navPanel, .workspaceMain, .workspaceSide, .requirementCard, .issuePanel, .validNotice { background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; box-shadow: 0 1px 2px rgba(20,31,51,.04); }
  .workspaceSummary div { padding: 12px; }
  .workspaceSummary span { display: block; color: #657186; font-size: 12px; margin-bottom: 4px; }
  .workspaceLayout { display: grid; grid-template-columns: 300px minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
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
  .roomRequirementTree { display: grid; gap: 4px; margin: -4px 0 8px 14px; padding-left: 10px; border-left: 2px solid #e3e9f2; }
  .roomRequirementLink { min-height: 30px; display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 6px; text-align: left; border: 0; background: transparent; padding: 4px 6px; font-size: 13px; }
  .roomRequirementLink span { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: #eef3f8; color: #526072; font-size: 11px; }
  .roomRequirementLink.status-complete span { background: #dff7ec; color: #126344; }
  .roomRequirementLink.status-needs_attention span, .roomRequirementLink.status-in_progress span { background: #fff4d6; color: #986200; }
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
  .productModalBody { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; padding: 18px; align-items: start; }
  .productFilters { display: grid; gap: 10px; position: sticky; top: 92px; }
  .productFilters label, .variantPicker { display: grid; gap: 5px; color: #526072; font-size: 13px; font-weight: 700; }
  .productGridPanel { min-width: 0; }
  .modalProductGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .modalProductCard { border: 1px solid #dfe6ef; border-radius: 8px; padding: 12px; display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; background: #fff; }
  .modalProductCard.selected { border-color: #1c4f91; box-shadow: 0 0 0 2px rgba(28, 79, 145, .12); }
  .modalProductImage { min-height: 92px; background: #eaf2fc; color: #1c4f91; }
  .modalProductContent { display: grid; gap: 9px; }
  .modalProductTop { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .modalProductTop h3 { font-size: 18px; margin: 2px 0; }
  .modalProductTop p, .modalProductContent p { margin: 0; color: #657186; font-size: 13px; }
  .tierBadge { display: inline-flex; min-height: 24px; align-items: center; border-radius: 999px; padding: 3px 8px; background: #eef7f1; color: #1d6d47; font-size: 12px; font-weight: 800; text-transform: capitalize; }
  .productFacts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .productFacts div { border: 1px solid #edf1f6; border-radius: 6px; padding: 7px; }
  .productFacts dt { color: #657186; font-size: 11px; font-weight: 800; text-transform: uppercase; }
  .productFacts dd { margin: 2px 0 0; font-weight: 750; }
  .modalProductActions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .modalProductActions a { color: #1c4f91; font-weight: 750; text-decoration: none; }
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
  @media (max-width: 1100px) { .workspaceLayout, .workspaceSummary { grid-template-columns: 1fr; } .workspaceSide { order: -1; } }
  @media (max-width: 760px) { .selectionWorkspacePage { padding: 18px; } h1 { font-size: 28px; } .workspaceHeader, .workspaceFilters, .requirementHeader, .rowActions, .stageActions, .pricingSummary, .previewColumns, .selectedProductCard, .productModalHeader { align-items: stretch; flex-direction: column; grid-template-columns: 1fr; } .productResults, .splitFields, .productModalBody, .modalProductGrid, .modalProductCard, .productFacts { grid-template-columns: 1fr; } .productResult { grid-template-columns: 38px minmax(0, 1fr); } .productModalBackdrop { padding: 0; align-items: stretch; } .productModal { width: 100%; min-height: 100vh; max-height: 100vh; border-radius: 0; } .productFilters { position: static; } .requirementCard { padding: 12px; } }
`;
