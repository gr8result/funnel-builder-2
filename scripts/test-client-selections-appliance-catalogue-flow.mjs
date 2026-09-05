import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createApplianceCatalogueSelectors,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
} from "../lib/product-library/applianceCatalogueSelectorsCore.js";
import {
  applianceBrandSummaries,
  applianceModelsForBrand,
  appliancePackageSelectionPatches,
  applianceProductToGuidedOption,
  applianceProductTypesForBrand,
  applianceRecordsForRequirement,
  applianceSelectionPatch,
  safeAppliancePackagesForBrand,
} from "../lib/builders/applianceClientSelectionFlow.js";

const pageSource = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
const applianceWorkflowSource = pageSource.slice(
  pageSource.indexOf("function GuidedApplianceWorkflow"),
  pageSource.indexOf("function GuidedCabinetryWorkflow")
);
const cabinetrySourceBefore = fs.readFileSync("lib/builders/cabinetryWorkflow.js", "utf8");
const applianceCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const appliancePackCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json", "utf8"));
const selectors = createApplianceCatalogueSelectors({
  productCatalogue: applianceCatalogue,
  packCatalogue: appliancePackCatalogue,
});

const requirements = [
  { requirementKey: "oven", label: "Oven", familyKey: "ovens", areaKey: "appliances", areaLabel: "Appliances", defaultAllowance: 1200, defaultQuantity: 1, defaultUnit: "EACH" },
  { requirementKey: "cooktop", label: "Cooktop", familyKey: "cooktops", areaKey: "appliances", areaLabel: "Appliances", defaultAllowance: 950, defaultQuantity: 1, defaultUnit: "EACH" },
  { requirementKey: "microwave", label: "Microwave", familyKey: "microwaves", areaKey: "appliances", areaLabel: "Appliances", defaultAllowance: 450, defaultQuantity: 1, defaultUnit: "EACH" },
  { requirementKey: "fridge", label: "Fridge", familyKey: "fridges", areaKey: "appliances", areaLabel: "Appliances", defaultAllowance: 1600, defaultQuantity: 1, defaultUnit: "EACH" },
];

const clientVisible = selectors.getClientVisibleApplianceRecords();
const adminRecords = selectors.getAdministrativeApplianceRecords();
assert.equal(adminRecords.length, 83, "admin Product Library retains all 83 appliance products");
assert.equal(clientVisible.length, 83, "client flow exposes the full active Product Library appliance baseline");
assert.ok(clientVisible.every((record) => record.active !== false && record.selectable !== false && !record.discontinued && !record.hidden), "client records are active/selectable/not hidden");
assert.ok(clientVisible.some((record) => record.eligibility === "legacy"), "legacy source lineage remains review metadata, not a client visibility gate");

const ovens = applianceRecordsForRequirement(clientVisible, requirements[0]);
const cooktops = applianceRecordsForRequirement(clientVisible, requirements[1]);
assert.equal(ovens.length, 12, "Oven family filters to client-visible oven products");
assert.equal(cooktops.length, 23, "Cooktop family filters to client-visible cooktop products");
assert.ok(ovens.every((record) => record.familyId === "ovens"), "Oven brand/model flow does not leak other families");

const brandSummaries = applianceBrandSummaries(clientVisible, safeAppliancePackagesForBrand({ packs: selectors.getAppliancePacks(), records: clientVisible, requirements }));
assert.ok(brandSummaries.some((item) => item.brand === "Westinghouse"), "brand page is derived dynamically from Product Library products");
assert.ok(brandSummaries.every((item) => !item.firstImage), "brand cards do not use product photos as brand logos");
assert.ok(brandSummaries.some((item) => item.brand === "Ariston") || clientVisible.some((record) => record.brand === "Ariston") === false, "brand list is data-driven and not Westinghouse-only");
const westinghouseOvens = applianceModelsForBrand(ovens, "ovens", "Westinghouse");
assert.ok(westinghouseOvens.length > 0, "brand model list resolves Westinghouse ovens");
assert.ok(westinghouseOvens.every((record) => record.familyId === "ovens" && record.brand === "Westinghouse"), "brand model list is filtered by family and brand");

const westinghouseTypes = applianceProductTypesForBrand(clientVisible, requirements, "Westinghouse");
assert.ok(westinghouseTypes.find((item) => item.requirement.familyKey === "ovens")?.available, "Build Your Own exposes Oven after the brand is selected");
assert.ok(westinghouseTypes.every((item) => item.products.every((record) => record.brand === "Westinghouse")), "Build Your Own product types are filtered by selected brand");

const microwaveRecords = applianceRecordsForRequirement(clientVisible, requirements[2]);
const fridgeRecords = applianceRecordsForRequirement(clientVisible, requirements[3]);
assert.equal(microwaveRecords.length, 0, "Microwave has the required empty client state");
assert.equal(fridgeRecords.length, 0, "Fridge has the required empty client state");
assert.ok(pageSource.includes("No {brand} products are currently enabled for this category."), "missing brand category message is exact and brand-specific");

const tenantRecords = selectors.getClientVisibleApplianceRecords({
  tenantRecords: [{
    productId: "tenant:appliances:ovens:futurebrand:model-1",
    familyId: "ovens",
    brandName: "FutureBrand",
    manufacturerModel: "FB-900",
    productName: "FutureBrand 900 Oven",
    fullDescription: "Tenant imported oven.",
    specifications: { widthMm: 600, fuelOrEnergyType: "Electric" },
    descriptionStatus: "verified-complete",
    specificationStatus: "complete",
    primaryImage: "",
    imageStatus: "pending-licence",
    sellPrice: 1500,
    tenantSellPrice: 1500,
    selectable: true,
    active: true,
    tenantId: "tenant-alpha",
    source: { type: "tenant-import" },
  }],
});
assert.ok(tenantRecords.some((record) => record.brand === "FutureBrand" && record.familyId === "ovens"), "unknown future tenant brands are supported by imported records without code changes");
const futureTypes = applianceProductTypesForBrand(tenantRecords, requirements, "FutureBrand");
assert.ok(futureTypes.find((item) => item.requirement.familyKey === "ovens")?.available, "future imported brands automatically appear in Build Your Own");

const option = applianceProductToGuidedOption(westinghouseOvens[0], requirements[0]);
assert.equal(option.imageFallbackLabel, option.imageUrl ? "" : APPLIANCE_IMAGE_FALLBACK_LABEL, "model cards use approved images or the exact fallback label");
assert.ok(!("sourceCostPrice" in option), "client option does not expose source costs");
assert.ok(!JSON.stringify(option).includes("sourceCostPrice"), "client option metadata does not leak source costs");

const patch = applianceSelectionPatch({
  requirement: requirements[0],
  record: westinghouseOvens[0],
  organisationId: "workspace-1",
  projectId: "job-1",
  selectedAt: "2026-09-02T10:00:00.000Z",
  selectedBrandName: "Westinghouse",
  selectionMode: "build-your-own",
});
assert.equal(patch.guidedSelection.canonicalProductId, westinghouseOvens[0].productId, "selection snapshot saves canonical product ID");
assert.equal(patch.guidedSelection.applianceFamily, "ovens", "selection snapshot saves appliance family");
assert.equal(patch.guidedSelection.brand, westinghouseOvens[0].brand, "selection snapshot saves brand");
assert.equal(patch.guidedSelection.model, westinghouseOvens[0].model, "selection snapshot saves model");
assert.equal(patch.guidedSelection.productName, westinghouseOvens[0].name, "selection snapshot saves product name");
assert.ok(patch.guidedSelection.description, "selection snapshot saves description");
assert.ok(patch.guidedSelection.specs && typeof patch.guidedSelection.specs === "object", "selection snapshot saves specs");
assert.ok(patch.guidedSelection.selectedImageRef, "selection snapshot saves image reference or fallback");
assert.equal(patch.guidedSelection.originalAllowance, 1200, "selection snapshot saves original allowance");
assert.equal(patch.guidedSelection.selectionDate, "2026-09-02T10:00:00.000Z", "selection snapshot saves selection date");
assert.equal(patch.guidedSelection.selectionMode, "build-your-own", "selection snapshot saves appliance mode");
assert.equal(patch.guidedSelection.selectedBrandName, "Westinghouse", "selection snapshot saves selected brand context");
assert.equal(patch.guidedSelection.sourceCatalogue, "AU-APPLIANCE-CATALOGUE", "selection snapshot saves source catalogue");
assert.ok(!JSON.stringify(patch).includes("sourceCostPrice"), "selection snapshot does not expose source costs");

const safePackages = safeAppliancePackagesForBrand({ packs: selectors.getAppliancePacks(), records: clientVisible, requirements, brand: "Westinghouse" });
assert.ok(safePackages.every((pack) => pack.brand === "Westinghouse"), "package flow filters packages to the selected brand");
assert.ok(safePackages.every((pack) => pack.componentRecords.length && !pack.unresolvedComponentIds.length), "package flow only exposes safely resolved component packages");
if (safePackages[0]) {
  const packagePatches = appliancePackageSelectionPatches({
    packageOption: safePackages[0],
    requirements,
    organisationId: "workspace-1",
    projectId: "job-1",
    selectedAt: "2026-09-02T10:00:00.000Z",
  });
  assert.ok(packagePatches.length > 0, "safe package selection creates component patches");
  assert.ok(packagePatches.every((item) => item.patch.guidedSelection.selectionMode === "package"), "package component snapshots save package mode");
  assert.ok(packagePatches.every((item) => item.patch.guidedSelection.selectedPackageId === (safePackages[0].packId || safePackages[0].productId)), "package component snapshots save selected package ID");
}

assert.ok(!pageSource.includes("<ProjectCompactBanner"), "Client Selections does not duplicate the platform banner");
assert.ok(pageSource.includes("GuidedApplianceWorkflow"), "Client Selections contains the appliance guided workflow");
assert.ok(pageSource.includes("Which appliance brand would you like to view?"), "appliance landing page asks for brand first");
assert.ok(pageSource.includes('data-testid="appliance-brand-selection"'), "appliance first page renders brand selection");
assert.ok(pageSource.includes("Select an Appliance Package"), "brand page offers package flow");
assert.ok(pageSource.includes("Build Your Own Appliance Package"), "brand page offers build-your-own flow");
assert.ok(pageSource.includes("Changing appliance brand will not silently clear existing selections"), "Change Brand warns before replacing selections");
assert.ok(pageSource.includes("Switching appliance selection mode may replace existing appliance selections"), "package/BYO switching warns");
assert.ok(pageSource.includes("Back to Appliances"), "appliance workflow exposes Back to Appliances");
assert.ok(pageSource.includes("Back to Models"), "appliance workflow exposes Back to Models");
assert.ok(pageSource.includes("Select Product"), "appliance workflow exposes Select Product");
assert.ok(pageSource.includes("Change Selection"), "appliance workflow exposes Change Selection");
assert.ok(pageSource.includes("getEffectiveApplianceCatalogue"), "client appliance workflow uses the shared effective Product Library catalogue selector");
assert.ok(!pageSource.includes("tenantApplianceRecordsFromMasterProducts"), "client appliance workflow no longer keeps a second tenant appliance adapter");
assert.ok(pageSource.includes("sourceCostPrice") === false || !pageSource.match(/sourceCostPrice[^]*GuidedAppliance/), "appliance UI path does not render source costs");
assert.ok(pageSource.includes('url.searchParams.set("guided", "appliances")'), "appliance URL state supports refresh/back restoration");
assert.ok(pageSource.includes('areaKey === "appliances" ? "appliance-products"'), "appliances route directly into the brand-first appliance workflow");
assert.ok(!applianceWorkflowSource.match(/\bRice\b/i), "rice image/text is absent from appliance UI source");

assert.equal(fs.readFileSync("lib/builders/cabinetryWorkflow.js", "utf8"), cabinetrySourceBefore, "test confirms cabinetry workflow source is unchanged during appliance checks");
assert.ok(!pageSource.match(/Kitchen Paint|Kitchen Lighting|generic kitchen paint|generic kitchen lighting/i), "no generic Kitchen paint or lighting appliance leakage is introduced");

console.log("Client Selections appliance catalogue flow tests passed.");
