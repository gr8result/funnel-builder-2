// Run: node --import ./scripts/register-json-loader.mjs scripts/test-entry-door-library-quotation.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMasterProducts } from "../lib/product-library/catalogueService.js";
import { entryDoorLibraryQuoteRows, withEntryDoorLibraryQuotation } from "../lib/construction-estimation/entryDoorLibraryQuotation.js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { restoreCompleteWorkbook } from "../lib/construction-estimation/jobPersistence.js";

const products = getMasterProducts().filter((p) => p.familyKey === "entry-doors" && p.attributes.recordType === "entry_door_design");
const before = JSON.stringify(products);
assert.equal(products.filter((p) => p.manufacturer === "Hume Doors & Timber").length, 126);
assert.equal(products.filter((p) => p.manufacturer === "Corinthian Doors").length, 16);
const book = createEstimateBuilderWorkbookDefaults();
const sectionName = Object.keys(book.quotation).find((key) => /^DOORS(?: \(\d+\))?$/.test(key));
assert.ok(sectionName, "Use the existing DOORS section");
const rows = book.quotation[sectionName].rows;
assert.equal(rows.length, 142);
assert.equal(new Set(rows.map((r) => r.id)).size, 142);
assert.equal(new Set(rows.map((r) => r.productCode)).size, 142);
for (const product of products) {
  const row = rows.find((r) => r.canonicalProductId === product.productId);
  assert.ok(row, product.productCode);
  for (const key of ["productCode", "productName", "supplier", "brand", "manufacturer", "sku", "model", "size", "range", "priceStatus"]) {
    assert.equal(row[key], product[key], `${product.productCode}: ${key}`);
  }
  assert.equal(row.section, sectionName);
  assert.equal(row.doorStyle, product.attributes.design);
  assert.deepEqual(row.sizes, product.attributes.sizes);
  assert.deepEqual(row.variants, product.variants);
  assert.deepEqual(row.productLibrarySnapshot, product, "Preserve the complete individual catalogue record");
  assert.equal(row.excelRate, product.builderPrice ?? product.clientPrice ?? product.normalizedUnitPrice ?? "");
  assert.equal(row.quoteRequired, true);
  assert.equal(row.excelRate, "", "Unpriced products must not become $0 or estimated rates");
  assert.equal(row.quantity, "", "Catalogue availability must not select every door for the quote");
}
assert.equal(withEntryDoorLibraryQuotation(book.quotation), book.quotation, "Repeated sync adds nothing");

// Existing products can have different row IDs or live in a subsection. Preserve
// the exact saved rows, including prices, quantities, notes and inactive status.
const existing = { ...rows[0], id: "existing-door", manualRate: "456.78", quantity: "2", notes: "Existing estimate", active: false };
const codeOnly = { id: "existing-by-code", productCode: rows[1].productCode, quantity: "3" };
const snapshotOnly = { id: "existing-by-snapshot", productLibrarySnapshot: rows[2].productLibrarySnapshot, quantity: "1" };
const saved = {
  [sectionName]: { collapsed: false, rows: [existing] },
  "PIVOT DOOR (67)": { rows: [codeOnly, snapshotOnly] },
  WINDOWS: { rows: [{ id: "untouched" }] },
};
const savedBefore = JSON.stringify(saved);
const merged = withEntryDoorLibraryQuotation(saved);
assert.equal(JSON.stringify(saved), savedBefore, "Input must not be mutated");
assert.equal(merged[sectionName].rows.length, 140, "Three existing products must not be added again");
assert.equal(merged[sectionName].rows[0], existing);
assert.equal(merged["PIVOT DOOR (67)"], saved["PIVOT DOOR (67)"]);
assert.equal(merged.WINDOWS, saved.WINDOWS);
assert.equal(withEntryDoorLibraryQuotation(merged), merged);
const reopened = restoreCompleteWorkbook(book, JSON.parse(JSON.stringify({ ...book, quotation: merged })));
assert.deepEqual(withEntryDoorLibraryQuotation(reopened.quotation), merged);
assert.deepEqual(withEntryDoorLibraryQuotation({ "ENTRANCE DOORS (9)": { rows: [] } })["ENTRANCE DOORS (9)"].rows.map((r) => r.productCode), rows.map((r) => r.productCode));

const originalLog = console.log;
function calculate(workbook) {
  try { console.log = () => {}; return calculateEstimateBuilderWorkbook(workbook); }
  finally { console.log = originalLog; }
}
const preview = calculate(book);
assert.equal(preview.quotation[sectionName].rows.length, 142, "DOORS calculation must retain the catalogue rows");
assert.equal(preview.quotation[sectionName].subtotal, 0);
assert.ok(preview.quotation[sectionName].rows.every((r) => r.finalRateUsed === "" && r.sourceOfRate === "Quote required"));
const selected = { ...book, quotation: { ...book.quotation, [sectionName]: { ...book.quotation[sectionName], rows: rows.map((r, i) => i === 0 ? { ...r, quantity: "2", supplierQuote: "456.78" } : r) } } };
const selectedPreview = calculate(selected).quotation[sectionName];
assert.equal(selectedPreview.rows[0].qty, 2);
assert.equal(selectedPreview.rows[0].finalRateUsed, "456.78");
assert.equal(selectedPreview.rows[0].cost, 913.56);
assert.equal(selectedPreview.subtotal, 913.56);
assert.equal(JSON.stringify(getMasterProducts().filter((p) => p.familyKey === "entry-doors" && p.attributes.recordType === "entry_door_design")), before, "Product Library unchanged");
assert.equal(entryDoorLibraryQuoteRows().some((r) => r.productLibrarySnapshot.attributes.optionType === "entry-door-glass"), false);
const hook = readFileSync(new URL("../hooks/estimate-builder/useEstimateBuilderWorkbook.js", import.meta.url), "utf8");
assert.match(hook, /function normalizeWorkbook\([^]*?restored\.quotation = withEntryDoorLibraryQuotation\(restored\.quotation\)/, "Saved-job loader must add missing doors after restoration");
console.log("PASS: 126 Hume + 16 Corinthian in DOORS; exact IDs/codes/prices and metadata; no duplicates; saved rows/reopen preserved; visible calculation rows and supplier-quote totals; Product Library unchanged.");
