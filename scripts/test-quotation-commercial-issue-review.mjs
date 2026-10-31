import assert from "node:assert/strict";
import { commercialIssueReview } from "../lib/builders/commercialIssueReview.js";
import { quotationNotifications } from "../lib/construction-estimation/quotationNotifications.js";

const audit = {
  entries: [{
    key: "windows|schedule",
    outcome: "BLOCKED_MISSING_PRICE",
    procurementRepresented: true,
    procurementStatus: "REQUIRED_BUT_UNPRICED",
    quoteRowIds: ["custom-window-1", "custom-window-2"],
    unpricedOpenings: [{ rowId: "custom-window-1" }, { rowId: "custom-window-2" }],
  }],
  duplicates: [],
};
const rateReviewRows = [
  { id: "custom-window-1", section: "WINDOWS (53)", item: "Kitchen fixed glass", qty: 1, windowScheduleUnpricedRow: true },
  { id: "custom-window-2", section: "WINDOWS (53)", item: "Pantry fixed glass", qty: 1, windowScheduleUnpricedRow: true },
  { id: "electrical-schedule:gpo", section: "ELECTRICAL", item: "GPO - Kitchen", qty: 3 },
];
const cabinetryEntries = Array.from({ length: 9 }, (_, index) => ({
  requirementId: `cabinetry-${index + 1}`,
  room: index < 3 ? ["Kitchen", "Laundry", "Pantry"][index] : "Kitchen",
  label: index < 3 ? "300 mm MDF bulkhead" : "Cabinetry setup",
  outcome: "ACTION REQUIRED",
  reason: "Exact measurement or classification required",
  action: { label: "Complete the exact cabinetry setup decision" },
}));
const review = commercialIssueReview({
  audit,
  rateReviewRows,
  workbook: { cabinetryReconciliation: { entries: cabinetryEntries } },
});
assert.equal(review.selectionIssues.length, 1);
assert.equal(review.rateIssues.length, 1, "custom-window rate rows are represented by the traceable selection issue, not counted again");
assert.equal(review.cabinetryIssues.length, 9);
assert.equal(review.total, 11);
assert.equal(new Set(review.issues.map((issue) => issue.id)).size, review.total);

const preview = {
  windowScheduleUnmatched: [
    { heightMm: 650, widthMm: 3000, quantity: 1 },
    { heightMm: 650, widthMm: 1800, quantity: 1 },
  ],
  windowScheduleOutcomes: [
    { outcome: "unpriced", heightMm: 650, widthMm: 3000, location: "Kitchen" },
    { outcome: "unpriced", heightMm: 650, widthMm: 1800, location: "Pantry" },
  ],
  windowScheduleReconciliation: {
    section53Items: 30,
    section53Qty: 30,
    matchedQty: 28,
    unpricedQty: 2,
    quoteSheetQty: 30,
    balanced: true,
    differences: [],
  },
};
const notices = quotationNotifications(preview);
assert.equal(notices.length, 1);
assert.equal(notices[0].key, "section53-window-status");
assert.equal(notices[0].requiresAcknowledgement, false);
assert.match(notices[0].message, /30 openings mapped, 28 priced, 2 pending supplier rates/);
assert.match(notices[0].message, /650H x 3000W \(Kitchen\)/);
assert.match(notices[0].message, /650H x 1800W \(Pantry\)/);

console.log("Quotation commercial issue review: canonical counts, window deduplication, and cabinetry decisions passed.");
