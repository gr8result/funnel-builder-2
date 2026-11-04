// Door Takeoff product rows are regenerated on every calculation. A builder-entered manual rate or
// supplier quote on one (saved copy with the same id) must survive recalculation and price the row.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-door-takeoff-builder-price.mjs [job.gr8job]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { quoteLineTotal } from "../lib/construction-estimation/finalQuotationBoq.js";
import { quotationIssueCheck } from "../lib/construction-estimation/quotationIssueGate.js";

const jobPath = process.argv[2] || "test-artifacts/isolated-jobs/floor-waste-corrected-v2/new-job-0309-floor-waste-corrected.gr8job";
const file = ["", "E:/dev/funnel-builder-clean/"].map((p) => p + jobPath).find((p) => fs.existsSync(p));
if (!file) { console.log("SKIP: job copy not found"); process.exit(0); }
const workbook = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(file))).file("estimate.json").async("string")).workbook;
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log("PASS", name); };

check("internal door jambs are charged once: the generated FIX OUT row yields to the stored jamb row", () => {
  const q = calculateEstimateBuilderWorkbook(workbook).quotation;
  const jambRows = Object.values(q).flatMap((sec) => sec.rows || []).filter((r) => r.quantityKey === "jamb90x19StockLengthsEach" && Number(r.qty) > 0);
  assert.equal(jambRows.length, 1, jambRows.map((r) => r.id).join(", "));
});

// Without a stored jamb row the generated Door Takeoff row is the charged line; use that case to
// prove a builder-entered price survives recalculation.
for (const sec of Object.values(workbook.quotation)) sec.rows = (sec.rows || []).filter((r) => !/^jamb\d+x19StockLengthsEach$/.test(r.quantityKey || ""));
const before = calculateEstimateBuilderWorkbook(workbook);
const find = (q) => Object.entries(q).flatMap(([s, sec]) => (sec.rows || []).map((r) => ({ s, r }))).find(({ r }) => r.generatedTakeoffProductRow && r.quoteRequired && Number(r.qty) > 0);
const target = find(before.quotation);
assert(target, "job has no unpriced door-takeoff row to test");

check(`unpriced generated row "${target.r.item}" blocks issue before a price is entered`, () => {
  assert(quotationIssueCheck(before.quotation).blockers.some((b) => b.rowId === target.r.id));
});

// Simulate the builder's edit exactly as the hook saves it (useEstimateBuilderWorkbook.updateQuote).
const edited = structuredClone(workbook);
edited.quotation[target.s].rows.push({ id: target.r.id, section: target.s, item: target.r.item, unit: target.r.unit, quantity: "", quantityKey: target.r.quantityKey, generatedTakeoffProductRow: true, active: true, formulas: {}, supplierQuote: "$12.50" });
const after = calculateEstimateBuilderWorkbook(edited);
const priced = after.quotation[target.s].rows.find((r) => r.id === target.r.id);

check("the builder's supplier quote survives recalculation and prices the row", () => {
  assert.equal(priced.quoteRequired, false);
  assert.equal(quoteLineTotal(priced), Math.round(Number(priced.qty) * 12.5 * 100) / 100);
});

check("the row appears once (no duplicate from the saved copy) and no longer blocks issue", () => {
  assert.equal(after.quotation[target.s].rows.filter((r) => r.id === target.r.id).length, 1);
  assert(!quotationIssueCheck(after.quotation).blockers.some((b) => b.rowId === target.r.id));
});

check("quote total rises by exactly that row's new cost", () => {
  assert.equal(Math.round((after.summary.baseLineItemSubtotal - before.summary.baseLineItemSubtotal) * 100), Math.round(quoteLineTotal(priced) * 100));
});

console.log(`\n${passed} checks passed`);
