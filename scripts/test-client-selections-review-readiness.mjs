// Review & Preview readiness card: the "Auto-Approve All Baseline & Within-Allowance Items" shortcut and
// the builder's one-click resolution of unpriced items (board count / area, or "included").
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-review-readiness.mjs
import assert from "node:assert/strict";
import {
  approvePriceItemsInBulk, builderReviewTaskId, builderReviewTasks, bulkApprovablePriceItems,
  recordBuilderPricingReview, variationPricingState, variationSummary, PRICING_STATES,
} from "../lib/builders/selectionVariationPricing.js";

const item = (selectionKey, fields) => ({ jobId: "job", room: "Kitchen", selectionKey, productId: `${selectionKey}-p`, requirementLabel: selectionKey, isChange: true, quantity: 2, priceIncludesGst: false, ...fields });
const items = [
  item("within", { unitPrice: 80, allowance: 100, priceSource: "indicative_rate" }),
  item("over-indicative", { unitPrice: 150, allowance: 100, priceSource: "indicative_rate" }),
  item("over-supplier", { unitPrice: 150, allowance: 100, priceSource: "supplier_reference" }),
  item("no-price", { unitPrice: null }),
  item("no-allowance", { unitPrice: 120, allowanceKnown: false, priceSource: "indicative_rate" }),
  item("standard", { isChange: false, unitPrice: 50 }),
];

// 1. Only within-allowance and verified supplier prices are picked.
assert.deepEqual(bulkApprovablePriceItems(items, {}).map((entry) => entry.selectionKey), ["within", "over-supplier"]);

// 2. Running it confirms exactly those and drops the pending counts; everything else stays open.
const before = variationSummary(items, {});
assert.equal(before.estimatedCount, 3);
assert.equal(before.reviewCount, 1);
const reviews = approvePriceItemsInBulk({}, items, { at: "2026-11-10T00:00:00.000Z" });
const after = variationSummary(items, reviews);
assert.equal(after.confirmedCount, 2);
assert.equal(after.estimatedCount, 1, "the over-allowance indicative price still needs the builder");
assert.equal(after.reviewCount, 1, "Builder Review items are never bulk approved");
assert.equal(after.estimatedPriceCount, 1, "a price with no allowance is never bulk approved");
assert.equal(after.canIssueFinal, false);
assert.equal(variationPricingState(items[0], reviews[builderReviewTaskId(items[0])]).state, PRICING_STATES.confirmed);
assert.equal(reviews[builderReviewTaskId(items[0])].approvedBy, "builder (bulk)");
assert.equal(bulkApprovablePriceItems(items, reviews).length, 0, "running it again does nothing");

// 3. One-click resolution of an unpriced item (cladding priced per board, no board count recorded).
const cladding = item("cladding", { room: "External", unit: "board", quantity: 0, unitPrice: 95, priceIncludesGst: true, allowance: 60, priceSource: "supplier_reference",
  missing: [{ key: "quantity", label: "Number of boards" }], reference: { price: 95, includesGst: true, unit: "per board", label: "$95 per board" } });
assert.equal(variationPricingState(cladding).state, PRICING_STATES.builderReview);
assert.equal(builderReviewTasks([cladding], {}).length, 1);
// "Use Product Library price" with 12 boards: priced immediately, off the review queue.
const counted = recordBuilderPricingReview({}, cladding, { quantity: "12", unitPrice: cladding.reference.price, priceIncludesGst: true });
const countedState = variationPricingState(cladding, counted[builderReviewTaskId(cladding)]);
assert.equal(countedState.state, PRICING_STATES.calculable);
assert.equal(countedState.amountExGst, Math.round((95 / 1.1 - 60) * 12 * 100) / 100);
assert.equal(builderReviewTasks([cladding], counted).length, 0);
// "Included in the contract price (no variation)": confirmed at $0 in one click.
const included = recordBuilderPricingReview({}, cladding, { quantity: 1, unitPrice: 0, allowance: 0, priceIncludesGst: false, approve: true });
const includedState = variationPricingState(cladding, included[builderReviewTaskId(cladding)]);
assert.equal(includedState.state, PRICING_STATES.confirmed);
assert.equal(includedState.amountIncGst, 0);

console.log("review readiness: bulk approval picks only within-allowance / supplier prices; unpriced items resolve in one click");
