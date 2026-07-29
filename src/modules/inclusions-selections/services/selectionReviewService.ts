import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import { calculateSelectionPricing } from "../pricing/pricingService";
import type { ProductReference, ProductVariantReference } from "../products/productReferenceTypes";
import type { ProductSelectionCatalogueAdapter } from "../products/productSelectionCatalogueAdapter";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import type { AllowanceOverride, ReviewAuditEvent, ReviewIssue, ReviewStatus, ReviewView, SelectionReviewRepository, SelectionReviewState } from "../repositories/selectionReviewRepository";
import { selectionReviewRepository } from "../repositories/selectionReviewRepository";
import type { SelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import type { ProjectSelection } from "../selections/selectionTypes";
import type { Money } from "../shared/money";
import { money, roundCurrency } from "../shared/money";
import { makeScopedId } from "../shared/ids";
import { loadSelectionWorkspace, type SelectionWorkspaceState } from "./selectionWorkspaceService";
import { resolveEffectiveTemplateAssignment } from "./templateStageService";
import type { DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type PricingStatus = "confirmed" | "provisional" | "allowance_only" | "price_missing" | "supplier_quote_required" | "manual_price" | "expired_price" | "unavailable_product";

export type ReviewLine = {
  area: ProjectArea;
  requirement: ProjectRequirement;
  selection?: ProjectSelection;
  product?: ProductReference | null;
  variant?: ProductVariantReference | null;
  supplierName?: string;
  selectedItem: string;
  quantity: number;
  unit: string;
  allowance: Money;
  selectedValue: Money;
  builderCost: Money;
  variation: Money;
  gst: Money;
  credit: Money;
  upgrade: Money;
  pricingStatus: PricingStatus;
  issues: ReviewIssue[];
  inheritedTierId?: string;
  inheritanceSource: string;
};

export type ProjectReviewSummary = {
  projectName: string;
  projectTierId?: string;
  totalAreas: number;
  totalRequirements: number;
  completedRequirements: number;
  incompleteRequiredRequirements: number;
  optionalPendingRequirements: number;
  notApplicableRequirements: number;
  needsAttentionRequirements: number;
  missingPriceSelections: number;
  provisionalPriceSelections: number;
  customSelections: number;
  unavailableProducts: number;
  totalIncludedAllowance: Money;
  totalSelectedValue: Money;
  totalCredits: Money;
  totalUpgrades: Money;
  netDraftVariation: Money;
  gstAmount: Money;
  lastSavedStatus: string;
  readyForApproval: boolean;
};

export type RoomReviewGroup = {
  groupId: string;
  groupName: string;
  rooms: Array<{ area: ProjectArea; levelName: string; areaTypeName: string; tierId?: string; totalRequirements: number; completeRequirements: number; incompleteRequirements: number; allowanceTotal: Money; selectedValueTotal: Money; credits: Money; upgrades: Money; netVariation: Money; issueCount: number; lines: ReviewLine[] }>;
};

export type CategoryReviewGroup = {
  category: string;
  label: string;
  totalRequirements: number;
  completeRequirements: number;
  incompleteRequirements: number;
  allowanceTotal: Money;
  selectedValueTotal: Money;
  credits: Money;
  upgrades: Money;
  netVariation: Money;
  missingPriceCount: number;
  issueCount: number;
  lines: ReviewLine[];
};

export type VariationSummary = {
  included: ReviewLine[];
  noChange: ReviewLine[];
  upgrades: ReviewLine[];
  credits: ReviewLine[];
  missingPrices: ReviewLine[];
  provisionalPrices: ReviewLine[];
  excluded: ReviewLine[];
  totalAllowance: Money;
  totalSelectedValue: Money;
  totalUpgrades: Money;
  totalCredits: Money;
  netExcludingGst: Money;
  gst: Money;
  netIncludingGst: Money;
};

export type ClientVariationProjection = {
  projectName: string;
  clientName?: string;
  siteAddress?: string;
  warning: "Draft only - not approved or contractual.";
  lines: Array<{ areaName: string; requirementName: string; selectedItem: string; quantity: number; unit: string; allowance: Money; selectedValue: Money; credit: Money; upgrade: Money; netVariation: Money; gst: Money; clientVisibleNotes: string[] }>;
  totalDraftVariation: Money;
};

export type BuilderInternalProjection = {
  label: "Internal Builder View";
  lines: Array<{ areaName: string; requirementName: string; selectedItem: string; builderCost: Money; supplierName?: string; supplierSku?: string; markup: Money; clientPrice: Money; allowance: Money; marginImpact: Money; quantity: number; procurementQuantity: number; priceSource: string; internalNotes: string[]; missingInformation: string[] }>;
};

export type SelectionReview = {
  context: ProjectSelectionContext;
  workspace: SelectionWorkspaceState;
  reviewState: SelectionReviewState;
  issues: ReviewIssue[];
  allowanceOverrides: AllowanceOverride[];
  auditEvents: ReviewAuditEvent[];
  lines: ReviewLine[];
  summary: ProjectReviewSummary;
  status: ReviewStatus;
  statusReasons: string[];
};

function defaultReviewState(context: ProjectSelectionContext, fingerprint: string): SelectionReviewState {
  return { organisationId: context.organisationId, projectId: context.projectId, selectedView: "summary", status: "draft", readyForApproval: false, selectionFingerprint: fingerprint, savedStatus: "saved", updatedAt: new Date().toISOString() };
}

function fingerprint(workspace: SelectionWorkspaceState): string {
  return JSON.stringify({
    selections: workspace.selections.map((selection) => [selection.id, selection.requirementId, selection.revision, selection.selectionStatus, selection.selectedPrice?.amount, selection.allowance?.amount, selection.variation?.amount, selection.notApplicableReason]).sort(),
    locations: workspace.locations.map((location) => [location.id, location.selectionId, location.requirementId, location.quantity, location.pricingQuantity]).sort(),
  });
}

function priceStatus(selection?: ProjectSelection, product?: ProductReference | null): PricingStatus {
  if (!selection) return "price_missing";
  if (product && (!product.active || product.discontinued)) return "unavailable_product";
  if (selection.value.pricingStatus) return selection.value.pricingStatus;
  if (!selection.selectedPrice) return "price_missing";
  if (selection.value.customSelectionId) return "manual_price";
  if (selection.value.priceExpiresAt && new Date(selection.value.priceExpiresAt).getTime() < Date.now()) return "expired_price";
  return "confirmed";
}

function selectionLabel(selection?: ProjectSelection, product?: ProductReference | null, variant?: ProductVariantReference | null): string {
  if (!selection) return "No selection";
  return selection.value.customSelectionName ?? [product?.name ?? selection.value.productReferenceId, variant?.name].filter(Boolean).join(" - ") ?? "Selection";
}

function lineTotals(selection?: ProjectSelection): Pick<ReviewLine, "allowance" | "selectedValue" | "builderCost" | "variation" | "gst" | "credit" | "upgrade"> {
  const quantity = selection?.quantity ?? 1;
  const allowance = selection?.allowance ?? selection?.value.allowance ?? money(0);
  const selected = selection?.selectedPrice ?? selection?.value.clientPrice ?? money(0, allowance.currency);
  const builderCost = selection?.value.builderCost ? money(selection.value.builderCost.amount * quantity, selection.value.builderCost.currency) : money(0, allowance.currency);
  const variation = selection?.variation ?? money(roundCurrency(selected.amount - allowance.amount), allowance.currency);
  return {
    allowance,
    selectedValue: selected,
    builderCost,
    variation,
    gst: selection?.gst ?? money(roundCurrency(Math.max(selected.amount, 0) * 0.1), allowance.currency),
    credit: money(Math.min(variation.amount, 0), allowance.currency),
    upgrade: money(Math.max(variation.amount, 0), allowance.currency),
  };
}

function reviewIssue(context: ProjectSelectionContext, code: string, severity: "information" | "warning" | "blocking", data: { areaId?: string; requirementId?: string; selectionId?: string; title: string; description: string; resolutionAction: string }): ReviewIssue {
  const id = makeScopedId("review_issue", [context.organisationId, context.projectId, code, data.areaId ?? "project", data.requirementId ?? "none", data.selectionId ?? "none"]);
  return { id, code, severity, organisationId: context.organisationId, projectId: context.projectId, areaId: data.areaId, requirementId: data.requirementId, selectionId: data.selectionId, title: data.title, description: data.description, resolutionAction: data.resolutionAction, createdAt: new Date().toISOString(), blocking: severity === "blocking" };
}

export async function generateReviewIssues(workspace: SelectionWorkspaceState, adapter: ProductSelectionCatalogueAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev")): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];
  if (!workspace.context.organisationId || !workspace.context.projectId) issues.push(reviewIssue(workspace.context, "missing_project_context", "blocking", { title: "Missing project context", description: "Open an existing project before review.", resolutionAction: "Return to the project." }));
  if (workspace.templateStage.areaRegister.areas.length === 0) issues.push(reviewIssue(workspace.context, "missing_project_areas", "blocking", { title: "Missing ProjectAreas", description: "Create project areas before review.", resolutionAction: "Return to Create Selection Areas." }));
  if (workspace.requirements.length === 0) issues.push(reviewIssue(workspace.context, "missing_project_requirements", "blocking", { title: "Missing ProjectRequirements", description: "Generate requirements before review.", resolutionAction: "Return to Room Templates." }));
  const requirementIds = new Set(workspace.requirements.map((requirement) => requirement.id));
  const locationKeys = new Set<string>();
  for (const requirement of workspace.requirements) {
    const selection = workspace.selections.find((item) => item.requirementId === requirement.id);
    if (requirement.required && (!selection || !["complete", "not_applicable"].includes(selection.selectionStatus ?? "not_started"))) issues.push(reviewIssue(workspace.context, "unresolved_required_selection", "blocking", { areaId: requirement.areaId, requirementId: requirement.id, title: "Required Selection Missing", description: `${requirement.title} is required and incomplete.`, resolutionAction: "Edit in Selection Workspace." }));
    if (selection?.selectionStatus === "not_applicable") {
      if (!selection.notApplicableReason) issues.push(reviewIssue(workspace.context, "missing_not_applicable_reason", "blocking", { areaId: requirement.areaId, requirementId: requirement.id, selectionId: selection.id, title: "Not Applicable Reason Missing", description: `${requirement.title} needs a Not Applicable reason.`, resolutionAction: "Add a reason in Selection Workspace." }));
      if (requirement.required) issues.push(reviewIssue(workspace.context, "required_item_not_applicable", "blocking", { areaId: requirement.areaId, requirementId: requirement.id, selectionId: selection.id, title: "Required Item Marked Not Applicable", description: "Required items need an authorised future override before approval.", resolutionAction: "Select an item or document the later override workflow." }));
    }
  }
  for (const selection of workspace.selections) {
    const requirement = workspace.requirements.find((item) => item.id === selection.requirementId);
    if (!requirementIds.has(selection.requirementId)) issues.push(reviewIssue(workspace.context, "missing_project_requirement", "blocking", { selectionId: selection.id, title: "Selection References Missing Requirement", description: "A selection references a missing ProjectRequirement.", resolutionAction: "Return to templates and reconcile requirements." }));
    if (selection.organisationId !== workspace.context.organisationId) issues.push(reviewIssue(workspace.context, "cross_organisation_record", "blocking", { requirementId: selection.requirementId, selectionId: selection.id, title: "Cross-Organisation Record", description: "Selection belongs to another organisation.", resolutionAction: "Remove the invalid reference." }));
    if ((selection.quantity ?? 1) <= 0) issues.push(reviewIssue(workspace.context, "invalid_quantity", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Invalid Quantity", description: "Selection quantity must be greater than zero.", resolutionAction: "Correct the quantity in Selection Workspace." }));
    if (!selection.unit && selection.selectionStatus === "complete") issues.push(reviewIssue(workspace.context, "invalid_unit", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Invalid Unit", description: "Completed selections require a unit.", resolutionAction: "Correct the unit in Selection Workspace." }));
    if (!selection.selectedPrice && selection.selectionStatus === "complete") issues.push(reviewIssue(workspace.context, "missing_client_price", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Price Missing", description: "Completed selections need a client price.", resolutionAction: "Add pricing or mark supplier quote required." }));
    if (selection.value.productReferenceId && !selection.value.variantId && selection.selectionStatus === "complete") issues.push(reviewIssue(workspace.context, "missing_variant", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Required Variant Missing", description: "A product family requires an exact variant.", resolutionAction: "Choose the required variant." }));
    if (selection.value.customSelectionId && !selection.value.description) issues.push(reviewIssue(workspace.context, "incomplete_custom_selection", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Custom Selection Incomplete", description: "Custom selections require a description.", resolutionAction: "Complete the custom selection." }));
    if (selection.value.customSelectionId && !selection.value.supplierId) issues.push(reviewIssue(workspace.context, "missing_supplier", "warning", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Supplier Missing", description: "Custom selection has no supplier reference.", resolutionAction: "Add supplier details or acknowledge the warning." }));
    if ((selection.allowance?.amount ?? selection.value.allowance?.amount ?? 0) < 0) issues.push(reviewIssue(workspace.context, "invalid_allowance", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Invalid Allowance", description: "Allowance cannot be negative.", resolutionAction: "Correct the allowance." }));
    if (selection.value.pricingStatus === "provisional") issues.push(reviewIssue(workspace.context, "provisional_price", "warning", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Provisional Price", description: "Price is provisional and should be confirmed before approval.", resolutionAction: "Confirm pricing or acknowledge with a reason." }));
    if (selection.value.pricingStatus === "supplier_quote_required") issues.push(reviewIssue(workspace.context, "supplier_quote_required", "warning", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Supplier Quote Required", description: "A supplier quote is required.", resolutionAction: "Request quote in a future stage or acknowledge." }));
    if (selection.value.priceExpiresAt && new Date(selection.value.priceExpiresAt).getTime() < Date.now()) issues.push(reviewIssue(workspace.context, "expired_price", "warning", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Price Expired", description: "The selected price has expired.", resolutionAction: "Refresh pricing." }));
    if (selection.value.productReferenceId) {
      const product = await adapter.getProduct(selection.value.productReferenceId);
      const variant = selection.value.variantId ? await adapter.getVariant(selection.value.productReferenceId, selection.value.variantId) : null;
      if (!product) issues.push(reviewIssue(workspace.context, "missing_product", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Product Missing", description: "Selected product cannot be found.", resolutionAction: "Choose a replacement." }));
      if (product && !product.active) issues.push(reviewIssue(workspace.context, "inactive_product", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Product Inactive", description: "Selected product is inactive.", resolutionAction: "Choose an active product." }));
      if (product && product.discontinued) issues.push(reviewIssue(workspace.context, "unavailable_product", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Product Unavailable", description: "Selected product is discontinued or unavailable.", resolutionAction: "Choose a replacement." }));
      if (variant && !variant.active) issues.push(reviewIssue(workspace.context, "unavailable_variant", "blocking", { areaId: requirement?.areaId, requirementId: selection.requirementId, selectionId: selection.id, title: "Variant Unavailable", description: "Selected variant is unavailable.", resolutionAction: "Choose a replacement variant." }));
      if (product && requirement && (product.compatibility.category !== requirement.category || (product.compatibility.subtype && product.compatibility.subtype !== requirement.subtype))) issues.push(reviewIssue(workspace.context, "compatibility_conflict", "blocking", { areaId: requirement.areaId, requirementId: requirement.id, selectionId: selection.id, title: "Compatibility Conflict", description: "Selected product does not match the requirement.", resolutionAction: "Choose a compatible product." }));
    }
  }
  for (const location of workspace.locations) {
    const key = `${location.selectionId}:${location.areaId}:${location.requirementId}`;
    if (locationKeys.has(key)) issues.push(reviewIssue(workspace.context, "duplicate_selection_location", "blocking", { areaId: location.areaId, requirementId: location.requirementId, selectionId: location.selectionId, title: "Duplicate SelectionLocation", description: "Duplicate physical usage location found.", resolutionAction: "Return to Selection Workspace and reapply cleanly." }));
    locationKeys.add(key);
    if (location.organisationId !== workspace.context.organisationId || location.projectId !== workspace.context.projectId) issues.push(reviewIssue(workspace.context, "cross_project_selection_location", "blocking", { areaId: location.areaId, requirementId: location.requirementId, selectionId: location.selectionId, title: "Cross-Project Location", description: "SelectionLocation is outside the current project scope.", resolutionAction: "Remove invalid location." }));
  }
  return issues;
}

export async function buildReviewLines(workspace: SelectionWorkspaceState, issues: ReviewIssue[], adapter: ProductSelectionCatalogueAdapter = new InMemoryProductSelectionCatalogueAdapter("org_dev")): Promise<ReviewLine[]> {
  const lines: ReviewLine[] = [];
  for (const requirement of workspace.requirements) {
    const area = workspace.templateStage.areaRegister.areas.find((item) => item.id === requirement.areaId) ?? workspace.templateStage.areaRegister.areas[0];
    const selection = workspace.selections.find((item) => item.requirementId === requirement.id);
    const product = selection?.value.productReferenceId ? await adapter.getProduct(selection.value.productReferenceId) : null;
    const variant = selection?.value.productReferenceId && selection.value.variantId ? await adapter.getVariant(selection.value.productReferenceId, selection.value.variantId) : null;
    const supplier = selection?.value.supplierId ? await adapter.getSupplier(selection.value.supplierId) : null;
    const effective = area ? resolveEffectiveTemplateAssignment(workspace.templateStage, area) : null;
    const totals = lineTotals(selection);
    lines.push({
      area,
      requirement,
      selection,
      product,
      variant,
      supplierName: supplier?.name,
      selectedItem: selectionLabel(selection, product, variant),
      quantity: selection?.quantity ?? requirement.quantity ?? 1,
      unit: selection?.unit ?? selection?.value.unit ?? "each",
      ...totals,
      pricingStatus: priceStatus(selection, product),
      issues: issues.filter((item) => item.requirementId === requirement.id || item.selectionId === selection?.id),
      inheritedTierId: effective?.tierId,
      inheritanceSource: selection?.inheritedFrom === "manual_custom_selection" ? "Manual Custom Selection" : effective?.sourceLabel ?? "Inherited from Project Default",
    });
  }
  return lines;
}

function sum(lines: ReviewLine[], pick: (line: ReviewLine) => Money): Money {
  return money(roundCurrency(lines.reduce((total, line) => total + pick(line).amount, 0)), lines[0]?.allowance.currency ?? "AUD");
}

function statusFromIssues(issues: ReviewIssue[]): { status: ReviewStatus; reasons: string[] } {
  const blocking = issues.filter((item) => item.blocking && !item.resolvedAt);
  const reasons = blocking.slice(0, 8).map((item) => item.title);
  if (blocking.some((item) => ["missing_client_price", "provisional_price", "expired_price"].includes(item.code))) return { status: "pricing_incomplete", reasons };
  if (blocking.some((item) => ["unresolved_required_selection", "missing_variant"].includes(item.code))) return { status: "selection_incomplete", reasons };
  if (blocking.length) return { status: "conflicts_present", reasons };
  if (issues.some((item) => !item.resolvedAt && !item.acknowledgedAt)) return { status: "review_required", reasons: issues.filter((item) => !item.resolvedAt && !item.acknowledgedAt).slice(0, 8).map((item) => item.title) };
  return { status: "ready_for_approval", reasons: [] };
}

export function calculateProjectReviewSummary(review: Pick<SelectionReview, "workspace" | "lines" | "issues" | "reviewState">): ProjectReviewSummary {
  const lines = review.lines;
  const statuses = review.workspace.requirements.map((requirement) => review.workspace.selections.find((selection) => selection.requirementId === requirement.id)?.selectionStatus ?? "not_started");
  return {
    projectName: review.workspace.context.projectName ?? review.workspace.context.jobNumber ?? review.workspace.context.projectId,
    projectTierId: review.workspace.templateStage.configuration.projectDefault.tierId,
    totalAreas: review.workspace.templateStage.areaRegister.areas.length,
    totalRequirements: review.workspace.requirements.length,
    completedRequirements: statuses.filter((status) => status === "complete").length,
    incompleteRequiredRequirements: review.workspace.requirements.filter((requirement) => requirement.required && !["complete", "not_applicable"].includes(review.workspace.selections.find((selection) => selection.requirementId === requirement.id)?.selectionStatus ?? "not_started")).length,
    optionalPendingRequirements: review.workspace.requirements.filter((requirement) => !requirement.required && !review.workspace.selections.some((selection) => selection.requirementId === requirement.id)).length,
    notApplicableRequirements: statuses.filter((status) => status === "not_applicable").length,
    needsAttentionRequirements: statuses.filter((status) => status === "needs_attention").length,
    missingPriceSelections: lines.filter((line) => line.pricingStatus === "price_missing").length,
    provisionalPriceSelections: lines.filter((line) => line.pricingStatus === "provisional" || line.pricingStatus === "supplier_quote_required").length,
    customSelections: review.workspace.selections.filter((selection) => selection.value.customSelectionId).length,
    unavailableProducts: lines.filter((line) => line.pricingStatus === "unavailable_product").length,
    totalIncludedAllowance: sum(lines, (line) => line.allowance),
    totalSelectedValue: sum(lines, (line) => line.selectedValue),
    totalCredits: sum(lines, (line) => line.credit),
    totalUpgrades: sum(lines, (line) => line.upgrade),
    netDraftVariation: sum(lines, (line) => line.variation),
    gstAmount: sum(lines, (line) => line.gst),
    lastSavedStatus: review.reviewState.savedStatus,
    readyForApproval: review.reviewState.readyForApproval,
  };
}

export function calculateRoomReview(review: SelectionReview): RoomReviewGroup[] {
  return STANDARD_AREA_GROUPS.map((group) => {
    const rooms = review.workspace.templateStage.areaRegister.areas.filter((area) => area.groupId === group.id).map((area) => {
      const lines = review.lines.filter((line) => line.area.id === area.id);
      const areaType = STANDARD_AREA_TYPES.find((item) => item.id === area.areaTypeId);
      const level = review.workspace.templateStage.areaRegister.levels.find((item) => item.id === area.levelId);
      const effective = resolveEffectiveTemplateAssignment(review.workspace.templateStage, area);
      return { area, levelName: level?.name ?? area.levelId, areaTypeName: areaType?.name ?? area.areaTypeId, tierId: effective?.tierId, totalRequirements: lines.length, completeRequirements: lines.filter((line) => line.selection?.selectionStatus === "complete").length, incompleteRequirements: lines.filter((line) => line.selection?.selectionStatus !== "complete").length, allowanceTotal: sum(lines, (line) => line.allowance), selectedValueTotal: sum(lines, (line) => line.selectedValue), credits: sum(lines, (line) => line.credit), upgrades: sum(lines, (line) => line.upgrade), netVariation: sum(lines, (line) => line.variation), issueCount: lines.reduce((total, line) => total + line.issues.length, 0), lines };
    });
    return { groupId: group.id, groupName: group.name, rooms };
  }).filter((group) => group.rooms.length > 0);
}

export function calculateCategoryReview(review: SelectionReview): CategoryReviewGroup[] {
  return [...new Set(review.lines.map((line) => line.requirement.category))].map((category) => {
    const lines = review.lines.filter((line) => line.requirement.category === category);
    return { category, label: category.replace(/_/g, " "), totalRequirements: lines.length, completeRequirements: lines.filter((line) => line.selection?.selectionStatus === "complete").length, incompleteRequirements: lines.filter((line) => line.selection?.selectionStatus !== "complete").length, allowanceTotal: sum(lines, (line) => line.allowance), selectedValueTotal: sum(lines, (line) => line.selectedValue), credits: sum(lines, (line) => line.credit), upgrades: sum(lines, (line) => line.upgrade), netVariation: sum(lines, (line) => line.variation), missingPriceCount: lines.filter((line) => line.pricingStatus === "price_missing").length, issueCount: lines.reduce((total, line) => total + line.issues.length, 0), lines };
  });
}

export function calculateVariationSummary(review: SelectionReview): VariationSummary {
  const lines = review.lines;
  const netExcludingGst = sum(lines, (line) => line.variation);
  const gst = sum(lines, (line) => line.gst);
  return { included: lines.filter((line) => line.selection && line.variation.amount === 0), noChange: lines.filter((line) => line.selection && line.variation.amount === 0), upgrades: lines.filter((line) => line.variation.amount > 0), credits: lines.filter((line) => line.variation.amount < 0), missingPrices: lines.filter((line) => line.pricingStatus === "price_missing"), provisionalPrices: lines.filter((line) => line.pricingStatus === "provisional" || line.pricingStatus === "supplier_quote_required"), excluded: lines.filter((line) => line.selection?.selectionStatus === "not_applicable"), totalAllowance: sum(lines, (line) => line.allowance), totalSelectedValue: sum(lines, (line) => line.selectedValue), totalUpgrades: sum(lines, (line) => line.upgrade), totalCredits: sum(lines, (line) => line.credit), netExcludingGst, gst, netIncludingGst: money(roundCurrency(netExcludingGst.amount + gst.amount), netExcludingGst.currency) };
}

export function buildClientVariationProjection(review: SelectionReview): ClientVariationProjection {
  return { projectName: review.workspace.context.projectName ?? review.workspace.context.projectId, clientName: review.workspace.context.clientName, siteAddress: review.workspace.context.siteAddress, warning: "Draft only - not approved or contractual.", lines: review.lines.filter((line) => line.variation.amount !== 0).map((line) => ({ areaName: line.area.name, requirementName: line.requirement.title, selectedItem: line.selectedItem, quantity: line.quantity, unit: line.unit, allowance: line.allowance, selectedValue: line.selectedValue, credit: line.credit, upgrade: line.upgrade, netVariation: line.variation, gst: line.gst, clientVisibleNotes: review.workspace.notes.filter((note) => note.requirementId === line.requirement.id && note.kind === "client_visible").map((note) => note.text) })), totalDraftVariation: calculateVariationSummary(review).netIncludingGst };
}

export function buildBuilderInternalProjection(review: SelectionReview): BuilderInternalProjection {
  return { label: "Internal Builder View", lines: review.lines.map((line) => ({ areaName: line.area.name, requirementName: line.requirement.title, selectedItem: line.selectedItem, builderCost: line.builderCost, supplierName: line.supplierName, supplierSku: line.selection?.value.supplierSku, markup: money(roundCurrency(line.selectedValue.amount - line.builderCost.amount), line.selectedValue.currency), clientPrice: line.selectedValue, allowance: line.allowance, marginImpact: money(roundCurrency(line.selectedValue.amount - line.builderCost.amount - Math.max(line.variation.amount, 0)), line.selectedValue.currency), quantity: line.quantity, procurementQuantity: line.quantity, priceSource: line.selection?.value.priceSource ?? "not_priced", internalNotes: review.workspace.notes.filter((note) => note.requirementId === line.requirement.id && note.kind === "internal").map((note) => note.text), missingInformation: line.issues.map((item) => item.title) })) };
}

export async function loadSelectionReview(context: ProjectSelectionContext, repositories: { workspace?: SelectionWorkspaceRepository; review?: SelectionReviewRepository; adapter?: ProductSelectionCatalogueAdapter } = {}): Promise<SelectionReview> {
  const workspace = await loadSelectionWorkspace(context, repositories.workspace ?? selectionWorkspaceRepository);
  const currentFingerprint = fingerprint(workspace);
  const repository = repositories.review ?? selectionReviewRepository;
  const [persistedState, persistedIssues, allowanceOverrides, auditEvents] = await Promise.all([repository.loadReviewState(context), repository.listIssues(context), repository.listAllowanceOverrides(context), repository.listAuditEvents(context)]);
  const generatedIssues = await generateReviewIssues(workspace, repositories.adapter);
  const acknowledged = new Map(persistedIssues.map((item) => [item.id, item]));
  const issues = generatedIssues.map((item) => ({ ...item, acknowledgedAt: acknowledged.get(item.id)?.acknowledgedAt, acknowledgementReason: acknowledged.get(item.id)?.acknowledgementReason, resolvedAt: acknowledged.get(item.id)?.resolvedAt }));
  const lines = await buildReviewLines(workspace, issues, repositories.adapter);
  const status = statusFromIssues(issues);
  const stale = persistedState?.readyForApproval && persistedState.selectionFingerprint !== currentFingerprint;
  const savedReady = Boolean(persistedState?.readyForApproval && !stale);
  const reviewState = { ...(persistedState ?? defaultReviewState(context, currentFingerprint)), status: stale ? "review_required" as const : savedReady ? "ready_for_approval" as const : status.status, readyForApproval: savedReady, selectionFingerprint: currentFingerprint };
  const review: SelectionReview = { context, workspace, reviewState, issues, allowanceOverrides, auditEvents, lines, summary: {} as ProjectReviewSummary, status: reviewState.status, statusReasons: stale ? ["Ready for Approval is stale because selections changed."] : status.reasons };
  review.summary = calculateProjectReviewSummary(review);
  return review;
}

export function validateReviewReadiness(review: SelectionReview): DomainResult<SelectionReview> {
  const blocking = review.issues.filter((item) => item.blocking && !item.resolvedAt);
  if (blocking.length) return { ok: false, issues: blocking.map((item) => issue(item.code, item.description, item.requirementId ?? item.selectionId)) };
  return ok(review);
}

export async function acknowledgeReviewWarning(review: SelectionReview, issueId: string, reason: string, repository: SelectionReviewRepository = selectionReviewRepository): Promise<DomainResult<SelectionReview>> {
  const target = review.issues.find((item) => item.id === issueId);
  if (!target) return { ok: false, issues: [issue("missing_review_issue", "Choose an existing review issue.", issueId)] };
  if (target.blocking) return { ok: false, issues: [issue("blocking_issue_cannot_be_dismissed", "Blocking issues must be resolved in the underlying data.", issueId)] };
  if (!reason.trim()) return { ok: false, issues: [issue("missing_acknowledgement_reason", "Warning acknowledgements need a reason.", issueId)] };
  const issues = review.issues.map((item) => item.id === issueId ? { ...item, acknowledgedAt: new Date().toISOString(), acknowledgementReason: reason } : item);
  await repository.saveIssues(review.context, issues);
  return ok({ ...review, issues });
}

export function resolveReviewIssue(review: SelectionReview, issueId: string): DomainResult<SelectionReview> {
  const target = review.issues.find((item) => item.id === issueId);
  if (!target) return { ok: false, issues: [issue("missing_review_issue", "Choose an existing review issue.", issueId)] };
  if (target.blocking) return { ok: false, issues: [issue("blocking_issue_cannot_be_dismissed", "Blocking issues must be resolved in the underlying data.", issueId)] };
  return ok({ ...review, issues: review.issues.map((item) => item.id === issueId ? { ...item, resolvedAt: new Date().toISOString() } : item) });
}

export async function overrideAllowance(review: SelectionReview, requirementId: string, newAllowanceAmount: number, reason: string, actorId = "builder", repositories: { workspace?: SelectionWorkspaceRepository; review?: SelectionReviewRepository } = {}): Promise<DomainResult<SelectionReview>> {
  const selection = review.workspace.selections.find((item) => item.requirementId === requirementId);
  const requirement = review.workspace.requirements.find((item) => item.id === requirementId);
  if (!selection || !requirement) return { ok: false, issues: [issue("missing_project_selection", "Choose an existing selection before overriding allowance.", requirementId)] };
  if (!reason.trim()) return { ok: false, issues: [issue("missing_allowance_override_reason", "Allowance overrides require a reason.", requirementId)] };
  const previousAllowance = selection.allowance ?? selection.value.allowance ?? money(0);
  const newAllowance = money(newAllowanceAmount, previousAllowance.currency);
  if (newAllowance.amount < 0) return { ok: false, issues: [issue("invalid_allowance", "Allowance cannot be negative.", requirementId)] };
  const pricing = calculateSelectionPricing({ quantity: selection.quantity ?? 1, unitCost: selection.selectedPrice ?? selection.value.clientPrice ?? money(0, newAllowance.currency), allowance: newAllowance, gstRate: 0.1, markupRate: 0 });
  const updatedSelection = { ...selection, allowance: newAllowance, variation: pricing.variation, gst: pricing.tax, revision: selection.revision + 1 };
  const workspaceRepository = repositories.workspace ?? selectionWorkspaceRepository;
  await workspaceRepository.saveSelections(review.context, review.workspace.selections.map((item) => item.id === selection.id ? updatedSelection : item));
  const override: AllowanceOverride = { id: makeScopedId("allowance_override", [review.context.organisationId, review.context.projectId, selection.id, Date.now()]), organisationId: review.context.organisationId, projectId: review.context.projectId, requirementId, selectionId: selection.id, previousAllowance, newAllowance, actorId, reason, createdAt: new Date().toISOString() };
  const audit: ReviewAuditEvent = { id: makeScopedId("review_audit", [review.context.organisationId, review.context.projectId, "allowance", selection.id, Date.now()]), actorId, actorType: "builder", organisationId: review.context.organisationId, projectId: review.context.projectId, entityType: "ProjectSelection", entityId: selection.id, action: "allowance_overridden", timestamp: new Date().toISOString(), previousValueSummary: `${previousAllowance.amount}`, newValueSummary: `${newAllowance.amount}`, reason, correlationId: override.id };
  const reviewRepository = repositories.review ?? selectionReviewRepository;
  await reviewRepository.saveAllowanceOverrides(review.context, [...review.allowanceOverrides, override]);
  await reviewRepository.saveAuditEvents(review.context, [...review.auditEvents, audit]);
  return ok(await loadSelectionReview(review.context, { workspace: workspaceRepository, review: reviewRepository }));
}

export async function recalculateReviewPricing(review: SelectionReview, repository: SelectionReviewRepository = selectionReviewRepository): Promise<SelectionReview> {
  const audit: ReviewAuditEvent = { id: makeScopedId("review_audit", [review.context.organisationId, review.context.projectId, "recalculate", Date.now()]), actorId: "system", actorType: "system", organisationId: review.context.organisationId, projectId: review.context.projectId, entityType: "SelectionReview", entityId: review.context.projectId, action: "pricing_recalculated", timestamp: new Date().toISOString(), correlationId: makeScopedId("correlation", [review.context.projectId, Date.now()]) };
  await repository.saveAuditEvents(review.context, [...review.auditEvents, audit]);
  return loadSelectionReview(review.context, { review: repository });
}

export async function markReadyForApproval(review: SelectionReview, repository: SelectionReviewRepository = selectionReviewRepository): Promise<DomainResult<SelectionReview>> {
  const validation = validateReviewReadiness(review);
  if (!validation.ok) return validation;
  const nextState = await repository.saveReviewState({ ...review.reviewState, readyForApproval: true, status: "ready_for_approval", selectionFingerprint: fingerprint(review.workspace) });
  const audit: ReviewAuditEvent = { id: makeScopedId("review_audit", [review.context.organisationId, review.context.projectId, "ready", Date.now()]), actorId: "builder", actorType: "builder", organisationId: review.context.organisationId, projectId: review.context.projectId, entityType: "SelectionReview", entityId: review.context.projectId, action: "ready_for_approval_achieved", timestamp: new Date().toISOString(), correlationId: nextState.selectionFingerprint };
  await repository.saveAuditEvents(review.context, [...review.auditEvents, audit]);
  return ok({ ...review, reviewState: nextState, status: "ready_for_approval", summary: { ...review.summary, readyForApproval: true }, auditEvents: [...review.auditEvents, audit], statusReasons: [] });
}

export async function revokeReadyForApproval(review: SelectionReview, reason: string, repository: SelectionReviewRepository = selectionReviewRepository): Promise<SelectionReview> {
  const nextState = await repository.saveReviewState({ ...review.reviewState, readyForApproval: false, status: "review_required" });
  const audit: ReviewAuditEvent = { id: makeScopedId("review_audit", [review.context.organisationId, review.context.projectId, "revoked", Date.now()]), actorId: "system", actorType: "system", organisationId: review.context.organisationId, projectId: review.context.projectId, entityType: "SelectionReview", entityId: review.context.projectId, action: "ready_for_approval_revoked", timestamp: new Date().toISOString(), reason, correlationId: nextState.selectionFingerprint };
  await repository.saveAuditEvents(review.context, [...review.auditEvents, audit]);
  return { ...review, reviewState: nextState, status: "review_required", auditEvents: [...review.auditEvents, audit], statusReasons: [reason] };
}

export async function saveSelectionReview(review: SelectionReview, repository: SelectionReviewRepository = selectionReviewRepository): Promise<SelectionReview> {
  const [reviewState, issues, allowanceOverrides, auditEvents] = await Promise.all([repository.saveReviewState(review.reviewState), repository.saveIssues(review.context, review.issues), repository.saveAllowanceOverrides(review.context, review.allowanceOverrides), repository.saveAuditEvents(review.context, review.auditEvents)]);
  return { ...review, reviewState, issues, allowanceOverrides, auditEvents };
}
