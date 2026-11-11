// External walls are a hard edge for AI-read outlines: rooms stop at the inside face, the footprint at the
// outside face (except into a drawn outdoor area), open-sided alfrescos are closed at the under-roof
// reading, alfrescos outside the footprint count under roof, and the canvas snapper keeps corners inside.
import assert from 'node:assert/strict';
import { exteriorWallLines, containOutline, containCorner } from '../components/construction-estimation/ai-plan-takeoff/geometry/exteriorContainment.js';
import { roomSnapTargets, snapRoomVertex, keepRoomCornerInside } from '../components/construction-estimation/ai-plan-takeoff/roomSnapping.js';
import { traceOutlinedArea } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
import { buildingOutlines } from '../components/construction-estimation/ai-plan-takeoff/geometry/buildingOutline.js';
import { createTakeoffSchedule, flattenScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const area = (polygon) => Math.abs(polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / 1e6;
const wall = (a, b, thicknessMm = 270) => ({ nodes: [a, b], thicknessMm });

// A 10 m x 8 m house: external walls 270 mm on centrelines x=0, x=10000, y=0, y=8000 (inner faces 135 in).
// The south wall has a 2.4 m door gap from x=4000 to x=6400.
const house = [
  wall({ x: 0, y: 0 }, { x: 4000, y: 0 }), wall({ x: 6400, y: 0 }, { x: 10000, y: 0 }),
  wall({ x: 10000, y: 0 }, { x: 10000, y: 8000 }), wall({ x: 10000, y: 8000 }, { x: 0, y: 8000 }), wall({ x: 0, y: 8000 }, { x: 0, y: 0 }),
];
const door = { x: 5200, y: 0 };
const lines = exteriorWallLines(house, { openings: [door] });
assert.equal(lines.length, 4, 'the gap with a door in it is closed: the south wall is one wall line');
assert.equal(exteriorWallLines(house).length, 5, 'a gap with no door or window found in it is not closed (it may be building between two wings)');

// 1. A room that leaks 1.5 m out of the door gap into the yard is pulled back onto the inside face.
const leaking = [{ x: 3000, y: -1500 }, { x: 7000, y: -1500 }, { x: 7000, y: 3000 }, { x: 3000, y: 3000 }];
const fixed = containOutline(leaking, lines, { face: 'inner', anchor: { x: 5000, y: 1500 } });
assert.equal(fixed.status, 'contained');
assert.ok(fixed.polygon.every((p) => p.y >= 135 - 1), 'no corner past the inside face of the south wall');
assert.ok(near(area(fixed.polygon), 4 * (3 - 0.135), 0.01), `room is 4 m x 2.865 m (${area(fixed.polygon)})`);

// 2. A room corner taken diagonally out past the house corner goes back to the inside corner.
const corner = [{ x: 6000, y: 4000 }, { x: 10900, y: 4000 }, { x: 10900, y: 8900 }, { x: 6000, y: 8900 }];
const cornerFixed = containOutline(corner, lines, { face: 'inner', anchor: { x: 8000, y: 6000 } });
assert.equal(cornerFixed.status, 'contained');
assert.ok(cornerFixed.polygon.some((p) => near(p.x, 9865) && near(p.y, 7865)), 'the far corner lands on the inside corner of the walls');
assert.ok(cornerFixed.polygon.every((p) => p.x <= 9866 && p.y <= 7866));

// 3. A room already inside the walls is left alone.
const inside = [{ x: 135, y: 135 }, { x: 4000, y: 135 }, { x: 4000, y: 4000 }, { x: 135, y: 4000 }];
assert.equal(containOutline(inside, lines, { face: 'inner', anchor: { x: 2000, y: 2000 } }).status, 'unchanged');

// 4. An L-shaped room wrapping a notch in the building is not cut: the notch walls are on its outside
// only within their own length. Building: 10 x 10 with a 4 x 4 notch out of the north-east corner.
const notched = exteriorWallLines([
  wall({ x: 0, y: 0 }, { x: 10000, y: 0 }), wall({ x: 10000, y: 0 }, { x: 10000, y: 6000 }), wall({ x: 10000, y: 6000 }, { x: 6000, y: 6000 }),
  wall({ x: 6000, y: 6000 }, { x: 6000, y: 10000 }), wall({ x: 6000, y: 10000 }, { x: 0, y: 10000 }), wall({ x: 0, y: 10000 }, { x: 0, y: 0 }),
]);
const lRoom = [{ x: 3000, y: 3000 }, { x: 9865, y: 3000 }, { x: 9865, y: 5865 }, { x: 5865, y: 5865 }, { x: 5865, y: 9865 }, { x: 3000, y: 9865 }];
assert.equal(containOutline(lRoom, notched, { face: 'inner', anchor: { x: 4000, y: 8000 } }).status, 'unchanged', 'an L room around the notch keeps its shape');

// 5. An outline that is mostly outside the walls is not used.
const mostlyOut = [{ x: 3000, y: -6000 }, { x: 7000, y: -6000 }, { x: 7000, y: 500 }, { x: 3000, y: 500 }];
const out = containOutline(mostlyOut, lines, { face: 'inner', anchor: { x: 5000, y: 300 } });
assert.equal(out.status, 'rejected', `mostly-outside outline rejected (${out.reason})`);

// 6. Footprint: a reading that bulges 1.5 m out through the south wall (where the door gap is) is pulled
// back to the outer face; the same bulge over a drawn alfresco is kept, because the roof carries on over it.
// A notched building's footprint keeps its shape (a corner at the end of a wall is another wing's corner).
const bulge = [{ x: -135, y: -135 }, { x: 3000, y: -135 }, { x: 3000, y: -1500 }, { x: 7000, y: -1500 }, { x: 7000, y: -135 }, { x: 10135, y: -135 }, { x: 10135, y: 8135 }, { x: -135, y: 8135 }];
const fp = containOutline(bulge, lines, { face: 'outer' });
assert.equal(fp.status, 'contained');
assert.ok(fp.polygon.every((p) => p.y >= -136), 'footprint stops at the outer face of the south wall');
assert.ok(near(area(fp.polygon), 10.27 * 8.27, 0.05), `footprint = house to outer faces (${area(fp.polygon)})`);
const alfresco = [{ x: 3000, y: -1500 }, { x: 7000, y: -1500 }, { x: 7000, y: -135 }, { x: 3000, y: -135 }];
assert.equal(containOutline(bulge, lines, { face: 'outer', allowed: [alfresco] }).status, 'unchanged', 'the alfresco under the roof stays in the footprint');
const notchedFootprint = [{ x: -135, y: -135 }, { x: 10135, y: -135 }, { x: 10135, y: 6135 }, { x: 6135, y: 6135 }, { x: 6135, y: 10135 }, { x: -135, y: 10135 }];
assert.equal(containOutline(notchedFootprint, notched, { face: 'outer' }).status, 'unchanged', 'a notched footprint keeps both wings');

// 7. Dragging a corner out of the house on the canvas: it stops at the inside face.
assert.deepEqual((({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }))(containCorner({ x: 12000, y: 5000 }, lines, { x: 5000, y: 4000 })), { x: 9865, y: 5000 });
assert.equal(containCorner({ x: 9000, y: 5000 }, lines, { x: 5000, y: 4000 }).clipped, false, 'a corner inside is not moved');

// 8. Canvas snapper (plan pixels, 0.1 px/mm): wall junctions come first; dragged corners stay inside.
const ppm = 0.1;
const px = (p) => ({ x: p.x * ppm, y: p.y * ppm });
const canvasWalls = house.map((w, i) => ({ id: `w${i}`, category: 'exterior', alignment: 'center', thicknessMm: w.thicknessMm, nodes: w.nodes.map(px) }));
const targets = roomSnapTargets(canvasWalls, ppm);
assert.ok(targets.junctions.some((p) => near(p.x, 986.5, 0.5) && near(p.y, 786.5, 0.5)), 'the inside corner where two wall faces meet is a junction target');
const snapped = snapRoomVertex({ x: 984, y: 784 }, targets, 6);
assert.equal(snapped.snapped, 'junction');
const room = [px({ x: 6000, y: 4000 }), px({ x: 9865, y: 4000 }), px({ x: 9865, y: 7865 }), px({ x: 6000, y: 7865 })];
const kept = keepRoomCornerInside({ x: 1150, y: 600 }, room, targets);
assert.equal(kept.clipped, true);
assert.ok(near(kept.x, 986.5, 0.2), `dragged corner pulled back to the inside face (${kept.x})`);

// 9. Open-sided alfresco: the drawn outline has no line on its south side, so a plain trace leaks and
// finds nothing; closed along the under-roof reading it is measured.
const W = 400, H = 300;
const data = new Uint8ClampedArray(W * H * 4).fill(255);
const ink = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) { const p = (y * W + x) * 4; data[p] = data[p + 1] = data[p + 2] = 0; } };
ink(100, 50, 300, 52); ink(100, 50, 102, 200); ink(298, 50, 300, 200); // north, west, east lines; south open
const raster = { width: W, height: H, data };
const context = { pixelsPerMm: 0.05, logicalWidth: W, logicalHeight: H };
assert.equal(traceOutlinedArea(raster, context, { x: 200, y: 120 }), null, 'an open-sided outline does not trace on its own');
const underRoof = [{ x: 90, y: 40 }, { x: 310, y: 40 }, { x: 310, y: 180 }, { x: 90, y: 180 }];
const traced = traceOutlinedArea(raster, context, { x: 200, y: 120 }, { within: underRoof });
assert.ok(traced, 'closed along the under-roof reading it is measured');
assert.ok(traced.polygon.every((p) => p.y <= 181), 'the open side stops at the under-roof outline');
assert.ok(near(traced.areaM2, (195 * 127) / (0.05 * 0.05) / 1e6, 3), `alfresco area ${traced.areaM2.toFixed(2)} m²`);

// 10. Schedule: an alfresco drawn outside the footprint adds to under-roof and is not taken off living;
// one drawn inside the footprint is part of it, as before.
const sq = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const schedule = (floorplans) => flattenScheduleRows(createTakeoffSchedule({ pixelsPerMm: 1, completedFloorplans: floorplans }));
const find = (rows, id) => rows.find((r) => r.itemId === id);
const fpItem = { id: 'fp', type: 'Footprint', page: 1, nodes: sq(0, 0, 10000, 10000), source: 'manual' };
const outsideRows = schedule([fpItem, { id: 'al', type: 'Alfresco', page: 1, nodes: sq(0, 10000, 5000, 4000), source: 'manual' }]);
assert.equal(find(outsideRows, 'floor_total_under_roof').quantity, 120, 'under roof = footprint 100 + alfresco 20 outside it');
assert.equal(find(outsideRows, 'floor_total_living').quantity, 100, 'living is not reduced by an alfresco outside the footprint');
assert.match(find(outsideRows, 'floor_total_under_roof').notes, /Alfresco 20 m² drawn outside it/);
const insideRows = schedule([fpItem, { id: 'al', type: 'Alfresco', page: 1, nodes: sq(0, 6000, 5000, 4000), source: 'manual' }]);
assert.equal(find(insideRows, 'floor_total_under_roof').quantity, 100, 'an alfresco inside the footprint is already under roof');
assert.equal(find(insideRows, 'floor_total_living').quantity, 80, 'living = footprint less the alfresco inside it');
const patioOut = schedule([fpItem, { id: 'pa', type: 'Patio', page: 1, nodes: sq(0, 10000, 5000, 4000), source: 'manual' }]);
assert.equal(find(patioOut, 'floor_total_under_roof').quantity, 100, 'a patio outside the footprint is not assumed to be under roof');
assert.equal(find(patioOut, 'floor_total_living').quantity, 100);

// 11. Building outline from measured rooms and walls (vector sheets): two rooms 4 x 8 m either side of a
// 90 mm wall, inside 270 mm external walls with a door gap, give the outline to the outer faces; a
// retaining wall 3 m away is not building.
const twoRooms = [sq(135, 135, 4865 - 135 - 45, 7865 - 135), sq(4865 + 45 + 90 - 90, 135, 9865 - 4955, 7865 - 135)];
const outlineWalls = [...house, wall({ x: 4910, y: 135 }, { x: 4910, y: 7865 }, 90), wall({ x: -3000, y: -2000 }, { x: -3000, y: 10000 }, 190)];
const [building] = buildingOutlines(twoRooms, outlineWalls);
assert.ok(near(building.areaM2, 10.27 * 8.27, 0.6), `outline to the outer faces (${building.areaM2.toFixed(2)} m²)`);
assert.ok(building.polygon.every((p) => p.x > -500), `the retaining wall is not part of the building`);
assert.equal(buildingOutlines([], outlineWalls).length, 0, 'no rooms, no outline');

console.log('PASS: external walls stop AI rooms (inside face) and footprints (outside face, except drawn outdoor areas); open-sided alfrescos close at the under-roof reading; alfrescos outside the footprint count under roof; canvas snaps to wall junctions and keeps corners inside.');
