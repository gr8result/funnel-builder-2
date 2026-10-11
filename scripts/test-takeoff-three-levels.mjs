// Ground, Second and Third Level through the measured path: each level's sheet is read from its own
// linework, its rooms are measured with that sheet's calibration, and walls, room floor finishes and
// Job Setup inputs all land on the level the sheet was assigned to - never on a level guessed from
// the sheet's number.
import assert from 'node:assert/strict';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectRoomBoundary, roomFloorFinish } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomGeometry.js';
import { mergeRoomReadings } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/roomSchedule.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const width = 1000, height = 800, PX_PER_MM = 0.1;
// One storey: 8 m x 6 m shell in 230 mm walls, a 90 mm partition with a swing door.
function storey(partitionX) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x, y) => { const p = (Math.round(y) * width + Math.round(x)) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
  const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
  const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };
  hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701); hline(123, 123, 877); hline(676, 123, 877); vline(123, 123, 677); vline(876, 123, 677);
  const x = partitionX;
  vline(x, 125, 299); vline(x + 9, 125, 299); hline(298, x, x + 10); vline(x, 383, 675); vline(x + 9, 383, 675); hline(383, x, x + 10);
  for (let degrees = 0; degrees <= 90; degrees += 0.25) { const a = degrees * Math.PI / 180; ink(x - 82 * Math.sin(a), 383 - 82 * Math.cos(a)); }
  for (let leaf = x - 82; leaf <= x; leaf += 1) ink(leaf, 383);
  return { width, height, data };
}
const sheets = [
  { page: 1, level: 'Ground Floor', partitionX: 500, rooms: ['GARAGE', 'FAMILY'] },
  { page: 2, level: 'Second Level', partitionX: 400, rooms: ['BED 1', 'BED 2'] },
  { page: 3, level: 'Third Level', partitionX: 600, rooms: ['RUMPUS', 'BED 5'] },
];
const sheetLevels = Object.fromEntries(sheets.map((sheet) => [sheet.page, sheet.level]));
const label = (name, x, y, page) => ({ page, name, x: x / width, y: y / height, basis: 'OBSERVED', confidence: 0.95, evidence: `Label ${name}.` });

const completedWallRuns = [], readings = [];
for (const sheet of sheets) {
  const fused = fuseSheetLinework({ page: sheet.page, walls: [], openings: [], rooms: [label(sheet.rooms[0], sheet.partitionX - 150, 400, sheet.page), label(sheet.rooms[1], sheet.partitionX + 150, 400, sheet.page)] },
    storey(sheet.partitionX), { pageNumber: sheet.page, logicalWidth: width, logicalHeight: height, pixelsPerMm: PX_PER_MM });
  assert.equal(fused.response.walls.filter((wall) => wall.category === 'exterior').length, 4, `${sheet.level}: four external walls`);
  assert.equal(fused.response.walls.filter((wall) => wall.category === 'interior').length, 1, `${sheet.level}: one internal wall`);
  assert.equal(fused.response.openings.length, 1, `${sheet.level}: the swing door`);
  for (const wall of fused.response.walls) {
    const measured = fused.geometry.walls.find((item) => item.id === wall.lineworkWallId);
    completedWallRuns.push({ id: `ai:${sheet.page}:${wall.detectionId}`, page: sheet.page, category: wall.category, nodes: measured.nodes, lengthMm: measured.lengthMm,
      thicknessMm: wall.thicknessMm, alignment: 'outer', exteriorType: wall.category === 'exterior' ? 'Brick Veneer' : '', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null, source: 'ai' });
  }
  readings.push({ page: sheet.page, level: sheet.level, rooms: fused.response.rooms.map((room, index) => detectRoomBoundary(room, { page: sheet.page, level: sheet.level, width, height, pixelsPerMm: PX_PER_MM, walls: [], openings: [], raster: null }, index)) });
}

let rooms = mergeRoomReadings([], readings);
assert.equal(rooms.length, 6, 'two rooms on each of three levels');
for (const sheet of sheets) {
  const onLevel = rooms.filter((room) => room.level === sheet.level);
  assert.deepEqual(onLevel.map((room) => room.name).sort(), [...sheet.rooms].sort(), `${sheet.level}: its own rooms`);
  assert.ok(onLevel.every((room) => room.page === sheet.page && room.detectionMethod === 'wall-linework' && !room.reviewRequired), `${sheet.level}: measured, enclosed rooms`);
  const [left, right] = sheet.rooms.map((name) => onLevel.find((room) => room.name === name));
  const leftM = (sheet.partitionX - 125) / 100, rightM = (876 - sheet.partitionX - 10) / 100;
  assert.ok(Math.abs(left.areaM2 - leftM * 5.53) <= 0.45, `${sheet.level} ${left.name}: ${left.areaM2.toFixed(2)} m2, expected ${(leftM * 5.53).toFixed(2)}`);
  assert.ok(Math.abs(right.areaM2 - rightM * 5.53) <= 0.45, `${sheet.level} ${right.name}: ${right.areaM2.toFixed(2)} m2, expected ${(rightM * 5.53).toFixed(2)}`);
}
assert.equal(new Set(rooms.map((room) => room.id)).size, 6, 'room identities are unique across levels');

// A sheet recalibrated on its own changes only its own rooms.
const third = sheets[2];
const recalibrated = rooms.map((room) => (room.page === third.page ? detectRoomBoundary({ ...room, polygon: room.polygon.map((p) => ({ x: p.x / width, y: p.y / height })) }, { page: room.page, level: room.level, width, height, pixelsPerMm: PX_PER_MM / 2, walls: [], openings: [], raster: null }) : room));
for (const room of recalibrated) {
  const before = rooms.find((item) => item.id === room.id);
  if (room.page === third.page) assert.ok(Math.abs(room.areaM2 / before.areaM2 - 4) < 0.01, 'half the pixels per millimetre is four times the area on that sheet');
  else assert.equal(room.areaM2, before.areaM2, 'other levels keep their areas');
}

// Reading the sheets again changes nothing: same rooms, same identities, corrections kept.
rooms = rooms.map((room) => (room.name === 'BED 5' ? { ...room, floorFinish: 'Carpets' } : room.name === 'GARAGE' ? { ...room, floorFinish: 'Polished Concrete' } : room.name === 'BED 1' ? { ...room, actions: ['Floor Tiling'] } : room));
const reread = mergeRoomReadings(rooms, readings);
assert.deepEqual(reread.map((room) => room.id).sort(), rooms.map((room) => room.id).sort(), 'a repeated reading adds no rooms');
assert.equal(reread.find((room) => room.name === 'BED 5').floorFinish, 'Carpets', 'a room keeps its floor finish when the sheet is read again');
assert.equal(roomFloorFinish(reread.find((room) => room.name === 'BED 1')), 'Tiles');

// Schedule and Job Setup: every level's walls and floor finishes land on that level.
const schedule = createTakeoffSchedule({ projectInfo: { projectName: 'Three levels', siteAddress: '1 Test St' }, planFilename: 'plans.pdf', totalPages: 3, currentPage: 1,
  pixelsPerMm: PX_PER_MM, completedWallRuns, sheetLevels, scheduleState: { aiAnalysis: { schemaVersion: 'ai-takeoff-analysis.v1', rooms: reread, review: [] } } });
const finishes = schedule.measurementRecords.filter((record) => record.kind === 'floorFinish');
assert.equal(finishes.length, 3, 'one floor-finish record per room given a finish');
const finishOf = (name) => finishes.find((record) => record.label.startsWith(name));
assert.deepEqual([finishOf('BED 5').level, finishOf('BED 5').category], ['Third Level', 'Carpets']);
assert.deepEqual([finishOf('GARAGE').level, finishOf('GARAGE').category], ['Ground Floor', 'Polished Concrete']);
assert.deepEqual([finishOf('BED 1').level, finishOf('BED 1').category], ['Second Level', 'Tiles']);
assert.ok(Math.abs(finishOf('BED 5').quantity - reread.find((room) => room.name === 'BED 5').areaM2) < 1e-9, 'the finish quantity is the room\'s measured floor area');
const payload = createJobSetupPayload(schedule, { sheetLevels });
const fields = payload.dataInputFields;
for (const prefix of ['lower', 'upper', 'third']) {
  assert.ok(Math.abs(fields[`${prefix}Internal90mmWallsLm`] - 5.53) <= 0.15, `${prefix}: internal wall length ${fields[`${prefix}Internal90mmWallsLm`]}`);
  const external = Object.entries(fields).filter(([key, value]) => key.startsWith(prefix) && /BrickVeneer\d+mmWallsLm$/.test(key) && value > 0);
  assert.equal(external.length, 1, `${prefix}: external walls import to one system row`);
  assert.ok(Math.abs(external[0][1] - 27.1) <= 1.2, `${prefix}: external wall length ${external[0][1]}`);
}
// A two-level job leaves the third level empty.
const twoLevels = createJobSetupPayload(createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 3, currentPage: 1, pixelsPerMm: PX_PER_MM,
  completedWallRuns: completedWallRuns.filter((wall) => wall.page !== 3), sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' } }), { sheetLevels: { 1: 'Ground Floor', 2: 'Second Level' } });
assert.equal(twoLevels.dataInputFields.thirdInternal90mmWallsLm, undefined);

console.log('takeoff three levels: walls, rooms, finishes and Job Setup inputs per level ok');
