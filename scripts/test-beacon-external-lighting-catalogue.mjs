import fs from "node:fs";
import assert from "node:assert/strict";
import {
  EXTERNAL_LIGHTING_CATEGORIES,
  externalLightingCategory,
  externalLightingProductMatches,
  externalLightingSku,
  externalLightingScheduleWorkflowProduct,
} from "../lib/builders/clientSelectionWorkflow.js";

const cataloguePath = "data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));
const products = catalogue.products.filter((product) => product.family_key === "external-lighting");

assert.equal(products.length, 204, "External Lighting should expose the rebuilt Beacon catalogue plus the imported bollard/step/garden categories");
assert.equal(products.every((product) => product.manufacturer === "Beacon Lighting"), true, "Every External Lighting product must be a Beacon record");
assert.equal(products.every((product) => product.active === "true" && product.archived === "false"), true, "Beacon External Lighting products must be active");

// Beacon has delisted these two: their product pages return 404, so no official image
// can be verified for them. They are kept out of the image assertion rather than
// weakening it for every product. Decide whether to discontinue them in the catalogue.
const delistedWithoutImage = ["BEACON-EXT-2396410", "BEACON-EXT-2370160"];

const removedCodes = ["LIGHT-BRILLIANT-DORMON-ENTASIS-CHARCOAL", "LIGHT-BRILLIANT-EAVE-LANTERN-CHARCOAL", "LIGHT-BUILDER-BOLLARD-EXTERIOR"];
for (const code of removedCodes) {
  assert.equal(products.some((product) => product.product_code === code), false, `${code} must not remain in the Beacon External Lighting catalogue`);
}

for (const product of products) {
  assert.ok(product.product_name, "Beacon product must have a product name");
  assert.ok(product.attributes?.beaconSku, `${product.product_code} must carry Beacon SKU metadata`);
  assert.notEqual(product.attributes.beaconSku, "857143", "Review rating fragments must not be stored as Beacon SKUs");
  assert.ok(product.official_product_url?.startsWith("https://www.beaconlighting.com.au/"), `${product.product_code} must link to Beacon`);
  if (!delistedWithoutImage.includes(product.product_code)) {
    // Beacon serves product images from both its site and its asset CDN.
    assert.ok(
      /^https:\/\/(www\.beaconlighting\.com\.au\/media\/catalog\/product\/|assets\.beaconlighting\.com\.au\/images\/)/.test(product.primary_image_url || ""),
      `${product.product_code} must use an official Beacon product image`,
    );
  }
  assert.ok(EXTERNAL_LIGHTING_CATEGORIES.includes(externalLightingCategory(product)), `${product.product_code} must map to a supported UI category`);
  assert.doesNotMatch(`${product.product_name} ${product.range}`, /table lamp|floor lamp|lamp shade|lamp base/i, `${product.product_code} must not be an internal table/floor lamp`);
}

const categoryCounts = products.reduce((counts, product) => {
  const category = externalLightingCategory(product);
  counts[category] = (counts[category] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(categoryCounts, {
  "Wall Lights": 24,
  "Low Voltage": 3,
  "Solar": 10,
  "Floodlights": 19,
  "Security & Sensor": 22,
  "Ceiling & Pendant": 9,
  "Step & Deck": 46,
  "Garden & Landscape": 55,
  "Bollards & Posts": 16,
});

// The three categories that used to render an empty picker must stay populated.
for (const category of ["Bollards & Posts", "Step & Deck", "Garden & Landscape"]) {
  assert.ok(categoryCounts[category] > 0, `${category} must offer products in Client Selections`);
}

// Everything the selection card renders has to be present on an imported product.
const imported = products.filter((product) => ["Bollards & Posts", "Step & Deck", "Garden & Landscape"].includes(externalLightingCategory(product)));
for (const product of imported) {
  assert.ok(Number(product.current_listed_price) > 0, `${product.product_code} must carry a supplier price`);
  assert.ok(product.primary_image_url, `${product.product_code} must carry a product image`);
  assert.ok(product.source_retrieved_at, `${product.product_code} must record when it was retrieved`);
  assert.equal(product.image_status, "verified_official_product_page", `${product.product_code} image must be verified against the product page`);
}

const matching1200 = products.filter((product) => externalLightingProductMatches(product, { search: "2303181" }));
assert.equal(matching1200.length, 1, "Searching by Beacon SKU must return the exact product");

const wallLight = products.find((product) => externalLightingSku(product) === "2303181");
const sensorSpotlight = products.find((product) => externalLightingSku(product) === "2409230");
assert.ok(wallLight?.current_listed_price, "Fixture requires the front-entry wall light to carry current pricing");
assert.ok(sensorSpotlight?.current_listed_price, "Fixture requires the garage sensor spotlight to carry current pricing");

const selected = externalLightingScheduleWorkflowProduct([
  {
    product: wallLight,
    quantity: 2,
    locations: [
      { lightingPointId: "EL01", floor: "Ground", elevation: "Front", location: "Front entry", notes: "left side", switching: "Entry switch" },
      { lightingPointId: "EL02", floor: "Ground", elevation: "Front", location: "Front entry", notes: "right side", switching: "Entry switch" },
    ],
  },
  {
    product: sensorSpotlight,
    quantity: 1,
    locations: [
      { lightingPointId: "EL03", floor: "Ground", elevation: "Front", location: "Garage exterior", notes: "above garage opening", switching: "Sensor/manual override", sensorRequirement: "Sensor included" },
    ],
  },
], { allowance: 100, defaultQuantity: 1 }, { revision: 2, projectId: "demo-project" });

assert.equal(selected.externalLightingSelection.supplier, "Beacon Lighting");
assert.equal(selected.externalLightingSelection.isSchedule, true);
assert.equal(selected.externalLightingSelection.summary.totalProducts, 2);
assert.equal(selected.externalLightingSelection.summary.totalFittings, 3);
assert.equal(selected.externalLightingSelection.summary.missingLocations, 0);
assert.equal(selected.externalLightingSelection.quantity, 3);
assert.equal(selected.externalLightingSelection.scheduleLines.length, 2);
assert.equal(selected.lightingSchedule.length, 3, "Electrical schedule must carry one row per lighting point");
assert.equal(selected.procurementSchedule.length, 2, "BOQ/procurement must carry one row per product line");
assert.match(selected.procurementSchedule[0].locationReferences, /EL01: Front entry, left side/);
assert.match(selected.procurementSchedule[0].locationReferences, /EL02: Front entry, right side/);
assert.match(selected.procurementSchedule[1].locationReferences, /EL03: Garage exterior, above garage opening/);
assert.equal(selected.electricalContractorSchedule.length, 3);
assert.equal(selected.supplierProcurementStatus, "ready_for_rfq");
assert.ok(selected.externalLightingSelection.dashboardSummary.includes("3 fittings selected"), "Dashboard summary must describe total fittings");
assert.ok(selected.externalLightingSelection.selectedPrice > 0, "Selected Beacon products must carry quantity-priced value into variations");
assert.ok(selected.externalLightingSelection.variation > 0, "The sample schedule must create a positive variation against a $100 allowance");

const withoutImage = products.filter((product) => !product.primary_image_url).map((product) => product.product_code).sort();
assert.deepEqual(withoutImage, [...delistedWithoutImage].sort(), "Only the known delisted products may lack an image");

console.log("Beacon External Lighting catalogue regression passed.", categoryCounts);
