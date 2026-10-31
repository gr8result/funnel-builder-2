import assert from "node:assert/strict";
import {
  commercialIssueExcluded,
  createCommercialIssueRfq,
  excludeCommercialIssue,
  selectCommercialIssueProduct,
  updateCommercialQuoteRow,
} from "../lib/builders/commercialIssueResolution.js";

const workbook = {
  jobId: "job-safe-copy",
  workspaceId: "workspace-1",
  quotation: {
    WINDOWS: {
      rows: [{ id: "window-custom-1", item: "Custom fixed glass", qty: 1, unit: "EACH", manualRate: "", quoteRequired: true }],
    },
  },
  clientSelectionsBook: {
    rooms: [{
      id: "room-1",
      rows: [{
        id: "selection-1",
        guidedSelection: { requirementKey: "windows", productId: "legacy-product", productName: "Legacy product" },
      }],
    }],
  },
  procurement: { items: [] },
};

const priced = updateCommercialQuoteRow(workbook, {
  issueId: "selection:window-1",
  section: "WINDOWS",
  rowId: "window-custom-1",
  supplierRate: 1100,
  gstTreatment: "included",
  source: "Supplier quotation Q-123",
});
assert.equal(priced.quotation.WINDOWS.rows[0].manualRate, 1000);
assert.equal(priced.quotation.WINDOWS.rows[0].quoteRequired, false);
assert.equal(priced.quotation.WINDOWS.rows[0].commercialPriceEvidence.source, "Supplier quotation Q-123");
assert.equal(workbook.quotation.WINDOWS.rows[0].manualRate, "", "resolution must not mutate the source workbook");

const measured = updateCommercialQuoteRow(workbook, {
  issueId: "selection:window-1",
  section: "WINDOWS",
  rowId: "window-custom-1",
  quantity: 2.5,
  unit: "M2",
});
assert.equal(measured.quotation.WINDOWS.rows[0].qty, 2.5);
assert.equal(measured.quotation.WINDOWS.rows[0].quantityManualOverride, true);
assert.equal(measured.quotation.WINDOWS.rows[0].quantitySource, "BUILDER_COMMERCIAL_ISSUE_RESOLUTION");

const rfq = createCommercialIssueRfq(workbook, {
  issueId: "selection:window-1",
  entry: { identityKey: "window-1", productId: "window-product", productName: "Custom fixed glass", quantity: 1, unit: "EACH", section: "WINDOWS", quoteRowIds: ["window-custom-1"] },
});
const repeatedRfq = createCommercialIssueRfq(rfq, {
  issueId: "selection:window-1",
  entry: { identityKey: "window-1", productId: "window-product", productName: "Custom fixed glass" },
});
assert.equal(repeatedRfq.procurement.items.length, 1, "repeated RFQ creation must reuse the issue identity");
assert.equal(repeatedRfq.procurement.items[0].sourceQuoteRowId, "window-custom-1");

const selected = selectCommercialIssueProduct(workbook, {
  issueId: "selection:window-1",
  selectionRowId: "selection-1",
  product: { productId: "exact-product", productCode: "EXACT-1", productName: "Exact window", builderPrice: 550, priceIncludesGst: true },
});
assert.equal(selected.clientSelectionsBook.rooms[0].rows[0].guidedSelection.productId, "exact-product");
assert.equal(selected.clientSelectionsBook.rooms[0].rows[0].guidedSelection.selectedPrice, 550);

const excluded = excludeCommercialIssue(workbook, {
  issueId: "selection:not-required",
  reason: "Covered by the signed owner-supplied contract.",
});
assert.equal(commercialIssueExcluded(excluded, "selection:not-required"), true);
assert.throws(() => excludeCommercialIssue(workbook, { issueId: "selection:bad", reason: "No" }), /auditable reason/);

console.log("Commercial issue resolution controls preserve source data, price evidence, measurements, product identity, RFQ idempotence and auditable exclusions.");
