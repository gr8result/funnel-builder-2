// Local real-plan regression. Generate traces with the quick runner before running.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createJobData, prepareAiPlanTakeoffJobForSave, verifyAiPlanTakeoffSavedJob } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { privateTestData } from './lib/privateTestData.mjs';

const trace = JSON.parse(fs.readFileSync(process.argv[2] || privateTestData('falsewall-retained-Jesmond-5.json')));
const square = trace.canonical.placedOpenings.find(o => o.ai?.analysisEvidence?.evidence?.startsWith('Square-set'));
assert.ok(square, 'real drawing produced the measured square-set assembly');
assert.equal(square.widthMm, 897);
assert.equal(square.openingClass, 'Other Opening');
const original = structuredClone(trace.canonical);
const edited = original.placedOpenings.find(o => o.id !== square.id);
edited.widthMm += 25; // A disposable estimator correction must remain authoritative.
const job = createJobData({ ...original, name: 'Disposable vector regression', takeoffId: 'vector-regression',
  currentPage: 5, totalPages: 5, pixelsPerMm: trace.input.pixelsPerMm, rotation: 0,
  sheetLevels: { 5: 'Ground Floor' }, scheduleState: { aiAnalysis: { rooms: trace.prepared.rooms } } });
const save = prepareAiPlanTakeoffJobForSave(null, job, 'disposable-vector-regression');
assert.equal(save.ok, true);
const reopened = JSON.parse(JSON.stringify(save.job));
assert.equal(verifyAiPlanTakeoffSavedJob(save.job, reopened).ok, true);
assert.deepEqual(reopened.placedOpenings, original.placedOpenings, 'all measured and corrected dimensions survive serialization');
const context = { ...reopened, jobId: 'quick-accuracy', takeoffId: 'quick-accuracy', documentHash: 'quick',
  pages: [{ pageNumber: 5, ...trace.input }] };
const rerun = buildLocalVectorAnalysis({ planPage: { pageNumber: 5, ...trace.input }, detected: trace.detected,
  pixelsPerMm: trace.input.pixelsPerMm, level: 'Ground Floor', context, runId: 'repeat' });
const added = convertAiTakeoffDetections(rerun.batch, context);
assert.equal(added.placedOpenings.length, 0, 'application normalization prevents duplicate openings on rerun');
assert.equal(added.completedWallRuns.length, 0, 'application normalization prevents duplicate walls on rerun');
const schedule = createTakeoffSchedule(reopened);
const opening = schedule.measurementRecords.find(o => o.id === square.id);
assert.equal(opening.widthMm, 897);
assert.equal(opening.openingClass, 'Other Opening');
const payload = createJobSetupPayload(schedule);
const without = createJobSetupPayload(createTakeoffSchedule({ ...reopened, placedOpenings: reopened.placedOpenings.filter(o => o.id !== square.id) }));
for (const key of ['doorOpeningsQty', 'internalDoorOpeningsQty', 'externalDoorOpeningsQty']) assert.equal(payload.dataInputFields[key], without.dataInputFields[key], key);
console.log('PASS actual Jesmond vector opening: measured width, classification, save/reopen/rerun, manual width correction, duplicate prevention and Job Setup door quantities.');
