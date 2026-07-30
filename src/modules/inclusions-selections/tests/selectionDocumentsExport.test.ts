import fs from "node:fs";
import path from "node:path";
import { loadProjectAreaRegister, saveProjectAreaRegister, setAreaQuantity } from "../services/projectAreaRegisterService";
import { loadTemplateStage, reconcileProjectRequirements, saveTemplateStage } from "../services/templateStageService";
import { createCustomSelection, createProjectSelection, loadSelectionWorkspace, saveWorkspaceDraft, selectProductVariant, type SelectionWorkspaceState } from "../services/selectionWorkspaceService";
import { loadSelectionReview, markReadyForApproval } from "../services/selectionReviewService";
import { createLockedSelectionSnapshot, recordBuilderApproval, recordClientApproval, type ApprovalInput } from "../services/approvalStageService";
import { aggregateEstimateExportLines, buildBuilderInternalSchedule, buildCategorySchedule, buildClientSelectionSchedule, buildEstimateExportPreview, buildRoomSchedule, buildSiteSupervisorSchedule, buildSupplierSchedule, buildTradeSchedule, buildApprovedVariationSummary, createMappingOverride, executeEstimateExport, generateSelectionDocument, inMemoryEstimateExportAdapter, loadDocumentsExportStage, reconcileEstimateExport, retryFailedExportLines, validateEstimateMappings, validateEstimateExport, type SelectionDocumentRenderer } from "../services/documentsExportService";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { InMemorySelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { InMemorySelectionReviewRepository } from "../repositories/selectionReviewRepository";
import { InMemoryApprovalStageRepository } from "../repositories/approvalStageRepository";
import { InMemoryDocumentsExportRepository } from "../repositories/documentsExportRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

function approvalInput(party: "client" | "builder"): ApprovalInput {
  return { approverName: `${party} approver`, approverRole: party, method: "in_app", declaration: `${party} approval declaration`, recordedBy: "builder", recordedByRepresentative: party === "client" };
}

async function completeRequiredSelections(state: SelectionWorkspaceState, adapter: InMemoryProductSelectionCatalogueAdapter) {
  const floor = state.requirements.find((requirement) => requirement.category === "flooring");
  if (floor) {
    state = value(await createProjectSelection(state, floor.id, "product_dev_floor_covering", undefined, adapter), "Product family can be selected.");
    state = value(await selectProductVariant(state, floor.id, "variant_dev_floor_walnut", adapter), "Variant can be selected.");
  }
  for (const requirement of state.requirements.filter((item) => item.required)) {
    if (state.selections.some((selection) => selection.requirementId === requirement.id && selection.selectionStatus === "complete")) continue;
    state = value(createCustomSelection(state, requirement.id, { name: `${requirement.title} Custom`, description: `Export ${requirement.title}`, category: requirement.category, quantity: requirement.quantity || 1, unit: "each", clientPrice: 520, allowance: 450, supplierId: "supplier_dev_fixtures", supplierSku: "STAGE6" }), "Required custom selection should complete.");
  }
  return state;
}

async function seedLockedSnapshot(projectId: string) {
  const context = { organisationId: "org_stage_6", projectId, projectName: "Stage 6 Test", clientName: "Export Client", siteAddress: "6 Export Street" };
  let register = await loadProjectAreaRegister(context);
  register = value(setAreaQuantity(register, "area_type_bedroom", 2), "Bedrooms should generate.");
  register = value(setAreaQuantity(register, "area_type_bathroom", 1), "Bathroom should generate.");
  register = value(setAreaQuantity(register, "area_type_kitchen", 1), "Kitchen should generate.");
  value(await saveProjectAreaRegister(register), "Stage 1 register should save.");
  let templateStage = await loadTemplateStage(context);
  templateStage = value(reconcileProjectRequirements(templateStage), "Stage 2 requirements should generate.");
  value(await saveTemplateStage(templateStage), "Stage 2 requirements should save.");
  const workspaceRepository = new InMemorySelectionWorkspaceRepository();
  const reviewRepository = new InMemorySelectionReviewRepository();
  const approvalRepository = new InMemoryApprovalStageRepository();
  const documentsRepository = new InMemoryDocumentsExportRepository();
  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  let workspace = await loadSelectionWorkspace(context, workspaceRepository);
  workspace = await completeRequiredSelections(workspace, adapter);
  value(await saveWorkspaceDraft(workspace, workspaceRepository), "Workspace saves.");
  let review = await loadSelectionReview(context, { workspace: workspaceRepository, review: reviewRepository, adapter });
  review = value(await markReadyForApproval(review, reviewRepository), "Review ready.");
  let approvalStage = await import("../services/approvalStageService").then((module) => module.loadApprovalStage(context, { workspace: workspaceRepository, review: reviewRepository, approval: approvalRepository }));
  approvalStage = value(await recordClientApproval(approvalStage, approvalInput("client"), approvalRepository), "Client approval saves.");
  approvalStage = value(await recordBuilderApproval(approvalStage, approvalInput("builder"), approvalRepository), "Builder approval saves.");
  approvalStage = value(await createLockedSelectionSnapshot(approvalStage, "builder", approvalRepository), "Snapshot locks.");
  return { context, workspaceRepository, reviewRepository, approvalRepository, documentsRepository, snapshot: approvalStage.snapshots[0], workspace };
}

async function addMappings(stage: Awaited<ReturnType<typeof loadDocumentsExportStage>>, repository: InMemoryDocumentsExportRepository, approvalRepository: InMemoryApprovalStageRepository) {
  for (const line of stage.selectedSnapshot?.lines ?? []) {
    value(await createMappingOverride(stage, line.id, { actorId: "builder", reason: "Stage 6 mapping test.", estimateStage: "Selections", estimateRowMapping: `row_${line.sourceRequirementId}`, costCode: `CC-${line.category}`, tradeMapping: "General Builder", unit: line.unit, aggregationEligible: true }, repository), "Mapping override saves.");
  }
  return loadDocumentsExportStage(stage.context, { snapshotId: stage.selectedSnapshot?.id, documents: repository, approval: approvalRepository });
}

export async function runSelectionDocumentsExportTests(): Promise<void> {
  const seed = await seedLockedSnapshot("project_stage_6_main");
  let stage = await loadDocumentsExportStage(seed.context, { approval: seed.approvalRepository, documents: seed.documentsRepository });
  assert(stage.selectedSnapshot?.id === seed.snapshot.id, "Loads current locked snapshot by default.");
  assert((await loadDocumentsExportStage({ organisationId: "other_org", projectId: seed.context.projectId }, { approval: seed.approvalRepository, documents: seed.documentsRepository })).selectedSnapshot === undefined, "Cross-organisation snapshot is not loaded.");
  assert(validateEstimateMappings(undefined).issues[0].blocking, "Unlocked or missing snapshot is rejected.");

  const client = buildClientSelectionSchedule(seed.snapshot);
  const builder = buildBuilderInternalSchedule(seed.snapshot);
  const site = buildSiteSupervisorSchedule(seed.snapshot);
  const room = buildRoomSchedule(seed.snapshot);
  const category = buildCategorySchedule(seed.snapshot);
  const trade = buildTradeSchedule(seed.snapshot);
  const supplier = buildSupplierSchedule(seed.snapshot);
  const variation = buildApprovedVariationSummary(seed.snapshot);
  assert(client.finalStatusLabel === "Approved Selection Schedule", "Client document is labelled approved.");
  assert(JSON.stringify(client).includes("builderCost") === false, "Client projection excludes builder cost.");
  assert(JSON.stringify(builder).includes("builderCost"), "Builder projection includes internal values.");
  assert(site.sections.some((section) => section.heading.includes("/")), "Site schedule groups by level and area.");
  assert(room.sections.every((section) => section.lines.every((line) => line.sourceSnapshotLineId)), "Room schedule lines trace to snapshot lines.");
  assert(category.sections.some((section) => section.lines.some((line) => line.areaName)), "Category schedule retains ProjectArea identity.");
  assert(trade.sections.length > 0, "Trade schedule groups by trade abstraction.");
  assert(supplier.sections.length > 0, "Supplier schedule groups by supplier.");
  assert(variation.totals.netVariationIncludingGst.amount === seed.snapshot.netVariationIncludingGst.amount, "Variation summary matches snapshot totals.");

  const generated = value(await generateSelectionDocument(stage, "client_selection_schedule", "builder", undefined, seed.documentsRepository), "Client document generates.");
  assert(generated.record.fileName.includes(`v${seed.snapshot.version}`), "Generated file name contains snapshot version.");
  stage = await loadDocumentsExportStage(seed.context, { approval: seed.approvalRepository, documents: seed.documentsRepository });
  const regenerated = value(await generateSelectionDocument(stage, "client_selection_schedule", "builder", undefined, seed.documentsRepository), "Client document regenerates.");
  assert(regenerated.record.documentVersion === 2 && regenerated.record.supersedesDocumentId, "Regeneration increments version and supersedes previous record.");
  const internal = value(await generateSelectionDocument(stage, "builder_internal_schedule", "builder", undefined, seed.documentsRepository), "Internal document generates.");
  assert(internal.record.fileName !== regenerated.record.fileName, "Client and internal files have distinct names.");
  const failingRenderer: SelectionDocumentRenderer = { async render() { throw new Error("Renderer failed."); } };
  assert(!(await generateSelectionDocument(stage, "supplier_schedule", "builder", failingRenderer, seed.documentsRepository)).ok, "Generation failure records reason.");
  const noSnapshotStage = await loadDocumentsExportStage({ organisationId: seed.context.organisationId, projectId: "no_snapshot" }, { documents: seed.documentsRepository });
  assert(!(await generateSelectionDocument(noSnapshotStage, "client_selection_schedule", "builder", undefined, seed.documentsRepository)).ok, "Unlocked drafts cannot generate approved documents.");

  assert(stage.mappingSummary.unmappedLines > 0, "Missing mappings are flagged.");
  stage = await addMappings(stage, seed.documentsRepository, seed.approvalRepository);
  assert(stage.mappingSummary.readyLines === seed.snapshot.lines.length, `Complete mappings are ready: ${JSON.stringify(stage.mappingSummary)}`);
  const firstLine = seed.snapshot.lines[0];
  const originalCostCode = firstLine.costCode;
  value(await createMappingOverride(stage, firstLine.id, { actorId: "builder", reason: "Change cost code.", estimateStage: "Selections", estimateRowMapping: "row_changed", costCode: "CC-CHANGED", tradeMapping: "Plumber", unit: firstLine.unit, aggregationEligible: true }, seed.documentsRepository), "Mapping override with reason saves.");
  assert(seed.snapshot.lines[0].costCode === originalCostCode, "Mapping override does not mutate snapshot line.");
  stage = await loadDocumentsExportStage(seed.context, { approval: seed.approvalRepository, documents: seed.documentsRepository });
  const preview = buildEstimateExportPreview(seed.snapshot, stage.mappingOverrides, []);
  assert(preview.length === seed.snapshot.lines.length && preview.every((line) => line.sourceSnapshotLineIds.length === 1), "Export lines transform from snapshot lines with traceability.");
  assert(preview[0].costCode === "CC-CHANGED", "Mapping override appears in preview.");
  assert(preview[0].productDescription === seed.snapshot.lines[0].productName, "Frozen snapshot product values are used.");
  const aggregation = aggregateEstimateExportLines(preview);
  assert(aggregation.aggregatedLines.every((line) => line.sourceSnapshotLineIds.length >= 1), "Aggregated source IDs remain traceable.");
  assert(validateEstimateExport(stage).ok, "Validated mapped export is ready.");
  const exportResult = value(await executeEstimateExport(stage, "builder", inMemoryEstimateExportAdapter, seed.documentsRepository), "Locked snapshot exports.");
  assert(exportResult.lines.every((line) => line.status === "completed"), "Successful lines complete.");
  assert(exportResult.reconciliation.status === "reconciled", "Matching totals reconcile.");
  stage = await loadDocumentsExportStage(seed.context, { approval: seed.approvalRepository, documents: seed.documentsRepository });
  assert(!validateEstimateExport(stage).ok, "Duplicate completed export is blocked.");
  assert(!(await retryFailedExportLines(stage, "builder", inMemoryEstimateExportAdapter, seed.documentsRepository)).ok, "Retry requires failed lines.");

  const failedSeed = await seedLockedSnapshot("project_stage_6_failed");
  let failedStage = await loadDocumentsExportStage(failedSeed.context, { approval: failedSeed.approvalRepository, documents: failedSeed.documentsRepository });
  failedStage = await addMappings(failedStage, failedSeed.documentsRepository, failedSeed.approvalRepository);
  inMemoryEstimateExportAdapter.failNextLineIds.add(failedStage.aggregation.aggregatedLines[0].id);
  const partial = value(await executeEstimateExport(failedStage, "builder", inMemoryEstimateExportAdapter, failedSeed.documentsRepository), "Partial export records.");
  assert(partial.batch.status !== "completed" && partial.lines.some((line) => line.status === "failed"), "Partial batch is not completed and failed line records error.");
  failedStage = await loadDocumentsExportStage(failedSeed.context, { approval: failedSeed.approvalRepository, documents: failedSeed.documentsRepository });
  const retry = value(await retryFailedExportLines(failedStage, "builder", inMemoryEstimateExportAdapter, failedSeed.documentsRepository), "Failed lines retry.");
  assert(retry.lines.every((line) => line.status === "completed"), "Retry sends failed lines only.");
  const history = await failedSeed.documentsRepository.listExportBatches(failedSeed.context);
  assert(history.length >= 2, "Export history reloads.");
  const badReconciliation = reconcileEstimateExport(failedSeed.snapshot, partial.batch, partial.lines.slice(1));
  assert(badReconciliation.status === "reconciliation_failed", "Source-line count mismatch fails reconciliation.");

  const routeSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "documents-export.tsx"), "utf8");
  const procurementSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "procurement.tsx"), "utf8");
  assert(routeSource.includes("Approved Documents and Estimate Export"), "Documents route title is present.");
  assert(routeSource.includes("Generate approved selection schedules from the locked version and transfer validated selection costs into the Estimate Builder."), "Documents route intro is exact.");
  assert(routeSource.includes("/inclusions-selections/approvals") && routeSource.includes("/inclusions-selections/procurement"), "Back and continue navigation are present.");
  assert(procurementSource.includes("Supplier ordering, procurement tracking and purchase schedules will be completed in a future stage."), "Procurement placeholder text is exact.");
  assert(!routeSource.includes("EstimateBuilderWorkbook") && !routeSource.includes("purchase order"), "No workbook internals or procurement code loads.");
  assert(routeSource.includes("@media (max-width: 760px)") && routeSource.includes("@media print"), "Responsive and print preview styles are present.");
}

runSelectionDocumentsExportTests();
