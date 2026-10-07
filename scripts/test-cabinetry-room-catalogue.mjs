import assert from "node:assert/strict";
import polytec from "../data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js";
import laminex from "../data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.js";
import stone from "../data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js";
import polytecLaminate from "../data/product-library/catalogues/benchtops/AU-POLYTEC-LAMINATE-BENCHTOPS.js";
import laminexLaminate from "../data/product-library/catalogues/benchtops/AU-LAMINEX-LAMINATE-BENCHTOPS.js";
import { productSnapshot, productVariantSnapshot } from "../components/product-library/cabinetry/cabinetryUi.js";
import {
  PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE,
  PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS,
  getProductLibraryCabinetryColourRecords,
  getProductLibraryCabinetryHandleRecords,
  getProductLibraryCabinetryKickboardRecords,
  getProductLibraryCabinetryBenchtopRecords,
  isProductLibraryCabinetryRecordAvailable,
} from "../lib/product-library/cabinetryCatalogueSelectors.js";

const polytecSource = "data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js";
const laminexSource = "data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.js";
const stoneSource = "data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js";
const structuralSource = "lib/product-library/cabinetryCatalogueSelectors.js";
const cases = [
  ["Polytec cabinetry colours", polytec, getProductLibraryCabinetryColourRecords, { brand: "Polytec" }, polytecSource],
  ["Laminex cabinetry colours", laminex, getProductLibraryCabinetryColourRecords, { brand: "Laminex" }, laminexSource],
  ["Polytec laminate benchtops", polytecLaminate.products, getProductLibraryCabinetryBenchtopRecords, { material: "laminate", brand: "Polytec" }, "data/product-library/catalogues/benchtops/AU-POLYTEC-LAMINATE-BENCHTOPS.js"],
  ["Laminex laminate benchtops", laminexLaminate.products, getProductLibraryCabinetryBenchtopRecords, { material: "laminate", brand: "Laminex" }, "data/product-library/catalogues/benchtops/AU-LAMINEX-LAMINATE-BENCHTOPS.js"],
  ["Caesarstone", stone.products.filter((record) => record.supplier === "Caesarstone"), getProductLibraryCabinetryBenchtopRecords, { material: "stone", brand: "Caesarstone" }, stoneSource],
  ["Neolith", stone.products.filter((record) => record.supplier === "Neolith"), getProductLibraryCabinetryBenchtopRecords, { material: "stone", brand: "Neolith" }, stoneSource],
  ["Physical handles", PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE, getProductLibraryCabinetryHandleRecords, {}, `${structuralSource}:PRODUCT_LIBRARY_HANDLE_HOUSE_CATALOGUE`],
  ["Kickboards", PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS.filter((record) => record.id.startsWith("CABINETRY-KICK-PANEL-")), getProductLibraryCabinetryKickboardRecords, {}, `${structuralSource}:PRODUCT_LIBRARY_CABINETRY_STRUCTURAL_PRODUCTS`],
];

const results = cases.map(([family, raw, selector, options, source]) => {
  const records = selector(options);
  const available = selector({ ...options, availableOnly: true });
  assert.equal(records.length, raw.length, `${family}: actual family records reach the selector`);
  assert.deepEqual(available, records.filter(isProductLibraryCabinetryRecordAvailable), `${family}: availability is sourced from records`);
  assert.equal(new Set(records.map((record) => record.productId)).size, records.length, `${family}: stable product identity is unique`);
  assert.strictEqual(selector(options), records, `${family}: rendering does not rebuild catalogue arrays`);
  assert.strictEqual(selector({ ...options, availableOnly: true }), available, `${family}: availability filtering is cached`);
  for (const record of records) {
    assert.ok(record.id && record.productId, `${family}: canonical identity fields exist`);
    if (options.material !== "laminate") assert.ok(record.productCode && record.sku, `${family}: existing product codes retained`);
    assert.ok(record.productName, `${family}: a human-readable product name exists`);
    if (options.brand) assert.equal(record.brand, options.brand, `${family}: brands remain isolated`);
  }
  return { Family: family, "Raw Records": raw.length, "Selector Results": records.length, Available: available.length, Source: source };
});

assert.ok(getProductLibraryCabinetryColourRecords({ brand: "Laminex" })
  .filter((record) => /AbsoluteMatte/i.test(record.productRange))
  .every((record) => record.benchtopSuitability === false), "AbsoluteMatte panels do not become invented benchtop products");
assert.equal(getProductLibraryCabinetryBenchtopRecords({ material: "none" }).length, 0, "No Benchtop has no material product");
assert.equal(getProductLibraryCabinetryColourRecords({ brand: "unknown" }).length, 0, "An unavailable brand cannot leak another brand's records");
for (const record of getProductLibraryCabinetryHandleRecords()) {
  assert.ok(record.imageUrl && record.supplier && record.range && record.model, "Physical handles retain their supplier presentation");
  assert.ok(record.sizes.length && record.finishes.length, "Physical handle size and finish choices use source data");
}

for (const brand of ["Polytec", "Laminex"]) {
  const records = getProductLibraryCabinetryBenchtopRecords({ material: "laminate", brand });
  const variantIds = new Set();
  assert.ok(records.length > 0, `${brand}: verified laminate materials exist`);
  assert.equal(new Set(records.map((record) => record.colourName.toLowerCase())).size, records.length, `${brand}: colour variants share one parent`);
  for (const record of records) {
    assert.equal(record.benchtopSuitability, true);
    assert.equal(record.price, null);
    assert.equal(record.priceStatus, "quote_required");
    assert.equal(productSnapshot(record).requiresVariantSelection, true);
    assert.equal(productSnapshot(record).variants, undefined, "Room state does not contain catalogue variants");
    assert.ok(record.variants.length > 0);
    for (const variant of record.variants) {
      assert.ok(variant.sku && variant.productCode && variant.finish && variant.size && variant.imageUrl);
      assert.ok(new URL(variant.sourceUrl).hostname.endsWith(brand.toLowerCase() + ".com.au"));
      assert.ok(!variantIds.has(variant.id), `${brand}: unique sheet variant ${variant.id}`);
      variantIds.add(variant.id);
      const snapshot = productVariantSnapshot(record, variant);
      assert.equal(snapshot.productId, record.productId);
      assert.equal(snapshot.variantId, variant.id);
      assert.equal(snapshot.sku, variant.sku);
      assert.equal(snapshot.finish, variant.finish);
      assert.equal(snapshot.thicknessKind, "laminate_sheet");
      assert.equal(snapshot.variants, undefined);
    }
  }
}
for (const record of getProductLibraryCabinetryBenchtopRecords({ material: "stone" })) {
  assert.ok(record.thicknessOptions.length && record.finishOptions.length, "Stone retains supplier thickness and finish options");
  assert.equal(record.fabrication, undefined, "Material catalogue records do not contain room fabrication choices");
}

console.log("Family | Raw Records | Selector Results | Available");
for (const row of results) console.log(`${row.Family} | ${row["Raw Records"]} | ${row["Selector Results"]} | ${row.Available}`);
console.log("\nExact source files:");
for (const row of results) console.log(`${row.Family}: ${row.Source}`);
console.log("\nRaw Records counts records belonging to each requested family, not every unrelated record in its source file.");
console.log(`Source file totals: Polytec=${polytec.length}; Laminex=${laminex.length}; stone=${stone.products.length}.`);
console.log("Available counts active catalogue records, not live supplier stock. Kickboards are existing builder catalogue specifications.");
console.log(`Laminate colour families and sheet SKU variants: Polytec=${polytecLaminate.products.length}/${polytecLaminate.products.reduce((count, row) => count + row.variants.length, 0)}; Laminex=${laminexLaminate.products.length}/${laminexLaminate.products.reduce((count, row) => count + row.variants.length, 0)}.`);
console.log("Laminex is a verified manufacturer catalogue subset. Unknown prices require quotes; supplier stock is not asserted.");
console.log("Cabinetry room catalogue selector tests: PASS");
