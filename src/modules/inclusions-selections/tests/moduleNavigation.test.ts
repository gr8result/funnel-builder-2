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
  assert(!constructionHub.includes("Inclusions & Selections - Rebuilding") && !constructionHub.includes("Inclusions & Selections — Rebuilding"), "Construction Hub must not show the retired rebuilding placeholder.");
  assert(!constructionHub.includes('action="Unavailable"'), "Construction Hub module card must not be disabled.");
  assert(!constructionHub.includes("/modules/builders/client-selections") && !constructionHub.includes("/modules/builders/selections-book"), "Construction Hub must not link to retired selections routes.");

  const estimateBuilder = source("components", "estimate-builder", "EstimateBuilderWorkbook.js");
  const dashboardCards = estimateBuilder.slice(estimateBuilder.indexOf("const DASHBOARD_WORKSPACE_CARDS"), estimateBuilder.indexOf("function ProjectDashboardSheet"));
  assert(dashboardCards.includes('title: "Inclusions & Selections"'), "Estimate Builder dashboard should expose the active Inclusions & Selections card.");
  assert(dashboardCards.includes('href: "/inclusions-selections/areas"'), "Estimate Builder dashboard card should open the new Areas route.");
  assert(!dashboardCards.includes("/modules/builders/selections-book"), "Estimate Builder dashboard card must not point to the retired selections book.");
  assert(dashboardCards.includes("Set up project areas, apply inclusion templates and complete client product selections."), "Estimate Builder dashboard card should use the approved description.");
  assert(dashboardCards.indexOf('title: "Standard Inclusions"') < dashboardCards.indexOf('title: "Inclusions & Selections"'), "Inclusions & Selections should sit after Standard Inclusions.");
  assert(dashboardCards.indexOf('title: "Inclusions & Selections"') < dashboardCards.indexOf('title: "Product Library"'), "Inclusions & Selections should sit before Product Library.");
  assert(dashboardCards.includes('title: "Project Estimate"'), "Project Estimate dashboard card should remain available.");
  assert((dashboardCards.match(/title: "Inclusions & Selections"/g) ?? []).length === 1, "Estimate Builder dashboard should not duplicate the Inclusions & Selections card.");
  assert(estimateBuilder.includes("function inclusionsSelectionsDashboardHref"), "Estimate Builder dashboard should build a context-preserving new-module URL.");
  assert(estimateBuilder.includes("organisationId: workspaceId") && estimateBuilder.includes("projectId,") && estimateBuilder.includes('clientWorkbookDataValue(sheet, "projectName")'), "Estimate Builder dashboard should preserve organisation, project and project name context.");
  assert(estimateBuilder.includes('clientWorkbookDataValue(sheet, "clientName")') && estimateBuilder.includes('clientWorkbookDataValue(sheet, "projectAddress")') && estimateBuilder.includes('clientWorkbookDataValue(sheet, "jobNumber")'), "Estimate Builder dashboard should preserve client, site address and job number context.");
  assert(estimateBuilder.includes("registeredJob.jobId") && estimateBuilder.includes("registeredJob.jobName") && estimateBuilder.includes("registeredJob.clientName"), "Estimate Builder dashboard should preserve registered job context fallbacks.");
  assert(estimateBuilder.includes("project-dashboard-card-grid") && estimateBuilder.includes("@media (max-width: 560px)"), "Estimate Builder dashboard cards should have a mobile layout.");

  const builderEntryFiles = ["rfis.js", "quote-approvals.js", "document-vault.js"];
  for (const fileName of builderEntryFiles) {
    const builderPage = source("pages", "modules", "builders", fileName);
    assert(builderPage.includes("inclusionsSelectionsHref(workspaceId, selectedProject)"), `${fileName} should build the selections URL from the selected project.`);
    assert(builderPage.includes("<Link href={selectionsHref} style={styles.secondaryLink}>Inclusions & Selections</Link>"), `${fileName} should expose one active Inclusions & Selections link.`);
    assert(!builderPage.includes("Inclusions & Selections - Rebuilding") && !builderPage.includes("Inclusions & Selections — Rebuilding"), `${fileName} should not expose the rebuilding label.`);
    assert(!builderPage.includes("/modules/builders/selections-book"), `${fileName} should not link to the retired selections book.`);
    assert(builderPage.includes('params.set("client", project.client_name)') && builderPage.includes('params.set("siteAddress", project.site_address)'), `${fileName} should preserve client and site address context.`);
  }

  const retiredPage = source("pages", "modules", "builders", "selections-book.js");
  assert(retiredPage.includes("RetiredSelectionsBookPage"), "Retired compatibility route should remain available.");
  assert(retiredPage.includes("Open New Inclusions & Selections"), "Retired route should include a button to the new workflow.");
  assert(retiredPage.includes("/inclusions-selections/areas"), "Retired route button should open the new Areas route.");
  assert(retiredPage.includes("router.query"), "Retired route button should preserve incoming query parameters.");

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
  assert(query.client === context.clientName && query.siteAddress === context.siteAddress && query.jobNumber === context.jobNumber, "Query helper should preserve project metadata.");
  assert(hrefForStage("review", context).includes("client=Client+One"), "Stage links should retain client context.");
  assert(stageIndex("areas") === 0 && stageIndex("approvals") > stageIndex("review"), "Stage order should match the workflow.");

  for (const stage of INCLUSIONS_SELECTIONS_STAGES) {
    assert(stage.label && stage.route.startsWith("/inclusions-selections/"), `Stage registry should define ${stage.id}.`);
  }
  const stageNav = source("src", "modules", "inclusions-selections", "components", "InclusionsSelectionsStageNav.tsx");
  assert(stageNav.includes("INCLUSIONS_SELECTIONS_STAGES"), "Stage nav should render the shared stage registry.");
  assert(stageNav.includes("maxAvailableStage"), "Stage nav should support blocked future stages.");
  assert(stageNav.includes('maxAvailableStage = "documents-export"'), "Stage nav should expose all stages by default when project context exists.");
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
