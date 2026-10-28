// In-memory verification on the ISOLATED job copy: synthetic calibrated runs are tagged and approved on the copy's
// takeoff, then the cabinetry engine is applied. Nothing is written; the lengths are test geometry, not measurements.
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-takeoff-measurements-on-job-copy.mjs <job-copy.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyCabinetryRequirementsToQuotation, CABINETRY_ACTION_REQUIRED, CABINETRY_LINK_FIELD } from '../lib/construction-estimation/cabinetryRequirements.js';
import { tagCabinetryMeasurement, MEASUREMENT_REVIEW } from '../lib/construction-estimation/takeoffCabinetryMeasurements.js';

const copy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { projectEstimateBuilder, ...kept } = copy.workbook;
const workbook = kept;
const owner = workbook.workspaceId;
const fingerprint = JSON.stringify(workbook.quotation);
const before = applyCabinetryRequirementsToQuotation(workbook, owner);
const attention = book => book.cabinetryReconciliation.entries.filter(entry => entry.outcome === CABINETRY_ACTION_REQUIRED);
const takeoff = workbook.aiPlanTakeoffJob;
const ppm = takeoff.pixelsPerMm;
assert(ppm > 0, 'the copy has a calibrated takeoff');
const mm = value => value * ppm; // synthetic run of `value` mm
const run = (id, lengthMm) => ({ id, page: 1, p1: { x: 0, y: 0 }, p2: { x: mm(lengthMm), y: 0 }, offset: { x: 0, y: 0 } });
const approve = (measurement, tag) => tagCabinetryMeasurement(tagCabinetryMeasurement(measurement, tag, takeoff), { status: MEASUREMENT_REVIEW.APPROVED }, takeoff);
const areas = before.cabinetryReconciliation.entries.filter(entry => /benchtop/i.test(entry.label) || /bulkhead/.test(entry.type)).map(entry => `${entry.room}|${entry.label}|${entry.reason}`);
console.log('Attention before:', attention(before).length, JSON.stringify(areas));

const runs = [
  approve(run('syn-k-main', 3600), { kind: 'benchtop', room: 'Kitchen', areaId: 'main-benchtop', label: 'Main benchtop', depthMm: 600 }),
  approve(run('syn-bh-k', 2000), { kind: 'bulkhead', room: 'Kitchen', bulkheadType: 'bulkhead_300' }),
  approve(run('syn-bh-l', 1500), { kind: 'bulkhead', room: 'Laundry', bulkheadType: 'bulkhead_300' }),
  tagCabinetryMeasurement(run('syn-pending', 900), { kind: 'benchtop', room: 'Laundry', areaId: 'laundry-benchtop', depthMm: 600 }, takeoff),
];
const withRuns = { ...workbook, aiPlanTakeoffJob: { ...takeoff, completedMeasurements: [...(takeoff.completedMeasurements || []), ...runs] } };
const after = applyCabinetryRequirementsToQuotation(withRuns, owner);
const row = (book, importKey) => book.quotation.CABINETRY.rows.find(item => item.importKey === importKey);
const changed = after.quotation.CABINETRY.rows.filter(item => item[CABINETRY_LINK_FIELD] && JSON.stringify(item[CABINETRY_LINK_FIELD]) !== JSON.stringify(row(before, item.importKey)?.[CABINETRY_LINK_FIELD]));
console.log('Rows changed by approved synthetic runs:', JSON.stringify(changed.map(item => ({ item: item.item, range: item.range, room: item.room, qty: item.quantity, rooms: item[CABINETRY_LINK_FIELD].roomQuantities }))));
assert.equal(after.quotation.CABINETRY.rows.length, before.quotation.CABINETRY.rows.length, 'no rows added or removed');
const bulkheads = changed.filter(item => /bulkhead/i.test(item.item));
assert(bulkheads.length >= 1 && bulkheads.reduce((total, item) => total + Number(item.quantity), 0) === 3.5, 'bulkhead LM from calibrated runs: 2.0 + 1.5');
assert(attention(after).every(entry => !/Bulkhead length required/.test(entry.reason) || entry.room === 'Pantry'), 'Kitchen and Laundry bulkheads are no longer asked for a length; the unmeasured Pantry still is');
assert(attention(after).some(entry => /awaiting review/.test(entry.reason)), 'the pending run is flagged, not counted');
// The original (copy) workbook is unchanged and a second pass is stable.
assert.equal(JSON.stringify(workbook.quotation), fingerprint);
assert.equal(applyCabinetryRequirementsToQuotation(after, owner), after, 'idempotent');
console.log('Attention after:', attention(after).length, JSON.stringify(attention(after).map(entry => `${entry.room}|${entry.label}|${entry.reason}`)));
console.log('Takeoff measurements on isolated job copy: passed');
