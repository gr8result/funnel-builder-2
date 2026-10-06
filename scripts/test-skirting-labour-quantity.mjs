// Fix-out Stage Labour > INSTALL SKIRTING BOARDS is hard-bound to the takeoff's total skirting LM.
//   node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-skirting-labour-quantity.mjs
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://offline.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "offline";
import assert from "node:assert/strict";
import fs from "node:fs";
const { __quotationPersistenceTestUtils: utils } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { createEstimateBuilderWorkbookDefaults } = await import("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js");
const { calculateEstimateBuilderWorkbook, isSkirtingInstallLabourRow, SKIRTING_TOTAL_QUANTITY_KEY } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const { updateQuoteQuantityField } = await import("../lib/construction-estimation/quoteQuantityFormula.js");
const log = console.log; console.log = () => {};
const calc = (workbook) => calculateEstimateBuilderWorkbook(workbook);
const results = []; const check = (name, run) => { run(); results.push(name); log("PASS", name); };

const recovered = "recovery/quotation-order-2026-10-02/extracted/estimate.json";
const source = fs.existsSync(recovered) ? JSON.parse(fs.readFileSync(recovered, "utf8")).workbook : { ...createEstimateBuilderWorkbookDefaults(), jobId: "skirting-test", templateType: "job" };
let job = utils.normalizeWorkbook(source);
const section = Object.keys(job.quotation).find((name) => /^fix-out stage labour/i.test(name));
assert(section, "Fix-out Stage Labour section exists");
const setWall = (workbook, key, value) => ({ ...workbook, data: { ...workbook.data, inputDataSheet: { ...workbook.data.inputDataSheet, rows: { ...workbook.data.inputDataSheet.rows, [key]: { ...workbook.data.inputDataSheet.rows[key], value: String(value) } } } } });
if (!fs.existsSync(recovered)) { job = setWall(setWall(setWall(setWall(job, "lowerInternal70mmWallsLm", 60), "lowerInternalWallsLm", 60), "lowerExternal70mmWallsLm", 50), "lowerExternalWallsLm", 50); }
const before = calc(job);
// The row as an estimator adds it by hand: a label, no quantity, no formula, wrong unit.
const row = { id: "custom-install-skirting-boards", item: "INSTALL SKIRTING BOARDS", quantity: "", unit: "EACH", manualRate: "$2.00", values: ["INSTALL SKIRTING BOARDS", "", "", "EACH", "", "$2.00", ""], formulas: {} };
const withRow = (workbook, extra = {}) => ({ ...workbook, quotation: { ...workbook.quotation, [section]: { ...workbook.quotation[section], rows: [...workbook.quotation[section].rows.filter((item) => item.id !== row.id), { ...row, ...extra }] } } });
const line = (preview) => preview.quotation[section].rows.find((item) => item.id === row.id);
job = withRow(job);
const total = before.quantities[SKIRTING_TOTAL_QUANTITY_KEY];

check("canonical takeoff field is the total skirting length in LM", () => {
  assert.equal(SKIRTING_TOTAL_QUANTITY_KEY, "skirtingLm");
  assert(total > 0, "job has skirting");
  const q = before.quantities;
  assert(Math.abs(total - (q.lowerSkirtingLm + q.upperSkirtingLm + q.thirdSkirtingLm)) < 0.05, "total = ground + second + third level skirting LM");
});
let preview = calc(job);
check("INSTALL SKIRTING BOARDS qty = total skirting LM, unit LM, source shown", () => {
  const item = line(preview);
  assert.equal(item.qty, total);
  assert.equal(item.quantity, String(total));
  assert.equal(item.unit, "LM");
  assert.equal(item.derivedQuantityFormula, "skirtingLm");
  assert.equal(item.derivedQuantityExplanation, `Skirting Boards LM (${total}) = ${total}`);
  assert.equal(item.cost, Math.round(total * 2 * 100) / 100);
});
check("other Fix-out Stage Labour rows are unaffected", () => {
  const strip = (rows) => rows.filter((item) => item.id !== row.id).map((item) => [item.id, item.qty, item.unit, item.cost, item.derivedQuantityFormula]);
  assert.deepEqual(strip(preview.quotation[section].rows), strip(before.quotation[section].rows));
  assert.equal(isSkirtingInstallLabourRow({ item: "INSTALL SKIRTING BOARDS" }, "FIX OUT (88)"), false, "only the labour section");
  assert.equal(isSkirtingInstallLabourRow({ item: "INSTALL SHELVING TO WIR" }, section), false);
  for (const label of ["Install Skirting Boards", "INSTALL  SKIRTING", "install skirting board"]) assert.equal(isSkirtingInstallLabourRow({ item: label }, section), true, label);
});
check("recalculates when the takeoff wall lengths change (re-import)", () => {
  // The takeoff imports wall lengths per frame size; the 70mm internal walls are part of the total.
  const key = "lowerInternal70mmWallsLm";
  const current = Number(job.data.inputDataSheet.rows[key]?.value) || 0;
  const changed = calc(setWall(job, key, current + 10));
  assert.notEqual(changed.quantities.skirtingLm, total);
  assert.equal(line(changed).qty, changed.quantities.skirtingLm);
  assert(Math.abs(changed.quantities.skirtingLm - (total + 16)) < 0.05, "+10 LM internal wall = +16 LM skirting (both sides x 0.8)");
});
check("save / reload keeps the mapping and the calculated quantity", () => {
  const reopened = utils.normalizeWorkbook(JSON.parse(JSON.stringify(utils.withPersistedQuotationOrder(job))));
  const item = line(calc(reopened));
  assert.deepEqual([item.qty, item.unit, item.derivedQuantityFormula], [total, "LM", "skirtingLm"]);
  // A stale blank "manual" flag left by an earlier edit does not blank the quantity.
  assert.equal(line(calc(withRow(job, { quantityManualOverride: true, quantity: "" }))).qty, total);
});
check("the estimator can still override through the normal Qty / formula editing", () => {
  const typed = updateQuoteQuantityField(row, "quantity", "120");
  const manual = line(calc(withRow(job, typed)));
  assert.equal(manual.qty, 120);
  const formula = updateQuoteQuantityField(row, "quantityFormula", "=skirtingLm*1.1");
  assert.equal(line(calc(withRow(job, formula))).qty, Math.round(total * 1.1 * 100) / 100);
});
log(`\n${results.length} checks passed | current job INSTALL SKIRTING BOARDS = ${total} LM (ground ${before.quantities.lowerSkirtingLm}, second ${before.quantities.upperSkirtingLm}, third ${before.quantities.thirdSkirtingLm})`);
