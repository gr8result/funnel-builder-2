import assert from 'node:assert/strict';
import {
  EXTERIOR_WALL_CLASSES, resolveExteriorClass, createExteriorClassificationTotals, runLengthM,
} from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { EXTERIOR_WALL_SYSTEM_FIELD_KEYS } from '../lib/construction-estimation/takeoffMaterialQuantities.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';

// Classification is a real construction property, so the five buckets must partition the measured
// exterior length exactly: every millimetre lands in one bucket and no millimetre lands in two.
// If that ever stops holding, brick, render, cladding and sill quantities silently disagree with
// the wall lengths they were derived from.

const CLASSES = ['Face Brick Veneer', 'Rendered Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'];
assert.deepEqual(EXTERIOR_WALL_CLASSES, CLASSES, 'Five distinct construction classes, in reporting order');

// 1. Legacy values map forward, and rendered masonry is never promoted to rendered brick veneer.
const LEGACY_MAPPING = [
  ['Brick Veneer', 'Face Brick Veneer'],
  ['Lightweight Cladding', 'Lightweight Cladding'],
  ['Rendered Masonry', 'Rendered Masonry'],
  ['Other', 'Other'],
  ['', 'Other'],
  [undefined, 'Other'],
];
for (const [saved, expected] of LEGACY_MAPPING) {
  for (const field of ['exteriorType', 'exteriorClass', 'exteriorClassification', 'wallSystem']) {
    assert.equal(resolveExteriorClass({ [field]: saved }), expected, `Saved ${field}=${JSON.stringify(saved)} maps to ${expected}`);
  }
}
assert.notEqual(resolveExteriorClass({ exteriorType: 'Rendered Masonry' }), 'Rendered Brick Veneer', 'Rendered masonry must never be auto-converted to rendered brick veneer');

// 2. Rendered Brick Veneer is its own class, not a rename of either neighbour.
assert.equal(resolveExteriorClass({ exteriorType: 'Rendered Brick Veneer' }), 'Rendered Brick Veneer');
assert.notEqual(resolveExteriorClass({ exteriorType: 'Rendered Brick Veneer' }), resolveExteriorClass({ exteriorType: 'Rendered Masonry' }));
assert.notEqual(resolveExteriorClass({ exteriorType: 'Rendered Brick Veneer' }), resolveExteriorClass({ exteriorType: 'Brick Veneer' }));
// Being exterior, or thick, never implies a construction.
assert.equal(resolveExteriorClass({ category: 'exterior', thicknessMm: 230 }), 'Other');

const pixelsPerMm = 0.1;
const sheetLevels = { 3: 'Second Level' };
const wall = (id, lengthMm, exteriorType, extra = {}) => ({
  id, page: 3, category: 'exterior', lengthMm, thicknessMm: 230,
  nodes: [{ x: 0, y: 0 }, { x: lengthMm * pixelsPerMm, y: 0 }],
  exteriorType, alignment: 'outer', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: 2.4, ...extra,
});
const completedWallRuns = [
  wall('legacy-brick', 12000, 'Brick Veneer'),
  wall('face', 8000, 'Face Brick Veneer'),
  wall('rendered-brick', 9000, 'Rendered Brick Veneer'),
  wall('cladding', 10000, 'Lightweight Cladding'),
  wall('masonry', 6000, 'Rendered Masonry'),
  wall('unclassified', 4680, 'Other'),
  wall('interior', 9000, '', { category: 'interior', thicknessMm: 90 }),
];
const geometryBefore = structuredClone(completedWallRuns);
const exteriorRuns = completedWallRuns.filter((run) => run.category === 'exterior');
const exteriorTotalM = exteriorRuns.reduce((sum, run) => sum + runLengthM(run, pixelsPerMm), 0);
assert.equal(exteriorTotalM, 49.68, 'Fixture exterior length');

// 3. The five totals reconcile exactly to the exterior wall total, overall and per level.
const totals = createExteriorClassificationTotals(completedWallRuns, pixelsPerMm, sheetLevels);
assert.deepEqual(Object.keys(totals.all), CLASSES, 'Every class is reported, including the empty ones');
const expected = { 'Face Brick Veneer': 20, 'Rendered Brick Veneer': 9, 'Lightweight Cladding': 10, 'Rendered Masonry': 6, Other: 4.68 };
assert.deepEqual(totals.all, expected);
const sumOf = (bucket) => CLASSES.reduce((sum, name) => sum + bucket[name], 0);
assert.equal(sumOf(totals.all), exteriorTotalM, 'Face + Rendered Brick + Lightweight + Rendered Masonry + Other === total exterior length');
assert.deepEqual(Object.keys(totals.byFloor), ['Second Level'], 'Sheet 3 resolves to its assigned level');
assert.equal(sumOf(totals.byFloor['Second Level']), exteriorTotalM, 'Per level totals reconcile too');
assert.equal(
  Object.values(totals.byFloor).reduce((sum, bucket) => sum + sumOf(bucket), 0),
  sumOf(totals.all),
  'Level buckets partition the overall totals',
);

// 4. One source of truth for level resolution: the sidebar totals and the schedule agree.
const input = { currentPage: 3, totalPages: 3, pixelsPerMm, sheetLevels, completedWallRuns };
const schedule = createTakeoffSchedule(input);
for (const scope of [schedule.currentSheet, schedule.projectTotals]) {
  const exteriorRecords = scope.wallRecords.filter((record) => record.wallType === 'External walls');
  assert.ok(exteriorRecords.every((record) => record.level === 'Second Level'), 'Schedule labels Sheet 3 as Second Level');
  const perClass = Object.fromEntries(CLASSES.map((name) => [name, 0]));
  for (const record of exteriorRecords) perClass[record.exteriorClassification] += record.lengthM;
  assert.deepEqual(perClass, expected, 'Schedule records agree with the classification totals');
  assert.equal(exteriorRecords.reduce((sum, record) => sum + record.lengthM, 0), exteriorTotalM);
  assert.ok(scope.exteriorWalls.every((row) => row.floor === 'Second Level'), 'No scope may relabel the sheet');
}

// Every class with measured length must have a real Job Setup destination, or its quantities
// vanish on import with no way to tell an absent field from a zero.
const editable = new Set(INPUT_DATA_SHEET_TEMPLATE.rows.filter((row) => row.editable && !row.calculated && !row.heading).map((row) => row.key));
const payload = createJobSetupPayload(schedule, { sheetLevels });
for (const [key, category] of Object.entries(EXTERIOR_WALL_SYSTEM_FIELD_KEYS)) {
  if (category === 'Other') continue;
  assert.ok(editable.has(`upper${key}ExternalWallsLm`), `Job Setup has an upper${key}ExternalWallsLm input`);
  assert.equal(payload.dataInputFields[`upper${key}ExternalWallsLm`], expected[category], `${category} imports against its own field`);
}
// upperExternalWallsLm is a DERIVED sheet total (calculated: true, formula "upperExternal70mmWallsLm
// + upperExternal90mmWallsLm") - the imported hidden per-frame rows are the single authoritative
// source of measured length, per the "one physical wall = one imported measurement" rule, so the
// raw import payload never carries a value for it directly. Core-filled Blockwork and Double Brick
// are masonry, not timber-framed, so they never contribute to a 70mm/90mm frame bucket; the true
// reconciliation is against the full set of canonical LEVEL x CONSTRUCTION SYSTEM rows (Phase 2B).
const importedByCanonicalSystem = ['BrickVeneer70mmWallsLm', 'BrickVeneer90mmWallsLm', 'LightweightCladding70mmWallsLm', 'LightweightCladding90mmWallsLm', 'CoreFilledBlockworkLm', 'DoubleBrickLm', 'CustomExternalLm', 'UnclassifiedExternalLm']
  .reduce((sum, key) => sum + Number(payload.dataInputFields[`upper${key}`] || 0), 0);
assert.equal(importedByCanonicalSystem, exteriorTotalM, 'The exterior wall total is unchanged by classification');
assert.equal(
  Object.keys(EXTERIOR_WALL_SYSTEM_FIELD_KEYS).filter((key) => EXTERIOR_WALL_SYSTEM_FIELD_KEYS[key] !== 'Other')
    .reduce((sum, key) => sum + payload.dataInputFields[`upper${key}ExternalWallsLm`], 0)
  + payload.dataInputFields.totalUnclassifiedExteriorWallsLm,
  importedByCanonicalSystem,
  'Imported classification fields reconcile to the imported exterior wall total',
);

// 5. Classification changed nothing about the measured geometry.
assert.deepEqual(completedWallRuns, geometryBefore, 'Classification leaves every wall geometry, length, thickness and page untouched');
assert.deepEqual(
  schedule.currentSheet.wallRecords.map((record) => [record.itemId, record.lengthM, record.thicknessMm, record.planSheet]),
  [['legacy-brick', 12], ['face', 8], ['rendered-brick', 9], ['cladding', 10], ['masonry', 6], ['unclassified', 4.68], ['interior', 9]]
    .map(([id, length]) => [id, length, id === 'interior' ? 90 : 230, 3]),
  'Measured lengths, thicknesses and sheet assignments are unchanged',
);

console.log('Exterior classification reconciliation passed:');
console.log(`  legacy mapping        ${LEGACY_MAPPING.map(([from, to]) => `${from || '(blank)'} -> ${to}`).join('; ')}`);
console.log(`  totals                ${CLASSES.map((name) => `${name} ${expected[name]}`).join(' + ')} = ${sumOf(totals.all)} m`);
console.log(`  exterior wall total   ${exteriorTotalM} m (reconciles exactly)`);
console.log('  Sheet 3 labelled Second Level in sidebar totals, currentSheet and projectTotals');
