// Product Library price -> Client Selections price -> Quotation Builder price -> Qty x Price = Cost,
// for one Hume door, one Corinthian door, one appliance and one plumbing fixture, through the
// production modules. Every module must resolve the same canonical product and the same price.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-product-price-pipeline.mjs
import assert from "node:assert/strict";
import { getMasterProducts, isProductVisible, toCanonicalProductContract } from "../lib/product-library/catalogueService.js";
import { masterProductToClientSelectionProduct, resolveProductPrice } from "../lib/product-library/catalogueModel.js";
import { productPriceLabel } from "../lib/product-library/productPresentation.js";
import { createSelectionPayloadFromProduct, productClientPrice } from "../lib/builders/clientSelectionWorkflow.js";
import { plumbingLineFromProduct } from "../lib/builders/plumbingFixtureAllocation.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { withEntryDoorLibraryQuotation } from "../lib/construction-estimation/entryDoorLibraryQuotation.js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

const products = getMasterProducts().filter(isProductVisible);
const byCode = (code) => products.find((product) => product.productCode === code);
const hume = byCode("ENTRY-HUME-SAVOY-1200-XS28-1200");
const corinthian = products.find((product) => product.familyKey === "entry-doors" && product.brand === "Corinthian Doors" && product.attributes?.recordType === "entry_door_design");
// An appliance whose importer left a stale price_pending flag on a real published price.
const appliance = products.find((product) => product.categoryKey === "Appliances" && product.priceStatus === "price_pending" && resolveProductPrice(product).price !== null);
const plumbing = products.find((product) => product.categoryKey === "Kitchen Taps" && resolveProductPrice(product).price !== null);
// A Hume entry door priced from a matched public retail listing (GST inclusive).
const humeRetail = products.find((product) => product.familyKey === "entry-doors" && /^Bunnings retail/.test(product.priceSourceNote || ""));
assert.ok(hume && corinthian && appliance && plumbing && humeRetail, "all test products exist");

const requirement = (requirementKey) => ({ requirementKey, label: requirementKey, areaKey: "test", areaLabel: "Test", defaultAllowance: 0, defaultQuantity: 1, unit: "EACH" });
const clientSelection = (product, requirementKey) => {
  const selectable = masterProductToClientSelectionProduct(product);
  return createSelectionPayloadFromProduct({ workspaceId: "w", projectId: "p", snapshotId: "s", sessionId: "x", requirement: requirement(requirementKey), product: selectable });
};

// Quotation Builder: doors through the DOORS section built from the Product Library; the appliance
// and plumbing fixture through the Client Selections -> quotation connector. Qty 1 on each line.
let workbook = createEstimateBuilderWorkbookDefaults();
const allocatedRow = (product, requirementKey) => ({ guidedSelection: { requirementKey, plumbingAllocation: { lines: [plumbingLineFromProduct(product, { unitPrice: productClientPrice(masterProductToClientSelectionProduct(product)), allocations: [{ location: "Kitchen", quantity: 1 }] })] } } });
workbook = connectAllocatedSelectionsToQuotation(workbook, { rooms: [{ rows: [allocatedRow(appliance, "cooktop"), allocatedRow(plumbing, "kitchen-mixer")] }] });
workbook.quotation = withEntryDoorLibraryQuotation(workbook.quotation);
const matchesProduct = (product) => (row) => row.canonicalProductId === product.productId || row.productId === product.productId || row.productCode === product.productCode;
const rowsOf = (quotation) => Object.values(quotation).flatMap((section) => section.rows || []);
for (const product of [hume, humeRetail, corinthian, appliance, plumbing]) {
  const row = rowsOf(workbook.quotation).find(matchesProduct(product));
  if (row && !String(row.quantity ?? "").trim()) Object.assign(row, { quantity: "1", quantityManualOverride: true });
}
const calculated = calculateEstimateBuilderWorkbook(workbook).quotation;
const quoteRow = (product) => rowsOf(calculated).find(matchesProduct(product));

const results = [];
for (const [label, product, requirementKey] of [["Hume door", hume, "entry-door"], ["Hume door (retail price)", humeRetail, "entry-door"], ["Corinthian door", corinthian, "entry-door"], ["Appliance", appliance, "cooktop"], ["Plumbing fixture", plumbing, "kitchen-mixer"]]) {
  const library = resolveProductPrice(product);
  const selection = clientSelection(product, requirementKey).selected_details;
  const row = quoteRow(product);
  assert.ok(row, `${label}: Quotation Builder row resolves the canonical product`);
  const quoteRate = row.finalRateUsed === "" || row.finalRateUsed == null ? null : Number(String(row.finalRateUsed).replace(/[$,]/g, ""));
  const qty = Number(row.qty) || 0;
  assert.equal(selection.productId, product.productId, `${label}: Client Selection resolves the canonical product`);
  assert.equal(toCanonicalProductContract(product).price, library.price, `${label}: canonical contract price`);
  assert.equal(selection.selectedPrice, library.price, `${label}: Client Selection price`);
  // The Quotation Builder holds ex-GST base rates (it adds GST itself): a GST-inclusive Product
  // Library price arrives as price / 1.1 - the same price, stated ex GST.
  const incGst = row.source === "client-selections-allocated-product" ? /inc(l|.)?s*gst/i.test(product.attributes?.priceBasis || "") : row.entryDoorLibraryRow ? toCanonicalProductContract(product).priceIncludesGst : false;
  const expectedQuoteRate = library.price === null ? null : incGst ? Math.round((library.price / 1.1) * 10000) / 10000 : library.price;
  assert.equal(quoteRate, expectedQuoteRate, `${label}: Quotation Builder price`);
  if (library.price === null) {
    assert.equal(row.cost, 0);
    assert.notEqual(productPriceLabel(product), "$0.00");
  } else {
    assert.equal(qty, 1, `${label}: quote qty (row ${JSON.stringify({ id: row.id, section: row.section, quantity: row.quantity, qty: row.qty, rate: row.finalRateUsed, hidden: row.inactiveReason })})`);
    assert.equal(row.cost, Math.round(qty * expectedQuoteRate * 100) / 100, `${label}: Qty x Price = Cost`);
  }
  results.push(`PASS ${label}: ${product.productName} [${product.productCode}] | Library ${library.price ?? "PRICE REQUIRED"} (${library.source || productPriceLabel(product)}) | Selection ${selection.selectedPrice ?? "PRICE REQUIRED"} | Quote ${qty} x ${quoteRate ?? "PRICE REQUIRED"}${incGst ? " (ex GST)" : ""} = ${row.cost} [${row.section}]`);
}
console.log(results.join("\n"));
console.log("\nProduct price pipeline acceptance test passed.");
