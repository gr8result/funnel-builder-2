import assert from 'node:assert/strict';
import { getTakeoffLifecycle, loadTakeoffPlanImage } from '../components/construction-estimation/ai-plan-takeoff/takeoffLifecycle.js';

const pages = [
  { pageNumber: 3, dataUrl: 'data:image/png;base64,sheet3', dataUrlAssetId: 'asset3', vectorSegments: [{ id: 'sheet3-line' }] },
  { pageNumber: 4, dataUrl: 'data:image/png;base64,sheet4', dataUrlAssetId: 'asset4', vectorSegments: [{ id: 'sheet4-line' }] },
];
const options = { pages, pageNumber: 3, pdfDoc: null, image: null, openRequest: null, openedTakeoffId: '' };
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
function fixture() {
  const lifecycle = getTakeoffLifecycle({}, options);
  const applied = [];
  const events = [];
  lifecycle.log = (event, details) => events.push({ event, ...details });
  return { lifecycle, applied, events, apply: (image, segments) => applied.push({ image, segments }) };
}

// A single mounted component retains its request/identity bookkeeping on render.
const owner = { current: false };
const retained = getTakeoffLifecycle(owner, options);
retained.hydrationVersion = 7;
assert.equal(getTakeoffLifecycle(owner, { ...options, pageNumber: 4 }), retained);
assert.equal(retained.hydrationVersion, 7, 'Rerender must not recreate hydration bookkeeping');
const refreshedHelper = await import('../components/construction-estimation/ai-plan-takeoff/takeoffLifecycle.js?refresh-regression');
const retainedAfterHelperRefresh = refreshedHelper.getTakeoffLifecycle(owner, options);
assert.equal(retainedAfterHelperRefresh, retained, 'Reloading the helper module must retain the exact mounted controller');
assert.equal(retainedAfterHelperRefresh.instanceId, retained.instanceId, 'Helper refresh must not appear as a new component instance');
assert.equal(retainedAfterHelperRefresh.hydrationVersion, 7);
assert.equal(owner.current, false, 'Lifecycle bookkeeping must not alter the existing ref value');
const remounted = getTakeoffLifecycle({ current: false }, options);
assert.notEqual(remounted, retained);
assert.notEqual(remounted.instanceId, retained.instanceId, 'A new mounted owner has a distinguishable lifecycle');

// Install the guard into an already-open workspace without decoding or reopening it.
const existingImage = { name: 'already displayed sheet 3' };
const openRequest = { requestId: 'open-takeoff-42', jobData: { takeoffId: 'takeoff-42' } };
const adopted = getTakeoffLifecycle({}, { ...options, image: existingImage, openRequest, openedTakeoffId: 'takeoff-42' });
assert.deepEqual(adopted.displayedPlanRef.current, { pageNumber: 3, asset: 'asset3' });
assert.equal(adopted.handledOpenTakeoffRequestRef.current, openRequest.requestId);
assert.equal(await loadTakeoffPlanImage(adopted, pages[0], 3,
  () => assert.fail('Adopting a displayed image must not decode it again'),
  () => assert.fail('Adopting a displayed image must not replace the current image')), existingImage);
const legacyRequest = { jobData: { takeoffId: 'legacy-takeoff' } };
const adoptedLegacy = getTakeoffLifecycle({}, { ...options, image: existingImage, openRequest: legacyRequest, openedTakeoffId: 'legacy-takeoff' });
assert.equal(adoptedLegacy.handledOpenTakeoffRequestRef.current, legacyRequest, 'Legacy requests retain object identity');

// Hydration, the page effect and recovery may request the same image together.
{
  const { lifecycle, applied, apply } = fixture();
  const pending = deferred();
  let decodes = 0;
  const decode = () => { decodes += 1; return pending.promise; };
  const first = loadTakeoffPlanImage(lifecycle, pages[0], 3, decode, apply);
  const second = loadTakeoffPlanImage(lifecycle, { ...pages[0] }, 3, decode, apply);
  assert.equal(first, second, 'Concurrent same-page requests share one promise');
  await Promise.resolve();
  assert.equal(decodes, 1);
  const decodedImage = { name: 'sheet 3' };
  pending.resolve(decodedImage);
  await first;
  assert.deepEqual(applied, [{ image: decodedImage, segments: pages[0].vectorSegments }]);
  assert.equal(await loadTakeoffPlanImage(lifecycle, pages[0], 3, decode, apply), decodedImage);
  assert.equal(decodes, 1, 'Effect replay after completion must not decode again');
  assert.equal(applied.length, 1, 'Effect replay after completion must not replace the image');
}

// A slower old page must not overwrite the sheet selected more recently.
{
  const { lifecycle, applied, events, apply } = fixture();
  const oldPage = deferred();
  const newPage = deferred();
  const oldRequest = loadTakeoffPlanImage(lifecycle, pages[0], 3, () => oldPage.promise, apply);
  const newRequest = loadTakeoffPlanImage(lifecycle, pages[1], 4, () => newPage.promise, apply);
  const currentImage = { name: 'sheet 4' };
  newPage.resolve(currentImage);
  await newRequest;
  oldPage.resolve({ name: 'obsolete sheet 3' });
  await oldRequest;
  assert.deepEqual(applied, [{ image: currentImage, segments: pages[1].vectorSegments }]);
  assert.ok(events.some((event) => event.event === 'plan-asset-load-superseded' && event.page === 3));
}

// Clearing a plan invalidates any pending decode, so it cannot restore an old background.
{
  const { lifecycle, applied, apply } = fixture();
  const pending = deferred();
  const request = loadTakeoffPlanImage(lifecycle, pages[0], 3, () => pending.promise, apply);
  await loadTakeoffPlanImage(lifecycle, null, 3, () => assert.fail('Missing pages have nothing to decode'), apply);
  pending.resolve({ name: 'obsolete image' });
  await request;
  assert.equal(lifecycle.imageRequest, null);
  assert.deepEqual(applied, [{ image: null, segments: [] }]);
}

// A failed decode must release its promise, allowing a later retry to succeed.
{
  const { lifecycle, applied, apply } = fixture();
  const failure = new Error('synthetic image decode failure');
  await assert.rejects(loadTakeoffPlanImage(lifecycle, pages[0], 3, () => Promise.reject(failure), apply), failure);
  assert.equal(lifecycle.imageRequest, null);
  const image = { name: 'successful retry' };
  assert.equal(await loadTakeoffPlanImage(lifecycle, pages[0], 3, () => Promise.resolve(image), apply), image);
  assert.deepEqual(applied, [{ image, segments: pages[0].vectorSegments }]);
}

console.log('Takeoff plan image lifecycle checks passed: decode deduplication, stale completion rejection, plan clearing, failure retry, retained owner across module refresh, remount identity, and existing-workspace adoption.');
