import fs from "node:fs";
import assert from "node:assert/strict";
import windowsDoorsGarageCatalogue from "../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json" with { type: "json" };
import {
  GARAGE_DOOR_COLOUR_CATALOGUE,
  garageDoorColourOptionsForProduct,
  garageDoorEnabledSupplierOptions,
  garageDoorProfileOptions,
  productsForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";
import {
  normalizeMasterProductRecord,
} from "../lib/product-library/catalogueModel.js";

const garageImage = "/images/product-library/garage-doors/garage-doors-modern-flatline.webp";
assert.ok(fs.existsSync("public/images/product-library/garage-doors/garage-doors-modern-flatline.webp"), "Garage dashboard image must be a managed public asset");

const workflowSource = fs.readFileSync("lib/builders/clientSelectionWorkflow.js", "utf8");
assert.match(workflowSource, /isClientSelectionsExcludedProduct/, "Client Selections must explicitly filter excluded products");
assert.match(workflowSource, /garage\\s\*door\\s\*jambs\?/, "Garage door jambs must be excluded from Client Selections product matching");

const standaloneSource = fs.readFileSync("pages/modules/builders/client-selections.js", "utf8");
assert.ok(standaloneSource.includes(garageImage), "Standalone Client Selections must use the managed garage dashboard image");
assert.ok(standaloneSource.includes("Save and Return to Dashboard"), "Standalone Garage Doors selection must expose Save and Return to Dashboard");
assert.ok(!standaloneSource.includes("Next Selection"), "Standalone Client Selections product view must not silently advance to the next category");

const embeddedSource = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
assert.ok(embeddedSource.includes(garageImage), "Embedded selections dashboard must use the managed garage dashboard image");
assert.ok(embeddedSource.includes("returnToGuidedDashboard"), "Embedded selections must return to the dashboard after a guided commit");
assert.ok(embeddedSource.includes("Save and Return to Dashboard"), "Embedded Garage Doors selection must expose Save and Return to Dashboard");
assert.ok(!embeddedSource.includes("navigateToGuidedRequirement(nextRequirement)"), "Embedded guided saves must not auto-open the next incomplete category");

const estimatingCsv = fs.readFileSync("data/product-library/PRODUCTS-LIBRARY.csv", "utf8");
assert.match(estimatingCsv, /SINGLE GARAGE DOOR JAMB/i, "Single garage-door jamb estimating item must remain in the source catalogue");
assert.match(estimatingCsv, /DOUBLE GARAGE DOOR JAMB/i, "Double garage-door jamb estimating item must remain in the source catalogue");

const estimatingWorkbook = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
assert.match(estimatingWorkbook, /GARAGE DOOR JAMBS/i, "Garage-door jamb estimating section must remain in Estimate Builder");

const garageRequirement = {
  areaKey: "exterior",
  areaLabel: "Exterior",
  requirementKey: "garage-door",
  familyKey: "garage-doors",
  linkedQuoteItemCode: "",
};
const selectableDoor = normalizeMasterProductRecord({
  product_code: "TEST-GARAGE-DOOR",
  family_key: "garage-doors",
  top_level_area: "exterior",
  product_name: "B&D Panelift Sectional Garage Door",
  manufacturer: "B&D",
  brand: "B&D",
  row_classification: "actual_product",
  active: true,
});
const jambProduct = normalizeMasterProductRecord({
  product_code: "TEST-GARAGE-JAMB",
  family_key: "garage-doors",
  top_level_area: "exterior",
  product_name: "Single Garage Door Jamb 163 x 31 primed",
  category: "Garage Door Jambs",
  row_classification: "actual_product",
  active: true,
});
const results = productsForRequirement([selectableDoor, jambProduct], garageRequirement);
assert.deepEqual(results.map((product) => product.productCode), ["TEST-GARAGE-DOOR"], "Garage Door Jamb must be filtered from Client Selections only");

const enabledGarageProducts = windowsDoorsGarageCatalogue.products
  .filter((product) => product.family_key === "garage-doors" && product.active === "true" && product.archived !== "true")
  .map((product) => normalizeMasterProductRecord(product));
const enabledSuppliers = garageDoorEnabledSupplierOptions(enabledGarageProducts);
assert.deepEqual(enabledSuppliers.map((supplier) => supplier.label), ["B&D Australia"], "Only verified/enabled B&D garage-door products should feed the selector");
assert.equal(GARAGE_DOOR_COLOUR_CATALOGUE.length, 42, "B&D colour catalogue should expose the verified structured records");
const bndPanelift = enabledGarageProducts.find((product) => /Panelift/i.test(`${product.range} ${product.productName}`));
assert.ok(bndPanelift, "B&D Panelift product must be available for colour compatibility testing");
assert.deepEqual(garageDoorProfileOptions(bndPanelift), ["Nullarbor", "Seville", "Madrid", "Statesman", "Grange"], "B&D Panelift profiles should be supplier-specific");
const sevilleColours = garageDoorColourOptionsForProduct(bndPanelift, { profile: "Seville" });
assert.ok(sevilleColours.some((colour) => colour.officialName === "Monument" && colour.finishFamily === "Standard COLORBOND"), "B&D Seville should include Monument COLORBOND");
assert.ok(sevilleColours.some((colour) => colour.finishFamily === "Timbergrain"), "B&D Seville should include compatible Timbergrain finishes");
assert.ok(!sevilleColours.some((colour) => /Steel-Line|UniCote/i.test([colour.supplierName, colour.officialName, colour.finishFamily].join(" "))), "B&D colour selector must not leak Steel-Line-only finishes");

console.log("Exterior Doors Client Selections regression checks passed.");
