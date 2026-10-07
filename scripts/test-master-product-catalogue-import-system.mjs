import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AUSTRALIAN_REGIONS,
  MASTER_IMAGE_STATUSES,
  MASTER_PRICE_STATUSES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  commitMasterProductImport,
  createBuilderProductReference,
  createOrganisationProduct,
  exportMasterCatalogueCsv,
  exportMasterCatalogueJson,
  normalizeMasterProductRecord,
  parseMasterProductCatalogueCsv,
  parseMasterProductCatalogueJson,
  previewMasterProductImport,
  queryClientSelectableProducts,
  snapshotProductSelection,
} from "../lib/product-library/catalogueModel.js";

const repoRoot = process.cwd();
const templatePath = path.join(repoRoot, "data", "product-library", "MASTER-PRODUCT-CATALOGUE-IMPORT-TEMPLATE.csv");
const csvFixturePath = path.join(repoRoot, "test", "fixtures", "master-product-catalogue-test-fixture.csv");
const jsonFixturePath = path.join(repoRoot, "test", "fixtures", "master-product-catalogue-test-fixture.json");

assert.ok(fs.existsSync(templatePath), "master import CSV template must exist");
assert.deepEqual(fs.readFileSync(templatePath, "utf8").trim().split(","), PRODUCT_LIBRARY_IMPORT_COLUMNS, "master CSV template columns must match the canonical import contract");
assert.ok(!fs.readFileSync(templatePath, "utf8").match(/\n.+/), "production template must not contain fake product rows");
assert.ok(MASTER_PRICE_STATUSES.includes("not_applicable"), "price statuses must include not_applicable");
assert.ok(MASTER_IMAGE_STATUSES.includes("family_fallback"), "image statuses must preserve family fallback");
assert.deepEqual(AUSTRALIAN_REGIONS, ["AU", "QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"], "Australian region availability codes must be fixed");

const csvRecords = parseMasterProductCatalogueCsv(fs.readFileSync(csvFixturePath, "utf8"));
const jsonRecords = parseMasterProductCatalogueJson(fs.readFileSync(jsonFixturePath, "utf8"));
assert.equal(csvRecords.length, 2, "CSV import must parse fixture products");
assert.equal(jsonRecords.length, 1, "JSON import must parse structured fixture products");

const csvPreview = previewMasterProductImport(csvRecords, []);
assert.equal(csvPreview.totalProducts, 2, "preview must report total rows/products");
assert.equal(csvPreview.newProducts, 2, "preview must report new products");
assert.equal(csvPreview.invalidProducts, 0, "safe test fixture must validate");
assert.equal(csvPreview.missingImage, 0, "fixture images must be detected");
assert.equal(csvPreview.expiredPrice, 0, "fixture must not report expired prices");
assert.equal(csvPreview.rows[0].record.priceStatus, "current", "CSV current price must normalize");
assert.equal(csvPreview.rows[0].record.imageStatus, "verified_exact", "CSV exact image provenance must normalize");
assert.equal(csvPreview.rows[1].record.imageStatus, "verified_range", "range images must not become exact images");
assert.equal(csvPreview.rows[0].record.priceSourceUrl, "https://example.com/test-brick-price", "price provenance must survive import");
assert.equal(csvPreview.rows[0].record.imageSourceUrl, "https://example.com/test-brick-source", "image provenance must survive import");

const commitResult = commitMasterProductImport(csvPreview, []);
assert.equal(commitResult.created.length, 2, "commit must create new valid products");
assert.equal(commitResult.products.length, 2, "commit must return catalogue products");

const unchangedPreview = previewMasterProductImport(csvRecords, commitResult.products);
assert.equal(unchangedPreview.unchangedProducts, 2, "re-importing unchanged products must skip unchanged");

const changed = { ...csvRecords[0], product_name: "TEST Brick Product Updated" };
const updatePreview = previewMasterProductImport([changed], commitResult.products);
assert.equal(updatePreview.changedProducts, 1, "changed existing product must update");
const updateResult = commitMasterProductImport(updatePreview, commitResult.products);
assert.equal(updateResult.updated.length, 1, "commit must update changed products");
assert.equal(updateResult.products.length, 2, "commit must not implicitly delete missing products");

const invalidPreview = previewMasterProductImport([
  { product_code: "TEST-BAD-FAMILY", family_key: "ovens", manufacturer: "TEST", product_name: "Bad Family", price_status: "price_pending", regions: "QLD" },
  { product_code: "TEST-BAD-FAMILY", family_key: "oven", manufacturer: "TEST", product_name: "Bad Duplicate", price_status: "current", regions: "MARS" },
], []);
assert.equal(invalidPreview.invalidProducts, 2, "duplicate product codes, unknown family and unknown region rows must be rejected");
assert.equal(invalidPreview.duplicateProductCodes, 2, "both rows in a duplicate product-code pair must be reported");
assert.equal(invalidPreview.unknownRegions, 1, "unknown regions must be reported");
assert.ok(invalidPreview.rows[1].issues.some((issue) => issue.field === "family_key" && issue.suggestedCorrection === "ovens"), "family validation must suggest known mapping when possible");
assert.ok(invalidPreview.rows[1].issues.some((issue) => issue.field === "price_status" && issue.problem.includes("current price requires")), "current price without price value must be rejected");

const jsonPreview = previewMasterProductImport(jsonRecords, updateResult.products);
assert.equal(jsonPreview.newProducts, 1, "JSON products must normalize into the same canonical model");
assert.equal(jsonPreview.rows[0].record.priceStatus, "quote_required", "JSON quote_required price status must survive");
const allMasterProducts = commitMasterProductImport(jsonPreview, updateResult.products).products;

const fallback = normalizeMasterProductRecord({
  family_key: "bricks",
  manufacturer: "TEST Manufacturer",
  range: "TEST Range",
  product_name: "No SKU Brick",
  price_status: "price_pending",
});
assert.equal(fallback.productCode, "TEST-MANUFACTURER-BRICKS-TEST-RANGE-NO-SKU-BRICK", "missing SKU must generate deterministic productCode");
assert.equal(normalizeMasterProductRecord({ ...fallback, product_code: "" }).productCode, fallback.productCode, "generated productCode must be stable");

const builderRef = createBuilderProductReference(allMasterProducts[0], {
  organisationId: "org-a",
  enabled: true,
  tier: "Premier",
  selectionMode: "available_upgrade",
  allowance: 900,
  clientPrice: 1250,
  preferredSupplier: "TEST Preferred Supplier",
});
const disabledRef = createBuilderProductReference(allMasterProducts[1], { organisationId: "org-a", enabled: false });
const orgProduct = createOrganisationProduct({
  product_code: "ORG-A-CUSTOM-OVEN",
  family_key: "ovens",
  manufacturer: "Org A Local Supplier",
  product_name: "Org A Custom Oven",
  regions: "QLD",
  price_status: "quote_required",
}, "org-a");
assert.equal(orgProduct.sourceType, "organisation_product", "builder-specific products must be scoped as organisation products");

const selectableBricks = queryClientSelectableProducts({
  organisationId: "org-a",
  projectId: "project-a",
  familyKey: "bricks",
  region: "QLD",
  masterProducts: allMasterProducts,
  builderProducts: [builderRef, disabledRef],
  organisationProducts: [orgProduct],
});
assert.equal(selectableBricks.length, 1, "Client Selections query must return only enabled compatible products");
assert.equal(selectableBricks[0].clientPrice, 1250, "builder overrides must apply without duplicating master product data");

const selectableOvens = queryClientSelectableProducts({
  organisationId: "org-a",
  familyKey: "ovens",
  region: "QLD",
  masterProducts: allMasterProducts,
  builderProducts: [builderRef, disabledRef],
  organisationProducts: [orgProduct],
});
assert.equal(selectableOvens.length, 1, "disabled master products must be excluded while organisation products remain selectable");
assert.equal(selectableOvens[0].productCode, "ORG-A-CUSTOM-OVEN", "organisation-specific products must be selectable for their builder");

const historicalProduct = { ...allMasterProducts[0], discontinued: true };
const savedSnapshot = snapshotProductSelection(selectableBricks[0], { selectedPrice: 1250, variant: { colour: "Red" }, selectionDate: "2026-08-13T00:00:00.000Z" });
assert.deepEqual(Object.keys(savedSnapshot).sort(), ["imageReference", "model", "priceUsed", "productCode", "productId", "productName", "selectionDate", "variant"].sort(), "historical selection snapshot must retain immutable product details");
const historicalSelectable = queryClientSelectableProducts({
  organisationId: "org-a",
  projectId: "project-a",
  familyKey: "bricks",
  region: "QLD",
  masterProducts: [historicalProduct],
  builderProducts: [builderRef],
  savedSelections: [{ projectId: "project-a", productCode: historicalProduct.productCode }],
  includeDiscontinuedSaved: true,
});
assert.equal(historicalSelectable.length, 1, "saved historical selections must remain resolvable after discontinuation");

const exportedCsv = exportMasterCatalogueCsv(allMasterProducts);
const exportedJson = exportMasterCatalogueJson(allMasterProducts);
assert.ok(exportedCsv.startsWith(PRODUCT_LIBRARY_IMPORT_COLUMNS.join(",")), "CSV export must include canonical header");
assert.equal(JSON.parse(exportedJson).products.length, allMasterProducts.length, "JSON export must include all products");

const pageSource = fs.readFileSync(path.join(repoRoot, "pages", "modules", "builders", "product-library.js"), "utf8");
[
  "Master Catalogue",
  "Import Products",
  "Export Catalogue CSV",
  "Export Catalogue JSON",
  "Area",
  "Category",
  "Product Family",
  "Manufacturer",
  "Brand",
  "Supplier",
  "Range",
  "Region",
  "Image Status",
  "Price Status",
  "Active/Discontinued",
  "Commit Valid Rows",
  "data-builder-catalogue=\"reference-layer\"",
  "data-client-selections-query-proof=\"enabled-compatible-products\"",
].forEach((snippet) => {
  assert.ok(pageSource.includes(snippet), `Master Catalogue admin UI must expose ${snippet}`);
});

console.log("Master Product Catalogue import system tests passed.");
