import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

// Windows drawn as boxes projecting out from the wall (shared inner face, end caps right across the
// wall, glass line, outer line), as on many residential sets. Synthetic plan, millimetres, 70 mm walls:
//   north wall: a 900 window box mid-wall, and a 900 box at its east end stopping short of the corner;
//   east wall: three boxes side by side (2700 bank, no size labels) - one window, not a garage door;
//   south wall: a 3000 opening with a single door line and no caps - a garage door.
function plan(pixelsPerMm, angle = 0) {
  const segments = [];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const P = ([x, y]) => ({ x: (x * cos - y * sin + 20000) * pixelsPerMm, y: (x * sin + y * cos + 20000) * pixelsPerMm });
  const line = (a, b) => { const p = P(a), q = P(b); segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, paint: 'stroke', widthPx: 0.24, color: '#000000', path: segments.length, subpath: 0 }); };
  // North wall (centre y=0): inner face y=35 continuous, outer face y=-35 broken at the boxes.
  line([35, 35], [5965, 35]);
  line([-35, -35], [1000, -35]); line([1900, -35], [5000, -35]); line([5900, -35], [6035, -35]);
  const boxN = (x0, x1) => { line([x0, 35], [x0, -259]); line([x1, 35], [x1, -259]); line([x0, -110], [x1, -110]); line([x0, -259], [x1, -259]); };
  boxN(1000, 1900); boxN(5000, 5900);
  // West wall (x=0) and south wall (y=4000) with a 3000 garage opening and one door line.
  line([-35, -35], [-35, 4035]); line([35, 35], [35, 3965]);
  line([-35, 4035], [1000, 4035]); line([35, 3965], [1000, 3965]);
  line([4000, 4035], [6035, 4035]); line([4000, 3965], [5965, 3965]);
  line([1000, 4000], [4000, 4000]);
  // East wall (x=6000): inner face x=5965 continuous; outer face broken for a three-box bank y 800..3500.
  line([5965, 35], [5965, 3965]);
  line([6035, -35], [6035, 800]); line([6035, 3500], [6035, 4035]);
  for (const [y0, y1] of [[800, 1700], [1700, 2600], [2600, 3500]]) { line([5965, y0], [6259, y0]); line([5965, y1], [6259, y1]); line([6110, y0], [6110, y1]); line([6259, y0], [6259, y1]); }
  return { segments, P, context: { pixelsPerMm, logicalWidth: 50000 * pixelsPerMm, logicalHeight: 50000 * pixelsPerMm, textItems: [] } };
}

export { plan };
if (process.env.WB_DEBUG) { const { segments, context } = plan(0.0283); const f = detectVectorWalls(segments, context); console.log(JSON.stringify({ walls: f.walls.map(w => [w.axis, Math.round(w.measuredThicknessMm), Math.round(w.lengthMm), w.nodes.map(n => [Math.round(n.x / .0283 - 20000), Math.round(n.y / .0283 - 20000)])]), openings: f.openings.map(o => [o.kind, o.widthMm, Math.round(o.x / .0283 - 20000), Math.round(o.y / .0283 - 20000)]), stats: f.stats, rej: f.rejected.slice(0, 15).map(r => r.reason + ' ' + r.thicknessMm + ' ' + r.lengthMm) }, null, 0)); process.exit(0); }
for (const scale of [0.0283, 0.09]) for (const angle of [0, Math.PI / 2]) {
  const { segments, P, context } = plan(scale, angle);
  const found = detectVectorWalls(segments, context);
  const near = (point, mm) => found.openings.filter((o) => Math.hypot(o.x - P(point).x, o.y - P(point).y) <= mm * scale);
  const mid = near([1450, 0], 150);
  assert.equal(mid.length, 1, `one window in the mid-wall box (scale ${scale}, angle ${angle})`);
  assert.equal(mid[0].kind, 'window'); assert.ok(Math.abs(mid[0].widthMm - 900) <= 30, `window width ${mid[0].widthMm}`);
  const corner = near([5450, 0], 150);
  assert.equal(corner.length, 1, 'window at the wall end beside the corner is found');
  assert.equal(corner[0].kind, 'window'); assert.ok(Math.abs(corner[0].widthMm - 900) <= 30, `corner window width ${corner[0].widthMm}`);
  const bank = near([6000, 2150], 200);
  assert.equal(bank.length, 1, 'an unlabelled bank of boxes is one window');
  assert.equal(bank[0].kind, 'window', `bank read as ${bank[0].kind}, not a garage door`);
  assert.ok(Math.abs(bank[0].widthMm - 2700) <= 50, `bank width ${bank[0].widthMm}`);
  const garage = near([2500, 4000], 200);
  assert.equal(garage.length, 1); assert.equal(garage[0].kind, 'garage-door', 'an uncapped single line across a wide gap stays a garage door');
  // The boxes themselves are never walls.
  const boxWalls = found.walls.filter((wall) => wall.measuredThicknessMm > 120);
  assert.equal(boxWalls.length, 0, `no wall from a window box (${boxWalls.map((w) => Math.round(w.measuredThicknessMm)).join(', ')})`);
}
console.log('Window boxes: mid-wall, corner and unlabelled bank read as windows; uncapped wide opening stays a garage door; boxes are not walls.');
