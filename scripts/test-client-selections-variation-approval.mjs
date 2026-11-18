// Client Selections -> Variations: margin + GST pricing that matches the quotation calculator,
// client-only net differences, the client's 3-figure approval, the Variations module record, builder
// sign-off / invoice, client documents, and one-click confirmation of standard items.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-variation-approval.mjs
import assert from "node:assert/strict";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import {
  builderReviewTaskId, clientPriceOfCost, quotationPricingRules, recordBuilderPricingReview, recordClientVariationDecision,
  variationApprovalFigures, variationPricingState, variationSummary, PRICING_STATES,
} from "../lib/builders/selectionVariationPricing.js";
import { clientApprovedVariationPayload, planClientApprovedVariationTransition, CLIENT_APPROVED_SOURCE } from "../lib/builders/contractLock.js";
import { normaliseVariationSummary } from "../lib/builders/selectionsScheduleHtml.js";
import { variationDocumentHtml, variationInvoiceHtml } from "../lib/builders/variationDocuments.js";
import { baselineConfirmableRowIds, bookWithBaselineConfirmed, selectionDecisionSummary } from "../lib/builders/selectionAttention.js";

// 1. A swap's client amount equals what the quotation calculator adds (margin, profit, GST, commission).
const adjustments = { preliminaryCostsPercent: 4, overheadsPercent: 6, marginPercent: 18, profitPercent: 3, gstPercent: 10, salesCommissionPercent: 2.5 };
const quote = (rate) => calculateEstimateBuilderWorkbook({ summaryAdjustments: adjustments, quotation: { "APPLIANCES - CLIENT SELECTIONS": { rows: [{ id: "oven", item: "Oven", unit: "each", quantity: "1", quantityManualOverride: true, manualRate: String(rate) }] } } }).summary;
const rules = quotationPricingRules(quote(1200));
for (const [from, to] of [[1200, 3298], [1200, 950], [500, 500.5]]) {
  const before = quote(from); const after = quote(to);
  const calculator = Math.round((after.finalQuoteTotal - before.finalQuoteTotal) * 100) / 100;
  const formula = clientPriceOfCost(to - from, rules);
  assert.ok(Math.abs(formula.incGst - calculator) <= 0.02, `${from}->${to}: formula ${formula.incGst} vs calculator ${calculator}`);
  assert.ok(Math.abs(formula.gst - Math.round((after.gst - before.gst) * 100) / 100) <= 0.02, `${from}->${to}: GST matches`);
}
assert.deepEqual(clientPriceOfCost(100, null), { exGst: 100, gst: 10, incGst: 110 }, "no quotation linked: GST only");

// 2. Items carry the rules: the client amount includes the margin; the cost difference stays internal.
const item = (selectionKey, fields) => ({ jobId: "job", room: "Kitchen", selectionKey, productId: `${selectionKey}-p`, requirementLabel: selectionKey, standard: "Standard oven", selected: "Premium oven", isChange: true, quantity: 1, priceIncludesGst: false, pricingRules: rules, ...fields });
const oven = item("oven", { unitPrice: 3298, allowance: 1200 });
const ovenState = variationPricingState(oven);
assert.equal(ovenState.state, PRICING_STATES.calculable);
assert.equal(ovenState.costDifferenceExGst, 2098);
assert.equal(ovenState.amountIncGst, 3120.62);
assert.equal(ovenState.marginApplied, true);
const hood = item("rangehood", { unitPrice: 1500, allowance: 900 });
const tap = item("tap", { unitPrice: 300, allowance: 400 });
const cladding = item("cladding", { unitPrice: null });
const items = [oven, hood, tap, cladding];

// 3. Privacy: summary rows and the client PDF carry net differences only.
let summary = variationSummary(items, {});
summary.rows.forEach((row) => ["unitPrice", "allowance", "costDifferenceExGst", "reviewUnitPrice"].forEach((key) => assert.equal(key in row, false, `row has no ${key}`)));
const estimatedOnly = normaliseVariationSummary({ rows: [{ state: "estimated_price", room: "Kitchen", requirementLabel: "Oven", priceIncGst: 4321.5 }] });
assert.equal(estimatedOnly.rows[0].priceIncGst, null, "the PDF never prints an item's own price");
assert.equal(estimatedOnly.estimatedPriceTotalIncGst, null);

// 4. The client's approval: three figures, tied to the amount.
assert.throws(() => recordClientVariationDecision({}, cladding, "accepted"), /does not have an amount/);
let reviews = recordClientVariationDecision({}, hood, "accepted", "2026-11-11T01:00:00.000Z");
summary = variationSummary(items, reviews);
const hoodAmount = variationPricingState(hood, reviews[builderReviewTaskId(hood)]).amountIncGst;
let figures = variationApprovalFigures(summary, builderReviewTaskId(oven), { otherApprovedTotalIncGst: 500 });
assert.equal(figures.previousTotalIncGst, Math.round((500 + hoodAmount) * 100) / 100, "approved so far = other approved variations + this job's approved selections");
assert.equal(figures.currentIncGst, 3120.62);
assert.equal(figures.newTotalIncGst, Math.round((figures.previousTotalIncGst + 3120.62) * 100) / 100);
reviews = recordClientVariationDecision(reviews, oven, "accepted", "2026-11-11T02:00:00.000Z");
summary = variationSummary(items, reviews);
assert.equal(summary.acceptedCount, 2);
assert.equal(summary.acceptedTotalIncGst, Math.round((hoodAmount + 3120.62) * 100) / 100);
// The oven's own figures never count it twice.
figures = variationApprovalFigures(summary, builderReviewTaskId(oven), { otherApprovedTotalIncGst: 500 });
assert.equal(figures.previousTotalIncGst, Math.round((500 + hoodAmount) * 100) / 100);
// Unticking withdraws it (before builder sign-off); after sign-off it cannot be unticked.
const withdrawn = recordClientVariationDecision(reviews, oven, "pending");
assert.equal(variationPricingState(oven, withdrawn[builderReviewTaskId(oven)]).clientDecision, "pending");
const signed = recordBuilderPricingReview(reviews, oven, { approve: true, by: "builder" });
assert.equal(variationPricingState(oven, signed[builderReviewTaskId(oven)]).clientDecision, "accepted", "builder sign-off of the same amount keeps the approval");
assert.throws(() => recordClientVariationDecision(signed, oven, "pending"), /already signed off/);

// 5. The Variations module record: client-approved, awaiting builder sign-off; client-safe amounts.
const ovenRow = summary.rows.find((row) => row.id === builderReviewTaskId(oven));
const payload = clientApprovedVariationPayload(ovenRow, { workspaceId: "ws", projectId: "11111111-2222-4333-8444-555555555555", userId: "u", approvedAt: "2026-11-11T02:00:00.000Z", clientName: "A Client", costDifferenceExGst: 2098, figures });
assert.equal(payload.status, "submitted");
assert.equal(payload.client_status, "approved");
assert.equal(payload.requires_client_approval, false);
assert.equal(payload.total, 3120.62);
assert.equal(payload.metadata.source, CLIENT_APPROVED_SOURCE);
assert.equal(payload.metadata.builderReviewStatus, "pending");
assert.match(payload.metadata.clientDescription, /Standard oven replaced by Premium oven/);
assert.equal(payload.id, clientApprovedVariationPayload(ovenRow, { workspaceId: "ws", projectId: "11111111-2222-4333-8444-555555555555" }).id, "re-approving updates the same record");
assert.match(payload.variation_number, /^CS-[0-9A-F]{6}$/);
assert.throws(() => clientApprovedVariationPayload(ovenRow, { workspaceId: "ws", projectId: "" }), /cloud-linked job/);

// 6. Builder sign-off, then invoice; never out of order.
assert.throws(() => planClientApprovedVariationTransition(payload, "invoice", { invoiceNumber: "INV-1" }), /sign off/);
const signedOff = { ...payload, ...planClientApprovedVariationTransition(payload, "sign_off", { userId: "b", now: "2026-11-11T03:00:00.000Z" }) };
assert.equal(signedOff.status, "approved");
assert.equal(signedOff.metadata.builderReviewStatus, "approved");
assert.throws(() => planClientApprovedVariationTransition(signedOff, "sign_off"), /awaiting sign-off/);
assert.throws(() => planClientApprovedVariationTransition(signedOff, "invoice", { invoiceNumber: " " }), /invoice number/);
const invoiced = { ...signedOff, ...planClientApprovedVariationTransition(signedOff, "invoice", { userId: "b", now: "2026-11-11T04:00:00.000Z", invoiceNumber: "INV-CS-1" }) };
assert.equal(invoiced.status, "invoiced");
assert.equal(invoiced.metadata.paymentStatus, "outstanding");
assert.throws(() => planClientApprovedVariationTransition({ metadata: { source: "other" } }, "sign_off"), /not a client-approved/);

// 7. The variation document and tax invoice show client amounts only.
const project = { project_name: "Job 123", client_name: "A Client", site_address: "1 Example St" };
const documentHtml = variationDocumentHtml(signedOff, { project });
assert.match(documentHtml, /Variation to Contract/);
assert.match(documentHtml, /\$3,120\.62/);
assert.match(documentHtml, /Premium oven/);
const invoiceHtml = variationInvoiceHtml(invoiced, { project, builderName: "Builder Co" });
assert.match(invoiceHtml, /Tax Invoice/);
assert.match(invoiceHtml, /INV-CS-1/);
[documentHtml, invoiceHtml].forEach((html) => {
  assert.doesNotMatch(html, /2,098|2098/, "builder cost never printed");
  const text = html.replace(/<style>[\s\S]*?<\/style>/, "");
  assert.doesNotMatch(text, /margin|cost difference|costDifference/i, "no margin or cost wording outside the styles");
});
assert.throws(() => variationInvoiceHtml(signedOff, { project }), /not been invoiced/);

// 8. One-click confirmation of standard items kept as selected.
const baselineRow = (id, productId, status) => ({ id, guidedRequirementKey: "oven", status, guidedSelection: { requirementKey: "oven", productId, productName: `Oven ${productId}`, standardInclusionBaseline: { productId: "base-oven" }, selectionStatus: status } });
const book = { rooms: [{ name: "Kitchen", rows: [baselineRow("kept", "base-oven", "in_progress"), baselineRow("changed", "other-oven", "in_progress"), baselineRow("done", "base-oven", "selected")] }] };
assert.deepEqual(baselineConfirmableRowIds(book), ["kept"], "only the kept, unconfirmed standard item");
const before = selectionDecisionSummary(book).outstanding;
const confirmedBook = bookWithBaselineConfirmed(book, undefined, { at: "2026-11-11T05:00:00.000Z" });
assert.equal(selectionDecisionSummary(confirmedBook).outstanding, before - 1);
assert.equal(confirmedBook.rooms[0].rows[0].guidedSelection.baselineConfirmedBy, "builder (bulk)");
assert.equal(confirmedBook.rooms[0].rows[1].status, "in_progress", "a changed product is never confirmed in bulk");

console.log("variation approval: margin matches the quotation calculator, client sees differences only, 3-figure approval, sign-off and invoice in order");
