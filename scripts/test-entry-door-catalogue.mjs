import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  normalizeMasterProductRecord,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";
import {
  PRICE_STATES,
  createSelectionPayloadFromProduct,
  guidedRequirementByKey,
} from "../lib/builders/clientSelectionWorkflow.js";

const require = createRequire(import.meta.url);
const catalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");

const products = catalogue.products
  .map((product) => normalizeMasterProductRecord(product))
  .filter((product) => product.familyKey === "entry-doors");

assert.ok(products.length >= 140, "Entry Doors must expose a comprehensive verified catalogue, not a six-item sample");

const bySupplier = products.reduce((counts, product) => {
  counts[product.supplier] = (counts[product.supplier] || 0) + 1;
  return counts;
}, {});
assert.ok(bySupplier["Hume Doors & Timber"] >= 126, "Hume entry-door designs must be imported from official range pages");
assert.ok(bySupplier["Corinthian Doors"] >= 15, "Corinthian entry-door designs must be imported from official product pages");
assert.equal(bySupplier["Supplier not recorded"] || 0, 0, "Entry-door supplier groups must not include incomplete legacy records");

const humeProducts = products.filter((product) => product.supplier === "Hume Doors & Timber");
const humeMissingFullDoorImages = humeProducts.filter((product) => !product.primaryImageUrl && product.imageStatus === "missing");
assert.equal(humeMissingFullDoorImages.length, 0, "Current official Hume Door Finder cards provide full-door images for imported entrance designs");

const humeRangeModels = (range) => humeProducts
  .filter((product) => product.range === range)
  .map((product) => product.model)
  .sort();
assert.deepEqual(humeRangeModels("Savoy 820"), ["XS11", "XS24-820", "XS26-820", "XS28-820", "XS45-820"], "Savoy 820 must expose each official Hume design as its own card");
assert.deepEqual(humeRangeModels("Savoy 1200"), ["XS24-1200", "XS26-1200", "XS28-1200", "XS45-1200"], "Savoy 1200 must expose each official Hume design as its own card");

const expectedHumeRanges = {
  "Bush Fire Resistant (BAL19 & BAL29 Doors)": 10,
  "Bushfire Resistant (BAL40 Doors)": 16,
  Carringbush: 3,
  "Elite Aluminium": 5,
  "Elite Aluminium with VJ Panel": 10,
  "Glass Opening": 3,
  Haven: 10,
  Illusion: 4,
  "Joinery Entrance": 7,
  "Linear Entrance": 12,
  Newington: 9,
  Nexus: 6,
  Regency: 4,
  "Savoy 1200": 4,
  "Savoy 820": 5,
  Vaucluse: 10,
  "Vaucluse Premier": 8,
};
for (const [range, count] of Object.entries(expectedHumeRanges)) {
  assert.equal(humeRangeModels(range).length, count, `${range} imported count must match official Hume Door Finder`);
}

const seenCodes = new Set();
for (const product of products) {
  assert.ok(product.productCode.startsWith("ENTRY-"), "Entry-door product code must be stable and exact");
  assert.ok(!seenCodes.has(product.productCode), `Duplicate entry-door product code: ${product.productCode}`);
  seenCodes.add(product.productCode);
  assert.equal(product.topLevelArea, "exterior", "Entry doors must stay in Exterior");
  assert.equal(product.priceStatus, "quote_required", "Entry doors must not invent current prices");
  assert.equal(product.clientPrice, null, "Entry doors must not store false $0 client prices");
  const hasExactImage = Boolean(product.primaryImageUrl);
  const hasExplicitMissingImage = product.imageStatus === "missing";
  assert.doesNotMatch(product.primaryImageUrl || "", /placeholder_wide/i, `${product.productCode} must not expose supplier placeholder imagery as a product image`);
  assert.ok(hasExactImage || hasExplicitMissingImage, `${product.productCode} must have an exact supplier image or explicit missing state`);
  if (hasExactImage) {
    assert.notEqual(resolveProductLibraryImage({ product, familyKey: "entry-doors" }), "", "Entry-door image resolution must not be blank");
  }
  assert.ok(product.officialProductUrl?.startsWith("https://"), "Entry-door product must link to the official supplier page");
  assert.ok(product.attributes?.dataSourceUrl?.startsWith("https://"), "Entry-door product must record source URL");
  assert.ok(product.attributes?.dataCheckedAt, "Entry-door product must record source checked date");
  assert.ok(Array.isArray(product.attributes?.sizes), "Entry-door sizes must be product-specific arrays");
  assert.ok(Array.isArray(product.attributes?.finishOptions), "Entry-door finishes must be product-specific arrays");
  assert.ok(Array.isArray(product.attributes?.glazingOptions), "Entry-door glazing must be product-specific arrays");
}

const requirement = guidedRequirementByKey("entry-door");
const corinthianGlazed = products.find((product) => product.supplier === "Corinthian Doors" && product.attributes?.glazingOptions?.includes("Translucent"));
assert.ok(corinthianGlazed, "At least one Corinthian entry door should expose supplier-confirmed translucent glazing");

const payload = createSelectionPayloadFromProduct({
  workspaceId: "test-workspace",
  projectId: "test-project",
  requirement,
  product: {
    ...corinthianGlazed,
    size: corinthianGlazed.attributes.sizes[0],
    configuration: corinthianGlazed.attributes.configurations?.[0] || "Single door",
    finish: corinthianGlazed.attributes.finishOptions[0],
    glazing: "Translucent",
    hardwareCompatibility: corinthianGlazed.attributes.hardwareOptions?.[0] || "Builder to confirm",
    metadata: {
      productEntity: {
        ...corinthianGlazed,
        size: corinthianGlazed.attributes.sizes[0],
        configuration: corinthianGlazed.attributes.configurations?.[0] || "Single door",
        finish: corinthianGlazed.attributes.finishOptions[0],
        glazing: "Translucent",
        hardwareCompatibility: corinthianGlazed.attributes.hardwareOptions?.[0] || "Builder to confirm",
        attributes: {
          ...corinthianGlazed.attributes,
          selectedSize: corinthianGlazed.attributes.sizes[0],
          selectedConfiguration: corinthianGlazed.attributes.configurations?.[0] || "Single door",
          selectedFinish: corinthianGlazed.attributes.finishOptions[0],
          selectedGlazing: "Translucent",
          selectedHardware: corinthianGlazed.attributes.hardwareOptions?.[0] || "Builder to confirm",
        },
      },
    },
  },
});

assert.equal(payload.selected_details.requirementKey, "entry-door");
assert.equal(payload.selected_details.priceState, PRICE_STATES.quoteRequired);
assert.equal(payload.client_selection_price, null, "Quote-required entry-door selection must keep selected price pending");
assert.equal(payload.variation_amount, null, "Quote-required entry-door selection must not create a false variation");
assert.equal(payload.selected_details.glazing, "Translucent");
assert.ok(payload.selected_details.selectedConfiguration, "Entry-door selection must persist selected configuration");
assert.ok(payload.selected_details.selectedHardware, "Entry-door selection must persist selected hardware choice");
assert.ok(payload.selected_details.dataSourceUrl?.startsWith("https://"), "Selection must retain supplier source URL");

console.log(`Entry-door catalogue test passed (${products.length} products: ${JSON.stringify(bySupplier)})`);
