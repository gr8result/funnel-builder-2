import fs from "node:fs";
import path from "node:path";
import { saveProjectAreaRegister, setAreaQuantity, loadProjectAreaRegister } from "../services/projectAreaRegisterService";
import { loadTemplateStage, reconcileProjectRequirements, saveTemplateStage } from "../services/templateStageService";
import { createCustomSelection, createProjectSelection, loadSelectionWorkspace, saveWorkspaceDraft, selectProductVariant, type SelectionWorkspaceState } from "../services/selectionWorkspaceService";
import { loadSelectionReview, markReadyForApproval, type SelectionReview } from "../services/selectionReviewService";
import { calculateApprovalFingerprint, compareSelectionSnapshots, createLockedSelectionSnapshot, loadApprovalStage, prepareClientReview, recordApprovalStageStatus, recordBuilderApproval, recordClientApproval, recordClientChangesRequested, revokeBuilderApproval, revokeClientApproval, saveApprovalStage, startNewDraftRevision, type ApprovalInput } from "../services/approvalStageService";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { InMemorySelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { InMemorySelectionReviewRepository } from "../repositories/selectionReviewRepository";
import { InMemoryApprovalStageRepository, type ApprovalStageRepository } from "../repositories/approvalStageRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

function approvalInput(party: "client" | "builder"): ApprovalInput {
  return {
    approverName: party === "client" ? "Client Approver" : "Builder Approver",
    approverRole: party === "client" ? "Owner" : "Construction Manager",
    method: "in_app",
    declaration: party === "client" ? "I approve the selections shown for this approval version." : "I approve the builder review for this approval version.",
    comments: `${party} approval test`,
    recordedBy: party === "client" ? "builder_rep" : "builder_manager",
    recordedByRepresentative: party === "client",
  };
}

async function completeRequiredSelections(state: SelectionWorkspaceState, adapter: InMemoryProductSelectionCatalogueAdapter) {
  const floor = state.requirements.find((requirement) => requirement.category === "flooring");
  if (floor) {
    state = value(await createProjectSelection(state, floor.id, "product_dev_floor_covering", undefined, adapter), "Product family can be selected.");
    state = value(await selectProductVariant(state, floor.id, "variant_dev_floor_walnut", adapter), "Variant can be selected.");
  }
  for (const requirement of state.requirements.filter((item) => item.required)) {
    if (state.selections.some((selection) => selection.requirementId === requirement.id && selection.selectionStatus === "complete")) continue;
    state = value(createCustomSelection(state, requirement.id, { name: `${requirement.title} Custom`, description: `Approved ${requirement.title}`, category: requirement.category, quantity: requirement.quantity || 1, unit: "each", clientPrice: 520, allowance: 450, supplierId: "supplier_dev_fixtures", supplierSku: "STAGE5" }), "Required custom selection should complete.");
  }
  return state;
}

async function seedApprovalStage(projectId: string) {
  const context = { organisationId: "org_stage_5", projectId, projectName: "Stage 5 Test", clientName: "Test Client", siteAddress: "5 Approval Street" };
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
  const approvalRepository = new InMemoryApprovalStageRepository();
  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  let workspace = await loadSelectionWorkspace(context, workspaceRepository);
  workspace = await completeRequiredSelections(workspace, adapter);
  value(await saveWorkspaceDraft(workspace, workspaceRepository), "Stage 3 selections save.");
  let review = await loadSelectionReview(context, { workspace: workspaceRepository, review: reviewRepository, adapter });
  review = value(await markReadyForApproval(review, reviewRepository), "Review can be marked Ready for Approval.");
  const stage = await loadApprovalStage(context, { workspace: workspaceRepository, review: reviewRepository, approval: approvalRepository });
  return { context, workspaceRepository, reviewRepository, approvalRepository, adapter, workspace, review, stage };
}

function withChangedSelection(review: SelectionReview, changes: Record<string, unknown>) {
  return { ...review, workspace: { ...review.workspace, selections: review.workspace.selections.map((selection, index) => index === 0 ? { ...selection, ...changes } : selection) } };
}

export async function runSelectionApprovalStageTests(): Promise<void> {
  const incomplete = await seedApprovalStage("project_stage_5_incomplete");
  const emptyApprovalRepository = new InMemoryApprovalStageRepository();
  const emptyStage = await loadApprovalStage({ organisationId: incomplete.context.organisationId, projectId: "missing_project" }, { approval: emptyApprovalRepository });
  assert(!value(await recordClientApproval(incomplete.stage, approvalInput("client"), incomplete.approvalRepository), "Ready stage should accept client approval.").readiness.ready, "Snapshot still requires builder approval.");
  assert(!(await recordClientApproval(emptyStage, approvalInput("client"), emptyApprovalRepository)).ok, "Stage 4 Ready for Approval is required before client approval.");
  assert(!emptyStage.readiness.ready && emptyStage.readiness.reasons.length > 0, "Incomplete stage cannot lock.");

  const seeded = await seedApprovalStage("project_stage_5_main");
  let stage = seeded.stage;
  assert(calculateApprovalFingerprint(seeded.review) === calculateApprovalFingerprint({ ...seeded.review, reviewState: { ...seeded.review.reviewState, selectedView: "issues" } }), "UI filter/view state does not change approval fingerprint.");
  const reloadedStage = await loadApprovalStage(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, approval: seeded.approvalRepository });
  assert(stage.currentFingerprint === reloadedStage.currentFingerprint, "Identical material data produces identical approval fingerprint.");
  assert(calculateApprovalFingerprint(withChangedSelection(seeded.review, { quantity: seeded.review.workspace.selections[0].quantity + 1 })) !== stage.currentFingerprint, "Quantity changes approval fingerprint.");
  assert(calculateApprovalFingerprint(withChangedSelection(seeded.review, { selectedPrice: { amount: 900, currency: "AUD" } })) !== stage.currentFingerprint, "Price changes approval fingerprint.");
  assert(calculateApprovalFingerprint(withChangedSelection(seeded.review, { allowance: { amount: 300, currency: "AUD" } })) !== stage.currentFingerprint, "Allowance changes approval fingerprint.");
  assert(calculateApprovalFingerprint({ ...seeded.review, workspace: { ...seeded.review.workspace, notes: [{ id: "client_note", organisationId: seeded.context.organisationId, projectId: seeded.context.projectId, requirementId: seeded.review.workspace.requirements[0].id, kind: "client_visible", text: "Client-facing note", createdAt: "2026-01-01T00:00:00.000Z" }] } }) !== stage.currentFingerprint, "Client-visible note changes approval fingerprint.");

  stage = await prepareClientReview(stage, seeded.approvalRepository);
  stage = await recordApprovalStageStatus(stage, "sent_for_review", "builder_user", "builder", seeded.approvalRepository);
  stage = await recordApprovalStageStatus(stage, "client_reviewing", "client_user", "client", seeded.approvalRepository);
  assert(stage.status === "client_reviewing", "Client review sent/reviewing statuses are recorded.");
  assert(!(await recordClientApproval(stage, { ...approvalInput("client"), approverName: "" }, seeded.approvalRepository)).ok, "Client approver details are required.");
  stage = value(await recordClientApproval(stage, approvalInput("client"), seeded.approvalRepository), "Client approval should save.");
  assert(stage.approvals.some((approval) => approval.party === "client" && approval.recordedByRepresentative), "Builder-entered client approvals are marked as representative entries.");
  assert(JSON.stringify(stage.clientProjection).includes("builderCost") === false, "Client approval package excludes builder costs.");
  assert(!(await recordBuilderApproval(stage, { ...approvalInput("builder"), approverRole: "" }, seeded.approvalRepository)).ok, "Builder approver details are required.");
  stage = value(await recordBuilderApproval(stage, approvalInput("builder"), seeded.approvalRepository), "Builder approval should save.");
  assert(stage.status === "fully_approved" && stage.readiness.ready, "Matching current client and builder approvals are ready to lock.");
  stage = value(await createLockedSelectionSnapshot(stage, "builder_manager", seeded.approvalRepository), "Locked snapshot should be created.");
  assert(stage.status === "locked" && stage.snapshots[0].version === 1, "Snapshot version 1 locks.");
  assert(stage.snapshots[0].lines.length === stage.review.lines.length, "Snapshot freezes all review lines.");
  await saveApprovalStage(stage, seeded.approvalRepository);
  let mutationBlocked = false;
  try {
    await (seeded.approvalRepository as ApprovalStageRepository).updateSnapshot(seeded.context, stage.snapshots[0]);
  } catch (error) {
    mutationBlocked = error instanceof Error && error.message === "attempted_snapshot_mutation";
  }
  assert(mutationBlocked, "Locked snapshots cannot be mutated.");
}

runSelectionApprovalStageTests().then(async () => {
  const seeded = await seedApprovalStage("project_stage_5_versions");
  let stage = value(await recordClientApproval(seeded.stage, approvalInput("client"), seeded.approvalRepository), "Client approval should save.");
  stage = value(await recordBuilderApproval(stage, approvalInput("builder"), seeded.approvalRepository), "Builder approval should save.");
  stage = value(await createLockedSelectionSnapshot(stage, "builder_manager", seeded.approvalRepository), "Version 1 should lock.");
  const versionOne = stage.snapshots[0];
  const frozenName = versionOne.lines[0].productName;
  seeded.workspace = { ...seeded.workspace, selections: seeded.workspace.selections.map((selection, index) => index === 0 ? { ...selection, quantity: selection.quantity + 1, revision: selection.revision + 1, selectedPrice: { amount: (selection.selectedPrice?.amount ?? 0) + 120, currency: "AUD" }, variation: { amount: (selection.variation?.amount ?? 0) + 120, currency: "AUD" } } : selection) };
  value(await saveWorkspaceDraft(seeded.workspace, seeded.workspaceRepository), "Stage 3 changed selection saves.");
  let review = await loadSelectionReview(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, adapter: seeded.adapter });
  assert(!review.reviewState.readyForApproval, "Material Stage 3 change revokes Stage 4 readiness.");
  review = value(await markReadyForApproval({ ...review, issues: review.issues.filter((item) => !item.blocking) }, seeded.reviewRepository), "Changed review can be marked ready again.");
  stage = await loadApprovalStage(seeded.context, { workspace: seeded.workspaceRepository, review: seeded.reviewRepository, approval: seeded.approvalRepository });
  assert(stage.staleWarnings.length > 0 && stage.status === "approval_stale", "Previously approved records are stale after material changes.");
  assert(!stage.readiness.ready, "Stale approvals block snapshot creation.");
  stage = value(await recordClientApproval(stage, approvalInput("client"), seeded.approvalRepository), "Changed client approval should save.");
  stage = value(await recordBuilderApproval(stage, approvalInput("builder"), seeded.approvalRepository), "Changed builder approval should save.");
  stage = value(await createLockedSelectionSnapshot(stage, "builder_manager", seeded.approvalRepository), "Version 2 should lock.");
  const versionTwo = [...stage.snapshots].sort((a, b) => b.version - a.version)[0];
  assert(versionTwo.version === 2 && versionTwo.supersedesSnapshotId === versionOne.id, "Version 2 supersedes version 1.");
  assert(versionOne.lines[0].productName === frozenName, "Version 1 remains readable and unchanged after later edits.");
  const comparison = compareSelectionSnapshots(versionOne, versionTwo);
  assert(comparison.some((change) => change.changeType === "quantity_changed" || change.changeType === "price_changed"), "Snapshot comparison reports material differences.");
  assert((await seeded.approvalRepository.listSnapshots(seeded.context)).length === 2, "Both locked snapshot versions remain stored.");
  await startNewDraftRevision(stage, "builder_manager", seeded.approvalRepository);
  assert((await seeded.approvalRepository.listDraftRevisions(seeded.context)).length === 1, "New editable draft revision starts from locked snapshot.");

  const changesStage = await recordClientChangesRequested(stage, "Please revise selections.", undefined, { approval: seeded.approvalRepository, review: seeded.reviewRepository });
  assert(changesStage.status === "changes_requested" && !changesStage.review.reviewState.readyForApproval, "Changes requested invalidates approvals and revokes Stage 4 readiness.");
  const builderFirstSeed = await seedApprovalStage("project_stage_5_builder_first");
  let builderFirst = value(await recordBuilderApproval(builderFirstSeed.stage, approvalInput("builder"), builderFirstSeed.approvalRepository), "Builder can approve before client.");
  assert(builderFirst.status === "builder_approved" && !builderFirst.readiness.ready, "Builder-first approval still requires current client approval before locking.");
  builderFirst = await revokeBuilderApproval(builderFirst, "Testing revoke.", builderFirstSeed.approvalRepository);
  assert(builderFirst.approvals.some((approval) => approval.party === "builder" && approval.status === "revoked"), "Builder approval revocation is recorded.");
  const clientOnly = value(await recordClientApproval(builderFirstSeed.stage, approvalInput("client"), builderFirstSeed.approvalRepository), "Client can approve.");
  const revokedClient = await revokeClientApproval(clientOnly, "Testing client revoke.", builderFirstSeed.approvalRepository);
  assert(revokedClient.approvals.some((approval) => approval.party === "client" && approval.status === "revoked"), "Client approval revocation is recorded.");

  const approvalsSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "approvals.tsx"), "utf8");
  const documentsSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "documents-export.tsx"), "utf8");
  const actionsSource = fs.readFileSync(path.join(process.cwd(), "src", "modules", "inclusions-selections", "components", "ApprovalStageActions.tsx"), "utf8");
  assert(approvalsSource.includes("Approvals and Locked Selection Version"), "Stage 5 approvals route title is present.");
  assert(approvalsSource.includes("Review and approve the completed selections. Client and builder approvals must match the same reviewed version before the selections can be locked."), "Stage 5 intro text is exact.");
  assert(actionsSource.includes("Back to Review") && approvalsSource.includes("/inclusions-selections/documents-export"), "Approval route has back and next navigation.");
  assert(documentsSource.includes("Approved Documents and Estimate Export"), "Documents/export route should now be the Stage 6 workspace.");
  assert(!approvalsSource.includes("createEstimateSelectionExport") && !approvalsSource.includes("procurement"), "Stage 5 route does not load final document, export or procurement code.");
});
