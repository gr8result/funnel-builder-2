import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workbookPath = path.join(root, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const source = fs.readFileSync(workbookPath, "utf8");
const cardsStart = source.indexOf("const DASHBOARD_WORKSPACE_CARDS");
const cardsEnd = source.indexOf("function ProjectDashboardSheet");
const dashboardCards = source.slice(cardsStart, cardsEnd);

assert.ok(dashboardCards.includes('title: "Standard Inclusions"'), "Standard Inclusions card should remain available.");
assert.ok(dashboardCards.includes('title: "Inclusions & Selections"'), "Inclusions & Selections card should be visible on the project dashboard.");
assert.ok(dashboardCards.includes('title: "Product Library"'), "Product Library card should remain available.");
assert.ok(dashboardCards.includes('title: "Estimating Catalogue"'), "Estimating Catalogue card should expose the internal estimating table separately.");
assert.ok(dashboardCards.includes('title: "Project Estimate"'), "Project Estimate card should remain available.");
assert.ok(dashboardCards.includes('href: "/inclusions-selections/areas"'), "Inclusions & Selections should open the new Areas route.");
assert.ok(dashboardCards.includes('href: "/modules/builders/product-library?tab=selections"'), "Product Library should open the standalone client-selectable catalogue.");
assert.ok(dashboardCards.includes('page: "productLibrary"'), "Estimating Catalogue should keep access to the embedded estimating catalogue page.");
assert.ok(!dashboardCards.includes("/modules/builders/selections-book"), "Dashboard card must not open the retired selections-book route.");
assert.equal((dashboardCards.match(/title: "Inclusions & Selections"/g) ?? []).length, 1, "Dashboard should contain exactly one Inclusions & Selections card.");
assert.equal((dashboardCards.match(/title: "Product Library"/g) ?? []).length, 1, "Dashboard should contain exactly one Product Library card.");
assert.equal((dashboardCards.match(/title: "Estimating Catalogue"/g) ?? []).length, 1, "Dashboard should contain exactly one Estimating Catalogue card.");
assert.ok(
  dashboardCards.indexOf('title: "Standard Inclusions"') < dashboardCards.indexOf('title: "Inclusions & Selections"') &&
    dashboardCards.indexOf('title: "Inclusions & Selections"') < dashboardCards.indexOf('title: "Product Library"'),
  "Inclusions & Selections should sit between Standard Inclusions and Product Library.",
);
assert.ok(
  dashboardCards.indexOf('title: "Product Library"') < dashboardCards.indexOf('title: "Estimating Catalogue"') &&
    dashboardCards.indexOf('title: "Estimating Catalogue"') < dashboardCards.indexOf('title: "Project Estimate"'),
  "Product Library should sit before the internal Estimating Catalogue and Project Estimate.",
);
assert.ok(source.includes("function ProductLibrarySheet"), "Embedded estimating catalogue component should remain available.");
assert.ok(source.includes("<h2 style={styles.dashboardTitle}>Internal Estimating Catalogue</h2>"), "Embedded productLibrary workbook page should be visibly labelled as Internal Estimating Catalogue.");
assert.ok(source.includes("These items are not available for client selections."), "Embedded estimating catalogue should warn that items are not client selections.");
assert.ok(source.includes("Add estimating item"), "Embedded estimating catalogue add action should not be labelled as Product Library.");
assert.ok(source.includes("function inclusionsSelectionsDashboardHref"), "Dashboard should build the new module href through a helper.");
assert.ok(source.includes("organisationId: workspaceId"), "Dashboard href should preserve organisationId from the active workspace.");
assert.ok(source.includes("const projectId = proposalProjectId(sheet) || activeProjectId || registeredJob.jobId || \"\";"), "Dashboard href should preserve the active projectId.");
assert.ok(source.includes("registeredJob.jobName") && source.includes("registeredJob.clientName"), "Dashboard href should preserve registered job project and client fallbacks.");
assert.ok(source.includes('clientWorkbookDataValue(sheet, "projectName")'), "Dashboard href should preserve projectName.");
assert.ok(source.includes('clientWorkbookDataValue(sheet, "clientName")'), "Dashboard href should preserve client.");
assert.ok(source.includes('clientWorkbookDataValue(sheet, "projectAddress")'), "Dashboard href should preserve siteAddress.");
assert.ok(source.includes('clientWorkbookDataValue(sheet, "jobNumber")'), "Dashboard href should preserve jobNumber.");
assert.ok(source.includes("project-dashboard-card-grid") && source.includes("@media (max-width: 560px)"), "Dashboard card grid should include a mobile layout.");

console.log("Estimate Builder dashboard Inclusions & Selections navigation test passed.");
