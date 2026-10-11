// Each detection stage of the geometry engine has its own evidence threshold. These drawings
// have known measurements (10 mm per pixel) and pin the behaviour the New Job 03/09 plans showed
// a single shared threshold cannot give: wall fabric that ignores lettering, door returns that
// still end a wall, windows found inside a continuous wall, and wall-to-wall door lines.
import assert from 'node:assert/strict';
import { detectPlanGeometry, pointInPolygon, DEFAULT_GEOMETRY_OPTIONS } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';

const width = 1000, height = 800;
const context = { pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height };
function drawing(extra) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x, y) => { const p = (y * width + x) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
  const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
  const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };
  // 230 mm external shell, 8 m x 6 m outside.
  hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701);
  hline(123, 123, 877); hline(676, 123, 877); vline(123, 123, 677); vline(876, 123, 677);
  extra({ ink, hline, vline });
  return { width, height, data };
}
const near = (opening, x, y, reach = 25) => Math.hypot(opening.x - x, opening.y - y) <= reach;

assert.ok(DEFAULT_GEOMETRY_OPTIONS.jambReturnRunMm < DEFAULT_GEOMETRY_OPTIONS.nibRunMm, 'door returns and wall fabric use separate thresholds');

// --- Wall continuity and opening preservation: a 150 mm return beside a door ---------------------
// A 90 mm partition runs down from the top wall, has an 820 mm doorway, then only a 150 mm return
// before it meets a cross partition. The return is shorter than wall fabric needs.
const returns = drawing(({ hline, vline }) => {
  vline(500, 125, 299); vline(509, 125, 299); hline(298, 500, 510);
  vline(500, 383, 397); vline(509, 383, 397); hline(383, 500, 510);
  hline(398, 500, 875); hline(407, 500, 875);
  // Lettering: short paired strokes, 120 mm long, in the middle of a room.
  for (const x of [250, 262, 274]) { vline(x, 400, 411); vline(x + 8, 400, 411); }
});
const withDoor = detectPlanGeometry(returns, { ...context, openingEvidence: [{ x: 490, y: 340, ref: 'D1' }] });
const door = withDoor.openings.find((opening) => opening.kind === 'wall-gap' && near(opening, 505, 341));
assert.ok(door, 'the doorway beside the short return is found');
assert.ok(Math.abs(door.widthMm - 820) <= 60, `the return ends the doorway: ${door.widthMm} mm, not the 980 mm to the cross wall`);
assert.equal(door.confirmed, true);
assert.ok(door.hostWallId, 'the doorway is attached to the partition it sits in');
assert.ok(withDoor.diagnostics.some((item) => item.code === 'jamb-returns'), 'the return is recorded as kept');
assert.ok(!withDoor.walls.some((wall) => wall.nodes[0].x > 240 && wall.nodes[0].x < 300 && wall.nodes[0].y > 380 && wall.nodes[0].y < 430), 'lettering strokes never become wall');
assert.equal(withDoor.rooms.filter((room) => room.verified && !room.dividedInto).length, 2, 'the doorway closes its room');
// The same sheet read with one 110 mm threshold for everything would also admit the lettering as fabric
// candidates; with 200 mm for everything it loses the return. Neither is the default any more.
const coarse = detectPlanGeometry(returns, { ...context, openingEvidence: [{ x: 490, y: 340, ref: 'D1' }] }, { jambReturnRunMm: 200 });
const coarseDoor = coarse.openings.find((opening) => opening.kind === 'wall-gap' && near(opening, 505, 350, 60));
assert.ok(coarseDoor && coarseDoor.widthMm > 900, 'without the separate return threshold the doorway is over-measured');

// --- Windows: frames drawn in a continuous wall ---------------------------------------------------
const windows = drawing(({ hline, vline }) => {
  for (const [x0, x1] of [[300, 420], [520, 640]]) {
    hline(92, x0, x1); vline(x0, 92, 123); vline(x1, 92, 123); hline(112, x0, x1);
  }
});
const bareWindows = detectPlanGeometry(windows, context);
const frames = bareWindows.openings.filter((opening) => opening.kind === 'wall-symbol' && opening.axis === 'h' && opening.y < 130);
assert.equal(frames.length, 2, `two window frames are found in the top wall (found ${frames.map((item) => `${item.widthMm}@${Math.round(item.x)}`).join(', ')})`);
for (const [frame, centre] of [[frames.find((item) => item.x < 450), 360], [frames.find((item) => item.x > 450), 580]]) {
  assert.ok(frame && Math.abs(frame.x - centre) <= 6, 'the frame is positioned on its wall');
  assert.ok(Math.abs(frame.widthMm - 1200) <= 60, `window width ${frame.widthMm} mm`);
  assert.equal(frame.confirmed, false, 'a frame nobody located is a candidate only');
  assert.equal(frame.reviewRequired, true);
  assert.ok(frame.hostWallId, 'the frame is attached to the wall it is drawn in');
}
assert.ok(!bareWindows.openings.some((opening) => opening.kind === 'wall-gap' && opening.y < 130), 'frames projecting from one wall are not bridged into a gap between them');
const topWall = bareWindows.walls.filter((wall) => wall.axis === 'h' && wall.nodes[0].y < 130);
assert.equal(topWall.length, 1, 'the wall is one run through both windows');
assert.ok(Math.abs(topWall[0].lengthMm - 7540) <= 250, `wall length is gross through windows: ${Math.round(topWall[0].lengthMm)} mm`);
assert.equal(bareWindows.rooms.filter((room) => room.verified).length, 1, 'windows do not open the shell');
const locatedWindows = detectPlanGeometry(windows, { ...context, openingEvidence: [{ x: 365, y: 105, ref: 'W1' }] });
const located = locatedWindows.openings.filter((opening) => opening.kind === 'wall-symbol' && opening.confirmed);
assert.equal(located.length, 1, 'only the located window is confirmed');
assert.equal(located[0].evidenceRef, 'W1');

// --- Wall-to-wall door lines (robe sliders) ------------------------------------------------------
const robe = drawing(({ vline }) => { vline(800, 125, 675); });
const bareRobe = detectPlanGeometry(robe, context);
assert.equal(bareRobe.rooms.length, 1, 'a thin line alone divides nothing');
assert.ok(!bareRobe.walls.some((wall) => wall.axis === 'v' && Math.abs(wall.nodes[0].x - 800) < 10), 'a thin line alone is not a wall');
const locatedRobe = detectPlanGeometry(robe, { ...context, openingEvidence: [{ x: 795, y: 400, ref: 'D-ROBE' }] });
const slider = locatedRobe.openings.find((opening) => opening.kind === 'door-line');
assert.ok(slider, 'a located wall-to-wall door is taken from its own line');
assert.equal(slider.evidenceRef, 'D-ROBE');
assert.ok(Math.abs(slider.x - 800.5) <= 3, 'the door is positioned on its drawn line, not where it was located');
assert.ok(Math.abs(slider.widthMm - 5530) <= 80, `door spans wall to wall: ${slider.widthMm} mm`);
const sides = locatedRobe.rooms.filter((room) => room.verified);
assert.equal(sides.length, 2, 'the robe is its own room');
assert.ok(sides.some((room) => pointInPolygon({ x: 840, y: 400 }, room.polygon)) && sides.some((room) => pointInPolygon({ x: 400, y: 400 }, room.polygon)));
const robeRoom = sides.find((room) => pointInPolygon({ x: 840, y: 400 }, room.polygon));
assert.ok(Math.abs(robeRoom.netAreaM2 - 0.72 * 5.53) / (0.72 * 5.53) <= 0.06, `robe area ${robeRoom.netAreaM2.toFixed(2)} m2`);
const lineWall = locatedRobe.walls.find((wall) => wall.axis === 'v' && Math.abs(wall.nodes[0].x - 800.5) < 6);
assert.ok(lineWall?.reviewRequired && /door opening/.test(lineWall.reviewReason), 'the run through a door line is flagged for the estimator');
// Evidence with no linework under it confirms nothing.
assert.ok(!detectPlanGeometry(robe, { ...context, openingEvidence: [{ x: 600, y: 400 }] }).openings.some((opening) => opening.kind === 'door-line'));

// --- Divided spaces are linked, never returned as two independent rooms ---------------------------
const divided = detectPlanGeometry(returns, context);
const whole = divided.rooms.filter((room) => room.dividedInto);
assert.equal(whole.length, 1, 'the space behind an unconfirmed doorway is returned once as a whole');
const parts = divided.rooms.filter((room) => room.partOf === whole[0].id);
assert.deepEqual(parts.map((room) => room.id).sort(), [...whole[0].dividedInto].sort(), 'and linked to its parts');
assert.ok(parts.length === 2 && parts.every((room) => !room.verified && room.reviewRequired));
assert.equal(new Set(divided.rooms.map((room) => room.id)).size, divided.rooms.length, 'room ids are unique');
const partsArea = parts.reduce((sum, room) => sum + room.netAreaM2, 0);
assert.ok(Math.abs(partsArea - whole[0].netAreaM2) / whole[0].netAreaM2 < 0.03, 'the parts make up the whole');

console.log('plan geometry stages: returns, windows, door lines and divided spaces ok');
