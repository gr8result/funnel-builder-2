import assert from "node:assert/strict";
import fs from "node:fs";
import {
  GENERIC_DEMO_PRODUCTS,
  PRODUCT_ENTITY_FIELDS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  TOP_LEVEL_AREAS,
  createProductEntity,
  familiesForArea,
  familyByKey,
  parseApprovedProductLibraryCsv,
  productMatchesFamily,
  productsForFamily,
  selectionQueryForFamily,
  validateProductImportRows,
} from "../lib/product-library/catalogueModel.js";

const sourcePath = "C:/Users/grant/Downloads/PRODUCTS LIBRARY.csv";
const sourceText = fs.readFileSync(sourcePath, "utf8");
const audit = parseApprovedProductLibraryCsv(sourceText);

assert.equal(audit.totalPhysicalRows, 747, "approved CSV physical row count must be stable");
assert.equal(audit.usableRows.length, 614, "approved CSV usable item row count must be stable");
assert.ok(audit.headingRows.length > 20, "repeated section heading rows must be detected");
assert.ok(!audit.usableRows.some((row) => row.itemDescription === "ITEM"), "section/header rows must be excluded from item rows");
assert.equal(audit.rowsWithQuoteItemCodes, 0, "blank CODE cells must not be fabricated into quote item codes");
assert.equal(audit.rowsWithoutUsableCodes, audit.usableRows.length, "rows without usable codes must be reported");
assert.ok(audit.broadFamilyRows.length > 100, "broad quote rows must be recognised as product family source rows");

const topAreaKeys = TOP_LEVEL_AREAS.map((area) => area.key);
["exterior", "interior", "kitchen", "bathroom-ensuite", "laundry", "bedrooms", "living-areas", "garage", "outdoor-areas", "pool"].forEach((key) => {
  assert.ok(topAreaKeys.includes(key), `missing top-level area ${key}`);
});

const stone = familyByKey("stone-benchtops");
const roof = familyByKey("metal-roofing");
const bricks = familyByKey("bricks");
const doors = familyByKey("internal-doors");

assert.equal(stone.topLevelArea, "kitchen", "Stone Benchtops must live under Kitchen");
assert.ok(stone.requiredAttributes.includes("range") && stone.requiredAttributes.includes("colour"), "Stone must support range and colour variants");
assert.equal(roof.topLevelArea, "exterior", "Metal Roofing must live under Exterior");
assert.ok(roof.supportedVariantTypes.includes("profile") && roof.supportedVariantTypes.includes("colour"), "Roofing must support profile and colour variants");
assert.equal(bricks.category, "Bricks", "Bricks family must keep the Bricks category");
assert.ok(bricks.requiredAttributes.includes("brand") && bricks.requiredAttributes.includes("range"), "Bricks must support brand and range");
assert.equal(doors.topLevelArea, "interior", "Internal Doors must live under Interior");
assert.equal(doors.category, "Fix Out", "Internal Doors must exist under Interior / Fix Out");
assert.equal(doors.subcategory, "Internal Doors", "Internal Doors must keep the Internal Doors subcategory");
assert.doesNotMatch(JSON.stringify(doors), /Hume/i, "Internal Doors must not be tied to Hume");

assert.ok(familiesForArea("kitchen").some((family) => family.familyKey === "ovens"), "Kitchen must expose Ovens");
assert.ok(familiesForArea("exterior").some((family) => family.familyKey === "garage-doors"), "Exterior must expose Garage Doors");
assert.ok(PRODUCT_FAMILIES.every((family) => family.image && /^https:\/\//.test(family.image)), "generic category images must render as image URLs");

const demoCodes = new Set();
GENERIC_DEMO_PRODUCTS.forEach((product) => {
  assert.ok(!demoCodes.has(product.productCode), `duplicate generic product code ${product.productCode}`);
  demoCodes.add(product.productCode);
  assert.equal(product.organisationId, "generic-demo", "generic demos must be clearly scoped away from real organisations");
  assert.equal(product.priceSource, "generic-demo", "generic demos must not pretend to be commercial data");
});

const orgAStone = createProductEntity({
  product_code: "ORG-A-STONE-1",
  product_family: "stone-benchtops",
  product_name: "Organisation A Stone White",
  supplier_name: "Organisation A Supplier",
  brand: "Private Brand",
  range: "Private Range",
  colour: "White",
  finish: "Honed",
  linked_quote_item_code: stone.approvedSourceKey,
}, "org-a");
const orgBStone = createProductEntity({
  product_code: "ORG-B-STONE-1",
  product_family: "stone-benchtops",
  product_name: "Organisation B Stone White",
  supplier_name: "Organisation B Supplier",
  brand: "Private Brand",
  range: "Private Range",
  colour: "White",
  finish: "Honed",
  linked_quote_item_code: stone.approvedSourceKey,
}, "org-b");
assert.equal(orgAStone.organisationId, "org-a");
assert.equal(orgBStone.organisationId, "org-b");
assert.notEqual(orgAStone.supplier, orgBStone.supplier, "organisation supplier data must not be hard-coded");

assert.ok(productMatchesFamily({ metadata: { familyKey: "stone-benchtops" }, product_name: "Stone" }, stone), "metadata family key must match exact family");
assert.equal(productsForFamily([orgAStone, orgBStone], roof).length, 0, "exact-category selection query must not fall back to unrelated products");
const stoneQuery = selectionQueryForFamily({ areaKey: "kitchen", familyKey: "stone-benchtops" });
assert.deepEqual(stoneQuery, {
  area: "kitchen",
  familyKey: "stone-benchtops",
  linkedQuoteItemCode: stone.approvedSourceKey,
  category: "Benchtops",
  subcategory: "Stone Tops",
});
assert.throws(() => selectionQueryForFamily({ areaKey: "exterior", familyKey: "stone-benchtops" }), /does not belong/, "wrong-area queries must fail instead of falling back");

assert.ok(PRODUCT_LIBRARY_IMPORT_COLUMNS.includes("supplier_name"), "supplier import must include supplier_name");
assert.ok(PRODUCT_LIBRARY_IMPORT_COLUMNS.includes("specification_url"), "supplier import must include specification_url");
assert.ok(PRODUCT_ENTITY_FIELDS.pricing.includes("builderCost"), "shared product entity must include builder cost");

const importRows = validateProductImportRows([
  {
    product_code: "IMP-1",
    product_family: "bricks",
    product_name: "Imported Generic Brick",
    supplier_name: "Builder Supplier",
    brand: "Builder Brand",
    range: "Builder Range",
    colour: "Charcoal",
    linked_quote_item_code: bricks.approvedSourceKey,
  },
  {
    product_code: "IMP-1",
    product_family: "bricks",
    product_name: "Duplicate Brick",
  },
  {
    product_code: "BAD-1",
    product_family: "not-a-family",
    product_name: "Bad Product",
  },
], "org-a");
assert.equal(importRows[0].errors.length, 0, "valid import row must create/update");
assert.ok(importRows[1].errors.includes("Duplicate product_code in import"), "duplicate-code detection must run");
assert.ok(importRows[2].errors.includes("Invalid or missing product_family"), "invalid family rows must be blocked");

const pageSource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(pageSource, /Product Library Admin/, "technical admin tools must live under Product Library Admin");
assert.match(pageSource, /Manage the suppliers, products, finishes and options available for project selections\./, "standard Product Library banner must render");
assert.match(pageSource, /No products have been added for this category yet\./, "empty category state must be explicit");
assert.doesNotMatch(pageSource, /Quotation Builder/, "Product Library page must not rebuild Quotation Builder");

const selectionsBookSource = fs.readFileSync(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");
assert.match(selectionsBookSource, /Inclusions & Selections/, "Inclusions & Selections banner title must render");
assert.match(selectionsBookSource, /Choose project areas, products and finishes and prepare the completed selections schedule\./, "Inclusions & Selections banner subtitle must render");
assert.match(selectionsBookSource, /standardBack/, "Inclusions & Selections banner must include Back control");

console.log("Product Library shared catalogue tests passed.");
