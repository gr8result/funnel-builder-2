import assert from 'node:assert/strict';
import { createTakeoffSchedule, createJobSetupPayload, createJobSetupWindowSchedule, createInternalDoorSizeSchedule, createRobeSlidingDoorSchedule, createInternalDoorJambTrace, createInternalDoorReconciliationTrace, createCavitySliderCageSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { createJobData, resolveAiPlanTakeoffJobData } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';
import { V4_DATA_SECTIONS } from '../lib/construction-estimation/estimateWorksheetV4Schema.js';
import { withTakeoffInputRows, normalizeTakeoffInputSection } from '../lib/construction-estimation/takeoffInputRows.js';
import { applyJobSetupImport, createJobSetupImportPreview } from '../lib/construction-estimation/jobSetupTakeoffImport.js';
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { takeoffProcurementDetails, withTakeoffJambQuoteRows, assignPlasterboardSupplier, procurementSupplierKey, refreshTakeoffProcurementItems } from '../lib/construction-estimation/takeoffProcurement.js';
import { quotationSectionsForFinalBoq, quoteQuantity, quoteRate, quoteLineTotal, shouldIncludeQuoteRowInFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';
import { readFileSync } from 'node:fs';
import { restoreCompleteWorkbook } from '../lib/construction-estimation/jobPersistence.js';
import { brickOrderQuantities } from '../lib/construction-estimation/takeoffMaterialQuantities.js';

const wall = (id, category, lengthMm, extra = {}) => ({ id, page: 1, category, lengthMm, thicknessMm: category === 'interior' ? '70 mm' : 90, wallHeightM: 2.4, exteriorType: 'Brick Veneer', linedFaces: 2, ...extra });
const opening = (id, hostWallId, openingClass, widthMm, heightMm, extra = {}) => ({ id, page: 1, hostWallId, openingClass, widthMm, heightMm, ...extra });
const payloadFor = (extra) => createJobSetupPayload(createTakeoffSchedule({ totalPages: 3, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' }, ...extra }));
function workbook(values = {}) {
  const rows = Object.fromEntries(V4_DATA_SECTIONS.find((section) => section.key === 'inputDataSheet').rows.map((row) => [row.key, { value: '' }]));
  for (const [key, value] of Object.entries({ floorCount: 'Three storey', lowerCeilingHeight: 2400, upperCeilingHeight: 2400, thirdCeilingHeight: 2400, ...values })) rows[key] = { value };
  return { data: { inputDataSheet: { rows, customRows: [], hiddenRows: [] } }, formulas: { ...V4_DEFAULT_FORMULAS }, windowsDoors: [], quotation: {} };
}
const rows = INPUT_DATA_SHEET_TEMPLATE.rows;
const once = withTakeoffInputRows(rows);
assert.deepEqual(withTakeoffInputRows(once), once, 'Canonical row generation is idempotent');
assert.equal(new Set(once.map((row) => row.key)).size, once.length);
const mapping = rows.find((row) => row.key === 'lowerBrickVeneerExternalWallsLm');
const savedCopies = { rows: { [mapping.key]: { value: '' }, copy: { value: 20 } }, customRows: [{ ...mapping, key: 'copy' }, { ...mapping, key: 'copy2' }, { key: 'my-note', label: 'Keep my custom input' }] };
const normalized = normalizeTakeoffInputSection(savedCopies, rows);
assert.equal(normalized.rows[mapping.key].value, 20);
assert.deepEqual(normalized.customRows.map((row) => row.key), ['my-note']);
assert.deepEqual(normalizeTakeoffInputSection(JSON.parse(JSON.stringify(normalized)), rows), normalized, 'Saved canonical copies migrate once and survive reopening');

const patio = payloadFor({ completedFloorplans: [{ id: 'patio', page: 1, type: 'Patio', nodes: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] }] });
const patioKey = rows.find((row) => row.sourceRow === 16).key;
assert.equal(rows.find((row) => row.sourceRow === 16).label, 'Ground Level Patio area', 'Patio label matches the other Job Setup entries\' naming style');
assert.equal(rows.find((row) => row.sourceRow === 16).section, 'Floor / Slab Areas', 'Patio sits in the same section as its Floor / Slab Areas neighbours');
assert.equal(patio.dataInputFields[patioKey], 12);
assert.equal(patio.dataInputFields.lowerPorchAreaM2, undefined);
const imported = applyJobSetupImport(workbook(), patio);
assert.equal(imported.data.inputDataSheet.rows[patioKey].value, '12');
assert.equal(calculateEstimateBuilderWorkbook(imported).quantities.lowerSlabAreaM2, 12, 'Patio remains in the slab total after editable formulas run');
const oldPatioImport = workbook({ lowerOtherAreaM2: 12 });
oldPatioImport.takeoffEngine = { lastJobSetupSync: { importedFields: { lowerOtherAreaM2: { value: 12 } } } };
assert.equal(calculateEstimateBuilderWorkbook(applyJobSetupImport(oldPatioImport, patio)).quantities.lowerSlabAreaM2, 12, 'Moving an earlier Patio import from Other does not count its area twice');
assert.equal(applyJobSetupImport(imported, patio), imported, 'Second import is a no-op');
assert.equal(Object.keys(applyJobSetupImport(JSON.parse(JSON.stringify(imported)), patio).data.inputDataSheet.rows).length, Object.keys(imported.data.inputDataSheet.rows).length);

const framing = payloadFor({ completedWallRuns: [wall('ordinary', 'interior', 20000), ...['Ground Floor', 'Second Level', 'Third Level'].map((level, index) => wall(`cavity-${index}`, 'interior', 3620, { level, page: index + 1, thicknessMm: '90mm' })), wall('external-frame', 'exterior', 5000)], placedOpenings: [0, 1, 2].map((index) => opening(`cavity-door-${index}`, `cavity-${index}`, 'Internal Door', 820, 2040, { page: index + 1, subType: 'cavity sliding door' })) });
for (const prefix of ['lower', 'upper', 'third']) {
  assert.equal(framing.dataInputFields[`${prefix}Internal90mmWallsLm`], 3.62);
  assert.equal(framing.dataInputFields[`${prefix}Internal70mmWallsLm`], prefix === 'lower' ? 20 : 0);
  assert.equal(framing.dataInputFields[`${prefix}CavitySlider90mmStudsEach`], 9);
}
assert.equal((framing.dataInputFields.lowerInternal70mmWallsLm || 0) + (framing.dataInputFields.lowerInternal90mmWallsLm || 0), 23.62);
const framingWorkbook = applyJobSetupImport(workbook(), framing);
assert.equal(createJobSetupImportPreview(workbook(), framing).rows.filter((row) => row.status === 'unavailable').length, 0, 'All emitted fields are importable');
const fq = calculateEstimateBuilderWorkbook(framingWorkbook).quantities;
for (const prefix of ['lower', 'upper', 'third']) {
  assert.equal(fq[`${prefix}Internal90mmWallsLm`], 3.62);
  assert.equal(fq[`${prefix}WallPlatesNoggins90mmInternalLm`], 10.86);
  assert.equal(fq[`${prefix}Internal90mmStudsEach`], 9);
  assert.equal(fq[`${prefix}StudMaterial90mmInternalLm`], 21.6, 'Studs use 2.4m, not the imported 2400mm value');
}
assert.equal(fq.lowerWallPlatesNoggins90mmExternalLm, 20, 'External plates/noggins remain x4');
assert.equal(fq.internalFramedWall90mmLm, 10.86, 'Section92 totals the three measured 90mm runs');
assert.equal(fq.internalFramedWall70mmLm, 20, 'Section92 keeps the predominant 70mm framing separate');
assert.ok(fq.internalPlasterboardWallM2 > 96, '90mm walls still contribute lined area');
const oldFormulaWorkbook = structuredClone(framingWorkbook);
oldFormulaWorkbook.formulas.lowerWallPlatesNoggins90mmInternalLm = 'GroundFloorInternal90mmWallsLm * 4';
assert.equal(calculateEstimateBuilderWorkbook(oldFormulaWorkbook).quantities.lowerWallPlatesNoggins90mmInternalLm, 10.86, 'Shipped old x4 formula upgrades');

const brickOpening = opening('face-window', 'face', 'Window', 2500, 1200, { quantity: 2 });
const mixed = payloadFor({ completedWallRuns: [wall('face', 'exterior', 20000), wall('render', 'exterior', 42000, { exteriorType: 'Rendered Brick Veneer', wallHeightM: 2.5 }), wall('clad', 'exterior', 10000, { exteriorType: 'Lightweight Cladding' }), wall('internal', 'interior', 5000)], placedOpenings: [brickOpening, { ...brickOpening }, opening('render-window', 'render', 'Window', 2000, 2500), opening('clad-window', 'clad', 'Window', 1000, 1000), opening('internal-door', 'internal', 'Internal Door', 800, 2000, { quantity: 2 }), opening('wrong-floor', 'face', 'Window', 1000, 1000, { level: 'Second Level' })] });
const mf = mixed.dataInputFields;
assert.equal(mf.lowerBrickVeneerExternalWallsLm, 20);
assert.equal(mf.lowerRenderedMasonryExternalWallsLm, 0, 'Rendered brick veneer is not folded into rendered masonry');
assert.equal(mf.lowerRenderedBrickVeneerExternalWallsLm, 42, 'Rendered brick veneer reports against its own construction class');
assert.equal(mf.lowerLightweightCladdingExternalWallsLm, 10);
assert.equal(mf.lowerBrickVeneerGrossWallM2, 48);
assert.equal(mf.lowerBrickVeneerOpeningM2, 6, 'Duplicate, cladding, internal and wrong-level openings never reduce face brick');
assert.equal(mf.lowerBrickVeneerNetWallM2, 42);
assert.equal(mf.lowerRenderedBrickVeneerOpeningM2, 5);
assert.equal(mf.lowerRenderedBrickVeneerNetWallM2, 100);
assert.equal(mf.doorOpeningsAreaM2, 3.2);
assert.equal(mf.windowOpeningsAreaM2, 13);
assert.equal(mf.lowerWindowOpeningsAreaM2, 12);
assert.equal(mf.upperWindowOpeningsAreaM2, 1);
const mq = calculateEstimateBuilderWorkbook(applyJobSetupImport(workbook(), mixed)).quantities;
assert.equal(mq.totalPlasterboardM2, 182.6, 'Mixed wall heights and linked deductions stay in square metres');
assert.equal(mq.faceBrickBaseEach, 2184);
assert.equal(mq.faceBrickOrderEach, 2403);
assert.equal(mq.renderedTwinOrderEach, 2574);
assert.equal(mq.renderedSingleOrderEach, 572);
assert.equal(brickOrderQuantities(1.8007, 0).faceBrickOrderEach, 104, 'A real fractional brick survives until the final round up');
assert.equal(brickOrderQuantities(0, 0.3497).renderedTwinOrderEach, Math.ceil(0.3497 * .9 * 26 * 1.1), 'Rendered area splits retain their measurement precision');
const preciseBrick = payloadFor({ completedWallRuns: [wall('precise-brick', 'exterior', 1000, { wallHeightM: 1.8007 })] });
assert.equal(calculateEstimateBuilderWorkbook(applyJobSetupImport(workbook(), preciseBrick)).quantities.faceBrickOrderEach, 104, 'Import and level aggregation retain precision through the final brick order');
assert.equal(mq.quoteFaceBricksBaseRange, 2.403, 'Per-thousand quoted units retain whole-brick ordering precision');
assert.equal(mq.lowerWindowDoorDeductionsM2, 12, 'Item83 deducts ground external openings only');
assert.equal(mq.upperWindowDoorDeductionsM2, 0, 'Item84 excludes conflicting wall links');

// Item 78/79 (Second/Third Level Total Wall Area) must add floor build-up depth to ceiling
// height, not ceiling height alone - and must still do so once the workbook has its own saved
// formula for the key (as every real saved job does, since one is written for every V4_DEFAULT_
// FORMULAS key by default). currentFormula's stale-formula repair for these two keys used to sit
// entirely after the "any saved formula wins" return, so it never ran for a workbook that had
// this exact pre-floor-depth formula saved - reproduced here with that saved formula explicit.
const staleWallAreaFormula = { upperExternalWallAreaM2: 'upperExternalWallsLm * upperCeilingHeight' };
const wallAreaWorkbook = { ...workbook({ floorCount: 'Two storey', upperExternal70mmWallsLm: 49.3859, upperExternal90mmWallsLm: 0, upperCeilingHeight: 2.74, upperFloorDepthMm: '' }), formulas: { ...V4_DEFAULT_FORMULAS, ...staleWallAreaFormula } };
assert.equal(calculateEstimateBuilderWorkbook(wallAreaWorkbook).quantities.upperExternalWallAreaM2, 151.08, 'Item 78 adds floor build-up depth to ceiling height even with a stale saved formula on file');

// Items 83-89: opening deductions and net wall area must use Window Schedule's own canonical
// per-level total (lowerExternalOpeningAreaM2 etc, imported from Takeoff), not the separate,
// manually-keyed Windows & Doors price-book sheet (wd.totals) that has no connection to the
// Takeoff. A workbook with real Takeoff openings but nothing in that manual sheet must still show
// the real deduction, not zero.
const openingDeductionWorkbook = { ...workbook({ floorCount: 'Two storey', lowerExternalWallsLm: 40, lowerCeilingHeight: 2.5, lowerExternalOpeningAreaM2: 12 }) };
const openingDeductionQuantities = calculateEstimateBuilderWorkbook(openingDeductionWorkbook).quantities;
assert.equal(openingDeductionQuantities.lowerExternalWallAreaM2, 100, 'Gross area set up as 40 LM x 2.5m for a round net-area check');
assert.equal(openingDeductionQuantities.lowerWindowDoorDeductionsM2, 12, 'Item 83 reads the canonical Takeoff-imported opening area, not the disconnected manual Windows & Doors sheet');
assert.equal(openingDeductionQuantities.lowerNetExternalWallAreaM2, 88, 'Item 88 nets against the canonical Item 83 value (100 - 12)');
const noTakeoffOpeningWorkbook = { ...workbook({ floorCount: 'Two storey', lowerExternalWallsLm: 40, lowerCeilingHeight: 2.5 }) };
assert.equal(calculateEstimateBuilderWorkbook(noTakeoffOpeningWorkbook).quantities.lowerWindowDoorDeductionsM2, 0, 'With no canonical Takeoff opening area imported, the manual Windows & Doors fallback (empty here) still applies - no regression for a job that predates Takeoff import');

// Items 6's wall-area-by-system rows (lowerBrickVeneerGrossWallM2 etc): the exact same Ground
// Floor-vs-upper-level wall height rule as Item 77/78 applies here too, since these feed the
// downstream brick/bricklayer/render/cladding quantities directly.
const wallAreaBySystem = payloadFor({
  completedWallRuns: [wall('gf-bv', 'exterior', 49385.9, { page: 1, exteriorType: 'Brick Veneer', wallHeightM: null }), wall('sl-bv', 'exterior', 49385.9, { page: 2, exteriorType: 'Brick Veneer', wallHeightM: null })],
  jobSetupRows: { lowerCeilingHeight: { value: 2.74 }, upperCeilingHeight: { value: 2.74 }, upperFloorDepthMm: { value: '319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)' } },
});
assert.equal(wallAreaBySystem.dataInputFields.lowerBrickVeneerGrossWallM2, 135.3174, 'Ground Floor Brick Veneer wall area uses ceiling height only, matching Item 77');
assert.equal(wallAreaBySystem.dataInputFields.upperBrickVeneerGrossWallM2, 151.0715, 'Second Level Brick Veneer wall area adds floor build-up depth, matching Item 78');

const sills = payloadFor({ completedWallRuns: [wall('ground', 'exterior', 10000), wall('front', 'exterior', 10000, { page: 2, elevation: 'Front' }), wall('rear-clad', 'exterior', 10000, { page: 2, elevation: 'Rear', exteriorType: 'Lightweight Cladding' }), wall('inside', 'interior', 10000, { page: 2 })], placedOpenings: [opening('g', 'ground', 'Window', 1200, 1200), opening('u', 'front', 'Window', 1800, 1200, { page: 2 }), opening('ud', 'front', 'External Door', 2400, 2100, { page: 2, brickworkBelow: true }), opening('c', 'rear-clad', 'Window', 3000, 1200, { page: 2 }), opening('i', 'inside', 'Internal Door', 820, 2040, { page: 2 }), opening('none-below', 'front', 'Window', 1000, 1200, { page: 2, brickworkBelow: false })] });
assert.equal(sills.dataInputFields.brickVeneerSillsLm, 6.4, 'Brick-veneer windows include a sill even when an old below-brickwork flag is false');
assert.equal(sills.schedule.projectTotals.windows.find((row) => row.itemId === 'brick_sill_total').quantity, 6.4, 'The exported schedule includes all brick-veneer window sills and the existing upper-front brick door sill');
assert.equal(calculateEstimateBuilderWorkbook(applyJobSetupImport(workbook(), sills)).quantities.lockupBrickSillsLm, 6.4);

const jambArgs = { completedWallRuns: [wall('thin', 'interior', 30000), wall('thick', 'interior', 10000, { thicknessMm: '90 mm' })], placedOpenings: [opening('d70', 'thin', 'Internal Door', 820, 2040, { quantity: 8 }), opening('d90', 'thick', 'Internal Door', 820, 2040, { quantity: 2 }), opening('robe-a', 'thin', 'Internal Door', 1450, 2000, { subType: 'robe sliding' }), opening('robe-b', 'thin', 'Internal Door', 1000, 1100, { subType: 'robe sliding' }), opening('robe90', 'thick', 'Internal Door', 1450, 2000, { subType: 'robe sliding' }), opening('cavity90', 'thick', 'Internal Door', 820, 2040, { subType: 'cavity sliding', quantity: 5 })] };
const jambs = payloadFor(jambArgs);
assert.equal(jambs.dataInputFields.jamb90x19StockLengthsEach, 11, '8 standard + independently rounded robe stock (2 + 1)');
assert.equal(jambs.dataInputFields.jamb110x19StockLengthsEach, 4, '2 standard + 2 robe stock; a cavity slider on the same 90mm wall draws no jamb stock at all - its cage already includes the jamb');
// A Takeoff with ONLY cavity-slider doors on its 90mm walls (New Job 03/09's exact reported
// scenario) must show zero jamb stock in both sizes - a 90mm wall existing is never itself a
// jamb-stock requirement, only an actual non-cavity-slider door hosted on it is.
const onlyCavitySliders = payloadFor({ completedWallRuns: [wall('cavity-wall', 'interior', 10000, { thicknessMm: '90 mm' })], placedOpenings: [opening('cs-1', 'cavity-wall', 'Internal Door', 820, 2040, { subType: 'cavity sliding' }), opening('cs-2', 'cavity-wall', 'Internal Door', 1020, 2040, { subType: 'cavity sliding', quantity: 2 })] });
assert.equal(onlyCavitySliders.dataInputFields.jamb90x19StockLengthsEach, 0, 'No 70mm-framed doors at all');
assert.equal(onlyCavitySliders.dataInputFields.jamb110x19StockLengthsEach, 0, 'Every 90mm-framed door is a cavity slider, so none draws jamb stock');

// APPLY-TAKEOFF PATH: jamb90x19StockLengthsEach/jamb110x19StockLengthsEach are Takeoff-derived
// material quantities, not values a builder has any legitimate reason to hand-type differently from
// what the current opening set computes - ALWAYS_TRUST_TAKEOFF_KEYS in jobSetupTakeoffImport.js
// exempts exactly these two keys from the general manual-override protection, so a fresh Apply
// always overwrites them with the recalculated number. Two starting states are checked: a stale "3"
// that was itself a prior Takeoff import (found in importedFieldHistory), and a stale "3" with no
// import history at all (previously indistinguishable from a hand-typed value, and previously
// blocked pending manual review) - both must now be overwritten by a plain default-selected Apply,
// with no explicit per-field selection required, so a stale jamb quantity can never survive simply
// because nobody remembered to tick it in a review screen.
const staleFromEarlierImport = workbook({ jamb110x19StockLengthsEach: '3' });
staleFromEarlierImport.takeoffEngine = { lastJobSetupSync: { importedFields: { jamb110x19StockLengthsEach: { value: '3' } } } };
const reappliedFromEarlierImport = applyJobSetupImport(staleFromEarlierImport, onlyCavitySliders);
assert.equal(reappliedFromEarlierImport.data.inputDataSheet.rows.jamb110x19StockLengthsEach.value, '0', 'A stale value that was itself a prior Takeoff import result is overwritten by the corrected recalculation on reapply - it is not treated as a protected manual edit');

const staleWithNoHistory = workbook({ jamb110x19StockLengthsEach: '3' });
const stalePreview = createJobSetupImportPreview(staleWithNoHistory, onlyCavitySliders);
const staleJambPreviewRow = stalePreview.rows.find((row) => row.destinationKey === 'jamb110x19StockLengthsEach');
assert.ok(staleJambPreviewRow, 'jamb110x19StockLengthsEach appears in the import review even though its new value is 0, not blank');
assert.equal(staleJambPreviewRow.manualOverride, false, 'jamb110x19StockLengthsEach is exempt from manual-override protection - a stale "3" with no import history is never mistaken for a deliberate hand-edit');
assert.equal(staleJambPreviewRow.selected, true, 'Auto-selected by a plain Apply, with no explicit per-field confirmation required - a stale jamb quantity cannot survive simply because a reviewer did not tick a box');
const reappliedWithNoHistoryDefault = applyJobSetupImport(staleWithNoHistory, onlyCavitySliders);
assert.equal(reappliedWithNoHistoryDefault.data.inputDataSheet.rows.jamb110x19StockLengthsEach.value, '0', 'A plain default Apply (no selectedKeys argument at all) overwrites the stale 3 with the correct 0 - the exact path the live "Apply Takeoff" action uses');

// The same exemption must NOT leak onto ordinary editable fields - a genuine manual measurement
// correction (e.g. brickVeneerSillsLm, not a jamb key) must still be protected exactly as before.
const staleSill = workbook({ brickVeneerSillsLm: '99' });
const sillPreview = createJobSetupImportPreview(staleSill, sills);
const sillPreviewRow = sillPreview.rows.find((row) => row.destinationKey === 'brickVeneerSillsLm');
assert.equal(sillPreviewRow.manualOverride, true, 'Manual-override protection is completely unaffected for every field other than the two jamb keys - a hand-typed sill length is still protected');
const jambWorkbook = applyJobSetupImport(workbook(), jambs);
assert.equal(withTakeoffJambQuoteRows(jambWorkbook.quotation, jambWorkbook.data.inputDataSheet.rows), jambWorkbook.quotation, 'Jamb quote row generation is idempotent');
const jambQuote = calculateEstimateBuilderWorkbook(jambWorkbook).quotation;
const jambBoq = quotationSectionsForFinalBoq(jambQuote).flatMap((section) => section.rows);
assert.deepEqual(jambBoq.map((row) => [row.quantityKey, row.qty, row.unit]), [['jamb90x19StockLengthsEach', 11, 'EACH'], ['jamb110x19StockLengthsEach', 4, 'EACH']], 'Both jamb stocks reach BOQ with their own identities');

// createInternalDoorJambTrace (the Item 127 diagnostic) must independently sum to the exact same
// two totals takeoffMaterialFields already produces above - same rule, applied per-door, not a
// second implementation that could quietly drift from the aggregate.
const jambTrace = createInternalDoorJambTrace({ ...jambArgs, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' } });
const traceTotal = (bucket) => jambTrace.filter((row) => row.jambBucket === bucket).reduce((sum, row) => sum + row.contributedLengths, 0);
assert.equal(traceTotal('jamb90x19StockLengthsEach'), 11, 'Trace rows sum to the same 90x19 total as the aggregate calculation');
assert.equal(traceTotal('jamb110x19StockLengthsEach'), 4, 'Trace rows sum to the same 110x19 total as the aggregate calculation');
assert.ok(jambTrace.every((row) => !row.isCavitySlider || row.jambBucket.startsWith('none')), 'Every cavity slider row is traced as drawing no jamb stock, with a reason, never silently folded into a bucket');
assert.equal(jambTrace.find((row) => row.id === 'cavity90').jambBucket, 'none (cavity slider cage supplies jamb)', 'The cavity slider on the 90mm wall is traced with its exclusion reason, not counted as a 110x19 contributor');
assert.equal(jambTrace.find((row) => row.id === 'd90').jambBucket, 'jamb110x19StockLengthsEach', 'A genuine 90mm-framed passage door is traced to 110x19, matching the existing jamb rule (90x19 = 70mm frame, 110x19 = 90mm frame)');
assert.equal(jambTrace.find((row) => row.id === 'd70').jambBucket, 'jamb90x19StockLengthsEach', 'A 70mm-framed passage door is traced to 90x19');

// createInternalDoorSizeSchedule (the Item 125 procurement breakdown) must group STANDARD
// (hinged/passage) doors by actual width/height found in the Takeoff - not a hard-coded size list,
// and NOT split further by host frame thickness (a 720x2040 door is the same product whether it
// hangs in a 70mm or a 90mm wall - splitting it produced the real "820mm Internal Door" duplicate-
// row bug this fixes). Cavity sliders and robe/sliding doors must both be completely absent -
// cavity sliders are reported by the separate cavity-slider-cage schedule, and robe/sliding doors
// are a distinct product/supplier stream reported by createRobeSlidingDoorSchedule below.
const doorSizeSchedule = createInternalDoorSizeSchedule({ ...jambArgs, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' } });
assert.ok(!doorSizeSchedule.rows.some((row) => row.openings?.some((o) => o.id === 'cavity90')), 'Cavity slider openings never appear in the internal door size breakdown');
assert.ok(!doorSizeSchedule.rows.some((row) => ['robe-a', 'robe-b', 'robe90'].includes(row.openings?.[0]?.id) || row.widthMm === 1450 || row.widthMm === 1000), 'Robe sliding doors never appear in the standard internal door size breakdown - they are a separate product');
assert.ok(doorSizeSchedule.rows.every((row) => row.hostFrameThicknessMm === null), 'Standard door rows are never split by host frame thickness - it is not part of the door leaf product');
// d70 (8 x 820mm, 70mm wall) and d90 (2 x 820mm, 90mm wall) are now ONE product line (10 total) -
// exactly the fix for the real duplicate-row bug (same nominal door, two rows, two quantities).
const size820x2040 = doorSizeSchedule.rows.find((row) => row.widthMm === 820 && row.heightMm === 2040);
assert.equal(size820x2040.quantity, 10, 'd70 (8, 70mm wall) + d90 (2, 90mm wall) merge into one 820mm standard-door product line');
assert.equal(doorSizeSchedule.rows.length, 1, 'Only one standard-door size exists in this fixture (820mm) once robes are correctly excluded');

// createRobeSlidingDoorSchedule is the separate product/supplier-stream schedule the robe/sliding
// doors above must land in instead - same width x height-only grouping, completely disjoint from
// both the standard-door schedule and the cavity-slider-cage schedule.
const robeSchedule = createRobeSlidingDoorSchedule({ ...jambArgs, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' } });
assert.ok(!robeSchedule.rows.some((row) => row.openings?.some((o) => o.id === 'cavity90')), 'Cavity slider openings never appear in the robe/sliding door schedule either');
assert.ok(!robeSchedule.rows.some((row) => row.widthMm === 820), 'Standard internal doors never appear in the robe/sliding door schedule');
assert.equal(robeSchedule.rows.filter((row) => row.widthMm === 1450 && row.heightMm === 2000).reduce((sum, row) => sum + row.quantity, 0), 2, 'Robe sliding doors (1450x2000, one on the 70mm wall, one on the 90mm wall) merge into one robe/sliding product line, quantity 2');
assert.ok(robeSchedule.rows.some((row) => row.widthMm === 1000 && row.heightMm === 1100), 'A distinct measured robe size gets its own row rather than being folded into another size');
assert.ok(robeSchedule.rows.every((row) => row.hostFrameThicknessMm === null), 'Robe/sliding door rows are never split by host frame thickness either');

// HARD RECONCILIATION TEST - mirrors the exact opening structure independently verified against the
// real saved Takeoff for this job (6x 820mm, 8x 720mm [7 on 70mm walls + 1 on a 90mm wall], 2x
// 1020mm standard doors; 2x 2100mm + 2x 2400mm robe/sliding doors; zero cavity sliders) - built as a
// realistic fixture (generic synthetic ids/wall ids, not the customer's own data) so this proves the
// real production pipeline (createMeasurementRecords -> associateTakeoffMeasurements ->
// createInternalDoorSizeSchedule / createRobeSlidingDoorSchedule / createInternalDoorJambTrace /
// createInternalDoorReconciliationTrace) reconciles this opening set into exactly the numbers
// already independently confirmed against the live Takeoff data, rather than a hard-coded output.
const reconciliationWalls = [
  wall('w-820-a', 'interior', 3000), wall('w-820-b', 'interior', 3000, { id: 'w-820-b' }),
  wall('w-720-a', 'interior', 3000), wall('w-720-b', 'interior', 3000), wall('w-720-c', 'interior', 3000),
  wall('w-720-d', 'interior', 3000), wall('w-720-e', 'interior', 3000), wall('w-720-f', 'interior', 3000), wall('w-720-g', 'interior', 3000),
  wall('w-720-90mm', 'interior', 3000, { thicknessMm: '90 mm' }),
  wall('w-1020', 'interior', 3000),
  wall('w-robe-2400-a', 'interior', 3000), wall('w-robe-2400-b', 'interior', 3000),
  wall('w-robe-2100-a', 'interior', 3000), wall('w-robe-2100-b', 'interior', 3000),
];
const reconciliationOpenings = [
  opening('door-820-1', 'w-820-a', 'Internal Door', 820, 2040),
  opening('door-820-2', 'w-820-a', 'Internal Door', 820, 2040),
  opening('door-820-3', 'w-820-b', 'Internal Door', 820, 2040),
  opening('door-820-4', 'w-820-b', 'Internal Door', 820, 2040),
  opening('door-820-5', 'w-820-b', 'Internal Door', 820, 2040),
  opening('door-820-6', 'w-820-a', 'Internal Door', 820, 2040),
  opening('door-720-1', 'w-720-a', 'Internal Door', 720, 2040),
  opening('door-720-2', 'w-720-b', 'Internal Door', 720, 2040),
  opening('door-720-3', 'w-720-c', 'Internal Door', 720, 2040),
  opening('door-720-4', 'w-720-d', 'Internal Door', 720, 2040),
  opening('door-720-5', 'w-720-e', 'Internal Door', 720, 2040),
  opening('door-720-6', 'w-720-f', 'Internal Door', 720, 2040),
  opening('door-720-7', 'w-720-g', 'Internal Door', 720, 2040),
  opening('door-720-90mm', 'w-720-90mm', 'Internal Door', 720, 2040),
  opening('door-1020-1', 'w-1020', 'Internal Door', 1020, 2040),
  opening('door-1020-2', 'w-1020', 'Internal Door', 1020, 2040),
  opening('robe-2400-1', 'w-robe-2400-a', 'Internal Door', 2400, 2040, { subType: 'Robe' }),
  opening('robe-2400-2', 'w-robe-2400-b', 'Internal Door', 2400, 2040, { subType: 'Robe' }),
  opening('robe-2100-1', 'w-robe-2100-a', 'Internal Door', 2100, 2040, { subType: 'Robe' }),
  opening('robe-2100-2', 'w-robe-2100-b', 'Internal Door', 2100, 2040, { subType: 'Robe' }),
];
const reconciliationArgs = { completedWallRuns: reconciliationWalls, placedOpenings: reconciliationOpenings, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor' } };

const reconciledStandard = createInternalDoorSizeSchedule(reconciliationArgs);
assert.deepEqual(Object.fromEntries(reconciledStandard.rows.map((row) => [`${row.widthMm}x${row.heightMm}`, row.quantity])), { '820x2040': 6, '720x2040': 8, '1020x2040': 2 }, 'Standard internal doors reconcile to exactly 720=8, 820=6, 1020=2 - matching the independently-verified real Takeoff reconciliation, derived from the real pipeline, not pasted in');

const reconciledRobe = createRobeSlidingDoorSchedule(reconciliationArgs);
assert.deepEqual(Object.fromEntries(reconciledRobe.rows.map((row) => [`${row.widthMm}x${row.heightMm}`, row.quantity])), { '2400x2040': 2, '2100x2040': 2 }, 'Robe/sliding doors reconcile to exactly 2100=2, 2400=2');

const reconciledCages = createCavitySliderCageSchedule(reconciliationArgs);
assert.deepEqual(reconciledCages.rows, [], 'No cavity sliders exist in this Takeoff - the cage schedule is correctly empty, not fabricated');

const reconciledJamb = createInternalDoorJambTrace(reconciliationArgs);
const reconciledJambTotal = (bucket) => reconciledJamb.filter((row) => row.jambBucket === bucket).reduce((sum, row) => sum + row.contributedLengths, 0);
assert.equal(reconciledJambTotal('jamb90x19StockLengthsEach'), 23, '90x19: 15 standard 70mm-frame passage doors (1 length each) + 4 robe/sliding doors (2 lengths each, 4-sided perimeter) = 23');
assert.equal(reconciledJambTotal('jamb110x19StockLengthsEach'), 1, '110x19: exactly 1 length, from the single genuinely 90mm-framed standard door (door-720-90mm)');

const reconciledTrace = createInternalDoorReconciliationTrace(reconciliationArgs);
assert.equal(reconciledTrace.length, 20, 'Every one of the 20 internal-door-class openings is accounted for in the reconciliation trace - none silently dropped');
assert.equal(reconciledTrace.filter((row) => row.includedInStandardDoorSchedule).length, 16, '16 openings (8+6+2) are included in the standard door schedule');
assert.equal(reconciledTrace.filter((row) => row.category === 'robe_sliding').length, 4, '4 openings are robe/sliding doors, excluded from the standard schedule with a stated reason');
assert.equal(reconciledTrace.filter((row) => row.category === 'cavity_slider').length, 0, 'No openings are cavity sliders in this reconciliation');

// Reclassifying door-720-90mm as a cavity slider (the "D9 is a cavity slider" correction) must be
// enough, on its own, with no other code change, to drop it from every one of: the standard-door
// schedule, the 90x19/110x19 jamb totals, and add it to the cavity-slider-cage schedule instead -
// proving the classification is fully generic and data-driven, never a per-opening special case.
const reconciliationArgsWithD9Cavity = {
  ...reconciliationArgs,
  placedOpenings: reconciliationOpenings.map((item) => (item.id === 'door-720-90mm' ? { ...item, subType: 'Cavity' } : item)),
};
const standardAfterD9Cavity = createInternalDoorSizeSchedule(reconciliationArgsWithD9Cavity);
assert.equal(standardAfterD9Cavity.rows.find((row) => row.widthMm === 720).quantity, 7, 'Reclassifying door-720-90mm as a cavity slider drops the 720mm standard-door count from 8 to 7, with no other code change');
const jambAfterD9Cavity = createInternalDoorJambTrace(reconciliationArgsWithD9Cavity);
const jambTotalAfterD9Cavity = (bucket) => jambAfterD9Cavity.filter((row) => row.jambBucket === bucket).reduce((sum, row) => sum + row.contributedLengths, 0);
assert.equal(jambTotalAfterD9Cavity('jamb110x19StockLengthsEach'), 0, 'With door-720-90mm reclassified as a cavity slider, the 110x19 requirement correctly drops to zero - the cage supplies its jamb, not separate stock');
assert.equal(jambTotalAfterD9Cavity('jamb90x19StockLengthsEach'), 23, '90x19 is completely unaffected by the reclassification - door-720-90mm was never a 90x19 contributor (it was on a 90mm wall, bucketed to 110x19 before removal), so all 23 lengths from the other doors are untouched');
const cagesAfterD9Cavity = createCavitySliderCageSchedule(reconciliationArgsWithD9Cavity);
assert.equal(cagesAfterD9Cavity.rows.find((row) => row.widthMm === 720)?.quantity, 1, 'door-720-90mm now appears in the cavity-slider-cage schedule instead');

const quotedWorkbook = applyJobSetupImport(workbook(), mixed);
quotedWorkbook.quotation = { 'FACE BRICKWORK': { rows: [
  { id: 'face-material', section: 'FACE BRICKWORK', item: 'FACE BRICKS - BASE RANGE', quantityKey: 'quoteFaceBricksBaseRange', autoQuantity: true, unit: '1000', excelRate: '1000', formulas: { B: '999' } },
  { id: 'twin-material', section: 'FACE BRICKWORK', item: 'COMMON TWIN HEIGHTS', quantityKey: 'quoteCommonTwinHeights', autoQuantity: true, unit: '1000', excelRate: '1000' },
  { id: 'single-material', section: 'FACE BRICKWORK', item: 'COMMON SINGLE HEIGHTS', quantityKey: 'quoteCommonSingleHeights', autoQuantity: true, unit: '1000', excelRate: '1000' },
] }, 'PLASTERER - SUPPLY AND INSTALL': { rows: [
  { id: 'plasterboard-material', section: 'PLASTERER - SUPPLY AND INSTALL', item: 'Plasterboard supply', quantityKey: 'totalPlasterboardM2', autoQuantity: true, unit: 'M2', excelRate: '10', supplier: 'Test plaster supplier' },
  { id: 'quote-1280', section: 'PLASTERER - SUPPLY AND INSTALL', item: '90mm COVE CORNICE', quantityKey: 'corniceLm', autoQuantity: true, unit: 'LM', excelRate: '11.22' },
] } };
const quoted = calculateEstimateBuilderWorkbook(quotedWorkbook);
assert.equal(quoted.quotation['FACE BRICKWORK'].rows[0].qty, 2.403, 'Measured brick orders win over stale spreadsheet quantity formulas');
const hookSource = readFileSync('hooks/estimate-builder/useEstimateBuilderWorkbook.js', 'utf8');
// Exercise the real manual-save handler: storage normalization must not mark the
// unchanged editor dirty, and edits made during a save must still remain dirty.
const saveSource = hookSource.slice(hookSource.indexOf('  async function saveDraft('), hookSource.indexOf('  async function restorePreviousJobRevision('));
async function checkManualSave({ editDuringSave = false, verified = true } = {}) {
  const initial = { jobId: 'save-fixture', templateName: 'Earlier template', value: 12 };
  const workbookRef = { current: initial };
  let savedSignature = 'previous signature';
  let status;
  const noop = () => {};
  const dependencies = {
    window: {}, workbookRef, workbook: initial, contentSignature: JSON.stringify(initial), jobContentSignature: JSON.stringify,
    prepareWorkbookForJobSave: (value) => ({ ...value, templateName: 'Master template' }),
    workbookHasExplicitJobIdentity: () => true, estimateBuilderLog: noop,
    workbookJobName: () => 'Save fixture', workbookJobKey: () => 'save-fixture',
    setPersistenceStatus: (value) => { status = value; },
    saveVerifiedStoredJob: async () => {
      if (editDuringSave) workbookRef.current = { ...initial, value: 15 };
      return { ok: verified, jobId: initial.jobId, revision: 2 };
    },
    setSavedContentSignature: (value) => { savedSignature = value; },
    saveLocalDraftMetadata: noop, saveExplicitActiveJobSessionKey: noop,
    rememberRecentJob: noop, rememberRecentEstimateFile: noop, setRecentJobs: noop,
    loadRecentEstimateJobs: noop, setRecentEstimateFiles: noop, loadRecentEstimateFiles: noop,
    setLastSavedAt: noop, lastAutosaveSignatureRef: {}, workbookAutosaveSignature: JSON.stringify,
  };
  const saveDraft = new Function(...Object.keys(dependencies), `${saveSource}; return saveDraft;`)(...Object.values(dependencies));
  await saveDraft();
  if (!verified) {
    assert.equal(savedSignature, 'previous signature', 'Failed verification cannot mark edits saved');
    assert.notEqual(status.state, 'saved');
  } else {
    assert.equal(savedSignature, JSON.stringify(initial), 'Manual save tracks the live snapshot before storage normalization');
    assert.equal(JSON.stringify(workbookRef.current) !== savedSignature, editDuringSave, 'Only subsequent edits remain dirty');
  }
}
await checkManualSave();
await checkManualSave({ editDuringSave: true });
await checkManualSave({ verified: false });
const normalizeSource = hookSource.slice(hookSource.indexOf('function normalizeWorkbook('), hookSource.indexOf('\nfunction normalizeProductLibrary('));
const normalizeWorkbook = new Function('restoreCompleteWorkbook', 'createEstimateBuilderWorkbookDefaults', 'normalizeTakeoffInputSection', 'V4_DATA_SECTIONS', 'workbookHasExplicitJobIdentity', `${normalizeSource}; return normalizeWorkbook;`)(restoreCompleteWorkbook, () => workbook(), normalizeTakeoffInputSection, V4_DATA_SECTIONS, () => false);
const actualRestore = normalizeWorkbook({ data: { inputDataSheet: savedCopies } });
assert.equal(actualRestore.data.inputDataSheet.customRows.length, 1, 'Live complete-workbook hydration removes duplicate canonical copies before row generation');
assert.deepEqual(normalizeWorkbook(JSON.parse(JSON.stringify(actualRestore))), actualRestore, 'Live workbook restoration is idempotent');
const procurementSource = hookSource.slice(hookSource.indexOf('function buildProcurementItemsFromQuote('), hookSource.indexOf('\nfunction numberFromInput', hookSource.indexOf('function buildProcurementItemsFromQuote(')));
const buildProcurement = new Function('orderedQuoteSections', 'quoteFirstDisplayNumber', 'quoteRowSourceNumber', 'shouldIncludeQuoteRowInFinalBoq', 'quoteQuantity', 'quoteRate', 'quoteLineTotal', 'takeoffProcurementDetails', 'assignPlasterboardSupplier', `${procurementSource}; return buildProcurementItemsFromQuote;`)(
  (quotation) => Object.keys(quotation), () => '', () => 0, shouldIncludeQuoteRowInFinalBoq, quoteQuantity, quoteRate, quoteLineTotal, takeoffProcurementDetails, assignPlasterboardSupplier,
);
const procurement = buildProcurement(quotedWorkbook, quoted, []);
assert.deepEqual(procurement.filter((item) => /material$/.test(item.quoteRowId) && /brick|rendered/i.test(item.canonicalQuantityKey)).map((item) => [item.qty, item.unit]), [[2403, 'EACH'], [2574, 'EACH'], [572, 'EACH']]);
const board = procurement.find((item) => item.quoteRowId === 'plasterboard-material');
const cornice = procurement.find((item) => item.quoteRowId === 'quote-1280');
assert.ok(board && cornice);
assert.equal(procurementSupplierKey(cornice), procurementSupplierKey(board), 'Item118 is grouped onto the plasterboard supplier PO');
assert.equal(cornice.qty, quoted.quantities.corniceLm, 'Cornice retains its own quantity');
assert.equal(buildProcurement(quotedWorkbook, quoted, procurement).length, procurement.length, 'Procurement regeneration is idempotent');
const apiSource = readFileSync('pages/api/builders/sync-commercial-snapshot.js', 'utf8');
const snapshotFunctions = apiSource.slice(apiSource.indexOf('function buildBoqItemRows('), apiSource.indexOf('\nasync function insertRows(', apiSource.indexOf('function buildBoqItemRows(')));
const snapshotBuilders = new Function('quotationSectionsForFinalBoq', 'shouldIncludeQuoteRowInFinalBoq', 'takeoffProcurementDetails', 'refreshTakeoffProcurementItems', 'quoteQuantity', 'quoteRate', 'quoteLineTotal', `
  const firstText = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
  const textOrNull = (value) => value || null;
  const decimalNumber = (value) => Number(value) || 0;
  const moneyNumber = decimalNumber;
  const stripLargeFields = (value) => value;
  const boqItemStatus = () => 'active';
  const normaliseStatus = (value, fallback) => value || fallback;
  const dateOrNull = textOrNull;
  ${snapshotFunctions}; return { buildBoqItemRows, buildProcurementRows };
`)(quotationSectionsForFinalBoq, shouldIncludeQuoteRowInFinalBoq, takeoffProcurementDetails, refreshTakeoffProcurementItems, quoteQuantity, quoteRate, quoteLineTotal);
const snapshotBoq = snapshotBuilders.buildBoqItemRows({ calculated: quoted, sectionMap: new Map() }).map((row, index) => ({ ...row, id: `boq-${index}` }));
assert.equal(snapshotBoq.find((row) => row.source_quote_row_id === 'face-material').quantity, 2403, 'Live commercial BOQ stores face bricks as EACH');
assert.equal(snapshotBoq.find((row) => row.source_quote_row_id === 'face-material').unit_rate, 1, 'Per-thousand quote rate converts with the quantity');
const snapshotProcurement = snapshotBuilders.buildProcurementRows({ workbook: quotedWorkbook, calculated: quoted, boqItemMap: new Map(snapshotBoq.map((row) => [row.source_quote_row_id, row.id])) }).map((row, index) => ({ ...row, id: `proc-${index}` }));
assert.equal(snapshotProcurement.find((row) => row.source_quote_row_id === 'face-material').quantity, 2403, 'Sync builds measured procurement even before the legacy Generate button is used');
const purchaseSource = readFileSync('pages/modules/builders/purchase-orders.js', 'utf8');
const purchaseFunctions = purchaseSource.slice(purchaseSource.indexOf('function buildAvailableItems('), purchaseSource.indexOf('\nfunction calculateTotals('));
const availableItems = new Function('firstNumber', `${purchaseFunctions}; return buildAvailableItems;`)((...values) => values.map(Number).find(Number.isFinite) || 0)({ boqItems: snapshotBoq, procurementItems: snapshotProcurement, supplierById: new Map() });
const purchaseCornice = availableItems.find((item) => item.sourceQuoteRowId === 'quote-1280');
const purchaseBoard = availableItems.find((item) => item.sourceQuoteRowId === 'plasterboard-material');
assert.equal(purchaseCornice.supplierName, 'Test plaster supplier');
assert.equal(purchaseCornice.supplierName, purchaseBoard.supplierName, 'The live purchase-order screen groups cornice with plasterboard');
assert.equal(availableItems.find((item) => item.sourceQuoteRowId === 'face-material').quantity, 2403, 'Purchase order input retains the final brick order count');
assert.ok(refreshTakeoffProcurementItems({ quotation: {}, quantities: {} }, procurement).filter((item) => item.canonicalQuantityKey).every((item) => item.removedFromQuote), 'A removed measured quantity cannot remain active in purchasing');

const metres = payloadFor({ completedWallRuns: [wall('metric-wall', 'exterior', 10000, { level: 'Second Level' })], placedOpenings: [{ id: 'metric-opening', page: 1, hostWallId: 'metric-wall', level: 'Second Level', openingClass: 'Window', widthM: 1.5, heightM: 1.2, quantity: 3 }] });
assert.equal(metres.dataInputFields.upperWindowOpeningsAreaM2, 5.4, 'Metre and millimetre dimensions use one area calculation');
assert.equal(metres.schedule.projectTotals.openings.find((row) => row.category === 'Window').floor, 'Second Level', 'Schedule exports honor item-level priority');

const priority = payloadFor({ sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: [wall('explicit', 'interior', 3630, { level: 'Third Level', thicknessMm: '90 mm' }), wall('invalid', 'interior', 1000, { level: 'Invalid' }), wall('unassigned', 'interior', 1000, { page: 3 })] });
assert.equal(priority.dataInputFields.thirdInternal90mmWallsLm, 3.63);
assert.equal(priority.dataInputFields.lowerInternal70mmWallsLm, 1, 'Invalid level falls back to the page mapping (Ground Floor); default interior thickness is 70mm framed');
assert.ok(priority.unsupported.some((item) => item.itemId === 'unassigned'));
const identifiedPayload = (extra) => {
  const payload = payloadFor(extra);
  payload.provenance.takeoffId = 'revision-fixture';
  return payload;
};
const initialWall = wall('moved-wall', 'interior', 3620, { thicknessMm: '90mm' });
const beforeMove = applyJobSetupImport(workbook(), identifiedPayload({ completedWallRuns: [initialWall] }));
const afterMovePayload = identifiedPayload({ completedWallRuns: [{ ...initialWall, level: 'Second Level' }] });
const afterMove = applyJobSetupImport(beforeMove, afterMovePayload);
assert.equal(afterMove.data.inputDataSheet.rows.lowerInternal90mmWallsLm.value, '0', 'Moving the last wall clears its previous imported level subtotal');
// lowerInternalWallsLm is a calculated formula row (lowerInternal70mmWallsLm + lowerInternal90mmWallsLm),
// evaluated by the workbook engine rather than written back into row.value by import.
assert.equal(calculateEstimateBuilderWorkbook(afterMove).quantities.lowerInternalWallsLm, 0, 'Moving the last wall clears its previous imported level subtotal');
assert.equal(afterMove.data.inputDataSheet.rows.upperInternal90mmWallsLm.value, '3.62');
assert.equal(calculateEstimateBuilderWorkbook(afterMove).quantities.lowerInternalWallNetPlasterboardM2, 0, 'The previous level does not retain wall lining');
const manualOldLevel = structuredClone(beforeMove);
manualOldLevel.data.inputDataSheet.rows.lowerInternal90mmWallsLm.value = '5';
assert.equal(applyJobSetupImport(manualOldLevel, afterMovePayload).data.inputDataSheet.rows.lowerInternal90mmWallsLm.value, '5', 'Clearing a moved measurement still protects manual overrides');
const unassignedRevision = identifiedPayload({ sheetLevels: {}, completedWallRuns: [initialWall] });
assert.equal(applyJobSetupImport(beforeMove, unassignedRevision).data.inputDataSheet.rows.lowerInternal90mmWallsLm.value, '3.62', 'An unassigned run is not evidence that the earlier measurement was deleted');
const differentTakeoff = structuredClone(afterMovePayload);
differentTakeoff.provenance.takeoffId = 'another-takeoff';
assert.equal(applyJobSetupImport(beforeMove, differentTakeoff).data.inputDataSheet.rows.lowerInternal90mmWallsLm.value, '3.62', 'Absence in a different takeoff cannot clear the previous source');
const lastDoorWall = wall('last-door-wall', 'interior', 4000);
const beforeDoorRemoval = applyJobSetupImport(workbook(), identifiedPayload({ completedWallRuns: [lastDoorWall], placedOpenings: [opening('last-door', lastDoorWall.id, 'Internal Door', 820, 2040)] }));
const afterDoorRemoval = applyJobSetupImport(beforeDoorRemoval, identifiedPayload({ completedWallRuns: [lastDoorWall], placedOpenings: [] }));
assert.equal(afterDoorRemoval.data.inputDataSheet.rows.jamb90x19StockLengthsEach.value, '0', 'Deleting the last door clears imported jamb stock');
assert.ok(!quotationSectionsForFinalBoq(calculateEstimateBuilderWorkbook(afterDoorRemoval).quotation).some((section) => section.rows.some((row) => row.quantityKey === 'jamb90x19StockLengthsEach')), 'Deleted door stock cannot remain in the final BOQ');
const oldJob = createJobData({ name: 'Old payload', completedWallRuns: [wall('old', 'interior', 3630)], planPages: [], totalPages: 1 });
assert.ok(resolveAiPlanTakeoffJobData(oldJob), 'Old takeoff without optional metadata still loads');

// --- Window Schedule: external windows/doors only, per-level areas, brick sill traceability ---
const wsWallRuns = [
  wall('ws-gf-brick', 'exterior', 8000, { exteriorType: 'Brick Veneer' }),
  wall('ws-gf-internal', 'interior', 4000),
  wall('ws-sl-front-brick', 'exterior', 8000, { page: 2, elevation: 'Front', exteriorType: 'Brick Veneer' }),
  wall('ws-sl-rear-clad', 'exterior', 6000, { page: 2, elevation: 'Rear', exteriorType: 'Lightweight Cladding' }),
];
const wsOpenings = [
  opening('ws-gf-window', 'ws-gf-brick', 'Window', 1200, 1200),
  opening('ws-gf-door', 'ws-gf-brick', 'External Door', 900, 2040, { brickworkBelow: true }),
  opening('ws-gf-internal-door', 'ws-gf-internal', 'Internal Door', 820, 2040),
  opening('ws-sl-front-window', 'ws-sl-front-brick', 'Window', 1500, 1200, { page: 2 }),
  opening('ws-sl-front-door', 'ws-sl-front-brick', 'External Door', 820, 2100, { page: 2, brickworkBelow: true }),
  opening('ws-sl-rear-window', 'ws-sl-rear-clad', 'Window', 1000, 1000, { page: 2 }),
];
const wsSchedule = createJobSetupWindowSchedule({ completedWallRuns: wsWallRuns, placedOpenings: wsOpenings, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' } });
const wsRowIds = wsSchedule.rows.map((row) => row.itemId);
assert.deepEqual(new Set(wsRowIds), new Set(['ws-gf-window', 'ws-gf-door', 'ws-sl-front-window', 'ws-sl-front-door', 'ws-sl-rear-window']), 'External windows and external doors are imported; the internal door is not');
const wsBySymbol = Object.fromEntries(wsSchedule.rows.map((row) => [row.itemId, row]));
assert.equal(wsBySymbol['ws-gf-window'].level, 'Ground Floor', 'Level is retained per row');
assert.equal(wsBySymbol['ws-gf-window'].wallId, 'ws-gf-brick', 'Linked wall id is retained per row');
assert.equal(wsBySymbol['ws-gf-window'].wallSystem, 'Face Brick Veneer', 'Wall system is retained per row');
assert.equal(wsBySymbol['ws-gf-window'].openingAreaM2, 1.44, 'Opening area M2 = width x height x quantity');
assert.equal(wsBySymbol['ws-sl-front-window'].elevation, 'Front', 'Elevation is retained per row');
// Brick sill traceability (Task 8): GF window included, Second front window+door included, GF door and cladding rear window excluded.
assert.equal(wsBySymbol['ws-gf-window'].brickSillApplies, 'Yes');
assert.equal(wsBySymbol['ws-gf-window'].brickSillLm, 1.2);
assert.equal(wsBySymbol['ws-gf-door'].brickSillApplies, 'Yes', 'Every external opening in a brick veneer wall requires a sill except a garage door');
assert.equal(wsBySymbol['ws-gf-door'].brickSillLm, 0.9);
assert.equal(wsBySymbol['ws-sl-front-window'].brickSillApplies, 'Yes');
assert.equal(wsBySymbol['ws-sl-front-window'].brickSillLm, 1.5);
assert.equal(wsBySymbol['ws-sl-front-door'].brickSillApplies, 'Yes', 'Second Level front exterior door with brickwork below gets a sill');
assert.equal(wsBySymbol['ws-sl-front-door'].brickSillLm, 0.82);
assert.equal(wsBySymbol['ws-sl-rear-window'].brickSillApplies, 'No', 'Cladding never gets a brick sill');
assert.equal(wsSchedule.totalBrickSillLm, 4.42, 'Total brick sill LM sums the traceable per-row values');
// Per-level totals (Sections 83/84): windows and doors both count, sourced from the same
// takeoffMaterialFields field Sections 83/84 read, so the two can never disagree.
const wsGround = wsSchedule.levelTotals.find((total) => total.level === 'Ground Floor');
const wsSecond = wsSchedule.levelTotals.find((total) => total.level === 'Second Level');
assert.equal(wsGround.externalOpeningAreaM2, 3.276, 'Ground Level total = window (1.44) + external door (1.836) area (Item83)');
assert.equal(wsGround.windowOpeningAreaM2 + wsGround.externalDoorOpeningAreaM2, wsGround.externalOpeningAreaM2, 'The displayed window/door split adds back up to the Item83 total exactly');
assert.equal(wsSecond.externalOpeningAreaM2, 4.522, 'Second Level total (1.8 + 1.722 + 1) includes the cladding window too (Item84)');
assert.equal(wsSecond.windowOpeningAreaM2 + wsSecond.externalDoorOpeningAreaM2, wsSecond.externalOpeningAreaM2, 'The displayed window/door split adds back up to the Item84 total exactly');
const wsWorkbook = applyJobSetupImport(workbook(), payloadFor({ completedWallRuns: wsWallRuns, placedOpenings: wsOpenings, sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' } }));
const wsQuantities = calculateEstimateBuilderWorkbook(wsWorkbook).quantities;
assert.equal(wsQuantities.lowerWindowDoorDeductionsM2, wsGround.externalOpeningAreaM2, 'Section 83 (Ground Level window openings) matches the Window Schedule total exactly');
assert.equal(wsQuantities.upperWindowDoorDeductionsM2, wsSecond.externalOpeningAreaM2, 'Section 84 (Second level window openings) matches the Window Schedule total exactly');

console.log('PASS takeoff material flow: idempotency, Patio, levels, framing, openings, mixed brick systems, sills, jambs, old payloads and the Window Schedule');
