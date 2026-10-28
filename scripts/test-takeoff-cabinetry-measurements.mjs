// Calibrated takeoff measurements -> benchtop / MDF bulkhead quantities. Synthetic geometry only.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-cabinetry-measurements.mjs
import assert from 'node:assert/strict';
import { FINAL_CABINETRY as source, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { normaliseCabinetrySelection, buildCabinetrySelectionPayload } from '../lib/builders/cabinetryWorkflow.js';
import { applyCabinetryRequirementsToQuotation as apply, CABINETRY_ACTION_REQUIRED } from '../lib/construction-estimation/cabinetryRequirements.js';
import { tagCabinetryMeasurement, cabinetryMeasurementIssues, cabinetryRequirementsFromTakeoff, cabinetryMeasurementsFromDetections, measurementLengthMm, MEASUREMENT_REVIEW } from '../lib/construction-estimation/takeoffCabinetryMeasurements.js';

const owner = source.workspaceId;
const results = {};
const check = (name, run) => { try { run(); results[name] = 'PASS'; console.log(`PASS ${name}`); } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, String(error.message).slice(0, 1500)); } };
const base = reconcileCabinetryQuotation({ ...createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner }), workspaceId: owner }, owner);
const rows = book => book.quotation.CABINETRY.rows;
const find = (book, room, range, item) => { const hits = rows(book).filter(row => row.room === room && row.range === range && (item instanceof RegExp ? item.test(row.item) : row.item === item)); assert.equal(hits.length, 1, `${room}/${range}/${item}`); return hits[0]; };
const stone = rangeKey => ({ supplier: 'Caesarstone', colourName: 'Cloudburst', rangeKey });
const bookOf = selection => ({ rooms: [{ id: 'guided-cabinetry', name: 'Cabinetry', rows: [{ id: 'cabinetry', guidedSelection: {
  ...buildCabinetrySelectionPayload({ workspaceId: owner, projectId: 'p1', selection, requirement: { requirementKey: 'cabinetry', label: 'Cabinetry', areaKey: 'cabinetry' } }).selected_details, requirementKey: 'cabinetry' } }] }] });
const room = (name, more = {}) => ({ location: name, name, ...more });
// 0.1 px per mm: 100 px = 1000 mm.
const PX = 0.1;
const run = (id, x1, y1, x2, y2, page = 1) => ({ id, page, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, offset: { x: 0, y: 0 } });
const takeoffOf = (measurements, extra = {}) => ({ pixelsPerMm: PX, completedMeasurements: measurements, ...extra });
const job = (locations, takeoff, schedule = []) => apply({ ...base, aiPlanTakeoffJob: takeoff, clientSelectionsBook: bookOf(normaliseCabinetrySelection({ locations, schedule })) }, owner);
const approve = (measurement, tag, takeoff) => tagCabinetryMeasurement(tagCabinetryMeasurement(measurement, { source: 'manual', ...tag }, takeoff), { status: MEASUREMENT_REVIEW.APPROVED }, takeoff);

check('1 LENGTH IS DERIVED FROM GEOMETRY AND CALIBRATION, NEVER TYPED', () => {
  assert.equal(measurementLengthMm(run('a', 0, 0, 480, 0), PX), 4800);
  assert.equal(measurementLengthMm(run('a', 0, 0, 480, 0), 0), 0, 'uncalibrated gives no length');
  const spoofed = { ...run('a', 0, 0, 100, 0), lengthMm: 9999, cabinetry: { kind: 'benchtop', room: 'Kitchen', depthMm: 600, status: 'APPROVED' } };
  assert.equal(measurementLengthMm(spoofed, PX), 1000);
});

check('2 BENCHTOPS: KITCHEN, ISLAND, LAUNDRY AND VANITIES LAND ON THEIR OWN RANGE ROWS', () => {
  const t = takeoffOf([]);
  const tags = [
    approve(run('k1', 0, 0, 300, 0), { kind: 'benchtop', room: 'Kitchen', areaId: 'benchtop-main', label: 'Main benchtop', depthMm: 600 }, t),
    approve(run('k2', 300, 0, 300, 180), { kind: 'benchtop', room: 'Kitchen', areaId: 'benchtop-main', label: 'Main benchtop', depthMm: 600 }, t),
    approve(run('i1', 0, 400, 230, 400), { kind: 'benchtop', room: 'Kitchen', areaId: 'benchtop-island', label: 'Island benchtop', depthMm: 1200 }, t),
    approve(run('l1', 0, 0, 340, 0, 2), { kind: 'benchtop', room: 'Laundry', areaId: 'benchtop-main', label: 'Laundry benchtop', depthMm: 600 }, t),
    approve(run('v1', 0, 0, 120, 0, 3), { kind: 'benchtop', room: 'Ensuite', areaId: 'wallMountedVanity', label: 'Wall-mounted vanity benchtop', depthMm: 600 }, t),
    approve(run('v2', 0, 0, 90, 0, 3), { kind: 'benchtop', room: 'Bathroom', areaId: 'floorMountedVanity', label: 'Floor-mounted vanity benchtop', depthMm: 600 }, t),
  ];
  const takeoff = takeoffOf(tags);
  const locations = [
    room('Kitchen', { benchtopAreas: [{ id: 'benchtop-main', label: 'Main benchtop', lengthMm: 1, depthMm: 600, surface: stone('mid_range_stone') }, { id: 'benchtop-island', label: 'Island benchtop', lengthMm: 1, depthMm: 1200, sameAsMain: false, surface: stone('high_end_stone') }] }),
    room('Laundry', { benchtopAreas: [{ id: 'benchtop-main', label: 'Laundry benchtop', lengthMm: '', depthMm: 600, surface: { supplier: 'Laminex', colourName: 'White', rangeKey: 'standard_laminate' } }] }),
    room('Ensuite', { bathroomBenchtops: { wallMountedVanity: { targetKey: 'wallMountedVanity', ...stone('base_range_stone') } } }),
    room('Bathroom', { bathroomBenchtops: { floorMountedVanity: { targetKey: 'floorMountedVanity', ...stone('base_range_stone') } } }),
  ];
  const next = job(locations, takeoff);
  // Main bench: 3000 + 1800 = 4.8 LM on the Mid Range row; island 2.3 LM on the High End row.
  assert.equal(find(next, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /600mm wide/).quantity, 4.8);
  assert.equal(find(next, 'KITCHEN BENCHTOPS', 'HIGH END STONE - 20MM', /1200mm wide/).quantity, 2.3);
  assert.equal(find(next, 'LAUNDRY BENCHTOPS', 'STANDARD LAMINATE', /600mm wide/).quantity, 3.4);
  assert.equal(find(next, 'BATHROOM BENCHTOPS', 'BASE RANGE STONE - 20MM', /600mm wide/).quantity, 2.1);
  assert.deepEqual(next.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED), []);
});

check('3 UNAPPROVED, UNCALIBRATED OR INCOMPLETE RUNS ARE NEVER QUANTITIES', () => {
  const t = takeoffOf([]);
  const pending = tagCabinetryMeasurement(run('p', 0, 0, 300, 0), { kind: 'benchtop', room: 'Kitchen', areaId: 'benchtop-main', depthMm: 600 }, t);
  assert.equal(pending.cabinetry.status, MEASUREMENT_REVIEW.PENDING);
  assert.deepEqual(cabinetryRequirementsFromTakeoff(takeoffOf([pending])).map(item => [item.quantity, /awaiting review/.test(item.issue)]), [[0, true]]);
  const noDepth = tagCabinetryMeasurement(run('n', 0, 0, 300, 0), { kind: 'benchtop', room: 'Kitchen', status: MEASUREMENT_REVIEW.APPROVED }, t);
  assert.equal(noDepth.cabinetry.status, MEASUREMENT_REVIEW.PENDING, 'approval is blocked without a depth');
  assert(noDepth.cabinetry.approvalBlocked.includes('Choose the benchtop depth'));
  const approved = approve(run('a', 0, 0, 300, 0), { kind: 'benchtop', room: 'Kitchen', areaId: 'benchtop-main', depthMm: 600 }, t);
  assert.equal(approved.cabinetry.status, MEASUREMENT_REVIEW.APPROVED);
  assert.equal(approved.cabinetry.calibration.pixelsPerMm, PX);
  assert(cabinetryMeasurementIssues(approved, { pixelsPerMm: null }).includes('Calibrate this sheet'));
  // Recalibrating after approval invalidates the quantity until it is reviewed again.
  const items = cabinetryRequirementsFromTakeoff({ pixelsPerMm: 0.2, completedMeasurements: [approved] });
  assert.equal(items.filter(item => item.quantity > 0).length, 0);
  assert(items[0].issue.includes('Calibration changed'));
  // A rejected run is ignored.
  assert.deepEqual(cabinetryRequirementsFromTakeoff(takeoffOf([{ ...approved, cabinetry: { ...approved.cabinetry, status: MEASUREMENT_REVIEW.REJECTED } }])), []);
});

check('4 SHEET CALIBRATION IS AUTHORITATIVE OVER THE JOB DEFAULT', () => {
  const t = { pixelsPerMm: 0.1, scheduleState: { sheetCalibrations: { 2: { pixelsPerMm: 0.2 } } }, completedMeasurements: [] };
  const onSheet2 = approve(run('s2', 0, 0, 480, 0, 2), { kind: 'benchtop', room: 'Laundry', areaId: 'benchtop-main', depthMm: 600 }, t);
  const [item] = cabinetryRequirementsFromTakeoff({ ...t, completedMeasurements: [onSheet2] });
  assert.equal(item.quantity, 2.4);
});

check('5 MDF BULKHEADS: MEASURED RUNS FULFIL A "MEASUREMENT REQUIRED" SCHEDULE LINE', () => {
  const t = takeoffOf([]);
  const runs = [approve(run('b1', 0, 0, 250, 0), { kind: 'bulkhead', room: 'Kitchen', bulkheadType: 'bulkhead_300' }, t), approve(run('b2', 0, 0, 180, 0), { kind: 'bulkhead', room: 'Kitchen', bulkheadType: 'bulkhead_300' }, t)];
  const schedule = [{ componentId: 'BH-1', location: 'Kitchen', cabinetTypeId: 'bulkhead_300', unitType: 'MDF bulkhead 300mm', quantity: 1, handleQuantity: 0 }];
  const next = job([room('Kitchen')], takeoffOf(runs), schedule);
  const row = find(next, 'KITCHEN CABINETRY', 'STANDARD COLOURBOARD', /bulkhead.*300/i);
  assert.equal(row.quantity, 4.3);
  assert.deepEqual(next.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED), []);
  // Without the approved runs the schedule line keeps asking for a length.
  const missing = job([room('Kitchen')], takeoffOf([]), schedule);
  assert.equal(find(missing, 'KITCHEN CABINETRY', 'STANDARD COLOURBOARD', /bulkhead.*300/i).quantity, '');
  assert.equal(missing.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED).length, 1);
});

check('6 A RUN THAT MATCHES NO BENCHTOP AREA IS REPORTED, NOT GUESSED', () => {
  const t = takeoffOf([]);
  const stray = approve(run('x', 0, 0, 300, 0), { kind: 'benchtop', room: 'Kitchen', areaId: 'scullery-bench', label: 'Scullery bench', depthMm: 600 }, t);
  const locations = [room('Kitchen', { benchtopAreas: [{ id: 'benchtop-main', label: 'Main benchtop', lengthMm: 4800, depthMm: 600, surface: stone('mid_range_stone') }, { id: 'benchtop-island', label: 'Island benchtop', lengthMm: 2300, depthMm: 1200, surface: stone('mid_range_stone') }] })];
  const next = job(locations, takeoffOf([stray]));
  // Client Selections' own lengths stand; the stray run adds nothing and is flagged.
  assert.equal(find(next, 'KITCHEN BENCHTOPS', 'MID RANGE STONE - 20MM', /600mm wide/).quantity, 4.8);
  const flagged = next.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED);
  assert.equal(flagged.length, 1); assert.match(flagged[0].reason, /does not match one benchtop area/);
});

check('7 SAVE / RELOAD IS STABLE AND NO DUPLICATE ROWS ARE CREATED', () => {
  const t = takeoffOf([]);
  const measurements = [approve(run('k1', 0, 0, 300, 0), { kind: 'benchtop', room: 'Laundry', areaId: 'benchtop-main', label: 'Laundry benchtop', depthMm: 600 }, t)];
  const locations = [room('Laundry', { benchtopAreas: [{ id: 'benchtop-main', label: 'Laundry benchtop', lengthMm: '', depthMm: 600, surface: { supplier: 'Laminex', colourName: 'White', rangeKey: 'standard_laminate' } }] })];
  const first = job(locations, takeoffOf(measurements));
  const stored = JSON.parse(JSON.stringify(first));
  assert.equal(apply(stored, owner), stored, 'a reopened job recomputes nothing');
  assert.equal(rows(first).length, rows(base).length, 'no rows added');
  const keyed = rows(first).map(row => row.importKey).filter(Boolean);
  assert.equal(new Set(keyed).size, keyed.length, 'no duplicate import keys');
});

check('8 AI DETECTIONS ARE SUGGESTIONS: ALWAYS PENDING WITH GEOMETRY ONLY', () => {
  const [suggested] = cabinetryMeasurementsFromDetections([{ detectionId: 'd1', kind: 'benchtop', page: 1, room: 'Kitchen', label: 'Main bench', depthMm: 600, lengthMm: 9999, confidence: 0.9, nodes: [{ x: 0, y: 0 }, { x: 200, y: 0 }] }]);
  assert.equal(suggested.cabinetry.status, MEASUREMENT_REVIEW.PENDING);
  assert.equal(suggested.cabinetry.source, 'ai');
  assert.equal(measurementLengthMm(suggested, PX), 2000);
  assert.equal(cabinetryRequirementsFromTakeoff(takeoffOf([suggested])).filter(item => item.quantity > 0).length, 0);
});

const failed = Object.entries(results).filter(([, value]) => value !== 'PASS');
if (failed.length) { console.error(`${failed.length} check(s) failed`); process.exit(1); }
console.log(`Takeoff cabinetry measurements: ${Object.keys(results).length} checks passed.`);
