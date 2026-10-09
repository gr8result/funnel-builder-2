// Geometry engine on a drawing whose true measurements are known by construction: a 230 mm
// external shell divided by a 90 mm partition with an 820 mm doorway, at 10 mm per pixel.
// The real-plan comparison is scripts/benchmark-plan-geometry.mjs.
import assert from 'node:assert/strict';
import { detectPlanGeometry, pointInPolygon } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';

const width = 1000, height = 800;
const data = new Uint8ClampedArray(width * height * 4).fill(255);
const ink = (x, y) => { const p = (y * width + x) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };

// External shell: outer faces, then inner faces 230 mm in (broken where the partition joins).
hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701);
hline(123, 123, 499); hline(123, 511, 877); hline(676, 123, 499); hline(676, 511, 877);
vline(123, 123, 677); vline(876, 123, 677);
// Partition: faces 90 mm apart, with a doorway from y=300 to y=382 and capped ends.
for (const [y0, y1] of [[125, 299], [383, 675]]) { vline(500, y0, y1); vline(509, y0, y1); }
hline(298, 500, 510); hline(383, 500, 510);
// Joinery: a 600 mm strip of paired lines standing clear of every wall.
hline(500, 250, 310); hline(520, 250, 310);

const context = { pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height };
const raster = { width, height, data };
const within = (actual, expected, share, label) => assert.ok(Math.abs(actual - expected) / expected <= share, `${label}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
const lengthOf = (result, test) => result.walls.filter(test).reduce((sum, wall) => sum + wall.lengthMm, 0) / 1000;

// --- Without any evidence of an opening, the gap in the partition is a gap, not a door. ---------
const bare = detectPlanGeometry(raster, context);
const gap = bare.openings.filter((item) => item.widthMm >= 600);
assert.equal(gap.length, 1, `one candidate opening (found ${gap.map((item) => item.widthMm).join(', ')})`);
assert.ok(Math.abs(gap[0].widthMm - 820) <= 80, `gap width ${gap[0].widthMm} mm`);
assert.equal(gap[0].confirmed, false);
assert.equal(gap[0].reviewRequired, true);
assert.equal(gap[0].hostWallId, null, 'an unconfirmed gap has no host wall');
within(lengthOf(bare, (wall) => wall.thicknessMm === 90), 5.53 - 0.82, 0.03, 'partition stops at the unconfirmed gap');
const verified = bare.rooms.filter((room) => room.verified);
assert.equal(verified.length, 1, 'the gap is not closed to make two rooms');
within(verified[0].netAreaM2, 3.77 * 5.53 + 3.66 * 5.53 + 0.09 * 0.82, 0.03, 'the one enclosed space');
const proposed = bare.rooms.filter((room) => !room.verified);
assert.equal(proposed.length, 2, 'each side is offered as a proposal');
assert.ok(proposed.every((room) => room.reviewRequired && /not confirmed/.test(room.reviewReason)));
// Paired lines that join no wall are not a wall.
assert.ok(!bare.walls.some((wall) => wall.nodes[0].y > 480 && wall.nodes[0].y < 540 && wall.nodes[0].x < 400), 'joinery strip is not a wall');
assert.ok(bare.diagnostics.some((item) => item.code === 'isolated-linework'));

// --- With an opening located there (placed by the estimator or read from the plan). -------------
const result = detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 480, y: 330, ref: 'D1' }] });
const rooms = result.rooms.filter((room) => room.verified);
assert.equal(rooms.length, 2, `two rooms are enclosed (found ${rooms.length})`);
assert.equal(result.rooms.length, 2, 'nothing is left as a proposal');
const left = rooms.find((room) => pointInPolygon({ x: 300, y: 400 }, room.polygon));
const right = rooms.find((room) => pointInPolygon({ x: 700, y: 400 }, room.polygon));
assert.ok(left && right && left !== right, 'each side of the partition is its own room');
within(left.netAreaM2, 3.77 * 5.53 - 0.6 * 0.2, 0.025, 'left room area');
within(right.areaM2, 3.66 * 5.53, 0.025, 'right room area');
within(left.perimeterM, 2 * (3.77 + 5.53), 0.03, 'left room perimeter');
assert.ok(left.polygon.length <= 8 && right.polygon.length <= 8, 'room boundaries are simple polygons');

const doors = result.openings.filter((item) => item.widthMm >= 600);
assert.equal(doors.length, 1);
assert.equal(doors[0].confirmed, true);
assert.equal(doors[0].evidenceRef, 'D1', 'the opening that confirmed the gap is recorded');
assert.ok(Math.abs(doors[0].x - 505) <= 6 && doors[0].y > 300 && doors[0].y < 382, 'the opening is positioned on the wall, not where the evidence said');
// A wall's run is gross: the confirmed doorway does not shorten the partition that hosts it.
within(lengthOf(result, (wall) => wall.thicknessMm === 90), 5.53, 0.03, 'partition gross length');
assert.equal(doors[0].hostWallId, result.walls.find((wall) => wall.thicknessMm === 90).id, 'the doorway is attached to the partition it sits in');
// Wall runs are measured between junctions (inner corner to inner corner). The takeoff's outer-face
// convention for external walls (8 m x 6 m here = 28 lm) is not applied by the engine yet.
within(lengthOf(result, (wall) => wall.thicknessMm === 230), 2 * (7.54 + 5.54), 0.03, 'external wall runs between corners');
assert.ok(result.walls.every((wall) => wall.connectedEnds >= 1), 'every wall joins another wall');
// Evidence far from any gap confirms nothing.
assert.equal(detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 300, y: 600 }] }).openings.filter((item) => item.confirmed).length, 0);

// Identity is geometric, so analysing the same sheet again yields the same objects.
const again = detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 480, y: 330 }] });
assert.deepEqual(again.rooms.map((room) => room.id), result.rooms.map((room) => room.id), 'room ids are stable across runs');
assert.deepEqual(again.walls.map((wall) => wall.id), result.walls.map((wall) => wall.id), 'wall ids are stable across runs');

// A sheet with no confirmed calibration is refused, never guessed.
assert.throws(() => detectPlanGeometry(raster, { ...context, pixelsPerMm: 0 }), /calibration/);
// A blank sheet reports that it found no walls.
const blank = detectPlanGeometry({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) }, context);
assert.equal(blank.rooms.length, 0);
assert.equal(blank.diagnostics.at(-1).code, 'no-walls');
console.log('plan geometry engine: ok');
