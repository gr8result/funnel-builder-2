import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const selectionsSource = await readFile(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");
const workbookSource = await readFile(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../pages/api/product-library/approved-client-selection-catalogue.js", import.meta.url), "utf8");

assert.ok(apiSource.includes("req.query.organisationId || req.query.workspaceId"), "Approved catalogue API must accept organisationId or workspaceId");
assert.ok(apiSource.includes("res.status(200).json"), "Approved catalogue API must return a 200 payload on successful catalogue build");
assert.ok(apiSource.includes("products: catalogue.products"), "Approved catalogue API payload must include products");

assert.ok(!selectionsSource.includes('throw new Error("Approved catalogue API failed.")'), "Client Selections must not hard-throw on approved catalogue API failure");
assert.ok(selectionsSource.includes("setApprovedCatalogueError(message)"), "Client Selections must store a recoverable approved catalogue error");
assert.ok(selectionsSource.includes("Existing master catalogue products remain available."), "Client Selections must show a recoverable inline catalogue warning");
assert.ok(!selectionsSource.includes("setApprovedCatalogueProducts([]);\n      setApprovedCatalogueAudit(null);"), "Client Selections must preserve last valid approved catalogue state on failure");

assert.ok(workbookSource.includes("const requestedPage ="), "Estimate Builder must derive the requested route page before rendering modules");
assert.ok(workbookSource.includes("const activePageKey = requestedPage || sheet.workbook.page"), "Estimate Builder must use route-active page gating");
assert.ok(workbookSource.includes('activePageKey === "aiPlanTakeoff"'), "AI Plan Takeoff must mount from the route-active page");
assert.ok(workbookSource.includes('activePageKey === "clientSelections"'), "Client Selections must only mount from the route-active page");
assert.ok(!workbookSource.includes('sheet.workbook.page === "clientSelections" && (\n            <ClientSelectionsModuleHost'), "Client Selections must not mount from stale stored workbook page during route transition");

console.log("Estimate Builder approved catalogue crash regression passed.");
