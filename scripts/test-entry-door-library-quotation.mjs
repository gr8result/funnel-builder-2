// Run: node --import ./scripts/register-json-loader.mjs scripts/test-entry-door-library-quotation.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMasterProducts, toCanonicalProductContract } from "../lib/product-library/catalogueService.js";
import { entryDoorHasQuotePrice, entryDoorLibraryQuoteRows, withEntryDoorLibraryQuotation, withoutUnpricedEntryDoors } from "../lib/construction-estimation/entryDoorLibraryQuotation.js";
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
// Owner instruction 11 Nov 2026: DOORS lists only doors a regular supplier prices.
const pricedProducts = products.filter(entryDoorHasQuotePrice);
const expectedRows = pricedProducts.length;
assert.ok(expectedRows >= 90 && expectedRows < 142, `priced doors: ${expectedRows}`);
assert.equal(rows.length, expectedRows);
assert.equal(new Set(rows.map((r) => r.id)).size, expectedRows);
assert.equal(new Set(rows.map((r) => r.productCode)).size, expectedRows);
for (const product of products) {
  const row = rows.find((r) => r.canonicalProductId === product.productId);
  if (!entryDoorHasQuotePrice(product)) { assert.equal(row, undefined, `${product.productCode}: no supplier price, not listed`); continue; }
  assert.ok(row, product.productCode);
  for (const key of ["productCode", "productName", "supplier", "brand", "manufacturer", "sku", "model", "size", "range", "priceStatus"]) {
    if (key === "priceStatus") continue;
    assert.equal(row[key], product[key], `${product.productCode}: ${key}`);
  }
  assert.equal(row.section, sectionName);
  assert.equal(row.doorStyle, product.attributes.design);
  assert.deepEqual(row.sizes, product.attributes.sizes);
  assert.deepEqual(row.variants, product.variants);
  assert.deepEqual(row.productLibrarySnapshot, product, "Preserve the complete individual catalogue record");
  const canonical = toCanonicalProductContract(product);
  const verifiedPrice = canonical.price != null && ["supplier_price", "catalogue_rrp"].includes(canonical.priceSource)
    && Boolean(canonical.priceUpdatedAt && canonical.sourceUrl) && typeof canonical.priceIncludesGst === "boolean";
  assert.equal(row.priceStatus, verifiedPrice ? product.priceStatus : "quote_required", `${product.productCode}: price status follows verified evidence`);
  const expectedRate = !verifiedPrice ? "" : canonical.priceIncludesGst
    ? Math.round((canonical.price / 1.1) * 10000) / 10000
    : canonical.price;
  assert.equal(row.excelRate, expectedRate, "Only verified supplier/catalogue prices with known GST basis reach the quotation");
  assert.equal(row.quoteRequired, !verifiedPrice, "Unverified market estimates remain quote-required");
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
assert.equal(merged[sectionName].rows.length, expectedRows - 2, "Three existing products must not be added again");
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
assert.equal(preview.quotation[sectionName].rows.length, expectedRows, "DOORS calculation must retain the catalogue rows");
assert.equal(preview.quotation[sectionName].subtotal, 0);
// Owner-set prices (lib/construction-estimation/ownerQuotePrices.js, 10 Nov 2026) price the two Savoy 1200 doors.
const ownerPriced = new Set(Object.keys(JSON.parse(readFileSync(new URL("../data/pricing/supplier-prices.json", import.meta.url), "utf8")).entryDoors));
assert.ok(preview.quotation[sectionName].rows.filter((r) => r.quoteRequired && !ownerPriced.has(r.canonicalProductId)).every((r) => r.finalRateUsed === "" && r.sourceOfRate === "Quote required"), "estimate-only records stay unpriced");
// Doors the library already prices from a verified source keep that price.
// A supplier price is a confirmed price (12 Nov 2026): the row is no longer quote-required.
const supplierRows = preview.quotation[sectionName].rows.filter((r) => /ex GST\)$/.test(r.sourceOfRate || ""));
assert.ok(supplierRows.length > 0 && supplierRows.every((r) => ownerPriced.has(r.canonicalProductId) && r.finalRateUsed > 0 && r.quoteRequired === false && r.priceStatus === "Supplier price"), "supplier-priced doors carry an ex-GST rate and are no longer quote-required");
assert.ok(preview.quotation[sectionName].rows.filter((r) => !r.quoteRequired && !supplierRows.includes(r)).every((r) => Number(r.finalRateUsed) > 0 && r.sourceOfRate === "Product Library"), "verified catalogue RRPs flow through as rates");
const selected = { ...book, quotation: { ...book.quotation, [sectionName]: { ...book.quotation[sectionName], rows: rows.map((r, i) => i === 0 ? { ...r, quantity: "2", supplierQuote: "456.78" } : r) } } };
const selectedPreview = calculate(selected).quotation[sectionName];
assert.equal(selectedPreview.rows[0].qty, 2);
assert.equal(selectedPreview.rows[0].finalRateUsed, "456.78");
assert.equal(selectedPreview.rows[0].cost, 913.56);
assert.equal(selectedPreview.subtotal, 913.56);
assert.equal(JSON.stringify(getMasterProducts().filter((p) => p.familyKey === "entry-doors" && p.attributes.recordType === "entry_door_design")), before, "Product Library unchanged");
assert.equal(entryDoorLibraryQuoteRows().some((r) => r.productLibrarySnapshot.attributes.optionType === "entry-door-glass"), false);
// Saved jobs: unpriced catalogue doors are removed unless the builder used the row.
const unpricedProduct = products.find((p) => !entryDoorHasQuotePrice(p));
if (unpricedProduct) {
  const base = { entryDoorLibraryRow: true, canonicalProductId: unpricedProduct.productId, quantity: "", manualRate: "" };
  const savedJob = { [sectionName]: { rows: [{ ...base, id: "a" }, { ...base, id: "b", quantity: "1" }, { ...base, id: "c", manualRate: "900" }, rows[0]] }, WINDOWS: { rows: [] } };
  const cleaned = withoutUnpricedEntryDoors(savedJob);
  assert.deepEqual(cleaned[sectionName].rows.map((r) => r.id), ["b", "c", rows[0].id], "used rows and priced doors stay");
  assert.equal(cleaned.WINDOWS, savedJob.WINDOWS);
  assert.equal(withoutUnpricedEntryDoors(cleaned), cleaned, "nothing more to remove");
}
const hook = readFileSync(new URL("../hooks/estimate-builder/useEstimateBuilderWorkbook.js", import.meta.url), "utf8");
assert.match(hook, /function normalizeWorkbook\([^]*?restored\.quotation = withEntryDoorLibraryQuotation\(restored\.quotation\)/, "Saved-job loader must add missing doors after restoration");
// Saved jobs open exactly as saved (9 Nov 2026 rule): unpriced catalogue doors are left out by the
// calculation the quotation is drawn from, never by rewriting the saved rows.
if (unpricedProduct) {
  const unpricedRow = { entryDoorLibraryRow: true, canonicalProductId: unpricedProduct.productId, id: "saved-unpriced-door", quantity: "", manualRate: "" };
  const savedJob = { ...book, quotation: { ...book.quotation, [sectionName]: { ...book.quotation[sectionName], rows: [...book.quotation[sectionName].rows, unpricedRow] } } };
  assert.equal(calculate(savedJob).quotation[sectionName].rows.some((r) => r.id === "saved-unpriced-door"), false, "the calculation leaves out a saved unpriced catalogue door");
  assert.equal(savedJob.quotation[sectionName].rows.some((r) => r.id === "saved-unpriced-door"), true, "the saved row itself is untouched");
}
console.log(`PASS: ${expectedRows} supplier-priced doors of 126 Hume + 16 Corinthian in DOORS;`, " exact IDs/codes/prices and metadata; no duplicates; saved rows/reopen preserved; visible calculation rows and supplier-quote totals; Product Library unchanged.");
