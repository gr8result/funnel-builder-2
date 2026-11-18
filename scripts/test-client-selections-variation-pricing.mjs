// Client Selections V1: three pricing states, builder-review tasks, variation summary and the
// client bulkhead decision. Run: node --import ./scripts/register-json-loader.mjs scripts/test-client-selections-variation-pricing.mjs
import assert from "node:assert/strict";
import {
  PRICING_STATES, BUILDER_REVIEW_HEADING, BUILDER_REVIEW_MESSAGE, builderReviewTasks, variationPricingState, variationSummary,
  recordBuilderPricingReview, recordClientVariationDecision, selectionVariationItems, selectionPricingReviews, builderReviewTaskId, bookWithPricingReviews,
} from "../lib/builders/selectionVariationPricing.js";
import { applyCabinetryBulkheadChoice, approveCabinetryRoom, cabinetryBulkheadOptions, cabinetryLocationMissingRequirements, cabinetrySpecificationRevision, isCabinetryRoomApproved, normaliseCabinetrySelection } from "../lib/builders/cabinetryWorkflow.js";
import { collectCabinetryRequirements } from "../lib/construction-estimation/cabinetryRequirements.js";

const jobId = "recovered-03-09-123-verify";
const baseline = (productId, productName, allowance) => ({ productId, productName, allowance });
const row = (id, guided) => ({ id, item: guided.requirementLabel, guidedRequirementKey: guided.requirementKey, guidedSelection: guided });

// 1. Standard inclusion kept: no variation, no questions, no task.
const kept = row("oven", { requirementKey: "oven", requirementLabel: "Oven", productId: "std-oven", productName: "Standard oven", allowance: 900, selectedPrice: 900, selectedPriceIncludesGst: false, quantity: 1, standardInclusionBaseline: baseline("std-oven", "Standard oven", 900) });
// 2. Upgrade with known quantity and price (ex GST): calculable estimate.
const upgrade = row("cooktop", { requirementKey: "cooktop", requirementLabel: "Cooktop", productId: "premium-cooktop", productName: "Premium cooktop", allowance: 600, selectedPrice: 1100, selectedPriceIncludesGst: false, quantity: 1, standardInclusionBaseline: baseline("std-cooktop", "Standard cooktop", 600) });
// 3. Upgrade with no verified price: builder review, never $0.
const unpriced = row("rangehood", { requirementKey: "rangehood", requirementLabel: "Rangehood", productId: "designer-hood", productName: "Designer hood", allowance: 400, selectedPrice: 0, quantity: 1, variationPending: true, priceState: "Quote Required", standardInclusionBaseline: baseline("std-hood", "Standard hood", 400) });

const kitchenRoom = (extra = {}) => ({ id: "cabinetry-kitchen", location: "Kitchen", name: "Kitchen", included: true, enabledAreaKeys: ["lowerDoorsDrawers"], areaSelections: { lowerDoorsDrawers: { id: "oak", colourName: "Oak", finish: "Matt", supplier: "Polytec" } }, benchtop: { productName: "Stone" }, handles: { base: { productName: "Handle" } }, ...extra });
let cabinetry = normaliseCabinetrySelection({ projectId: jobId, locations: [kitchenRoom()], schedule: [{ componentId: "base", location: "Kitchen", cabinetTypeId: "base_unit_1200_2door", unitType: "2 door base unit - 1200mm", quantity: 2, handleQuantity: 2 }] });

// Bulkheads: not standard here, so Add is offered and Remove is not; no length asked.
let options = cabinetryBulkheadOptions(cabinetry.locations[0], cabinetry.schedule);
assert.equal(options.standardIncluded, false);
assert.deepEqual(options.options.filter((option) => option.available).map((option) => option.key), ["standard", "add"]);
assert.throws(() => applyCabinetryBulkheadChoice(cabinetry, "Kitchen", "remove"), /not available/);
cabinetry = normaliseCabinetrySelection(applyCabinetryBulkheadChoice(cabinetry, "Kitchen", "add", "2026-11-08T01:00:00.000Z"));
const addedLine = cabinetry.schedule.find((line) => line.clientAddedBulkhead);
assert(addedLine && addedLine.runs.length === 0 && addedLine.quantity === 0, "add schedules a bulkhead with no length");
assert.equal(cabinetry.locations[0].bulkheadChoice.choice, "add");
assert.equal(cabinetryLocationMissingRequirements(cabinetry.locations[0]).length, 0, "room stays completable without any measurement");
// The estimator still sees the measurement requirement in the quantity engine.
const engine = collectCabinetryRequirements({ clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { cabinetrySelection: cabinetry } }] }] } });
const engineItems = Array.isArray(engine) ? engine : engine.requirements || engine.items || [];
const bulkheadRequirement = engineItems.find((item) => /^bulkhead_/.test(item.type || ""));
assert(bulkheadRequirement, "the estimator's quantity engine lists the added bulkhead");
assert.match(String(bulkheadRequirement.issue || ""), /Bulkhead length required/);
assert.equal(bulkheadRequirement.quantity, 0, "no length is invented");

const book = { rooms: [{ name: "Kitchen", rows: [kept, upgrade, unpriced, row("cabinetry", { requirementKey: "cabinetry", requirementLabel: "Cabinetry", cabinetrySelection: cabinetry })] }] };
const items = selectionVariationItems(book, { jobId });
assert.equal(items.length, 4);
const byKey = Object.fromEntries(items.map((item) => [item.selectionKey, item]));
assert.equal(variationPricingState(byKey.oven).state, PRICING_STATES.standard);
const cooktop = variationPricingState(byKey.cooktop);
assert.equal(cooktop.state, PRICING_STATES.calculable);
assert.equal(cooktop.amountExGst, 500);
assert.equal(cooktop.amountIncGst, 550);
assert.equal(cooktop.estimated, true);
const hood = variationPricingState(byKey.rangehood);
assert.equal(hood.state, PRICING_STATES.builderReview);
assert.equal(hood.label, BUILDER_REVIEW_HEADING);
assert.equal(hood.message, BUILDER_REVIEW_MESSAGE);
assert.equal(hood.amountIncGst, null, "unknown cost is never 0");
assert.deepEqual(hood.missing.map((entry) => entry.key), ["price"]);
const bulkhead = variationPricingState(byKey["cabinetry-bulkheads"]);
assert.equal(bulkhead.state, PRICING_STATES.builderReview);
assert.deepEqual(bulkhead.missing.map((entry) => entry.key), ["quantity", "price"]);

// Builder-review tasks: one per job/room/selection/product, never duplicated.
let reviews = {};
const tasks = builderReviewTasks([...items, ...items], reviews);
assert.equal(tasks.length, 2);
assert.equal(new Set(tasks.map((task) => task.id)).size, 2);
assert(tasks.every((task) => task.jobId === jobId && task.room && task.selectionKey && task.productId));
assert.equal(tasks.find((task) => task.selectionKey === "cabinetry-bulkheads").id, builderReviewTaskId(byKey["cabinetry-bulkheads"]));

// Summary before review: estimated and unresolved kept apart, cannot issue final.
let summary = variationSummary(items, reviews);
assert.equal(summary.rows.length, 3, "kept standard inclusion is not a variation");
assert.equal(summary.reviewCount, 2);
assert.equal(summary.estimatedTotalIncGst, 550);
assert.equal(summary.confirmedTotalIncGst, 0);
assert.equal(summary.canIssueFinal, false);
assert(summary.rows.filter((r) => r.state === PRICING_STATES.builderReview).every((r) => r.amountIncGst === null && r.priceLabel === BUILDER_REVIEW_HEADING));

// Builder supplies the bulkhead length and rate: the variation becomes calculable.
assert.throws(() => recordBuilderPricingReview(reviews, byKey["cabinetry-bulkheads"], { quantity: 4.2, approve: true }), /Cannot approve/);
reviews = recordBuilderPricingReview(reviews, byKey["cabinetry-bulkheads"], { quantity: 4.2, unitPrice: 180, priceIncludesGst: false });
assert.equal(variationPricingState(byKey["cabinetry-bulkheads"], reviews[builderReviewTaskId(byKey["cabinetry-bulkheads"])]).amountExGst, 756);
assert.equal(builderReviewTasks(items, reviews).length, 1, "resolved task leaves the queue");
// The client may approve once the amount is known (2026-11-11 rule); builder sign-off comes after.
// An item with no amount yet cannot be approved by the client.
assert.throws(() => recordClientVariationDecision(reviews, byKey.rangehood, "accepted"), /does not have an amount/);
const clientFirst = recordClientVariationDecision(reviews, byKey["cabinetry-bulkheads"], "accepted");
assert.equal(variationPricingState(byKey["cabinetry-bulkheads"], clientFirst[builderReviewTaskId(byKey["cabinetry-bulkheads"])]).clientDecision, "accepted");
// Builder signs off the same amount: the client's approval stands.
const signedOff = recordBuilderPricingReview(clientFirst, byKey["cabinetry-bulkheads"], { approve: true, by: "builder" });
assert.equal(variationPricingState(byKey["cabinetry-bulkheads"], signedOff[builderReviewTaskId(byKey["cabinetry-bulkheads"])]).clientDecision, "accepted");
// A different amount re-opens the client's decision.
const repriced = recordBuilderPricingReview(clientFirst, byKey["cabinetry-bulkheads"], { unitPrice: 200 });
assert.equal(variationPricingState(byKey["cabinetry-bulkheads"], repriced[builderReviewTaskId(byKey["cabinetry-bulkheads"])]).clientDecision, "pending");
reviews = recordBuilderPricingReview(reviews, byKey["cabinetry-bulkheads"], { approve: true, by: "builder" });
let confirmed = variationPricingState(byKey["cabinetry-bulkheads"], reviews[builderReviewTaskId(byKey["cabinetry-bulkheads"])]);
assert.equal(confirmed.state, PRICING_STATES.confirmed);
assert.equal(confirmed.clientDecision, "pending");
reviews = recordClientVariationDecision(reviews, byKey["cabinetry-bulkheads"], "accepted");
summary = variationSummary(items, reviews);
const bulkheadRow = summary.rows.find((r) => r.kind === "cabinetry-bulkhead");
assert.equal(bulkheadRow.builderApproval, "approved");
assert.equal(bulkheadRow.clientAcceptance, "accepted");
assert.equal(bulkheadRow.amountIncGst, 831.6);
assert.equal(summary.confirmedTotalIncGst, 831.6);
assert.equal(summary.acceptedTotalIncGst, 831.6);
// Editing a reviewed figure withdraws the approval and the client's acceptance.
const edited = recordBuilderPricingReview(reviews, byKey["cabinetry-bulkheads"], { unitPrice: 190 });
assert.equal(variationPricingState(byKey["cabinetry-bulkheads"], edited[builderReviewTaskId(byKey["cabinetry-bulkheads"])]).state, PRICING_STATES.calculable);
// A review for an earlier choice never prices a new one.
const changedChoice = { ...byKey.rangehood, productId: "other-hood", selected: "Other hood" };
const hoodReviews = recordBuilderPricingReview({}, byKey.rangehood, { unitPrice: 1500, priceIncludesGst: false });
assert.equal(variationPricingState(byKey.rangehood, hoodReviews[builderReviewTaskId(byKey.rangehood)]).state, PRICING_STATES.calculable);
assert.equal(variationPricingState(changedChoice, Object.values(hoodReviews)[0]).state, PRICING_STATES.builderReview);

// Reviews survive the cabinetry normaliser (saves) and are read back from the book.
const withReviews = normaliseCabinetrySelection({ ...cabinetry, pricingReviews: reviews });
assert.deepEqual(withReviews.pricingReviews, reviews);
assert.deepEqual(selectionPricingReviews({ rooms: [{ rows: [row("cabinetry", { cabinetrySelection: withReviews })] }] }), reviews);

// Approval: a room approved before the bulkhead question keeps its approval; a bulkhead choice needs re-approval.
let plain = normaliseCabinetrySelection({ projectId: jobId, locations: [kitchenRoom()], schedule: [] });
plain = approveCabinetryRoom(plain, "cabinetry-kitchen", jobId, "2026-11-08T00:00:00.000Z");
assert(isCabinetryRoomApproved(plain.locations[0], plain.schedule, jobId));
const keptStandard = normaliseCabinetrySelection(applyCabinetryBulkheadChoice(plain, "Kitchen", "standard"));
assert(isCabinetryRoomApproved(keptStandard.locations[0], keptStandard.schedule, jobId), "keeping the standard inclusion does not invalidate approval");
const added = normaliseCabinetrySelection(applyCabinetryBulkheadChoice(plain, "Kitchen", "add"));
assert(!isCabinetryRoomApproved(added.locations[0], added.schedule, jobId), "adding bulkheads needs re-approval");
const reverted = normaliseCabinetrySelection(applyCabinetryBulkheadChoice(added, "Kitchen", "standard"));
assert.equal(reverted.schedule.some((line) => line.clientAddedBulkhead), false);
assert.equal(cabinetrySpecificationRevision(reverted.locations[0], reverted.schedule), cabinetrySpecificationRevision(plain.locations[0], plain.schedule));

// Removal only when standard and permitted; the builder's measured runs are kept.
let standard = normaliseCabinetrySelection({ projectId: jobId, locations: [kitchenRoom()], schedule: [{ componentId: "bh", location: "Kitchen", cabinetTypeId: "bulkhead_300", unitType: "MDF bulkhead 300mm", quantity: 3.6, handleQuantity: 0, runs: [{ id: "r1", location: "Wall", lengthMm: 3600 }] }] });
assert.equal(cabinetryBulkheadOptions(standard.locations[0], standard.schedule).options.find((o) => o.key === "remove").available, false);
standard = normaliseCabinetrySelection({ ...standard, locations: standard.locations.map((room) => ({ ...room, bulkheadRemovalPermitted: true })) });
standard = normaliseCabinetrySelection(applyCabinetryBulkheadChoice(standard, "Kitchen", "remove"));
assert.equal(standard.schedule.find((line) => line.componentId === "bh").runs[0].lengthMm, 3600, "estimator runs untouched");
const removal = selectionVariationItems({ rooms: [{ rows: [row("cabinetry", { cabinetrySelection: standard })] }] }, { jobId })[0];
assert.equal(removal.quantity, 3.6);
assert.equal(removal.quantitySource, "Estimator measured runs");
const credit = variationPricingState(removal, recordBuilderPricingReview({}, removal, { unitPrice: 150 })[builderReviewTaskId(removal)]);
assert.equal(credit.amountExGst, -540);

// ---- Automatic price resolution (saved unconfirmed price, Product Library reference, never invented) ----
{
  const { guidedRowVariationItem, PRICING_STATES: S, AUTO_ESTIMATE_LABEL, unitFamily } = await import("../lib/builders/selectionVariationPricing.js");
  const catalogue = {
    "door-1": { retailReferencePrice: 1850, retailReferenceUnit: "entry door supply-only", retailReferenceType: "estimate", retailReferenceGstBasis: "inclusive" },
    "board-1": { retailReferencePrice: 44.56, retailReferenceUnit: "4200 x 180 x 16mm board supply-only", retailReferenceType: "verified_supplier", retailReferenceGstBasis: "inclusive" },
    "drive-1": { retailReferencePrice: 185, retailReferenceUnit: "m2 installed", retailReferenceType: "estimate", retailReferenceGstBasis: "inclusive" },
    "fan-1": { retailReferencePrice: 330, retailReferenceUnit: "each supply-only", retailReferenceType: "verified_supplier", retailReferenceGstBasis: "" },
  };
  const lookup = (id) => catalogue[id] || null;
  const guidedRow = (guided) => ({ id: guided.requirementKey, guidedSelection: { requirementLabel: guided.requirementKey, productName: guided.productId, ...guided } });
  assert.equal(unitFamily("m2 installed"), "m2");
  assert.equal(unitFamily("4200 x 180 x 16mm board supply-only"), "board");
  assert.equal(unitFamily("installed double sectional door"), "each");

  // A saved price awaiting confirmation is used and labelled, against a recorded allowance.
  const sink = guidedRowVariationItem(guidedRow({ requirementKey: "sink", productId: "sink-x", allowance: 650, selectedPrice: 547, selectedPriceIncludesGst: false, quantity: 1, unit: "EACH", priceState: "Price Pending", variationPending: true }), { jobId, productLookup: lookup });
  const sinkState = variationPricingState(sink);
  assert.equal(sinkState.state, S.calculable);
  assert.equal(sinkState.label, AUTO_ESTIMATE_LABEL);
  assert.equal(sinkState.amountExGst, -103);
  assert.equal(sinkState.withinAllowance, true);
  assert.match(sinkState.priceSourceLabel, /Saved supplier price \$547\.00 awaiting builder confirmation/);

  // A Product Library reference price in the same unit is applied (GST-inclusive reference).
  const driveway = guidedRowVariationItem(guidedRow({ requirementKey: "driveway", productId: "drive-1", allowance: 120, allowanceStatus: "set", selectedPrice: null, quantity: 60, drivewayAreaM2: 60, unit: "", priceState: "Quote Required", variationPending: true }), { jobId, productLookup: lookup, requirementUnit: "ITEM" });
  const drivewayState = variationPricingState(driveway);
  assert.equal(drivewayState.state, S.calculable);
  assert.equal(drivewayState.autoEstimated, true);
  assert.equal(drivewayState.amountExGst, Math.round(((185 / 1.1) - 120) * 60 * 100) / 100);
  assert.match(drivewayState.priceSourceLabel, /GR8 Result indicative rate \$185\.00 per m2 installed/);

  // A per-board price is never multiplied by a count of "1 cladding": the builder is asked for the quantity only.
  const cladding = guidedRowVariationItem(guidedRow({ requirementKey: "cladding", productId: "board-1", allowance: 0, selectedPrice: null, quantity: 1, priceState: "Quote Required", variationPending: true }), { jobId, productLookup: lookup, requirementUnit: "ITEM" });
  const claddingState = variationPricingState(cladding);
  assert.equal(claddingState.state, S.builderReview);
  assert.deepEqual(claddingState.missing.map((entry) => entry.key), ["quantity"]);
  assert.match(claddingState.missing[0].label, /quantity in 4200 x 180 x 16mm board/);

  // Quick resolution: the builder enters the board count and the Product Library price is used...
  assert.equal(cladding.reference.price, 44.56);
  const boards = recordBuilderPricingReview({}, cladding, { quantity: 120, unitPrice: cladding.reference.price, priceIncludesGst: true });
  const boardState = variationPricingState(cladding, boards[builderReviewTaskId(cladding)]);
  assert.equal(boardState.state, S.estimatedPrice, "priced, but cladding has no recorded allowance");
  assert.equal(boardState.priceIncGst, Math.round(44.56 * 120 * 100) / 100);
  // ...or records that it is already covered by the contract price: resolved, no variation.
  const included = recordBuilderPricingReview({}, cladding, { quantity: 1, unitPrice: 0, allowance: 0, priceIncludesGst: false, approve: true });
  const includedState = variationPricingState(cladding, included[builderReviewTaskId(cladding)]);
  assert.equal(includedState.state, S.confirmed);
  assert.equal(includedState.amountIncGst, 0);

  // Allowance not recorded (0, no baseline, not "set"): the PRICE is shown, never counted as the variation.
  const door = guidedRowVariationItem(guidedRow({ requirementKey: "entry-door", productId: "door-1", allowance: 0, selectedPrice: null, quantity: 1, unit: "entry door", priceState: "Quote Required", variationPending: true }), { jobId, productLookup: lookup });
  const doorState = variationPricingState(door);
  assert.equal(doorState.state, S.estimatedPrice);
  assert.equal(doorState.priceIncGst, 1850);
  assert.equal(doorState.amountIncGst, null);
  assert.equal(doorState.label, AUTO_ESTIMATE_LABEL);
  assert.deepEqual(doorState.missing.map((entry) => entry.key), ["allowance"]);
  const doorSummary = variationSummary([door, sink], {});
  assert.equal(doorSummary.estimatedPriceCount, 1);
  assert.equal(doorSummary.estimatedPriceTotalIncGst, 1850);
  assert.equal(doorSummary.estimatedTotalIncGst, Math.round(-103 * 1.1 * 100) / 100, "an estimated price never enters the variation total");
  assert.equal(builderReviewTasks([door], {}).length, 1, "the builder is asked for the allowance");
  // The builder enters the allowance: it becomes a normal estimate.
  const doorReviewed = recordBuilderPricingReview({}, door, { allowance: 1200 });
  assert.equal(variationPricingState(door, doorReviewed[builderReviewTaskId(door)]).state, S.calculable);

  // A reference price with no GST basis is not guessed.
  const fan = guidedRowVariationItem(guidedRow({ requirementKey: "fans", productId: "fan-1", allowance: 200, allowanceStatus: "set", selectedPrice: null, quantity: 2, unit: "EACH", priceState: "Quote Required", variationPending: true }), { jobId, productLookup: lookup });
  assert.deepEqual(variationPricingState(fan).missing.map((entry) => entry.key), ["gst"]);

  // No price anywhere: Builder Review, saying exactly that.
  const unknown = guidedRowVariationItem(guidedRow({ requirementKey: "tap", productId: "nothing", allowance: 100, selectedPrice: null, quantity: 1, unit: "EACH", priceState: "Quote Required", variationPending: true }), { jobId, productLookup: lookup });
  assert.match(variationPricingState(unknown).missing[0].label, /no builder, supplier or Product Library price/);

  // Several products under one selection are priced line by line.
  const mixers = guidedRowVariationItem(guidedRow({ requirementKey: "bath-mixer", productId: "", allowance: 300, selectedPrice: null, quantity: 3, unit: "EACH", priceState: "Price Pending", variationPending: true,
    plumbingAllocation: { lines: [{ productId: "m1", productName: "Mixer A", unitPrice: 400, quantity: 1 }, { productId: "m2", productName: "Mixer B", unitPrice: 250, quantity: 2 }] } }), { jobId, productLookup: lookup });
  assert.equal(variationPricingState(mixers).amountExGst, (400 - 300) * 1 + (250 - 300) * 2);
}

// The attention list raises no pricing warning for the package's baseline product or a price within the allowance.
{
  const { selectionAttention } = await import("../lib/builders/selectionAttention.js");
  const bookOf = (guided) => ({ rooms: [{ name: "Kitchen", rows: [{ id: guided.requirementKey, item: guided.requirementKey, status: "selected", guidedRequirementKey: guided.requirementKey, selectedOptionId: guided.productId, guidedSelection: { selectionStatus: "selected", status: "selected", requirementLabel: guided.requirementKey, productName: guided.productId, configurationComplete: true, ...guided } }] }] });
  const pricingItems = (guided) => selectionAttention({ book: bookOf(guided) }).groups.find((group) => group.key === "pricing")?.items || [];
  assert.equal(pricingItems({ requirementKey: "rangehood", productId: "std", allowance: null, selectedPrice: null, variationPending: true, priceState: "Quote Required", standardInclusionBaseline: { productId: "std" } }).length, 0, "kept baseline product: no warning");
  assert.equal(pricingItems({ requirementKey: "cooktop", productId: "c1", allowance: 950, selectedPrice: 900, variationPending: true, priceState: "Price Pending" }).length, 0, "within allowance: no warning");
  assert.equal(pricingItems({ requirementKey: "oven", productId: "o1", allowance: 1200, selectedPrice: 3298, variationPending: true, priceState: "Price Pending" }).length, 1, "an upgrade with an unconfirmed price is still flagged");
}

// Book-level storage survives a row being rewritten.
const stored = bookWithPricingReviews(book, reviews);
const rewritten = { ...stored, rooms: stored.rooms.map((room) => ({ ...room, rows: room.rows.map((r) => ({ ...r, guidedSelection: { ...r.guidedSelection } })) })) };
assert.deepEqual(selectionPricingReviews(rewritten), reviews);
console.log("client selections variation pricing: all assertions passed");
