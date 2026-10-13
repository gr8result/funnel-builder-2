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
const divided = detectPlanGeometry(returns, context, { alignedDoorways: false });
const whole = divided.rooms.filter((room) => room.dividedInto);
assert.equal(whole.length, 1, 'the space behind an unconfirmed doorway is returned once as a whole');
const parts = divided.rooms.filter((room) => room.partOf === whole[0].id);
assert.deepEqual(parts.map((room) => room.id).sort(), [...whole[0].dividedInto].sort(), 'and linked to its parts');
assert.ok(parts.length === 2 && parts.every((room) => !room.verified && room.reviewRequired));
assert.equal(new Set(divided.rooms.map((room) => room.id)).size, divided.rooms.length, 'room ids are unique');
const partsArea = parts.reduce((sum, room) => sum + room.netAreaM2, 0);
assert.ok(Math.abs(partsArea - whole[0].netAreaM2) / whole[0].netAreaM2 < 0.03, 'the parts make up the whole');

// --- A door drawn across an opening wider than a doorway ------------------------------------------
// A 90 mm partition with a 2400 mm opening. With the door's panels drawn from one wall end to the
// other it is a sliding door; with a dashed bulkhead line over it, it is an opening and stays one.
const wideGap = (across) => drawing(({ hline, vline }) => {
  vline(500, 125, 249); vline(509, 125, 249); hline(249, 500, 510);
  vline(500, 490, 675); vline(509, 490, 675); hline(490, 500, 510);
  across(vline);
});
const drawnDoor = detectPlanGeometry(wideGap((vline) => vline(504, 251, 489)), context).openings.find((opening) => opening.kind === 'wall-gap' && near(opening, 505, 370, 40));
assert.ok(drawnDoor, 'the wide opening is found');
assert.deepEqual([drawnDoor.confirmed, drawnDoor.basis, drawnDoor.reviewRequired], [true, 'door-line-across', true], 'a door drawn across the opening makes it a door, still to be confirmed');
assert.ok(Math.abs(drawnDoor.widthMm - 2400) <= 60, `its width is the gap between the wall ends: ${drawnDoor.widthMm} mm`);
assert.ok(drawnDoor.lineUnbrokenShare >= 0.85);
const dashedOver = detectPlanGeometry(wideGap((vline) => { for (let y = 255; y < 480; y += 60) vline(504, y, y + 29); }), context).openings.find((opening) => opening.kind === 'wall-gap' && near(opening, 505, 370, 40));
assert.ok(dashedOver && !dashedOver.confirmed && dashedOver.basis === 'aligned-wall-ends', 'a dashed line over an opening does not make it a door');
const openGap = detectPlanGeometry(wideGap(() => {}), context).openings.find((opening) => opening.kind === 'wall-gap' && near(opening, 505, 370, 40));
assert.ok(openGap && !openGap.confirmed, 'an opening with nothing drawn across it is not a door');

// --- Walls at angles other than 0, 45 and 90 degrees -----------------------------------------------
// A 120 mm wall leaves the top wall and runs to a side wall at a stated angle, cutting a triangle
// off the room. Its length is the run between the two walls and the triangle's area follows from
// the angle, so both are checked against the trigonometry, not against a traced answer.
function slantedWall(degrees, startX) {
  const turn = degrees * Math.PI / 180, dx = Math.cos(turn), dy = Math.sin(turn);
  const run = degrees < 90 ? (876 - startX) / dx : (startX - 125) / -dx;       // pixels from the top wall's face to the side wall's
  const raster = drawing(({ ink }) => {
    for (const offset of [0, 12]) for (let along = -40; along <= run + 40; along += 0.5) {
      const side = dx >= 0 ? offset : -offset;                              // the second face lies on the room side
      const x = startX + dx * along - dy * side, y = 125 + dy * along + dx * side;
      if (y < 125 || x > 876 || x < 125) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) ink(Math.round(x) + ox, Math.round(y) + oy);
    }
  });
  return { raster, lengthMm: run * 10, cornerM2: 0.5 * (run * Math.abs(dx)) * (run * dy) / 1e4 };
}
for (const [degrees, startX] of [[30, 600], [150, 400], [62, 760], [20, 450]]) {
  const fixture = slantedWall(degrees, startX);
  const result = detectPlanGeometry(fixture.raster, context);
  const slanted = result.walls.filter((wall) => wall.axis === 'd');
  assert.equal(slanted.length, 1, `${degrees} degrees: one angled wall is measured (${slanted.length})`);
  const measured = result.diagnostics.find((item) => item.code === 'angled-walls');
  assert.ok(measured && Math.abs(measured.angles[0] - degrees) <= 0.6, `${degrees} degrees: the angle is read from the drawing (${measured?.angles})`);
  assert.ok(Math.abs(slanted[0].lengthMm - fixture.lengthMm) <= 300, `${degrees} degrees: length ${Math.round(slanted[0].lengthMm)} mm against ${Math.round(fixture.lengthMm)} mm`);
  assert.ok(Math.abs(slanted[0].thicknessMm - 120) <= 40, `${degrees} degrees: thickness ${Math.round(slanted[0].thicknessMm)} mm`);
  const enclosed = result.rooms.filter((room) => room.verified).sort((a, b) => a.netAreaM2 - b.netAreaM2);
  assert.equal(enclosed.length, 2, `${degrees} degrees: the wall divides the room`);
  // The corner is the triangle less the half of the wall's thickness that lies in it.
  assert.ok(enclosed[0].netAreaM2 <= fixture.cornerM2 + 0.05 && enclosed[0].netAreaM2 >= fixture.cornerM2 * 0.8 - 0.1, `${degrees} degrees: corner ${enclosed[0].netAreaM2.toFixed(2)} m2 against a ${fixture.cornerM2.toFixed(2)} m2 triangle`);
}
// The same two lines standing free in the room join no wall and are not one.
const loose = drawing(({ ink }) => { for (const offset of [0, 12]) for (let along = 0; along <= 200; along += 0.5) { const x = 400 + 0.866 * along - 0.5 * offset, y = 300 + 0.5 * along + 0.866 * offset; ink(Math.round(x), Math.round(y)); ink(Math.round(x) + 1, Math.round(y)); } });
assert.equal(detectPlanGeometry(loose, context).walls.filter((wall) => wall.axis === 'd').length, 0, 'angled linework joining no wall is not a wall');

console.log('plan geometry stages: returns, windows, door lines and divided spaces ok');
