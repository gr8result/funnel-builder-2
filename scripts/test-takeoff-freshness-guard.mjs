// Regression for the cross-module overwrite: a screen holding the takeoff as it was on 1 October
// saved the whole job after the takeoff had been re-analysed on 6 October, and the older takeoff
// replaced the newer one. A save carrying an older copy of the takeoff must be refused.
import assert from 'node:assert/strict';
import { staleTakeoffOverwrite, StaleTakeoffError } from '../lib/construction-estimation/takeoffFreshnessGuard.js';

const wall = (id) => ({ id, page: 2, category: 'interior', nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
const takeoff = (overrides = {}) => ({
  takeoffId: 'takeoff:job-1', revision: 2, updatedAt: '2026-10-01T02:00:00.000Z', contentChecksum: 'oct-1', pixelsPerMm: 0.02,
  completedWallRuns: [wall('m1'), wall('m2')], placedOpenings: [], scheduleState: {}, ...overrides,
});
const manual = takeoff();
const analysed = takeoff({
  revision: 3, updatedAt: '2026-10-05T23:23:59.423Z', contentChecksum: 'oct-6',
  completedWallRuns: [wall('m1'), wall('m2'), wall('ai:1'), wall('ai:2')],
  scheduleState: { aiAnalysis: { rooms: [{ id: 'r1' }, { id: 'r2' }] }, aiAppliedRuns: [{ runId: 'ai-takeoff-v1' }], sheetCalibrations: { 2: { pixelsPerMm: 0.02 } } },
});
const job = (job, extra = {}) => ({ jobId: 'job-1', quotation: { rows: 1 }, aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job }, ...extra });

// The incident: Estimate Builder still holds the 1 October takeoff and saves the job.
const incident = staleTakeoffOverwrite(job(analysed), job(manual, { quotation: { rows: 2 } }));
assert.ok(incident instanceof StaleTakeoffError, 'an older takeoff copy is refused');
assert.equal(incident.code, 'TAKEOFF_STALE');
assert.match(incident.message, /Nothing was overwritten/);
assert.deepEqual(incident.wouldLose, ['2 traced items', 'sheet calibrations', 'the AI analysis and its evidence', '2 rooms', 'the record of applied AI runs']);
assert.equal(incident.stored.items, 4);
assert.equal(incident.incoming.items, 2);

// Estimate Builder saving its own edits with the CURRENT takeoff is an ordinary save.
assert.equal(staleTakeoffOverwrite(job(analysed), job(analysed, { quotation: { rows: 2 } })), null, 'same takeoff object');
assert.equal(staleTakeoffOverwrite(job(analysed), job(structuredClone(analysed))), null, 'same takeoff content reloaded from storage');
// AI Takeoff saving newer work, including deleting items, is an ordinary save.
const corrected = takeoff({ revision: 4, updatedAt: '2026-10-07T01:00:00.000Z', contentChecksum: 'oct-7', completedWallRuns: [wall('m1')] });
assert.equal(staleTakeoffOverwrite(job(analysed), job(corrected)), null, 'a newer takeoff may remove items');
// A module that changes the takeoff it loaded without restamping it is not older than what is stored.
assert.equal(staleTakeoffOverwrite(job(analysed), job({ ...analysed, contentChecksum: 'linked', jobName: 'Renamed' })), null, 'same stamp, changed content');

// Only one of the two workbook copies being stale is still a stale save.
assert.ok(staleTakeoffOverwrite(job(analysed), { jobId: 'job-1', aiPlanTakeoffJob: analysed, takeoffEngine: { aiPlanTakeoffJob: manual } }) instanceof StaleTakeoffError, 'stale compatibility copy');
// The stored job is judged by its newest copy.
assert.ok(staleTakeoffOverwrite({ jobId: 'job-1', aiPlanTakeoffJob: manual, takeoffEngine: { aiPlanTakeoffJob: analysed } }, job(manual)) instanceof StaleTakeoffError, 'newest stored copy counts');

// Existing .gr8job files: takeoffs saved before stamps existed never block a save.
const unstamped = { takeoffId: 'takeoff:job-1', completedWallRuns: [wall('m1')] };
assert.equal(staleTakeoffOverwrite(job(unstamped), job({ ...unstamped, completedWallRuns: [] })), null, 'no stamps on either side');
assert.equal(staleTakeoffOverwrite(job(analysed), job(unstamped)), null, 'incoming takeoff with no stamps is not proven older');
assert.equal(staleTakeoffOverwrite(job(unstamped), job(analysed)), null, 'stamped takeoff over an unstamped one');
// Revision alone decides only when a date is missing.
assert.ok(staleTakeoffOverwrite(job(takeoff({ revision: 5, updatedAt: '' , contentChecksum: 'a' })), job(takeoff({ revision: 4, updatedAt: '', contentChecksum: 'b' }))) instanceof StaleTakeoffError, 'lower revision without dates');
// No stored takeoff, no incoming takeoff, or a different takeoff replacing it deliberately.
assert.equal(staleTakeoffOverwrite({ jobId: 'job-1' }, job(manual)), null);
assert.equal(staleTakeoffOverwrite(job(analysed), { jobId: 'job-1' }), null);
assert.equal(staleTakeoffOverwrite(job(analysed), job(takeoff({ takeoffId: 'takeoff:other', contentChecksum: 'x' }))), null, 'a different takeoff');
// The guard never changes either job.
const before = JSON.stringify([job(analysed), job(manual)]);
staleTakeoffOverwrite(job(analysed), job(manual));
assert.equal(JSON.stringify([job(analysed), job(manual)]), before);
console.log('takeoff freshness guard: ok');
