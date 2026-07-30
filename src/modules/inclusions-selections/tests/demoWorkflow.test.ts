import fs from "node:fs";
import path from "node:path";
import { DEMO_PROJECT_CONTEXT, loadDemonstrationProject, resetDemonstrationProject } from "../demo/demoProject";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { projectAreaRegisterRepository } from "../repositories/projectAreaRegisterRepository";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { loadApprovalStage } from "../services/approvalStageService";
import { buildClientVariationProjection, calculateVariationSummary, loadSelectionReview } from "../services/selectionReviewService";
import { loadSelectionWorkspace, previewApplyTo } from "../services/selectionWorkspaceService";
import { loadTemplateStage } from "../services/templateStageService";
import { hrefForStage } from "../routing/stageNavigation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function byAreaAndTitle(workspace: Awaited<ReturnType<typeof loadSelectionWorkspace>>, areaName: string, title: string) {
  const area = workspace.templateStage.areaRegister.areas.find((item) => item.name === areaName);
  return workspace.requirements.find((item) => item.areaId === area?.id && item.title.toLowerCase().includes(title.toLowerCase()));
}

export async function runDemoWorkflowTests(): Promise<void> {
  const context = await loadDemonstrationProject({ approvalState: "pending", reset: true });
  assert(context.projectName === "Johnson Residence", "Demo project context should be Johnson Residence.");

  const register = await projectAreaRegisterRepository.load(DEMO_PROJECT_CONTEXT);
  assert(register?.areas.length === 23, "Stage 1 should receive the Johnson Residence demo areas.");
  assert(register.areas.some((area) => area.name === "Kitchen"), "Kitchen area should be present.");
  assert(register.areas.some((area) => area.name === "Bedroom 4"), "Bedroom 4 area should be present.");

  await loadDemonstrationProject({ approvalState: "pending", reset: false });
  const idempotentRegister = await projectAreaRegisterRepository.load(DEMO_PROJECT_CONTEXT);
  assert(idempotentRegister?.areas.length === 23, "Demo loader should be idempotent and not duplicate rooms.");

  const templateStage = await loadTemplateStage(DEMO_PROJECT_CONTEXT);
  assert(templateStage.configuration.projectDefault.tierId === "tier_premier", "Stage 2 should set the Premier whole-project tier.");
  assert(templateStage.configuration.groupOverrides.some((item) => item.groupId === "area_group_kitchen_areas" && item.tierId === "tier_premium"), "Stage 2 should include kitchen tier/template assignments.");
  assert(templateStage.requirements.length > 200, "Stage 2 should generate realistic requirement counts.");

  const workspace = await loadSelectionWorkspace(DEMO_PROJECT_CONTEXT);
  assert(workspace.selections.length >= 20, "Stage 3 should receive demonstration selections.");
  assert(workspace.locations.length === workspace.selections.length, "Stage 3 should receive physical selection locations.");
  assert(workspace.attachments.length > 0, "Stage 3 should include product placeholder attachments.");
  assert(workspace.selections.some((selection) => selection.value.note?.includes("Demonstration product and indicative price")), "Demo products must be labelled as indicative demo pricing.");

  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  const kitchenMixer = byAreaAndTitle(workspace, "Kitchen", "Sink Mixer");
  assert(kitchenMixer, "Kitchen sink mixer requirement should exist.");
  const kitchenProducts = await adapter.searchCompatibleProducts(kitchenMixer);
  assert(kitchenProducts.some((product) => product.name === "Phoenix Vivid Slimline Sink Mixer"), "Stage 3 should expose realistic kitchen tapware products.");

  const ensuiteBasinMixer = byAreaAndTitle(workspace, "Ensuite", "Basin Mixer");
  assert(ensuiteBasinMixer, "Ensuite basin mixer source requirement should exist.");
  const applyPreview = await previewApplyTo(workspace, ensuiteBasinMixer.id, "every_compatible_requirement", [], adapter);
  const compatibleNames = applyPreview.compatibleTargets.map((target) => target.projectAreaName).sort();
  assert(compatibleNames.includes("Main Bathroom") && compatibleNames.includes("Powder Room"), "Apply To demo should find compatible basin mixer locations.");
  assert(applyPreview.incompatibleTargets.some((target) => target.requirementName.includes("Shower Mixer")), "Apply To demo should show incompatible shower mixers.");
  assert(applyPreview.skippedTargets.some((target) => target.projectAreaName === "Ensuite"), "Apply To demo should skip the already-selected source location.");

  const review = await loadSelectionReview(DEMO_PROJECT_CONTEXT);
  assert(review.summary.totalRequirements > 200, "Stage 4 should show a realistic total requirement count.");
  assert(review.issues.some((issue) => issue.code === "missing_client_price"), "Stage 4 should include a missing appliance price issue.");
  assert(review.issues.some((issue) => issue.code === "unavailable_product"), "Stage 4 should include an unavailable product issue.");
  assert(review.issues.some((issue) => issue.code === "missing_variant"), "Stage 4 should include a required variant missing issue.");
  assert(review.issues.some((issue) => issue.code === "missing_supplier"), "Stage 4 should include a custom selection supplier warning.");
  assert(review.issues.some((issue) => issue.code === "required_item_not_applicable" || issue.code === "missing_not_applicable_reason"), "Stage 4 should include a Not Applicable review issue.");
  const variation = calculateVariationSummary(review);
  const lineTotal = review.lines.reduce((total, line) => total + line.variation.amount, 0);
  assert(Math.abs(variation.netExcludingGst.amount - lineTotal) < 0.01, "Project variation total should equal summed room-level variation lines.");
  assert(variation.totalUpgrades.amount > 0 && variation.totalCredits.amount < 0, "Demo pricing should include upgrades and credits.");
  const clientProjection = buildClientVariationProjection(review);
  assert(!JSON.stringify(clientProjection).includes("builderCost"), "Client views must exclude builder cost.");

  let approvalStage = await loadApprovalStage(DEMO_PROJECT_CONTEXT);
  assert(approvalStage.status === "prepared", "Stage 5 pending demo should show approvals pending/prepared.");
  assert(approvalStage.history.some((item) => item.eventType === "demo_pending_approval_loaded"), "Stage 5 should include pending demo history.");

  await loadDemonstrationProject({ approvalState: "approved", reset: true });
  approvalStage = await loadApprovalStage(DEMO_PROJECT_CONTEXT);
  assert(approvalStage.status === "fully_approved", "Fully approved demo should load current client and builder approvals.");
  assert(approvalStage.readiness.ready, "Fully approved demo should be ready to create a locked demonstration snapshot.");

  await resetDemonstrationProject();
  approvalStage = await loadApprovalStage(DEMO_PROJECT_CONTEXT);
  assert(approvalStage.approvals.length === 0 && approvalStage.snapshots.length === 0, "Demo reset should clear approvals and snapshots.");

  const reloadedWorkspace = await loadSelectionWorkspace(DEMO_PROJECT_CONTEXT, selectionWorkspaceRepository);
  assert(reloadedWorkspace.selections.length >= 20, "Demo state should survive route-style reloads through shared development persistence.");
  const href = hrefForStage("workspace", DEMO_PROJECT_CONTEXT);
  assert(href.includes("projectId=project_johnson_residence") && href.includes("projectName=Johnson+Residence"), "Navigation should preserve demo project context.");

  const areasPage = source("pages", "inclusions-selections", "areas.tsx");
  const approvalsPage = source("pages", "inclusions-selections", "approvals.tsx");
  const workspacePage = source("pages", "inclusions-selections", "workspace.tsx");
  assert(areasPage.includes("Load Demonstration Project") && areasPage.includes("Reset Demonstration Project"), "Stage 1 should expose demo load/reset actions.");
  assert(approvalsPage.includes("Load Pending Approval Demo") && approvalsPage.includes("Load Fully Approved Demo"), "Stage 5 should expose approval demo actions.");
  assert(workspacePage.includes("@media (max-width: 760px)"), "Stage 3 should retain mobile layout coverage.");
}

runDemoWorkflowTests();
