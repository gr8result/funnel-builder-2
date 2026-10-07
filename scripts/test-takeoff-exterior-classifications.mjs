import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXTERIOR_WALL_CLASSES, resolveExteriorClass, createExteriorClassificationTotals,
} from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { createJobData, createPortableTakeoffExport, resolvePortableTakeoffImport } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// This first assertion reproduces the old production classification failure.
assert.equal(resolveExteriorClass({ exteriorType: 'Brick Veneer' }), 'Face Brick Veneer', 'Legacy Brick Veneer must resolve to Face Brick Veneer');
const classes = ['Face Brick Veneer', 'Rendered Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'];
assert.deepEqual(EXTERIOR_WALL_CLASSES, classes, 'Expose the five distinct construction classes');
for (const value of classes) assert.equal(resolveExteriorClass({ exteriorType: value }), value);
assert.equal(resolveExteriorClass({ exteriorType: 'Rendered Brick Veneer' }), 'Rendered Brick Veneer', 'Rendered brick veneer must remain distinct from rendered masonry');
assert.equal(resolveExteriorClass({ exteriorType: 'Other', exteriorClass: 'Brick Veneer' }), 'Other', 'An explicit Other selection overrides a stale alias');
assert.equal(resolveExteriorClass({ category: 'exterior', thicknessMm: 230 }), 'Other', 'Exterior category and wall thickness do not determine construction');

const jsx = readFileSync(new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url), 'utf8');
function sourceFunction(name) {
  const match = jsx.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `Find the actual ${name} implementation`);
  return match[0];
}
const restoreWall = new Function('resolveExteriorClass', `${sourceFunction('getDefaultWallThickness')}\n${sourceFunction('normaliseRecoveredWallRun')}\nreturn normaliseRecoveredWallRun;`)(resolveExteriorClass);
const sidebarStart = jsx.indexOf('  const exteriorWallClassificationTotals =');
const sidebarEnd = jsx.indexOf('  const baseScale =', sidebarStart);
assert.ok(sidebarStart > 0 && sidebarEnd > sidebarStart);
const sidebar = (completedWallRuns, pixelsPerMm, sheetLevels) => new Function(
  'useMemo', 'createExteriorClassificationTotals', 'completedWallRuns', 'pixelsPerMm', 'sheetLevels',
  `${jsx.slice(sidebarStart, sidebarEnd)}\nreturn exteriorWallClassificationTotals;`,
)((compute) => compute(), createExteriorClassificationTotals, completedWallRuns, pixelsPerMm, sheetLevels);

const pixelsPerMm = 0.1;
const sheetLevels = { 3: 'Second Level' };
const wall = (id, lengthMm, exteriorType, extra = {}) => ({
  id, page: 3, category: 'exterior', lengthMm, thicknessMm: 70,
  nodes: [{ x: 25, y: 30 }, { x: 25 + lengthMm * pixelsPerMm, y: 30 }],
  exteriorType, alignment: 'outer', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null, ...extra,
});
function protectedWall(run) {
  return Object.fromEntries(['id', 'page', 'level', 'nodes', 'lengthMm', 'thicknessMm', 'category', 'alignment', 'linedFaces', 'openingDeductionsEnabled', 'wallHeightM'].map(key => [key, run[key]]));
}
for (const field of ['exteriorType', 'exteriorClass', 'exteriorClassification', 'wallSystem']) {
  const source = wall(`legacy-${field}`, 48680, undefined, { [field]: 'Brick Veneer', level: 'Second Level' });
  const untouched = structuredClone(source);
  const restored = restoreWall(source);
  assert.equal(restored.exteriorType, 'Face Brick Veneer', `Legacy ${field} survives restoration as Face Brick Veneer`);
  assert.deepEqual(protectedWall(restored), protectedWall(source), 'Classification normalization preserves every measured wall field');
  assert.deepEqual(source, untouched, 'Restoration must not mutate the saved source record');
  const totals = sidebar([restored], pixelsPerMm, sheetLevels);
  assert.equal(totals.all['Face Brick Veneer'], 48.68);
  assert.equal(totals.all.Other, 0);
  assert.equal(totals.byFloor['Second Level']['Face Brick Veneer'], 48.68);
}

const completedWallRuns = [
  wall('legacy-face', 12000, 'Brick Veneer', { level: 'Second Level' }),
  wall('new-face', 8000, 'Face Brick Veneer', { thicknessMm: 230 }),
  wall('rendered-brick', 8000, 'Rendered Brick Veneer'),
  wall('lightweight', 10000, 'Lightweight Cladding'),
  wall('rendered-masonry', 6000, 'Rendered Masonry'),
  wall('unclassified', 4680, 'Other'),
  wall('interior-excluded', 9000, '', { category: 'interior', thicknessMm: 90 }),
];
const input = {
  currentPage: 3, totalPages: 3, rotation: 270, pixelsPerMm, sheetLevels, completedWallRuns,
  planPages: [{ pageNumber: 3, dataUrl: 'data:image/png;base64,synthetic-classification-plan', width: 1000, height: 800, logicalWidth: 1000, logicalHeight: 800, renderScale: 1, vectorSegments: [] }],
  completedEaves: [{ id: 'unchanged-eave', page: 3, nodes: [{ x: 10, y: 20 }, { x: 310, y: 20 }], lengthMm: 3000, widthOption: '600', widthMm: 600, level: 'Second Level', alignment: 'outer' }],
  completedAreas: [{ id: 'unchanged-area', page: 3, category: 'Tiles', nodes: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }], exclusions: [] }],
  completedFloorplans: [{ id: 'unchanged-floor', page: 3, type: 'Footprint', nodes: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }] }],
  completedMeasurements: [{ id: 'unchanged-measure', page: 3, p1: { x: 5, y: 5 }, p2: { x: 205, y: 5 }, offset: { x: 0, y: 0 } }],
  placedOpenings: [{ id: 'unchanged-opening', page: 3, type: 'window', openingClass: 'Window', x: 45, y: 30, widthMm: 1200, heightMm: 1800 }],
};
const originalInput = structuredClone(input);
const expectedTotals = { 'Face Brick Veneer': 20, 'Rendered Brick Veneer': 8, 'Lightweight Cladding': 10, 'Rendered Masonry': 6, Other: 4.68 };
const totals = sidebar(completedWallRuns, pixelsPerMm, sheetLevels);
assert.deepEqual(totals.all, expectedTotals);
assert.deepEqual(totals.byFloor, { 'Second Level': expectedTotals }, 'The sidebar resolves Sheet 3 consistently as Second Level');
assert.equal(Object.values(totals.all).reduce((sum, value) => sum + value, 0), 48.68, 'Every exterior millimetre belongs to exactly one classification bucket');

const schedule = createTakeoffSchedule(input);
for (const scope of [schedule.currentSheet, schedule.projectTotals]) {
  const exteriorRecords = scope.wallRecords.filter(record => record.wallType === 'External walls');
  assert.equal(exteriorRecords.length, 6);
  assert.ok(exteriorRecords.every(record => record.level === 'Second Level'));
  assert.equal(exteriorRecords.reduce((sum, record) => sum + record.lengthM, 0), 48.68);
  const perClass = Object.fromEntries(classes.map(name => [name, 0]));
  for (const record of exteriorRecords) perClass[record.exteriorClassification] += record.lengthM;
  assert.deepEqual(perClass, expectedTotals, 'Schedule records agree with the sidebar classification totals');
  const subtotalRows = scope.exteriorWalls.filter(row => row.itemId.startsWith('ext_total_'));
  assert.equal(subtotalRows.length, 5, 'The schedule has one subtotal for each populated class');
  assert.deepEqual(Object.fromEntries(subtotalRows.map(row => [row.category, row.quantity])), expectedTotals);
  assert.ok(subtotalRows.every(row => row.floor === 'Second Level'));
}
// upperExternalWallsLm is a derived sheet total; the imported canonical per-system rows are the
// authoritative measured lengths (Phase 2B).
const upperFields = createJobSetupPayload(schedule).dataInputFields;
const upperImportedByCanonicalSystem = ['BrickVeneer70mmWallsLm', 'BrickVeneer90mmWallsLm', 'LightweightCladding70mmWallsLm', 'LightweightCladding90mmWallsLm', 'CoreFilledBlockworkLm', 'DoubleBrickLm', 'CustomExternalLm', 'UnclassifiedExternalLm']
  .reduce((sum, key) => sum + Number(upperFields[`upper${key}`] || 0), 0);
assert.equal(upperImportedByCanonicalSystem, 48.68, 'Job Setup receives the unchanged exterior wall total');
assert.deepEqual(input, originalInput, 'Classification and schedule generation preserve all input geometry, measurements, calibration and assignments');

// Export/reopen must preserve selected classes and every other persisted field.
const saved = createJobData({ ...input, name: 'Exterior classification regression', takeoffId: 'classification-regression', revision: 4 });
const untouchedSaved = structuredClone(saved);
const imported = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(createPortableTakeoffExport(saved))));
assert.equal(imported.ok, true);
assert.deepEqual(saved, untouchedSaved, 'Portable export does not mutate the current takeoff');
const reopened = { ...imported.job, completedWallRuns: imported.job.completedWallRuns.map(restoreWall) };
assert.deepEqual(reopened.completedWallRuns.map(protectedWall), saved.completedWallRuns.map(protectedWall));
for (const key of ['pixelsPerMm', 'currentPage', 'rotation', 'sheetLevels', 'plan', 'completedEaves', 'completedAreas', 'completedFloorplans', 'completedMeasurements', 'placedOpenings']) {
  assert.deepEqual(reopened[key], saved[key], `Classification restore leaves ${key} unchanged`);
}
assert.equal(reopened.completedWallRuns.find(run => run.id === 'rendered-brick').exteriorType, 'Rendered Brick Veneer');
assert.equal(reopened.completedWallRuns.find(run => run.id === 'rendered-masonry').exteriorType, 'Rendered Masonry');
assert.deepEqual(sidebar(reopened.completedWallRuns, reopened.pixelsPerMm, reopened.sheetLevels), totals);
assert.deepEqual(input, originalInput, 'The complete save/reopen workflow leaves the original takeoff input unchanged');

console.log('Takeoff exterior classification checks passed: legacy Brick Veneer -> Face Brick Veneer; Rendered Brick Veneer remains distinct; five buckets reconcile to 48.68 m; Sheet 3 sidebar/schedules agree; save/reopen preserves all geometry, measurements and other takeoff state.');
