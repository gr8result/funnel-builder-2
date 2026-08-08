import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_SELECTIONS_CSV_PATH,
  GENERIC_DEMO_PRODUCTS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  PRODUCT_LIBRARY_SOURCE_CSV,
  TOP_LEVEL_AREAS,
  buildProductFamilyDefinitions,
  buildProductLibraryTaxonomy,
  familyByKey,
  familiesForArea,
  parseApprovedProductLibraryCsv,
  selectionQueryForFamily,
} from "../lib/product-library/catalogueModel.js";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, APPROVED_SELECTIONS_CSV_PATH);
const sourceText = fs.readFileSync(sourcePath, "utf8");
const audit = parseApprovedProductLibraryCsv(sourceText);
const taxonomy = buildProductLibraryTaxonomy(audit.usableRows);
const derivedFamilies = buildProductFamilyDefinitions(audit.usableRows);

assert.equal(PRODUCT_LIBRARY_SOURCE_CSV, "data/product-library/PRODUCTS-LIBRARY.csv", "catalogue source must be the approved repo CSV");
assert.ok(fs.existsSync(sourcePath), "approved product library CSV must exist");
assert.ok(!PRODUCT_LIBRARY_SOURCE_CSV.includes("Downloads"), "old local Downloads source must not be used");
assert.ok(!PRODUCT_LIBRARY_SOURCE_CSV.toLowerCase().includes("fixture"), "old demo fixture paths must not be used");
assert.equal(GENERIC_DEMO_PRODUCTS.length, 0, "generic demo products must not seed the standard selections template");

assert.ok(audit.totalPhysicalRows > 700, "approved CSV row count should be read from the canonical source");
assert.ok(audit.usableRows.length > 500, "approved CSV should yield quotation-derived product rows");
assert.ok(audit.headingRows.length > 20, "repeated section heading rows must be detected");
assert.ok(!audit.usableRows.some((row) => row.originalQuoteItemCode === "CODE"), "section heading rows must be ignored");
assert.ok(!audit.usableRows.some((row) => row.itemDescription.toUpperCase() === "ITEM"), "repeated ITEM header rows must be ignored");
assert.ok(audit.usableRows.every((row) => row.sourceRow > 0 && row.sourceRow <= audit.totalPhysicalRows), "all parsed rows must point back to approved CSV source rows");

const expectedTopLevelAreas = [
  "Exterior",
  "Interior",
  "Kitchen",
  "Bathroom & Ensuite",
  "Laundry",
  "Bedrooms",
  "Living Areas",
  "Garage",
  "Outdoor Areas",
  "Pool",
];
assert.deepEqual(TOP_LEVEL_AREAS.map((area) => area.displayName), expectedTopLevelAreas, "top-level selections areas must match the approved structure");
assert.deepEqual(taxonomy.areas.map((area) => area.displayName), expectedTopLevelAreas, "generated taxonomy must include every approved top-level area");

function categoryNames(areaKey) {
  return taxonomy.areas.find((area) => area.key === areaKey)?.categories.map((category) => category.displayName) || [];
}

["Bricks", "Feature Bricks", "Cladding", "Render", "Roofing", "Roof Colour", "Gutters", "Fascia", "Windows", "Entry Doors", "External Doors", "Garage Doors", "Balustrades", "Handrails", "Exterior Paint", "External Lighting", "Driveway Finishes", "Decking"].forEach((category) => {
  assert.ok(categoryNames("exterior").includes(category), `Exterior taxonomy must include ${category}`);
});
["Cabinetry", "Cabinet Finish", "Handles", "Benchtops", "Splashback", "Sink", "Sink Mixer", "Oven", "Cooktop", "Rangehood", "Dishwasher", "Microwave", "Flooring", "Lighting", "Paint"].forEach((category) => {
  assert.ok(categoryNames("kitchen").includes(category), `Kitchen taxonomy must include ${category}`);
});
["Vanity", "Basin", "Basin Mixer", "Shower Mixer", "Shower Outlet", "Shower Screen", "Bath", "Toilet", "Mirror", "Accessories", "Floor Tiles", "Wall Tiles", "Feature Tiles"].forEach((category) => {
  assert.ok(categoryNames("bathroom-ensuite").includes(category), `Bathroom & Ensuite taxonomy must include ${category}`);
});
["Internal Doors", "Door Hardware", "Skirting", "Architraves", "Paint", "Flooring", "Robes", "Window Furnishings"].forEach((category) => {
  assert.ok(categoryNames("interior").includes(category), `Interior taxonomy must include ${category}`);
});

const internalDoors = familyByKey("internal-doors");
assert.equal(internalDoors.topLevelArea, "interior", "Internal Doors must be under Interior");
assert.equal(internalDoors.category, "Fix Out", "Internal Doors must be under Fix Out / Interior");
assert.equal(internalDoors.subcategory, "Internal Doors", "Internal Doors subcategory must be explicit");
assert.ok(familiesForArea("interior").some((family) => family.familyKey === "internal-doors"), "Interior families must expose Internal Doors");
assert.ok(familiesForArea("exterior").some((family) => family.familyKey === "garage-doors"), "Exterior families must expose Garage Doors");

const forbiddenSupplierNames = /\b(PGH|Austral|Caesarstone|Smartstone|Hume|Colorbond|Colourbond)\b/i;
const platformFamilySchema = PRODUCT_FAMILIES.map((family) => ({
  familyKey: family.familyKey,
  displayName: family.displayName,
  topLevelArea: family.topLevelArea,
  category: family.category,
  subcategory: family.subcategory,
  sourceMatchers: family.sourceMatchers,
  requiredAttributes: family.requiredAttributes,
  optionalAttributes: family.optionalAttributes,
  supportedVariantTypes: family.supportedVariantTypes,
}));
assert.doesNotMatch(JSON.stringify(platformFamilySchema), forbiddenSupplierNames, "supplier names must not be hard-coded into mandatory platform structure");

const requiredFamilyKeys = ["stone-20mm-tops", "stone-40mm-tops", "bricks", "metal-roofing", "garage-doors", "internal-doors", "ovens", "tapware", "tiles", "flooring"];
requiredFamilyKeys.forEach((familyKey) => {
  const family = derivedFamilies.find((item) => item.familyKey === familyKey);
  assert.ok(family, `missing product family ${familyKey}`);
  ["familyKey", "displayName", "topLevelArea", "category", "subcategory", "linkedQuoteItemCode", "unit", "quantityRule", "requiredAttributes", "optionalAttributes", "supportedVariantTypes"].forEach((field) => {
    assert.ok(Object.hasOwn(family, field), `${familyKey} must define ${field}`);
  });
  assert.ok(Array.isArray(family.requiredAttributes), `${familyKey} requiredAttributes must be an array`);
  assert.ok(Array.isArray(family.optionalAttributes), `${familyKey} optionalAttributes must be an array`);
  assert.ok(Array.isArray(family.supportedVariantTypes), `${familyKey} supportedVariantTypes must be an array`);
});

function assertFamilyAttributes(familyKey, requiredAttributes, optionalAttributes, supportedVariantTypes) {
  const family = derivedFamilies.find((item) => item.familyKey === familyKey);
  requiredAttributes.forEach((attribute) => assert.ok(family.requiredAttributes.includes(attribute), `${familyKey} must require ${attribute}`));
  optionalAttributes.forEach((attribute) => assert.ok(family.optionalAttributes.includes(attribute), `${familyKey} must optionally support ${attribute}`));
  supportedVariantTypes.forEach((variant) => assert.ok(family.supportedVariantTypes.includes(variant), `${familyKey} must support ${variant} variants`));
}

assertFamilyAttributes("stone-20mm-tops", ["supplier", "brand", "range", "colour", "finish", "thickness"], ["edgeProfile", "image", "price", "supplierURL"], ["range", "colour", "finish", "thickness", "edgeProfile"]);
assertFamilyAttributes("stone-40mm-tops", ["supplier", "brand", "range", "colour", "finish", "thickness"], ["edgeProfile", "image", "price", "supplierURL"], ["range", "colour", "finish", "thickness", "edgeProfile"]);
assertFamilyAttributes("bricks", ["supplier", "brand", "range", "brickName", "colour"], ["texture", "format", "image", "price", "supplierURL"], ["range", "brickName", "colour", "texture", "format"]);
assertFamilyAttributes("metal-roofing", ["supplier", "brand", "profile", "range", "colour"], ["finish", "gauge", "image", "price", "supplierURL"], ["profile", "range", "colour", "finish", "gauge"]);
assertFamilyAttributes("internal-doors", ["supplier", "brand", "range", "design", "construction", "size", "finish"], ["glazing", "image", "price", "supplierURL"], ["range", "design", "construction", "size", "finish", "glazing"]);

const kitchenStoneQuery = selectionQueryForFamily({ areaKey: "kitchen", familyKey: "stone-20mm-tops" });
assert.equal(kitchenStoneQuery.area, "kitchen", "family selection query must stay area-scoped");
assert.throws(() => selectionQueryForFamily({ areaKey: "exterior", familyKey: "stone-20mm-tops" }), /does not belong/, "wrong-area queries must fail");
assert.ok(PRODUCT_LIBRARY_IMPORT_COLUMNS.includes("supplier_name"), "supplier data must stay organisation import data");
assert.ok(PRODUCT_LIBRARY_IMPORT_COLUMNS.includes("official_product_url"), "family model must support supplier URLs through imports");

console.log("Product Library approved-source taxonomy tests passed.");
