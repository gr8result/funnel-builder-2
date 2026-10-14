// What AI Plan Takeoff hands to the rest of the platform, read the way the rest of the platform
// reads it: the one project room list and the flooring rooms (Client Selections), the Job Setup
// payload, and the Takeoff Schedule's measurement records (Quotation Builder). Nothing here edits
// those modules; it pins the shape the takeoff saves so that they see each room and each floor once.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-output-contract.mjs
import assert from 'node:assert/strict';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectRoomBoundary } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { stampSheetScales } from '../components/construction-estimation/ai-plan-takeoff/sheetScale.js';
import { takeoffProjectRooms, projectLocations } from '../lib/builders/projectLocations.js';
import { measuredFlooringRooms } from '../lib/builders/carpetSelection.js';

const pass = (message) => console.log(`PASS ${message}`);
const width = 1000, height = 800, pixelsPerMm = 0.1;
// 8 m x 6 m shell (230 mm walls) with one 90 mm partition and an 820 mm doorway whose swing is drawn:
// BED 1 on the left, and one open space on the right that the drawing names KITCHEN and DINING.
const data = new Uint8ClampedArray(width * height * 4).fill(255);
const ink = (x, y) => { const p = (Math.round(y) * width + Math.round(x)) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };
hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701); hline(123, 123, 877); hline(676, 123, 877); vline(123, 123, 677); vline(876, 123, 677);
vline(500, 125, 299); vline(509, 125, 299); hline(298, 500, 510); vline(500, 383, 675); vline(509, 383, 675); hline(383, 500, 510);
for (let degrees = 0; degrees <= 90; degrees += 0.25) { const a = degrees * Math.PI / 180; ink(500 - 82 * Math.sin(a), 383 - 82 * Math.cos(a)); }
for (let y = 301; y <= 383; y += 1) ink(418, y);
const named = (name, x, y) => ({ page: 1, name, x: x / width, y: y / height, basis: 'OBSERVED', confidence: 0.9, evidence: `Room name "${name}" lettered on the sheet.` });
const fused = fuseSheetLinework({ page: 1, walls: [], openings: [], rooms: [named('BED 1', 300, 400), named('KITCHEN', 650, 300), named('DINING', 700, 520)] },
  { width, height, data }, { pageNumber: 1, logicalWidth: width, logicalHeight: height, pixelsPerMm });
const rooms = fused.response.rooms.map((item, index) => detectRoomBoundary(item, { page: 1, level: 'Ground Floor', width, height, pixelsPerMm, walls: [], openings: [], raster: null }, index));
const openSpaceM2 = 3.67 * 5.53, bedM2 = 3.77 * 5.53;

// --- The room list the takeoff saves -------------------------------------------------------------
assert.deepEqual(rooms.map((room) => room.name).sort(), ['BED 1', 'DINING', 'KITCHEN'], 'one room per name on the drawing, none added for the open space');
assert.equal(new Set(rooms.map((room) => room.id)).size, rooms.length, 'room ids are unique');
const [bed, kitchen, dining] = ['BED 1', 'KITCHEN', 'DINING'].map((name) => rooms.find((room) => room.name === name));
assert.ok(Math.abs(kitchen.areaM2 - openSpaceM2) <= 0.5 && kitchen.polygon.length >= 4, 'the open space is measured once, under its first name');
assert.deepEqual([kitchen.openPlanWith, dining.openPlanIn], [['DINING'], 'KITCHEN'], 'each name says which rooms it is open to');
assert.ok(dining.areaM2 === null && !dining.polygon?.length, 'the other name has no area and no boundary of its own');
assert.deepEqual([dining.reviewRequired, dining.reviewReasons], [false, []], 'and that is not reported as a missing boundary');
assert.ok(Math.abs(rooms.reduce((sum, room) => sum + (room.areaM2 || 0), 0) - (openSpaceM2 + bedM2)) <= 1, 'the floor of the level adds up once');
pass('an open-plan space is one measured floor under its first name; every name stays in the room list');

const aiAnalysis = { rooms: rooms.map((room) => (room.name === 'BED 1' ? { ...room, floorFinish: 'Carpets' } : room.name === 'KITCHEN' ? { ...room, floorFinish: 'Hybrid' } : room)) };
const job = { pixelsPerMm, placedOpenings: [], completedFloorplans: [], completedAreas: [], aiAnalysis };
const workbook = { aiPlanTakeoffJob: job };

// --- Client Selections: the one project room list ------------------------------------------------
const projectRooms = takeoffProjectRooms(workbook).map((room) => room.name);
assert.deepEqual([...projectRooms].sort(), ['Bedroom 1', 'Dining', 'Kitchen'], 'Client Selections sees each room once and no combined room');
const locations = projectLocations({ workbook }).map((item) => item.name || item);
assert.equal(locations.filter((name) => /kitchen|dining/i.test(String(name))).length, 2, `no duplicate or combined location: ${JSON.stringify(locations)}`);
pass('the project room list has Kitchen and Dining once each');

// --- Client Selections: flooring rooms and their areas -------------------------------------------
const flooring = measuredFlooringRooms(workbook);
const flooringByName = Object.fromEntries(flooring.map((room) => [room.name, room.areaM2]));
assert.ok(Math.abs(flooringByName.KITCHEN - openSpaceM2) <= 0.5 && Math.abs(flooringByName['BED 1'] - bedM2) <= 0.5, `flooring areas: ${JSON.stringify(flooringByName)}`);
assert.equal(flooringByName.DINING, '', 'the room measured under another name carries no floor area to be counted again');
assert.ok(Math.abs(flooring.reduce((sum, room) => sum + (Number(room.areaM2) || 0), 0) - (openSpaceM2 + bedM2)) <= 1, 'flooring areas add up to the floor once');
pass('flooring rooms carry the open space once');

// --- Takeoff Schedule and Job Setup --------------------------------------------------------------
const schedule = createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 1, currentPage: 1, pixelsPerMm, aiAnalysis, sheetLevels: { 1: 'Ground Floor' } });
const finishes = schedule.measurementRecords.filter((record) => record.kind === 'floorFinish');
assert.deepEqual(finishes.map((record) => `${record.roomId}|${record.category}`).sort(), [`${bed.id}|Carpets`, `${kitchen.id}|Hybrid`].sort(), 'one floor-finish record per measured room');
assert.equal(new Set(schedule.measurementRecords.map((record) => record.id)).size, schedule.measurementRecords.length, 'measurement record ids are unique');
const finishTotal = finishes.reduce((sum, record) => sum + (Number(record.quantity) || 0), 0);
assert.ok(finishTotal <= openSpaceM2 + bedM2 + 1, `floor finishes never exceed the floor: ${finishTotal.toFixed(2)} m2`);
assert.ok(finishes.every((record) => record.unit === 'm2' && (record.quantity === null || record.quantity > 0)), 'a finish quantity is a measured area, or absent while the room awaits review');
const payload = createJobSetupPayload(schedule, {});
assert.ok(payload && typeof payload === 'object', 'the Job Setup payload is built from the same schedule');
assert.doesNotThrow(() => JSON.parse(JSON.stringify({ job, schedule, payload })), 'everything handed on is plain data that survives a save');
pass('schedule records and the Job Setup payload are built from the same rooms, each floor once');

// --- Sheets with their own scale ------------------------------------------------------------------
// A measured area on a sheet calibrated differently from the takeoff's working scale is saved with
// that sheet's scale, so a module holding only the saved object can measure it.
const square = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
const calibrations = { 1: { pixelsPerMm: 0.1 }, 2: { pixelsPerMm: 0.05 } };
const [first, second] = stampSheetScales([{ id: 'a1', page: 1, nodes: square }, { id: 'a2', page: 2, nodes: square }], 0.1, calibrations);
// The scale to measure a saved object with: its own where it carries one, else the takeoff's.
const areaM2 = (item) => 200 * 200 / ((item.sheetPixelsPerMm || 0.1) ** 2) / 1e6;
assert.deepEqual([first.sheetPixelsPerMm, second.sheetPixelsPerMm], [undefined, 0.05], 'only the object on the differently scaled sheet is marked');
assert.deepEqual([areaM2(first), areaM2(second)].map((value) => +value.toFixed(6)), [4, 16], 'the same drawn square is 4 m2 at 1:100 and 16 m2 on the smaller-scale sheet');
pass('saved objects carry their own sheet scale');

// --- Nothing unconfirmed becomes a quantity ------------------------------------------------------
// A room whose detected boundary still needs review (the laundry with its tub bench) has an area on
// screen but no floor quantity; once corrected and confirmed it has one. An opening found from the
// linework with its type unconfirmed is listed for review and counted nowhere until confirmed.
const draft = { ...bed, id: 'laundry', name: 'LDRY', floorFinish: 'Tiles', reviewRequired: true, areaM2: 3.34 };
const confirmedLaundry = { ...draft, reviewRequired: false, areaM2: 5.09 };
const finishOf = (room) => createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 1, currentPage: 1, pixelsPerMm, aiAnalysis: { rooms: [room] }, sheetLevels: { 1: 'Ground Floor' } }).measurementRecords.find((record) => record.roomId === 'laundry' && record.kind === 'floorFinish');
assert.equal(finishOf(draft).quantity, null, 'an unconfirmed 3.34 m2 boundary is not a floor quantity');
assert.equal(finishOf(confirmedLaundry).quantity, 5.09, 'the corrected, confirmed 5.09 m2 is');
const door = { id: 'd1', page: 1, type: 'door', openingClass: 'Internal Door', x: 600, y: 300, widthMm: 2400, heightMm: 2100, itemTag: 'linework:gt-1', subType: 'Robe sliding door', needsClassification: true, typeEvidence: 'Two thin door panels across a recess.' };
const unconfirmedSchedule = createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 1, currentPage: 1, pixelsPerMm, placedOpenings: [door], sheetLevels: { 1: 'Ground Floor' } });
const confirmedSchedule = createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 1, currentPage: 1, pixelsPerMm, placedOpenings: [{ ...door, needsClassification: undefined }], sheetLevels: { 1: 'Ground Floor' } });
assert.deepEqual(unconfirmedSchedule.unconfirmedOpenings.map((item) => item.id), ['d1'], 'the unconfirmed door is listed for review');
assert.ok(!JSON.stringify(unconfirmedSchedule.measurementRecords).includes('"d1"') && JSON.stringify(confirmedSchedule.measurementRecords).includes('d1'), 'and counted only once confirmed');
pass('unconfirmed room boundaries and opening types are never quantities');

console.log('takeoff output contract: rooms, floor areas, schedule records and sheet scales ok');
