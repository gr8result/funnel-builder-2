// Opening a .gr8job file that would replace a newer stored takeoff needs the user's decision:
// open separately, cancel, or restore the file's revision. Opening the same or a newer file does not.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JOB_FILE_CHOICES, asSeparateJob, jobFileReplacesNewerStoredJob } from '../lib/construction-estimation/jobFileImportDecision.js';
import { staleTakeoffOverwrite } from '../lib/construction-estimation/takeoffFreshnessGuard.js';
import { linkTakeoffToMasterJob } from '../lib/construction-estimation/masterJob.js';

const wall = (id) => ({ id, page: 2, category: 'interior', nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
const takeoff = (overrides = {}) => ({ takeoffId: 'takeoff:job-1', jobId: 'job-1', masterJobId: 'job-1', associatedProjectId: 'job-1', revision: 2, updatedAt: '2026-10-03T02:00:00.000Z', contentChecksum: 'oct-3', pixelsPerMm: 0.02,
  completedWallRuns: [wall('m1'), wall('m2')], placedOpenings: [], scheduleState: {}, platformProject: { projectId: 'job-1' }, ...overrides });
const fileTakeoff = takeoff();
const newerTakeoff = takeoff({ revision: 3, updatedAt: '2026-10-05T23:23:59.423Z', contentChecksum: 'oct-6', completedWallRuns: [wall('m1'), wall('m2'), wall('ai:1')], scheduleState: { aiAnalysis: { rooms: [{ id: 'r1' }] }, aiAppliedRuns: [{ runId: 'x' }] } });
const book = (job, extra = {}) => ({ jobId: 'job-1', projectId: 'job-1', registeredJobId: 'job-1', registeredJob: { jobId: 'job-1', jobName: 'New Job 03/09' }, jobFileMeta: { projectId: 'job-1', jobName: 'New Job 03/09' },
  quotation: { rows: 1 }, aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job, updatedAt: 'x' }, ...extra });
const stored = (job, savedAt = '2026-10-06T00:00:00.000Z') => ({ type: 'job', key: 'job:job-1', jobId: 'job-1', revision: 7, savedAt, workbook: book(job) });

// The 3 October file over the job re-analysed on 6 October.
const decision = jobFileReplacesNewerStoredJob(stored(newerTakeoff), book(fileTakeoff), '2026-10-03T03:00:00.000Z');
assert.equal(decision.code, 'STORED_JOB_NEWER');
assert.deepEqual(decision.choices, ['open-separately', 'cancel', 'restore']);
assert.deepEqual(decision.choices, [JOB_FILE_CHOICES.SEPARATE, JOB_FILE_CHOICES.CANCEL, JOB_FILE_CHOICES.RESTORE]);
assert.match(decision.message, /Nothing has been changed/);
assert.ok(decision.wouldLose.includes('1 traced items') && decision.wouldLose.includes('the AI analysis and its evidence'));
assert.equal(decision.stored.revision, 7);

// No decision is needed when nothing newer would be replaced.
assert.equal(jobFileReplacesNewerStoredJob(null, book(fileTakeoff)), null, 'job not stored here yet');
assert.equal(jobFileReplacesNewerStoredJob(stored(fileTakeoff), book(structuredClone(fileTakeoff)), '2026-10-03T03:00:00.000Z'), null, 're-opening the file the stored job came from');
assert.equal(jobFileReplacesNewerStoredJob(stored(fileTakeoff), book(newerTakeoff), '2026-10-07T00:00:00.000Z'), null, 'a newer file');
assert.equal(jobFileReplacesNewerStoredJob(stored({ takeoffId: 'takeoff:job-1', completedWallRuns: [wall('m1')] }), book({ takeoffId: 'takeoff:job-1', completedWallRuns: [] })), null, 'legacy files without takeoff stamps');
assert.equal(jobFileReplacesNewerStoredJob({ workbook: { jobId: 'job-1' } }, book(fileTakeoff)), null, 'stored job has no takeoff');

// Open separately: a new identity everywhere, so nothing it saves can reach the stored job.
const original = book(fileTakeoff);
const frozen = JSON.stringify(original);
const copy = asSeparateJob(original, 'copy-123', '2026-10-09T00:00:00.000Z');
assert.equal(JSON.stringify(original), frozen, 'the file workbook is not mutated');
assert.deepEqual([copy.jobId, copy.projectId, copy.registeredJobId, copy.registeredJob.jobId, copy.jobFileMeta.projectId], Array(5).fill('copy-123'));
assert.equal(copy.jobFileMeta.openedSeparatelyFrom, 'job-1');
assert.equal(copy.jobFileMeta.localFileOnly, true);
assert.match(copy.registeredJob.jobName, /New Job 03\/09 \(opened copy\)/);
assert.deepEqual([copy.aiPlanTakeoffJob.masterJobId, copy.aiPlanTakeoffJob.jobId, copy.aiPlanTakeoffJob.associatedProjectId, copy.aiPlanTakeoffJob.takeoffId], ['copy-123', 'copy-123', 'copy-123', 'takeoff:copy-123']);
assert.equal(copy.takeoffEngine.aiPlanTakeoffJob, copy.aiPlanTakeoffJob, 'both takeoff copies stay one object');
assert.deepEqual(copy.aiPlanTakeoffJob.completedWallRuns, fileTakeoff.completedWallRuns, 'the file\'s geometry is opened as it is');
assert.equal(copy.quotation, original.quotation);
// The separate job's takeoff links to its own master job, and is not "the stored takeoff, older".
assert.equal(linkTakeoffToMasterJob({ jobId: 'copy-123', data: {} }, copy.aiPlanTakeoffJob, { storedInMaster: true }).masterJobId, 'copy-123');
assert.equal(staleTakeoffOverwrite(stored(newerTakeoff).workbook, copy), null, 'a different takeoff id is never a stale copy of the stored one');
assert.throws(() => asSeparateJob(original, ''), /own id/);

// The hook and the screen use the decision: no decision means nothing is written.
const hook = fs.readFileSync(new URL('../hooks/estimate-builder/useEstimateBuilderWorkbook.js', import.meta.url), 'utf8');
const decisionAt = hook.indexOf('jobFileReplacesNewerStoredJob(storedForFile');
const saveAt = hook.indexOf('allowOlderTakeoff: fileChoice === JOB_FILE_CHOICES.RESTORE');
assert.ok(decisionAt > 0 && saveAt > decisionAt, 'the decision is taken before the file is stored');
assert.ok(hook.slice(decisionAt, saveAt).includes('return { ok: false, needsDecision: true, ...replacement };'), 'without a choice the open stops before any write');
assert.ok(hook.slice(decisionAt, saveAt).indexOf('needsDecision: true') < hook.slice(decisionAt, saveAt).indexOf('saveJobBackup('), 'not even a backup is written before the choice');
const screen = fs.readFileSync(new URL('../components/estimate-builder/EstimateBuilderWorkbook.js', import.meta.url), 'utf8');
assert.ok(screen.includes('chooseJobFileAction(loadResult') && screen.includes('onNewerStoredJob: choice'), 'the screen asks and passes the choice back');
const dialog = fs.readFileSync(new URL('../components/estimate-builder/jobFileConflictDialog.js', import.meta.url), 'utf8');
for (const label of ['Open separately', 'Cancel', 'Restore this revision']) assert.ok(dialog.includes(`"${label}"`), `dialog offers ${label}`);
console.log('job file import decision: ok');
