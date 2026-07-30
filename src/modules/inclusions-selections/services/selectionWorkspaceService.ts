import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import { calculateSelectionPricing as calculatePricing } from "../pricing/pricingService";
import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import type { ProductSelectionCatalogueAdapter } from "../products/productSelectionCatalogueAdapter";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { evaluateProductCompatibility } from "../products/requirementProductMatching";
import type { ProjectRequirement, RequirementCategory } from "../requirements/requirementTypes";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import type { RequirementAttachmentReference, RequirementNote, SelectionWorkspaceRepository, WorkspaceDraftState } from "../repositories/selectionWorkspaceRepository";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { templateStageRepository } from "../repositories/templateStageRepository";
import type { SelectionLocation } from "../selections/selectionLocationTypes";
import type { ProjectSelection, SelectionValue } from "../selections/selectionTypes";
import { makeScopedId } from "../shared/ids";
import { money } from "../shared/money";
import { loadTemplateStage, resolveEffectiveTemplateAssignment } from "./templateStageService";
import type { TemplateStageState } from "./templateStageService";
import type { DomainIssue, DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type WorkspaceView = "room" | "category";
export type RequirementSelectionStatus = "not_started" | "in_progress" | "complete" | "needs_attention" | "not_applicable";
export type VariationState = "included" | "no_change" | "upgrade" | "credit" | "price_missing";
export type ApplyToScope = "this_requirement" | "this_room" | "selected_rooms" | "all_rooms_of_area_type" | "all_rooms_in_area_group" | "every_compatible_requirement";

export type RequirementWorkspaceRow = {
  requirement: ProjectRequirement;
  area: ProjectArea;
  selection?: ProjectSelection;
  locations: SelectionLocation[];
  inheritedTierId?: string;
  inheritanceSource: string;
  standardInclusion?: ProductReference;
  variationState: VariationState;
};

export type WorkspaceProgress = {
  totalAreas: number;
  totalRequirements: number;
  completedRequirements: number;
  incompleteRequirements: number;
  optionalRequirements: number;
  notApplicableRequirements: number;
  needsAttentionRequirements: number;
  netVariation: number;
  currency: string;
};

export type RoomViewGroup = {
  groupId: string;
  groupName: string;
  rooms: Array<{ area: ProjectArea; completionPercent: number; status: string; outstandingCount: number; variationTotal: number }>;
};

export type CategoryViewGroup = {
  category: RequirementCategory | string;
  label: string;
  total: number;
  completed: number;
  incomplete: number;
  needsAttention: number;
  variationTotal: number;
  rows: RequirementWorkspaceRow[];
};

export type SelectionWorkspaceState = {
  context: ProjectSelectionContext;
  templateStage: TemplateStageState;
  requirements: ProjectRequirement[];
  selections: ProjectSelection[];
  locations: SelectionLocation[];
  notes: RequirementNote[];
  attachments: RequirementAttachmentReference[];
  draftState: WorkspaceDraftState;
};

export type ApplyToPreviewTarget = {
  requirementId: string;
  areaId: string;
  projectAreaName: string;
  requirementName: string;
  quantity: number;
  currentSelection?: string;
  proposedSelection: string;
  currentVariation: number;
  proposedVariation: number;
  reason?: string;
};

export type ApplyToPreview = {
  sourceRequirementId: string;
  scope: ApplyToScope;
  compatibleTargets: ApplyToPreviewTarget[];
  incompatibleTargets: ApplyToPreviewTarget[];
  skippedTargets: ApplyToPreviewTarget[];
};

function fail<T>(code: string, message: string, path?: string): DomainResult<T> {
  return { ok: false, issues: [issue(code, message, path)] };
}

function selectionId(context: ProjectSelectionContext, requirementId: string): string {
  return makeScopedId("selection", [context.organisationId, context.projectId, requirementId]);
}

function locationId(context: ProjectSelectionContext, selectionIdValue: string, areaId: string, requirementId: string): string {
  return makeScopedId("selection_location", [context.organisationId, context.projectId, selectionIdValue, areaId, requirementId]);
}

function defaultDraftState(context: ProjectSelectionContext): WorkspaceDraftState {
  return { organisationId: context.organisationId, projectId: context.projectId, selectedView: "room", savedStatus: "saved", updatedAt: new Date().toISOString() };
}

function requirementAllowance(requirement: ProjectRequirement): number {
  if (requirement.category === "appliance") return 900;
  if (requirement.category === "plumbing") return 450;
  if (requirement.category === "hardware") return 120;
  if (requirement.category === "flooring") return 450;
  return 250;
}

function selectedAmount(selection?: ProjectSelection): number | null {
  return selection?.selectedPrice?.amount ?? selection?.value.clientPrice?.amount ?? selection?.value.allowance?.amount ?? null;
}

function variationState(selection?: ProjectSelection): VariationState {
  if (!selection) return "price_missing";
  if (!selection.selectedPrice) return "price_missing";
  const amount = selection.variation?.amount ?? 0;
  if (amount > 0) return "upgrade";
  if (amount < 0) return "credit";
  return "no_change";
}

function requirementStatus(requirement: ProjectRequirement, selection?: ProjectSelection): RequirementSelectionStatus {
  if (selection?.selectionStatus) return selection.selectionStatus;
  if (selection?.status === "draft" && selection.value.productReferenceId) return "complete";
  if (requirement.status === "optional") return "not_started";
  return "not_started";
}

function isProductCompatible(requirement: ProjectRequirement, product: ProductReference | null, variant?: ProductVariantReference | null): string | null {
  if (!product) return "Product was not found.";
  if (product.organisationId !== "org_dev" && product.organisationId !== requirement.organisationId) return "Product belongs to another organisation.";
  if (variant && !variant.active) return "Selected variant is inactive.";
  if (product.requiresVariant && !variant) return "Choose the required product variant.";
  const result = evaluateProductCompatibility(requirement, product, variant ? [variant] : []);
  if (!result.compatible) return result.reasons[0] ?? "Product is not compatible with this selection item.";
  return null;
}

function priceSelection(requirement: ProjectRequirement, value: SelectionValue, quantity: number, unitCostAmount?: number): Pick<ProjectSelection, "allowance" | "selectedPrice" | "variation" | "gst"> {
  const allowance = value.allowance ?? money(requirementAllowance(requirement));
  if (unitCostAmount === undefined && value.clientPrice === undefined) return { allowance };
  const unitCost = value.clientPrice ?? money(unitCostAmount ?? 0, allowance.currency);
  const pricing = calculatePricing({ quantity, unitCost, allowance: money(allowance.amount * quantity, allowance.currency), gstRate: 0.1, markupRate: 0 });
  return { allowance, selectedPrice: pricing.sell, variation: pricing.variation, gst: pricing.tax };
}

function rowForRequirement(state: SelectionWorkspaceState, requirement: ProjectRequirement, adapterProduct?: ProductReference): RequirementWorkspaceRow {
  const area = state.templateStage.areaRegister.areas.find((item) => item.id === requirement.areaId) ?? state.templateStage.areaRegister.areas[0];
  const selection = state.selections.find((item) => item.requirementId === requirement.id);
  const effective = area ? resolveEffectiveTemplateAssignment(state.templateStage, area) : null;
  return {
    requirement,
    area,
    selection,
    locations: state.locations.filter((location) => location.requirementId === requirement.id),
    inheritedTierId: effective?.tierId,
    inheritanceSource: selection?.value.customSelectionId ? "Manual Custom Selection" : effective?.sourceLabel ?? "Inherited from Project Default",
    standardInclusion: adapterProduct,
    variationState: variationState(selection),
  };
}

export async function loadSelectionWorkspace(
  context: ProjectSelectionContext,
  repository: SelectionWorkspaceRepository = selectionWorkspaceRepository,
): Promise<SelectionWorkspaceState> {
  const templateStage = await loadTemplateStage(context, templateStageRepository);
  const [selections, locations, notes, attachments, draft] = await Promise.all([
    repository.listSelections(context),
    repository.listLocations(context),
    repository.listRequirementNotes(context),
    repository.listAttachments(context),
    repository.loadDraftState(context),
  ]);
  return {
    context,
    templateStage,
    requirements: templateStage.requirements,
    selections,
    locations,
    notes,
    attachments,
    draftState: draft ?? defaultDraftState(context),
  };
}

export function getSelectionProgress(state: SelectionWorkspaceState): WorkspaceProgress {
  const statuses = state.requirements.map((requirement) => requirementStatus(requirement, state.selections.find((selection) => selection.requirementId === requirement.id)));
  return {
    totalAreas: state.templateStage.areaRegister.areas.length,
    totalRequirements: state.requirements.length,
    completedRequirements: statuses.filter((status) => status === "complete").length,
    incompleteRequirements: statuses.filter((status) => status === "not_started" || status === "in_progress").length,
    optionalRequirements: state.requirements.filter((requirement) => !requirement.required).length,
    notApplicableRequirements: statuses.filter((status) => status === "not_applicable").length,
    needsAttentionRequirements: statuses.filter((status) => status === "needs_attention").length,
    netVariation: state.selections.reduce((sum, selection) => sum + (selection.variation?.amount ?? 0), 0),
    currency: state.selections.find((selection) => selection.variation)?.variation?.currency ?? "AUD",
  };
}

export function loadRoomView(state: SelectionWorkspaceState): RoomViewGroup[] {
  const rows = state.requirements.map((requirement) => rowForRequirement(state, requirement));
  return STANDARD_AREA_GROUPS.map((group) => {
    const areas = state.templateStage.areaRegister.areas.filter((area) => area.groupId === group.id);
    return {
      groupId: group.id,
      groupName: group.name,
      rooms: areas.map((area) => {
        const areaRows = rows.filter((row) => row.area.id === area.id);
        const completed = areaRows.filter((row) => requirementStatus(row.requirement, row.selection) === "complete").length;
        const outstanding = areaRows.filter((row) => ["not_started", "in_progress", "needs_attention"].includes(requirementStatus(row.requirement, row.selection))).length;
        return {
          area,
          completionPercent: areaRows.length ? Math.round((completed / areaRows.length) * 100) : 0,
          status: outstanding ? "Needs Attention" : "Complete",
          outstandingCount: outstanding,
          variationTotal: areaRows.reduce((sum, row) => sum + (row.selection?.variation?.amount ?? 0), 0),
        };
      }),
    };
  }).filter((group) => group.rooms.length > 0);
}

const CATEGORY_LABELS: Record<string, string> = {
  external_finish: "External Materials",
  hardware: "Door Hardware",
  fixture: "Sanitaryware",
  fitting: "Bathroom Accessories",
  appliance: "Appliances",
  plumbing: "Tapware",
  flooring: "Floor Coverings",
  wall_finish: "Paint",
  electrical: "Electrical",
  allowance: "Other",
};

export function loadCategoryView(state: SelectionWorkspaceState): CategoryViewGroup[] {
  const rows = state.requirements.map((requirement) => rowForRequirement(state, requirement));
  const categories = [...new Set(rows.map((row) => row.requirement.category))];
  return categories.map((category) => {
    const categoryRows = rows.filter((row) => row.requirement.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category] ?? category,
      total: categoryRows.length,
      completed: categoryRows.filter((row) => requirementStatus(row.requirement, row.selection) === "complete").length,
      incomplete: categoryRows.filter((row) => requirementStatus(row.requirement, row.selection) === "not_started" || requirementStatus(row.requirement, row.selection) === "in_progress").length,
      needsAttention: categoryRows.filter((row) => requirementStatus(row.requirement, row.selection) === "needs_attention").length,
      variationTotal: categoryRows.reduce((sum, row) => sum + (row.selection?.variation?.amount ?? 0), 0),
      rows: categoryRows,
    };
  });
}

export function getRequirementWorkspaceRows(state: SelectionWorkspaceState, filter: { areaId?: string; category?: string; search?: string } = {}): RequirementWorkspaceRow[] {
  const search = filter.search?.toLowerCase().trim() ?? "";
  return state.requirements
    .filter((requirement) => !filter.areaId || requirement.areaId === filter.areaId)
    .filter((requirement) => !filter.category || requirement.category === filter.category)
    .map((requirement) => rowForRequirement(state, requirement))
    .filter((row) => !search || [row.area.name, row.requirement.title, row.requirement.category, row.selection?.value.customSelectionName, row.selection?.value.brand, row.selection?.value.model, row.selection?.value.colour, row.selection?.value.supplierSku].filter(Boolean).join(" ").toLowerCase().includes(search));
}

export async function createProjectSelection(
  state: SelectionWorkspaceState,
  requirementId: string,
  productReferenceId: string,
  variantId?: string,
  adapter: ProductSelectionCatalogueAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev"),
): Promise<DomainResult<SelectionWorkspaceState>> {
  const requirement = state.requirements.find((item) => item.id === requirementId);
  if (!requirement) return fail("missing_project_requirement", "Choose an existing project requirement.");
  const product = await adapter.getProduct(productReferenceId);
  const variant = variantId ? await adapter.getVariant(productReferenceId, variantId) : null;
  const compatibility = isProductCompatible(requirement, product, variant);
  if (compatibility) return fail("incompatible_product", compatibility, requirementId);
  const exactVariant = variant;
  const quantity = 1;
  const value: SelectionValue = {
    productReferenceId,
    variantId: exactVariant?.id,
    requiresVariant: Boolean(product?.requiresVariant),
    allowance: product?.allowance ?? money(requirementAllowance(requirement)),
    clientPrice: exactVariant?.unitCost ?? product?.unitCost,
    unit: product?.unit ?? "each",
    productName: product?.name,
    productImageUrl: product?.imageUrl,
    productUrl: product?.productUrl,
    description: exactVariant?.description ?? product?.description,
    brand: product?.brand,
    model: product?.model,
    colour: exactVariant?.colour ?? product?.colour,
    finish: exactVariant?.finish ?? product?.finish,
    supplierId: product?.supplierId,
    supplierName: product?.supplierName,
    supplierSku: exactVariant?.sku ?? product?.supplierSku,
    builderCost: exactVariant?.builderCost ?? product?.builderCost,
    priceSource: product?.priceSource ? "catalogue" : "catalogue",
    priceEffectiveDate: exactVariant?.priceEffectiveDate ?? product?.priceEffectiveDate,
    priceExpiresAt: exactVariant?.priceExpiresAt ?? product?.priceExpiresAt,
    pricingStatus: exactVariant?.unitCost ?? product?.unitCost ? "confirmed" : "price_missing",
  };
  const pricing = priceSelection(requirement, value, quantity, value.clientPrice?.amount);
  const id = selectionId(state.context, requirementId);
  const selection: ProjectSelection = {
    id,
    organisationId: state.context.organisationId,
    projectId: state.context.projectId,
    requirementId,
    value,
    source: "builder",
    status: "draft",
    revision: (state.selections.find((item) => item.requirementId === requirementId)?.revision ?? 0) + 1,
    selectionStatus: exactVariant || !product?.requiresVariant ? "complete" : "in_progress",
    quantity,
    unit: product?.unit ?? "each",
    inheritedFrom: "draft_override",
    ...pricing,
  };
  const areaId = requirement.areaId;
  const location: SelectionLocation = { id: locationId(state.context, id, areaId, requirement.id), organisationId: state.context.organisationId, projectId: state.context.projectId, selectionId: id, requirementId: requirement.id, areaId, label: `${state.templateStage.areaRegister.areas.find((area) => area.id === areaId)?.name ?? "Area"} - ${requirement.title}`, quantity, pricingQuantity: quantity, unit: selection.unit ?? "each" };
  return ok({ ...state, selections: [...state.selections.filter((item) => item.requirementId !== requirementId), selection], locations: [...state.locations.filter((item) => item.requirementId !== requirementId), location], draftState: { ...state.draftState, savedStatus: "unsaved" } });
}

export async function selectProductVariant(state: SelectionWorkspaceState, requirementId: string, variantId: string, adapter: ProductSelectionCatalogueAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev")): Promise<DomainResult<SelectionWorkspaceState>> {
  const selection = state.selections.find((item) => item.requirementId === requirementId);
  if (!selection?.value.productReferenceId) return fail("missing_product_selection", "Select a product before choosing a variant.", requirementId);
  return createProjectSelection(state, requirementId, selection.value.productReferenceId, variantId, adapter);
}

export function createCustomSelection(state: SelectionWorkspaceState, requirementId: string, input: { name: string; description: string; category: string; quantity: number; unit: string; clientPrice: number; allowance: number; brand?: string; model?: string; colour?: string; supplierId?: string; supplierSku?: string; notes?: string }): DomainResult<SelectionWorkspaceState> {
  const requirement = state.requirements.find((item) => item.id === requirementId);
  if (!requirement) return fail("missing_project_requirement", "Choose an existing project requirement.");
  if (!input.name.trim()) return fail("missing_custom_selection_name", "Custom selection name is required.", requirementId);
  if (!input.description.trim()) return fail("missing_custom_selection_description", "Custom selection description is required.", requirementId);
  if (input.category !== requirement.category) return fail("invalid_custom_selection_category", "Custom selection category must match the requirement.", requirementId);
  if (input.quantity <= 0) return fail("invalid_quantity", "Quantity must be greater than zero.", requirementId);
  const id = selectionId(state.context, requirementId);
  const customSelectionId = makeScopedId("custom_selection", [state.context.organisationId, state.context.projectId, requirementId, input.name]);
  const value: SelectionValue = { customSelectionId, customSelectionName: input.name.trim(), customSelectionCategory: input.category, description: input.description.trim(), brand: input.brand, model: input.model, colour: input.colour, supplierId: input.supplierId, supplierSku: input.supplierSku, clientPrice: money(input.clientPrice), allowance: money(input.allowance), unit: input.unit, priceSource: "manual", pricingStatus: "manual_price" };
  const pricing = priceSelection(requirement, value, input.quantity, input.clientPrice);
  const selection: ProjectSelection = { id, organisationId: state.context.organisationId, projectId: state.context.projectId, requirementId, value, source: "builder", status: "draft", revision: (state.selections.find((item) => item.requirementId === requirementId)?.revision ?? 0) + 1, selectionStatus: "complete", quantity: input.quantity, unit: input.unit, inheritedFrom: "manual_custom_selection", ...pricing };
  const location: SelectionLocation = { id: locationId(state.context, id, requirement.areaId, requirement.id), organisationId: state.context.organisationId, projectId: state.context.projectId, selectionId: id, requirementId: requirement.id, areaId: requirement.areaId, label: `${state.templateStage.areaRegister.areas.find((area) => area.id === requirement.areaId)?.name ?? "Area"} - ${requirement.title}`, quantity: input.quantity, pricingQuantity: input.quantity, unit: input.unit };
  const note: RequirementNote | null = input.notes ? { id: makeScopedId("requirement_note", [state.context.projectId, requirementId, Date.now()]), organisationId: state.context.organisationId, projectId: state.context.projectId, requirementId, kind: "internal", text: input.notes, createdAt: new Date().toISOString() } : null;
  return ok({ ...state, selections: [...state.selections.filter((item) => item.requirementId !== requirementId), selection], locations: [...state.locations.filter((item) => item.requirementId !== requirementId), location], notes: note ? [...state.notes, note] : state.notes, draftState: { ...state.draftState, savedStatus: "unsaved" } });
}

export function updateRequirementStatus(state: SelectionWorkspaceState, requirementId: string, status: RequirementSelectionStatus, reason?: string): DomainResult<SelectionWorkspaceState> {
  const requirement = state.requirements.find((item) => item.id === requirementId);
  if (!requirement) return fail("missing_project_requirement", "Choose an existing project requirement.");
  if (status === "not_applicable" && requirement.required && !reason?.trim()) return fail("missing_not_applicable_reason", "Required selections need a reason before marking Not Applicable.", requirementId);
  const existing = state.selections.find((item) => item.requirementId === requirementId);
  const selection: ProjectSelection = existing ?? { id: selectionId(state.context, requirementId), organisationId: state.context.organisationId, projectId: state.context.projectId, requirementId, value: {}, source: "builder", status: "draft", revision: 1 };
  const note = status === "not_applicable" && reason ? { id: makeScopedId("requirement_note", [state.context.projectId, requirementId, "not-applicable", Date.now()]), organisationId: state.context.organisationId, projectId: state.context.projectId, requirementId, kind: "not_applicable_reason" as const, text: reason, createdAt: new Date().toISOString() } : null;
  return ok({ ...state, selections: [...state.selections.filter((item) => item.requirementId !== requirementId), { ...selection, selectionStatus: status, notApplicableReason: reason }], notes: note ? [...state.notes, note] : state.notes, draftState: { ...state.draftState, savedStatus: "unsaved" } });
}

export function clearProjectSelection(state: SelectionWorkspaceState, requirementId: string): DomainResult<SelectionWorkspaceState> {
  return ok({ ...state, selections: state.selections.filter((selection) => selection.requirementId !== requirementId), locations: state.locations.filter((location) => location.requirementId !== requirementId), draftState: { ...state.draftState, savedStatus: "unsaved" } });
}

export const resetSelectionToInherited = clearProjectSelection;

function applyScopeTargets(state: SelectionWorkspaceState, sourceRequirement: ProjectRequirement, scope: ApplyToScope, selectedAreaIds: string[] = []): ProjectRequirement[] {
  const sourceArea = state.templateStage.areaRegister.areas.find((area) => area.id === sourceRequirement.areaId);
  return state.requirements.filter((requirement) => {
    const area = state.templateStage.areaRegister.areas.find((candidate) => candidate.id === requirement.areaId);
    if (scope === "this_requirement") return requirement.id === sourceRequirement.id;
    if (scope === "this_room") return requirement.areaId === sourceRequirement.areaId;
    if (scope === "selected_rooms") return selectedAreaIds.includes(requirement.areaId);
    if (scope === "all_rooms_of_area_type") return area?.areaTypeId === sourceArea?.areaTypeId;
    if (scope === "all_rooms_in_area_group") return area?.groupId === sourceArea?.groupId;
    return true;
  });
}

export async function previewApplyTo(state: SelectionWorkspaceState, sourceRequirementId: string, scope: ApplyToScope, selectedAreaIds: string[] = [], adapter: ProductSelectionCatalogueAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev")): Promise<ApplyToPreview> {
  const sourceRequirement = state.requirements.find((requirement) => requirement.id === sourceRequirementId);
  const sourceSelection = state.selections.find((selection) => selection.requirementId === sourceRequirementId);
  if (!sourceRequirement || !sourceSelection) return { sourceRequirementId, scope, compatibleTargets: [], incompatibleTargets: [], skippedTargets: [] };
  const product = sourceSelection.value.productReferenceId ? await adapter.getProduct(sourceSelection.value.productReferenceId) : null;
  const variant = sourceSelection.value.productReferenceId && sourceSelection.value.variantId ? await adapter.getVariant(sourceSelection.value.productReferenceId, sourceSelection.value.variantId) : null;
  const compatibleTargets: ApplyToPreviewTarget[] = [];
  const incompatibleTargets: ApplyToPreviewTarget[] = [];
  const skippedTargets: ApplyToPreviewTarget[] = [];
  applyScopeTargets(state, sourceRequirement, scope, selectedAreaIds).forEach((requirement) => {
    const area = state.templateStage.areaRegister.areas.find((item) => item.id === requirement.areaId);
    const current = state.selections.find((selection) => selection.requirementId === requirement.id);
    const target: ApplyToPreviewTarget = { requirementId: requirement.id, areaId: requirement.areaId, projectAreaName: area?.name ?? requirement.areaId, requirementName: requirement.title, quantity: sourceSelection.quantity ?? 1, currentSelection: current?.value.customSelectionName ?? current?.value.productReferenceId, proposedSelection: sourceSelection.value.customSelectionName ?? product?.name ?? "Selection", currentVariation: current?.variation?.amount ?? 0, proposedVariation: sourceSelection.variation?.amount ?? 0 };
    if (current?.protected) skippedTargets.push({ ...target, reason: "locked or protected" });
    else if (current?.value.productReferenceId === sourceSelection.value.productReferenceId && current?.value.variantId === sourceSelection.value.variantId) skippedTargets.push({ ...target, reason: "already has identical selection" });
    else {
      const incompatible = sourceSelection.value.customSelectionId ? (requirement.category === sourceRequirement.category ? null : "Custom selection category is incompatible.") : isProductCompatible(requirement, product, variant);
      if (incompatible) incompatibleTargets.push({ ...target, reason: incompatible });
      else compatibleTargets.push(target);
    }
  });
  return { sourceRequirementId, scope, compatibleTargets, incompatibleTargets, skippedTargets };
}

export function applySelectionToTargets(state: SelectionWorkspaceState, preview: ApplyToPreview, includedRequirementIds: string[]): DomainResult<SelectionWorkspaceState> {
  const source = state.selections.find((selection) => selection.requirementId === preview.sourceRequirementId);
  if (!source) return fail("missing_product_selection", "Create a selection before applying it to other areas.");
  const allowed = new Set(preview.compatibleTargets.map((target) => target.requirementId));
  const included = includedRequirementIds.filter((id) => allowed.has(id));
  const nextSelections = state.selections.filter((selection) => !included.includes(selection.requirementId));
  const nextLocations = state.locations.filter((location) => !included.includes(location.requirementId));
  included.forEach((requirementId) => {
    const requirement = state.requirements.find((item) => item.id === requirementId);
    if (!requirement) return;
    const id = selectionId(state.context, requirementId);
    nextSelections.push({ ...source, id, requirementId, revision: (state.selections.find((item) => item.requirementId === requirementId)?.revision ?? 0) + 1, selectionStatus: "complete" });
    nextLocations.push({ id: locationId(state.context, id, requirement.areaId, requirement.id), organisationId: state.context.organisationId, projectId: state.context.projectId, selectionId: id, requirementId, areaId: requirement.areaId, label: `${state.templateStage.areaRegister.areas.find((area) => area.id === requirement.areaId)?.name ?? "Area"} - ${requirement.title}`, quantity: source.quantity ?? 1, pricingQuantity: source.quantity ?? 1, unit: source.unit ?? "each" });
  });
  return ok({ ...state, selections: nextSelections, locations: nextLocations, draftState: { ...state.draftState, savedStatus: "unsaved" } });
}

export async function saveWorkspaceDraft(state: SelectionWorkspaceState, repository: SelectionWorkspaceRepository = selectionWorkspaceRepository): Promise<DomainResult<SelectionWorkspaceState>> {
  const validation = validateSelectionWorkspace(state, true);
  if (!validation.ok) return validation;
  const [selections, locations, notes, attachments, draftState] = await Promise.all([
    repository.saveSelections(state.context, state.selections),
    repository.saveLocations(state.context, state.locations),
    repository.saveRequirementNotes(state.context, state.notes),
    repository.saveAttachments(state.context, state.attachments),
    repository.saveDraftState({ ...state.draftState, savedStatus: "saved" }),
  ]);
  return ok({ ...state, selections, locations, notes, attachments, draftState });
}

export function validateSelectionWorkspace(state: SelectionWorkspaceState, allowIncomplete = false): DomainResult<SelectionWorkspaceState> {
  const issues: DomainIssue[] = [];
  if (!state.context.organisationId || !state.context.projectId) issues.push(issue("missing_project_context", "Open an existing project before completing selections."));
  if (state.requirements.length === 0) issues.push(issue("missing_project_requirement", "Generate ProjectRequirements before opening the selection workspace."));
  const requirementIds = new Set(state.requirements.map((requirement) => requirement.id));
  const locationKeys = new Set<string>();
  state.selections.forEach((selection) => {
    const requirement = state.requirements.find((item) => item.id === selection.requirementId);
    if (!requirementIds.has(selection.requirementId)) issues.push(issue("missing_project_requirement", "Selection references a missing ProjectRequirement.", selection.id));
    if (selection.organisationId !== state.context.organisationId) issues.push(issue("cross_organisation_selection", "Selection belongs to another organisation.", selection.id));
    if (selection.projectId !== state.context.projectId) issues.push(issue("cross_project_selection", "Selection belongs to another project.", selection.id));
    if ((selection.quantity ?? 1) <= 0) issues.push(issue("invalid_quantity", "Selection quantity must be greater than zero.", selection.id));
    if (!selection.unit && selection.selectionStatus === "complete") issues.push(issue("invalid_unit", "Completed selections require a unit.", selection.id));
    if (!selection.selectedPrice && selection.selectionStatus === "complete") issues.push(issue("missing_price", "Completed selections need a selected price or explicit price pending handling.", selection.id));
    if (selection.value.productReferenceId && selection.value.requiresVariant && !selection.value.variantId && selection.selectionStatus === "complete") issues.push(issue("missing_required_variant", "Choose the required product variant before completing this selection.", selection.id));
    if (selection.selectionStatus === "not_applicable" && requirement?.required && !selection.notApplicableReason) issues.push(issue("missing_not_applicable_reason", "Required items need a reason before Not Applicable.", selection.id));
    if (selection.value.customSelectionId && !selection.value.description) issues.push(issue("missing_custom_selection_description", "Custom selections need a description.", selection.id));
    if (selection.value.customSelectionId && requirement && selection.value.customSelectionCategory && selection.value.customSelectionCategory !== requirement.category) issues.push(issue("invalid_category_for_custom_selection", "Custom selection category is invalid.", selection.id));
  });
  state.locations.forEach((location) => {
    const key = `${location.selectionId}:${location.areaId}:${location.requirementId}`;
    if (locationKeys.has(key)) issues.push(issue("duplicate_selection_location", "Duplicate SelectionLocation found.", location.id));
    locationKeys.add(key);
    if (location.organisationId !== state.context.organisationId) issues.push(issue("cross_organisation_selection_location", "SelectionLocation belongs to another organisation.", location.id));
    if (location.projectId !== state.context.projectId) issues.push(issue("cross_project_selection_location", "SelectionLocation belongs to another project.", location.id));
    if (location.quantity <= 0) issues.push(issue("invalid_quantity", "SelectionLocation quantity must be greater than zero.", location.id));
  });
  if (!allowIncomplete) {
    state.requirements.filter((requirement) => requirement.required).forEach((requirement) => {
      const selection = state.selections.find((item) => item.requirementId === requirement.id);
      if (!selection || !["complete", "not_applicable"].includes(selection.selectionStatus ?? "not_started")) issues.push(issue("unresolved_required_selection", `${requirement.title} is required and not complete.`, requirement.id));
      if (selection?.selectionStatus === "not_applicable" && !selection.notApplicableReason) issues.push(issue("missing_not_applicable_reason", `${requirement.title} needs a Not Applicable reason.`, requirement.id));
    });
  }
  return issues.length ? { ok: false, issues } : ok(state);
}
