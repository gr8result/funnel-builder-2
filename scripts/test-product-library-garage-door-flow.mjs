import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GARAGE_DOOR_SELECTION_KEY,
  GENERIC_IMAGE_URLS,
  createSelectionFromProduct,
  demoGarageDoorProducts,
  familyByKey,
  productLibrarySelectionsFromJobFile,
  productsForGarageDoors,
  selectionKeyForFamily,
  writeProductLibrarySelectionToJobFile,
} from "../lib/product-library/catalogueModel.js";

const pageSource = readFileSync("pages/modules/builders/product-library.js", "utf8");
const family = familyByKey("garage-doors");
assert.ok(family, "Garage Doors family must exist");
assert.equal(family.topLevelArea, "exterior", "Garage Doors selection flow must be scoped to Exterior");
assert.equal(selectionKeyForFamily(family), GARAGE_DOOR_SELECTION_KEY, "Garage Doors selection key must be exact");

const demoProducts = demoGarageDoorProducts("org-test");
assert.equal(demoProducts.length, 2, "Garage Doors may seed only labelled generic demonstration products when no actual products exist");
demoProducts.forEach((product) => {
  assert.equal(product.familyKey, "garage-doors", "Demo product must stay in Garage Doors");
  assert.equal(product.topLevelArea, "exterior", "Demo product must stay in Exterior");
  assert.match(product.productName, /Generic Demonstration/i, "Demo product must be clearly labelled");
  assert.match(product.supplier, /Generic Demonstration/i, "Demo supplier must not pretend to be real");
  assert.match(product.brand, /Generic Demonstration/i, "Demo brand must not pretend to be real");
  assert.equal(product.clientPrice, 0, "Demo products must not invent client prices");
  assert.equal(product.builderCost, 0, "Demo products must not invent builder costs");
  assert.equal(product.primaryImage, GENERIC_IMAGE_URLS.garageDoors, "Garage Door products must use garage-door imagery");
  assert.ok(product.galleryImages.length >= 2, "Garage Door detail must have a gallery");
  assert.ok(product.variants.length >= 1, "Garage Door products must expose variants/sizes");
  assert.ok(product.officialProductURL, "Garage Door detail must expose an official product URL field");
  assert.ok(product.specificationURL, "Garage Door detail must expose a specification URL field");
});

const garageProducts = productsForGarageDoors([], "org-test");
assert.deepEqual(garageProducts.map((product) => product.productCode), demoProducts.map((product) => product.productCode), "Garage Doors must not fall back to the first unrelated category");
assert.equal(productsForGarageDoors([{ ...demoProducts[0], familyKey: "bricks", productName: "Bricks" }], "org-test")[0].familyKey, "garage-doors", "Garage Doors must not show Bricks fallback products");

const variant = demoProducts[0].variants[0];
const selection = createSelectionFromProduct(demoProducts[0], family, variant);
assert.equal(selection.selectionKey, GARAGE_DOOR_SELECTION_KEY, "Add to Selections must target the Garage Door selection slot");
assert.equal(selection.area, "exterior", "Selection area must be Exterior");
assert.equal(selection.familyKey, "garage-doors", "Selection family must be Garage Doors");
assert.equal(selection.productCode, "DEMO-GARAGE-SECTIONAL-WHITE", "Selected product must persist by exact product code");
assert.equal(selection.size, variant.size, "Variant size must be captured on the selection");
assert.equal(selection.price, 0, "Demo selection must not invent pricing");

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
  'setSelectedAreaKey("exterior")',
  'setSelectedCategoryKey("")',
  'data-category-key={categoryItem.key}',
  'data-family-key={familyItem.familyKey}',
].forEach((snippet) => {
  assert.ok(pageSource.includes(snippet), `Product Library page must support exact Garage Door routing/back flow: ${snippet}`);
});

[
  "Supplier:",
  "Brand:",
  "Range:",
  "Model:",
  "Size:",
  "Finish/colour:",
  "Official Product URL",
  "Specification URL",
  "Allowance",
  "Variation",
  "Add to Selections",
  "Save .gr8job",
  "Open .gr8job",
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

assert.ok(pageSource.includes("productsForGarageDoors(orgProducts"), "Garage Door page must use the exact Garage Door product resolver");
assert.ok(pageSource.includes("writeProductLibrarySelectionToJobFile"), "Add to Selections must write to the .gr8job selection model");
assert.ok(pageSource.includes("productLibrarySelectionsFromJobFile"), "Opening .gr8job must restore product library selections");

console.log("Product Library Garage Door selection flow tests passed.");
