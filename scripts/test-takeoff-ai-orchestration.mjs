import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { webcrypto } from 'node:crypto';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { createJobData, createTakeoffContentChecksum, verifyAiPlanTakeoffSavedJob, prepareAiPlanTakeoffJobForSave } from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// Transport/image decoding are controlled here; orchestration, normalization,
// canonical admission, React state, provenance and checksums are real modules.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://takeoff-unit.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-only';
const dom = new JSDOM('<div id="root"></div>', { url: 'https://takeoff-unit.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 1);
if (!globalThis.crypto) globalThis.crypto = webcrypto;
globalThis.Image = class { naturalWidth = 1000; naturalHeight = 800; async decode() {} };
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tag, ...args) => tag === 'canvas' ? {
  width: 1, height: 1, getContext: () => ({ fillRect() {}, translate() {}, rotate() {}, drawImage() {}, measureText: () => ({ width: 12 }), fillText() {}, beginPath() {}, lineTo() {}, moveTo() {}, closePath() {}, stroke() {}, arc() {} }),
  toDataURL: () => 'data:image/jpeg;base64,unit-test-image',
} : originalCreateElement(tag, ...args);
const { supabase } = await import('../utils/supabase-client.js');
supabase.auth.getSession = async () => ({ data: { session: { access_token: 'unit-only-not-a-real-token' } } });
const { useAiTakeoffAnalysis } = await import('../components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffAnalysis.js');
const { useAiTakeoffBridge, AI_TAKEOFF_COLLECTIONS } = await import('../components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffBridge.js');

const originalFetch = globalThis.fetch;
const calls = [];
// The plan-set evidence pass (one request over every sheet, before measurement) is recorded
// separately so the per-sheet request sequences below stay exact.
const evidenceCalls = [];
const emptyEvidence = { page: 1, levels: [], openingSchedule: [], windowCodeConvention: { order: 'unknown', basis: 'ASSUMED', confidence: 0, evidence: '' },
  standardDoorHeight: { valueMm: null, basis: 'ASSUMED', confidence: 0, evidence: '' }, eaveWidth: { valueMm: null, basis: 'ASSUMED', confidence: 0, evidence: '' },
  roofPitch: { degrees: null, basis: 'ASSUMED', confidence: 0, evidence: '' }, notes: [], review: [] };
const page = { pageNumber: 1, logicalWidth: 1000, logicalHeight: 800, dataUrl: 'data:image/png;base64,unit', pdfUnits: true };
const observedEvidence = { basis: 'OBSERVED', confidence: 0.95, evidence: 'Visible drawing line.' };
const inspection = { page: 1, drawingType: 'floor-plan', relevant: true, level: 'Ground Floor', rotationToUpright: 0,
  scale: { denominator: 100, ...observedEvidence }, writtenDimensions: [], review: [] };
const measurement = { page: 1, level: 'Ground Floor', walls: [{ detectionId: 'wall', page: 1, category: 'exterior', nodes: [{ x: .1, y: .2 }, { x: .6, y: .2 }], thicknessMm: 230, exteriorType: 'Face Brick Veneer', wallHeightM: 2.7, ...observedEvidence }],
  openings: [], buildingAreas: [], pillars: [], eaves: [], rooms: [{ name: 'Kitchen', ...observedEvidence }], fixtures: [], documentedQuantities: [], review: [] };
let getResponse = async (payload) => payload.action === 'inspect' ? inspection : measurement;
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/ai/takeoff-analyse');
  const payload = JSON.parse(options.body);
  if (payload.action === 'evidence') {
    evidenceCalls.push(payload);
    return { ok: true, status: 200, json: async () => ({ ok: true, provider: 'openai', model: 'unit-model', requestId: 'unit-evidence', analysis: emptyEvidence }) };
  }
  calls.push(payload);
  const response = await getResponse(payload);
  // A failure response as the route returns it: status, JSON body and headers.
  if (response?.failure) return { ok: false, status: response.failure.status, headers: { get: (name) => response.failure.headers?.[name] ?? null }, json: async () => ({ ok: false, ...response.failure.body }) };
  // Like the real route, a scoped measure/refine returns only its own collections.
  const scopeEmpty = { geometry: ['openings', 'rooms', 'fixtures', 'documentedQuantities'], items: ['walls', 'buildingAreas', 'pillars', 'eaves'] }[payload.measurementScope] || [];
  const analysis = payload.action === 'inspect' ? response : { pillars: [], eaves: [], ...response, ...Object.fromEntries(scopeEmpty.map((key) => [key, []])) };
  return { ok: true, status: 200, json: async () => ({ ok: true, provider: 'openai', model: 'unit-model', requestId: 'unit-request', analysis }) };
};
let configuration = { jobId: 'unit-job', takeoffId: 'unit-takeoff', planPages: [page], lifecycle: { hydrationVersion: 0 }, readOnly: false };
let current;
const dirty = [];
function Harness() {
  const [pixelsPerMm, setPixelsPerMm] = useState(null);
  const [collections, setCollections] = useState(Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []])));
  const bridge = useAiTakeoffBridge({ ...configuration, pixelsPerMm, collections,
    setters: Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, (update) => setCollections((previous) => ({ ...previous, [key]: update(previous[key]) }))])),
    markCompleted: (reason) => dirty.push(reason) });
  const analysis = useAiTakeoffAnalysis({ ...configuration, pixelsPerMm, setPixelsPerMm: (value) => flushSync(() => setPixelsPerMm(value)), bridge,
    objectCount: Object.values(collections).reduce((sum, items) => sum + items.length, 0), markCompleted: (reason) => dirty.push(reason) });
  current = { analysis, bridge, pixelsPerMm, collections, setPixelsPerMm, setCollections };
  return null;
}
const root = createRoot(document.getElementById('root'));
const render = () => act(() => root.render(React.createElement(Harness)));
try {
  await render();
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'scale');
  assert.equal(calls.length, 1, 'Scale confirmation happens before measurement request.');
  assert.equal(current.pixelsPerMm, null, 'Inspection does not silently calibrate.');
  await act(() => current.analysis.confirmScale());
  assert.equal(current.analysis.stage, 'complete', current.analysis.message);
  assert.deepEqual(calls.slice(1).map((item) => `${item.action}:${item.measurementScope}`), ['measure:geometry', 'measure:items', 'refine:geometry', 'refine:items'], 'Measurement halves run one at a time, then their geometry review halves.');
  assert.equal(evidenceCalls.length, 1, 'The whole plan set is read for evidence once, before any sheet is measured.');
  assert.ok(calls.slice(1).every((item) => item.planEvidence && typeof item.planEvidence === 'object'), 'Every measurement and refinement request carries the plan-set evidence.');
  assert.equal(current.collections.completedWallRuns.length, 1);
  assert.equal(current.collections.completedWallRuns[0].source, 'ai');
  assert.equal(current.collections.completedWallRuns[0].ai.analysisEvidence.basis, 'OBSERVED');
  assert.equal(current.analysis.report.rooms[0].name, 'Kitchen');
  await act(() => current.analysis.run());
  assert.equal(calls.length, 5, 'An already admitted run never repeats a paid analysis.');
  configuration = { ...configuration, jobId: 'newly-attached-project' };
  await render();
  await act(() => current.analysis.run());
  assert.equal(calls.length, 5, 'Attaching the same takeoff to a project cannot duplicate its existing AI run.');
  configuration = { ...configuration, jobId: 'unit-job' };
  await render();

  const report = structuredClone(current.analysis.report);
  const job = createJobData({ name: 'test', planPages: [page], pixelsPerMm: current.pixelsPerMm, ...current.collections,
    scheduleState: { aiAppliedRuns: current.bridge.appliedRuns, aiAnalysis: report } });
  assert.equal(verifyAiPlanTakeoffSavedJob(job, structuredClone(job)).ok, true);
  const lostEvidence = structuredClone(job);
  delete lostEvidence.scheduleState.aiAnalysis;
  assert.notEqual(createTakeoffContentChecksum(lostEvidence), createTakeoffContentChecksum(job), 'Saved review evidence participates in normal checksum verification.');
  const prepared = prepareAiPlanTakeoffJobForSave(null, job, 'unit-job').job;
  const replacement = prepareAiPlanTakeoffJobForSave(prepared, { ...prepared, baseRevision: prepared.revision,
    scheduleState: { ...prepared.scheduleState, aiAppliedRuns: [], aiAnalysis: null } }, 'unit-job').job;
  assert.deepEqual(replacement.scheduleState.aiAppliedRuns, [], 'Replacement plan receipts stay cleared through the existing save merge.');
  assert.equal(replacement.scheduleState.aiAnalysis, null, 'Replacement plan cannot resurrect the old analysis report.');
  await act(() => current.analysis.restoreReport(report));
  assert.deepEqual(current.analysis.report, report);

  await act(() => { current.analysis.restoreReport(); current.bridge.restoreAppliedRuns(); });
  const before = structuredClone(current.collections);
  let release;
  getResponse = async () => new Promise((resolve) => { release = resolve; });
  let running;
  await act(async () => { running = current.analysis.run(); while (!release) await new Promise((resolve) => setTimeout(resolve, 1)); });
  await act(() => current.analysis.cancel());
  await act(async () => { release(inspection); await running; });
  assert.deepEqual(current.collections, before, 'Cancelled analysis never inserts late provider results.');

  getResponse = async () => new Promise((resolve) => { release = resolve; });
  release = null;
  await act(async () => { running = current.analysis.run(); while (!release) await new Promise((resolve) => setTimeout(resolve, 1)); });
  configuration = { ...configuration, jobId: 'another-job' };
  await render();
  await act(async () => { release(inspection); await running; });
  assert.equal(current.analysis.stage, 'error');
  assert.deepEqual(current.collections, before, 'Job switches prevent admission of previous-page responses.');

  configuration = { ...configuration, jobId: 'unit-job' };
  await render();
  await act(() => current.analysis.restoreReport());
  getResponse = async (payload) => payload.action === 'inspect'
    ? { ...inspection, scale: { denominator: null, ...observedEvidence } }
    : { ...measurement, walls: [], review: ['No wall boundary could be established reliably.'] };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'review', current.analysis.message);
  assert.equal(current.analysis.report.added, 0);
  assert.ok(current.analysis.report.review.some((item) => /No wall boundary/.test(item.message)));
  assert.deepEqual(current.collections, before, 'Zero accepted geometry preserves manual state and keeps review evidence.');

  await act(() => current.analysis.restoreReport());
  getResponse = async (payload) => {
    if (payload.action === 'inspect') return inspection;
    throw new Error('The AI provider rejected the analysis request (HTTP 500). No measurements were inserted.');
  };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'error', 'All measured sheets failing is an error, not a review-only result.');
  assert.match(current.analysis.message, /could not measure the plan.*HTTP 500/, 'The actual provider error is shown in the status message.');
  assert.equal(current.analysis.report, null, 'A failed measurement does not publish an empty takeoff report.');
  assert.deepEqual(current.collections, before, 'Failed measurement preserves existing state.');

  await act(() => {
    current.analysis.restoreReport(); current.bridge.restoreAppliedRuns();
    current.setCollections(Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []])));
    current.setPixelsPerMm(.03);
  });
  getResponse = async (payload) => {
    if (payload.action === 'inspect') return inspection;
    if (payload.action === 'refine') throw new Error('Provider geometry check timed out');
    return measurement;
  };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'complete', current.analysis.message);
  assert.equal(current.pixelsPerMm, .03, 'Existing calibrated scale is used without another confirmation gate.');
  assert.equal(current.collections.completedWallRuns.length, 1, 'A failed optional refinement cannot discard a valid measured page.');
  assert.ok(current.analysis.report.review.some((item) => item.code === 'refinement-failed'));

  configuration = { ...configuration, planPages: [page, { ...page, pageNumber: 2 }] };
  await render();
  await act(() => {
    current.analysis.restoreReport(); current.bridge.restoreAppliedRuns();
    current.setCollections(Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []])));
  });
  const duplicateStart = calls.length;
  getResponse = async (payload) => payload.action === 'inspect'
    ? { ...inspection, page: payload.page.pageNumber }
    : { ...measurement, page: payload.page.pageNumber };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'complete', 'A second presentation of the same floor must not abort the full takeoff.');
  assert.deepEqual(calls.slice(duplicateStart).filter((item) => item.action === 'measure' && item.measurementScope === 'geometry').map((item) => item.page.pageNumber), [1]);
  assert.equal(current.collections.completedWallRuns.length, 1, 'Duplicate floor presentations are not counted twice.');
  assert.ok(current.analysis.report.review.some((item) => item.code === 'duplicate-level'));

  await act(() => {
    current.analysis.restoreReport(); current.bridge.restoreAppliedRuns();
    current.setCollections(Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []])));
  });
  getResponse = async (payload) => {
    if (payload.action === 'inspect' && payload.page.pageNumber === 2) throw Object.assign(new Error('Supporting page connection failed'), { status: 502 });
    return payload.action === 'inspect' ? inspection : measurement;
  };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'complete');
  assert.equal(current.collections.completedWallRuns.length, 1, 'A failed supporting-page inspection cannot discard a successfully inspected floor plan.');
  assert.ok(current.analysis.report.review.some((item) => item.code === 'inspection-failed'));

  // ---- Request efficiency: context, inspection cache, half retries, retry-after, hard stops ----
  const emptyCollections = () => Object.fromEntries(AI_TAKEOFF_COLLECTIONS.map((key) => [key, []]));
  const resetRun = (savedInspections = null) => act(() => {
    current.analysis.restoreReport(null, savedInspections); current.bridge.restoreAppliedRuns(); current.setCollections(emptyCollections());
  });
  const providerFailure = (status, code, error, retryAfterSeconds) => ({ failure: { status, body: { code, error, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) } } });
  const elevation = { ...page, pageNumber: 2, textItems: [{ text: 'W01', x: 10, y: 5, height: 4 }, { text: '1200H x 1800W', x: 60, y: 6, height: 4 }, { text: 'W02', x: 10, y: 20, height: 4 }] };
  configuration = { ...configuration, planPages: [page, elevation] };
  await render();
  await resetRun();
  const elevationInspection = { ...inspection, page: 2, drawingType: 'elevation', relevant: false, level: 'Unassigned' };
  const inspectByPage = (payload) => payload.page.pageNumber === 2 ? elevationInspection : inspection;
  let failMeasureItems = true;
  getResponse = async (payload) => payload.action === 'inspect' ? inspectByPage(payload)
    : payload.action === 'measure' && payload.measurementScope === 'items' && failMeasureItems ? providerFailure(502, 'provider_unavailable', 'OpenAI is temporarily unavailable.', 0) : measurement;
  let start = calls.length;
  await act(() => current.analysis.run());
  let sequence = calls.slice(start).map((item) => `${item.action}:${item.measurementScope || ''}:${item.page.pageNumber}`);
  assert.deepEqual(sequence, ['inspect::1', 'inspect::2', 'measure:geometry:1', 'measure:items:1', 'measure:items:1'], 'Only the failed items half is retried; the successful geometry half is not repeated.');
  assert.equal(current.analysis.stage, 'error');
  assert.match(current.analysis.message, /could not measure the plan.*temporarily unavailable/);
  const geometryRequest = calls.slice(start).find((item) => item.measurementScope === 'geometry');
  const itemsRequest = calls.slice(start).find((item) => item.measurementScope === 'items');
  assert.equal(geometryRequest.contextPages, undefined, 'Geometry requests carry no supporting-page images or text.');
  assert.equal(itemsRequest.contextPages.length, 1, 'Items requests carry the supporting elevation.');
  assert.ok(itemsRequest.contextPages[0].imageDataUrl, 'Supporting image still available to openings/items analysis.');
  assert.equal(itemsRequest.contextPages[0].textItems, 'W01 | 1200H x 1800W\nW02', 'Supporting text is compact reading-order lines, not positioned records.');
  assert.ok(Array.isArray(itemsRequest.page.textItems) || itemsRequest.page.textItems !== undefined, 'Primary page keeps its own text payload.');
  const cachedInspections = structuredClone(current.analysis.inspections);
  assert.equal(Object.keys(cachedInspections).length, 2, 'Both page inspections are cached after a failed run.');

  // Re-run after the failure: no re-inspection, geometry half reused, items half requested.
  failMeasureItems = false;
  start = calls.length;
  await act(() => current.analysis.run());
  sequence = calls.slice(start).map((item) => `${item.action}:${item.measurementScope || ''}:${item.page.pageNumber}`);
  assert.deepEqual(sequence, ['measure:items:1', 'refine:geometry:1', 'refine:items:1'], 'Re-run never re-inspects unchanged pages nor repeats the successful geometry half.');
  assert.equal(current.analysis.stage, 'complete', current.analysis.message);
  assert.equal(current.collections.completedWallRuns.length, 1);
  assert.equal(current.analysis.report.requests.filter((item) => item.action === 'inspect' && item.cached).length, 2);

  // Saved inspections restored on reopen still prevent re-inspection; a changed page image is re-inspected.
  await resetRun(cachedInspections);
  start = calls.length;
  await act(() => current.analysis.run());
  assert.ok(!calls.slice(start).some((item) => item.action === 'inspect'), 'Reopened takeoff reuses saved page inspections.');
  configuration = { ...configuration, planPages: [page, { ...elevation, dataUrl: 'data:image/png;base64,changed' }] };
  await render();
  await resetRun(cachedInspections);
  start = calls.length;
  await act(() => current.analysis.run());
  assert.deepEqual(calls.slice(start).filter((item) => item.action === 'inspect').map((item) => item.page.pageNumber), [2], 'Only the changed page is inspected again.');
  configuration = { ...configuration, planPages: [page, elevation] };
  await render();

  // retry-after is honoured before the single retry; waits beyond the limit are not retried.
  await resetRun(cachedInspections);
  const stamps = [];
  let itemsAttempts = 0;
  getResponse = async (payload) => {
    if (payload.action === 'inspect') return inspectByPage(payload);
    if (payload.action === 'measure' && payload.measurementScope === 'items') {
      stamps.push(Date.now());
      itemsAttempts += 1;
      if (itemsAttempts === 1) return providerFailure(429, 'provider_rate_limit', 'OpenAI rate limit reached.', 0.4);
    }
    return measurement;
  };
  await act(() => current.analysis.run());
  assert.equal(current.analysis.stage, 'complete', current.analysis.message);
  assert.equal(stamps.length, 2);
  assert.ok(stamps[1] - stamps[0] >= 390, `Retry waited for retry-after (${stamps[1] - stamps[0]} ms).`);
  await resetRun(cachedInspections);
  start = calls.length;
  getResponse = async (payload) => payload.action === 'inspect' ? inspectByPage(payload)
    : payload.measurementScope === 'items' ? providerFailure(429, 'provider_rate_limit', 'OpenAI rate limit reached. Retry after 600s.', 600) : measurement;
  await act(() => current.analysis.run());
  assert.equal(calls.slice(start).filter((item) => item.measurementScope === 'items').length, 1, 'A retry-after beyond the wait limit is reported, not retried.');
  assert.match(current.analysis.message, /Retry after 600s/);

  // Hard provider failures stop every further provider request immediately.
  const ground = { ...page }, upper = { ...page, pageNumber: 2 };
  configuration = { ...configuration, planPages: [ground, upper] };
  await render();
  for (const [code, status, text] of [['provider_quota_exhausted', 503, 'OpenAI API quota exhausted'], ['provider_auth_failed', 503, 'OpenAI rejected the API key'], ['provider_model_unavailable', 503, 'Model gpt-5.4 is unavailable'], ['provider_access_denied', 503, 'OpenAI denied access']]) {
    // Measuring: page 1 geometry fails hard -> no items, no refine, no page 2.
    await resetRun();
    getResponse = async (payload) => payload.action === 'inspect' ? { ...inspection, page: payload.page.pageNumber, level: payload.page.pageNumber === 2 ? 'Second Level' : 'Ground Floor' }
      : providerFailure(status, code, text);
    start = calls.length;
    await act(() => current.analysis.run());
    sequence = calls.slice(start).map((item) => `${item.action}:${item.measurementScope || ''}:${item.page.pageNumber}`);
    assert.deepEqual(sequence, ['inspect::1', 'inspect::2', 'measure:geometry:1'], `${code} during measurement stops all further requests.`);
    assert.equal(current.analysis.stage, 'error');
    assert.ok(current.analysis.message.includes(text), current.analysis.message);
    // Inspecting: page 1 fails hard -> page 2 is never inspected.
    await resetRun();
    getResponse = async () => providerFailure(status, code, text);
    start = calls.length;
    await act(() => current.analysis.run());
    assert.deepEqual(calls.slice(start).map((item) => `${item.action}:${item.page.pageNumber}`), ['inspect:1'], `${code} during inspection stops all further requests.`);
    assert.ok(current.analysis.message.includes(text));
  }
  assert.deepEqual(current.collections, emptyCollections(), 'Failed runs insert nothing.');

  const rotated ={ walls: [{ nodes: [{ x: .2, y: .3 }, { x: .4, y: .5 }] }], openings: [{ x: .6, y: .7 }], buildingAreas: [], rooms: [], fixtures: [] };
  assert.deepEqual(restoreAnalysisCoordinates(rotated, 270).walls[0].nodes, [{ x: .7, y: .2 }, { x: .5, y: .4 }]);
  assert.ok(Math.abs(restoreAnalysisCoordinates(rotated, 90).openings[0].y - .4) < 1e-10);
  console.log('AI orchestration: confirmed scale, real canonical bridge, replay suppression, cancellation/job guards, review-only outcomes, rotation and saved evidence passed.');
} finally {
  await act(() => root.unmount());
  await supabase.auth.stopAutoRefresh();
  supabase.auth.broadcastChannel?.close();
  globalThis.fetch = originalFetch;
  dom.window.close();
  delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
}
