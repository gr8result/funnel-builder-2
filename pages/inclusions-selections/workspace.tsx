import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ApplyToDialog } from "../../src/modules/inclusions-selections/components/ApplyToDialog";
import { ApplyToPreview } from "../../src/modules/inclusions-selections/components/ApplyToPreview";
import { CategoryNavigationPanel } from "../../src/modules/inclusions-selections/components/CategoryNavigationPanel";
import type { CustomSelectionDraft } from "../../src/modules/inclusions-selections/components/CustomSelectionEditor";
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
  selectProductVariant,
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

  async function searchProducts(requirementId: string, value: string) {
    if (!state) return;
    const requirement = state.requirements.find((item) => item.id === requirementId);
    if (!requirement) return;
    setProducts(await productAdapter.searchCompatibleProducts(requirement, { search: value }));
  }

  async function selectProduct(requirementId: string, productId: string) {
    if (!state) return;
    const productVariants = await productAdapter.listVariants(productId);
    setVariants(productVariants);
    applyResult(await createProjectSelection(state, requirementId, productId, undefined, productAdapter));
  }

  async function selectVariant(requirementId: string, variantId: string) {
    if (!state) return;
    applyResult(await selectProductVariant(state, requirementId, variantId, productAdapter));
  }

  async function handleSave() {
    if (!state) return;
    setSaving(true);
    const saved = await saveWorkspaceDraft(state);
    setSaving(false);
    applyResult(saved);
  }

  async function handleApplyPreview() {
    if (!state || !applySourceRequirementId) return;
    const preview = await previewApplyTo(state, applySourceRequirementId, applyScope, selectedAreaId ? [selectedAreaId] : [], productAdapter);
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
          <RoomNavigationPanel groups={roomGroups} selectedAreaId={selectedAreaId} search={search} onSearch={setSearch} onSelectArea={setSelectedAreaId} onEditAreas={() => router.push(hrefForStage("areas", state.context))} />
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
            products={products}
            variants={variants}
            notes={state.notes}
            customDraft={customDraft}
            onSearchProducts={searchProducts}
            onSelectProduct={selectProduct}
            onSelectVariant={selectVariant}
            onCustomDraft={setCustomDraft}
            onSaveCustom={(requirementId) => applyResult(createCustomSelection(state, requirementId, { ...customDraft, category: state.requirements.find((requirement) => requirement.id === requirementId)?.category ?? "allowance" }))}
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
  @media (max-width: 760px) { .selectionWorkspacePage { padding: 18px; } h1 { font-size: 28px; } .workspaceHeader, .workspaceFilters, .requirementHeader, .rowActions, .stageActions, .pricingSummary, .previewColumns { align-items: stretch; flex-direction: column; grid-template-columns: 1fr; } .productResults, .splitFields { grid-template-columns: 1fr; } .productResult { grid-template-columns: 38px minmax(0, 1fr); } .requirementCard { padding: 12px; } }
`;
