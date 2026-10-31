import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  PRODUCT_FAMILIES,
  activeKitchenMasterProducts,
  createBuilderProductReference,
  ensureDemoBuilderCatalogueEnablements,
  familyByKey,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";
import {
  APPLIANCE_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  selectedByRequirement,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";
import { applianceRecordsForRequirement, applianceSelectionPatch } from "../lib/builders/applianceClientSelectionFlow.js";
import { applianceFallbackImage } from "../lib/product-library/applianceCataloguePresentation.js";
import { getEffectiveApplianceCatalogue } from "../lib/product-library/catalogueService.js";

const require = createRequire(import.meta.url);
const kitchenCatalogue = require("../data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json");
const applianceDashboardImage = new URL("../public/images/client-selections/appliances-kitchen.jpeg", import.meta.url);
const selectionsSource = fs.readFileSync(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");

const kitchenProducts = kitchenCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const enablements = ensureDemoBuilderCatalogueEnablements(kitchenProducts, [], DEMO_BUILDER_ORGANISATION_ID);
const effectiveAppliances = getEffectiveApplianceCatalogue({ organisationId: DEMO_BUILDER_ORGANISATION_ID });
const kitchenFamilyKeys = Array.from(new Set(KITCHEN_REQUIREMENTS.map((requirement) => requirement.familyKey)));
const coreApplianceRequirements = APPLIANCE_REQUIREMENTS.filter((requirement) => !["freestanding-cooker", "clothes-dryer", "appliance-pack"].includes(requirement.requirementKey));
const applianceFamilyKeys = Array.from(new Set(coreApplianceRequirements.map((requirement) => requirement.familyKey)));
const kitchenAndApplianceRequirements = [...KITCHEN_REQUIREMENTS, ...coreApplianceRequirements];

assert.equal(KITCHEN_REQUIREMENTS.some((requirement) => requirement.requirementKey === "oven"), false, "Oven is no longer part of the Kitchen checklist");
assert.deepEqual(coreApplianceRequirements.map((requirement) => requirement.requirementKey), ["oven", "cooktop", "rangehood", "dishwasher", "microwave", "fridge"], "Appliances owns the core appliance selection checklist");
assert.ok(APPLIANCE_REQUIREMENTS.some((requirement) => requirement.requirementKey === "freestanding-cooker"), "Appliances supports Freestanding Cooker when catalogue content is available");
assert.ok(APPLIANCE_REQUIREMENTS.some((requirement) => requirement.requirementKey === "appliance-pack"), "Appliances supports Appliance Packs when catalogue content is available");
const clothesDryerRequirement = APPLIANCE_REQUIREMENTS.find((requirement) => requirement.requirementKey === "clothes-dryer");
assert.equal(clothesDryerRequirement?.areaLabel, "Laundry", "the dryer is selected in the Appliances flow for the Laundry");
assert.equal(clothesDryerRequirement?.allowanceStatus, "not_set", "no builder dryer allowance is invented");
assert.ok(fs.existsSync(applianceDashboardImage), "Supplied Appliances dashboard image is stored in public assets");

assert.equal(kitchenProducts.length, 28, "Kitchen catalogue must expose all current master products");
assert.equal(activeKitchenMasterProducts(kitchenProducts).length, 28, "Kitchen demo enablement candidates exclude generic paint and lighting");
assert.equal(activeKitchenMasterProducts(kitchenProducts).some((product) => ["paint", "lighting"].includes(product.familyKey)), false, "generic paint and lighting do not appear as active Kitchen candidates");

kitchenAndApplianceRequirements.forEach((requirement) => {
  const products = kitchenProducts.filter((product) => product.familyKey === requirement.familyKey && product.requirementKeys.includes(requirement.requirementKey));
  assert.ok(products.length > 0, `${requirement.label} has Product Library master records`);
  assert.ok(familyByKey(requirement.familyKey), `${requirement.familyKey} is a registered Product Library family`);
  assert.ok(PRODUCT_FAMILIES.some((family) => family.familyKey === requirement.familyKey), `${requirement.familyKey} is visible as a Product Library family`);
  if (requirement.familyKey === "fridges") {
    assert.deepEqual(products.map((product) => product.productCode), ["FRIDGE-WESTINGHOUSE-WBE4504SC"], "the only current Kitchen fridge record stays tied to its official source");
    assert.equal(products[0].primaryImageUrl, "", "no exact fridge image is invented");
    assert.equal(products[0].imageStatus, "missing", "the unresolved exact image remains visible in catalogue state");
    assert.equal(applianceFallbackImage(products[0]), "/images/catalogues/appliances/fallbacks/refrigerator.svg", "the product card uses the dedicated refrigerator category illustration");
    assert.ok(fs.existsSync(new URL("../public/images/catalogues/appliances/fallbacks/refrigerator.svg", import.meta.url)), "the refrigerator fallback asset is local");
  } else {
    assert.ok(products.every((product) => product.primaryImageUrl), `${requirement.label} products carry verified image references`);
  }
  assert.ok(products.every((product) => ["quote_required", "price_pending"].includes(product.priceStatus)), `${requirement.label} products do not invent current prices`);
  assert.ok(products.every((product) => product.rrp === null && product.clientPrice === null), `${requirement.label} products do not store fake $0 prices`);
  assert.notEqual(resolveProductLibraryImage({ familyKey: requirement.familyKey }), FAMILY_IMAGE_FALLBACKS.bedrooms, `${requirement.label} fallback cannot be bedroom imagery`);
});

assert.ok(kitchenProducts.filter((product) => product.familyKey === "fridges").every((product) => product.imageStatus === "missing"), "Fridge image gaps remain explicit until exact supplier imagery is sourced");
["ovens", "cooktops", "rangehoods", "dishwashers", "microwaves", "handles"].forEach((familyKey) => {
  assert.ok(kitchenProducts.filter((product) => product.familyKey === familyKey).every((product) => product.imageStatus === "verified_exact"), `${familyKey} uses exact product imagery`);
});
assert.equal(kitchenProducts.filter((product) => product.familyKey === "ovens").length, 5, "Kitchen includes at least five exact oven products");
assert.equal(kitchenProducts.filter((product) => product.familyKey === "cooktops").length, 5, "Kitchen includes at least five exact cooktop products");

[...kitchenFamilyKeys, ...applianceFamilyKeys].forEach((familyKey) => {
  const familyProducts = kitchenProducts.filter((product) => product.familyKey === familyKey);
  const enabledRefs = enablements.filter((item) => (
    item.organisationId === DEMO_BUILDER_ORGANISATION_ID &&
    item.enabled &&
    familyProducts.some((product) => product.productCode === item.masterProductCode)
  ));
  assert.equal(enabledRefs.length, familyProducts.length, `${familyKey} demo builder enablement covers all seeded products`);

  const selectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: kitchenProducts,
    builderProducts: enablements,
  });
  assert.equal(selectable.length, familyProducts.length, `${familyKey} Client Selections reads Product Library master records`);
});

["ovens", "kitchen-sinks", "stone-benchtops"].forEach((familyKey) => {
  const product = kitchenProducts.find((item) => item.familyKey === familyKey);
  const editedDescription = `${product.description || product.productName} shared Kitchen propagation proof`;
  const editedMasterProducts = kitchenProducts.map((item) => item.productCode === product.productCode ? { ...item, description: editedDescription } : item);
  const editedSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: editedMasterProducts,
    builderProducts: enablements,
  });
  assert.equal(editedSelectable.find((item) => item.productCode === product.productCode)?.description, editedDescription, `${familyKey} Product Library edits propagate to Client Selections`);
});

const ovenRequirement = APPLIANCE_REQUIREMENTS.find((requirement) => requirement.requirementKey === "oven");
const cooktopRequirement = APPLIANCE_REQUIREMENTS.find((requirement) => requirement.requirementKey === "cooktop");
const effectiveFridges = effectiveAppliances.records.filter((record) => record.familyId === "fridges");
assert.equal(effectiveFridges.length, 1, "the verified Kitchen-master fridge is available when the central appliance family is empty");
assert.equal(effectiveFridges[0].productId, "master-FRIDGE-WESTINGHOUSE-WBE4504SC");
assert.equal(effectiveFridges[0].priceStatus, "quote_required", "fridge selection remains unpriced until a supplier quote is verified");
assert.equal(effectiveFridges[0].image, "", "an unavailable exact fridge image is not fabricated");
assert.equal(effectiveFridges[0].productPageUrl, "https://www.westinghouse.com.au/fridges-and-freezers/fridges/wbe4504sc/");
const fridgeRequirement = APPLIANCE_REQUIREMENTS.find((requirement) => requirement.requirementKey === "fridge");
assert.deepEqual(applianceRecordsForRequirement(effectiveAppliances.records, fridgeRequirement).map((record) => record.productId), ["master-FRIDGE-WESTINGHOUSE-WBE4504SC"], "the existing fridge appears in the Client Selections appliance picker");
const effectiveDryers = effectiveAppliances.records.filter((record) => record.familyId === "dryers");
assert.equal(effectiveDryers.length, 1, "the existing central dryer record remains available");
assert.equal(effectiveDryers[0].productId, "product:appliances:dryers:whirlpool:hwec8002iw");
assert.deepEqual(applianceRecordsForRequirement(effectiveAppliances.records, clothesDryerRequirement).map((record) => record.productId), ["product:appliances:dryers:whirlpool:hwec8002iw"], "the Laundry dryer appears in the Client Selections appliance picker");
const dryerPatch = applianceSelectionPatch({ requirement: clothesDryerRequirement, record: effectiveDryers[0], organisationId: DEMO_BUILDER_ORGANISATION_ID, projectId: "project-kitchen" });
assert.equal(dryerPatch.guidedSelection.selectedPrice, 1286, "the sourced current dryer SRP is retained");
assert.equal(dryerPatch.guidedSelection.priceIncludesGst, true, "the published SRP inc GST basis is retained");
assert.equal(dryerPatch.guidedSelection.variation, null, "no variation is posted without an approved builder allowance");
assert.equal(dryerPatch.guidedSelection.variationPending, true, "variation remains pending until the inclusion baseline is configured");
const ovenProduct = kitchenProducts.find((product) => product.productCode === "OVEN-WESTINGHOUSE-WVE6515SD");
const ovenPayload = createSelectionPayloadFromProduct({
  workspaceId: DEMO_BUILDER_ORGANISATION_ID,
  projectId: "project-kitchen",
  requirement: ovenRequirement,
  product: ovenProduct,
});
assert.equal(ovenPayload.selected_details.productCode, "OVEN-WESTINGHOUSE-WVE6515SD", "Oven selection persists productCode for quote linkage");
assert.equal(ovenPayload.selected_details.officialProductURL, ovenProduct.officialProductUrl, "Oven selection persists official product URL");
assert.equal(ovenPayload.selected_details.selectedPrice, null, "Quote-required Oven selection does not persist fake selected price");
assert.equal(statusForRequirement(ovenRequirement, ovenPayload), "complete", "Quote-required selected Oven can save and turn green with variation pending");

const selectedMap = selectedByRequirement([ovenPayload], APPLIANCE_REQUIREMENTS);
assert.equal(nextIncompleteRequirement(APPLIANCE_REQUIREMENTS, selectedMap, ovenRequirement)?.requirementKey, cooktopRequirement.requirementKey, "Appliances auto-advance moves from Oven to Cooktop");

const disabledRef = createBuilderProductReference(ovenProduct, {
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  enabled: false,
  active: false,
});
const disabledSelectable = queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "ovens",
  region: "QLD",
  masterProducts: kitchenProducts,
  builderProducts: enablements
    .filter((item) => item.masterProductCode !== ovenProduct.productCode)
    .concat(disabledRef),
});
assert.equal(disabledSelectable.some((product) => product.productCode === ovenProduct.productCode), false, "Disabled Kitchen builder records disappear from new selections");

assert.match(selectionsSource, /AU-KITCHEN-PRODUCT-CATALOGUE\.json/, "Client Selections imports the Kitchen master catalogue");
assert.match(selectionsSource, /guided-kitchen-checklist/, "Kitchen opens as a progress checklist");
assert.match(selectionsSource, /guided-appliances-checklist/, "Appliances opens as its own progress checklist");
assert.match(selectionsSource, /\/images\/client-selections\/appliances-kitchen\.jpeg/, "Appliances dashboard card uses supplied local image");
assert.match(selectionsSource, /KITCHEN COMPLETE\. Opening Interior\./, "Kitchen completion announces completion and opens the next Interior area");
assert.doesNotMatch(selectionsSource, /data\/product-library\/catalogues\/client-selections/i, "Kitchen must not load a client-only catalogue");

const productLibrarySource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(productLibrarySource, /AU-KITCHEN-PRODUCT-CATALOGUE\.json/, "Product Library imports the Kitchen master catalogue");
assert.match(productLibrarySource, /PRODUCT_LIBRARY_ROOM_CATEGORIES/, "Product Library exposes shared room-category taxonomy for Kitchen families");

const exactImages = kitchenProducts.filter((product) => product.imageStatus === "verified_exact").length;
const fallbackImages = kitchenProducts.filter((product) => ["family_fallback", "review_required"].includes(product.imageStatus)).length;
console.log(`Kitchen catalogue tests passed. Products=${kitchenProducts.length} ExactImages=${exactImages} FallbackOrReview=${fallbackImages}`);
