// Regression coverage for findMostRecentTakeoffSnapshotWithData - the actual mechanism that
// recovers "New Job 03/09": traced live, its attached aiPlanTakeoffJob was a genuinely empty
// {}, while a "pre-ai-plan-takeoff-overwrite" safety snapshot recorded at an earlier revision
// held the real 40 walls / 50 openings / 6 floorplans. listIndexedDbTakeoffRecords()
// deliberately excludes ":snapshot:" keys (they are payload history, not separate takeoffs to
// pick from a list), so that data was invisible to every existing recovery path. This function
// is the fix: it looks at exactly the one place the data can still be - this same job's own
// snapshot history - for the most recent one that still has it.
//
// A minimal in-memory IndexedDB stand-in is used rather than a mocking library: it implements
// only what this function actually calls (open/transaction/objectStore/openCursor), against the real
// exported function, so this exercises the shipped code path, not a re-description of it.
import assert from 'node:assert/strict';

function installFakeIndexedDb(records) {
  const fake = {
    open(name, version) {
      const request = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              getAll: () => { throw new Error('Snapshot recovery must not load the entire job database'); },
              openCursor: (range) => {
                assert.ok(range.lower.startsWith('job:recovered-03-09-123:snapshot:'));
                assert.equal(range.upper, `${range.lower}\uffff`);
                const getRequest = { result: null, onsuccess: null, onerror: null };
                const matching = records.filter(record => record.key >= range.lower && record.key <= range.upper);
                let index = 0;
                const advance = () => queueMicrotask(() => {
                  const record = matching[index++];
                  getRequest.result = record ? { key: record.key, value: record, continue: advance } : null;
                  getRequest.onsuccess?.();
                });
                advance();
                return getRequest;
              },
            }),
          }),
          close() {},
        };
        request.onsuccess?.();
      });
      return request;
    },
  };
  const previous = globalThis.indexedDB;
  const previousWindow = globalThis.window;
  const previousKeyRange = globalThis.IDBKeyRange;
  globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
  globalThis.indexedDB = fake;
  globalThis.window = { indexedDB: fake };
  return () => { globalThis.indexedDB = previous; globalThis.window = previousWindow; globalThis.IDBKeyRange = previousKeyRange; };
}

const { findMostRecentTakeoffSnapshotWithData } = await import('../components/construction-estimation/ai-plan-takeoff/jobPersistence.js');

const jobKey = 'job:recovered-03-09-123';
const emptyTakeoff = { updatedAt: '2026-01-01T00:00:00.000Z' };
const goodTakeoff = {
  takeoffId: 'takeoff-1788816093655', takeoffName: 'New Job 03/09',
  completedWallRuns: new Array(40).fill(0).map((_, i) => ({ id: `w${i}` })),
  placedOpenings: new Array(50).fill(0).map((_, i) => ({ id: `o${i}` })),
  completedFloorplans: new Array(6).fill(0).map((_, i) => ({ id: `f${i}` })),
  updatedAt: '2026-09-12T20:10:31.995Z',
};

// --- No snapshots exist at all for this job -------------------------------------------------
{
  const restore = installFakeIndexedDb([]);
  const result = await findMostRecentTakeoffSnapshotWithData(jobKey);
  restore();
  assert.equal(result.ok, false, 'No snapshots at all must not crash, and must report nothing found');
}

// --- Every snapshot is also empty ----------------------------------------------------------
{
  const restore = installFakeIndexedDb([
    { key: `${jobKey}:snapshot:revision-40-2026-09-12T20:10:50.280Z`, revision: 40, savedAt: '2026-09-12T20:10:50.280Z', workbook: { aiPlanTakeoffJob: emptyTakeoff } },
    { key: `${jobKey}:snapshot:revision-41-2026-09-12T20:11:09.504Z`, revision: 41, savedAt: '2026-09-12T20:11:09.504Z', workbook: { aiPlanTakeoffJob: emptyTakeoff } },
  ]);
  const result = await findMostRecentTakeoffSnapshotWithData(jobKey);
  restore();
  assert.equal(result.ok, false, 'Only-empty snapshots must not be offered as a recovery source');
}

// --- The exact live scenario: revision 39 has data, revisions 40/41 (later) do not ---------
{
  const restore = installFakeIndexedDb([
    { key: `${jobKey}:snapshot:revision-38-2026-09-12T20:10:12.853Z`, revision: 38, savedAt: '2026-09-12T20:10:12.853Z', workbook: { aiPlanTakeoffJob: emptyTakeoff } },
    { key: `${jobKey}:snapshot:revision-39-2026-09-12T20:10:31.995Z`, revision: 39, savedAt: '2026-09-12T20:10:31.995Z', workbook: { aiPlanTakeoffJob: goodTakeoff } },
    { key: `${jobKey}:snapshot:revision-40-2026-09-12T20:10:50.280Z`, revision: 40, savedAt: '2026-09-12T20:10:50.280Z', workbook: { aiPlanTakeoffJob: emptyTakeoff } },
    { key: `${jobKey}:snapshot:revision-41-2026-09-12T20:11:09.504Z`, revision: 41, savedAt: '2026-09-12T20:11:09.504Z', workbook: { aiPlanTakeoffJob: emptyTakeoff } },
    // A snapshot of a DIFFERENT job must never be picked up.
    { key: `job:some-other-job:snapshot:revision-99-2026-09-12T20:11:09.504Z`, revision: 99, savedAt: '2026-09-12T20:11:09.504Z', workbook: { aiPlanTakeoffJob: goodTakeoff } },
  ]);
  const result = await findMostRecentTakeoffSnapshotWithData(jobKey);
  restore();
  assert.equal(result.ok, true, 'Revision 39 (the one with data) must be found even though later revisions are empty');
  assert.equal(result.revision, 39, 'The most recent revision that actually HAS data is chosen, not merely the most recent snapshot');
  assert.equal(result.takeoffJob.takeoffId, 'takeoff-1788816093655');
  assert.equal(result.counts.walls, 40, 'Ground/Second/Third Level wall counts are recoverable (40 walls, matching the live count)');
  assert.equal(result.counts.openings, 50, 'Openings are recoverable (50, matching the live count)');
  assert.equal(result.counts.floorplans, 6, 'Floorplans - including the Patio area - are recoverable');
}

// --- Multiple good snapshots: the MOST RECENT one with data wins, not the oldest -----------
{
  const olderGood = { ...goodTakeoff, completedWallRuns: new Array(10).fill(0).map((_, i) => ({ id: `old-w${i}` })) };
  const restore = installFakeIndexedDb([
    { key: `${jobKey}:snapshot:revision-5-2026-09-01T00:00:00.000Z`, revision: 5, savedAt: '2026-09-01T00:00:00.000Z', workbook: { aiPlanTakeoffJob: olderGood } },
    { key: `${jobKey}:snapshot:revision-39-2026-09-12T20:10:31.995Z`, revision: 39, savedAt: '2026-09-12T20:10:31.995Z', workbook: { aiPlanTakeoffJob: goodTakeoff } },
  ]);
  const result = await findMostRecentTakeoffSnapshotWithData(jobKey);
  restore();
  assert.equal(result.revision, 39, 'The most recent good snapshot wins over an older one');
  assert.equal(result.counts.walls, 40, 'Its (newer, more complete) counts are the ones returned');
}

console.log('PASS findMostRecentTakeoffSnapshotWithData: no snapshots, all-empty snapshots, the exact live revision-39-survives-40-and-41-being-empty scenario, cross-job isolation, and most-recent-good-wins all behave correctly.');
