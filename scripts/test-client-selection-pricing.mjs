// Client Selections pricing flow, end to end through the production functions:
// Product Library product -> createSelectionPayloadFromProduct (builder_client_selections payload)
// -> requirementFinancials / areaTotals / calculateSessionBudget -> Quotation Builder line
// (connectInternalSelectionsToQuotation) -> Contract inclusions snapshot (createProjectInclusionsSnapshot).
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selection-pricing.mjs
import assert from "node:assert/strict";
import {
  areaTotals,
  createSelectionPayloadFromProduct,
  PRICE_STATES,
  requirementFinancials,
} from "../lib/builders/clientSelectionWorkflow.js";
import { calculateSessionBudget, clientPriceImpactLabel } from "../lib/builders/selectionBudget.js";
import { connectInternalSelectionsToQuotation } from "../lib/product-library/internalSelection.js";
import { createProjectInclusionsSnapshot, FINAL_INCLUSIONS_STATUS } from "../lib/builders/finalInclusionsSchedule.js";
import { productPriceLabel } from "../lib/product-library/productPresentation.js";

const requirement = (key, allowance, quantity = 1) => ({
  requirementKey: key, label: key, areaKey: "interior", areaLabel: "Interior", familyKey: "",
  defaultAllowance: allowance, defaultQuantity: quantity, unit: "EACH",
});
const product = (code, price, status = "current", extra = {}) => ({
  productId: `master-${code}`, productCode: code, productName: code, brand: "Test Brand", model: code,
  supplier: "Test Supplier", clientPrice: price, priceStatus: status, priceUnit: "EACH",
  gstTreatment: "GST inclusive", priceSourceUrl: "https://supplier.example/price", priceVerifiedAt: "2026-09-01", ...extra,
});
const select = (req, prod) => createSelectionPayloadFromProduct({ workspaceId: "w", projectId: "p", snapshotId: "s", sessionId: "sess", requirement: req, product: prod });
const results = [];
function check(name, req, prod, expected) {
  const payload = select(req, prod);
  const financials = requirementFinancials(req, payload);
  results.push(`${name}: included ${req.defaultAllowance} x${financials.quantity}, selected ${payload.selected_details.selectedPrice}, unit diff ${payload.selected_details.unitVariation}, total diff ${payload.selected_details.variationAmount}${financials.priceRequired ? " (PRICE REQUIRED)" : ""} -> "${financials.priceRequired ? "PRICE REQUIRED" : clientPriceImpactLabel(financials.variation)}"`);
  expected(payload, financials);
  return payload;
}

// A - standard product, no price change
const a = check("TEST A standard", requirement("basin", 250), product("BASIN-STD", 250), (p, f) => {
  assert.equal(p.selected_details.variationAmount, 0);
  assert.equal(f.variation, 0);
  assert.equal(p.included_in_contract, true);
});
// B - upgrade
const b = check("TEST B upgrade", requirement("basin", 250), product("BASIN-UP", 475), (p, f) => {
  assert.equal(p.selected_details.variationAmount, 225);
  assert.equal(f.unitVariation, 225);
});
// C - quantity 3
const c = check("TEST C quantity", requirement("taps", 120, 3), product("TAP-UP", 175), (p, f) => {
  assert.equal(p.selected_details.unitVariation, 55);
  assert.equal(p.selected_details.variationAmount, 165);
  assert.equal(f.variation, 165);
  assert.equal(f.quantity, 3);
});
// D - downgrade: arithmetic -100, represented by the existing Credit rule and netted in the budget
const d = check("TEST D downgrade", requirement("vanity", 500), product("VANITY-DOWN", 400), (p, f) => {
  assert.equal(p.selected_details.variationAmount, -100);
  assert.equal(clientPriceImpactLabel(f.variation), "-$100 Credit");
});
// E - missing price: flagged, never a silent $0 / "no overrun"
const e = check("TEST E missing price", requirement("door", 300), product("DOOR-QUOTE", null, "quote_required"), (p, f) => {
  assert.equal(p.selected_details.selectedPrice, null);
  assert.equal(p.selected_details.variationAmount, null);
  assert.equal(p.selected_details.variationPending, true);
  assert.equal(p.selected_details.priceState, PRICE_STATES.quoteRequired);
  assert.equal(p.included_in_contract, false);
  assert.equal(f.priceRequired, true);
});
assert.equal(productPriceLabel({ priceStatus: "current", clientPrice: 0 }), "Price required", "a $0 'current' price must not display as $0.00");
const reqs = [requirement("basin", 250), requirement("door", 300)];
const totals = areaTotals(reqs, new Map([["basin", b], ["door", e]]));
assert.equal(totals.priceRequired, 1);
assert.equal(totals.variation, 225);
const budget = calculateSessionBudget({ originalEstimateTotal: 500000, selections: [a, b, c, d, e] });
assert.equal(budget.currentNetSelectionVariation, 0 + 225 + 165 - 100);
results.push(`Session budget net variation (A+B+C+D, E unpriced): ${budget.currentNetSelectionVariation}; area totals flag ${totals.priceRequired} price-required selection`);
// Snapshot metadata travels with the selection.
assert.equal(b.selected_details.productPriceUnit, "EACH");
assert.equal(b.selected_details.priceVerifiedAt, "2026-09-01");
assert.ok(b.selected_details.priceCapturedAt);

// Quotation Builder: one line per requirement; replacing the product replaces the line (no double charge).
const guided = (req, prod, payload) => ({ requirementKey: req.requirementKey, requirementLabel: req.label, productId: prod.productId, productCode: prod.productCode, productName: prod.productName, brand: prod.brand, model: prod.model, quantity: payload.selected_details.quantity, unit: "EACH", selectedPrice: payload.selected_details.selectedPrice, priceState: payload.selected_details.priceState });
const doorReq = requirement("internal-doors", 300, 3);
const doorA = product("DOOR-A", 410);
const doorB = product("DOOR-B", 520);
const book = (g) => ({ rooms: [{ rows: [{ guidedSelection: g }] }] });
let workbook = connectInternalSelectionsToQuotation({ quotation: {} }, book(guided(doorReq, doorA, select(doorReq, doorA))));
workbook = connectInternalSelectionsToQuotation(workbook, book(guided(doorReq, doorB, select(doorReq, doorB))));
const lines = workbook.quotation["INTERNAL PRODUCTS - CLIENT SELECTIONS"].rows;
assert.equal(lines.length, 1, "replacing a selection must not leave the old product charged too");
assert.equal(lines[0].productCode, "DOOR-B");
assert.equal(lines[0].excelRate, 520);
assert.equal(lines[0].quantity, 3);
results.push(`Quotation line after replacing DOOR-A with DOOR-B: ${lines.length} line, ${lines[0].productCode} ${lines[0].quantity} x ${lines[0].excelRate} ${lines[0].unit}`);
const unpricedWorkbook = connectInternalSelectionsToQuotation({ quotation: {} }, book(guided(doorReq, product("DOOR-Q", null, "quote_required"), select(doorReq, product("DOOR-Q", null, "quote_required")))));
const unpricedLine = unpricedWorkbook.quotation["INTERNAL PRODUCTS - CLIENT SELECTIONS"].rows[0];
assert.equal(unpricedLine.excelRate, "");
assert.equal(unpricedLine.priceStatus, "Quote required");
results.push(`Unpriced selection in Quotation Builder: rate "${unpricedLine.excelRate}", status "${unpricedLine.priceStatus}"`);

// F - Final (Contract) snapshot is unaffected by a later Product Library price change.
const finalSnapshot = createProjectInclusionsSnapshot({
  project: { id: "p", currency: "AUD" }, workspaceId: "w",
  selections: [{ ...b, id: "sel-b", is_active: true, metadata: { selectionScope: "client_choice" }, client_selection_price: b.selected_details.selectedPrice, variation_amount: b.selected_details.variationAmount }],
  session: { original_estimate_total: 500000 }, documentStatus: FINAL_INCLUSIONS_STATUS.CONTRACT,
});
assert.equal(finalSnapshot.summary.productCount, 1);
assert.equal(finalSnapshot.summary.selectedTotal, 475);
assert.equal(finalSnapshot.summary.currentNetSelectionVariation, 225);
const before = JSON.stringify(finalSnapshot);
const upgradedBasin = product("BASIN-UP", 475);
upgradedBasin.clientPrice = 610; // Product Library price rises next month
const redraft = select(requirement("basin", 250), upgradedBasin);
assert.equal(redraft.selected_details.variationAmount, 360, "a draft re-selection picks up the new catalogue price");
assert.equal(JSON.stringify(finalSnapshot), before, "the Contract snapshot must not change");
assert.equal(finalSnapshot.summary.selectedTotal, 475);
assert.equal(finalSnapshot.summary.currentNetSelectionVariation, 225);
assert.equal(finalSnapshot.immutable, true);
assert.ok(Object.isFrozen(finalSnapshot));
assert.throws(() => { "use strict"; finalSnapshot.documentStatus = "draft"; });
results.push(`TEST F: Contract snapshot immutable=${finalSnapshot.immutable}, frozen=${Object.isFrozen(finalSnapshot)}, variation still ${finalSnapshot.summary?.currentNetSelectionVariation ?? "(see snapshot)"} after catalogue price 475 -> 610 (draft re-selection now +360)`);
assert.equal(lines[0].excelRate, 520, "saved quotation lines keep their snapshot rate");

console.log(results.join("\n"));
console.log("\nClient selection pricing tests passed.");
