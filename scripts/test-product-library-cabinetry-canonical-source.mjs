import assert from "node:assert/strict";

import {
  CABINETRY_SCHEDULE_TYPE_OPTIONS,
  HANDLE_HOUSE_BASE_CATALOGUE,
  LAMINEX_CABINETRY_CATALOGUE,
  POLYTEC_CABINETRY_CATALOGUE,
  WET_AREA_CABINETRY_SCHEDULE_TYPES,
} from "../lib/builders/cabinetryWorkflow.js";
import {
  disableProduct,
  getEffectiveCabinetryCatalogue,
  getMasterProducts,
  getClientSelectableProducts,
  setCatalogueStorage,
  resetLegacyMigrationFlag,
  updateBuilderProductOverride,
} from "../lib/product-library/catalogueService.js";
import {
  PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS,
  PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE,
  PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS,
  PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES,
  getProductLibraryCabinetryColourRecords,
} from "../lib/product-library/cabinetryCatalogueSelectors.js";

const ORG_A = "builder-a-cabinetry";

setCatalogueStorage({
  map: new Map(),
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; },
  setItem(key, value) { this.map.set(key, String(value)); },
  removeItem(key) { this.map.delete(key); },
});
resetLegacyMigrationFlag();

const products = getMasterProducts();
const productText = JSON.stringify(products).toLowerCase();

const cabinetryColours = products.filter((product) => product.familyKey === "cabinet-finish");
const cabinetryHandles = products.filter((product) => product.familyKey === "handles" && product.supplier === "Handle House");
const structuralCabinetry = products.filter((product) => product.familyKey === "cabinetry" && product.supplier === "Builder Cabinetry");
const stoneSurfaces = products.filter((product) => (product.requirementKeys || []).includes("stone-benchtops"));
const structuralByType = structuralCabinetry.reduce((counts, product) => {
  const key = product.attributes?.canonicalType || "unknown";
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});

const canonicalColourRecords = getProductLibraryCabinetryColourRecords();
const canonicalColourIds = new Set(canonicalColourRecords.map((record) => record.id));
const masterColourIds = new Set(cabinetryColours.map((product) => product.productCode));
const selectionColourIds = new Set([...LAMINEX_CABINETRY_CATALOGUE, ...POLYTEC_CABINETRY_CATALOGUE].map((record) => record.id));
const structuralIds = new Set(PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.map((record) => record.id));

assert.equal(LAMINEX_CABINETRY_CATALOGUE.length, 53, "Client Selections Laminex records should come from the Product Library selector.");
assert.equal(POLYTEC_CABINETRY_CATALOGUE.length, 306, "Client Selections Polytec records should come from the Product Library selector.");
assert.equal(cabinetryColours.length, 359, "Product Library should expose all Laminex and Polytec colour/finish records.");
assert.deepEqual(masterColourIds, canonicalColourIds, "Product Library master records should preserve canonical cabinetry colour IDs.");
assert.deepEqual(selectionColourIds, canonicalColourIds, "Client Selections should share the same cabinetry colour IDs.");

assert.equal(PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE.length, 8, "Product Library should own the Handle House cabinetry handle list.");
assert.equal(HANDLE_HOUSE_BASE_CATALOGUE.length, PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE.length, "Client Selections should use the Product Library handle selector.");
assert.equal(cabinetryHandles.length, PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE.length, "Master catalogue should expose Product Library handle records.");
assert.ok(cabinetryHandles.some((product) => product.primaryImageUrl === "/images/catalogues/product-library/categories/cabinet-handles-handle-house-c3.jpg"), "Handle House C3 should use the local canonical Product Library asset.");

assert.deepEqual(CABINETRY_SCHEDULE_TYPE_OPTIONS, PRODUCT_LIBRARY_CABINETRY_SCHEDULE_TYPE_OPTIONS, "Client Selections cabinet schedule options should come from Product Library.");
assert.deepEqual(WET_AREA_CABINETRY_SCHEDULE_TYPES, PRODUCT_LIBRARY_WET_AREA_CABINETRY_SCHEDULE_TYPES, "Client Selections wet-area cabinet schedule options should come from Product Library.");
assert.equal(PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.length, 44, "Product Library should expose the migrated cabinetry units, hardware, shelving and feature records.");
assert.equal(structuralCabinetry.length, PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.length, "Master catalogue should include separated structural cabinetry records.");
assert.equal(structuralByType.cabinet_unit, 31, "Cabinet unit / assembly records should be distinct from finishes and handles.");
assert.equal(structuralByType.hardware_product, 2, "Hardware records should include soft-close and standard hardware options.");
assert.equal(structuralByType.shelving_feature, 11, "Shelving, kick, bulkhead, appliance-panel and feature records should be separate canonical options.");
[
  "CABINETRY-UNIT-STANDARD-BASE",
  "CABINETRY-UNIT-OVERHEAD",
  "CABINETRY-KICK-PANEL-BRUSHED-ALUMINIUM",
  "CABINETRY-BULKHEAD-RAW-MDF",
  "CABINETRY-SHELVING-OPEN",
  "CABINETRY-SHELVING-CLEATED",
  "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE",
].forEach((id) => assert.ok(structuralIds.has(id), `${id} stable Product Library ID must be preserved.`));
assert.ok(structuralCabinetry.every((product) => product.officialProductUrl === ""), "Builder-defined cabinetry assemblies must not display internal source paths as official product URLs.");
assert.ok(structuralCabinetry.every((product) => product.sourceName === "Builder Catalogue Item"), "Builder-defined assemblies must be labelled as Builder Catalogue Item.");
assert.equal(stoneSurfaces.length, 148, "Stone benchtop records should remain available through the shared Product Library catalogue.");

const effective = getEffectiveCabinetryCatalogue({ organisationId: ORG_A });
const scheduleProducts = structuralCabinetry.filter((product) => product.categoryKey === "Cabinetry Products");
const clientScheduleProducts = getClientSelectableProducts(ORG_A).filter((product) => product.categoryKey === "Cabinetry Products");
assert.deepEqual(new Set(clientScheduleProducts.map((product) => product.productId)), new Set(scheduleProducts.map((product) => product.productId)));
assert.equal(scheduleProducts.length, 37);
assert.equal(scheduleProducts[0].productName, "Standard base unit");
assert.equal(scheduleProducts.at(-1).productName, "Wardrobe hanging rail");
assert.equal(structuralCabinetry.filter((product) => product.categoryKey === "Cabinet Hardware").length, 2);
assert.equal(structuralCabinetry.filter((product) => product.categoryKey === "Cabinet Doors & Panels").length, 5);
for (const product of scheduleProducts) {
  const source = PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.find((record) => record.id === product.productCode);
  assert.equal(product.productId, `master-${source.id}`);
  assert.equal(product.primaryImageUrl, source.imageUrl);
  assert.equal(product.masterGroup, "Cabinetry");
  const contract = effective.canonicalProducts.find((record) => record.stableProductId === product.productId);
  assert.equal(contract.categoryKey, "Cabinetry Products");
  assert.equal(contract.quotationSection, "Cabinetry");
  assert.equal(contract.quotationSubsection, "Cabinetry Products");
}
updateBuilderProductOverride(ORG_A, scheduleProducts[0].productCode, { builderPrice: 321, enabled: true });
const pricedSchedule = getEffectiveCabinetryCatalogue({ organisationId: ORG_A }).canonicalProducts.find((record) => record.productCode === scheduleProducts[0].productCode);
assert.equal(pricedSchedule.price, 321);
assert.equal(pricedSchedule.categoryKey, "Cabinetry Products");
disableProduct(ORG_A, scheduleProducts.at(-1).productCode);
assert.ok(!getEffectiveCabinetryCatalogue({ organisationId: ORG_A }).products.some((record) => record.productCode === scheduleProducts.at(-1).productCode));
assert.ok(getEffectiveCabinetryCatalogue({ organisationId: "builder-other" }).products.some((record) => record.productCode === scheduleProducts.at(-1).productCode));
assert.equal(effective.serviceName, "getEffectiveCabinetryCatalogue", "Product Library should expose one shared cabinetry effective-catalogue service.");
assert.equal(effective.counts.byCanonicalType.finish_product, 359, "Effective cabinetry catalogue should include all finish records.");
assert.equal(effective.counts.byCanonicalType.handle_product, 8, "Effective cabinetry catalogue should include all handle records.");
assert.equal(effective.counts.byCanonicalType.cabinet_unit, 33, "Effective cabinetry catalogue should include all migrated cabinet unit records, including two Client Selections vanity units.");
assert.equal(effective.counts.byCanonicalType.hardware_product, 2, "Effective cabinetry catalogue should include migrated hardware records.");
assert.equal(effective.counts.byCanonicalType.shelving_feature, 11, "Effective cabinetry catalogue should include migrated shelving and feature records.");
assert.equal(effective.counts.byCanonicalType.benchtop_product, 148, "Effective cabinetry catalogue should include all stone benchtop records.");

disableProduct(ORG_A, "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE");
const afterDisable = getEffectiveCabinetryCatalogue({ organisationId: ORG_A });
assert.equal(afterDisable.products.some((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE"), false, "Disabled cabinetry product should disappear from new consumer choices.");
assert.equal(getEffectiveCabinetryCatalogue({ organisationId: "builder-b-cabinetry" }).products.some((product) => product.productCode === "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE"), true, "Builder-specific disable must not leak to another builder.");

assert.ok(!productText.includes("1556228720"), "Rejected cosmetics image URL should not be used by live Product Library records.");
assert.ok(!productText.includes("curology"), "Rejected cosmetics attribution should not be used by live Product Library records.");
assert.ok(!productText.includes("lib/builders/cabinetryworkflow.js"), "Internal cabinetry source paths must not appear in Product Library records.");

console.log(JSON.stringify({
  laminex: LAMINEX_CABINETRY_CATALOGUE.length,
  polytec: POLYTEC_CABINETRY_CATALOGUE.length,
  cabinetFinishMaster: cabinetryColours.length,
  handleHouse: cabinetryHandles.length,
  structuralCabinetry: structuralCabinetry.length,
  structuralByType,
  stoneSurfaces: stoneSurfaces.length,
  effectiveCounts: effective.counts,
}, null, 2));
