import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  PRODUCT_FAMILIES,
  createBuilderProductReference,
  ensureDemoBuilderCatalogueEnablements,
  familyByKey,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";
import {
  EXTERIOR_REQUIREMENTS,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  selectedByRequirement,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const require = createRequire(import.meta.url);
const qldBrickMasterCatalogue = require("../data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json");
const auMetalRoofingCatalogue = require("../data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json");
const exteriorOpeningsCatalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");

const bricks = qldBrickMasterCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const roofing = auMetalRoofingCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const exteriorOpenings = exteriorOpeningsCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const masterProducts = [...bricks, ...roofing, ...exteriorOpenings];
const enablements = ensureDemoBuilderCatalogueEnablements(masterProducts, [], DEMO_BUILDER_ORGANISATION_ID);

const requiredFamilies = ["windows", "entry-doors", "garage-doors"];
const productsByFamily = Object.fromEntries(requiredFamilies.map((familyKey) => [
  familyKey,
  exteriorOpenings.filter((product) => product.familyKey === familyKey),
]));

assert.ok(familyByKey("windows"), "Product Library must expose Windows as a first-class master family");
requiredFamilies.forEach((familyKey) => {
  assert.ok(PRODUCT_FAMILIES.some((family) => family.familyKey === familyKey), `${familyKey} family is registered`);
  assert.ok(productsByFamily[familyKey].length > 0, `${familyKey} has imported master products`);
  assert.ok(productsByFamily[familyKey].every((product) => product.primaryImageUrl && product.officialProductUrl), `${familyKey} products carry real images and official URLs`);
  assert.ok(productsByFamily[familyKey].every((product) => product.priceStatus === "quote_required"), `${familyKey} products must not invent $0/current pricing`);
  assert.ok(productsByFamily[familyKey].every((product) => product.rrp === null && product.clientPrice === null), `${familyKey} products must not store fake prices`);
});

assert.ok(productsByFamily.windows.length >= 6, "Windows catalogue includes multiple verified manufacturer/range records");
assert.ok(productsByFamily["entry-doors"].length >= 4, "Entry Doors catalogue includes actual Hume entrance door designs");
assert.ok(productsByFamily["garage-doors"].length >= 5, "Garage Doors catalogue includes sectional, roller and designer B&D records");

const exteriorFamilyKeys = EXTERIOR_REQUIREMENTS.map((requirement) => requirement.familyKey);
assert.ok(exteriorFamilyKeys.includes("windows"), "Exterior Windows requirement uses familyKey=windows");
assert.equal(exteriorFamilyKeys.includes("visual-windows"), false, "Windows cannot use the legacy visual-windows family");
assert.equal(EXTERIOR_REQUIREMENTS.some((requirement) => /window colour/i.test(requirement.label)), false, "Window Colour must not be standalone");
assert.equal(EXTERIOR_REQUIREMENTS.some((requirement) => /entry door colour/i.test(requirement.label)), false, "Entry Door Colour must not be standalone");
assert.equal(EXTERIOR_REQUIREMENTS.some((requirement) => /garage door colour/i.test(requirement.label)), false, "Garage Door Colour must not be standalone");

assert.notEqual(resolveProductLibraryImage({ familyKey: "windows" }), FAMILY_IMAGE_FALLBACKS.bedrooms, "Windows fallback cannot resolve to bedroom imagery");
assert.notEqual(resolveProductLibraryImage({ familyKey: "entry-doors" }), FAMILY_IMAGE_FALLBACKS.bathroom, "Entry Door fallback cannot resolve to bathroom imagery");
assert.notEqual(resolveProductLibraryImage({ familyKey: "garage-doors" }), FAMILY_IMAGE_FALLBACKS.cooktop, "Garage Door fallback cannot resolve to appliance imagery");

requiredFamilies.forEach((familyKey) => {
  const familyProducts = productsByFamily[familyKey];
  const enabledRefs = enablements.filter((item) => (
    item.organisationId === DEMO_BUILDER_ORGANISATION_ID &&
    item.enabled &&
    familyProducts.some((product) => product.productCode === item.masterProductCode)
  ));
  assert.equal(enabledRefs.length, familyProducts.length, `${familyKey} demo builder enablement should cover all imported active records`);
  const selectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts,
    builderProducts: enablements,
  });
  assert.equal(selectable.length, familyProducts.length, `${familyKey} Client Selections reads the same master records enabled in Product Library`);

  const editedDescription = `${familyProducts[0].description} shared propagation proof`;
  const editedMasterProducts = masterProducts.map((product) => product.productCode === familyProducts[0].productCode ? { ...product, description: editedDescription } : product);
  const editedSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: editedMasterProducts,
    builderProducts: enablements,
  });
  assert.equal(editedSelectable.find((product) => product.productCode === familyProducts[0].productCode)?.description, editedDescription, `${familyKey} Product Library edits propagate to Client Selections`);

  const disabledRef = createBuilderProductReference(familyProducts[0], {
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    enabled: false,
    active: false,
  });
  const disabledSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts,
    builderProducts: enablements
      .filter((item) => item.masterProductCode !== familyProducts[0].productCode)
      .concat(disabledRef),
  });
  assert.equal(disabledSelectable.some((product) => product.productCode === familyProducts[0].productCode), false, `${familyKey} disabled builder records disappear from new selections`);

  const archivedProducts = masterProducts.map((product) => product.productCode === familyProducts[0].productCode ? { ...product, archived: true, active: false } : product);
  const archivedSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: archivedProducts,
    builderProducts: enablements,
  });
  assert.equal(archivedSelectable.some((product) => product.productCode === familyProducts[0].productCode), false, `${familyKey} archived master records disappear from new selections`);
  assert.equal({ productCode: familyProducts[0].productCode, selectedAt: "historical" }.productCode, familyProducts[0].productCode, `${familyKey} historical selection references remain stable after archive`);
});

const windowsRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "windows");
const entryRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "entry-door");
const garageRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "garage-door");
const payload = createSelectionPayloadFromProduct({
  workspaceId: DEMO_BUILDER_ORGANISATION_ID,
  projectId: "project-test",
  requirement: windowsRequirement,
  product: productsByFamily.windows[0],
});
assert.equal(payload.selected_details.familyKey, "windows", "Windows selection payload persists familyKey=windows");
assert.equal(payload.selected_details.frameMaterial, productsByFamily.windows[0].attributes.frameMaterial, "Windows selection payload persists frame material");
assert.equal(payload.selected_details.frameColour, productsByFamily.windows[0].attributes.frameColour, "Windows selection payload persists frame colour");
assert.equal(payload.selected_details.glassType, productsByFamily.windows[0].attributes.glassType, "Windows selection payload persists glass type");
assert.equal(payload.selected_details.selectedPrice, null, "Quote-required Windows selection does not persist a fake selected price");

const completedSelections = [
  selectionFor("bricks"),
  selectionFor("roofing"),
  { ...payload, selected_details: { ...payload.selected_details, variationPending: false, priceState: "Current Price", selectedPrice: 1 }, selection_status: "selected" },
];
const selectionMap = selectedByRequirement(completedSelections, EXTERIOR_REQUIREMENTS);
assert.equal(statusForRequirement(windowsRequirement, selectionMap.get("windows")), "complete", "Completed Windows marks green/complete when confirmed with a resolved state");
assert.equal(nextIncompleteRequirement(EXTERIOR_REQUIREMENTS, selectionMap, windowsRequirement)?.requirementKey, "entry-door", "Exterior auto-advance moves from Windows to Entry Doors");

const entrySelectionMap = selectedByRequirement([...completedSelections, selectionFor("entry-door")], EXTERIOR_REQUIREMENTS);
assert.equal(nextIncompleteRequirement(EXTERIOR_REQUIREMENTS, entrySelectionMap, entryRequirement)?.requirementKey, "garage-door", "Exterior auto-advance moves from Entry Doors to Garage Doors");

const garagePayload = createSelectionPayloadFromProduct({
  workspaceId: DEMO_BUILDER_ORGANISATION_ID,
  projectId: "project-test",
  requirement: garageRequirement,
  product: productsByFamily["garage-doors"][0],
});
assert.equal(garagePayload.selected_details.familyKey, "garage-doors", "Garage Door selection payload persists the garage-doors family");
assert.equal(garagePayload.selected_details.doorDesign, productsByFamily["garage-doors"][0].model, "Garage Door selection payload persists design/model");

function selectionFor(requirementKey) {
  const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === requirementKey);
  return {
    selection_status: "selected",
    selected_details: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
      priceState: "Current Price",
      selectedPrice: 1,
      variationPending: false,
    },
    metadata: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
    },
  };
}

console.log(`Exterior opening catalogue tests passed. Windows=${productsByFamily.windows.length} EntryDoors=${productsByFamily["entry-doors"].length} GarageDoors=${productsByFamily["garage-doors"].length}`);
