import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { resolveProgressAllocations, updateProgressAllocationField } from '../lib/construction-estimation/progressAllocation.js';
import { updateQuoteQuantityField } from '../lib/construction-estimation/quoteQuantityFormula.js';
import { quotationSectionsForFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';

const one = (total, allocation) => [...resolveProgressAllocations(total, [{ key: 'a', allocation }]).values()][0];
// Percentage, override precedence, recalculation.
assert.equal(one(58270, { percent: 25 }).allocatedAmount, 14567.5);
assert.equal(one(58270, { percent: '30' }).allocatedAmount, 17481);
assert.equal(one(58270, { percent: 25, manualAmount: '$12,000.00' }).allocatedAmount, 12000);
assert.equal(one(58270, { percent: 25, manualAmount: '$12,000.00' }).mode, 'MANUAL_OVERRIDE');
assert.equal(one(60000, { percent: 25, manualAmount: '$12,000.00' }).allocatedAmount, 12000, 'an active override does not follow the contract total');
assert.equal(one(60000, { percent: 25 }).allocatedAmount, 15000, 'the percentage follows the contract total');
assert.equal(one(60000, { percent: 25, manualAmount: '' }).mode, 'PERCENT', 'clearing the override restores the percentage');
// Over-allocation is flagged, never clamped silently.
const over = one(58270, { percent: 25, manualAmount: '$70,000.00' });
assert.equal(over.status, 'OVER_ALLOCATED'); assert.equal(over.overAllocatedBy, 11730); assert.equal(over.allocatedAmount, 70000);
assert.equal(one(58270, { percent: 140 }).status, 'INVALID_PERCENT'); assert.equal(one(58270, { percent: 25, manualAmount: 'abc' }).status, 'INVALID_OVERRIDE');
// Several stages share one contract: the remainder stage takes only what is left.
const stages = resolveProgressAllocations(58270, [
  { key: 'underslab', allocation: { percent: 25 } }, { key: 'firstFix', allocation: { percent: 40 } }, { key: 'final', allocation: { remainder: true } },
]);
assert.equal(stages.get('final').allocatedAmount, 20394.5); assert.equal(stages.get('underslab').allocatedAmount, 14567.5);
assert.equal(stages.get('final').groupAllocated, 58270); assert.equal(stages.get('final').remaining, 0); assert.equal(stages.get('final').status, 'OK');
const manualUnderslab = resolveProgressAllocations(58270, [{ key: 'underslab', allocation: { percent: 25, manualAmount: '$10,000.00' } }, { key: 'final', allocation: { remainder: true } }]);
assert.equal(manualUnderslab.get('final').allocatedAmount, 48270, 'the remainder follows an overridden stage without double counting');
const overStages = resolveProgressAllocations(58270, [{ key: 'u', allocation: { percent: 60 } }, { key: 'f', allocation: { percent: 60 } }, { key: 'final', allocation: { remainder: true } }]);
assert.equal(overStages.get('final').allocatedAmount, 0); assert.equal(overStages.get('u').status, 'OVER_ALLOCATED'); assert.equal(overStages.get('u').overAllocatedBy, 11654);

// Estimator edits.
const row = { id: 'r', progressAllocation: { stage: 'UNDERSLAB', sourceSection: 'PLUMBING', percent: 25, manualAmount: '' } };
assert.equal(updateQuoteQuantityField(row, 'progressPercent', '30%').progressAllocation.percent, '30');
assert.equal(updateQuoteQuantityField(row, 'progressManualAmount', '12000').progressAllocation.manualAmount, '$12,000.00');
assert.equal(updateProgressAllocationField(updateProgressAllocationField(row, 'progressManualAmount', '12000'), 'progressManualAmount', '').progressAllocation.manualAmount, '');
assert.equal(updateQuoteQuantityField(row, 'progressPercent', '').progressAllocation.percent, 25, 'a blank percentage returns to the default');

// On the isolated job: quotation, BOQ and variation totals do not move.
const root = 'test-artifacts/isolated-jobs';
const dir = fs.existsSync(root) ? fs.readdirSync(root).find((name) => fs.existsSync(`${root}/${name}/isolation-report.json`) && JSON.parse(fs.readFileSync(`${root}/${name}/isolation-report.json`, 'utf8')).newJobName === 'GR8 RESULT - QUOTATION RECONCILIATION TEST') : null;
if (!dir) { console.log('Progress allocation unit tests passed (isolated job absent: workbook checks skipped).'); process.exit(0); }
const zip = await JSZip.loadAsync(fs.readFileSync(`${root}/${dir}/GR8 RESULT - QUOTATION RECONCILIATION TEST.gr8job`));
const source = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
const base = normalizeQuotationStructure(source.quotation);
const costed = (preview) => Object.values(preview.quotation).flatMap((group) => group.rows).filter((r) => !r.feeType && r.lineType !== 'Heading' && !r.quotationSubgroupHeadingLevel);
const total = (preview) => Math.round(costed(preview).reduce((sum, r) => sum + (Number(r.cost) || 0), 0) * 100) / 100;
const boqTotal = (preview) => Math.round(quotationSectionsForFinalBoq(preview.quotation).flatMap((entry) => entry.rows).reduce((sum, r) => sum + (Number(r.cost) || 0), 0) * 100) / 100;
const withoutAllocation = { ...base, 'UNDERSLAB AND DRAINAGE': { ...base['UNDERSLAB AND DRAINAGE'], rows: [] } };
const calcWithout = calculateEstimateBuilderWorkbook({ ...source, quotation: withoutAllocation });
const calc = calculateEstimateBuilderWorkbook({ ...source, quotation: base });
assert.equal(total(calc), total(calcWithout), 'adding the underslab allocation does not change the quotation total');
assert.equal(boqTotal(calc), boqTotal(calcWithout), 'nor the BOQ / purchase cost');
assert.equal(calc.summary.baseLineItemSubtotal, calcWithout.summary.baseLineItemSubtotal);
assert.equal(calc.summary.finalTotal, calcWithout.summary.finalTotal);
const [first] = base['UNDERSLAB AND DRAINAGE'].rows;
// Further plumbing stages on the same contract: the balance stage cannot double count.
const stageRow = (id, stage, allocation) => ({ ...first, id, item: `Plumbing - ${stage}`, progressAllocation: { ...first.progressAllocation, stage, ...allocation }, progressAllocationHistory: [] });
const staged = { ...base, 'UNDERSLAB AND DRAINAGE': { ...base['UNDERSLAB AND DRAINAGE'], rows: [first, stageRow('stage-first-fix', 'FIRST FIX', { percent: 40 }), stageRow('stage-final', 'FINAL', { percent: 0, remainder: true })] } };
const calcStaged = calculateEstimateBuilderWorkbook({ ...source, quotation: staged });
const results = calcStaged.quotation['UNDERSLAB AND DRAINAGE'].rows.map((r) => r.progressAllocationResult);
assert.deepEqual(results.map((r) => r.allocatedAmount), [14567.5, 23308, 20394.5]); assert.equal(results[2].remaining, 0);
assert.equal(total(calcStaged), total(calcWithout), 'stages never add to the quotation total');
assert.equal(calcStaged.quotation['UNDERSLAB AND DRAINAGE'].rows.filter((r) => r.cost !== 0).length, 0);
const overBooked = { ...staged, 'UNDERSLAB AND DRAINAGE': { ...staged['UNDERSLAB AND DRAINAGE'], rows: staged['UNDERSLAB AND DRAINAGE'].rows.map((r) => r.id === 'stage-first-fix' ? { ...r, progressAllocation: { ...r.progressAllocation, percent: 90 } } : r) } };
assert(calculateEstimateBuilderWorkbook({ ...source, quotation: overBooked }).quotation['UNDERSLAB AND DRAINAGE'].rows.every((r) => r.progressAllocationResult.status === 'OVER_ALLOCATED' || r.progressAllocationResult.flags.includes('OVER_ALLOCATED')), 'over-allocation is flagged on every stage of the contract');
// Save / reopen: percentage and override survive a JSON round trip and a second normalisation.
const edited = { ...base, 'UNDERSLAB AND DRAINAGE': { ...base['UNDERSLAB AND DRAINAGE'], rows: [updateQuoteQuantityField(updateQuoteQuantityField(first, 'progressPercent', '30'), 'progressManualAmount', '$12,500.00')] } };
const reopened = normalizeQuotationStructure(JSON.parse(JSON.stringify(edited)));
const reopenedRow = reopened['UNDERSLAB AND DRAINAGE'].rows[0];
assert.equal(reopenedRow.progressAllocation.percent, '30'); assert.equal(reopenedRow.progressAllocation.manualAmount, '$12,500.00'); assert.equal(reopenedRow.progressAllocationHistory[0].value, '$3,800.00');
const reopenedCalc = calculateEstimateBuilderWorkbook({ ...source, quotation: reopened }).quotation['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocationResult;
assert.equal(reopenedCalc.allocatedAmount, 12500); assert.equal(reopenedCalc.calculatedAmount, 17481);
// Plumbing contract change recalculates the percentage but not an active override.
const plumbing = (amountRate) => ({ ...base, PLUMBING: { ...base.PLUMBING, rows: base.PLUMBING.rows.map((r) => r.id === 'quote-1195' ? { ...r, manualRate: amountRate, quantity: '2', quantityManualOverride: true } : r) } });
const changed = calculateEstimateBuilderWorkbook({ ...source, quotation: plumbing('$20,000.00') }).quotation['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocationResult;
assert.equal(changed.contractTotal, 61870); assert.equal(changed.allocatedAmount, 15467.5);
console.log(JSON.stringify({ contractTotal: calc.quotation['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocationResult.contractTotal, allocated: calc.quotation['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocationResult.allocatedAmount, quotationTotal: total(calc), boqTotal: boqTotal(calc), finalTotal: calc.summary.finalTotal }));
console.log('Progress allocation tests passed.');
