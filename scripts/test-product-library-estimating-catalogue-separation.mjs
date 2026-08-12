import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_FAMILIES,
  buildApprovedClientSelectionsCatalogue,
  isProductLibraryEligibleProduct,
} from "../lib/product-library/catalogueModel.js";
import {
  EXTERIOR_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  productsForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(repoRoot, "data", "product-library", "PRODUCTS-LIBRARY.csv");
const workbookPath = path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const clientWorkflowPath = path.join(repoRoot, "lib", "builders", "clientSelectionWorkflow.js");
const productLibraryPagePath = path.join(repoRoot, "pages", "modules", "builders", "product-library.js");

const csv = fs.readFileSync(csvPath, "utf8");
const catalogue = buildApprovedClientSelectionsCatalogue(csv, { organisationId: "test-builder" });
const workbookSource = fs.readFileSync(workbookPath, "utf8");
const clientWorkflowSource = fs.readFileSync(clientWorkflowPath, "utf8");
const productLibraryPageSource = fs.readFileSync(productLibraryPagePath, "utf8");

const estimatingOnlyRecords = [
  "Soil Tests",
  "Engineering",
  "Certification",
  "Project Management",
  "Site Supervision",
  "Concrete Slab",
  "Frame Labour",
  "Bearers & Joists",
].map((name) => ({
  id: `estimating-${name}`,
  productName: name,
  familyKey: "bricks",
  supplier: "QS",
  rowClassification: "estimating_only",
  metadata: { catalogueClass: "estimating_only" },
}));

assert.ok(estimatingOnlyRecords.every((record) => !isProductLibraryEligibleProduct(record)), "estimating-only classes must be excluded from Product Library eligibility");

assert.equal(catalogue.sourcePath, "data/product-library/PRODUCTS-LIBRARY.csv", "Product Library requirements must be sourced from the curated CSV");
assert.equal(catalogue.audit.usableRows.length, 614, "curated CSV requirement rows must remain the Product Library foundation");
assert.ok(catalogue.productFamilies.length >= 16, "curated CSV must produce selectable product-family mappings");
assert.ok(!JSON.stringify(catalogue.hierarchy).match(/Soil Tests|Engineering|Project Management|Site Supervision|Frame Labour/i), "estimating-only labels must not appear in the Product Library hierarchy");

const requiredFamilies = [
  "bricks",
  "metal-roofing",
  "entry-doors",
  "garage-doors",
  "ovens",
  "cooktops",
  "kitchen-sinks",
  "kitchen-sink-mixers",
  "stone-benchtops",
  "internal-doors",
  "flooring",
  "tiles",
];
for (const familyKey of requiredFamilies) {
  assert.ok(PRODUCT_FAMILIES.some((family) => family.familyKey === familyKey), `${familyKey} family must exist in Product Library taxonomy`);
}

assert.ok(workbookSource.includes('page: "estimatingCatalogue"'), "Estimate Builder dashboard must expose Estimating Catalogue separately");
assert.ok(workbookSource.includes("function EstimatingCatalogueSheet"), "QS table must be housed under Estimating Catalogue");
assert.ok(workbookSource.includes("deriveProductLibraryFromQuoteSheet"), "existing QS catalogue derivation must be preserved for estimating data");
assert.ok(workbookSource.includes('data-catalogue-kind="product-library"'), "Estimate Builder Product Library must render the visual hierarchy screen");

const brickRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "bricks");
const ovenRequirement = KITCHEN_REQUIREMENTS.find((item) => item.requirementKey === "oven");
const brickFamily = catalogue.productFamilies.find((family) => family.familyKey === "bricks");
const ovenFamily = catalogue.productFamilies.find((family) => family.familyKey === "ovens");
const ovenSourceRow = catalogue.audit.importRows.find((row) => row.familyKey === "ovens");
assert.ok(brickFamily?.approvedSourceKeys?.length, "brick selection requirement must retain approved CSV source keys");
assert.ok(ovenFamily?.approvedSourceKeys?.length, "oven selection requirement must retain approved CSV source keys");
assert.ok(ovenSourceRow?.approvedSourceKey, "curated selection requirement rows must retain a stable source key for quote linkage");

const actualOven = {
  productId: "oven-1",
  productCode: "OVEN-REAL-1",
  productName: "Actual Supplier Oven Model 900",
  supplier: "Actual Supplier",
  familyKey: "ovens",
  requirementKey: "oven",
  topLevelArea: "kitchen",
  linkedQuoteItemCode: ovenSourceRow.approvedSourceKey,
  rowClassification: "actual_product",
  client_selectable: true,
};
const fakeAllowanceBrick = {
  productId: "brick-range-row",
  productName: "FACE BRICKS - PREMIER RANGE",
  familyKey: "bricks",
  topLevelArea: "exterior",
  linkedQuoteItemCode: brickFamily.approvedSourceKeys[0],
  rowClassification: "allowance_specification",
};
assert.equal(productsForRequirement([actualOven], ovenRequirement)[0].requirementKey, "oven", "actual product must link back to its selection requirement");
assert.equal(productsForRequirement([fakeAllowanceBrick], brickRequirement).length, 0, "allowance rows must not be fabricated as actual Product Library products");
assert.equal(productsForRequirement([...estimatingOnlyRecords, actualOven], ovenRequirement).length, 1, "Client Selections must query eligible Product Library records, not estimating catalogue rows");

const disabledProduct = { ...actualOven, productId: "oven-disabled", productCode: "OVEN-DISABLED", active: false, builder_selectable: false };
const enabledProduct = { ...actualOven, productId: "oven-enabled", productCode: "OVEN-ENABLED", builder_selectable: true };
assert.ok(isProductLibraryEligibleProduct(enabledProduct), "organisation-specific builder-enabled products must be supported");
assert.ok(isProductLibraryEligibleProduct(disabledProduct), "disabled products remain valid Product Library records for admin enable/disable management");

assert.ok(productLibraryPageSource.includes(".filter(isProductLibraryEligibleProduct)"), "standalone Product Library page must filter out estimating catalogue records");
assert.ok(clientWorkflowSource.includes("isProductLibraryEligibleProduct(product)"), "Client Selections workflow must apply Product Library eligibility");

console.log(`Product Library / Estimating Catalogue separation passed: ${catalogue.audit.usableRows.length} curated rows, ${catalogue.productFamilies.length} mapped families.`);
