import fs from "node:fs";
import path from "node:path";
import {
  INCLUSIONS_SELECTIONS_STAGES,
  PROJECT_REQUIRED_MESSAGE,
  hrefForStage,
  queryForContext,
  stageIndex,
} from "../routing/stageNavigation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

export async function runModuleNavigationTests(): Promise<void> {
  const constructionHub = source("pages", "modules", "construction", "index.js");
  assert(constructionHub.includes('title="Inclusions & Selections"'), "Construction Hub should expose the active module title.");
  assert(constructionHub.includes('href="/inclusions-selections/areas"'), "Construction Hub should open the new Areas route.");
  assert(!constructionHub.includes("Inclusions & Selections — Rebuilding"), "Construction Hub must not show the retired rebuilding placeholder.");
  assert(!constructionHub.includes('action="Unavailable"'), "Construction Hub module card must not be disabled.");
  assert(!constructionHub.includes("/modules/builders/client-selections") && !constructionHub.includes("/modules/builders/selections-book"), "Construction Hub must not link to retired selections routes.");

  const context = {
    organisationId: "org_nav",
    projectId: "project_nav",
    projectName: "Navigation Test",
    clientName: "Client One",
    siteAddress: "1 Test Street",
    jobNumber: "JOB-1",
  };
  const query = queryForContext(context);
  assert(query.organisationId === context.organisationId && query.projectId === context.projectId, "Query helper should include required project scope.");
  assert(query.clientName === context.clientName && query.siteAddress === context.siteAddress && query.jobNumber === context.jobNumber, "Query helper should preserve project metadata.");
  assert(hrefForStage("review", context).includes("clientName=Client+One"), "Stage links should retain client context.");
  assert(stageIndex("areas") === 0 && stageIndex("approvals") > stageIndex("review"), "Stage order should match the workflow.");

  for (const stage of INCLUSIONS_SELECTIONS_STAGES) {
    assert(stage.label && stage.route.startsWith("/inclusions-selections/"), `Stage registry should define ${stage.id}.`);
  }
  const stageNav = source("src", "modules", "inclusions-selections", "components", "InclusionsSelectionsStageNav.tsx");
  assert(stageNav.includes("INCLUSIONS_SELECTIONS_STAGES"), "Stage nav should render the shared stage registry.");
  assert(stageNav.includes("maxAvailableStage"), "Stage nav should support blocked future stages.");
  assert(stageNav.includes("aria-current"), "Stage nav should identify the current stage.");
  assert(stageNav.includes("PROJECT_REQUIRED_MESSAGE"), "Stage nav should render the standard missing-project message.");
  assert(stageNav.includes("Back to Projects Hub"), "Stage nav should offer a route back to the project hub when context is missing.");
  assert(stageNav.includes("@media (max-width: 640px)") && stageNav.includes("grid-template-columns: 1fr"), "Stage nav should have a usable mobile layout.");

  const routeStages: Array<[string, string]> = [
    ["areas.tsx", "areas"],
    ["templates.tsx", "templates"],
    ["workspace.tsx", "workspace"],
    ["review.tsx", "review"],
    ["approvals.tsx", "approvals"],
    ["documents-export.tsx", "documents-export"],
  ];
  for (const [fileName, stageId] of routeStages) {
    const page = source("pages", "inclusions-selections", fileName);
    assert(page.includes("InclusionsSelectionsStageNav"), `${fileName} should use the shared stage nav.`);
    assert(page.includes(`currentStage="${stageId}"`), `${fileName} should highlight the current stage.`);
    assert(page.includes("contextFromQuery"), `${fileName} should use shared query context parsing.`);
    assert(page.includes("hrefForStage"), `${fileName} should use shared stage URL generation.`);
    assert(page.includes("PROJECT_REQUIRED_MESSAGE"), `${fileName} should use the standard project-required state.`);
  }

  const repositoryFiles = [
    "projectAreaRegisterRepository.ts",
    "templateStageRepository.ts",
    "selectionWorkspaceRepository.ts",
    "selectionReviewRepository.ts",
    "approvalStageRepository.ts",
    "documentsExportRepository.ts",
  ];
  for (const fileName of repositoryFiles) {
    const repository = source("src", "modules", "inclusions-selections", "repositories", fileName);
    assert(repository.includes("persistentScopedStore"), `${fileName} should use the shared browser persistence layer.`);
    assert(repository.includes("loadPersistedValue"), `${fileName} should reload browser drafts after refresh.`);
    assert(repository.includes("savePersistedValue"), `${fileName} should persist browser drafts after save.`);
  }
}

runModuleNavigationTests();
