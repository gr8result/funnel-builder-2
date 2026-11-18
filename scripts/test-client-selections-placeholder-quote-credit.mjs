// A made-to-measure line whose saved "supplier quote" is only the allowance (no quote reference,
// price == allowance) is price to be confirmed - never a credit. Covers the line maths, the load-time
// correction of the saved row totals, and that a real quote is still a price.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-placeholder-quote-credit.mjs [job.json]
import assert from "node:assert/strict";
import fs from "node:fs";
import { plumbingLineWithTotals, plumbingAllocationSummary } from "../lib/builders/plumbingFixtureAllocation.js";
import { clearPlaceholderQuoteCredits } from "../lib/builders/plumbingSelectionPatch.js";

const mirror = (overrides = {}) => ({
  lineId: "mirror-ensuite", productId: "SSM-MIRROR", productName: "Essential Mirror", configuredSelection: true,
  priceSource: "supplier-quote", quoteReference: "", unitPrice: 300, unitAllowance: 300, priceIncludesGst: true, unit: "EACH",
  allocations: [{ location: "Ensuite", quantity: 1 }], ...overrides,
});

// 1. Line maths.
const placeholder = plumbingLineWithTotals(mirror());
assert.equal(placeholder.variation, null, "$300 'quote' on a $300 allowance is not a -$27.27 credit");
assert.equal(placeholder.allowancePlaceholderQuote, true);
assert.equal(plumbingAllocationSummary([mirror()]).variation, null, "the category total is pending, not a credit");
const quoted = plumbingLineWithTotals(mirror({ quoteReference: "RQ-1", unitPrice: 330 }));
assert.equal(quoted.variation, 0, "a referenced supplier quote of $330 inc GST against $300 ex GST is $0");
assert.equal(plumbingLineWithTotals(mirror({ quoteReference: "RQ-2" })).variation, -27.27, "a REAL quote equal to the allowance is still priced (GST convention unchanged)");
assert.equal(plumbingLineWithTotals(mirror({ configuredSelection: false })).variation, -27.27, "ordinary catalogue products are unchanged");

// 2. Load-time correction of the saved derived totals.
const savedRow = {
  id: "row-mirror", upgradeCost: -27.27, included: false,
  guidedSelection: { requirementKey: "mirror", variation: -27.27, variationAmount: -27.27, priceState: "Current Price", approvedAt: "2026-11-01", allowance: 300, selectedPrice: 300, quantity: 1,
    plumbingAllocation: { lines: [mirror()] } },
};
const untouchedRow = { id: "row-toilet", guidedSelection: { requirementKey: "toilet-suite", variationAmount: 50, plumbingAllocation: { lines: [mirror({ configuredSelection: false, lineId: "toilet" })] } } };
const rooms = [{ name: "Shower Screens & Mirrors", rows: [savedRow, untouchedRow] }];
const corrected = clearPlaceholderQuoteCredits(rooms);
const fixed = corrected[0].rows[0];
assert.equal(fixed.guidedSelection.variationAmount, null);
assert.equal(fixed.guidedSelection.variation, null);
assert.equal(fixed.upgradeCost, null);
assert.equal(fixed.guidedSelection.variationPending, true);
assert.equal(fixed.guidedSelection.approvedAt, "2026-11-01", "approvals are kept");
assert.deepEqual([fixed.guidedSelection.allowance, fixed.guidedSelection.selectedPrice, fixed.guidedSelection.quantity], [300, 300, 1], "prices, allowance and quantity are kept");
assert.equal(corrected[0].rows[1], untouchedRow, "other rows are the same object");
assert.equal(clearPlaceholderQuoteCredits(corrected), corrected, "idempotent: a corrected book is returned unchanged");
assert.equal(clearPlaceholderQuoteCredits([{ rows: [untouchedRow] }])[0].rows[0], untouchedRow);

// 3. Optional: the real job copy (JSON form). Every screen / mirror credit is cleared, nothing else changes.
if (process.argv[2]) {
  const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const before = job.workbook.clientSelectionsBook.rooms;
  const after = clearPlaceholderQuoteCredits(before);
  const pairs = after.flatMap((room, r) => (room.rows || []).map((row, i) => [before[r].rows[i], row]).filter(([old, row]) => old !== row));
  const keys = pairs.map(([, row]) => row.guidedSelection.requirementKey);
  assert.ok(keys.every((key) => key === "shower-screen" || key === "mirror"), `only screens/mirrors change: ${keys}`);
  console.log(`real job: ${pairs.length} rows corrected (${pairs.map(([old]) => `${old.guidedSelection.requirementKey} ${old.guidedSelection.variationAmount ?? old.guidedSelection.variation}`).join(", ")} -> pending)`);
}
console.log("PASS placeholder supplier quotes are price to be confirmed, not a credit; saved credits cleared on load; real quotes unchanged");
