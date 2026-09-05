// Verifies cabinetry quotation rows and builder-private imports consume the
// Product Library cabinetry catalogue instead of module-owned option arrays.
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-quotation-builder-product-library-cabinetry.mjs
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { previewProductImportRows } from "../lib/product-library/catalogueModel.js";
import {
  addBuilderProduct,
  disableProduct,
  getEffectiveCabinetryCatalogue,
  resetLegacyMigrationFlag,
  setCatalogueStorage,
} from "../lib/product-library/catalogueService.js";

let pass = 0;
let fail = 0;

function check(label, assertion) {
  try {
    assertion();
    console.log(`  PASS  ${label}`);
    pass++;
  } catch (error) {
    console.log(`  FAIL  ${label}: ${error.message}`);
    fail++;
  }
}

function freshStorage() {
  const map = new Map();
  setCatalogueStorage({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  resetLegacyMigrationFlag();
}

function asMasterProduct(entity) {
  return {
    productId: entity.productId,
    productCode: entity.productCode,
    familyKey: entity.familyKey,
    requirementKeys: [entity.familyKey],
    categoryKey: entity.category,
    topLevelArea: entity.topLevelArea,
    manufacturer: entity.brand,
    brand: entity.brand,
    supplier: entity.supplier,
    range: entity.range,
    productName: entity.productName,
    model: entity.model,
    description: entity.description,
    primaryImageUrl: entity.primaryImage,
    thumbnailUrl: entity.thumbnail || entity.primaryImage,
    imageStatus: "review_required",
    officialProductUrl: entity.officialProductURL,
    supplierUrl: entity.supplierURL || entity.officialProductURL,
    priceUnit: "ITEM",
    priceStatus: entity.priceStatus || "needs-review",
    active: entity.active,
    discontinued: entity.discontinued,
    sourceType: "builder_private_import",
    sourceName: "Builder Product Library Import",
    sourceUrl: entity.officialProductURL,
    attributes: {
      canonicalType: "cabinet_unit",
      applicableRooms: ["kitchen"],
      importedThroughProductLibrary: true,
      snapshotPreserved: true,
    },
  };
}

freshStorage();

const source = readFileSync(new URL("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js", import.meta.url), "utf8");
const workbook = createEstimateBuilderWorkbookDefaults();
const sections = ["CABINET MAKER", "BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES"];
const cabinetryRows = sections.flatMap((sectionName) => workbook.quotation?.[sectionName]?.rows || []);
const pricedRows = cabinetryRows.filter((row) => !row.cabinetMakerTotalRow && row.canonicalMappingStatus !== "not_catalogue_record");
const matchedRows = pricedRows.filter((row) => row.canonicalMappingStatus === "matched");
const reviewRows = pricedRows.filter((row) => row.canonicalMappingStatus === "review_required");
const byItem = (pattern) => pricedRows.find((row) => pattern.test(String(row.item || "")));

check("quotation defaults import effective cabinetry catalogue selector", () => {
  assert.equal(source.includes("getEffectiveCabinetryCatalogue"), true);
});

check("all cabinetry quotation sections are present", () => {
  assert.deepEqual(sections.filter((sectionName) => workbook.quotation?.[sectionName]), sections);
});

check("cabinetry quotation rows carry deterministic mapping status", () => {
  assert.equal(pricedRows.length > 0, true);
  assert.equal(pricedRows.every((row) => ["matched", "review_required"].includes(row.canonicalMappingStatus)), true);
});

check("most cabinetry quotation rows are matched to Product Library records", () => {
  assert.equal(matchedRows.length >= 70, true);
  assert.equal(reviewRows.length <= 30, true);
});

check("specific stable cabinetry IDs are assigned to quotation rows", () => {
  assert.equal(byItem(/soft close/i)?.canonicalProductId, "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
  assert.equal(byItem(/overhead cupboards/i)?.canonicalProductId, "CABINETRY-UNIT-OVERHEAD");
  assert.equal(byItem(/fridge overhead cupboard/i)?.canonicalProductId, "CABINETRY-APPLIANCE-PANEL-FRIDGE");
  assert.equal(byItem(/craftwood bulkhead/i)?.canonicalProductId, "CABINETRY-BULKHEAD-RAW-MDF");
});

check("quotation rates still come from workbook rows", () => {
  assert.equal(byItem(/soft close/i)?.excelRate, "$100.00");
  assert.equal(byItem(/soft close/i)?.sourceOfRate, "workbook");
});

check("matched rows carry compact Product Library snapshots", () => {
  assert.equal(matchedRows.every((row) => row.productLibrarySnapshot?.productId === row.canonicalProductId), true);
  assert.equal(matchedRows.every((row) => !row.productLibrarySnapshot?.products), true);
});

check("matched rows carry Product Library image and supplier metadata", () => {
  assert.equal(matchedRows.every((row) => row.productImageUrl && row.productLibrarySnapshot?.imageReference), true);
  assert.equal(matchedRows.every((row) => row.productName && row.supplier && row.brand && row.sku), true);
});

const masterCabinetry = getEffectiveCabinetryCatalogue({ organisationId: "" });
check("effective Product Library cabinetry catalogue exposes all canonical master records", () => {
  assert.equal(masterCabinetry.counts.total, 561);
  assert.deepEqual(masterCabinetry.counts.byCanonicalType, {
    finish_product: 359,
    handle_product: 8,
    cabinet_unit: 33,
    shelving_feature: 11,
    hardware_product: 2,
    benchtop_product: 148,
  });
});

const importPreview = previewProductImportRows([{
  product_code: "ORG-A-CABINETRY-PRIVATE-BASE",
  linked_quote_item_code: "approved-family:cabinetry",
  product_family: "cabinetry",
  supplier_name: "Builder Private Joinery Supplier",
  brand: "Builder Private Range",
  range: "Kitchen Units",
  product_name: "Builder Private 900 Base Cabinet",
  model: "BP-BASE-900",
  description: "Builder-private cabinet unit imported through Product Library.",
  primary_image: "https://example.com/builder-private-base-cabinet.jpg",
  official_product_url: "https://example.com/builder-private-base-cabinet",
  active: "true",
  discontinued: "false",
}], { organisationId: "org-a", existingProducts: [] });

check("builder-private cabinetry CSV preview creates one valid Product Library product", () => {
  assert.equal(importPreview.length, 1);
  assert.equal(importPreview[0].action, "create");
  assert.equal(importPreview[0].errors.length, 0);
});

const privateProduct = addBuilderProduct("org-a", asMasterProduct(importPreview[0].entity));
const orgACabinetry = getEffectiveCabinetryCatalogue({ organisationId: "org-a" });
const orgBCabinetry = getEffectiveCabinetryCatalogue({ organisationId: "org-b" });

check("builder-private cabinetry import is visible only to the owning builder", () => {
  assert.equal(Boolean(privateProduct?.isCustom), true);
  assert.equal(orgACabinetry.products.some((product) => product.productCode === "ORG-A-CABINETRY-PRIVATE-BASE"), true);
  assert.equal(orgBCabinetry.products.some((product) => product.productCode === "ORG-A-CABINETRY-PRIVATE-BASE"), false);
});

disableProduct("org-a", "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
const orgADisabled = getEffectiveCabinetryCatalogue({ organisationId: "org-a" });
const preservedSnapshot = {
  canonicalProductId: "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE",
  productLibrarySnapshot: byItem(/soft close/i)?.productLibrarySnapshot,
};

check("builder-disabled products disappear from new choices without mutating saved snapshots", () => {
  assert.equal(orgADisabled.products.some((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE"), false);
  assert.equal(preservedSnapshot.productLibrarySnapshot.productId, "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
});

console.log(`\nCabinetry quotation rows: ${pricedRows.length} priced, ${matchedRows.length} matched, ${reviewRows.length} review required`);
console.log(`${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
