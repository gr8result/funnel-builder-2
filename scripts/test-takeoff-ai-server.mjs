import assert from 'node:assert/strict';
import { analyseTakeoffPage, buildTakeoffProviderRequest, createTakeoffAnalysisHandler, DEFAULT_TAKEOFF_MODEL, validateTakeoffAnalysisRequest } from '../lib/construction-estimation/aiTakeoffAnalysis.js';

// This image and provider stubs exist only in the isolated server contract tests.
const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLt8AAAAASUVORK5CYII=';
const payload = {
  action: 'inspect', jobId: 'test-job', takeoffId: 'test-takeoff', documentHash: 'test-document', runId: 'test-run',
  page: { pageNumber: 1, logicalWidth: 842, logicalHeight: 595, imageDataUrl, textItems: [{ str: 'SCALE 1:100', x: 750, y: 570 }] },
};
const inspect = {
  page: 1, textDirection: 'left-to-right', rotationToUpright: 0, drawingType: 'floor_plan', relevant: true, level: 'Ground Floor',
  scale: { denominator: 100, basis: 'OBSERVED', confidence: 0.95, evidence: 'Printed scale 1:100' },
  writtenDimensions: [], review: [],
};
const measure = { page: 1, level: 'Ground Floor', walls: [], openings: [], pillars: [], eaves: [], buildingAreas: [], roofMeasurements: [], rooms: [], fixtures: [], documentedQuantities: [], review: [] };
const response = (analysis, overrides = {}) => ({
  ok: true, status: 200, headers: { get: () => 'test-provider-request' },
  json: async () => ({ id: 'test-response', model: 'gpt-5.4-test-snapshot', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }], ...overrides }),
});
const request = validateTakeoffAnalysisRequest(payload);
assert.equal(DEFAULT_TAKEOFF_MODEL, 'gpt-5.4');
assert.equal(request.page.textItems[0].text, 'SCALE 1:100');
assert.equal(request.page.textItems[0].str, undefined);
assert.equal(request.pixelsPerMm, undefined, 'inspection can precede calibration');
const providerRequest = buildTakeoffProviderRequest(request, DEFAULT_TAKEOFF_MODEL);
assert.equal(providerRequest.store, false);
assert.equal(providerRequest.text.format.strict, true);
assert.equal(providerRequest.reasoning.effort, 'low');
assert.equal(providerRequest.temperature, undefined);
assert.equal(providerRequest.input[0].content[1].detail, 'original');
assert.equal(buildTakeoffProviderRequest(request, 'gpt-4.1').input[0].content[1].detail, 'high');
assert.equal(buildTakeoffProviderRequest(request, 'gpt-4.1').temperature, 0);
const measureRequest = validateTakeoffAnalysisRequest({ ...payload, action: 'measure', pixelsPerMm: 0.02835, page: { ...payload.page, imageRotation: 270 }, contextPages: [{ pageNumber: 2, logicalWidth: 842, logicalHeight: 595, textItems: 'Window schedule: W01 1200H x1800W' }] });
const measureProviderRequest = buildTakeoffProviderRequest(measureRequest, DEFAULT_TAKEOFF_MODEL);
assert.equal(measureProviderRequest.reasoning.effort, 'medium');
assert.match(measureProviderRequest.input[0].content[0].text, /HEIGHT then WIDTH/);
assert.match(measureProviderRequest.input[0].content[0].text, /270 clockwise/);
assert.equal(measureProviderRequest.input[0].content.length, 3);
assert.match(providerRequest.instructions, /untrusted data/);

const refinePayload = { ...payload, action: 'refine', pixelsPerMm: 0.02835,
  page: { ...payload.page, imageWidth: 2400, imageHeight: 1696 },
  previousAnalysis: measure, geometryPreviewDataUrl: imageDataUrl };
const refineRequest = validateTakeoffAnalysisRequest(refinePayload);
const refineProviderRequest = buildTakeoffProviderRequest(refineRequest, DEFAULT_TAKEOFF_MODEL);
assert.equal(refineProviderRequest.reasoning.effort, 'high');
assert.equal(refineProviderRequest.text.format.name, 'takeoff_refine_v1');
assert.equal(refineProviderRequest.input[0].content.length, 4);
assert.equal(refineProviderRequest.input[0].content[1].image_url, payload.page.imageDataUrl, 'unannotated source image stays first');
assert.equal(refineProviderRequest.input[0].content[3].image_url, imageDataUrl);
assert.match(refineProviderRequest.input[0].content[0].text, /COMPLETE replacement analysis/);
assert.match(refineProviderRequest.input[0].content[0].text, /NEVER enlarge, shrink or invent geometry/);
assert.match(refineProviderRequest.input[0].content[0].text, /four decimal places/);
assert.equal(refineRequest.page.imageWidth, 2400);
assert.equal(refineRequest.page.imageHeight, 1696);
assert.notEqual(refineRequest.previousAnalysis, measure, 'previous analysis is snapshotted independently of caller mutation');
for (const bad of [
  { ...refinePayload, previousAnalysis: undefined },
  { ...refinePayload, previousAnalysis: { ...measure, page: 2 } },
  { ...refinePayload, previousAnalysis: { ...measure, unexpected: true } },
  { ...refinePayload, previousAnalysis: { ...measure, walls: null } },
  { ...refinePayload, previousAnalysis: { ...measure, review: ['a'.repeat(600001)] } },
  { ...refinePayload, geometryPreviewDataUrl: undefined },
  { ...refinePayload, geometryPreviewDataUrl: 'https://example.com/preview.jpg' },
  { ...refinePayload, pixelsPerMm: undefined },
  { ...refinePayload, page: { ...refinePayload.page, imageWidth: 6001 } },
  { ...refinePayload, page: { ...refinePayload.page, imageHeight: 0.5 } },
]) assert.throws(() => validateTakeoffAnalysisRequest(bad), (error) => error.status === 400 && error.code === 'invalid_analysis_input');
const largeImageBytes = Buffer.alloc(3 * 1024 * 1024);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(largeImageBytes);
const largeImage = `data:image/png;base64,${largeImageBytes.toString('base64')}`;
assert.throws(() => validateTakeoffAnalysisRequest({ ...refinePayload,
  page: { ...refinePayload.page, imageDataUrl: largeImage }, geometryPreviewDataUrl: largeImage,
  contextPages: [{ ...payload.page, pageNumber: 2, imageDataUrl: largeImage }],
}), /8 MB/, 'overlay bytes count towards the same aggregate request budget');

for (const bad of [null, [], { ...payload, action: 'estimate' }, { ...payload, jobId: '' }, { ...payload, page: { ...payload.page, pageNumber: '1' } }, { ...payload, page: { ...payload.page, logicalWidth: NaN } }, { ...payload, page: { ...payload.page, imageDataUrl: 'https://example.com/plan.png' } }, { ...payload, page: { ...payload.page, imageDataUrl: 'data:image/png;base64,YWJjZA==' } }, { ...payload, page: { ...payload.page, imageRotation: 45 } }, { ...payload, page: { ...payload.page, textItems: [{ str: 'text', x: Infinity }] } }, { ...payload, action: 'measure' }, { ...payload, action: 'measure', pixelsPerMm: -1 }, { ...payload, contextPages: Array(4).fill(payload.page) }]) {
  assert.throws(() => validateTakeoffAnalysisRequest(bad), (error) => error.status === 400 && error.code === 'invalid_analysis_input');
}
assert.throws(() => validateTakeoffAnalysisRequest({ ...payload, page: { ...payload.page, imageDataUrl: `data:image/png;base64,${'a'.repeat(5 * 1024 * 1024)}` } }), /3 MB/);

let called = 0;
const result = await analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async (url, options) => {
  called += 1;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(options.body).model, DEFAULT_TAKEOFF_MODEL);
  assert.ok(options.signal instanceof AbortSignal);
  return response(inspect);
} });
assert.equal(called, 1);
assert.deepEqual(result, { ok: true, provider: 'openai', model: 'gpt-5.4-test-snapshot', requestId: 'test-provider-request', analysis: inspect });
for (const [textDirection, expectedRotation] of [['left-to-right', 0], ['top-to-bottom', 270], ['right-to-left', 180], ['bottom-to-top', 90], ['unknown', 90]]) {
  const oriented = await analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => response({ ...inspect, textDirection, rotationToUpright: 90 }) });
  assert.equal(oriented.analysis.rotationToUpright, expectedRotation);
  assert.equal(oriented.analysis.review.length, expectedRotation === 90 ? 0 : 1, 'conflicting rotation is corrected with an explicit review record');
}
assert.equal((await analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async () => response(measure) })).analysis.page, 1);
const partitionRequests = [];
await analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async (_url, options) => {
  partitionRequests.push(JSON.parse(options.body));
  return response(measure);
} });
assert.equal(partitionRequests.length, 2, 'A full measurement uses two bounded real vision requests.');
assert.equal(partitionRequests[0].text.format.schema.properties.openings.maxItems, 0);
assert.equal(partitionRequests[1].text.format.schema.properties.walls.maxItems, 0);
assert.ok(partitionRequests.every((item) => item.input[0].content.some((part) => part.image_url === measureRequest.page.imageDataUrl)), 'Both parts analyse the actual primary image.');

// Supporting pages travel only with the items half; geometry is traced from the primary page alone.
const withContextBody = { ...payload, action: 'measure', pixelsPerMm: 0.02835, contextPages: [{ pageNumber: 2, logicalWidth: 842, logicalHeight: 595, imageDataUrl, textItems: 'W01 | 1200H x 1800W' }] };
const withContext = validateTakeoffAnalysisRequest(withContextBody);
const imagesIn = (providerRequest) => providerRequest.input[0].content.filter((part) => part.type === 'input_image').length;
const geometryProvider = buildTakeoffProviderRequest({ ...withContext, measurementScope: 'geometry' }, DEFAULT_TAKEOFF_MODEL);
const itemsProvider = buildTakeoffProviderRequest({ ...withContext, measurementScope: 'items' }, DEFAULT_TAKEOFF_MODEL);
assert.equal(imagesIn(geometryProvider), 1, 'Geometry request sends only the primary page image.');
assert.ok(!JSON.stringify(geometryProvider.input).includes('SUPPORTING PAGE'), 'Geometry request sends no supporting-page text.');
assert.equal(imagesIn(itemsProvider), 2, 'Items request sends the primary and supporting images.');
assert.match(JSON.stringify(itemsProvider.input), /W01 \| 1200H x 1800W/);
// Client-scoped requests: geometry/items only, and only for measure/refine.
assert.equal(validateTakeoffAnalysisRequest({ ...withContextBody, measurementScope: 'items' }).measurementScope, 'items');
for (const bad of [{ ...payload, measurementScope: 'geometry' }, { ...withContextBody, measurementScope: 'everything' }]) {
  assert.throws(() => validateTakeoffAnalysisRequest(bad), (error) => error.status === 400);
}
// Unscoped compatibility path runs its halves one after the other and stops on failure.
let activeProvider = 0, maxActiveProvider = 0;
await analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async () => {
  activeProvider += 1; maxActiveProvider = Math.max(maxActiveProvider, activeProvider);
  await new Promise((resolve) => setTimeout(resolve, 20));
  activeProvider -= 1;
  return response(measure);
} });
assert.equal(maxActiveProvider, 1, 'Geometry and items are never in flight together.');
let haltedCalls = 0;
const silencedLog = console.error; console.error = () => {};
await assert.rejects(() => analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async () => {
  haltedCalls += 1;
  return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error: { type: 'insufficient_quota', code: 'insufficient_quota' } }) };
} }), (error) => error.code === 'provider_quota_exhausted');
console.error = silencedLog;
assert.equal(haltedCalls, 1, 'A failed geometry half prevents the paid items request.');
await assert.rejects(() => analyseTakeoffPage(request, {}), (error) => error.status === 503);
for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]]) {
  await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => ({ ok: false, status }) }), (error) => error.status === expected && !error.message.includes('test-key'));
}
// OpenAI uses HTTP 429 for both quota exhaustion and rate limits; error.code/type must survive.
const providerError = (status, error, headers = {}) => async () => ({ ok: false, status, headers: { get: (name) => headers[name] ?? null }, json: async () => ({ error }) });
const originalConsoleError = console.error;
const providerLogs = [];
console.error = (...args) => providerLogs.push(args);
try {
  for (const [status, error, headers, expected] of [
    [429, { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota', code: 'insufficient_quota' }, {}, { status: 503, code: 'provider_quota_exhausted', text: /quota exhausted.*OpenAI HTTP 429 insufficient_quota/ }],
    [429, { message: 'Rate limit reached for gpt-5.4 in organization org-AbCdEf123456 on tokens per min (TPM): Limit 30000, Used 24000, Requested 18000. Please try again in 24s. key sk-test-secretvalue123', type: 'tokens', code: 'rate_limit_exceeded' }, { 'retry-after': '24', 'x-ratelimit-limit-tokens': '30000', 'x-ratelimit-remaining-tokens': '6000' }, { status: 429, code: 'provider_rate_limit', text: /OpenAI rate limit reached.*tokens per min.*Retry after 24s.*OpenAI HTTP 429 tokens\/rate_limit_exceeded/ }],
    [404, { message: 'The model `gpt-5.4` does not exist or you do not have access to it.', type: 'invalid_request_error', code: 'model_not_found' }, {}, { status: 503, code: 'provider_model_unavailable', text: /Model gpt-5\.4 is unavailable.*model_not_found/ }],
    [400, { message: 'Your input exceeds the context window of this model.', type: 'invalid_request_error', code: 'context_length_exceeded' }, {}, { status: 502, code: 'provider_request_too_large', text: /size limits.*context_length_exceeded/ }],
    [401, { message: 'Incorrect API key provided: sk-test-secretvalue123.', type: 'invalid_request_error', code: 'invalid_api_key' }, {}, { status: 503, code: 'provider_auth_failed', text: /rejected the API key/ }],
    [503, { message: 'The server is overloaded.', type: 'server_error', code: null }, {}, { status: 502, code: 'provider_unavailable', text: /temporarily unavailable or overloaded.*OpenAI HTTP 503 server_error/ }],
  ]) {
    await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'sk-test-secretvalue123', fetchImpl: providerError(status, error, headers) }), (failure) => {
      assert.equal(failure.status, expected.status, failure.message);
      assert.equal(failure.code, expected.code);
      assert.match(failure.message, expected.text);
      assert.ok(!failure.message.includes('secretvalue123') && !failure.message.includes('AbCdEf123456'), 'No key or organisation id in the user message');
      return true;
    });
  }
  // OpenAI wait hints become retryAfterSeconds for the client's single retry.
  for (const [type, headers, expected] of [
    ['requests', { 'retry-after-ms': '1500', 'retry-after': '9' }, 1.5],
    ['tokens', { 'x-ratelimit-reset-tokens': '6m0s', 'x-ratelimit-reset-requests': '1s' }, 360],
    ['requests', { 'x-ratelimit-reset-requests': '120ms', 'x-ratelimit-reset-tokens': '30s' }, 0.12],
    ['tokens', {}, null],
  ]) {
    await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: providerError(429, { message: 'Rate limit reached.', type, code: 'rate_limit_exceeded' }, headers) }),
      (failure) => failure.code === 'provider_rate_limit' && (failure.retryAfterSeconds ?? null) === expected);
  }
  const limited = mockRes();
  await createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'test-key' }, fetchImpl: providerError(429, { message: 'Rate limit reached.', type: 'tokens', code: 'rate_limit_exceeded' }, { 'retry-after': '7' }) })({ method: 'POST', user: { id: 'user-limited' }, body: payload }, limited);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.data.retryAfterSeconds, 7, 'Route returns the provider wait to the client.');
  assert.equal(limited.headers['Retry-After'], '7');
  const rateLog = providerLogs.find(([label, data]) => label === '[AI Takeoff provider]' && data.code === 'rate_limit_exceeded')?.[1];
  assert.equal(rateLog.status, 429);
  assert.equal(rateLog.type, 'tokens');
  assert.equal(rateLog.limitTokens, '30000');
  assert.equal(rateLog.retryAfter, '24');
  assert.ok(!JSON.stringify(providerLogs).includes('secretvalue123'), 'API key is never logged');
} finally {
  console.error = originalConsoleError;
}
await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => { throw Object.assign(new Error('private provider text'), { name: 'TimeoutError' }); } }), (error) => error.status === 504 && !error.message.includes('private provider text'));
await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => { throw new Error('private provider text'); } }), (error) => error.status === 502 && !error.message.includes('private provider text'));
await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => response(inspect, { status: 'incomplete' }) }), (error) => error.code === 'analysis_incomplete');
await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => response(inspect, { output: [{ content: [{ type: 'refusal', refusal: 'private refusal' }] }] }) }), (error) => error.code === 'analysis_refused');
for (const output of [{ ...inspect, page: 2 }, { ...inspect, rotationToUpright: 45 }, { ...inspect, scale: { ...inspect.scale, confidence: 2 } }, { ...inspect, unknown: 'unexpected' }]) {
  await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => response(output) }), (error) => error.status === 502);
}
const testWall = { detectionId: 'wall-1', page: 1, basis: 'OBSERVED', confidence: 0.8, evidence: 'Visible wall', nodes: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }], category: 'exterior', thicknessMm: null, wallHeightM: null, exteriorType: 'Other', constructionSystem: null, frameThicknessMm: null, exteriorFinish: null, exteriorFinishCustomLabel: null, customSystemLabel: null };
for (const walls of [[testWall, testWall], [{ ...testWall, page: 2 }]]) {
  assert.throws(() => validateTakeoffAnalysisRequest({ ...refinePayload, previousAnalysis: { ...measure, walls } }), (error) => error.status === 400);
}
const refined = { ...measure, walls: [{ ...testWall, nodes: [{ x: 0.1234, y: 0.1567 }, { x: 0.5678, y: 0.1567 }] }], review: ['Corrected trace against the original wall face.'] };
assert.deepEqual((await analyseTakeoffPage(refineRequest, { apiKey: 'test-key', fetchImpl: async () => response(refined) })).analysis,
  { ...refined, walls: refined.walls.map((item) => ({ ...item, detectionId: `geometry:${item.detectionId}` })) });
await assert.rejects(() => analyseTakeoffPage(refineRequest, { apiKey: 'test-key', fetchImpl: async () => response(refined, { status: 'incomplete' }) }), (error) => error.code === 'analysis_incomplete');
await assert.rejects(() => analyseTakeoffPage(refineRequest, { apiKey: 'test-key', fetchImpl: async () => response({ ...measure, walls: [{ ...testWall, page: 2 }] }) }), (error) => error.code === 'wrong_analysis_page');
await assert.rejects(() => analyseTakeoffPage(refineRequest, { apiKey: 'test-key', fetchImpl: async () => response({ ...measure, walls: [testWall, testWall] }) }), (error) => error.code === 'duplicate_detection_id');
await assert.rejects(() => analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async () => response({ ...measure, walls: [testWall, testWall] }) }), (error) => error.code === 'duplicate_detection_id');
await assert.rejects(() => analyseTakeoffPage(measureRequest, { apiKey: 'test-key', fetchImpl: async () => response({ ...measure, walls: [{ ...testWall, page: 2 }] }) }), (error) => error.code === 'wrong_analysis_page');

function mockRes() {
  return { headers: {}, statusCode: 200, data: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
}
const handler = createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'test-key' }, fetchImpl: async () => response(inspect) });
const unauthenticated = mockRes();
await handler({ method: 'POST', body: payload }, unauthenticated);
assert.equal(unauthenticated.statusCode, 401);
const wrongMethod = mockRes();
await handler({ method: 'GET', user: { id: 'user-1' } }, wrongMethod);
assert.equal(wrongMethod.statusCode, 405);
const normal = mockRes();
await handler({ method: 'POST', user: { id: 'user-1' }, body: payload }, normal);
assert.equal(normal.statusCode, 200);
assert.equal(normal.data.ok, true);
assert.equal(normal.headers['Cache-Control'], 'private, no-store');
const refinedResponse = mockRes();
await createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'test-key' }, fetchImpl: async () => response(refined) })({ method: 'POST', user: { id: 'user-refine' }, body: refinePayload }, refinedResponse);
assert.equal(refinedResponse.statusCode, 200);
assert.deepEqual(refinedResponse.data.analysis, { ...refined, walls: refined.walls.map((item) => ({ ...item, detectionId: `geometry:${item.detectionId}` })) });
const missingKey = mockRes();
await createTakeoffAnalysisHandler({ env: {} })({ method: 'POST', user: { id: 'user-1' }, body: payload }, missingKey);
assert.equal(missingKey.statusCode, 503);
const invalidModel = mockRes();
await createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'test-key', OPENAI_TAKEOFF_MODEL: '../../wrong' } })({ method: 'POST', user: { id: 'user-1' }, body: payload }, invalidModel);
assert.equal(invalidModel.statusCode, 503);

let resolveProvider;
let concurrentCalls = 0;
const pendingProvider = new Promise((resolve) => { resolveProvider = resolve; });
const dedupHandler = createTakeoffAnalysisHandler({ env: { OPENAI_API_KEY: 'test-key' }, fetchImpl: async () => { concurrentCalls += 1; return pendingProvider; } });
const req = { method: 'POST', user: { id: 'user-2' }, body: payload };
const one = mockRes(), two = mockRes();
const first = dedupHandler(req, one), second = dedupHandler(req, two);
assert.equal(concurrentCalls, 1, 'same in-flight page request shares one provider call');
resolveProvider(response(inspect));
await Promise.all([first, second]);
assert.deepEqual(one.data, two.data);
console.log('takeoff AI server: request bounds, structured provider contract, auth, failures, schema validation and in-flight dedup passed');
