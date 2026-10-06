import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the production effect; stub only its external hydration/checksum boundary.
// This simulates effect replay, not a browser reload or the reported lost 15.39 m.
const path = new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url);
const source = readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const effects = [];
const initialEffects = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
    const callback = node.arguments[0];
    if (callback?.getText(ast).includes('const incomingJob = openTakeoffJobRequest.jobData')) effects.push(callback.getText(ast));
    if (callback?.getText(ast).includes('if (loadedInitialJobRef.current || !initialJob) return;')) initialEffects.push(callback.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(effects.length, 1, 'Find the actual explicit takeoff-open effect');
assert.equal(initialEffects.length, 1, 'Find the actual initial takeoff-restore effect');

const savedJob = { takeoffId: 'takeoff-a', completedEaves: [{ id: 'saved-eave', nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }] };
const request = { requestId: 'open-1', displayName: 'Synthetic saved takeoff', jobData: savedJob };
const state = { eavePoints: [], completedEaves: [], activeTool: 'eaves', currentPage: 3, stageScale: 2, stagePos: { x: 80, y: 90 } };
const loads = [];
const pending = [];
const env = {
  openTakeoffJobRequest: request,
  openedTakeoffJob: { takeoffId: '' },
  handledOpenTakeoffRequestRef: { current: null },
  logTakeoffRefresh: () => {},
  lastSeenContentChecksumRef: { current: '' },
  checksumForTakeoffContent: (data) => JSON.stringify(data.completedEaves),
  normaliseRecoveredPlanPages: (pages) => pages,
  getEmbeddedPlanPages: () => [],
  getSavedFloorCoveringAreas: (job) => job.completedAreas || [],
  reportPlanLoadFailure: (error) => { throw error; },
  openTakeoffJob: (job) => {
    loads.push(job.takeoffId);
    // Hydration owns these setters in production. Any unwanted invocation loses drafts.
    state.eavePoints = [];
    state.completedEaves = structuredClone(job.completedEaves);
    state.currentPage = 1;
    state.stageScale = 1;
    state.stagePos = { x: 0, y: 0 };
    env.openedTakeoffJob = { takeoffId: job.takeoffId };
    env.lastSeenContentChecksumRef.current = JSON.stringify(job.completedEaves);
    return new Promise((resolve) => pending.push(resolve));
  },
  console,
  alert: (message) => { throw new Error(message); },
};
const execute = new Function(...Object.keys(env), `return (${effects[0]})();`);
const replay = () => execute(...Object.values(env));
replay();
assert.equal(loads.length, 1, 'A new explicit request loads its saved takeoff');
state.eavePoints = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
state.completedEaves.push({ id: 'new-completed-eave' });
state.currentPage = 3;
state.stageScale = 2;
state.stagePos = { x: 80, y: 90 };
env.lastSeenContentChecksumRef.current = 'changed-by-live-measurements';
const live = structuredClone(state);
replay();
assert.equal(loads.length, 1, 'Replaying an already handled open request must not rehydrate stale saved data');
assert.deepEqual(state, live, 'Effect replay preserves active eave points, completed eaves, tool, page, zoom and pan');

env.openTakeoffJobRequest = { ...request };
replay();
assert.equal(loads.length, 1, 'A new prop object with the same requestId is still the same open command');
assert.deepEqual(state, live);
pending.shift()();
await Promise.resolve();
replay();
assert.equal(loads.length, 1, 'Settling the original load must not re-arm its request');

env.openTakeoffJobRequest = { ...request, requestId: 'open-2' };
replay();
assert.equal(loads.length, 2, 'A new explicit requestId can intentionally reopen the same takeoff');
state.eavePoints = [{ x: 5, y: 6 }];
env.lastSeenContentChecksumRef.current = 'edits-during-pending-load';
env.openTakeoffJobRequest = { ...env.openTakeoffJobRequest };
replay();
assert.equal(loads.length, 2, 'Consume request identity before asynchronous hydration finishes');
assert.deepEqual(state.eavePoints, [{ x: 5, y: 6 }]);
pending.shift()();
await Promise.resolve();

env.openTakeoffJobRequest = { requestId: 'open-3', jobData: { ...savedJob, takeoffId: 'takeoff-b' } };
replay();
assert.deepEqual(loads, ['takeoff-a', 'takeoff-a', 'takeoff-b'], 'A different requested takeoff still opens');
pending.shift()();
await Promise.resolve();
env.openTakeoffJobRequest = null;
replay();
assert.equal(loads.length, 3, 'No request does not load anything');

let resolveInitial;
let rejectInitial;
let materializations = 0;
const initialLoads = [];
const initialEnv = {
  loadedInitialJobRef: { current: false },
  initialJob: savedJob,
  takeoffLifecycle: { hydrationVersion: 0 },
  platformContext: { projectName: '' },
  materializeTakeoffPlanPages: () => {
    materializations += 1;
    return new Promise((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; });
  },
  hasRecoverablePlanPages: () => true,
  getEmbeddedPlanPages: () => [{ pageNumber: 1, dataUrlAssetId: 'asset-1' }],
  logTakeoffPlanLoad: () => {},
  reportPlanLoadFailure: () => {},
  // Mirrors the production boundary: read the plan assets, then abandon the restore if a newer
  // open took ownership of the workspace while that read was in flight.
  openTakeoffJob: (job) => {
    const version = initialEnv.takeoffLifecycle.hydrationVersion;
    return initialEnv.materializeTakeoffPlanPages().then(() => {
      if (version !== initialEnv.takeoffLifecycle.hydrationVersion) return;
      initialLoads.push(job.takeoffId);
      initialEnv.takeoffLifecycle.hydrationVersion += 1;
    });
  },
  console: { error: () => {} },
  logTakeoffRefresh: () => {},
};
const executeInitial = new Function(...Object.keys(initialEnv), `return (${initialEffects[0]})();`);
const restoreInitial = () => executeInitial(...Object.values(initialEnv));
const settle = () => new Promise((resolve) => setImmediate(resolve));
restoreInitial();
initialEnv.takeoffLifecycle.hydrationVersion += 1; // A later explicit open owns the workspace.
resolveInitial({ aiPlanTakeoffJob: savedJob });
await settle();
assert.equal(initialLoads.length, 0, 'Late initial materialization must not replace a later explicit open');

initialEnv.loadedInitialJobRef.current = false;
restoreInitial();
initialEnv.takeoffLifecycle.hydrationVersion += 1;
rejectInitial(new Error('Old materialization failed after another job opened'));
await settle();
assert.equal(initialEnv.loadedInitialJobRef.current, true, 'A stale initial rejection must not re-arm startup hydration');
restoreInitial();
assert.equal(materializations, 2, 'Replaying effects after stale rejection must not start loading the old job again');

initialEnv.loadedInitialJobRef.current = false;
restoreInitial();
resolveInitial({ aiPlanTakeoffJob: savedJob });
await settle();
assert.deepEqual(initialLoads, ['takeoff-a'], 'Normal first restoration still loads when no later operation supersedes it');

console.log('Takeoff open-request replay checks passed: actual effects consume requestId once, preserve live drafts/completed state, permit intentional opens, and ignore superseded initial restoration success or failure.');
console.log('This proves the guarded state-hydration path; it does not establish whether the reported 15.39 m was lost through it.');
