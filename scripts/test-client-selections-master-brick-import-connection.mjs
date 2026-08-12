import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BUILDER_ENABLEMENT_STORAGE_KEY,
  MASTER_CATALOGUE_STORAGE_KEY,
  commitMasterProductImport,
  createBuilderProductReference,
  masterProductToClientSelectionProduct,
  parseMasterProductCatalogueCsv,
  parseMasterProductCatalogueJson,
  previewMasterProductImport,
  queryClientSelectableProducts,
} from "../lib/product-library/catalogueModel.js";
import { EXTERIOR_REQUIREMENTS, productsForRequirement } from "../lib/builders/clientSelectionWorkflow.js";

const repoRoot = process.cwd();
const selectionsSource = fs.readFileSync(path.join(repoRoot, "pages", "modules", "builders", "selections-book.js"), "utf8");
const csvFixture = fs.readFileSync(path.join(repoRoot, "test", "fixtures", "client-selections-test-brick-catalogue.csv"), "utf8");
const jsonFixture = fs.readFileSync(path.join(repoRoot, "test", "fixtures", "client-selections-test-brick-catalogue.json"), "utf8");
const bricksRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "bricks");

assert.ok(selectionsSource.includes("function GuidedBrickEmptyCatalogue"), "visible Bricks empty-state component must exist");
assert.ok(selectionsSource.includes("onOpenImport"), "visible Import Products button must be wired to the import modal handler");
assert.ok(!selectionsSource.includes('window.location.href = "/modules/builders/product-library?import=1";'), "visible Import Products button must not redirect to a detached importer");
assert.ok(selectionsSource.includes("BrickCatalogueImportModal"), "Bricks flow must open a proper import modal");
assert.ok(selectionsSource.includes("Catalogue Type: Master Catalogue"), "import modal must show Master Catalogue type");
assert.ok(selectionsSource.includes("Product Family: {requirement?.label || \"Bricks\"}"), "import modal must preselect Bricks family context");
assert.ok(selectionsSource.includes("Area: Exterior"), "import modal must preselect Exterior area context");
assert.ok(selectionsSource.includes("ADD PRODUCTS TO BUILDER CATALOGUE"), "post-import builder enablement step must be visible");
assert.ok(selectionsSource.includes("Enable entire supplier"), "builder enablement must support supplier-level enablement");
assert.ok(selectionsSource.includes("Enable range:"), "builder enablement must support range-level enablement");
assert.ok(selectionsSource.includes("No brick products are enabled for this builder."), "master-has-products/builder-has-none empty state must be preserved");
assert.ok(selectionsSource.includes("Brick catalogue awaiting product data"), "zero-product empty state must be preserved");
assert.ok(selectionsSource.includes("handleGuidedBack"), "back hierarchy must be explicit");
assert.ok(selectionsSource.includes('setGuidedBrickStep("ranges")'), "brick grid back must return to range");
assert.ok(selectionsSource.includes('setGuidedBrickStep("suppliers")'), "range back must return to supplier");
assert.ok(selectionsSource.includes('setGuidedScreen("exterior")'), "bricks back must return to Exterior");
assert.ok(!/PGH Bricks|Austral Bricks|Townhouse Range|Elements Range/.test(selectionsSource), "supplier/range names must not be hard-coded in Client Selections");
assert.ok(selectionsSource.includes("MASTER_CATALOGUE_STORAGE_KEY"), "Client Selections must read shared master catalogue storage");
assert.ok(selectionsSource.includes("BUILDER_ENABLEMENT_STORAGE_KEY"), "Client Selections must read shared builder enablement storage");

const csvRecords = parseMasterProductCatalogueCsv(csvFixture);
const jsonRecords = parseMasterProductCatalogueJson(jsonFixture);
assert.equal(csvRecords.length, 3, "TEST brick CSV fixture must parse three products");
assert.equal(jsonRecords.length, 1, "TEST brick JSON fixture must parse one product");

const csvPreview = previewMasterProductImport(csvRecords, []);
assert.equal(csvPreview.totalProducts, 3, "CSV import from Bricks context must preview all products");
assert.equal(csvPreview.newProducts, 3, "CSV preview must count new brick products");
assert.equal(csvPreview.invalidProducts, 0, "TEST brick CSV fixture must commit without errors");
assert.equal(csvPreview.missingPrice, 1, "preview must report missing/quote-required prices as warnings");
assert.equal(csvPreview.missingImage, 0, "local brick placeholder imagery must be present");
assert.equal(csvPreview.missingOfficialUrl, 0, "fixture official URLs must be present");

const csvCommit = commitMasterProductImport(csvPreview, []);
assert.equal(csvCommit.created.length, 3, "commit must create master brick records");
assert.equal(csvCommit.products.length, 3, "commit must keep all master products");

const jsonPreview = previewMasterProductImport(jsonRecords.map((record) => ({ ...record, family_key: record.familyKey || "bricks", top_level_area: record.topLevelArea || "exterior" })), csvCommit.products);
assert.equal(jsonPreview.invalidProducts, 0, "JSON import from Bricks context must validate");

const noEnabled = queryClientSelectableProducts({
  organisationId: "org-test",
  familyKey: "bricks",
  region: "QLD",
  masterProducts: csvCommit.products,
  builderProducts: [],
});
assert.equal(noEnabled.length, 0, "Master products must not be silently visible until enabled for the builder");

const enablements = csvCommit.products.map((product) => createBuilderProductReference(product, { organisationId: "org-test", enabled: true }));
const qldEnabled = queryClientSelectableProducts({
  organisationId: "org-test",
  projectId: "project-test",
  familyKey: "bricks",
  region: "QLD",
  masterProducts: csvCommit.products,
  builderProducts: enablements,
});
assert.equal(qldEnabled.length, 2, "QLD project must show QLD and AU compatible bricks, not VIC-only bricks");

const clientProducts = qldEnabled.map((product) => masterProductToClientSelectionProduct(product, { organisationId: "org-test", requirement: bricksRequirement }));
const requirementProducts = productsForRequirement(clientProducts, bricksRequirement);
assert.equal(requirementProducts.length, 2, "enabled master products must feed the existing Client Selections product query");

const suppliers = Array.from(new Set(qldEnabled.map((product) => product.supplier || product.manufacturer)));
const ranges = Array.from(new Set(qldEnabled.map((product) => product.range)));
assert.deepEqual(suppliers, ["TEST BRICK CO"], "supplier screen must be generated from enabled product data");
assert.deepEqual(ranges, ["TEST RANGE A"], "range screen must be generated from enabled product data and region filter");
assert.ok(qldEnabled.every((product) => product.primaryImageUrl?.includes("/test-assets/test-brick-")), "brick cards must use brick-specific imported imagery");

const selected = qldEnabled[0];
const selectionSnapshot = {
  projectId: "project-test",
  organisationId: "org-test",
  requirementKey: "bricks",
  familyKey: "bricks",
  linkedQuoteItemCode: "approved-family:bricks",
  productCode: selected.productCode,
  manufacturer: selected.manufacturer,
  brand: selected.brand,
  range: selected.range,
  productName: selected.productName,
  colour: selected.colour,
  variant: { colour: selected.colour, finish: selected.finish, size: selected.size },
  quantity: 1,
  allowance: 0,
  selectedPrice: selected.clientPrice ?? selected.rrp ?? 0,
  variation: selected.clientPrice ?? selected.rrp ?? 0,
  imageReference: selected.primaryImageUrl,
  selectionTimestamp: "2026-08-13T00:00:00.000Z",
};
assert.equal(selectionSnapshot.productCode, "TEST-BRICK-001", "selection must retain productCode");
assert.equal(selectionSnapshot.manufacturer, "TEST BRICK CO", "selection must retain manufacturer");
assert.ok(selectionSnapshot.imageReference.includes("test-brick-001.svg"), "selection must retain image reference");

console.log("Client Selections master brick import connection tests passed.");
