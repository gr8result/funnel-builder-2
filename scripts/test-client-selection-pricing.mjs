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
  productsForRequirement,
  PRICE_STATES,
  requirementFinancials,
} from "../lib/builders/clientSelectionWorkflow.js";
import { calculateSessionBudget, clientPriceImpactLabel } from "../lib/builders/selectionBudget.js";
import { connectInternalSelectionsToQuotation } from "../lib/product-library/internalSelection.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
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
const allocatedGstLine = { lineId: "gst-sink", productId: "gst-sink", productName: "GST Sink", unit: "EACH", unitPrice: 110, unitAllowance: 0, priceIncludesGst: true, allocations: [{ location: "Kitchen", quantity: 1 }] };
const allocatedGstSelection = plumbingSelectionPatch({ requirementKey: "basin", label: "Basin", unit: "EACH" }, [allocatedGstLine]).patch.guidedSelection;
assert.equal(allocatedGstSelection.priceIncludesGst, true, "the saved Client Selections projection preserves a known inclusive-GST basis");
const mixedBasisSelection = plumbingSelectionPatch({ requirementKey: "basin", label: "Basin", unit: "EACH" }, [
  allocatedGstLine,
  { ...allocatedGstLine, lineId: "ex-gst-sink", productId: "ex-gst-sink", priceIncludesGst: false, allocations: [{ location: "Laundry", quantity: 1 }] },
]).patch.guidedSelection;
assert.equal(mixedBasisSelection.priceIncludesGst, null, "mixed line GST bases remain unresolved rather than being flattened");
const sharedSinkLine = { lineId: "shared-sink", productId: "shared-sink", productCode: "SINK-1", productName: "Shared Sink", supplier: "Test Supplier", unit: "EACH", unitPrice: 110, unitAllowance: 80, priceIncludesGst: true, allocations: [{ location: "Kitchen", quantity: 1 }] };
const sharedSinkBook = { rooms: [
  { name: "Kitchen", rows: [{ guidedSelection: { requirementKey: "sink", requirementLabel: "Sinks", plumbingAllocation: { lines: [sharedSinkLine] } } }] },
  { name: "Laundry", rows: [{ guidedSelection: { requirementKey: "sink", requirementLabel: "Sinks", plumbingAllocation: { lines: [{ ...sharedSinkLine, lineId: "legacy-shared-sink-alias", allocations: [{ location: "Laundry", quantity: 2 }] }] } } }] },
] };
const sharedSinkWorkbook = connectAllocatedSelectionsToQuotation({ workspaceId: "builder-a", quotation: {}, procurement: { items: [] } }, sharedSinkBook);
const sharedSinkRows = Object.values(sharedSinkWorkbook.quotation).flatMap(section => section.rows || []).filter(row => row.productId === "shared-sink");
const sharedSinkOrders = sharedSinkWorkbook.procurement.items.filter(item => item.productId === "shared-sink");
assert.equal(sharedSinkRows.length, 1, "one product selected in two rooms creates exactly one quotation row");
assert.deepEqual([sharedSinkRows[0].quantity, sharedSinkRows[0].locationSchedule.map(allocation => [allocation.location, allocation.quantity])], [3, [["Kitchen", 1], ["Laundry", 2]]]);
assert.equal(sharedSinkOrders.length, 1, "multi-room aggregation creates exactly one procurement requirement");
assert.equal(sharedSinkOrders[0].qty, 3);
const repeatedSharedSink = connectAllocatedSelectionsToQuotation(sharedSinkWorkbook, sharedSinkBook);
assert.deepEqual(repeatedSharedSink.quotation, sharedSinkWorkbook.quotation, "repeated selection synchronization is quotation-idempotent");
assert.deepEqual(repeatedSharedSink.procurement, sharedSinkWorkbook.procurement, "repeated selection synchronization does not duplicate procurement items");
const orderedSinkId = "allocated-selection:sink:shared-sink";
const orderedSinkWorkbook = connectAllocatedSelectionsToQuotation({
  quotation: { "PLUMBING FIT OFF - CLIENT SELECTIONS": { rows: [
    { id: "manual-before", item: "Manual before", qty: 1, manualRate: "20" },
    { id: orderedSinkId, source: "client-selections-allocated-product", productId: "shared-sink", qty: 4, quantity: 4, quantityManualOverride: true, manualRate: "135" },
    { id: "manual-after", item: "Manual after", qty: 2, manualRate: "30" },
  ] } },
  procurement: { items: [] },
}, sharedSinkBook);
const orderedSinkRows = orderedSinkWorkbook.quotation["PLUMBING FIT OFF - CLIENT SELECTIONS"].rows;
assert.deepEqual(orderedSinkRows.map(row => row.id), ["manual-before", orderedSinkId, "manual-after"], "synchronization keeps an existing managed quotation row in its original position");
assert.deepEqual([orderedSinkRows[1].quantity, orderedSinkRows[1].manualRate, orderedSinkRows[1].quantityManualOverride], [4, "135", true], "manual quantity and rate overrides survive synchronization");
const legacyLineId = "legacy-shared-sink-row";
const legacyManagedRow = { id: `allocated-selection:sink:${legacyLineId}`, source: "client-selections-allocated-product", productId: "shared-sink", qty: 5, quantity: 5, quantityManualOverride: true, manualRate: "142" };
const canonicalizedLegacy = connectAllocatedSelectionsToQuotation({ quotation: { "PLUMBING FIT OFF - CLIENT SELECTIONS": { rows: [legacyManagedRow] } }, procurement: { items: [] } }, {
  rooms: [{ name: "Kitchen", rows: [{ guidedSelection: { requirementKey: "sink", requirementLabel: "Sinks", plumbingAllocation: { lines: [{ ...sharedSinkLine, lineId: "shared-sink", allocations: [{ location: "Kitchen", quantity: 3 }] }] } } }] }],
});
const canonicalizedRow = canonicalizedLegacy.quotation["PLUMBING FIT OFF - CLIENT SELECTIONS"].rows[0];
assert.deepEqual([canonicalizedRow.id, canonicalizedRow.quantity, canonicalizedRow.manualRate], ["allocated-selection:sink:shared-sink", 5, "142"], "legacy row IDs canonicalize without losing saved manual overrides");
const ensuiteSinkLine = { ...sharedSinkLine, allocations: [{ location: "Ensuite", quantity: 1 }] };
assert.throws(() => connectAllocatedSelectionsToQuotation({ quotation: {} }, { rooms: [
  { name: "Ensuite", rows: [{ guidedSelection: { requirementKey: "sink", requirementLabel: "Sinks", plumbingAllocation: { lines: [ensuiteSinkLine] } } }] },
  { name: "Ensuite", rows: [{ guidedSelection: { requirementKey: "sink", requirementLabel: "Sinks", plumbingAllocation: { lines: [ensuiteSinkLine] } } }] },
] }), error => error.code === "ALLOCATED_SELECTION_CONFLICT", "duplicate normalized room allocations are rejected before save");
const requirementOnly = { ...requirement("electrical-schedule", 0), areaKey: "electrical" };
const requirementOnlyProduct = { ...product("POINT-1", 180), familyKey: "vendor-specific-electrical", requirementKeys: ["electrical-schedule"] };
const requirementOnlySelection = select(requirementOnly, requirementOnlyProduct);
assert.equal(requirementOnlySelection.metadata.selectionFoundation.selectionStatus, "SELECTED");
assert.equal(requirementOnlySelection.selection_slot_id, null);
assert.equal(requirementOnlySelection.metadata.selectionFoundation.quoteMappingStatus, "REQUIREMENT_MAPPED");
assert.deepEqual(productsForRequirement([requirementOnlyProduct], requirementOnly), [requirementOnlyProduct]);
results.push("Known shared requirement without a legacy slot remains SELECTED and matches imported products by requirement key");
function check(name, req, prod, expected) {
  const payload = select(req, prod);
  const financials = requirementFinancials(req, payload);
  results.push(`${name}: included ${req.defaultAllowance} x${financials.quantity}, selected ${payload.selected_details.selectedPrice}, unit diff ${payload.selected_details.unitVariation}, total diff ${payload.selected_details.variationAmount}${financials.priceRequired ? " (PRICE REQUIRED)" : ""} -> "${financials.priceRequired ? "PRICE REQUIRED" : clientPriceImpactLabel(financials.variation)}"`);
  expected(payload, financials);
  return payload;
}

// A - standard product, no price change
const a = check("TEST A standard", requirement("basin", 250), product("BASIN-STD", 275), (p, f) => {
  assert.equal(p.selected_details.variationAmount, 0);
  assert.equal(f.variation, 0);
  assert.equal(p.included_in_contract, true);
});
// B - upgrade
const b = check("TEST B upgrade", requirement("basin", 250), product("BASIN-UP", 522.5), (p, f) => {
  assert.equal(p.selected_details.variationAmount, 225);
  assert.equal(f.unitVariation, 225);
});
// C - quantity 3
const c = check("TEST C quantity", requirement("taps", 120, 3), product("TAP-UP", 192.5), (p, f) => {
  assert.equal(p.selected_details.unitVariation, 55);
  assert.equal(p.selected_details.variationAmount, 165);
  assert.equal(f.variation, 165);
  assert.equal(f.quantity, 3);
});
// D - downgrade: arithmetic -100, represented by the existing Credit rule and netted in the budget
const d = check("TEST D downgrade", requirement("vanity", 500), product("VANITY-DOWN", 440), (p, f) => {
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
const guided = (req, prod, payload) => ({ requirementKey: req.requirementKey, requirementLabel: req.label, productId: prod.productId, productCode: prod.productCode, productName: prod.productName, brand: prod.brand, model: prod.model, quantity: payload.selected_details.quantity, unit: "EACH", selectedPrice: payload.selected_details.selectedPrice, priceIncludesGst: payload.selected_details.priceIncludesGst, priceState: payload.selected_details.priceState });
const doorReq = requirement("internal-doors", 300, 3);
const doorA = product("DOOR-A", 410);
const doorB = product("DOOR-B", 520);
const book = (g) => ({ rooms: [{ rows: [{ guidedSelection: g }] }] });
let workbook = connectInternalSelectionsToQuotation({ quotation: {} }, book(guided(doorReq, doorA, select(doorReq, doorA))));
workbook = connectInternalSelectionsToQuotation(workbook, book(guided(doorReq, doorB, select(doorReq, doorB))));
const lines = workbook.quotation["INTERNAL PRODUCTS - CLIENT SELECTIONS"].rows;
assert.equal(lines.length, 1, "replacing a selection must not leave the old product charged too");
assert.equal(lines[0].productCode, "DOOR-B");
assert.equal(lines[0].excelRate, 472.7273);
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
assert.equal(finalSnapshot.summary.selectedTotal, 522.5);
assert.equal(finalSnapshot.summary.currentNetSelectionVariation, 225);
const before = JSON.stringify(finalSnapshot);
const upgradedBasin = product("BASIN-UP", 475);
upgradedBasin.clientPrice = 610; // Product Library price rises next month
const redraft = select(requirement("basin", 250), upgradedBasin);
assert.equal(redraft.selected_details.variationAmount, 304.55, "a draft re-selection picks up the new catalogue price on the ex-GST basis");
assert.equal(JSON.stringify(finalSnapshot), before, "the Contract snapshot must not change");
assert.equal(finalSnapshot.summary.selectedTotal, 522.5);
assert.equal(finalSnapshot.summary.currentNetSelectionVariation, 225);
assert.equal(finalSnapshot.immutable, true);
assert.ok(Object.isFrozen(finalSnapshot));
assert.throws(() => { "use strict"; finalSnapshot.documentStatus = "draft"; });
results.push(`TEST F: Contract snapshot immutable=${finalSnapshot.immutable}, frozen=${Object.isFrozen(finalSnapshot)}, variation still ${finalSnapshot.summary?.currentNetSelectionVariation ?? "(see snapshot)"} after catalogue price 522.50 -> 610 (draft re-selection now +304.55 ex GST)`);
assert.equal(lines[0].excelRate, 472.7273, "saved quotation lines retain the ex-GST snapshot rate");

console.log(results.join("\n"));
console.log("\nClient selection pricing tests passed.");
