// Run: node --import ./scripts/register-json-loader.mjs scripts/test-appliance-retirement-filtering.mjs
import assert from "node:assert/strict";
import { createApplianceCatalogueSelectors } from "../lib/product-library/applianceCatalogueSelectorsCore.js";
import { applianceBrandSummaries, applianceModelsForBrand, safeAppliancePackagesForBrand } from "../lib/builders/applianceClientSelectionFlow.js";

const product = (productId, brandName, extra = {}) => ({
  productId, brandName, familyId: "cooktops", productName: productId,
  descriptionStatus: "verified-complete", specificationStatus: "complete",
  active: true, selectable: true, ...extra,
});
const products = [
  product("current", "Bosch"),
  product("inactive", "Historic", { active: false }),
  product("reference-only", "Reference", { selectable: false }),
  product("retired-brand", "Blanco"),
];
const selectors = createApplianceCatalogueSelectors({
  productCatalogue: { products },
  brandCatalogue: { brands: [{ brandName: "Bosch", logoUrl: "/bosch.svg" }, { brandName: "Blanco", active: false, selectable: false }] },
  packCatalogue: { packs: [
    { packId: "historic-pack", brandName: "Blanco", packName: "Historical", componentProductIds: ["retired-brand"] },
    { packId: "mixed-retired-pack", brandName: "Bosch", packName: "Retired component", componentProductIds: ["current", "inactive"] },
  ] },
});
assert.equal(selectors.getPlatformMasterApplianceRecords().length, 4);
assert.equal(selectors.getAppliancePacks().length, 2);
for (const productId of products.map((row) => row.productId)) assert.ok(selectors.getApplianceProductById(productId));
assert.ok(selectors.getApplianceProductById("historic-pack"));
for (const records of [
  selectors.getActiveProductLibraryApplianceRecords(),
  selectors.getClientSelectableApplianceRecords(),
  selectors.getClientVisibleApplianceRecords({ includeBuilderApprovedLegacy: true, approvedLegacyIds: products.map((row) => row.productId) }),
  selectors.getApplianceRecordsByFamily("cooktops"),
]) assert.deepEqual(records.map((row) => row.productId), ["current"]);
assert.deepEqual(selectors.getApplianceBrands().map((brand) => brand.brandName), ["Bosch"]);
assert.deepEqual(selectors.getApplianceBrandsByFamily("cooktops"), ["Bosch"]);
assert.deepEqual(selectors.getApplianceModelsByFamilyAndBrand("cooktops", "Blanco"), []);
assert.equal(selectors.getApplianceFamilies({ includePacks: false }).find((row) => row.familyId === "cooktops").productCount, 1);
assert.deepEqual(selectors.getApplianceRecordsByFamily("appliance-packs"), []);
assert.equal(selectors.getApplianceProductById("current").brandLogo, "/bosch.svg");
assert.equal(selectors.getClientVisibleApplianceRecords({ tenantRecords: [product("tenant-blanco", "Blanco")] }).length, 1);
const historicalRecords = selectors.getAdministrativeApplianceRecords();
assert.deepEqual(applianceBrandSummaries(historicalRecords, selectors.getAppliancePacks()).map((row) => row.brand), ["Bosch"]);
assert.deepEqual(applianceModelsForBrand(historicalRecords, "cooktops", "Blanco"), []);
assert.deepEqual(safeAppliancePackagesForBrand({ packs: selectors.getAppliancePacks(), records: historicalRecords, requirements: [{ areaKey: "appliances", familyKey: "cooktops" }] }), []);
console.log("PASS: retirement filters cover products, brands, packages, approved-legacy and tenant paths; historical lookups remain intact.");
