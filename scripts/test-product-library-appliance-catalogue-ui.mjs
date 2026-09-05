import assert from "node:assert/strict";
import fs from "node:fs";
import {
  APPLIANCE_ELIGIBILITY_STATES,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
  createApplianceCatalogueSelectors,
  filterApplianceRecords,
} from "../lib/product-library/applianceCatalogueSelectorsCore.js";

const pageSource = fs.readFileSync("pages/modules/builders/product-library.js", "utf8");
const serviceSource = fs.readFileSync("lib/product-library/catalogueService.js", "utf8");
const selectorWrapperSource = fs.readFileSync("lib/product-library/applianceCatalogueSelectors.js", "utf8");
const selectionsSourceBefore = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
const applianceCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const appliancePackCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json", "utf8"));
const {
  getApplianceBrandsByFamily,
  getApplianceFamilies,
  getApplianceModelsByFamilyAndBrand,
  getAppliancePacks,
  getApplianceProductById,
  getApplianceRecordsByFamily,
  getApplianceRecordsRequiringVerification,
  getActiveProductLibraryApplianceRecords,
  getClientSelectableApplianceRecords,
  getLegacyQuotationCompatibleApplianceRecords,
  getPlatformMasterApplianceRecords,
} = createApplianceCatalogueSelectors({
  productCatalogue: applianceCatalogue,
  packCatalogue: appliancePackCatalogue,
});

const products = getPlatformMasterApplianceRecords();
const packs = getAppliancePacks();
const families = getApplianceFamilies();

assert.equal(products.length, 83, "canonical appliance product count remains 83");
assert.equal(packs.length, 35, "canonical appliance pack count remains 35");
assert.deepEqual(
  families.map((family) => family.familyId),
  ["ovens", "cooktops", "rangehoods", "dishwashers", "freestanding-cookers", "microwaves", "fridges", "appliance-packs"],
  "Product Library appliance landing includes required physical and future-import families",
);
assert.equal(families.find((family) => family.familyId === "microwaves")?.productCount, 0, "microwave category is present with an empty-state count");
assert.equal(families.find((family) => family.familyId === "fridges")?.productCount, 0, "refrigerator category is present with an empty-state count");
assert.ok(families.filter((family) => !["microwaves", "fridges"].includes(family.familyId)).every((family) => family.productCount > 0), "populated appliance families still expose product counts");
assert.ok(families.filter((family) => family.productCount > 0).every((family) => Number.isInteger(family.brandCount) && family.brandCount > 0), "populated family cards expose dynamic brand counts");

const cooktopBrands = getApplianceBrandsByFamily("cooktops");
const ovenBrands = getApplianceBrandsByFamily("ovens");
assert.ok(cooktopBrands.includes("Ariston"), "brand list is derived dynamically for cooktops");
assert.ok(ovenBrands.includes("Westinghouse"), "brand list is derived dynamically for ovens");
assert.notEqual(getApplianceRecordsByFamily("cooktops").length, getApplianceRecordsByFamily("ovens").length, "family product counts are filtered even when all legacy brands appear in both families");

const westinghouseOvens = getApplianceModelsByFamilyAndBrand("ovens", "Westinghouse");
assert.ok(westinghouseOvens.length > 0, "model list filters by family and brand");
assert.ok(westinghouseOvens.every((record) => record.familyId === "ovens" && record.brand === "Westinghouse"), "model filter does not leak other brands or families");

const exactProduct = getApplianceProductById("product:appliances:ovens:westinghouse:wve6314dd");
assert.equal(exactProduct?.model, "WVE6314DD", "exact product lookup resolves the stable product ID");
assert.ok(exactProduct?.image, "verified official image references render as product images");
const unresolvedImageProduct = products.find((record) => !record.image);
assert.equal(unresolvedImageProduct?.imageFallbackLabel, APPLIANCE_IMAGE_FALLBACK_LABEL, "products without approved image assets keep the exact fallback label");

assert.ok(APPLIANCE_ELIGIBILITY_STATES.includes("verification-required"), "eligibility states include verification-required");
assert.ok(APPLIANCE_ELIGIBILITY_STATES.includes("legacy"), "eligibility states include legacy");
assert.equal(getClientSelectableApplianceRecords().length, 83, "shared Product Library appliance selector exposes all active master appliances");
assert.equal(getLegacyQuotationCompatibleApplianceRecords().length, 83, "all physical products remain legacy quotation-compatible");
assert.equal(getActiveProductLibraryApplianceRecords().length, 83, "active Product Library review records remain visible to admin users");
assert.equal(getApplianceRecordsRequiringVerification().length, 83, "all products remain in the verification queue after Checkpoint 2B");

const filteredByFuel = filterApplianceRecords(products, { fuel: "gas" });
assert.ok(filteredByFuel.length > 0, "fuel filter returns matching appliance records");
assert.ok(filteredByFuel.every((record) => String(record.fuelOrEnergyType || "").toLowerCase().includes("gas")), "fuel filter is scoped to fuel/energy fields");

const pack = packs.find((candidate) => candidate.componentProductIds?.length > 0);
assert.ok(pack, "a pack with components exists");
assert.ok(pack.components.length > 0, "pack display resolves component product references");
assert.ok(pack.components.every((component) => component.productId), "pack components keep canonical product IDs");
assert.equal(pack.selectableStatus, "not-client-selectable", "packs containing unverified components are not client-selectable");
assert.ok(pack.components.every((component) => !("sourceCostPrice" in component) && !("specificationSources" in component)), "packs expose slim resolved component summaries, not copied full component records");

assert.ok(serviceSource.includes("getPlatformMasterApplianceRecords().map(applianceToMasterProduct)"), "canonical service exposes appliance products to Product Library");
assert.ok(serviceSource.includes("getAppliancePacks().map(appliancePackToMasterProduct)"), "canonical service exposes appliance packs to Product Library");
assert.ok(serviceSource.includes('familyKey: "appliance-packs"'), "appliance packs remain a distinct Product Library family in the service");
assert.ok(selectorWrapperSource.includes("AU-APPLIANCE-CATALOGUE.json"), "selector wrapper binds to the canonical appliance product JSON");
assert.ok(selectorWrapperSource.includes("AU-APPLIANCE-PACKS.json"), "selector wrapper binds to the canonical appliance pack JSON");

assert.ok(pageSource.includes("catalogue: \"appliances\""), "Product Library appliance navigation uses URL query state");
assert.ok(pageSource.includes("applianceFamily"), "Product Library appliance family URL state is present");
assert.ok(pageSource.includes("applianceBrand"), "Product Library appliance brand URL state is present");
assert.ok(pageSource.includes("applianceProduct"), "Product Library appliance product URL state is present");
assert.ok(pageSource.includes("appliance-type-picker"), "Product Library exposes the required appliance product-type step");
assert.ok(pageSource.includes("View Details"), "Product Library appliance cards expose a View Details action");
assert.ok(pageSource.includes("Select Product"), "Product Library appliance cards expose a Select Product action");
assert.ok(pageSource.includes("Select Package"), "Product Library appliance package cards expose a Select Package action");
assert.ok(pageSource.includes("Import Product Catalogue CSV"), "Product Library exposes the Checkpoint 4 import placeholder action");
assert.ok(pageSource.includes("APPLIANCE_IMAGE_FALLBACK_LABEL"), "Product Library renders the required fallback image label from the selector module");
assert.ok(!pageSource.includes("applianceLegacyCsvImporter"), "Product Library UI does not import the deprecated appliance importer");
assert.equal(fs.readFileSync("pages/modules/builders/selections-book.js", "utf8"), selectionsSourceBefore, "test does not mutate selections-book.js");

console.log("Product Library appliance catalogue UI tests passed.");
