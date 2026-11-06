import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAiTakeoffBridge, AI_TAKEOFF_COLLECTIONS } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffBridge.js';
import { createAiTakeoffDevelopmentFixture } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/developmentFixture.js';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://takeoff.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const emptyCollections = () => Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []]));
const manualWall = { id: 17, page: 1, nodes: [{ x: 20, y: 30 }, { x: 50, y: 30 }], category: 'interior', thicknessMm: 70, alignment: 'outer', lengthMm: 300 };
const pages = [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800, dataUrl: 'data:image/png;base64,test-plan-content' }];
const settings = () => ({ jobId: 'job-1', takeoffId: 'takeoff-1', pixelsPerMm: 0.1, planPages: pages, lifecycle: { hydrationVersion: 0 }, readOnly: false });
let options = settings();
let initialCollections = { ...emptyCollections(), completedWallRuns: [manualWall] };
let observed;
const dirtyReasons = [];

function Harness() {
  const [collections, setCollections] = useState(initialCollections);
  const setters = Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, (update) => setCollections((previous) => ({ ...previous, [key]: update(previous[key]) }))]));
  const bridge = useAiTakeoffBridge({ ...options, collections, setters, markCompleted: (reason) => dirtyReasons.push(reason) });
  observed = { bridge, collections, setCollections };
  return null;
}

let root = createRoot(document.getElementById('root'));
const render = () => act(() => root.render(React.createElement(Harness)));
const replace = (next) => act(() => observed.setCollections(next));
const batchFor = async (runId) => ({ ...createAiTakeoffDevelopmentFixture(await observed.bridge.getContext(), 1), runId });

try {
  await render();
  const before = structuredClone(observed.collections);
  const firstBatch = await batchFor('run-1');
  let results;
  await act(async () => { results = await Promise.all([observed.bridge.appendDetections(firstBatch), observed.bridge.appendDetections(firstBatch)]); });
  assert.deepEqual(results.map((result) => result.status).sort(), ['appended', 'duplicate']);
  assert.equal(observed.collections.completedWallRuns.length, 4);
  assert.equal(observed.collections.placedOpenings.length, 1);
  assert.deepEqual(observed.collections.completedWallRuns[0], before.completedWallRuns[0], 'manual wall remains byte-for-byte unchanged');
  assert.deepEqual(dirtyReasons, ['ai-takeoff-import']);
  assert.equal(observed.bridge.appliedRuns.length, 1);

  const secondBatch = await batchFor('run-2');
  const queuedManualWall = { ...manualWall, id: 18 };
  await act(async () => {
    const pending = observed.bridge.appendDetections(secondBatch);
    observed.setCollections((previous) => ({ ...previous, completedWallRuns: [...previous.completedWallRuns, queuedManualWall] }));
    secondBatch.detections[0].nodes[0].x = 0.99;
    assert.equal((await pending).status, 'appended');
  });
  assert.ok(observed.collections.completedWallRuns.some((item) => item.id === 18), 'manual append queued during verification survives');
  assert.equal(observed.collections.completedWallRuns.find((item) => item.ai?.runId === 'run-2').nodes[0].x, 200, 'caller mutation after submission cannot alter admitted geometry');

  const beforeInvalid = structuredClone(observed.collections);
  const invalidBatch = await batchFor('invalid');
  invalidBatch.detections[3].hostDetectionId = 'missing-wall';
  await assert.rejects(observed.bridge.appendDetections(invalidBatch), /hostDetectionId/);
  assert.deepEqual(observed.collections, beforeInvalid, 'invalid batch performs no partial append');
  assert.equal(observed.bridge.appliedRuns.length, 2);

  const staleBatch = await batchFor('stale');
  const pendingStale = observed.bridge.appendDetections(staleBatch);
  options.lifecycle.hydrationVersion += 1;
  await assert.rejects(pendingStale, /changed/);
  assert.deepEqual(observed.collections, beforeInvalid, 'a hydration change during verification leaves state untouched');

  const cancelledBatch = await batchFor('cancelled');
  const abort = new AbortController();
  const pendingCancelled = observed.bridge.appendDetections(cancelledBatch, { signal: abort.signal });
  abort.abort();
  await assert.rejects(pendingCancelled, (error) => error.name === 'AbortError');
  assert.deepEqual(observed.collections, beforeInvalid, 'cancellation while document hashing leaves manual and AI objects untouched');
  assert.equal(observed.bridge.appliedRuns.length, 2, 'cancelled import does not create a durable receipt');
  await assert.rejects(observed.bridge.appendDetections(cancelledBatch, { signal: abort.signal }), (error) => error.name === 'AbortError');

  const readOnlyBatch = await batchFor('readonly');
  const pendingReadOnly = observed.bridge.appendDetections(readOnlyBatch);
  const rejectedReadOnly = assert.rejects(pendingReadOnly, /changed|editable/);
  options = { ...options, readOnly: true };
  await render();
  await rejectedReadOnly;
  assert.deepEqual(observed.collections, beforeInvalid, 'becoming read-only during verification blocks the entire batch');
  options = { ...options, readOnly: false };
  await render();

  const receipts = structuredClone(observed.bridge.appliedRuns);
  await replace({ ...emptyCollections(), completedWallRuns: [manualWall] });
  await act(() => root.unmount());
  initialCollections = { ...emptyCollections(), completedWallRuns: [manualWall] };
  options = settings();
  root = createRoot(document.getElementById('root'));
  await render();
  await act(() => observed.bridge.restoreAppliedRuns(receipts));
  let reopened;
  await act(async () => { reopened = await observed.bridge.appendDetections(firstBatch); });
  assert.deepEqual(reopened, { status: 'duplicate', added: 0 });
  assert.deepEqual(observed.collections, initialCollections, 'restored receipts suppress replay even after all AI objects were deleted');

  await act(() => observed.bridge.restoreAppliedRuns());
  assert.deepEqual(observed.bridge.appliedRuns, [], 'new-workspace reset clears only the run receipts');
  assert.deepEqual(observed.collections, initialCollections);
  // A corrected rerun atomically replaces automatic objects and retains hand traces.
  await replace({ ...emptyCollections(), completedWallRuns: [manualWall, { ...manualWall, id: 'old-ai', source: 'ai', ai: { runId: 'ai-takeoff-v1' } }] });
  const repaired = await batchFor('ai-takeoff-v2-validated-scope');
  const beforeRejection = structuredClone(observed.collections);
  await act(async () => {
    await assert.rejects(observed.bridge.appendDetections({ ...repaired, geometryValidation: { passed: false } }, { replaceAnalysis: true }), /validation failed/);
  });
  assert.deepEqual(observed.collections, beforeRejection, 'a failed rerun preserves the previous model');
  await act(async () => { await observed.bridge.appendDetections({ ...repaired, geometryValidation: { passed: true } }, { replaceAnalysis: true }); });
  assert.equal(observed.collections.completedWallRuns.length, 4);
  assert.deepEqual(observed.collections.completedWallRuns[0], manualWall);
  assert.ok(!observed.collections.completedWallRuns.some((w) => w.id === 'old-ai'));
  await act(async () => { await observed.bridge.appendDetections({ ...repaired, geometryValidation: { passed: true } }, { replaceAnalysis: true }); });
  assert.equal(observed.collections.completedWallRuns.length, 4, 'a corrected rerun never accumulates duplicate geometry');
  console.log('AI Takeoff bridge runtime checks passed: atomic rejection, concurrent dedupe, manual coexistence, async guards, immutable submission and receipt restoration.');
} finally {
  await act(() => root.unmount());
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
}
