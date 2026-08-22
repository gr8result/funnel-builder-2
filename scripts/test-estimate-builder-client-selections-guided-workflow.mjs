import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workbookSource = await readFile(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
const selectionsBookSource = await readFile(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");

assert.ok(workbookSource.includes('const loadCommercialClientSelectionsPage = () => import("../../pages/modules/builders/selections-book")'), "Estimate Builder Client Selections card must load the selections-book module");
assert.ok(workbookSource.includes('page: "clientSelections"'), "Estimate Builder dashboard must keep the Client Selections entry point");
assert.ok(workbookSource.includes('initialPage = ""'), "Estimate Builder must accept an explicit initial page deep link");
assert.ok(workbookSource.includes('sheet.setPage(initialPage)'), "Estimate Builder page deep links must open the requested workspace page");
assert.ok(!workbookSource.includes('page: "standardInclusions",\n    visualKey: "clientSelections"'), "Client Selections must never point at Standard Inclusions");
assert.ok(selectionsBookSource.includes("GuidedSelectionsWorkflow"), "Selections Book must render the guided workflow component");
assert.ok(selectionsBookSource.includes('guidedScreen === "review"'), "Schedule table must be gated behind review mode");
assert.ok(selectionsBookSource.includes("Review Schedule"), "Old schedule remains available as Review Schedule");
assert.ok(selectionsBookSource.includes("Choose an Area"), "Default Client Selections UI must start with Choose Area");
assert.ok(selectionsBookSource.includes("guided-client-selections-home"), "Guided home test marker must exist");
assert.ok(selectionsBookSource.includes("guided-kitchen-checklist"), "Kitchen checklist test marker must exist");
assert.ok(selectionsBookSource.includes("guided-left-progress-menu"), "Product page left progress menu marker must exist");
assert.ok(selectionsBookSource.includes("GuidedBrickWorkflow"), "Bricks flow must use a dedicated supplier/range/product workflow");
assert.ok(selectionsBookSource.includes("guided-brick-empty-catalogue"), "Bricks flow must render a professional empty catalogue state");
assert.ok(selectionsBookSource.includes("brickSupplierOptions(products)"), "Bricks suppliers must be derived from actual products");
assert.ok(selectionsBookSource.includes("brickRangeOptions(products, brickSupplier)"), "Bricks ranges must be derived from actual products");
assert.ok(selectionsBookSource.includes("No products have been added to this catalogue yet."), "Empty catalogue messaging must replace fabricated products");
assert.ok(!selectionsBookSource.includes("BRICK_FALLBACK_PRODUCTS"), "Bricks flow must not include fake fallback products");
assert.ok(!selectionsBookSource.includes("PGH Bricks Premier Range"), "Bricks flow must not fabricate PGH Premier products");
assert.ok(!selectionsBookSource.includes("Austral Bricks Premium Range"), "Bricks flow must not fabricate Austral Premium products");
assert.ok(!selectionsBookSource.includes('["roof-colour", "Roof Colour"'), "Roof Colour must not be a separate Exterior category");
assert.ok(!selectionsBookSource.includes('requirement("gutters-fascia", "Gutters & Fascia"'), "Gutters & Fascia must not be a separate Exterior category");
assert.ok(selectionsBookSource.includes('data-roofing-package-steps="fascia gutters downpipes"'), "Roofing guided workflow must include fascia, gutters and downpipes inside the roofing package");
assert.ok(selectionsBookSource.includes('guidedRequirement?.areaKey === "exterior"'), "Back from Exterior product pages must return to Exterior categories");
assert.ok(selectionsBookSource.includes('guidedRequirement?.areaKey === "kitchen"'), "Back from Kitchen product pages must return to Kitchen checklist");
assert.ok(selectionsBookSource.includes('guidedBrickStep === "products"'), "Back from brick products must return to the brick range step");
assert.ok(selectionsBookSource.includes('guidedBrickStep === "ranges"'), "Back from brick ranges must return to the brick supplier step");
assert.ok(!selectionsBookSource.includes("approved CSV rows connected"), "Client UI must hide approved CSV parser counts");
assert.ok(!selectionsBookSource.includes("Site Works") && !selectionsBookSource.includes("Soil Tests"), "Old estimating categories must not be introduced into the guided workflow");

const reviewGateIndex = selectionsBookSource.indexOf('guidedScreen === "review"');
const tableIndex = selectionsBookSource.indexOf('className="selectionTable"');
assert.ok(reviewGateIndex > -1 && tableIndex > -1, "Review gate and legacy table must both exist");
assert.ok(reviewGateIndex < tableIndex, "Legacy schedule table must be downstream of the review gate, not the primary screen");

const estimateRouteSource = await readFile(new URL("../pages/modules/estimate-builder/index.js", import.meta.url), "utf8");
assert.ok(estimateRouteSource.includes("router.query.page"), "Estimate Builder route must read explicit page query params");
assert.ok(estimateRouteSource.includes("initialPage={initialPage}"), "Estimate Builder route must pass page=clientSelections through to the workbook");

for (const relativePath of ["../pages/modules/builders/document-vault.js", "../pages/modules/builders/quote-approvals.js", "../pages/modules/builders/rfis.js"]) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  assert.ok(source.includes('/modules/estimate-builder?page=clientSelections'), `${relativePath} must link Selections to the current Client Selections workspace`);
  assert.ok(!source.includes('/modules/builders/client-selections'), `${relativePath} must not link to the retired Client Selections route`);
}

console.log("Estimate Builder guided Client Selections regression tests passed.");
