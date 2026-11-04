// Quotation V1 pricing checks: BOQ reconciles to the quote, GST is 10% of the pre-GST subtotal,
// totals add up, and unpriced charged rows block issue.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-pricing-reconciliation.mjs [job.gr8job]
// With no job file it uses the isolated copy under test-artifacts (read-only); synthetic checks always run.
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { quotationSectionsForFinalBoq, quoteLineTotal, shouldIncludeQuoteRowInFinalBoq } from "../lib/construction-estimation/finalQuotationBoq.js";
import { quotationIssueCheck } from "../lib/construction-estimation/quotationIssueGate.js";

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log("PASS", name); };
const cents = (n) => Math.round(Number(n || 0) * 100);

await check("engine rate rows whose names contain fee words stay in the BOQ", () => {
  assert.equal(shouldIncludeQuoteRowInFinalBoq({ item: "TOTAL GROUND FLOOR AREA", lineType: "Standard rate item", qty: 225.56, finalRateUsed: "$125.00", cost: 28195 }), true);
  assert.equal(shouldIncludeQuoteRowInFinalBoq({ item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", lineType: "Standard rate item", qty: 3, finalRateUsed: "$400", cost: 1200 }), true);
});

await check("imported subtotal and GST lines are still excluded from the BOQ", () => {
  assert.equal(shouldIncludeQuoteRowInFinalBoq({ item: "Subtotal Concrete Slab", qty: 1, finalRateUsed: "$17400.00" }), false);
  assert.equal(shouldIncludeQuoteRowInFinalBoq({ item: "GST", qty: 1, finalRateUsed: "$1000" }), false);
  assert.equal(shouldIncludeQuoteRowInFinalBoq({ item: "Anything", feeType: "qbsa", qty: 1, cost: 500 }), false);
});

const jobPath = process.argv[2] || "test-artifacts/isolated-jobs/floor-waste-corrected-v2/new-job-0309-floor-waste-corrected.gr8job";
const realJob = ["", "E:/dev/funnel-builder-clean/"].map((p) => p + jobPath).find((p) => fs.existsSync(p));
if (!realJob) {
  console.log("SKIP real-job checks: job copy not found");
} else {
  const zip = await JSZip.loadAsync(fs.readFileSync(realJob));
  const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
  const { quotation, summary: s } = calculateEstimateBuilderWorkbook(workbook);

  await check("real job: charged BOQ rows add up exactly to the quote base subtotal", () => {
    const rows = quotationSectionsForFinalBoq(quotation).flatMap((x) => x.rows);
    assert.equal(rows.reduce((n, r) => n + cents(quoteLineTotal(r)), 0), cents(s.baseLineItemSubtotal));
  });

  await check("real job: GST is 10% of the pre-GST subtotal and the final total adds up", () => {
    assert.equal(s.gstPercent, 10);
    assert.equal(cents(s.gst), Math.round(cents(s.subtotalBeforeGst) * 0.1));
    const expected = cents(s.subtotalBeforeGst) + cents(s.gst) + cents(s.qbsaRegistration) + cents(s.qLeaveFees) + cents(s.salesCommissionAmount);
    assert(Math.abs(expected - cents(s.finalQuoteTotal)) <= 1, `final ${s.finalQuoteTotal} vs parts ${expected / 100}`);
  });

  await check("real job: every unpriced charged row is reported and blocks issue", () => {
    const result = quotationIssueCheck(quotation);
    const zeroCharged = quotationSectionsForFinalBoq(quotation).flatMap((x) => x.rows).filter((r) => quoteLineTotal(r) === 0);
    assert.equal(result.ok, result.blockers.length === 0);
    for (const b of result.blockers.filter((x) => !/duplicate/.test(x.reason))) assert(zeroCharged.some((r) => (r.id || r.rowId || "") === b.rowId), `blocked row ${b.item} is priced`);
    console.log(`     ${result.blockers.length} unpriced charged rows; final quote $${s.finalQuoteTotal}`);
  });

  await check("real job: every section's BOQ rows equal that section's quote subtotal (slab, cabinetry, tiling...)", () => {
    const boq = new Map(quotationSectionsForFinalBoq(quotation).map((x) => [x.sectionKey, x.rows.reduce((n, r) => n + cents(quoteLineTotal(r)), 0)]));
    const mismatched = Object.entries(quotation).filter(([key, section]) => cents(section.subtotal) !== (boq.get(key) || 0));
    assert.deepEqual(mismatched.map(([key]) => key), []);
    const cabinetry = Object.keys(quotation).filter((key) => /cabinet|kitchen|vanit|wardrobe/i.test(key) && cents(quotation[key].subtotal) > 0);
    assert(cabinetry.length > 0 && cabinetry.every((key) => boq.get(key) === cents(quotation[key].subtotal)), "cabinetry sections missing from the BOQ");
  });
}

// Floor-waste correction (isolated copies only): original vs corrected copy from
// scripts/repair-isolated-floor-waste-duplicates.mjs.
const pair = ["recovery/quotation-changes-2026-10-03/current-job-verified-1790977156917.gr8job", "test-artifacts/isolated-jobs/floor-waste-corrected-v2/new-job-0309-floor-waste-corrected.gr8job"]
  .map((p) => ["", "E:/dev/funnel-builder-clean/"].map((root) => root + p).find((full) => fs.existsSync(full)));
if (pair.every(Boolean)) {
  const calc = async (p) => calculateEstimateBuilderWorkbook(JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(p))).file("estimate.json").async("string")).workbook);
  const [original, corrected] = [await calc(pair[0]), await calc(pair[1])];
  const wasteIds = (q) => quotationSectionsForFinalBoq(q).flatMap((x) => x.rows).map((r) => r.id || "").filter((id) => /^tiling:[^:]+:waste-/.test(id));
  await check("floor waste: original has 5 duplicate $30 lines; corrected copy has none", () => {
    const ids = wasteIds(original.quotation);
    assert.equal(ids.length - new Set(ids).size, 5);
    const fixed = wasteIds(corrected.quotation);
    assert.equal(fixed.length, new Set(fixed).size);
  });
  await check("floor waste: correction is exactly $150.00 ex GST of cost; BOQ still reconciles", () => {
    assert.equal(cents(original.summary.baseLineItemSubtotal) - cents(corrected.summary.baseLineItemSubtotal), 15000);
    const rows = quotationSectionsForFinalBoq(corrected.quotation).flatMap((x) => x.rows);
    assert.equal(rows.reduce((n, r) => n + cents(quoteLineTotal(r)), 0), cents(corrected.summary.baseLineItemSubtotal));
    console.log(`     client price ${original.summary.finalQuoteTotal} -> ${corrected.summary.finalQuoteTotal} inc GST`);
  });
} else {
  console.log("SKIP floor-waste comparison: job copies not found");
}

console.log(`\n${passed} checks passed`);
