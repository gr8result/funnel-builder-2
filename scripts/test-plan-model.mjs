// Plan model: connected walls, junctions, openings on walls, rooms from the wall network, edits
// that survive analysis, and levels kept apart. Every expected number is worked out by hand from
// the fixture's dimensions (mm), not read back from the code.
import assert from 'node:assert/strict';
import {
  addWall, addOpening, addSeparator, computeRooms, createLevel, createPlanModel, addLevelToModel, withLevel, deleteWall, deleteOpening,
  describeLevel, drawWall, mergeDetections, moveNode, nameRoomAt, openingPosition, updateWall, wallCategories, wallLengthMm, wallNetLengthMm,
} from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const build = (walls, level = createLevel({ id: 'ground' })) => walls.reduce((current, spec) => addWall(current, spec).level, level);
const nodeAt = (level, x, y) => Object.values(level.nodes).find((node) => near(node.x, x, 1e-6) && near(node.y, y, 1e-6));
const wallsAt = (level, node) => Object.values(level.walls).filter((wall) => wall.nodeIds.includes(node.id));
const roomWithArea = (rooms, m2, tolerance = 1e-6) => rooms.find((room) => near(room.areaM2, m2, tolerance));

// A 8000 x 3000 box of 270 mm external walls, split by a 90 mm wall at x = 4000.
const box = () => build([
  { a: { x: 0, y: 0 }, b: { x: 8000, y: 0 }, thicknessMm: 270 },
  { a: { x: 8000, y: 0 }, b: { x: 8000, y: 3000 }, thicknessMm: 270 },
  { a: { x: 8000, y: 3000 }, b: { x: 0, y: 3000 }, thicknessMm: 270 },
  { a: { x: 0, y: 3000 }, b: { x: 0, y: 0 }, thicknessMm: 270 },
  // The partition is drawn stopping at the external walls' inner faces, as a measured wall does.
  { a: { x: 4000, y: 135 }, b: { x: 4000, y: 2865 }, thicknessMm: 90 },
]);

// ---- L, T and the rooms between them ------------------------------------------------------------
{
  const level = box();
  const corner = nodeAt(level, 0, 0);
  assert.ok(corner, 'L: the corner is one node');
  assert.equal(wallsAt(level, corner).length, 2, 'L: both walls share the corner node');
  const top = nodeAt(level, 4000, 0), bottom = nodeAt(level, 4000, 3000);
  assert.ok(top && bottom, 'T: a partition stopping at a wall face reaches the wall centreline');
  assert.equal(wallsAt(level, top).length, 2, 'T: the through wall and the stem share the junction');
  const partition = Object.values(level.walls).find((wall) => wall.thicknessMm === 90);
  assert.equal(wallLengthMm(level, partition), 3000, 'T stem measured centreline to centreline');
  assert.equal(wallNetLengthMm(level, partition), 3000 - 135 - 135, 'T stem as framed: face to face');
  const rooms = computeRooms(level);
  assert.equal(rooms.length, 2, 'two rooms enclosed');
  // Each room's floor: x 135..3955, y 135..2865 = 3820 x 2730.
  for (const room of rooms) assert.ok(near(room.areaM2, 3.820 * 2.730), `room floor to inner wall faces (${room.areaM2})`);
  const categories = wallCategories(level);
  assert.equal(categories[partition.id], 'interior', 'the partition is internal');
  assert.equal(Object.values(categories).filter((value) => value === 'exterior').length, 4, 'the four outside walls are external');
  const summary = describeLevel(level);
  assert.equal(summary.freeEnds, 0, 'no free wall ends in a closed box');
  assert.equal(summary.exteriorLm, 22, 'external centreline length 2 x (8 + 3) m');
}

// ---- X: two walls crossing share a node; four rooms -------------------------------------------
{
  const level = build([
    { a: { x: 0, y: 0 }, b: { x: 6000, y: 0 }, thicknessMm: 100 }, { a: { x: 6000, y: 0 }, b: { x: 6000, y: 6000 }, thicknessMm: 100 },
    { a: { x: 6000, y: 6000 }, b: { x: 0, y: 6000 }, thicknessMm: 100 }, { a: { x: 0, y: 6000 }, b: { x: 0, y: 0 }, thicknessMm: 100 },
    { a: { x: 3000, y: 0 }, b: { x: 3000, y: 6000 }, thicknessMm: 100 }, { a: { x: 0, y: 3000 }, b: { x: 6000, y: 3000 }, thicknessMm: 100 },
  ]);
  const centre = nodeAt(level, 3000, 3000);
  assert.ok(centre, 'X: the crossing is a node');
  assert.equal(wallsAt(level, centre).length, 2, 'X: both walls run through the shared node');
  const rooms = computeRooms(level);
  assert.equal(rooms.length, 4, 'X: four rooms');
  // Each quarter: 50..2950 in both directions = 2900 x 2900.
  for (const room of rooms) assert.ok(near(room.areaM2, 2.9 * 2.9), `X: quarter floor ${room.areaM2}`);
}

// ---- Angled walls: a triangle room and a 45-degree corner -----------------------------------------
{
  // Right triangle with legs 4000 and 3000 (hypotenuse 5000), all walls 0 mm thick: area 6 m2.
  const level = build([
    { a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thicknessMm: 0 }, { a: { x: 4000, y: 0 }, b: { x: 0, y: 3000 }, thicknessMm: 0 }, { a: { x: 0, y: 3000 }, b: { x: 0, y: 0 }, thicknessMm: 0 },
  ]);
  const rooms = computeRooms(level);
  assert.equal(rooms.length, 1);
  assert.ok(near(rooms[0].areaM2, 6), `angled: triangle area (${rooms[0].areaM2})`);
  // Same triangle with 100 mm walls: the floor is the triangle shrunk by 50 mm on every side. Its
  // inradius is (3 + 4 - 5) / 2 = 1 m, so the floor is similar with ratio (1000 - 50) / 1000.
  const thick = build([
    { a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thicknessMm: 100 }, { a: { x: 4000, y: 0 }, b: { x: 0, y: 3000 }, thicknessMm: 100 }, { a: { x: 0, y: 3000 }, b: { x: 0, y: 0 }, thicknessMm: 100 },
  ]);
  assert.ok(near(computeRooms(thick)[0].areaM2, 6 * 0.95 * 0.95, 1e-9), 'angled: floor inset by half the wall thickness');
  // A diagonal wall crossing a straight one shares a node at the crossing.
  const crossing = build([{ a: { x: 0, y: 0 }, b: { x: 4000, y: 4000 } }, { a: { x: 0, y: 4000 }, b: { x: 4000, y: 0 } }]);
  assert.ok(nodeAt(crossing, 2000, 2000), 'angled X: crossing node at (2000, 2000)');
}

// ---- A wall along an existing wall is that wall --------------------------------------------------------
{
  let level = box();
  const before = Object.keys(level.walls).length;
  level = addWall(level, { a: { x: 1000, y: 20 }, b: { x: 3000, y: 20 }, thicknessMm: 270 }).level;
  assert.equal(Object.keys(level.walls).length, before, 'collinear: a wall wholly along an existing wall adds nothing');
  level = addWall(level, { a: { x: 8000, y: 3000 }, b: { x: 10000, y: 3000 }, thicknessMm: 270 }).level;
  assert.equal(Object.keys(level.walls).length, before + 1, 'collinear: the part beyond the existing wall is added');
  assert.equal(computeRooms(level).length, 2, 'the extension leads nowhere and encloses nothing');
}

// ---- Moving a junction moves every wall and room it belongs to ------------------------------------------
{
  let level = box();
  const top = nodeAt(level, 4000, 0), bottom = nodeAt(level, 4000, 3000);
  level = moveNode(level, top.id, { x: 5000, y: 0 });
  level = moveNode(level, bottom.id, { x: 5000, y: 3000 });
  const partition = Object.values(level.walls).find((wall) => wall.thicknessMm === 90);
  assert.ok(partition.edited && partition.locked, 'moved walls are the estimator\'s');
  const areas = computeRooms(level).map((room) => room.areaM2).sort((a, b) => a - b);
  // Left room x 135..4955 = 4820, right room 5045..7865 = 2820; both 2730 deep.
  assert.ok(near(areas[0], 2.820 * 2.730) && near(areas[1], 4.820 * 2.730), `rooms follow the moved junction (${areas})`);
  // The external top wall still runs 0..8000 through the moved T node.
  const topWall = Object.values(level.walls).find((wall) => wall.nodeIds.includes(top.id) && wall.thicknessMm === 270);
  assert.equal(wallLengthMm(level, topWall), 8000, 'the through wall keeps its length when the T slides along it');
}

// ---- Openings live on their wall --------------------------------------------------------------------
{
  let level = box();
  const partition = Object.values(level.walls).find((wall) => wall.thicknessMm === 90);
  const added = addOpening(level, { x: 4030, y: 1500, widthMm: 820, kind: 'door' });
  level = added.level;
  const door = level.openings[added.openingId];
  assert.equal(door.wallId, partition.id, 'a door is hosted on the wall it sits in');
  assert.ok(near(openingPosition(level, door).x, 4000) && near(openingPosition(level, door).y, 1500), 'placed on the wall centreline');
  level = moveNode(level, nodeAt(level, 4000, 0).id, { x: 4500, y: 0 });
  level = moveNode(level, nodeAt(level, 4000, 3000).id, { x: 4500, y: 3000 });
  assert.ok(near(openingPosition(level, door).x, 4500), 'the door moves with its wall');
  assert.equal(computeRooms(level).length, 2, 'a door does not open a room into its neighbour (floor runs to the wall faces)');
}

// ---- Drawing over a wrong wall replaces it; the wrong one never comes back ----------------------------------
{
  let level = mergeDetections(createLevel({ id: 'ground' }), { walls: [
    { a: { x: 0, y: 0 }, b: { x: 8000, y: 0 }, thicknessMm: 270, detectionKey: 'det-top' },
    { a: { x: 8000, y: 0 }, b: { x: 8000, y: 3000 }, thicknessMm: 270, detectionKey: 'det-right' },
    { a: { x: 8000, y: 3000 }, b: { x: 0, y: 3000 }, thicknessMm: 270, detectionKey: 'det-bottom' },
    { a: { x: 0, y: 3000 }, b: { x: 0, y: 0 }, thicknessMm: 270, detectionKey: 'det-left' },
    // Detected 400 mm out of place.
    { a: { x: 3600, y: 0 }, b: { x: 3600, y: 3000 }, thicknessMm: 90, detectionKey: 'det-partition' },
  ], openings: [{ x: 3600, y: 1500, widthMm: 820, kind: 'door', detectionKey: 'det-door' }] }).level;
  assert.equal(Object.keys(level.walls).length, 5);
  const wrong = Object.values(level.walls).find((wall) => wall.detectionKey === 'det-partition');
  // The estimator draws the partition where it really is; it runs along the wrong one.
  const drawn = drawWall(level, { a: { x: 3700, y: 0 }, b: { x: 3700, y: 3000 }, thicknessMm: 90 });
  level = drawn.level;
  assert.deepEqual(drawn.replacedIds, [wrong.id], 'the wrong detected wall is replaced');
  assert.equal(Object.values(level.walls).filter((wall) => wall.thicknessMm === 90).length, 1, 'only one partition remains: no double count');
  const door = Object.values(level.openings)[0];
  assert.equal(door.wallId, drawn.wallIds[0], 'the door moved onto the drawn wall');
  // Analysis runs again and reports the same wrong wall (and also with a new detection key).
  const rerun = { walls: [
    { a: { x: 0, y: 0 }, b: { x: 8000, y: 0 }, thicknessMm: 270, detectionKey: 'det-top' },
    { a: { x: 3600, y: 0 }, b: { x: 3600, y: 3000 }, thicknessMm: 90, detectionKey: 'det-partition' },
    { a: { x: 3590, y: 10 }, b: { x: 3590, y: 2990 }, thicknessMm: 90, detectionKey: 'other-run-17' },
  ], openings: [{ x: 3600, y: 1500, widthMm: 820, kind: 'door', detectionKey: 'det-door' }] };
  const merged = mergeDetections(level, rerun);
  assert.equal(merged.report.wallsRejectedBefore, 2, 'a replaced detection is not added again, under its key or a new one');
  assert.equal(merged.report.wallsAlreadyPresent, 1, 'a detection already in the level is not added twice');
  assert.equal(merged.report.wallsAdded, 0);
  assert.equal(merged.report.openingsAlreadyPresent, 1, 'the door already on the drawn wall is not duplicated');
  assert.equal(Object.keys(merged.level.walls).length, Object.keys(level.walls).length, 'wall count unchanged by re-analysis');
  // Running the same analysis twice changes nothing the second time.
  const twice = mergeDetections(merged.level, rerun);
  assert.deepEqual(twice.level.walls, merged.level.walls, 'merging is idempotent');
}

// ---- Deleting a detection; edits that survive analysis ---------------------------------------------------------
{
  let level = mergeDetections(createLevel({ id: 'ground' }), { walls: [
    { a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, thicknessMm: 90, detectionKey: 'a' },
    { a: { x: 0, y: 2000 }, b: { x: 5000, y: 2000 }, thicknessMm: 90, detectionKey: 'ghost' },
  ], openings: [{ x: 2500, y: 0, widthMm: 900, kind: 'window', detectionKey: 'win' }] }).level;
  const ghost = Object.values(level.walls).find((wall) => wall.detectionKey === 'ghost');
  level = deleteWall(level, ghost.id);
  level = deleteOpening(level, Object.keys(level.openings)[0]);
  const again = mergeDetections(level, { walls: [{ a: { x: 0, y: 2000 }, b: { x: 5000, y: 2000 }, thicknessMm: 90, detectionKey: 'ghost' }],
    openings: [{ x: 2510, y: 0, widthMm: 900, kind: 'window', detectionKey: 'win-run-2' }] });
  assert.equal(again.report.wallsRejectedBefore, 1, 'a deleted wall does not reappear');
  assert.equal(again.report.openingsRejectedBefore, 1, 'a deleted window does not reappear');
  // A wall the estimator re-sized keeps its size through re-analysis.
  const kept = Object.values(level.walls).find((wall) => wall.detectionKey === 'a');
  level = updateWall(level, kept.id, { thicknessMm: 110, category: 'interior' });
  const after = mergeDetections(level, { walls: [{ a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, thicknessMm: 90, detectionKey: 'a' }] }).level;
  assert.equal(after.walls[kept.id].thicknessMm, 110, 'the estimator\'s thickness survives analysis');
  assert.equal(wallCategories(after)[kept.id], 'interior', 'the estimator\'s category wins');
}

// ---- Room names follow their walls; separators close open plan ----------------------------------------------
{
  let level = box();
  level = nameRoomAt(level, { x: 2000, y: 1500 }, 'Bedroom 1').level;
  level = nameRoomAt(level, { x: 6000, y: 1500 }, 'Bedroom 2').level;
  level = moveNode(level, nodeAt(level, 4000, 0).id, { x: 4400, y: 0 });
  level = moveNode(level, nodeAt(level, 4000, 3000).id, { x: 4400, y: 3000 });
  const names = computeRooms(level).map((room) => `${room.name}:${room.areaM2.toFixed(4)}`).sort();
  // Bedroom 1 x 135..4355 = 4220; Bedroom 2 4445..7865 = 3420; both 2730 deep.
  assert.deepEqual(names, [`Bedroom 1:${(4.22 * 2.73).toFixed(4)}`, `Bedroom 2:${(3.42 * 2.73).toFixed(4)}`], 'names stay with their rooms after an edit');
  // Open plan: one long room until a separator divides it; the separator is not a wall.
  let open = build([
    { a: { x: 0, y: 0 }, b: { x: 10000, y: 0 }, thicknessMm: 0 }, { a: { x: 10000, y: 0 }, b: { x: 10000, y: 4000 }, thicknessMm: 0 },
    { a: { x: 10000, y: 4000 }, b: { x: 0, y: 4000 }, thicknessMm: 0 }, { a: { x: 0, y: 4000 }, b: { x: 0, y: 0 }, thicknessMm: 0 },
  ]);
  assert.equal(computeRooms(open).length, 1);
  open = addSeparator(open, { a: { x: 6000, y: 0 }, b: { x: 6000, y: 4000 } }).level;
  const parts = computeRooms(open).map((room) => room.areaM2).sort((a, b) => a - b);
  assert.deepEqual(parts, [16, 24], 'a separator divides an open-plan space');
  assert.equal(describeLevel(open).walls, 4, 'a separator is not a wall');
}

// ---- Levels are separate --------------------------------------------------------------------------------------
{
  let model = createPlanModel();
  model = addLevelToModel(model, { id: 'ground', name: 'Ground Floor', page: 5, pixelsPerMm: 0.0899 });
  model = addLevelToModel(model, { id: 'upper', name: 'Upper Floor', page: 4, pixelsPerMm: 0.0899 });
  model = withLevel(model, 'ground', (level) => addWall(level, { a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thicknessMm: 270 })).model;
  model = withLevel(model, 'upper', (level) => addWall(level, { a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thicknessMm: 90 })).model;
  assert.equal(Object.keys(model.levels.ground.walls).length, 1);
  assert.equal(Object.values(model.levels.upper.walls)[0].thicknessMm, 90, 'the same position on another level is another wall');
  const ground = model.levels.ground;
  const edited = withLevel(model, 'upper', (level) => deleteWall(level, Object.keys(level.walls)[0])).model;
  assert.equal(edited.levels.ground, ground, 'editing one level leaves the other untouched');
  assert.equal(Object.keys(edited.levels.upper.walls).length, 0);
}

// ---- Operations never change their input -------------------------------------------------------------------
{
  const level = box();
  const snapshot = JSON.stringify(level);
  moveNode(level, nodeAt(level, 0, 0).id, { x: -100, y: -100 });
  drawWall(level, { a: { x: 2000, y: 0 }, b: { x: 2000, y: 3000 }, thicknessMm: 90 });
  deleteWall(level, Object.keys(level.walls)[0]);
  assert.equal(JSON.stringify(level), snapshot, 'levels are values: every operation returns a new one');
}

console.log('plan model: all checks passed');
