// Regression coverage for the runtime crash reported on /modules/estimate-builder?page=dataInput:
//
//   Runtime TypeError: Cannot read properties of undefined (reading 'sheetLevels')
//   components/estimate-builder/JobSetupTakeoffImport.jsx ~38:87 @ useSource
//
// Root cause: `previous?.provenance?.takeoffId === job.takeoffId ? previous.sheetLevels || {} : {}`
// guards the CONDITION with optional chaining but not the TRUE BRANCH, and the condition itself
// can be true by both sides being undefined (undefined === undefined) rather than by a genuine
// match - so a job whose takeoff has never been saved with an id, opened before any previous Job
// Setup sync exists, hit `previous.sheetLevels` on an undefined `previous`.
//
// Extracts the real fix (previousSheetLevelsIfSameTakeoff) verbatim from the component source, so
// this tests the actual shipped code rather than a paraphrase of its intent.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const source = readFileSync('components/estimate-builder/JobSetupTakeoffImport.jsx', 'utf8');
const start = source.indexOf('const previousSheetLevelsIfSameTakeoff');
assert.ok(start >= 0, 'previousSheetLevelsIfSameTakeoff must exist in JobSetupTakeoffImport.jsx');
const end = source.indexOf(';', start) + 1;
const previousSheetLevelsIfSameTakeoff = new Function(`${source.slice(start, end)}\nreturn previousSheetLevelsIfSameTakeoff;`)();

function assertSafe(label, previous, takeoffId, expected) {
  let result;
  assert.doesNotThrow(() => { result = previousSheetLevelsIfSameTakeoff(previous, takeoffId); }, `${label} must not throw`);
  assert.deepEqual(result, expected, label);
}

// 1. No previous payload at all (previous === undefined) - a job's first ever Job Setup import,
//    or a workbook older than lastJobSetupSync itself.
assertSafe('No previous payload at all', undefined, 'takeoff-1', {});

// 2. Previous payload exists but records no takeoff (its own provenance is absent) - an older
//    lastJobSetupSync shape, or one written before provenance existed.
assertSafe('Previous payload without takeoff info', { sheetLevels: { 1: 'Ground Floor' } }, 'takeoff-1', {});

// 3. The exact reported crash: no previous payload AND no takeoff id on the job/request being
//    opened (a takeoff never saved with an id). Two absent values must never read as "the same
//    takeoff".
assertSafe('The exact reported crash (both undefined)', undefined, undefined, {});
assertSafe('Previous exists, this takeoff has no id', { provenance: { takeoffId: 'takeoff-1' }, sheetLevels: { 1: 'Second Level' } }, undefined, {});

// 4. Legacy payload: previous exists, has a takeoffId, but no sheetLevels of its own (an even
//    older shape) - must load with an empty map, not throw.
assertSafe('Legacy previous payload with no sheetLevels', { provenance: { takeoffId: 'takeoff-1' } }, 'takeoff-1', {});

// 5. Current payload with sheetLevels: a genuinely matching takeoff id must retain the previously
//    saved sheet-to-level assignments.
assertSafe('Matching takeoff retains its saved sheetLevels', { provenance: { takeoffId: 'takeoff-1' }, sheetLevels: { 1: 'Second Level', 2: 'Third Level' } }, 'takeoff-1', { 1: 'Second Level', 2: 'Third Level' });

// A different takeoff id must never inherit another takeoff's sheet assignments.
assertSafe('Different takeoff id does not inherit sheetLevels', { provenance: { takeoffId: 'takeoff-1' }, sheetLevels: { 1: 'Second Level' } }, 'takeoff-2', {});

// The job's own sheetLevels always win over an inherited previous value - verified against the
// full useSource merge expression, not just the helper in isolation.
const merged = { ...previousSheetLevelsIfSameTakeoff({ provenance: { takeoffId: 'takeoff-1' }, sheetLevels: { 1: 'Ground Floor' } }, 'takeoff-1'), ...({ 1: 'Second Level' } || {}) };
assert.deepEqual(merged, { 1: 'Second Level' }, "This job's own sheetLevels take priority over an inherited previous value");

// 6. End-to-end: sheetLevels resolved safely by the fixed helper still correctly resolves a wall
// with no explicit level to Second Level via the sheet fallback, and keeps it out of every other
// level/thickness bucket - the exact case the crash was introduced while trying to preserve.
const sheetLevels = previousSheetLevelsIfSameTakeoff(undefined, undefined); // the crash path: must be {} and safe to use
const schedule = createTakeoffSchedule({
  totalPages: 2,
  pixelsPerMm: 1,
  sheetLevels: { ...sheetLevels, 2: 'Second Level' }, // the sheet's own current assignment still applies on top
  completedWallRuns: [{ id: 'crash-fixture-wall', page: 2, category: 'interior', lengthMm: 3620, thicknessMm: '90mm' }],
  placedOpenings: [{ id: 'crash-fixture-door', page: 2, hostWallId: 'crash-fixture-wall', openingClass: 'Internal Door', widthMm: 820, heightMm: 2040, subType: 'cavity sliding door' }],
});
const payload = createJobSetupPayload(schedule);
assert.equal(payload.dataInputFields.upperInternal90mmWallsLm, 3.62, 'Second Level 90mm wall length is still resolved after the crash fix');
assert.equal(payload.dataInputFields.upperInternal70mmWallsLm, 0, 'Excluded from the Second Level 70mm subtotal');
assert.equal(payload.dataInputFields.lowerInternal90mmWallsLm, undefined, 'Never appears as Ground Level 90mm');
assert.equal(payload.dataInputFields.upperInternalWallsLm, 3.62, 'Still contributes to total Second Level internal wall LM');
assert.equal(payload.dataInputFields.upperCavitySlider90mmStudsEach, 9, 'The cavity-slider stud count (9) still comes through');

console.log('PASS JobSetupTakeoffImport sheetLevels safety: no-previous, no-takeoff-id, legacy, matching, mismatched and the Second Level 90mm wall all handled without crashing.');
