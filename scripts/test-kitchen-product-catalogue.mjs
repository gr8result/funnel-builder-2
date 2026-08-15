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
  KITCHEN_REQUIREMENTS,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  selectedByRequirement,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const require = createRequire(import.meta.url);
const kitchenCatalogue = require("../data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json");

const kitchenProducts = kitchenCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const enablements = ensureDemoBuilderCatalogueEnablements(kitchenProducts, [], DEMO_BUILDER_ORGANISATION_ID);
const kitchenFamilyKeys = Array.from(new Set(KITCHEN_REQUIREMENTS.map((requirement) => requirement.familyKey)));

assert.equal(kitchenProducts.length, 29, "Kitchen catalogue must expose the seeded master products");
assert.equal(activeKitchenMasterProducts(kitchenProducts).length, kitchenProducts.length, "Kitchen demo enablement candidates cover the catalogue");

KITCHEN_REQUIREMENTS.forEach((requirement) => {
  const products = kitchenProducts.filter((product) => product.familyKey === requirement.familyKey && product.requirementKeys.includes(requirement.requirementKey));
  assert.ok(products.length > 0, `${requirement.label} has Product Library master records`);
  assert.ok(familyByKey(requirement.familyKey), `${requirement.familyKey} is a registered Product Library family`);
  assert.ok(PRODUCT_FAMILIES.some((family) => family.familyKey === requirement.familyKey), `${requirement.familyKey} is visible as a Product Library family`);
  assert.ok(products.every((product) => product.primaryImageUrl), `${requirement.label} products carry image URLs`);
  assert.ok(products.every((product) => ["quote_required", "price_pending"].includes(product.priceStatus)), `${requirement.label} products do not invent current prices`);
  assert.ok(products.every((product) => product.rrp === null && product.clientPrice === null), `${requirement.label} products do not store fake $0 prices`);
  assert.notEqual(resolveProductLibraryImage({ familyKey: requirement.familyKey }), FAMILY_IMAGE_FALLBACKS.bedrooms, `${requirement.label} fallback cannot be bedroom imagery`);
});

["ovens", "cooktops", "rangehoods", "dishwashers", "microwaves", "handles"].forEach((familyKey) => {
  assert.ok(kitchenProducts.filter((product) => product.familyKey === familyKey).every((product) => product.imageStatus === "verified_exact"), `${familyKey} uses exact product imagery`);
});
assert.equal(kitchenProducts.filter((product) => product.familyKey === "ovens").length, 5, "Kitchen includes at least five exact oven products");
assert.equal(kitchenProducts.filter((product) => product.familyKey === "cooktops").length, 5, "Kitchen includes at least five exact cooktop products");

kitchenFamilyKeys.forEach((familyKey) => {
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

const ovenRequirement = KITCHEN_REQUIREMENTS.find((requirement) => requirement.requirementKey === "oven");
const cooktopRequirement = KITCHEN_REQUIREMENTS.find((requirement) => requirement.requirementKey === "cooktop");
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

const selectedMap = selectedByRequirement([ovenPayload], KITCHEN_REQUIREMENTS);
assert.equal(nextIncompleteRequirement(KITCHEN_REQUIREMENTS, selectedMap, ovenRequirement)?.requirementKey, cooktopRequirement.requirementKey, "Kitchen auto-advance moves from Oven to Cooktop");

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

const selectionsSource = fs.readFileSync(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");
assert.match(selectionsSource, /AU-KITCHEN-PRODUCT-CATALOGUE\.json/, "Client Selections imports the Kitchen master catalogue");
assert.match(selectionsSource, /guided-kitchen-checklist/, "Kitchen opens as a progress checklist");
assert.match(selectionsSource, /KITCHEN COMPLETE\. Opening Interior\./, "Kitchen completion announces completion and opens the next Interior area");
assert.doesNotMatch(selectionsSource, /data\/product-library\/catalogues\/client-selections/i, "Kitchen must not load a client-only catalogue");

const productLibrarySource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(productLibrarySource, /AU-KITCHEN-PRODUCT-CATALOGUE\.json/, "Product Library imports the Kitchen master catalogue");
assert.match(productLibrarySource, /kitchenFamilyKeys/, "Product Library Kitchen area exposes shared Kitchen families");

const exactImages = kitchenProducts.filter((product) => product.imageStatus === "verified_exact").length;
const fallbackImages = kitchenProducts.filter((product) => ["family_fallback", "review_required"].includes(product.imageStatus)).length;
console.log(`Kitchen catalogue tests passed. Products=${kitchenProducts.length} ExactImages=${exactImages} FallbackOrReview=${fallbackImages}`);
