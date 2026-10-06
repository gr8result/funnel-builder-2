import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXTERIOR_WALL_CLASSES, resolveExteriorClass } from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

// The construction an exterior wall is drawn as is chosen before the first point and stamped onto
// the run when it is finalised. These checks execute the real finaliser and the real schedule, so
// the stored field and the schedule bucket cannot drift apart from what the panel offers.

const jsx = readFileSync(new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url), 'utf8');

// Pull the actual finaliser out of the component rather than restating its body here.
const start = jsx.indexOf('  const finalizeCurrentWallRun = useCallback(');
assert.ok(start > 0, 'Locate the actual wall finaliser');
const end = jsx.indexOf('  const finalizeCurrentEaveRun', start);
assert.ok(end > start, 'Locate the end of the wall finaliser');
const body = jsx.slice(start, end);

// The panel must offer exactly the schedule's construction classes, before drawing.
const selector = jsx.slice(jsx.indexOf("{wallCategory === 'exterior' && ("), jsx.indexOf('Wall Alignment:'));
assert.match(selector, /Exterior Wall Type:/, 'The drawing controls expose a pre-draw wall type');
assert.match(selector, /EXTERIOR_WALL_CLASS_OPTIONS\.map/, 'The selector offers the schedule construction classes');
assert.match(selector, /setExteriorWallType\(event\.target\.value\)/, 'Choosing a type records it for subsequent walls');
assert.deepEqual(
  EXTERIOR_WALL_CLASSES,
  ['Face Brick Veneer', 'Rendered Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'],
  'Pre-draw options are the five construction classes',
);
// The selector must only exist for exterior walls.
assert.ok(jsx.indexOf("{wallCategory === 'exterior' && (") < jsx.indexOf('Exterior Wall Type:'), 'Interior walls hide the exterior construction selector');

function makeFinalizer({ wallCategory, exteriorWallType, thicknessMm = 230 }) {
  const completed = [];
  const env = {
    useCallback: (fn) => fn,
    activePolyline: [{ x: 0, y: 0 }, { x: 5000, y: 0 }],
    pixelsPerMm: 1,
    currentPage: 3,
    wallCategory,
    exteriorWallType,
    detectedWallThicknessMm: thicknessMm,
    alignment: 'outer',
    getWallRunLengthMm: (nodes) => Math.abs(nodes[1].x - nodes[0].x),
    snapToStandardThickness: (mm) => mm,
    markTakeoffItemCompleted: () => {},
    setActivePolyline: () => {},
    setSelectedWallId: () => {},
    selectOnly: () => {},
    setCompletedWallRuns: (updater) => { completed.push(...updater([])); },
  };
  const run = new Function(...Object.keys(env), `${body}\nreturn finalizeCurrentWallRun;`)(...Object.values(env));
  run();
  assert.equal(completed.length, 1, 'The finaliser created exactly one wall run');
  return completed[0];
}

// 1. Choose Rendered Brick Veneer before drawing, finalise, and the run stores it.
const renderedBrick = makeFinalizer({ wallCategory: 'exterior', exteriorWallType: 'Rendered Brick Veneer' });
assert.equal(renderedBrick.exteriorType, 'Rendered Brick Veneer', 'The chosen construction is written onto the wall at creation');
assert.equal(resolveExteriorClass(renderedBrick), 'Rendered Brick Veneer', 'It resolves through the same field the schedule reads');
assert.equal(renderedBrick.category, 'exterior');
assert.equal(renderedBrick.lengthMm, 5000, 'Length is unchanged by classification');
assert.equal(renderedBrick.thicknessMm, 230, 'Thickness is unchanged by classification');
assert.deepEqual(renderedBrick.nodes, [{ x: 0, y: 0 }, { x: 5000, y: 0 }], 'Geometry is unchanged by classification');
assert.equal(renderedBrick.alignment, 'outer', 'Alignment is unchanged by classification');
assert.equal(renderedBrick.page, 3, 'Sheet assignment is unchanged by classification');

// 2. The schedule puts that length under Rendered Brick Veneer, not Other.
const schedule = createTakeoffSchedule({
  currentPage: 3, totalPages: 3, pixelsPerMm: 1,
  sheetLevels: { 3: 'Second Level' },
  completedWallRuns: [renderedBrick],
});
const record = schedule.currentSheet.wallRecords[0];
assert.equal(record.exteriorClassification, 'Rendered Brick Veneer', 'The schedule reads the stored construction');
assert.equal(record.lengthM, 5, 'The measured length reaches the schedule unchanged');
const subtotals = Object.fromEntries(schedule.currentSheet.exteriorWalls
  .filter((row) => row.itemId.startsWith('ext_total_'))
  .map((row) => [row.category, row.quantity]));
assert.deepEqual(subtotals, { 'Rendered Brick Veneer': 5 }, 'The length sits under Rendered Brick Veneer');
assert.equal(
  createJobSetupPayload(schedule, { sheetLevels: { 3: 'Second Level' } }).dataInputFields.upperRenderedBrickVeneerExternalWallsLm,
  5,
  'Job Setup receives it against the rendered brick veneer input',
);

// 3. The next exterior wall inherits the same choice without reselecting it.
const inherited = makeFinalizer({ wallCategory: 'exterior', exteriorWallType: 'Rendered Brick Veneer' });
assert.equal(inherited.exteriorType, 'Rendered Brick Veneer', 'A subsequent exterior wall inherits the active choice');

// 4. Changing the selector affects only walls created afterwards.
const afterChange = makeFinalizer({ wallCategory: 'exterior', exteriorWallType: 'Lightweight Cladding' });
assert.equal(afterChange.exteriorType, 'Lightweight Cladding', 'A new choice applies to the next wall');
assert.equal(renderedBrick.exteriorType, 'Rendered Brick Veneer', 'Walls drawn earlier are untouched by the new choice');
assert.equal(inherited.exteriorType, 'Rendered Brick Veneer', 'Walls drawn earlier are untouched by the new choice');
const mixed = createTakeoffSchedule({
  currentPage: 3, totalPages: 3, pixelsPerMm: 1,
  sheetLevels: { 3: 'Second Level' },
  completedWallRuns: [renderedBrick, inherited, afterChange],
});
assert.deepEqual(
  Object.fromEntries(mixed.currentSheet.exteriorWalls.filter((row) => row.itemId.startsWith('ext_total_')).map((row) => [row.category, row.quantity])),
  { 'Rendered Brick Veneer': 10, 'Lightweight Cladding': 5 },
  'Each wall keeps the construction it was drawn with',
);

// 5. An interior wall never receives an exterior construction, even while a type is selected.
const interior = makeFinalizer({ wallCategory: 'interior', exteriorWallType: 'Rendered Brick Veneer', thicknessMm: 90 });
assert.equal(interior.exteriorType, '', 'Interior walls carry no exterior construction');
assert.equal(interior.category, 'interior');
const interiorSchedule = createTakeoffSchedule({
  currentPage: 3, totalPages: 3, pixelsPerMm: 1,
  sheetLevels: { 3: 'Second Level' },
  completedWallRuns: [interior],
});
assert.equal(interiorSchedule.currentSheet.wallRecords[0].exteriorClassification, '', 'An interior wall has no classification in the schedule');
assert.equal(interiorSchedule.currentSheet.exteriorWalls.length, 0, 'An interior wall never appears in the exterior schedule');

// 6. The after-the-fact editor still exists, so a wall can still be corrected - now offering the
// canonical construction system (Phase 2A) rather than only the legacy five-class selector.
assert.match(jsx, /Construction system/, 'The selected-wall construction-system label is preserved');
assert.match(jsx, /EXTERIOR_CONSTRUCTION_SYSTEMS\.map/, 'The selected-wall editor offers the canonical exterior systems');
assert.match(jsx, /constructionSystem: nextSystem/, 'Choosing a system on the selected wall still writes through updateWallRun');

console.log('Pre-draw exterior wall type checks passed:');
console.log('  chosen before drawing   Rendered Brick Veneer -> stored on the run as exteriorType');
console.log(`  schedule bucket         Rendered Brick Veneer ${subtotals['Rendered Brick Veneer']} m (not Other)`);
console.log('  inheritance             next exterior wall reuses the choice; earlier walls unchanged');
console.log('  interior walls          exteriorType "" and absent from the exterior schedule');
console.log('  geometry                nodes, length 5000mm, thickness 230mm, alignment and sheet all unchanged');
