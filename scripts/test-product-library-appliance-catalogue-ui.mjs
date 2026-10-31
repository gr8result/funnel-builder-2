import assert from "node:assert/strict";
import fs from "node:fs";
import {
  APPLIANCE_FAMILIES,
  APPLIANCE_ELIGIBILITY_STATES,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
  createApplianceCatalogueSelectors,
  filterApplianceRecords,
  isApplianceRecordSelectable,
  isApplianceRecordVisible,
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

assert.equal(products.length, applianceCatalogue.products.length, "Product Library exposes every canonical appliance source record");
assert.equal(packs.length, appliancePackCatalogue.packs.length, "Product Library exposes every canonical appliance package record");
assert.equal(packs.length, appliancePackCatalogue.packs.length, "all canonical source packs are retained");
assert.deepEqual(
  families.map((family) => family.familyId),
  APPLIANCE_FAMILIES.map((family) => family.familyId),
  "Product Library appliance landing includes required physical and future-import families",
);
assert.ok(families.every((family) => family.productCount === getApplianceRecordsByFamily(family.familyId).length), "family card totals match client-visible Product Library records");
assert.ok(families.find((family) => family.familyId === "microwaves")?.productCount > 0, "current microwave supplier records are visible");
assert.equal(families.find((family) => family.familyId === "fridges")?.productCount, 0, "fridges retain an honest empty-state count without supplier records");
assert.ok(families.filter((family) => family.familyId !== "fridges" && family.familyId !== "freezers" && family.familyId !== "washer-dryers" && family.familyId !== "appliance-accessories" && family.familyId !== "other-appliances").every((family) => family.productCount > 0), "populated appliance families still expose product counts");
assert.ok(families.filter((family) => family.productCount > 0).every((family) => Number.isInteger(family.brandCount) && family.brandCount > 0), "populated family cards expose dynamic brand counts");

const cooktopBrands = getApplianceBrandsByFamily("cooktops");
const ovenBrands = getApplianceBrandsByFamily("ovens");
assert.ok(cooktopBrands.some((brand) => getApplianceRecordsByFamily("cooktops").some((record) => record.brand === brand)), "brand list is derived dynamically for cooktops");
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
assert.equal(getClientSelectableApplianceRecords().length, products.filter(isApplianceRecordSelectable).length, "client-selectable records follow canonical eligibility");
assert.equal(getLegacyQuotationCompatibleApplianceRecords().length, products.filter((record) => record.source?.type?.startsWith("legacy") || ["legacy", "verification-required", "discontinued"].includes(record.eligibility)).length, "legacy compatibility follows source eligibility");
assert.equal(getActiveProductLibraryApplianceRecords().length, products.filter(isApplianceRecordVisible).length, "active Product Library review records follow visibility rules");
assert.equal(getApplianceRecordsRequiringVerification().length, products.filter((record) => ["verification-required", "draft", "legacy", "discontinued"].includes(record.eligibility) || record.eligibilityReasons.length).length, "verification queue covers the current catalogue");

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
assert.ok(pageSource.includes("isApplianceRecordSelectable(record)"), "appliance selection actions are gated by the shared verified/selectable predicate");
assert.ok(pageSource.includes("Select Package"), "Product Library appliance package cards expose a Select Package action");
assert.ok(pageSource.includes("Import Product Catalogue CSV"), "Product Library exposes the Checkpoint 4 import placeholder action");
assert.ok(pageSource.includes("APPLIANCE_IMAGE_FALLBACK_LABEL"), "Product Library renders the required fallback image label from the selector module");
assert.ok(!pageSource.includes("applianceLegacyCsvImporter"), "Product Library UI does not import the deprecated appliance importer");
assert.equal(fs.readFileSync("pages/modules/builders/selections-book.js", "utf8"), selectionsSourceBefore, "test does not mutate selections-book.js");

console.log("Product Library appliance catalogue UI tests passed.");
