// Explicit job context: URL as the source of truth, job-scoped keys, stale-write detection.
// Run: node scripts/test-job-context.mjs
import assert from 'node:assert/strict';
import { JobConflictError, jobIdFromKey, jobKeyFromId, jobKeyFromLocation, jobScopedKey, knownJobRevision, rememberJobRevision, staleWriteConflict, urlWithJob } from '../lib/construction-estimation/jobContext.js';
const pass = message => console.log(`PASS ${message}`);

assert.equal(jobScopedKey('builder_01', 'job_123', 'estimate'), 'builder_01:job_123:estimate');
assert.equal(jobScopedKey('builder_01', 'job:job_123', 'selections'), 'builder_01:job_123:selections');
for (const args of [['', 'job_1', 'estimate'], ['builder_01', '', 'estimate'], ['builder_01', 'job_1', '']]) assert.throws(() => jobScopedKey(...args), /needs a builder, a job and a module/);
assert.notEqual(jobScopedKey('b', 'job_a', 'estimate'), jobScopedKey('b', 'job_b', 'estimate'));
pass('every cache / storage key is builder + job + module, and cannot be built without a job');

assert.deepEqual([jobKeyFromId('job_123'), jobKeyFromId('job:job_123'), jobIdFromKey('job:job_123'), jobKeyFromId('')], ['job:job_123', 'job:job_123', 'job_123', '']);
assert.equal(jobKeyFromLocation({ search: '?page=clientSelections&jobId=job_A' }), 'job:job_A');
assert.equal(jobKeyFromLocation({ search: '?page=clientSelections' }), '', 'no job in the address: nothing is inferred');
assert.equal(urlWithJob('http://x/modules/estimate-builder?page=quotation&selectionArea=interior', 'job:job_B'), '/modules/estimate-builder?page=quotation&selectionArea=interior&jobId=job_B', 'every other parameter is kept');
assert.equal(urlWithJob('http://x/modules/estimate-builder?jobId=job_A&page=boq', 'job:job_B'), '/modules/estimate-builder?jobId=job_B&page=boq');
assert.equal(urlWithJob('http://x/modules/estimate-builder?jobId=job_A&page=boq', ''), '/modules/estimate-builder?page=boq');
pass('the URL names the job; changing it keeps the rest of the address');

const mine = { tabId: 'tab-1' }, theirs = { tabId: 'tab-2' };
const storedBy = (updatedBy, revision) => ({ revision, savedAt: '2026-10-08T01:00:00.000Z', ...(updatedBy ? { updatedBy } : {}) });
assert.equal(staleWriteConflict(storedBy(theirs, 5), { baseRevision: 5, writer: mine }), null, 'nobody saved since this tab loaded');
assert.equal(staleWriteConflict(storedBy(mine, 7), { baseRevision: 5, writer: mine }), null, "a tab never conflicts with its own saves");
const conflict = staleWriteConflict(storedBy(theirs, 6), { baseRevision: 5, writer: mine, jobKey: 'job:job_A' });
assert(conflict instanceof JobConflictError);
assert.deepEqual([conflict.code, conflict.jobKey, conflict.baseRevision, conflict.storedRevision, conflict.updatedBy], ['JOB_CONFLICT', 'job:job_A', 5, 6, theirs]);
assert(/Nothing was overwritten/.test(conflict.message));
assert.equal(staleWriteConflict(storedBy(null, 6), { baseRevision: 5, writer: mine }), null, 'a record with no writer stamp (saved before stamps existed) never blocks a save');
assert.equal(staleWriteConflict(storedBy(theirs, 6), { baseRevision: null, writer: mine }), null, 'a tab that has not loaded the job has no base to be stale against');
assert.equal(staleWriteConflict(null, { baseRevision: 5, writer: mine }), null, 'a new job');
pass('a save based on an older revision than another tab or user has since saved is a conflict, never an overwrite');

rememberJobRevision('job:job_A', 3); rememberJobRevision('job:job_B', 9);
assert.deepEqual([knownJobRevision('job:job_A'), knownJobRevision('job:job_B'), knownJobRevision('job:job_C')], [3, 9, null], 'each job has its own base revision');
pass('base revisions are tracked per job');
console.log('\nJob context: all checks passed');
