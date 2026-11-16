// Shared calibration across plan sheets: the estimator calibrates one sheet and explicitly applies
// that scale to chosen sheets; others keep their own; approvals on changed sheets are withdrawn;
// the record survives a save/reopen (sanitize) and a .gr8job round trip.
// Run: node --import ./scripts/register-extensionless-loader.mjs scripts/test-takeoff-shared-calibration.mjs
import assert from 'node:assert/strict';
import { JOB_SCALE_KEY, calibrationsWithSheets, rescaleRunLengths, sheetPixelsPerMm, sheetsWithChangedScale, withdrawApprovalsForScaleChange } from '../components/construction-estimation/ai-plan-takeoff/sheetScale.js';
import { readJob, writeJob } from '../lib/jobFile.ts';

// Four sheets: 1 and 2 are 1:100 floor plans, 3 is a 1:50 detail with its own calibration, 4 never calibrated.
const at = '2026-11-16T00:00:00.000Z';
const before = { [JOB_SCALE_KEY]: { pixelsPerMm: 0.0283, calibratedAt: at }, 3: { pixelsPerMm: 0.0567, calibratedAt: at } };
const after = calibrationsWithSheets(before, 1, 0.02835, { applyTo: [2], base: 0.0283, calibratedAt: at });
assert.equal(after[1].pixelsPerMm, 0.02835, 'calibrated sheet keeps the measured scale');
assert.deepEqual(after[2], { pixelsPerMm: 0.02835, calibratedAt: at, appliedFromSheet: 1 }, 'explicitly chosen sheet receives the same scale, with where it came from');
assert.equal(after[3].pixelsPerMm, 0.0567, 'a different-scale sheet keeps its own calibration');
assert.equal(after[4], undefined, 'a sheet not chosen is not given a calibration');
assert.equal(after[JOB_SCALE_KEY].pixelsPerMm, 0.0283, 'the job scale is unchanged');
assert.equal(calibrationsWithSheets(before, 1, 0.02835, { applyTo: [1, 0, -2, 'x'] })[0], before[0], 'only real other sheets are applied');
assert.equal(calibrationsWithSheets(before, 1, 0), before, 'an invalid scale changes nothing');

const was = (page) => sheetPixelsPerMm(page, 0.0283, before), now = (page) => sheetPixelsPerMm(page, 0.0283, after);
assert.deepEqual(sheetsWithChangedScale([1, 2, 3, 4], was, now), [1, 2], 'only sheets whose effective scale moved are affected');

// Lengths stored in mm follow their own sheet's change only.
const runs = [{ id: 'a', page: 1, lengthMm: 1000 }, { id: 'b', page: 3, lengthMm: 1000 }, { id: 'c', page: 4, lengthMm: 1000 }];
const rescaled = rescaleRunLengths(runs, was, now);
assert.ok(Math.abs(rescaled[0].lengthMm - 1000 * 0.0283 / 0.02835) < 1e-9, 'sheet 1 run restated');
assert.equal(rescaled[1], runs[1]); assert.equal(rescaled[2], runs[2]);

const floorplans = [
  { id: 'f1', page: 1, confirmed: true, approvedAt: at },
  { id: 'f2', page: 2, confirmed: true, approvedAt: at },
  { id: 'f3', page: 3, confirmed: true, approvedAt: at },
  { id: 'f4', page: 1, confirmed: false },
];
const reviewed = withdrawApprovalsForScaleChange(floorplans, [1, 2]);
assert.deepEqual(reviewed.map((item) => item.confirmed), [false, false, true, false], 'approvals withdrawn only on changed sheets');
assert.equal(reviewed[0].approvedAt, null); assert.equal(reviewed[0].reviewRequired, true);
assert.equal(reviewed[2], floorplans[2], 'an untouched approval is the same object');
assert.equal(reviewed[3], floorplans[3], 'an unapproved area is left as it is');
assert.equal(withdrawApprovalsForScaleChange(floorplans, []), floorplans);

// Persistence: the record in scheduleState survives a .gr8job save and read.
let stored = new Uint8Array(0);
const handle = { name: 'cal.gr8job', async getFile() { return new File([stored], this.name); },
  async createWritable() { const parts = []; return { async write(b) { parts.push(new Uint8Array(await b.arrayBuffer())); }, async close() { stored = new Uint8Array(Buffer.concat(parts)); } }; } };
const takeoffJob = { id: 't', pixelsPerMm: 0.02835, scheduleState: { sheetCalibrations: after } };
const workbook = { jobId: 'cal-job', projectId: 'cal-job', aiPlanTakeoffJob: takeoffJob, takeoffEngine: { aiPlanTakeoffJob: takeoffJob } };
const saved = await writeJob(handle, { jobId: 'cal-job', jobName: 'Calibration', workbook });
assert.equal(saved.ok, true, saved.message);
const back = await readJob(new File([stored], 'cal.gr8job'));
const reopened = JSON.parse(JSON.stringify(back.workbook.aiPlanTakeoffJob.scheduleState.sheetCalibrations));
assert.deepEqual(reopened, JSON.parse(JSON.stringify(after)), 'sheet calibrations, including the applied-from record, survive .gr8job export/import');
assert.equal(sheetPixelsPerMm(2, 0.0283, reopened), 0.02835, 'sheet 2 measures at the applied scale after reopening');
assert.equal(sheetPixelsPerMm(3, 0.0283, reopened), 0.0567, 'sheet 3 keeps its own scale after reopening');

console.log('PASS shared calibration: explicit apply to chosen sheets, independent scales kept, lengths restated, approvals withdrawn, persisted through .gr8job');
