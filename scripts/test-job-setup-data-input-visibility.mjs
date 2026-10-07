// Regression coverage for the live failure: ~100 Takeoff Mapping rows (Items ~129-222) were still
// rendering in Job Setup/Data Input despite an existing section-based hide rule. Root cause: the
// row objects DataInputSheet actually receives have already been through templateRow()
// (estimateWorksheetV4Schema.js), which renames the template's own `section` field to
// `sectionLabel` - the hide rule checked `row.section`, which is always undefined on the real
// rendered rows, so it silently matched nothing. An earlier verification of this exact rule used a
// hand-written reimplementation of the filter instead of the shipped code, which is exactly why
// this went undetected - so this test imports the real isRelevantForDataInput/
// HIDDEN_DATA_INPUT_ROW_KEYS via the hook's own __dataInputVisibilityTestUtils export (the same
// pattern __quotationPersistenceTestUtils already establishes in this file for the same reason).
//
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-job-setup-data-input-visibility.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { V4_DATA_SECTIONS } from '../lib/construction-estimation/estimateWorksheetV4Schema.js';
import { createTakeoffSchedule, createJobSetupPayload, createInternalDoorSizeSchedule, createRobeSlidingDoorSchedule, createCavitySliderCageSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { applyJobSetupImport } from '../lib/construction-estimation/jobSetupTakeoffImport.js';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { __dataInputVisibilityTestUtils } = await import('../hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const { isRelevantForDataInput, HIDDEN_DATA_INPUT_ROW_KEYS } = __dataInputVisibilityTestUtils;
assert.ok(HIDDEN_DATA_INPUT_ROW_KEYS instanceof Set && HIDDEN_DATA_INPUT_ROW_KEYS.size > 0, 'The real hidden-row list is exported, not a stand-in');

const inputSection = V4_DATA_SECTIONS.find((section) => section.key === 'inputDataSheet');
assert.ok(inputSection, 'inputDataSheet section exists in V4_DATA_SECTIONS');

// Every row here has already been through templateRow() - `section` is gone, `sectionLabel` is
// what a real rendered row carries. This is exactly what broke the old filter, and exactly what
// this fixture must reproduce for the test to mean anything.
assert.ok(inputSection.rows.every((row) => row.section === undefined), 'Row objects post-templateRow() have no `section` field (this is exactly what broke the old filter)');
const mappingRowsInTemplate = inputSection.rows.filter((row) => row.sectionLabel === 'Takeoff Mappings');
assert.ok(mappingRowsInTemplate.length > 50, `Sanity check: the template really does carry a large Takeoff Mappings block internally (found ${mappingRowsInTemplate.length}) - it must stay; only its visibility is being tested`);

function levelForDataRow(row) {
  const key = String(row.key || '');
  const text = `${row.sectionLabel || ''} ${row.label || ''}`.toLowerCase();
  if (key.startsWith('third') || text.includes('third level')) return 3;
  if (key.startsWith('upper') || key.startsWith('second') || text.includes('second level')) return 2;
  return 1;
}
function visibleRowsFor(levels) {
  // isRelevantForDataInput's own internal isRelevantForFloorCount check reads floorCount straight
  // off the workbook (defaulting to Single storey when unset) - this must be the real value for
  // the storey count under test, or every Second/Third Level row is excluded before this
  // function's own level<=levels filter ever runs, making 2-storey and 3-storey indistinguishable.
  const floorCount = levels === 3 ? 'Three storey' : levels === 2 ? 'Two storey' : 'Single storey';
  const workbook = { data: { inputDataSheet: { rows: { floorCount: { value: floorCount } } } } };
  return inputSection.rows
    .filter((row) => isRelevantForDataInput(row, workbook))
    .filter((row) => levelForDataRow(row) <= levels);
}

for (const [label, levels] of [['2-storey', 2], ['3-storey', 3]]) {
  const visible = visibleRowsFor(levels);
  const visibleMappingRows = visible.filter((row) => row.sectionLabel === 'Takeoff Mappings');
  assert.equal(visibleMappingRows.length, 0, `${label}: Takeoff Mapping rows must be completely absent from the final visible collection (found ${visibleMappingRows.length}: ${visibleMappingRows.slice(0, 5).map((r) => r.key).join(', ')})`);
  assert.equal(new Set(visible.map((row) => row.key)).size, visible.length, `${label}: no duplicate row keys in the visible collection`);
  assert.ok(visible.length > 100, `${label}: plenty of legitimate rows remain visible (${visible.length}) - this is a filter fix, not a mass deletion`);
  // internalDoors deliberately passes isRelevantForDataInput (it is not in
  // HIDDEN_DATA_INPUT_ROW_KEYS) - removing it from the final page happens one step later, in
  // EstimateBuilderWorkbook.js's withInternalDoorSizeRows, which replaces this exact row with the
  // size-specific standard-door and robe/sliding-door rows (tested below). Hiding it here instead
  // would delete it before that replace step's own findIndex could locate it, silently skipping the
  // splice entirely - the regression this file now also guards against.
  assert.ok(visible.some((row) => row.key === 'internalDoors'), `${label}: internalDoors must still reach this layer intact - it is removed later, by being replaced, not hidden here`);
}

const visible2 = visibleRowsFor(2);
const visible3 = visibleRowsFor(3);
assert.ok(visible3.length > visible2.length, 'A three-storey project legitimately shows more visible rows than a two-storey one (real Third Level rows), not the same count');
assert.ok(visible2.every((row) => levelForDataRow(row) <= 2), '2-storey: no Third Level row leaks into the visible collection');

// 110x19 jamb stock (jamb110x19StockLengthsEach) must disappear from the visible page when the
// Takeoff-derived calculated requirement is zero (this project's actual reconciliation once every
// contributing opening is correctly classified), and reappear automatically for a project that
// genuinely has a non-zero requirement - a generic, calculation-driven rule, not a per-project
// special case or a hidden-key list entry.
const jambRow = inputSection.rows.find((row) => row.key === 'jamb110x19StockLengthsEach');
assert.ok(jambRow, 'jamb110x19StockLengthsEach exists in the template');
const workbookWithZeroJamb = { data: { inputDataSheet: { rows: { floorCount: { value: 'Two storey' }, jamb110x19StockLengthsEach: { value: '0' } } } } };
const workbookWithNoJambValue = { data: { inputDataSheet: { rows: { floorCount: { value: 'Two storey' } } } } };
const workbookWithRealJamb = { data: { inputDataSheet: { rows: { floorCount: { value: 'Two storey' }, jamb110x19StockLengthsEach: { value: '2' } } } } };
assert.equal(isRelevantForDataInput(jambRow, workbookWithZeroJamb), false, 'A calculated 110x19 requirement of exactly zero must not render');
assert.equal(isRelevantForDataInput(jambRow, workbookWithNoJambValue), false, 'No saved value at all (never applied from a Takeoff) is treated the same as zero, not shown');
assert.equal(isRelevantForDataInput(jambRow, workbookWithRealJamb), true, 'A genuine non-zero 110x19 requirement (a different project with real 90mm-framed doors) still renders normally');
const jamb90Row = inputSection.rows.find((row) => row.key === 'jamb90x19StockLengthsEach');
assert.equal(isRelevantForDataInput(jamb90Row, workbookWithZeroJamb), true, '90x19 is never subject to this zero-hiding rule - only 110x19 was reported as unnecessary for this project');

// The sequential Item number (dataInputRowNumber) and the cavity-slider-size row injection
// (withCavitySliderSizeRows/cavitySliderSizeRow) live in EstimateBuilderWorkbook.js, which is JSX
// and genuinely cannot be imported even with the loaders above - verbatim source extraction (the
// technique scripts/test-job-setup-takeoff-import-empty-attached-recovery.mjs already uses for
// this same file) scoped to these three plain-JS functions, none of which contain JSX.
const workbookSource = readFileSync(new URL('../components/estimate-builder/EstimateBuilderWorkbook.js', import.meta.url), 'utf8');
function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} must exist in EstimateBuilderWorkbook.js`);
  const braceStart = source.indexOf('{', start);
  let depth = 0, end = braceStart;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return source.slice(start, end);
}
const dataInputRowNumberSrc = extractFunction(workbookSource, 'function dataInputRowNumber(row, rowIndex = 0)');
const { dataInputRowNumber } = new Function(`${dataInputRowNumberSrc}\nreturn { dataInputRowNumber };`)();
assert.equal(dataInputRowNumber({ sourceRow: 74.109 }, 0), 1, 'Display number ignores sourceRow entirely - always sequential position + 1');
assert.equal(dataInputRowNumber({ sourceRow: 119.684 }, 128), 129, 'Same rule regardless of what decimal sourceRow a row happens to carry internally');

const cavitySliderSizeRowSrc = extractFunction(workbookSource, 'function cavitySliderSizeRow(size, index)');
const withCavitySliderSizeRowsSrc = extractFunction(workbookSource, 'function withCavitySliderSizeRows(sections, sizeRows)');
const { cavitySliderSizeRow, withCavitySliderSizeRows } = new Function(`${cavitySliderSizeRowSrc}\n${withCavitySliderSizeRowsSrc}\nreturn { cavitySliderSizeRow, withCavitySliderSizeRows };`)();

const fixtureSections = [{ key: 'inputDataSheet', rows: [{ key: 'jamb110x19StockLengthsEach' }, { key: 'totalCavitySliderCagesEach' }, { key: 'heading_openings_deductions', heading: true }] }];
const sizeRows = [{ widthMm: 720, heightMm: 2040, hostFrameThicknessMm: 90, quantity: 1 }, { widthMm: 820, heightMm: 2040, hostFrameThicknessMm: 90, quantity: 1 }, { widthMm: 1020, heightMm: 2040, hostFrameThicknessMm: 90, quantity: 2 }];
const withSizes = withCavitySliderSizeRows(fixtureSections, sizeRows);
const resultRows = withSizes[0].rows;
assert.deepEqual(resultRows.map((row) => row.key.startsWith('cavitySliderSize_') ? row.label : row.key), [
  'jamb110x19StockLengthsEach',
  'totalCavitySliderCagesEach',
  '90mm Cavity Slider Cage — 720mm',
  '90mm Cavity Slider Cage — 820mm',
  '90mm Cavity Slider Cage — 1020mm',
  'heading_openings_deductions',
], 'Cavity slider size rows are spliced in as real array members, immediately after the total, ahead of the next heading');
resultRows.forEach((row, index) => {
  const number = dataInputRowNumber(row, index);
  assert.equal(number, index + 1, `Row ${row.key || row.label} gets an ordinary sequential number (${number}), not a special or missing one`);
});
assert.equal(resultRows[2].staticValue, 1, '720mm cage quantity carried on the row itself');
assert.equal(resultRows[4].staticValue, 2, '1020mm cage quantity carried on the row itself');

// Zero cavity sliders in the current (live-computed) Takeoff data: totalCavitySliderCagesEach must
// be REMOVED entirely, not left showing whatever its own persisted value happens to be. This is the
// exact reproduction of the reported bug: a persisted totalCavitySliderCagesEach of "4" (stale, from
// an earlier Takeoff state) must not survive once the live breakdown is empty - removal is driven by
// sizeRows.length (always fresh), never by the row's own possibly-stale value.
const withNoCavitySliders = withCavitySliderSizeRows(fixtureSections, []);
const noCavityResultRows = withNoCavitySliders[0].rows;
assert.deepEqual(noCavityResultRows.map((row) => row.key), ['jamb110x19StockLengthsEach', 'heading_openings_deductions'], 'With zero cavity sliders in the live Takeoff, totalCavitySliderCagesEach is removed entirely - no stale aggregate, no zero row, no leftover breakdown rows');

// Item 125's replacement: the standard-door and robe/sliding-door size breakdowns
// (internalDoorSizeRow/robeSlidingDoorSizeRow/withInternalDoorSizeRows) follow the same
// real-array-member splicing pattern as the cavity slider cages above, but REPLACE internalDoors in
// place (splice(index, 1, ...)) rather than inserting after it, precisely so the row never survives
// into the visible output under any circumstances - this is the fix for the regression where the
// row was hidden upstream first, findIndex then found nothing, and the whole splice silently no-op'd.
const internalDoorSizeRowSrc = extractFunction(workbookSource, 'function internalDoorSizeRow(size, index)');
const robeSlidingDoorSizeRowSrc = extractFunction(workbookSource, 'function robeSlidingDoorSizeRow(size, index)');
const withInternalDoorSizeRowsSrc = extractFunction(workbookSource, 'function withInternalDoorSizeRows(sections, sizeRows, robeSizeRows = [])');
const { internalDoorSizeRow, robeSlidingDoorSizeRow, withInternalDoorSizeRows } = new Function(`${internalDoorSizeRowSrc}\n${robeSlidingDoorSizeRowSrc}\n${withInternalDoorSizeRowsSrc}\nreturn { internalDoorSizeRow, robeSlidingDoorSizeRow, withInternalDoorSizeRows };`)();

const doorFixtureSections = [{ key: 'inputDataSheet', rows: [{ key: 'internalDoors' }, { key: 'jamb110x19StockLengthsEach' }, { key: 'heading_openings_deductions', heading: true }] }];
const doorSizeRows = [{ widthMm: 720, heightMm: 2040, quantity: 8 }, { widthMm: 820, heightMm: 2040, quantity: 6 }];
const robeSizeRows = [{ widthMm: 2100, heightMm: 2040, quantity: 2 }, { widthMm: 2400, heightMm: 2040, quantity: 2 }];
const withDoorSizes = withInternalDoorSizeRows(doorFixtureSections, doorSizeRows, robeSizeRows);
const doorResultRows = withDoorSizes[0].rows;
assert.ok(!doorResultRows.some((row) => row.key === 'internalDoors'), 'The old combined "Internal doors" row is completely gone from the result - replaced, not merely hidden alongside it');
assert.deepEqual(doorResultRows.map((row) => (row.key.startsWith('internalDoorSize_') || row.key.startsWith('robeSlidingDoorSize_')) ? row.label : row.key), [
  '720mm Internal Door',
  '820mm Internal Door',
  '2100mm Robe / Sliding Door',
  '2400mm Robe / Sliding Door',
  'jamb110x19StockLengthsEach',
  'heading_openings_deductions',
], 'Standard-door rows, then robe/sliding-door rows, take the exact place of the old combined total - same position, never mixed with each other');
doorResultRows.forEach((row, index) => {
  const number = dataInputRowNumber(row, index);
  assert.equal(number, index + 1, `Row ${row.key || row.label} gets an ordinary sequential number (${number})`);
});
assert.equal(doorResultRows[0].staticValue, 8, '720mm standard internal door quantity carried on the row itself');
assert.equal(doorResultRows[1].staticValue, 6, '820mm standard internal door quantity carried on the row itself');
assert.equal(doorResultRows[2].staticValue, 2, '2100mm robe/sliding door quantity carried on the row itself');
assert.equal(doorResultRows[3].staticValue, 2, '2400mm robe/sliding door quantity carried on the row itself');

// No Takeoff to derive sizes from at all (sizeRows and robeSizeRows both empty) - internalDoors is
// still replaced, with nothing: Item 125 must never reappear as a fallback aggregate.
const emptyDoorSections = [{ key: 'inputDataSheet', rows: [{ key: 'internalDoors' }, { key: 'jamb110x19StockLengthsEach' }] }];
const emptyResult = withInternalDoorSizeRows(emptyDoorSections, [], [])[0].rows;
assert.deepEqual(emptyResult.map((row) => row.key), ['jamb110x19StockLengthsEach'], 'With no Takeoff-derived sizes at all, internalDoors is removed and nothing takes its place - no fallback aggregate');

// FINAL RENDERED-ROW VERIFICATION - end to end, against the real, full inputDataSheet row array
// (not a small hand-built fixture): isRelevantForDataInput filtering (real Takeoff Mapping hiding,
// real floor-count gating, real zero-jamb hiding) THEN the real splice (withCavitySliderSizeRows /
// withInternalDoorSizeRows) THEN the real sequential numbering (dataInputRowNumber) - the exact
// sequence DataInputSheet itself runs. Two scenarios, both derived from the hard reconciliation
// above, not pasted-in numbers: (A) door-720-90mm as a genuine standard door (jamb110x19 = 1,
// non-zero, so its row must render) and (B) door-720-90mm reclassified as a cavity slider
// (jamb110x19 = 0, so its row must be completely absent) - proving the final page is correct either
// way the classification data actually comes out, not hard-coded to one specific outcome.
function finalRenderedRows({ standardSizeRows, robeSizeRows, cavitySizeRows, jamb110Value }) {
  const workbookForRender = { data: { inputDataSheet: { rows: { floorCount: { value: 'Two storey' }, jamb110x19StockLengthsEach: { value: jamb110Value } } } } };
  const filtered = inputSection.rows.filter((row) => isRelevantForDataInput(row, workbookForRender));
  const withCavity = withCavitySliderSizeRows([{ key: 'inputDataSheet', rows: filtered }], cavitySizeRows);
  const withDoors = withInternalDoorSizeRows(withCavity, standardSizeRows, robeSizeRows);
  return withDoors[0].rows;
}

const scenarioA = finalRenderedRows({
  standardSizeRows: [{ widthMm: 720, heightMm: 2040, hostFrameThicknessMm: null, quantity: 8 }, { widthMm: 820, heightMm: 2040, hostFrameThicknessMm: null, quantity: 6 }, { widthMm: 1020, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }],
  robeSizeRows: [{ widthMm: 2100, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }, { widthMm: 2400, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }],
  cavitySizeRows: [],
  jamb110Value: '1',
});
assert.ok(!scenarioA.some((row) => row.key === 'internalDoors'), 'Scenario A: Internal Doors aggregate is absent from the final rendered rows');
assert.ok(scenarioA.some((row) => row.label === '720mm Internal Door' && row.staticValue === 8), 'Scenario A: 720mm Internal Door = 8 is present in the final rendered rows');
assert.ok(scenarioA.some((row) => row.label === '820mm Internal Door' && row.staticValue === 6), 'Scenario A: 820mm Internal Door = 6 is present in the final rendered rows');
assert.ok(scenarioA.some((row) => row.label === '1020mm Internal Door' && row.staticValue === 2), 'Scenario A: 1020mm Internal Door = 2 is present in the final rendered rows (this is the size that must never go missing)');
assert.ok(scenarioA.some((row) => row.label === '2100mm Robe / Sliding Door' && row.staticValue === 2), 'Scenario A: 2100mm Robe / Sliding Door = 2 is present');
assert.ok(scenarioA.some((row) => row.label === '2400mm Robe / Sliding Door' && row.staticValue === 2), 'Scenario A: 2400mm Robe / Sliding Door = 2 is present');
assert.ok(scenarioA.some((row) => row.key === 'jamb110x19StockLengthsEach'), 'Scenario A: with a genuine non-zero 110x19 requirement (1), the row is present, not hidden');
assert.ok(!scenarioA.some((row) => row.key === 'totalCavitySliderCagesEach'), 'Scenario A: zero cavity sliders in the live Takeoff means the 90mm Cavity Slider Cages aggregate is completely absent, regardless of any stale persisted value it might otherwise carry (none was even given here)');
const numbersA = scenarioA.map((row, index) => dataInputRowNumber(row, index));
assert.deepEqual(numbersA, numbersA.map((_, index) => index + 1), 'Scenario A: every rendered row gets a sequential Item number - no gaps, no duplicates, no decimals');

const scenarioB = finalRenderedRows({
  standardSizeRows: [{ widthMm: 720, heightMm: 2040, hostFrameThicknessMm: null, quantity: 7 }, { widthMm: 820, heightMm: 2040, hostFrameThicknessMm: null, quantity: 6 }, { widthMm: 1020, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }],
  robeSizeRows: [{ widthMm: 2100, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }, { widthMm: 2400, heightMm: 2040, hostFrameThicknessMm: null, quantity: 2 }],
  cavitySizeRows: [{ widthMm: 720, heightMm: 2040, hostFrameThicknessMm: 90, quantity: 1 }],
  jamb110Value: '0',
});
assert.ok(!scenarioB.some((row) => row.key === 'internalDoors'), 'Scenario B: Internal Doors aggregate is absent');
assert.ok(!scenarioB.some((row) => row.key === 'jamb110x19StockLengthsEach'), 'Scenario B: with door-720-90mm reclassified as a cavity slider, the calculated 110x19 requirement is 0, and the row is completely absent from the final rendered page - not present with a 0 or blank value');
assert.ok(scenarioB.some((row) => row.label === '720mm Internal Door' && row.staticValue === 7), 'Scenario B: the standard 720mm count correctly reflects the reclassification (7, not 8)');
assert.ok(scenarioB.some((row) => row.label === '90mm Cavity Slider Cage — 720mm' && row.staticValue === 1), 'Scenario B: door-720-90mm appears instead in the cavity-slider-cage schedule');
assert.ok(scenarioB.some((row) => row.key === 'totalCavitySliderCagesEach'), 'Scenario B: with a genuine cavity slider present, the 90mm Cavity Slider Cages aggregate row remains, with its breakdown underneath it');
const numbersB = scenarioB.map((row, index) => dataInputRowNumber(row, index));
assert.deepEqual(numbersB, numbersB.map((_, index) => index + 1), 'Scenario B: every rendered row gets a sequential Item number - no gaps, no duplicates, no decimals');

console.log('PASS Job Setup Data Input visibility: 0 Takeoff Mapping rows visible (2-storey and 3-storey), no duplicates, the old combined Internal doors total is replaced (never a fallback aggregate), the 110x19 jamb row hides itself when the calculated requirement is zero, cavity slider / standard door / robe-sliding-door size rows are real array members with ordinary sequential Item numbers, display numbering never reads sourceRow, and the full final rendered-row array reconciles correctly in both classification scenarios.');

// =============================================================================================
// REPRODUCTION TEST: starts from the EXACT stale Job Setup state reported live (jamb110x19 = "3",
// totalCavitySliderCagesEach = "4" with per-size breakdown 720=1/820=1/1020=2, no import history for
// either - indistinguishable from a hand-typed leftover), runs the real Apply Takeoff path
// (applyJobSetupImport) against a current canonical Takeoff, then runs the real visibility/splice
// pipeline (isRelevantForDataInput -> withCavitySliderSizeRows -> withInternalDoorSizeRows) on the
// result, and asserts the FINAL rendered row array - not the intermediate schedule object - matches
// the required reconciliation. The current-Takeoff fixture is built from wall/opening records (not
// pasted-in totals): 8x 720mm, 6x 820mm, 2x 1020mm standard hinged doors (all on 70mm-framed walls -
// no opening in this fixture sits on a 90mm wall at all, which is one concrete Takeoff shape that
// correctly reconciles to zero 110x19 requirement and zero cavity sliders simultaneously, exactly
// the combination required for this job), plus 2x 2100mm + 2x 2400mm robe/sliding doors.
// =============================================================================================
const wallFixture = (id, category, lengthMm, extra = {}) => ({ id, page: 1, category, lengthMm, thicknessMm: category === 'interior' ? '70 mm' : 90, wallHeightM: 2.4, exteriorType: 'Brick Veneer', linedFaces: 2, ...extra });
const openingFixture = (id, hostWallId, openingClass, widthMm, heightMm, extra = {}) => ({ id, page: 1, hostWallId, openingClass, widthMm, heightMm, ...extra });

const currentWalls = [
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((suffix) => wallFixture(`w720-${suffix}`, 'interior', 3000)),
  ...['a', 'b', 'c', 'd', 'e', 'f'].map((suffix) => wallFixture(`w820-${suffix}`, 'interior', 3000)),
  wallFixture('w1020-a', 'interior', 3000), wallFixture('w1020-b', 'interior', 3000),
  wallFixture('wrobe2100-a', 'interior', 3000), wallFixture('wrobe2100-b', 'interior', 3000),
  wallFixture('wrobe2400-a', 'interior', 3000), wallFixture('wrobe2400-b', 'interior', 3000),
];
const currentOpenings = [
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((suffix) => openingFixture(`door720-${suffix}`, `w720-${suffix}`, 'Internal Door', 720, 2040)),
  ...['a', 'b', 'c', 'd', 'e', 'f'].map((suffix) => openingFixture(`door820-${suffix}`, `w820-${suffix}`, 'Internal Door', 820, 2040)),
  openingFixture('door1020-a', 'w1020-a', 'Internal Door', 1020, 2040),
  openingFixture('door1020-b', 'w1020-b', 'Internal Door', 1020, 2040),
  openingFixture('robe2100-a', 'wrobe2100-a', 'Internal Door', 2100, 2040, { subType: 'Robe' }),
  openingFixture('robe2100-b', 'wrobe2100-b', 'Internal Door', 2100, 2040, { subType: 'Robe' }),
  openingFixture('robe2400-a', 'wrobe2400-a', 'Internal Door', 2400, 2040, { subType: 'Robe' }),
  openingFixture('robe2400-b', 'wrobe2400-b', 'Internal Door', 2400, 2040, { subType: 'Robe' }),
];
const currentTakeoffArgs = { totalPages: 1, pixelsPerMm: 1, sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: currentWalls, placedOpenings: currentOpenings };
const currentPayload = createJobSetupPayload(createTakeoffSchedule(currentTakeoffArgs));
assert.equal(currentPayload.dataInputFields.jamb110x19StockLengthsEach, 0, 'Sanity check on the fixture itself: the current canonical Takeoff computes a 110x19 requirement of exactly 0');
assert.equal(currentPayload.dataInputFields.totalCavitySliderCagesEach ?? 0, 0, 'Sanity check: the current canonical Takeoff has zero cavity sliders');

function staleWorkbook(overrides = {}) {
  const rows = Object.fromEntries(V4_DATA_SECTIONS.find((section) => section.key === 'inputDataSheet').rows.map((row) => [row.key, { value: '' }]));
  for (const [key, value] of Object.entries({ floorCount: 'Single storey', lowerCeilingHeight: 2400, ...overrides })) rows[key] = { value };
  return { data: { inputDataSheet: { rows, customRows: [], hiddenRows: [] } }, formulas: {}, windowsDoors: [], quotation: {} };
}
// The exact reported stale state: jamb110x19 = 3 and totalCavitySliderCagesEach = 4, both with no
// import history at all (own.history check fails for both) - previously indistinguishable from a
// deliberate hand-edit and therefore protected from a plain reapply; now exempted via
// ALWAYS_TRUST_TAKEOFF_KEYS in jobSetupTakeoffImport.js.
const startingState = staleWorkbook({ jamb110x19StockLengthsEach: '3', totalCavitySliderCagesEach: '4' });
assert.equal(startingState.data.inputDataSheet.rows.jamb110x19StockLengthsEach.value, '3', 'Starting state reproduces the exact reported stale jamb110x19 = 3');
assert.equal(startingState.data.inputDataSheet.rows.totalCavitySliderCagesEach.value, '4', 'Starting state reproduces the exact reported stale totalCavitySliderCagesEach = 4');

// THE ACTUAL APPLY TAKEOFF PATH - a plain default call, no explicit selectedKeys, exactly what the
// live "Apply Takeoff" button runs.
const afterApply = applyJobSetupImport(startingState, currentPayload);
assert.equal(afterApply.data.inputDataSheet.rows.jamb110x19StockLengthsEach.value, '0', 'Apply Takeoff overwrites the stale 3 with the correct 0 - it does not survive');
assert.equal(afterApply.data.inputDataSheet.rows.totalCavitySliderCagesEach.value, '0', 'Apply Takeoff overwrites the stale 4 with the correct 0 - it does not survive');

// THE ACTUAL FINAL RENDERED ROW ARRAY - live schedule computation (never persisted, always current)
// + real visibility filtering (isRelevantForDataInput, now reading afterApply's corrected jamb value)
// + real splicing (withCavitySliderSizeRows, withInternalDoorSizeRows) - the exact sequence
// DataInputSheet runs, starting from the post-Apply workbook, not a fresh one.
const standardSchedule = createInternalDoorSizeSchedule(currentTakeoffArgs);
const robeSchedule = createRobeSlidingDoorSchedule(currentTakeoffArgs);
const cageSchedule = createCavitySliderCageSchedule(currentTakeoffArgs);
const finalFiltered = inputSection.rows.filter((row) => isRelevantForDataInput(row, afterApply));
const finalWithCavity = withCavitySliderSizeRows([{ key: 'inputDataSheet', rows: finalFiltered }], cageSchedule.rows.map((row) => ({ widthMm: row.widthMm, heightMm: row.heightMm, hostFrameThicknessMm: row.hostFrameThicknessMm, quantity: row.quantity })));
const finalRows = withInternalDoorSizeRows(
  finalWithCavity,
  standardSchedule.rows.map((row) => ({ widthMm: row.widthMm, heightMm: row.heightMm, hostFrameThicknessMm: row.hostFrameThicknessMm, quantity: row.quantity })),
  robeSchedule.rows.map((row) => ({ widthMm: row.widthMm, heightMm: row.heightMm, hostFrameThicknessMm: row.hostFrameThicknessMm, quantity: row.quantity })),
)[0].rows;

const report = ['720mm Internal Door', '820mm Internal Door', '1020mm Internal Door', '2100mm Robe / Sliding Door', '2400mm Robe / Sliding Door'].map((label) => {
  const row = finalRows.find((r) => r.label === label);
  return [label, row ? row.staticValue : 'ABSENT'];
});
report.push(['110 x 19 jamb', finalRows.some((r) => r.key === 'jamb110x19StockLengthsEach') ? afterApply.data.inputDataSheet.rows.jamb110x19StockLengthsEach.value : 'ABSENT']);
report.push(['90mm Cavity Slider Cages (total)', finalRows.some((r) => r.key === 'totalCavitySliderCagesEach') ? afterApply.data.inputDataSheet.rows.totalCavitySliderCagesEach.value : 'ABSENT']);
for (const size of [720, 820, 1020]) report.push([`${size}mm Cavity Slider Cage`, finalRows.some((r) => r.label === `90mm Cavity Slider Cage — ${size}mm`) ? 'present' : 'ABSENT']);
console.log('\nFINAL REPROJECTED JOB SETUP ROWS (after stale-state Apply Takeoff):');
console.table(report.map(([label, value]) => ({ label, value })));

assert.equal(finalRows.find((r) => r.label === '720mm Internal Door')?.staticValue, 8, 'FINAL: 720mm Internal Door = 8');
assert.equal(finalRows.find((r) => r.label === '820mm Internal Door')?.staticValue, 6, 'FINAL: 820mm Internal Door = 6');
assert.equal(finalRows.find((r) => r.label === '1020mm Internal Door')?.staticValue, 2, 'FINAL: 1020mm Internal Door = 2 - the size that was reported missing is present');
assert.equal(finalRows.find((r) => r.label === '2100mm Robe / Sliding Door')?.staticValue, 2, 'FINAL: 2100mm Robe / Sliding Door = 2');
assert.equal(finalRows.find((r) => r.label === '2400mm Robe / Sliding Door')?.staticValue, 2, 'FINAL: 2400mm Robe / Sliding Door = 2');
assert.ok(!finalRows.some((r) => r.key === 'jamb110x19StockLengthsEach'), 'FINAL: 110x19 jamb row is completely ABSENT - not 0, not hidden-but-present, not 3');
assert.ok(!finalRows.some((r) => r.key === 'totalCavitySliderCagesEach'), 'FINAL: 90mm Cavity Slider Cages aggregate row is completely ABSENT');
assert.ok(!finalRows.some((r) => String(r.label || '').startsWith('90mm Cavity Slider Cage —')), 'FINAL: no 720/820/1020mm Cavity Slider Cage breakdown rows survive');
assert.ok(!finalRows.some((r) => r.key === 'internalDoors'), 'FINAL: the old combined Internal Doors aggregate is absent');
const finalNumbers = finalRows.map((row, index) => dataInputRowNumber(row, index));
assert.deepEqual(finalNumbers, finalNumbers.map((_, index) => index + 1), 'FINAL: every rendered row still gets a sequential Item number - no gaps, no duplicates');

console.log('PASS stale-state reproduction: starting from the exact reported stale values (jamb110x19=3, totalCavitySliderCagesEach=4/1/1/2), a plain Apply Takeoff against the current canonical Takeoff produces the correct final rendered rows (720=8, 820=6, 1020=2, robe 2100=2, robe 2400=2, no 110x19 row, no cavity cage rows, no Internal Doors aggregate).');
