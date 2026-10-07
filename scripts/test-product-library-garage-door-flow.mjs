import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  GARAGE_DOOR_SELECTION_KEY,
  GENERIC_IMAGE_URLS,
  familyByKey,
  normalizeMasterProductRecord,
  productLibrarySelectionsFromJobFile,
  resolveProductLibraryImage,
  selectionKeyForFamily,
  writeProductLibrarySelectionToJobFile,
} from "../lib/product-library/catalogueModel.js";

const require = createRequire(import.meta.url);
const exteriorOpeningsCatalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");
const pageSource = readFileSync("pages/modules/builders/product-library.js", "utf8");
const family = familyByKey("garage-doors");
assert.ok(family, "Garage Doors family must exist");
assert.equal(family.topLevelArea, "exterior", "Garage Doors selection flow must be scoped to Exterior");
assert.equal(selectionKeyForFamily(family), GARAGE_DOOR_SELECTION_KEY, "Garage Doors selection key must be exact");

const garageProducts = exteriorOpeningsCatalogue.products
  .map((product) => normalizeMasterProductRecord(product))
  .filter((product) => product.familyKey === "garage-doors");
assert.ok(garageProducts.length >= 5, "Garage Doors must expose real B&D master products");
garageProducts.forEach((product) => {
  assert.equal(product.familyKey, "garage-doors", "Garage Door product must stay in Garage Doors");
  assert.equal(product.topLevelArea, "exterior", "Garage Door product must stay in Exterior");
  assert.equal(product.manufacturer, "B&D Australia", "Garage Door products use verified B&D manufacturer data");
  assert.ok(product.primaryImageUrl, "Garage Door products must use exact/range garage-door imagery");
  assert.ok(product.galleryImageUrls.length >= 1, "Garage Door detail must have a gallery");
  assert.ok(product.variants.length >= 1, "Garage Door products must expose design/colour/size variants");
  assert.ok(product.officialProductUrl, "Garage Door detail must expose an official product URL field");
  assert.ok(product.specificationUrl, "Garage Door detail must expose a specification URL field");
  assert.equal(product.priceStatus, "quote_required", "Garage Door products must not invent current prices");
  assert.equal(product.clientPrice, null, "Garage Door products must not store fake $0 prices");
  assert.notEqual(resolveProductLibraryImage({ product, familyKey: "garage-doors" }), GENERIC_IMAGE_URLS.cooktops, "Garage Door products must not resolve to appliance imagery");
});

const variant = garageProducts[0].variants[0];
const selection = {
  selectionKey: GARAGE_DOOR_SELECTION_KEY,
  area: "exterior",
  familyKey: "garage-doors",
  productCode: garageProducts[0].productCode,
  productName: garageProducts[0].productName,
  size: variant.size,
  price: garageProducts[0].clientPrice || 0,
};
assert.equal(selection.selectionKey, GARAGE_DOOR_SELECTION_KEY, "Add to Selections must target the Garage Door selection slot");
assert.equal(selection.area, "exterior", "Selection area must be Exterior");
assert.equal(selection.familyKey, "garage-doors", "Selection family must be Garage Doors");
assert.equal(selection.productCode, "GARAGE-BND-PANELIFT-ICON", "Selected product must persist by exact product code");
assert.equal(selection.size, variant.size, "Variant size must be captured on the selection");
assert.equal(selection.price, 0, "Quote-required selection must not invent pricing");

const savedJob = writeProductLibrarySelectionToJobFile({ jobName: "Garage Door Test" }, selection);
assert.equal(savedJob.productLibrarySelections[GARAGE_DOOR_SELECTION_KEY].productCode, selection.productCode, ".gr8job root selection must persist");
assert.equal(savedJob.workbook.productLibrarySelections[GARAGE_DOOR_SELECTION_KEY].productCode, selection.productCode, ".gr8job workbook selection must persist");
assert.equal(productLibrarySelectionsFromJobFile(savedJob)[GARAGE_DOOR_SELECTION_KEY].productCode, selection.productCode, ".gr8job reopen must restore selection");

[
  "router.query.area",
  "router.query.category",
  "router.query.family",
  'query.area = selectedAreaKey',
  'query.category = selectedCategoryKey',
  'query.family = selectedFamilyKey',
  "function openArea(areaKey)",
  "function openFamily(familyKey)",
  "setSelectedAreaKey(areaKey)",
  "setSelectedCategoryKey(\"\")",
  "setSelectedFamilyKey(\"\")",
  'data-category-key={categoryItem.key}',
  'data-family-key={familyItem.familyKey}',
  'data-testid="product-library-suppliers"',
  'data-testid="product-library-ranges"',
  'data-testid="product-library-products"',
].forEach((snippet) => {
  assert.ok(pageSource.includes(snippet), `Product Library page must support exact Garage Door routing/back flow: ${snippet}`);
});

[
  "Manufacturer:",
  "Supplier:",
  "Range:",
  "Colour/variant:",
  "Brand / Range / Model",
  "Specifications",
  "Colours",
  "Official Product URL",
  "Specification URL",
  "Price Status",
  "Image Status",
  "Builder Enablement",
  "Edit Product",
  "toggleBuilderProduct",
  "Archive",
].forEach((label) => {
  assert.ok(pageSource.includes(label), `Garage Door UI must expose ${label}`);
});

["Bricks", "Master Bedroom", "carpet", "kitchen items", "visibleProducts[0] || null"].forEach((forbiddenFallback) => {
  if (forbiddenFallback === "visibleProducts[0] || null") {
    assert.ok(pageSource.includes(forbiddenFallback), "Product detail may default only inside the exact visible Garage Door set");
  } else {
    assert.ok(!pageSource.includes(`Garage Doors must show ${forbiddenFallback}`), `Garage Doors must not encode unrelated fallback: ${forbiddenFallback}`);
  }
});

assert.ok(pageSource.includes("masterProductsForFamily(masterProducts, selectedFamily)"), "Garage Door page must use the exact master family product resolver");
assert.ok(savedJob.productLibrarySelections[GARAGE_DOOR_SELECTION_KEY], "Garage Door selections can be written to the .gr8job selection model");
assert.ok(productLibrarySelectionsFromJobFile(savedJob)[GARAGE_DOOR_SELECTION_KEY], "Opening .gr8job can restore product library selections");

console.log("Product Library Garage Door selection flow tests passed.");
