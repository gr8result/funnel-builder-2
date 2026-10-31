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
const cabinetryRows = workbook.quotation?.CABINETRY?.rows || [];

check("current workbook exposes one dynamic cabinetry quote section without fabricated default lines", () => {
  assert.ok(workbook.quotation?.CABINETRY, "CABINETRY section exists");
  assert.equal(cabinetryRows.length, 0, "default CABINETRY section does not fabricate priced selection rows");
});

const masterCabinetry = getEffectiveCabinetryCatalogue({ organisationId: "" });
check("effective Product Library cabinetry catalogue exposes all canonical master records", () => {
  assert.equal(masterCabinetry.counts.total, 785);
  assert.deepEqual(masterCabinetry.counts.byCanonicalType, {
    finish_product: 359,
    handle_product: 8,
    cabinet_unit: 32,
    shelving_feature: 11,
    hardware_product: 2,
    benchtop_product: 373,
  });
});

check("stable cabinetry IDs remain available from Product Library for dynamic quotation mapping", () => {
  const productCodes = new Set(masterCabinetry.products.map((product) => product.productCode));
  ["CABINETRY-HARDWARE-BLUM-SOFT-CLOSE", "CABINETRY-UNIT-OVERHEAD", "CABINETRY-APPLIANCE-PANEL-FRIDGE", "CABINETRY-BULKHEAD-RAW-MDF"].forEach((id) => assert.ok(productCodes.has(id), `${id} remains in the current master catalogue`));
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

const masterSoftClose = getEffectiveCabinetryCatalogue({ organisationId: "" }).products.find((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
disableProduct("org-a", "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
const orgADisabled = getEffectiveCabinetryCatalogue({ organisationId: "org-a" });

check("builder-disabled products disappear only from that builder's new choices", () => {
  assert.equal(orgADisabled.products.some((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE"), false);
  assert.equal(Boolean(masterSoftClose?.productId), true, "disabling a builder reference must retain the canonical master record");
  assert.equal(getEffectiveCabinetryCatalogue({ organisationId: "org-b" }).products.some((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE"), true);
});

console.log(`\nDefault cabinetry quotation rows: ${cabinetryRows.length}; current cabinetry records: ${masterCabinetry.counts.total}`);
console.log(`${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
