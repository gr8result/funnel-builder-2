// Cross-module save reliability, through the real persistCompleteJob transaction: a save from
// Estimate Builder (or any other screen) that still holds an older copy of the plan takeoff must
// never replace the newer takeoff, whichever tab it comes from; ordinary saves in both directions,
// legacy jobs and deliberate restores keep working; and what was stored is what reopens.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-save-reliability.mjs
import assert from 'node:assert/strict';
import { persistCompleteJob } from '../lib/construction-estimation/jobPersistence.js';

// Minimal in-memory IndexedDB (as in test-job-schema-evolution.mjs), including abort/rollback.
globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
function memoryDatabase(records = new Map()) {
  const open = async () => ({ close() {}, transaction() {
    const before = new Map(records);
    const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
    let pending = 0, done = false;
    const settle = () => queueMicrotask(() => { if (!done && pending === 0) { done = true; transaction.oncomplete?.(); } });
    const request = (run) => {
      const handle = { onsuccess: null, onerror: null, result: undefined };
      pending += 1;
      queueMicrotask(() => {
        if (done) return;
        try { handle.result = run(); pending -= 1; handle.onsuccess?.(); settle(); }
        catch (error) { transaction.error = error; transaction.abort(); }
      });
      return handle;
    };
    transaction.abort = () => { if (done) return; done = true; records.clear(); before.forEach((value, key) => records.set(key, value)); queueMicrotask(() => transaction.onabort?.()); };
    transaction.objectStore = () => ({
      get: (key) => request(() => structuredClone(records.get(key))),
      put: (value, key) => request(() => { records.set(key, structuredClone(value)); }),
      add: (value, key) => request(() => { if (records.has(key)) throw new Error('Key already exists.'); records.set(key, structuredClone(value)); }),
      delete: (key) => request(() => { records.delete(key); }),
      getAllKeys: (range) => request(() => [...records.keys()].filter((key) => key >= range.lower && key <= range.upper)),
    });
    return transaction;
  } });
  return { open, records };
}

const KEY = 'job:job-1';
const wall = (id, extra = {}) => ({ id, page: 2, category: 'interior', nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], ...extra });
const takeoff = (overrides = {}) => ({
  takeoffId: 'takeoff:job-1', masterJobId: 'job-1', revision: 2, updatedAt: '2026-10-01T02:00:00.000Z', contentChecksum: 'oct-1', pixelsPerMm: 0.02,
  completedWallRuns: [wall('m1'), wall('m2')], placedOpenings: [], scheduleState: {}, ...overrides,
});
const manualTakeoff = takeoff();
const analysedTakeoff = takeoff({
  revision: 3, updatedAt: '2026-10-05T23:23:59.423Z', contentChecksum: 'oct-6',
  completedWallRuns: [wall('m1', { nodes: [{ x: 0, y: 0 }, { x: 12, y: 0 }], manuallyCorrected: true }), wall('m2'), wall('ai:1'), wall('ai:2')],
  scheduleState: { aiAnalysis: { runId: 'ai-takeoff-v1', rooms: [{ id: 'r1', name: 'Bed 1', confirmed: true }] }, aiAppliedRuns: [{ runId: 'ai-takeoff-v1' }], sheetCalibrations: { 2: { pixelsPerMm: 0.02 } } },
});
const workbook = (job, quotationRows = 1) => ({
  jobId: 'job-1', data: { projectName: 'Save reliability' }, quotation: { CARPENTRY: { rows: Array.from({ length: quotationRows }, (_, i) => ({ id: `row-${i}` })) } },
  formulas: { a: 1 }, clientPage: { title: 'x' }, cashflowPayments: { stages: [] },
  ...(job ? { aiPlanTakeoffJob: job, takeoffEngine: { aiPlanTakeoffJob: job } } : {}),
});
const tabA = { tabId: 'tab-takeoff' }, tabB = { tabId: 'tab-estimate' };
let clock = 0;
const save = (database, book, options = {}) => persistCompleteJob({ openDatabase: database.open, storeName: 'jobs', key: KEY, workbook: book, name: 'Save reliability',
  savedAt: new Date(Date.UTC(2026, 9, 7, 0, 0, clock++)).toISOString(), activePointer: (record) => ({ key: record.key }), ...options });
const stored = (database) => database.records.get(KEY);
const results = [];
const test = async (name, run) => { try { await run(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name}: ${String(error.message).slice(0, 300)}`); } };
// A job in the state of the incident: the manual trace saved, then the takeoff re-analysed and saved.
async function analysedJob({ stamped = true } = {}) {
  const database = memoryDatabase();
  const first = await save(database, workbook(manualTakeoff), stamped ? { writer: tabB, baseRevision: null } : {});
  const second = await save(database, workbook(analysedTakeoff), stamped ? { writer: tabA, baseRevision: first.revision } : {});
  return { database, first, second };
}
const unchanged = (database, second) => {
  const record = stored(database);
  assert.equal(record.revision, second.revision, 'stored revision untouched');
  assert.deepEqual(record.workbook.aiPlanTakeoffJob, analysedTakeoff, 'newer takeoff, corrections, calibration and evidence intact');
  assert.deepEqual(record.workbook.takeoffEngine.aiPlanTakeoffJob, analysedTakeoff);
};

await test('cross-tab: Estimate Builder tab that loaded before the analysis is rejected', async () => {
  const { database, first, second } = await analysedJob();
  await assert.rejects(save(database, workbook(manualTakeoff, 2), { writer: tabB, baseRevision: first.revision }), (error) => error.code === 'JOB_CONFLICT');
  unchanged(database, second);
});
await test('same tab: a stale takeoff copy with an up-to-date job revision is rejected', async () => {
  const { database, second } = await analysedJob();
  await assert.rejects(save(database, workbook(manualTakeoff, 2), { writer: tabA, baseRevision: second.revision }),
    (error) => error.code === 'TAKEOFF_STALE' && /Nothing was overwritten/.test(error.message) && error.wouldLose.includes('the AI analysis and its evidence'));
  unchanged(database, second);
});
await test('a tab with no recorded base revision cannot put the older takeoff back', async () => {
  const { database, second } = await analysedJob();
  await assert.rejects(save(database, workbook(manualTakeoff, 2), { writer: tabB, baseRevision: null }), (error) => error.code === 'TAKEOFF_STALE');
  unchanged(database, second);
});
await test('records written without writer stamps are protected too', async () => {
  const { database, second } = await analysedJob({ stamped: false });
  await assert.rejects(save(database, workbook(manualTakeoff, 2)), (error) => error.code === 'TAKEOFF_STALE');
  unchanged(database, second);
});
await test('force (overwrite a newer job revision) does not lift the takeoff guard', async () => {
  const { database, second } = await analysedJob();
  await assert.rejects(save(database, workbook(manualTakeoff, 2), { writer: tabB, baseRevision: 1, force: true }), (error) => error.code === 'TAKEOFF_STALE');
  unchanged(database, second);
});
await test('Estimate Builder save with the current takeoff saves its edits and keeps the takeoff', async () => {
  const { database, second } = await analysedJob();
  const record = await save(database, workbook(structuredClone(analysedTakeoff), 5), { writer: tabA, baseRevision: second.revision });
  assert.equal(record.revision, second.revision + 1);
  assert.equal(stored(database).workbook.quotation.CARPENTRY.rows.length, 5);
  assert.deepEqual(stored(database).workbook.aiPlanTakeoffJob, analysedTakeoff);
});
await test('AI Takeoff save with newer work (including deletions) saves, then reopens identically', async () => {
  const { database, second } = await analysedJob();
  const corrected = takeoff({ ...structuredClone(analysedTakeoff), revision: 4, updatedAt: '2026-10-07T03:00:00.000Z', contentChecksum: 'oct-7',
    completedWallRuns: [wall('m1', { nodes: [{ x: 0, y: 0 }, { x: 13, y: 0 }], manuallyCorrected: true }), wall('ai:1')] });
  const record = await save(database, workbook(corrected), { writer: tabA, baseRevision: second.revision });
  assert.equal(record.revision, second.revision + 1);
  const reopened = structuredClone(stored(database).workbook.aiPlanTakeoffJob);
  assert.deepEqual(reopened, corrected, 'manual correction, calibration, analysis and receipts reopen as saved');
  // ...and Estimate Builder, having reloaded, saves over it without touching the takeoff.
  const next = await save(database, { ...workbook(reopened, 3) }, { writer: tabB, baseRevision: record.revision });
  assert.equal(next.revision, record.revision + 1);
  assert.deepEqual(stored(database).workbook.aiPlanTakeoffJob, corrected);
});
await test('legacy job whose takeoff has no stamps keeps saving', async () => {
  const database = memoryDatabase();
  const legacy = { takeoffId: 'takeoff:job-1', completedWallRuns: [wall('m1'), wall('m2')], placedOpenings: [] };
  const first = await save(database, workbook(legacy));
  const edited = await save(database, workbook({ ...legacy, completedWallRuns: [wall('m1')] }, 2));
  assert.equal(edited.revision, first.revision + 1);
  const upgraded = await save(database, workbook(analysedTakeoff, 2));
  assert.equal(upgraded.revision, edited.revision + 1, 'a stamped takeoff may replace an unstamped one');
});
await test('job with no takeoff at all is unaffected', async () => {
  const database = memoryDatabase();
  const first = await save(database, workbook(null));
  assert.equal((await save(database, workbook(null, 4))).revision, first.revision + 1);
});
await test('restoring an earlier revision on purpose is allowed, and only then', async () => {
  const { database, second } = await analysedJob();
  const record = await save(database, workbook(manualTakeoff), { writer: tabA, baseRevision: second.revision, allowOlderTakeoff: true });
  assert.equal(record.revision, second.revision + 1);
  assert.deepEqual(stored(database).workbook.aiPlanTakeoffJob, manualTakeoff);
  // The replaced job is still there as the previous revision.
  const previous = [...database.records.entries()].find(([key]) => key.startsWith(`${KEY}:snapshot:revision-${second.revision}-`));
  assert.deepEqual(previous[1].workbook.aiPlanTakeoffJob, analysedTakeoff, 'the newer takeoff is kept as the prior revision');
});
await test('re-saving the same analysed job twice creates no second copy', async () => {
  const { database, second } = await analysedJob();
  const again = await save(database, workbook(structuredClone(analysedTakeoff)), { writer: tabA, baseRevision: second.revision });
  assert.equal(again.revision, second.revision, 'identical content is not a new revision');
  assert.equal(stored(database).workbook.aiPlanTakeoffJob.completedWallRuns.length, 4);
});

console.log(results.join('\n'));
if (results.some((line) => line.startsWith('FAIL'))) process.exit(1);
console.log('takeoff save reliability: all passed');
