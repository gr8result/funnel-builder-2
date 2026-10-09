// Region-based reading of doors and windows: the regions cover the building with overlap, a
// region's coordinates map exactly onto the sheet, the same opening read twice is one opening,
// codes are kept, uncertain readings are flagged, and the server accepts and constrains the request.
// No provider is called: the "provider" here answers from a known set of openings.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-plan-regions.mjs
import assert from 'node:assert/strict';
import { planRegions, regionPointToSheet, sheetPointToRegion, mergeRegionOpenings, collectRegionOpenings } from '../components/construction-estimation/ai-plan-takeoff/geometry/planRegions.js';
import { OPENINGS_REGION_SCOPE } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
import { validateTakeoffAnalysisRequest, buildTakeoffProviderRequest } from '../lib/construction-estimation/aiTakeoffAnalysis.js';

// The New Job 03/09 ground floor's proportions: 20.1 m x 11.5 m at 0.02003 px/mm on a 595 x 842 sheet.
const sheet = { pageNumber: 2, logicalWidth: 595, logicalHeight: 842, pixelsPerMm: 0.020028 };
const bounds = { x: 160, y: 321, x2: 563, y2: 551 };
const regions = planRegions(bounds, sheet);
assert.equal(regions.length, 8, `4 x 2 regions for a 20 m x 11.5 m floor (got ${regions.length})`);
assert.equal(new Set(regions.map((region) => region.id)).size, regions.length);
const margin = 900 * sheet.pixelsPerMm;
// Every point of the building (and its margin) is inside at least one region; interior seams are covered twice.
for (let x = bounds.x - margin; x <= bounds.x2 + margin; x += 3) for (let y = bounds.y - margin; y <= bounds.y2 + margin; y += 3) {
  assert.ok(regions.some((region) => x >= region.x - 1e-6 && x <= region.x + region.width + 1e-6 && y >= region.y - 1e-6 && y <= region.y + region.height + 1e-6), `uncovered point ${x},${y}`);
}
for (const region of regions) {
  assert.ok(region.width / sheet.pixelsPerMm <= 8001 && region.height / sheet.pixelsPerMm <= 8001, 'no region is larger than 8 m');
  assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.width <= sheet.logicalWidth && region.y + region.height <= sheet.logicalHeight);
}
const [first, second] = regions;
assert.ok(Math.abs((first.x + first.width - second.x) / sheet.pixelsPerMm - 1600) < 1, 'neighbouring regions overlap by 1.6 m');
assert.equal(planRegions({ x: 100, y: 100, x2: 180, y2: 160 }, sheet).length, 1, 'a small building is one region');
assert.throws(() => planRegions(bounds, { ...sheet, pixelsPerMm: 0 }), /calibration/);
assert.throws(() => planRegions({ x: 0, y: 0, x2: 595, y2: 842 }, { ...sheet, pixelsPerMm: 0.002 }), /check the calibration/);

// Coordinates: region fraction -> sheet fraction -> region fraction, exactly.
for (const region of regions) for (const point of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.37, y: 0.81 }]) {
  const onSheet = regionPointToSheet(region, point, sheet);
  assert.ok(Math.abs(onSheet.x * sheet.logicalWidth - (region.x + point.x * region.width)) < 1e-9);
  const back = sheetPointToRegion(region, onSheet, sheet);
  assert.ok(Math.abs(back.x - point.x) < 1e-9 && Math.abs(back.y - point.y) < 1e-9);
}

// A "provider" that knows where the openings really are (sheet logical pixels) and reports each
// region's openings relative to that region's image, as the real request is asked to.
const truth = [
  { id: 'W1', x: 300, y: 321, openingClass: 'Window', type: 'window', sizeCode: '1818' },
  { id: 'D1', x: 262, y: 440, openingClass: 'Internal Door', type: 'door', sizeCode: '820' },                 // inside the r1c1/r1c2 overlap
  { id: 'W2', x: 520, y: 551, openingClass: 'Window', type: 'window', sizeCode: '1809dh' },
  { id: 'G1', x: 170, y: 500, openingClass: 'Garage Door', type: 'door', sizeCode: null },
];
const calls = [];
const provider = (jitter = 0) => async (payload) => {
  calls.push(payload);
  const region = payload.region;
  const openings = truth.filter((item) => item.x >= region.x && item.x <= region.x + region.width && item.y >= region.y && item.y <= region.y + region.height)
    .map((item, index) => ({ detectionId: `o${index}`, page: 2, basis: 'OBSERVED', confidence: 0.9, evidence: `${item.id} read.`, type: item.type, openingClass: item.openingClass,
      x: (item.x + jitter - region.x) / region.width, y: (item.y - region.y) / region.height, sizeCode: item.sizeCode, tag: null, hostDetectionId: 'ignored' }));
  return { analysis: { openings } };
};
const base = { jobId: 'j', takeoffId: 't', documentHash: 'h', runId: 'ai-takeoff-v1', pixelsPerMm: sheet.pixelsPerMm, page: { pageNumber: 2, logicalWidth: 595, logicalHeight: 842 } };
const crop = async (region) => ({ imageDataUrl: `data:crop:${region.id}`, imageWidth: 1800, imageHeight: 1500, imageRotation: 0 });
const read = await collectRegionOpenings({ regions, sheet, crop, request: provider(), base });
assert.equal(read.requests, 8);
assert.equal(calls.length, 8, 'one request per region');
assert.ok(calls.every((payload) => payload.measurementScope === OPENINGS_REGION_SCOPE && payload.action === 'measure' && payload.page.imageDataUrl.startsWith('data:crop:') && payload.page.logicalWidth === 595));
assert.equal(read.failures.length, 0);
assert.equal(read.openings.length, truth.length, `each opening once (got ${read.openings.length})`);
assert.ok(read.report.duplicatesMerged >= 1, 'the door in the overlap was read twice and merged');
for (const item of truth) {
  const found = read.openings.find((opening) => Math.hypot(opening.x * 595 - item.x, opening.y * 842 - item.y) < 1e-6);
  assert.ok(found, `${item.id} is back at its sheet position`);
  assert.equal(found.sizeCode, item.sizeCode, 'the printed code is kept as read');
  assert.equal(found.hostDetectionId, null, 'hosts are decided against measured walls, not by the reading');
  assert.match(found.detectionId, /^r\dc\d:o\d$/);
}
assert.equal(new Set(read.openings.map((opening) => opening.detectionId)).size, read.openings.length, 'ids stay unique across regions');

// Two regions disagreeing by 400 mm about the same door are still one door; 1.5 m apart are two.
const pair = (dxMm) => mergeRegionOpenings([
  { region: regions[0], openings: [{ detectionId: 'a', x: 0.9, y: 0.5, openingClass: 'Internal Door', type: 'door', confidence: 0.8, sizeCode: null, tag: 'D4' }] },
  { region: regions[1], openings: [{ detectionId: 'b', ...sheetPointToRegion(regions[1], { x: (regions[0].x + 0.9 * regions[0].width + dxMm * sheet.pixelsPerMm) / 595, y: (regions[0].y + 0.5 * regions[0].height) / 842 }, sheet), openingClass: 'Internal Door', type: 'door', confidence: 0.9, sizeCode: '820', tag: null }] },
], sheet);
assert.equal(pair(400).openings.length, 1);
assert.equal(pair(400).openings[0].sizeCode, '820');
assert.equal(pair(400).openings[0].tag, 'D4', 'what either reading knew is kept');
assert.equal(pair(1500).openings.length, 2);
// A window and a door at the same place are different openings.
assert.equal(mergeRegionOpenings([{ region: regions[0], openings: [{ detectionId: 'a', x: 0.9, y: 0.5, openingClass: 'Window', type: 'window', confidence: 0.9 }] },
  { region: regions[1], openings: [{ detectionId: 'b', ...sheetPointToRegion(regions[1], regionPointToSheet(regions[0], { x: 0.9, y: 0.5 }, sheet), sheet), openingClass: 'Internal Door', type: 'door', confidence: 0.9 }] }], sheet).openings.length, 2);

// Uncertainty is flagged, never hidden: seen by one of two regions that both show it; undecided class; out-of-range points dropped.
const lonely = mergeRegionOpenings([{ region: regions[0], openings: [{ detectionId: 'a', x: 0.9, y: 0.5, openingClass: 'Window', type: 'window', confidence: 0.95, evidence: 'Seen.' }] }, { region: regions[1], openings: [] }], sheet);
assert.equal(lonely.openings[0].uncertain, true);
assert.ok(lonely.openings[0].confidence <= 0.6 && /not in r1c2/.test(lonely.openings[0].evidence));
const other = mergeRegionOpenings([{ region: regions[0], openings: [{ detectionId: 'a', x: 0.3, y: 0.4, openingClass: 'Other Opening', type: 'door', confidence: 0.9 }, { detectionId: 'z', x: 1.2, y: 0.4, openingClass: 'Window', type: 'window', confidence: 0.9 }] }], sheet);
assert.equal(other.openings.length, 1);
assert.equal(other.report.outsideRegion, 1);
assert.ok(other.openings[0].uncertain && /window or a door/.test(other.openings[0].evidence));
const sure = mergeRegionOpenings([{ region: regions[0], openings: [{ detectionId: 'a', x: 0.3, y: 0.4, openingClass: 'Window', type: 'window', confidence: 0.9 }] }], sheet);
assert.equal(sure.openings[0].uncertain, undefined);

// A region that fails is reported; the others are still read. A hard failure stops everything.
let n = 0;
const flaky = await collectRegionOpenings({ regions, sheet, crop, base, request: async (payload) => { n += 1; if (n === 3) throw new Error('timed out'); return provider()(payload); } });
assert.deepEqual(flaky.failures.map((failure) => failure.region), ['r1c3']);
assert.equal(flaky.report.regions, 7);
await assert.rejects(collectRegionOpenings({ regions, sheet, crop, base, request: async () => { throw Object.assign(new Error('no credit'), { hard: true }); } }), /no credit/);

// Server: the request is accepted with its region, constrained to openings, and tells the model the region.
const png = `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(24, 1)]).toString('base64')}`;
const body = { action: 'measure', measurementScope: OPENINGS_REGION_SCOPE, jobId: 'j', takeoffId: 't', documentHash: 'h', runId: 'ai-takeoff-v1', pixelsPerMm: sheet.pixelsPerMm,
  region: { x: regions[0].x, y: regions[0].y, width: regions[0].width, height: regions[0].height }, page: { pageNumber: 2, logicalWidth: 595, logicalHeight: 842, imageDataUrl: png, imageWidth: 1800, imageHeight: 1500, textItems: [] } };
const request = validateTakeoffAnalysisRequest(body);
assert.deepEqual(request.region, body.region);
const outgoing = buildTakeoffProviderRequest(request, 'gpt-5.4');
const schema = outgoing.text.format.schema.properties;
assert.equal(schema.openings.maxItems, 300);
for (const key of ['walls', 'rooms', 'buildingAreas', 'pillars', 'eaves', 'fixtures', 'documentedQuantities']) assert.equal(schema[key].maxItems, 0, `${key} is not asked of a region`);
assert.match(outgoing.input[0].content[0].text, /ENLARGED REGION of PRIMARY PAGE 2/);
assert.match(outgoing.input[0].content[0].text, /fraction 0\.\.1 of THIS IMAGE/);
assert.equal(outgoing.input[0].content.filter((part) => part.type === 'input_image').length, 1, 'only the region image is sent');
for (const bad of [{ ...body, region: undefined }, { ...body, region: { ...body.region, width: 0 } }, { ...body, region: { ...body.region, x: 590 } }, { ...body, measurementScope: 'items' }, { ...body, action: 'refine' }]) {
  assert.throws(() => validateTakeoffAnalysisRequest(bad), (error) => error.status === 400, 'an invalid region request is refused');
}
console.log('plan regions: ok');
