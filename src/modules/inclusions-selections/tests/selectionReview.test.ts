import fs from "node:fs";
import path from "node:path";
import { saveProjectAreaRegister, setAreaQuantity, loadProjectAreaRegister } from "../services/projectAreaRegisterService";
import { loadTemplateStage, reconcileProjectRequirements, saveTemplateStage } from "../services/templateStageService";
import { createCustomSelection, createProjectSelection, saveWorkspaceDraft, selectProductVariant, type SelectionWorkspaceState } from "../services/selectionWorkspaceService";
import {
  acknowledgeReviewWarning,
  buildBuilderInternalProjection,
  buildClientVariationProjection,
  calculateCategoryReview,
  calculateRoomReview,
  calculateVariationSummary,
  loadSelectionReview,
  markReadyForApproval,
  overrideAllowance,
  validateReviewReadiness,
} from "../services/selectionReviewService";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { InMemorySelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { InMemorySelectionReviewRepository } from "../repositories/selectionReviewRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

async function seedReviewWorkspace() {
  const context = { organisationId: "org_stage_4", projectId: "project_stage_4", projectName: "Stage 4 Test", clientName: "Test Client", siteAddress: "1 Review Street" };
  let register = await loadProjectAreaRegister(context);
  register = value(setAreaQuantity(register, "area_type_bedroom", 2), "Bedrooms should generate.");
  register = value(setAreaQuantity(register, "area_type_bathroom", 1), "Bathroom should generate.");
  register = value(setAreaQuantity(register, "area_type_ensuite", 1), "Ensuite should generate.");
  register = value(setAreaQuantity(register, "area_type_kitchen", 1), "Kitchen should generate.");
  value(await saveProjectAreaRegister(register), "Stage 1 register should save.");
  let templateStage = await loadTemplateStage(context);
  templateStage = value(reconcileProjectRequirements(templateStage), "Stage 2 requirements should generate.");
  value(await saveTemplateStage(templateStage), "Stage 2 requirements should save.");
  const workspaceRepository = new InMemorySelectionWorkspaceRepository();
  const reviewRepository = new InMemorySelectionReviewRepository();
  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  let workspace = await import("../services/selectionWorkspaceService").then((module) => module.loadSelectionWorkspace(context, workspaceRepository));
  return { context, workspaceRepository, reviewRepository, adapter, workspace };
}

async function completeRequiredSelections(state: SelectionWorkspaceState, adapter: InMemoryProductSelectionCatalogueAdapter) {
  const floor = state.requirements.find((requirement) => requirement.category === "flooring");
  if (floor) {
    state = value(await createProjectSelection(state, floor.id, "product_dev_floor_covering", undefined, adapter), "Product family can be selected.");
    state = value(await selectProductVariant(state, floor.id, "variant_dev_floor_walnut", adapter), "Variant can be selected.");
  }
  for (const requirement of state.requirements.filter((item) => item.required)) {
    if (state.selections.some((selection) => selection.requirementId === requirement.id && selection.selectionStatus === "complete")) continue;
    state = value(createCustomSelection(state, requirement.id, { name: `${requirement.title} Custom`, description: `Reviewed ${requirement.title}`, category: requirement.category, quantity: requirement.quantity || 1, unit: "each", clientPrice: 500, allowance: 450, supplierId: "supplier_dev_fixtures", supplierSku: "STAGE4" }), "Required custom selection should complete.");
  }
  return state;
}

export async function runSelectionReviewTests(): Promise<void> {
  const seeded = await seedReviewWorkspace();
  let incompleteReview = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  assert(incompleteReview.workspace.requirements.length > 0, "Review loads Stage 3 requirements.");
  assert(incompleteReview.workspace.selections.length === 0, "Selection records are not duplicated during review loading.");
  assert((await loadSelectionReview({ organisationId: "other_org", projectId: seeded.context.projectId }, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository })).workspace.requirements.length === 0, "Cross-organisation data is not loaded.");
  assert(incompleteReview.issues.some((item) => item.code === "unresolved_required_selection" && item.blocking), "Missing selection creates blocking issue.");
  assert(!validateReviewReadiness(incompleteReview).ok, "Incomplete required selections prevent readiness.");

  seeded.workspace = await completeRequiredSelections(seeded.workspace, seeded.adapter);
  const firstSelection = seeded.workspace.selections[0];
  seeded.workspace = { ...seeded.workspace, selections: seeded.workspace.selections.map((selection, index) => index === 1 ? { ...selection, value: { ...selection.value, pricingStatus: "provisional" as const } } : selection) };
  value(await saveWorkspaceDraft(seeded.workspace, seeded.workspaceRepository), "Stage 3 selections save for review.");
  let review = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  assert(review.workspace.selections.length === seeded.workspace.selections.length, "Review loads Stage 3 selections and locations.");
  assert(review.summary.completedRequirements >= seeded.workspace.requirements.filter((requirement) => requirement.required).length, "Completed count is accurate.");
  assert(review.summary.incompleteRequiredRequirements === 0, "Incomplete required count is accurate.");
  assert(review.summary.customSelections > 0, "Custom-selection count is accurate.");
  assert(review.summary.totalIncludedAllowance.amount > 0, "Total allowance is accurate.");
  assert(review.summary.totalSelectedValue.amount > 0, "Total selected value is accurate.");
  assert(review.summary.totalUpgrades.amount > 0, "Total upgrades are accurate.");
  assert(review.summary.netDraftVariation.amount === review.summary.totalSelectedValue.amount - review.summary.totalIncludedAllowance.amount, "Net variation is accurate.");
  assert(review.summary.gstAmount.amount > 0, "GST is accurate.");

  const rooms = calculateRoomReview(review);
  assert(rooms.some((group) => group.rooms.some((room) => room.lines.length > 0 && room.issueCount >= 0)), "Room requirements display with issue counts.");
  assert(rooms.every((group) => group.rooms.every((room) => room.area.name && room.area.areaTypeId)), "Review does not alter area structure.");
  const categories = calculateCategoryReview(review);
  assert(categories.some((category) => category.lines.some((line) => line.area.id && line.requirement.id)), "Category room identity remains traceable.");
  assert(categories.reduce((count, category) => count + category.totalRequirements, 0) === review.workspace.requirements.length, "No category-only selection records are created.");

  const variation = calculateVariationSummary(review);
  assert(variation.upgrades.length > 0, "Upgrade is calculated correctly.");
  assert(variation.netIncludingGst.amount === variation.netExcludingGst.amount + variation.gst.amount, "GST-inclusive values are handled.");
  assert(variation.provisionalPrices.length > 0, "Provisional price is flagged.");
  const clientProjection = buildClientVariationProjection(review);
  assert(clientProjection.warning === "Draft only - not approved or contractual.", "Client preview displays draft warning.");
  assert(JSON.stringify(clientProjection).includes("builderCost") === false, "Client projection excludes builder cost.");
  const builderProjection = buildBuilderInternalProjection(review);
  assert(builderProjection.label === "Internal Builder View" && JSON.stringify(builderProjection).includes("builderCost"), "Builder projection includes permitted internal values.");

  const warning = review.issues.find((item) => !item.blocking);
  if (warning) {
    const acknowledged = value(await acknowledgeReviewWarning(review, warning.id, "Accepted for review testing.", seeded.reviewRepository), "Warning can be acknowledged with reason.");
    assert(acknowledged.issues.find((item) => item.id === warning.id)?.acknowledgedAt, "Warning acknowledgement reload data is present.");
    review = acknowledged;
  }
  const blocking = review.issues.find((item) => item.blocking);
  if (blocking) assert(!(await acknowledgeReviewWarning(review, blocking.id, "Nope.", seeded.reviewRepository)).ok, "Blocking issue cannot be dismissed.");

  const overridden = value(await overrideAllowance(review, firstSelection.requirementId, 300, "Testing allowance override.", "builder_test", { workspace: seeded.workspaceRepository, review: seeded.reviewRepository }), "Allowance override recalculates variation.");
  assert(overridden.allowanceOverrides.length === 1, "Allowance override records reason.");
  assert(overridden.auditEvents.some((event) => event.action === "allowance_overridden"), "Allowance override creates audit event.");
  review = overridden;

  let readyReview = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  readyReview = { ...readyReview, issues: readyReview.issues.filter((item) => !item.blocking) };
  const ready = value(await markReadyForApproval(readyReview, seeded.reviewRepository), "Valid project can be marked Ready for Approval.");
  assert(ready.reviewState.readyForApproval && ready.status === "ready_for_approval", "Ready for Approval is not final approval.");
  assert(!ready.auditEvents.some((event) => event.action.includes("snapshot")), "No snapshot is created.");
  const reloadedReady = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  assert(reloadedReady.reviewState.readyForApproval, "Ready for Approval state reloads.");
  seeded.workspace = { ...seeded.workspace, selections: seeded.workspace.selections.map((selection, index) => index === 0 ? { ...selection, revision: selection.revision + 1 } : selection) };
  value(await saveWorkspaceDraft(seeded.workspace, seeded.workspaceRepository), "Later Stage 3 change saves.");
  const stale = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  assert(!stale.reviewState.readyForApproval && stale.statusReasons.some((reason) => reason.includes("stale")), "Later Stage 3 change revokes or stales readiness.");

  const reviewSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "review.tsx"), "utf8");
  const approvalsSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "approvals.tsx"), "utf8");
  assert(reviewSource.includes("Review Selections and Variations"), "Review route title is present.");
  assert(reviewSource.includes("/inclusions-selections/workspace"), "Back to Workspace works.");
  assert(reviewSource.includes("/inclusions-selections/approvals"), "Ready project reaches approvals stage.");
  assert(approvalsSource.includes("Approvals and Locked Selection Version"), "Approvals route should now be the Stage 5 approval workspace.");
  assert(reviewSource.includes("@media (max-width: 760px)") && reviewSource.includes("reviewRow"), "Mobile review rows become readable cards.");
  assert(!reviewSource.includes("createSelectionSnapshot") && !reviewSource.includes("Estimate Builder") && !reviewSource.includes("SelectionApproval"), "No approval, snapshot or Estimate Builder code loads.");
}

runSelectionReviewTests();
