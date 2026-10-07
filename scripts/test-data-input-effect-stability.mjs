import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the actual restore effect across status rerenders. A rejected restore
// must not enqueue another read of the same workbook until a new job is opened.
const source = fs.readFileSync('components/estimate-builder/EstimateBuilderWorkbook.js', 'utf8');
const start = source.indexOf('    if (previewMode || mode || !sheet.hydrated || !openJobDetails.noJobOpen) return;');
const end = source.indexOf('\n  }, [', start);
assert.ok(start !== -1 && end > start);
let key = 'job:restore-failure';
let attempts = 0;
let state = { state: 'idle', key: '', message: '' };
const ref = { current: '' };
const sheet = { hydrated: true, restoreExplicitActiveJob: async () => { attempts++; throw new Error('Saved workbook normalization failed'); } };
const deps = {
  previewMode: false, mode: '', sheet, openJobDetails: { noJobOpen: true },
  window: { sessionStorage: { getItem: () => key }, localStorage: { getItem: () => key } },
  explicitJobRestoreAttemptRef: ref,
  navigationSheetRef: { current: sheet },
  setExplicitJobRestoreState: next => { state = next; },
};
const run = new Function(...Object.keys(deps), 'explicitJobRestoreState', source.slice(start, end));
for (let render = 0; render < 30; render++) {
  run(...Object.values(deps), state);
  await new Promise(resolve => setImmediate(resolve));
}
assert.equal(attempts, 1, 'Status and workbook rerenders must not repeatedly restore a failed job');
assert.equal(state.state, 'failed');
assert.match(state.message, /normalization failed/);
key = 'job:different-job';
run(...Object.values(deps), state);
await new Promise(resolve => setImmediate(resolve));
assert.equal(attempts, 2, 'A different explicit job gets its own restore attempt');
console.log('PASS failed restoration is bounded across 30 rerenders; errors stay visible and a different job can restore.');

// React may apply the updater after a newer edit was queued. An old deferred
// preview must not be fed back into that newer workbook.
const hook = fs.readFileSync('hooks/estimate-builder/useEstimateBuilderWorkbook.js', 'utf8').replace(/\r\n/g, '\n');
const syncStart = hook.indexOf('    if (previewMode) return;\n    // No calculation exists');
const syncEnd = hook.indexOf('\n  }, [', syncStart);
assert.ok(syncStart !== -1 && syncEnd > syncStart);
const calculated = { data: { area: 100 } };
const edited = { data: { area: 150 } };
let applied;
let syncs = 0;
const syncDeps = {
  previewMode: false, rawPreview: {}, preview: {}, deferredWorkbook: calculated,
  workbookRef: { current: calculated },
  updateWorkbookState: updater => { applied = updater(edited); },
  syncWindowDoorApproximateRates: value => { syncs++; return value; },
  syncEditableLinkedQuoteQuantities: value => { syncs++; return value; },
};
new Function(...Object.keys(syncDeps), hook.slice(syncStart, syncEnd))(...Object.values(syncDeps));
assert.equal(applied, edited);
assert.equal(syncs, 0);
console.log('PASS stale deferred calculations cannot rewrite a newer workbook edit.');

// Finish a history read after navigation or a manual takeoff update. Neither
// may be overwritten by the recovery request started from the old state.
const recoveryStart = source.indexOf('    if (previewMode || !sheet.hydrated || openJobDetails.noJobOpen) return;');
const recoveryEnd = source.indexOf('\n  }, [', recoveryStart);
assert.ok(recoveryStart !== -1 && recoveryEnd > recoveryStart);
for (const scenario of ['same-job', 'different-job', 'new-takeoff']) {
  let completeRead;
  let reads = 0;
  const saved = [];
  const measuredTakeoff = { walls: ['recovered-wall'] };
  const liveSheet = { hydrated: true, workbook: { jobId: 'original', takeoff: {} }, saveAiPlanTakeoffJob: async job => { saved.push(job); } };
  const liveRef = { current: liveSheet };
  const recoveryDeps = {
    previewMode: false, sheet: liveSheet, openJobDetails: { noJobOpen: false },
    attachedTakeoffJob: liveSheet.workbook.takeoff, takeoffRecoveryJobKey: 'job:original',
    takeoffRecoveryAttemptRef: { current: '' }, navigationSheetRef: liveRef,
    hasMeasurableTakeoffData: job => Boolean(job?.walls?.length),
    selectAiPlanTakeoffJob: book => book.takeoff,
    findMostRecentTakeoffSnapshotWithData: () => {
      reads++;
      return new Promise(resolve => { completeRead = resolve; });
    },
  };
  const recover = new Function(...Object.keys(recoveryDeps), source.slice(recoveryStart, recoveryEnd));
  for (let render = 0; render < 30; render++) recover(...Object.values(recoveryDeps));
  assert.equal(reads, 1, 'Rerenders must not start parallel history reads');
  if (scenario === 'different-job') liveRef.current = { ...liveSheet, workbook: { jobId: 'another', takeoff: {} } };
  if (scenario === 'new-takeoff') liveRef.current = { ...liveSheet, workbook: { jobId: 'original', takeoff: { walls: ['new-user-wall'] } } };
  completeRead({ ok: true, takeoffJob: measuredTakeoff });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(saved, scenario === 'same-job' ? [measuredTakeoff] : []);
}
console.log('PASS recovery runs once and cannot overwrite a different job or a newer takeoff.');
