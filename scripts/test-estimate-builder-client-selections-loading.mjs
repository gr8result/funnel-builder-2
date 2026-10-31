import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const selectionsSource = readFileSync("pages/modules/builders/selections-book.js", "utf8");

assert.ok(workbookSource.includes('title: "Client Selections"'), "Estimate Builder dashboard must keep the Client Selections card");
assert.ok(workbookSource.includes('page: "clientSelections"'), "Client Selections card must still target the clientSelections workspace page");
assert.ok(workbookSource.includes('const loadCommercialClientSelectionsPage = () => import("../../pages/modules/builders/selections-book")'), "Client Selections must load the current selections-book module");
assert.ok(!workbookSource.includes('import("../../pages/modules/builders/client-selections")'), "Client Selections must not use the retired budget-manager route");
assert.ok(!workbookSource.includes("CommercialClientSelectionsPage = dynamic"), "Client Selections must not rely on the old unbounded dynamic fallback");

assert.ok(workbookSource.includes("<ClientSelectionsModuleHost"), "Client Selections workspace must mount through the bounded host");
assert.ok(workbookSource.includes("Client Selections module did not mount within 10 seconds."), "Client Selections loader must time out instead of spinning forever");
assert.ok(workbookSource.includes("Client Selections could not be opened."), "Client Selections load failures must be visible");
assert.ok(workbookSource.includes(">Retry</button>"), "Client Selections load error must expose Retry");
assert.ok(workbookSource.includes(">Back to Project Workspace</button>"), "Client Selections load error must expose workspace back navigation");
assert.ok(workbookSource.includes("console.error(\"[Client Selections] import error\""), "Import errors must be logged");
assert.ok(workbookSource.includes("console.error(\"[Client Selections] component mount error\""), "Component mount errors must be logged");
assert.ok(workbookSource.includes("console.error(\"[Client Selections] module mount timeout\""), "Mount timeout must be logged");
assert.ok(workbookSource.includes('["quotation", "projectEstimate"].includes(activePageKey) && !previewMode && !mode'), "financial integrity diagnostics stay in builder quotation/estimate views, not the Client Selections decision screen or previews");

[
  "organisationId: moduleWorkspaceId",
  "workspaceId: moduleWorkspaceId",
  "workbook: sheet.workbook",
  "projectName: openJobDetails.projectName",
  "jobNumber: openJobDetails.jobNumber",
  "client:",
  "siteAddress: openJobDetails.projectAddress",
  "builder:",
  "estimator:",
  "currentFileName: openJobDetails.fileName",
  "fileName: openJobDetails.fileName",
  "openedFileName: sheet.workbook?.openedFileName",
  "sourceFileName: sheet.workbook?.sourceFileName",
].forEach((snippet) => {
  assert.ok(workbookSource.includes(snippet), `current project/file context must be passed through: ${snippet}`);
});

assert.ok(selectionsSource.includes("onEmbeddedMount?.();"), "Selections book must signal successful embedded mount");
assert.ok(selectionsSource.includes("function embeddedSelectionsProject"), "Selections book must derive embedded project context from the current .gr8job");
assert.ok(selectionsSource.includes("function embeddedSelectionsSnapshot"), "Selections book must derive embedded snapshot context from the current .gr8job");
assert.ok(selectionsSource.includes("selectionBookFromEmbeddedWorkbook(embeddedWorkbook)"), "Existing .gr8job selections data must be checked before creating a blank schedule");
assert.ok(selectionsSource.includes("selectionBookFromEmbeddedWorkbook(embeddedWorkbook)"), "Selections book must resolve saved workbook data through the shared source selector");
assert.ok(readFileSync("lib/builders/selectionBookSource.js", "utf8").includes("workbook?.clientSelectionsBook, workbook?.selectionsBook"), "shared source selector must preserve both supported workbook book fields");
assert.ok(selectionsSource.includes("console.error(\"[Client Selections] missing project context\""), "Missing project context must be logged");
assert.ok(selectionsSource.includes("console.error(\"[Client Selections] missing snapshot\""), "Missing snapshot must be logged");
assert.ok(selectionsSource.includes("console.error(\"[Client Selections] file-state error\""), "File-state load errors must be logged");
assert.ok(selectionsSource.includes("console.error(\"[Client Selections] parser or book load error\""), "Parser/book load errors must be logged");

assert.ok(selectionsSource.includes('const [viewMode, setViewMode] = useState("continuous")'), "Schedule viewer layout must default to Continuous");
assert.ok(selectionsSource.includes('const [zoomMode, setZoomMode] = useState("fit-width")'), "Schedule viewer layout must remain Fit Width by default");
assert.ok(selectionsSource.includes("<CoverPage cover={brochureCover}"), "Cover page must render from the resolved brochure cover data");
assert.ok(selectionsSource.includes('Kitchen: ["Oven"'), "Kitchen schedule data must remain available");

console.log("Estimate Builder Client Selections loading tests passed.");
