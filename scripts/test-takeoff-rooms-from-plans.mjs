import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyseTakeoffPage, buildTakeoffProviderRequest, DEFAULT_TAKEOFF_MODEL, validateTakeoffAnalysisRequest } from '../lib/construction-estimation/aiTakeoffAnalysis.js';
import { ROOMS_SCOPE } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/measurementScopes.js';
import { addManualRoom, floorPlanSheets, mergeRoomReadings, removeRoom, reportWithRooms, roomsByLevel } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomSchedule.js';
import { createAiScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/scheduleEvidence.js';
import { projectLocations } from '../lib/builders/projectLocations.js';
import { paintableRoomNames } from '../lib/builders/internalPaintColours.js';

// "Read Rooms from Plans": a rooms-only read of the floor-plan sheets that fills the takeoff's
// Rooms schedule, and through it the one project room list Client Selections uses.
// The provider is stubbed; no request leaves this test.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-rooms-from-plans.mjs
const pass = message => console.log(`PASS ${message}`);
const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLt8AAAAASUVORK5CYII=';
const identity = { jobId: 'test-job', takeoffId: 'test-takeoff', documentHash: 'test-document', runId: 'rooms-from-plans-v1' };
const pagePayload = (pageNumber, level) => ({ pageNumber, logicalWidth: 595, logicalHeight: 842, imageDataUrl, textItems: [], drawingType: 'floor_plan', level });
const payload = { action: 'measure', measurementScope: ROOMS_SCOPE, ...identity, page: pagePayload(2, 'Ground Floor'), pixelsPerMm: 0.02 };

// ---- the request ----
const request = validateTakeoffAnalysisRequest(payload);
assert.equal(request.measurementScope, 'rooms');
for (const action of ['inspect', 'refine']) assert.throws(() => validateTakeoffAnalysisRequest({ ...payload, action }), error => error.status === 400, `${action} cannot be a rooms request`);
const provider = buildTakeoffProviderRequest(request, DEFAULT_TAKEOFF_MODEL);
const properties = provider.text.format.schema.properties;
for (const key of ['walls', 'openings', 'buildingAreas', 'pillars', 'eaves', 'fixtures', 'documentedQuantities']) assert.equal(properties[key].maxItems, 0, `${key} cannot be returned by a rooms read`);
assert(properties.rooms.maxItems > 0);
const promptText = provider.input[0].content.filter(part => part.type === 'input_text').map(part => part.text).join('\n');
assert(/ROOM NAMES/.test(promptText) && /Do not measure or trace anything/.test(promptText) && /Ground Floor/.test(promptText));
assert(!/ONE PART OF A FULL TAKEOFF/.test(promptText) && !/WALLS: Trace/.test(promptText), 'the rooms read does not carry the measuring instructions');
assert.equal(provider.input[0].content.filter(part => part.type === 'input_image').length, 1, 'one sheet image, no supporting pages');
assert.equal(provider.reasoning.effort, 'low'); assert.equal(provider.max_output_tokens, 8000);
pass('a rooms request asks only for room names and can return nothing else');

// ---- the read: one provider request per floor-plan sheet ----
const room = (page, name, x, y) => ({ page, name, x, y, basis: 'OBSERVED', confidence: 0.95, evidence: `"${name.toUpperCase()}" lettered on the plan.` });
// The room labels on a two-storey plan set: sheet 2 is the ground floor, sheet 3 the upper floor.
const model = {
  2: ['Alfresco', 'Family', 'Dining', 'Kitchen', 'Pantry', 'WC', 'Laundry', 'Workshop', 'Garage', 'Media', 'Foyer', 'Study', 'Patio'],
  3: ['WIR', 'Bed 1', 'Ensuite', 'Bed 3', 'WC', 'Bath', 'Bed 4', 'Ensuite', 'Bed 2', 'Robe', 'Rumpus', 'Balcony'],
};
const empty = page => ({ page, level: 'Ground Floor', walls: [], openings: [], pillars: [], eaves: [], buildingAreas: [], rooms: [], fixtures: [], documentedQuantities: [], review: [] });
let calls = 0;
const fetchImpl = async (_url, options) => {
  calls += 1;
  const sent = JSON.parse(options.body);
  const pageNumber = JSON.parse(sent.input[0].content[0].text.split('PDF TEXT (original logical top-left text positions, before any temporary imageRotation):\n')[1]).pageNumber;
  const analysis = { ...empty(pageNumber), rooms: model[pageNumber].map((name, index) => room(pageNumber, name, 0.1 + index * 0.05, 0.1 + index * 0.05)) };
  return { ok: true, status: 200, headers: { get: () => `request-${pageNumber}` }, json: async () => ({ id: 'r', model: 'test-model', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }) };
};
const sheetLevels = { 1: 'Unassigned', 2: 'Ground Floor', 3: 'Second Level', 4: 'Unassigned' };
const sheets = floorPlanSheets(sheetLevels, [1, 2, 3, 4, 5].map(pageNumber => ({ pageNumber })));
assert.deepEqual(sheets, [{ page: 2, level: 'Ground Floor' }, { page: 3, level: 'Second Level' }], 'only sheets given a building level are read');
assert.deepEqual(floorPlanSheets({}, []), []);
const readings = [];
for (const sheet of sheets) {
  const result = await analyseTakeoffPage(validateTakeoffAnalysisRequest({ ...payload, page: pagePayload(sheet.page, sheet.level) }), { apiKey: 'test-key', fetchImpl });
  readings.push({ page: sheet.page, level: sheet.level, rooms: result.analysis.rooms });
}
assert.equal(calls, 2, 'one request per floor-plan sheet');
await assert.rejects(() => analyseTakeoffPage(request, { apiKey: 'test-key', fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => '' },
  json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ ...empty(2), walls: [{}] }) }] }] }) }) }), error => error.status === 502, 'a response carrying walls is rejected');
pass('rooms are read sheet by sheet; a response with anything but rooms is refused');

// ---- the Rooms schedule ----
let rooms = mergeRoomReadings([], readings);
assert.equal(rooms.length, 25);
assert.deepEqual(roomsByLevel(rooms).map(group => `${group.level}: ${group.rooms.map(item => item.name).join(', ')}`), [
  'Ground Floor: Alfresco, Family, Dining, Kitchen, Pantry, WC, Laundry, Workshop, Garage, Media, Foyer, Study, Patio',
  'Second Level: WIR, Bed 1, Ensuite, Bed 3, WC 2, Bath, Bed 4, Ensuite 2, Bed 2, Robe, Rumpus, Balcony']);
assert(rooms.every(item => item.source === 'plan' && item.basis === 'OBSERVED'), 'every room came from the plan');
// Two rooms with one label are two rooms.
assert.deepEqual(rooms.filter(item => /^(WC|Ensuite)/.test(item.name)).map(item => `${item.name}@${item.level}`), ['WC@Ground Floor', 'Ensuite@Second Level', 'WC 2@Second Level', 'Ensuite 2@Second Level']);
// Corrections by hand survive a re-read; a removed plan room comes back only if the plans are read again.
rooms = addManualRoom(rooms, 'Linen', 'Second Level', 3);
rooms = addManualRoom(rooms, 'linen', 'Second Level', 3);
rooms = removeRoom(rooms, 'Patio');
assert.equal(rooms.length, 25); assert(rooms.some(item => item.name === 'Linen' && item.source === 'manual')); assert(!rooms.some(item => item.name === 'Patio'));
assert.equal(addManualRoom(rooms, 'Cellar', 'Basement', 1), rooms, 'a room needs a building level');
const reread = mergeRoomReadings(rooms, [readings[1]]);
assert(reread.some(item => item.name === 'Linen') && !reread.some(item => item.name === 'Patio'), 'only the sheet that was read again is replaced');
assert.equal(reread.filter(item => item.level === 'Second Level' && item.source === 'plan').length, 12);
pass('Rooms schedule: by level, duplicates kept apart, corrected by hand');

// ---- stored on the takeoff, shown in the Takeoff Schedule, supplied to Client Selections ----
const report = reportWithRooms(null, rooms, { readAt: '2026-10-05T09:00:00.000Z', model: 'test-model', sheets: [2, 3] });
assert.equal(report.status, 'rooms'); assert.deepEqual([report.fixtures, report.review], [[], []]);
assert.equal(reportWithRooms({ status: 'complete', runId: 'ai-takeoff-v1', rooms: [], counts: { walls: 4 } }, rooms).counts.walls, 4, 'a full analysis record keeps everything else it holds');
assert.equal(createAiScheduleRows(report, [1, 2, 3, 4, 5]).rooms.length, 25, 'every room is a row of the Takeoff Schedule Rooms section');
// A job traced by hand: no placed opening carries a room at all.
const workbook = { aiPlanTakeoffJob: { placedOpenings: [], completedFloorplans: [], scheduleState: { aiAnalysis: JSON.parse(JSON.stringify(report)) } } };
const names = projectLocations({ book: { rooms: [] }, workbook }).map(location => location.name);
assert.deepEqual(names, ['Alfresco', 'Family', 'Dining', 'Kitchen', 'Pantry', 'WC', 'Laundry', 'Workshop', 'Garage', 'Media Room', 'Entry', 'Study',
  'Walk-in Robe', 'Bedroom 1', 'Ensuite', 'Bedroom 3', 'WC 2', 'Bathroom', 'Bedroom 4', 'Ensuite 2', 'Bedroom 2', 'Robe', 'Rumpus', 'Balcony', 'Linen']);
const paint = paintableRoomNames(names);
assert(paint.includes('Media Room') && paint.includes('Bedroom 4') && paint.includes('Workshop') && !paint.includes('Alfresco') && !paint.includes('Balcony'));
// Rooms the takeoff also knows from a placed window are one room, not two.
const both = projectLocations({ book: { rooms: [{ id: 'r1', name: 'Bedroom 1' }] }, workbook: { aiPlanTakeoffJob: { ...workbook.aiPlanTakeoffJob, placedOpenings: [{ roomKey: 'bed-4', roomLabel: 'Bed 4' }, { roomKey: 'media-theatre', roomLabel: 'Media / Theatre' }] } } }).map(location => location.name);
assert.equal(both.filter(name => name === 'Bedroom 4').length, 1); assert.equal(both.filter(name => name === 'Media Room').length, 1); assert.equal(both.filter(name => name === 'Bedroom 1').length, 1);
pass('the Rooms schedule is the Takeoff Schedule rooms and the project room list for Client Selections');

// ---- the takeoff screen ----
const action = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/AiTakeoffAction.jsx', 'utf8');
const hook = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffAnalysis.js', 'utf8');
assert(action.includes('id="read-rooms-from-plans"') && action.includes('READ ROOMS FROM PLANS') && action.includes('id="add-room"'));
assert(hook.includes('measurementScope: ROOMS_SCOPE') && !/readRooms[\s\S]{0,3000}appendDetections/.test(hook.slice(hook.indexOf('const readRooms'), hook.indexOf('const addRoom'))), 'reading rooms never adds geometry to the canvas');
pass('the takeoff has a Read Rooms from Plans action that leaves the canvas alone');
console.log('\nRooms from plans: all checks passed');
