import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quoteLineTotal, shouldIncludeQuoteRowInFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';
import { planSelectionReconciliation } from '../lib/builders/selectionReconciliation.js';
import { selectionReconciliationFinancialImpact } from '../lib/builders/quotationFinancialImpact.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

const root = 'test-artifacts/isolated-jobs';
// The pre-consolidation isolated copy (169 sections) is the input; the consolidated copy is checked by test-consolidated-job-file.mjs.
const dir = fs.existsSync(root) ? fs.readdirSync(root).find((name) => fs.existsSync(`${root}/${name}/isolation-report.json`) && JSON.parse(fs.readFileSync(`${root}/${name}/isolation-report.json`, 'utf8')).newJobName === 'GR8 RESULT - QUOTATION RECONCILIATION TEST') : null;
if (!dir) { console.log('SKIP no isolated job present'); process.exit(0); }
const file = fs.readdirSync(`${root}/${dir}`).find((name) => name.endsWith('.gr8job'));
const zip = await JSZip.loadAsync(fs.readFileSync(`${root}/${dir}/${file}`));
const source = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
assert(String(source.jobId).startsWith('gr8-reconcile-test-'), 'only the isolated test job is used');

const money = (value) => Number(String(value ?? '').replace(/[$,]/g, ''));
const rowsOf = (q) => Object.entries(q).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
const isHeading = (row) => row.lineType === 'Heading' || row.quotationSubgroupHeadingLevel;
const before = source.quotation;
const after = normalizeQuotationStructure(before);
const names = Object.keys(after);

// 1-2, 4-5: consolidation by trade, as subheadings, nothing renamed or hidden.
const MERGES = {
  'ENTRY DOORS': { from: ['PIVOT DOOR (67)', 'LAUNDRY/GARAGE 820 1/3 PANEL GLASS DOOR (68)', 'SIDE LIGHTS (70)', 'DOOR FURNITURE (72)'], headings: ['PIVOT DOORS', 'LAUNDRY DOORS', 'SIDELIGHTS', 'DOOR FURNITURE'] },
  'GARAGE DOORS': { from: ['GARAGE DOORS - SECTIONAL PANEL LIFT (74)', 'GARAGE DOORS - MANUAL ROLL-A-DOOR (75)'], headings: ['SECTIONAL DOORS', 'ROLLER DOORS'] },
  'PLUMBING FIXTURES & HOT WATER': { from: ['KITCHEN SINKS (117)', 'KITCHEN TAPS (118)', 'VANITY BASINS (119)', 'WALL MIXERS (120)', 'BATH SPOUTS (121)', 'TOILETS (123)', 'BATHS (124)', 'SPA BATHS (125)', 'LAUNDRY TUBS (126)', 'LAUNDRY TAPS (127)', 'WASHING MACHINE TAPS (128)', 'PROJIX (129)', 'LUCERNE (130)', 'SINGULIER (131)', 'FILTERED WATER TAPS (132)', 'INSINKERATORS (133)', 'HOT WATER (135)'], headings: null },
  'SHOWER SCREENS, MIRRORS & SLIDING DOORS': { from: ['SOFTLINE - FRAMED 1870 HIGH (144)', 'GRANGE -SEMI FRAMELESS (145)'], headings: ['SOFTLINE - FRAMED 1870 HIGH', 'GRANGE -SEMI FRAMELESS'] },
};
const summary = { sectionsBefore: Object.keys(before).length, sectionsAfter: names.length, merges: {} };
let removed = 0, subheadings = 0;
for (const [main, { from, headings }] of Object.entries(MERGES)) {
  assert(after[main], `${main} exists`);
  const mainRows = after[main].rows;
  let preserved = 0;
  for (const name of from) {
    assert(before[name], `${name} exists in the source job`);
    assert(!after[name], `${name} is no longer a top-level section`);
    removed += 1;
    for (const row of before[name].rows) {
      const found = mainRows.find((entry) => entry.id === row.id || entry.legacyRowId === row.id);
      assert(found, `${main} holds ${row.id} from ${name}`);
      const strip = ({ section, id, legacyRowId, ...rest }) => rest;
      assert.deepEqual(strip(found), strip(row), `${row.id} is unchanged (quantity, formula, rate, override, selection)`);
      preserved += 1;
    }
    const heading = mainRows.find((row) => isHeading(row) && row.sourceSectionName === name);
    assert(heading, `${name} became a subheading`);
    if (headings) assert(headings.includes(heading.item), `subheading label ${heading.item}`);
    subheadings += 1;
  }
  summary.merges[main] = { sourceSections: from.length, rowsPreserved: preserved, rowsNow: mainRows.length, subheadings: mainRows.filter(isHeading).length };
}
// Garage: alternative door types stay separate groups, never one charge.
const garage = after['GARAGE DOORS'].rows;
const garageHeadings = garage.map((row, index) => isHeading(row) ? [row.item, index] : null).filter(Boolean);
assert.deepEqual(garageHeadings.map(([item]) => item), ['SECTIONAL DOORS', 'ROLLER DOORS']);
assert(garage.find((row) => row.id === 'quote-976') && garage.findIndex((row) => row.id === 'quote-987') > garageHeadings[1][1], 'roller door rows sit under ROLLER DOORS');
// Structural flooring and Stage Labour keep their own sections; client selections groups stay last where present.
for (const name of ['UPPER LEVEL TIMBER FLOORING (42)', 'GROUND LEVEL TIMBER FLOORING (31)', 'FLOORING (43)', 'Fix-out Stage Labour (7)']) assert(after[name], name);
const plumbingFixtures = after['PLUMBING FIXTURES & HOT WATER'].rows;
const clientAt = plumbingFixtures.findIndex((row) => isHeading(row) && /:client-selections$/.test(row.id));
assert(clientAt > plumbingFixtures.findIndex((row) => isHeading(row) && /kitchen-sinks/.test(row.id)), 'merged fixture groups precede the Client Selections group');
assert.equal(plumbingFixtures.slice(clientAt + 1).filter(isHeading).length, 0, 'Client Selections is the last group, so synced selection rows keep landing in it');

// Row preservation across the whole quotation.
const ids = new Set(rowsOf(after).flatMap(({ row }) => [row.id, row.legacyRowId].filter(Boolean)));
const lost = rowsOf(before).filter(({ row }) => !ids.has(row.id));
assert.equal(lost.length, 0, 'no row id is lost');
summary.rowsBefore = rowsOf(before).length; summary.rowsAfter = rowsOf(after).length; summary.topLevelSectionsConsolidated = removed; summary.subheadingsCreatedByThisConsolidation = subheadings;
assert.deepEqual(normalizeQuotationStructure(JSON.parse(JSON.stringify(after))), after, 'normalising again changes nothing (save/reopen)');
const structurallyNormalized = normalizeQuotationStructure(before, { migrateDerivedRows: false });
const structuralImpact = selectionReconciliationFinancialImpact(
  { ...source, quotation: before },
  { ...source, quotation: structurallyNormalized },
);
assert.equal(structuralImpact.requiresApproval, false, 'section consolidation and generated subheadings are not financial changes');
assert.equal(structuralImpact.rowChanges.length, 0, 'existing rows moved into canonical sections are not reported as changed quotation lines');

// 3: underslab drainage is a live formula.
const workbook = { ...source, quotation: after };
const calc = calculateEstimateBuilderWorkbook(workbook);
const sectionCost = (preview, name) => preview.quotation[name].rows.filter((row) => !row.feeType && !isHeading(row)).reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
const underslabOf = (preview) => preview.quotation['UNDERSLAB AND DRAINAGE'].rows[0];
const underslab = underslabOf(calc);
const plumbingTotal = sectionCost(calc, 'PLUMBING');
assert.equal(Math.round(plumbingTotal * 100), 5827000, 'the PLUMBING contract total, drainage allowances included');
assert.equal(underslab.id, 'quote-30075'); assert.equal(underslab.progressAllocationHistory[0].value, '$3,800.00', 'the superseded charge is history only');
assert.equal(underslab.progressAllocationResult.contractTotal, plumbingTotal); assert.equal(underslab.progressAllocationResult.allocatedAmount, 14567.5);
assert.equal(underslab.progressAllocationResult.status, 'OK'); assert.equal(underslab.cost, 0, 'a progress claim is not a quotation cost'); assert.equal(underslab.qty, 0);
assert.equal(shouldIncludeQuoteRowInFinalBoq(underslab), false, 'not a BOQ line');
assert.equal(rowsOf(after).filter(({ row }) => row.progressAllocation).length, 1, 'one underslab allocation');
// The quotation total excludes the allocation, and is unchanged when the allocation changes.
const totalOf = (preview) => Math.round(rowsOf(preview.quotation).filter(({ row }) => !isHeading(row) && !row.feeType).reduce((sum, { row }) => sum + (Number(row.cost) || 0), 0) * 100) / 100;
const withAllocation = (change) => ({ ...workbook, quotation: { ...after, 'UNDERSLAB AND DRAINAGE': { ...after['UNDERSLAB AND DRAINAGE'], rows: [{ ...after['UNDERSLAB AND DRAINAGE'].rows[0], progressAllocation: { ...after['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocation, ...change } }] } } });
const allocated = (change) => underslabOf(calculateEstimateBuilderWorkbook(withAllocation(change)));
assert.equal(allocated({ percent: 40 }).progressAllocationResult.allocatedAmount, 23308); assert.equal(allocated({ percent: 40 }).cost, 0);
assert.equal(totalOf(calculateEstimateBuilderWorkbook(withAllocation({ percent: 40 }))), totalOf(calc), 'changing the percentage does not move the quotation total');
const manual = allocated({ manualAmount: '$5,000.00' }).progressAllocationResult;
assert.equal(manual.mode, 'MANUAL_OVERRIDE'); assert.equal(manual.allocatedAmount, 5000); assert.equal(manual.calculatedAmount, 14567.5);
assert.equal(allocated({ percent: 25, manualAmount: '$70,000.00' }).progressAllocationResult.status, 'OVER_ALLOCATED');
const bumped = { ...workbook, quotation: { ...after, PLUMBING: { ...after.PLUMBING, rows: after.PLUMBING.rows.map((row) => row.id === 'quote-1185' ? { ...row, manualRate: '$1,880.00', quantity: '1', quantityManualOverride: true } : row) } } };
const calcBumped = calculateEstimateBuilderWorkbook(bumped);
assert.equal(underslabOf(calcBumped).progressAllocationResult.allocatedAmount, Math.round(sectionCost(calcBumped, 'PLUMBING') * 25) / 100, 'follows the plumbing contract total');
assert.notEqual(underslabOf(calcBumped).progressAllocationResult.allocatedAmount, 14567.5);
summary.underslab = { contractTotal: plumbingTotal, percent: 25, calculated: 14567.5, allocated: underslab.progressAllocationResult.allocatedAmount, quotationCostOfAllocation: underslab.cost, supersededCharge: '$3,800.00', quotationTotal: totalOf(calc) };
// Structural flooring and patio ceiling.
const framing = calc.quotation['UPPER LEVEL TIMBER FLOORING (42)'].rows.find((row) => row.id === 'quote-593.6');
assert.equal(Number(framing.qty), 152.15); assert.equal(money(framing.finalRateUsed), 180); assert.equal(Math.round(framing.cost * 100), Math.round(152.15 * 180 * 100));
summary.structuralFlooring = { section: 'UPPER LEVEL TIMBER FLOORING (42)', qty: framing.qty, rate: framing.finalRateUsed, cost: framing.cost };
const patioRow = after['PAINTER (146)'].rows.find((row) => row.id === 'quote-1968');
const patioCalc = calculateEstimateBuilderWorkbook({ ...workbook, quotation: { ...after, 'PAINTER (146)': { ...after['PAINTER (146)'], rows: after['PAINTER (146)'].rows.map((row) => row.id === 'quote-1968' ? { ...row, formulas: { ...(row.formulas || {}), B: 'painterPatioCeilingAreaM2' } } : row) } } }).quotation['PAINTER (146)'].rows.find((row) => row.id === 'quote-1968');
summary.patioCeiling = { qty: patioCalc.qty, manualOverride: patioRow.quantityManualOverride === true };

// 6: driveway through Reconcile Selections (confirmed mapping), against the same job.
const index = new Map(getMasterProducts().map((product) => [product.productId, product]));
const productById = (id) => index.get(id) || null;
const plan0 = planSelectionReconciliation({ workbook: source, productById });
assert.equal(plan0.mutationSummary.addedRows, 9, 'only connector-owned selection rows are reported as additions');
assert.equal(plan0.mutationSummary.addedSelectionDecisions, 7);
assert.equal(plan0.mutationSummary.unownedMutations.length, 0, 'section consolidation cannot create unowned commercial mutations');
const plannedUnderslab = plan0.workbook.quotation['UNDERSLAB AND DRAINAGE'].rows.find((row) => row.id === 'quote-30075');
assert.equal(plannedUnderslab.manualRate, '$3,800.00', 'selection reconciliation preserves the current job total instead of applying an unrelated progress-allocation migration');
assert.equal(plannedUnderslab.progressAllocation, undefined);
const driveway = plan0.proposals.find((proposal) => proposal.requirementKey === 'driveway');
assert(driveway, 'driveway is proposed'); assert.equal(driveway.section, 'CONCRETE AND LANDSCAPING'); assert.equal(driveway.enteredArea.quantity, 60);
assert.equal(driveway.candidates[0].rowId, 'quote-30061'); assert.equal(driveway.recommendedRowId, 'quote-30061');
assert(driveway.alsoPresent.some((entry) => /LANDSCAPING \(148\)|CONCRETE DRIVEWAY IN EXPOSED/i.test(`${entry.section} ${entry.item}`)), 'the legacy LANDSCAPING (148) driveway row is shown as a possible duplicate');
const plan = planSelectionReconciliation({ workbook: source, productById, confirmed: { [driveway.identityKey]: 'quote-30061' } });
const applied = Object.values(plan.workbook.quotation).flatMap((group) => group.rows).find((row) => row.id === 'quote-30061');
assert.equal(applied.qty, 60); assert.equal(applied.unit, 'M2'); assert.equal(applied.quantitySource, 'CLIENT_SELECTION_BUILDER_ENTERED_AREA'); assert.equal(applied.quantityEvidence.source, 'Builder entered');
assert.equal(applied.selectedProductId, 'master-DRIVEWAY-GENERIC-EXPOSED-AGGREGATE'); assert.equal(applied.priceStatus, 'PRICE REQUIRED'); assert.equal(money(applied.templateRateReference), 160);
const calcDrive = calculateEstimateBuilderWorkbook(plan.workbook).quotation['CONCRETE AND LANDSCAPING'].rows.find((row) => row.id === 'quote-30061');
assert.equal(Number(calcDrive.qty), 60); assert.equal(calcDrive.finalRateUsed, ''); assert.equal(Number(calcDrive.cost), 0, 'no $0 is approved: the line waits for a supplier price');
assert(shouldIncludeQuoteRowInFinalBoq(calcDrive) && quoteLineTotal(calcDrive) === 0, 'BOQ carries the driveway as a quote-required line');
const driveRows = Object.values(plan.workbook.quotation).flatMap((group) => group.rows).filter((row) => /driveway/i.test(row.item) && Number(row.qty ?? row.quantity) > 0);
assert.equal(driveRows.length, 1, 'only one driveway row carries a quantity: no duplicate charge');
summary.driveway = { section: 'CONCRETE AND LANDSCAPING', row: 'quote-30061', qty: calcDrive.qty, unit: 'M2', rate: 'PRICE REQUIRED (no approved rate)', templateRateReference: applied.templateRateReference, total: calcDrive.cost, rateStatus: applied.priceStatus, areaSource: applied.quantityEvidence.source, supplier: 'Boral Exposé (selection master-DRIVEWAY-GENERIC-EXPOSED-AGGREGATE)' };

// Save / reopen: reconcile result survives a JSON round trip and a second reconcile changes nothing.
const reopened = JSON.parse(JSON.stringify(plan.workbook));
const second = planSelectionReconciliation({ workbook: reopened, productById });
const driveAgain = second.proposals.find((proposal) => proposal.requirementKey === 'driveway');
assert.equal(driveAgain, undefined, 'a confirmed mapping is not proposed again');
assert.equal(second.changes.filter((change) => change.kind === 'ADDED' || change.kind === 'REMOVED').length, 0);
const reopenedDrive = Object.values(second.workbook.quotation).flatMap((group) => group.rows).find((row) => row.id === 'quote-30061');
assert.equal(reopenedDrive.qty, 60);
summary.secondReconcileChanges = second.changes.length;
console.log(JSON.stringify(summary, null, 2));
console.log('Trade consolidation tests passed against the isolated test job.');
