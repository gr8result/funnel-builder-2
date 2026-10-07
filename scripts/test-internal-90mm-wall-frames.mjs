// PRE-FAB WALL FRAMES > 90mm INTERNAL WALL FRAMES is hard-bound to Job Setup's total internal 90mm wall LM.
//   node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-internal-90mm-wall-frames.mjs
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://offline.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "offline";
import assert from "node:assert/strict";
import fs from "node:fs";
const { __quotationPersistenceTestUtils: utils } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { createEstimateBuilderWorkbookDefaults } = await import("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js");
const { calculateEstimateBuilderWorkbook, ensureInternal90mmWallFrameRow, isInternal90mmWallFrameRow, INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const log = console.log; console.log = () => {};
const results = []; const check = (name, run) => { run(); results.push(name); log("PASS", name); };
const calc = (workbook) => calculateEstimateBuilderWorkbook(workbook);
const setInput = (workbook, key, value) => ({ ...workbook, data: { ...workbook.data, inputDataSheet: { ...workbook.data.inputDataSheet, rows: { ...workbook.data.inputDataSheet.rows, [key]: { ...workbook.data.inputDataSheet.rows[key], value: String(value) } } } } });
const recovered = "recovery/quotation-order-2026-10-02/extracted/estimate.json";
let job = utils.normalizeWorkbook(fs.existsSync(recovered) ? JSON.parse(fs.readFileSync(recovered, "utf8")).workbook : setInput(setInput({ ...createEstimateBuilderWorkbookDefaults(), jobId: "wall-test", templateType: "job" }, "lowerInternal90mmWallsLm", 16.0113), "upperInternal90mmWallsLm", 3.6304));
const section = Object.keys(job.quotation).find((name) => /^pre-fab wall frames/i.test(name));
const rowsOf = (preview) => preview.quotation[section].rows;
const row90 = (preview) => rowsOf(preview).filter(isInternal90mmWallFrameRow);
const withoutRow = (workbook) => ({ ...workbook, quotation: { ...workbook.quotation, [section]: { ...workbook.quotation[section], rows: workbook.quotation[section].rows.filter((row) => !isInternal90mmWallFrameRow(row)) } } });
const base = calc(job);
const total = base.quantities[INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY];

check("Job Setup field: totalInternal90mmWallsLm = ground + second + third internal 90mm wall LM", () => {
  assert.equal(INTERNAL_90MM_WALL_FRAME_QUANTITY_KEY, "totalInternal90mmWallsLm");
  const q = base.quantities;
  assert(total > 0);
  assert(Math.abs(total - (q.lowerInternal90mmWallsLm + q.upperInternal90mmWallsLm + q.thirdInternal90mmWallsLm)) < 0.006);
});
check("row is bound to that field: qty, LM, source, cost at the row rate", () => {
  const [row, ...extra] = row90(base);
  assert.equal(extra.length, 0);
  assert.equal(row.item, "90mm INTERNAL WALL FRAMES");
  assert.deepEqual([row.qty, row.unit, row.derivedQuantityFormula], [total, "LM", "totalInternal90mmWallsLm"]);
  assert.equal(row.derivedQuantityExplanation, `total Internal 90mm Walls LM (${total}) = ${total}`);
  assert.equal(row.cost, Math.round(total * 52 * 100) / 100);
});
check("row is created automatically when the section has lost it, after 70mm INTERNAL WALL FRAMES", () => {
  const stripped = withoutRow(job);
  assert.equal(stripped.quotation[section].rows.some(isInternal90mmWallFrameRow), false);
  const preview = calc(stripped);
  const names = rowsOf(preview).map((row) => row.item);
  assert.equal(row90(preview).length, 1);
  assert.equal(names.indexOf("90mm INTERNAL WALL FRAMES"), names.indexOf("70mm INTERNAL WALL FRAMES") + 1);
  assert.deepEqual([row90(preview)[0].qty, row90(preview)[0].unit, row90(preview)[0].cost], [total, "LM", Math.round(total * 52 * 100) / 100]);
});
check("existing 70mm exterior / internal rows are not disturbed", () => {
  const pick = (preview) => rowsOf(preview).filter((row) => /70mm/i.test(row.item)).map((row) => [row.id, row.item, row.qty, row.unit, row.cost]);
  assert.deepEqual(pick(calc(withoutRow(job))), pick(base));
  assert.deepEqual(pick(base).map((item) => item[1]), ["70mm EXTERIOR WALLS FRAMES", "70mm INTERNAL WALL FRAMES"]);
});
check("no duplicate: an existing row (by id or by label) is reused", () => {
  assert.equal(ensureInternal90mmWallFrameRow(job.quotation, base.quantities), job.quotation);
  const renamed = { ...job, quotation: { ...job.quotation, [section]: { ...job.quotation[section], rows: job.quotation[section].rows.map((row) => isInternal90mmWallFrameRow(row) ? { ...row, id: "custom-90", item: "90MM Internal Wall Frames" } : row) } } };
  assert.equal(ensureInternal90mmWallFrameRow(renamed.quotation, base.quantities), renamed.quotation);
  assert.equal(row90(calc(renamed)).length, 1);
  assert.equal(row90(calc(renamed))[0].qty, total);
  const once = ensureInternal90mmWallFrameRow(withoutRow(job).quotation, base.quantities);
  assert.equal(ensureInternal90mmWallFrameRow(once, base.quantities), once, "idempotent");
});
check("nothing is created or charged when Job Setup has no 90mm internal walls", () => {
  let none = withoutRow(job);
  for (const key of ["lowerInternal90mmWallsLm", "upperInternal90mmWallsLm", "thirdInternal90mmWallsLm"]) none = setInput(none, key, "");
  const preview = calc(none);
  assert.equal(preview.quantities.totalInternal90mmWallsLm, 0);
  assert.equal(row90(preview).length, 0);
});
check("changing Job Setup refreshes the quantity", () => {
  const changed = calc(setInput(job, "lowerInternal90mmWallsLm", 30));
  assert.equal(row90(changed)[0].qty, changed.quantities.totalInternal90mmWallsLm);
  assert.notEqual(changed.quantities.totalInternal90mmWallsLm, total);
});
check("save / reload / re-import keeps the row and its quantity", () => {
  const persisted = { ...withoutRow(job), quotation: ensureInternal90mmWallFrameRow(withoutRow(job).quotation, base.quantities) };
  const reopened = utils.normalizeWorkbook(JSON.parse(JSON.stringify(utils.withPersistedQuotationOrder(persisted))));
  assert.equal(reopened.quotation[section].rows.filter(isInternal90mmWallFrameRow).length, 1);
  const [row, ...extra] = row90(calc(reopened));
  assert.equal(extra.length, 0);
  assert.deepEqual([row.qty, row.unit, row.derivedQuantityFormula], [total, "LM", "totalInternal90mmWallsLm"]);
  const again = utils.normalizeWorkbook(JSON.parse(JSON.stringify(utils.withPersistedQuotationOrder(reopened))));
  assert.equal(row90(calc(again)).length, 1);
});
log(`\n${results.length} checks passed | current job 90mm INTERNAL WALL FRAMES = ${total} LM (ground ${base.quantities.lowerInternal90mmWallsLm}, second ${base.quantities.upperInternal90mmWallsLm}, third ${base.quantities.thirdInternal90mmWallsLm}) | section: ${section} | row already in saved job: ${job.quotation[section].rows.some(isInternal90mmWallFrameRow)}`);
