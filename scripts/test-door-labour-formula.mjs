// node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-door-labour-formula.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { createInternalDoorPurchaseSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { updateQuoteQuantityField } from '../lib/construction-estimation/quoteQuantityFormula.js';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'anon';
const { __quotationPersistenceTestUtils: T } = await import('../hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const originalLog = console.log;
console.log = () => {};
console.info = () => {};
console.warn = () => {};

export function fixture() {
  const wb = createEstimateBuilderWorkbookDefaults();
  wb.aiPlanTakeoffJob = {
    pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' },
    completedWallRuns: [{ id: 'inside', page: 1, category: 'interior', thicknessMm: 90, lengthMm: 12000 }],
    placedOpenings: [
      { id: 'hinged', quantity: 12, subType: 'Internal', hostWallId: 'inside' },
      { id: 'cavity', quantity: 4, subType: 'Cavity', hostWallId: 'inside' },
      { id: 'robe', quantity: 4, subType: 'Robe', page: 2 },
    ].map(o => ({ page: 1, type: 'door', openingClass: 'Internal Door', widthMm: 820, heightMm: 2040, ...o })),
  };
  // Stale cached Job Setup counts must not replace the current measured total.
  wb.data.liningsTrim = { rows: { internalDoors: { value: 12 } } };
  return T.normalizeWorkbook(wb);
}
const section = wb => Object.keys(wb.quotation).find(s => /^fix-out stage labour/i.test(s));
const row = (wb, id = 'quote-152') => wb.quotation[section(wb)].rows.find(r => r.id === id);
const edit = (wb, key, value, id = 'quote-152') => {
  wb.quotation[section(wb)].rows = wb.quotation[section(wb)].rows.map(r => r.id === id ? updateQuoteQuantityField(r, key, value) : r);
  return wb;
};
const reopen = wb => T.normalizeWorkbook(JSON.parse(JSON.stringify(T.compactWorkbookForStorage(wb))));

let wb = fixture();
const purchasing = createInternalDoorPurchaseSchedule(wb.aiPlanTakeoffJob);
assert.equal(purchasing.openings.filter(o => o.purchaseType === 'single').reduce((s, o) => s + o.quantity, 0), 12, 'reproduces old purchasing-subtype count');
let result = calculateEstimateBuilderWorkbook(wb);
assert.equal(result.quantities.internalDoors, 20);
assert.equal(result.quantities.cavityDoorQty, 4);
assert.equal(row(result, 'quote-150').qty, 4);
assert.equal(row(result).qty, 16);
assert.equal(row(result).derivedQuantityFormula, 'internalDoors-cavityDoorQty');
assert.equal(row(result).derivedQuantityExplanation, 'Internal Doors (20) - Cavity Sliding Doors (4) = 16');
// The fix changes labour's mapping, not robe/cavity purchasing classifications.
assert.equal(purchasing.openings.find(o => o.id === 'robe').purchaseType, 'robe');
assert.equal(row(calculateEstimateBuilderWorkbook(reopen(wb))).qty, 16);

edit(wb, 'quantityFormula', '=internalDoors-cavityDoorQty+2');
result = calculateEstimateBuilderWorkbook(wb);
assert.equal(row(result).qty, 18);
wb = reopen(wb);
assert.equal(row(wb).formulas.B, 'internalDoors-cavityDoorQty+2');
assert.equal(row(calculateEstimateBuilderWorkbook(wb)).qty, 18);
edit(wb, 'quantityFormula', '=internalDoors-internalDoors');
assert.equal(row(calculateEstimateBuilderWorkbook(reopen(wb))).qty, 0, 'zero formula never falls back to linked quantity');
edit(wb, 'quantity', '=internalDoors-cavityDoorQty+1');
assert.equal(row(calculateEstimateBuilderWorkbook(reopen(wb))).qty, 17, 'existing Qty formula editor uses the same contract');
for (const manual of ['7', '0', '']) {
  edit(wb, 'quantity', manual);
  result = calculateEstimateBuilderWorkbook(reopen(wb));
  assert.equal(row(result).qty, Number(manual));
  assert.equal(row(result).derivedQuantityFormula, '', 'manual override does not advertise an inactive formula');
}
edit(wb, 'quantityFormula', '=internalDoors-cavityDoorQty');
wb.aiPlanTakeoffJob = structuredClone(wb.aiPlanTakeoffJob);
wb.aiPlanTakeoffJob.placedOpenings[0].quantity = 14;
result = calculateEstimateBuilderWorkbook(reopen(wb));
assert.equal(row(result).qty, 18, 'changed takeoff recalculates from 22 - 4');
edit(wb, 'quantityFormula', '=cavityDoorQty+1', 'quote-150');
assert.equal(row(calculateEstimateBuilderWorkbook(reopen(wb)), 'quote-150').qty, 5, 'forced-linked cavity row honours an edited formula');
edit(wb, 'quantityFormula', '=skirtingLm+2', 'quote-159');
result = calculateEstimateBuilderWorkbook(reopen(wb));
assert.equal(row(result, 'quote-159').qty, result.quantities.skirtingLm + 2, 'other labour formula edits persist');
// All calculated rows with an effective quantity source now expose that source.
const derived = Object.values(result.quotation).flatMap(s => s.rows).filter(r => r.derivedQuantityFormula);
assert(derived.length > 10);
assert(derived.every(r => r.derivedQuantityExplanation));
// Spreadsheet references must use the same edited quantities (including zero) as displayed rows.
edit(wb, 'quantityFormula', '=0', 'quote-150');
edit(wb, 'quantityFormula', '=B150+3');
assert.equal(row(calculateEstimateBuilderWorkbook(reopen(wb))).qty, 3);

const out = 'artifacts/test-artifacts/door-labour-formula';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/fixture.json`, JSON.stringify(fixture()));
originalLog('PASS: old subtype count 12 reproduced; total internal doors 20 - cavity doors 4 = 16; editable Selection formula, zero, manual overrides, changed takeoff, other labour formulas and save/reopen verified.');
