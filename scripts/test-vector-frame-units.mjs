// Frames drawn outside a wall whose face lines run on past them (the way some drafters draw sliding
// doors and windows): the frame is one opening held for the builder, the wall stays a wall, and the
// frame's own line pair is never a wall. Also: frame halves meeting end to end are one unit, windows
// with their own size labels stay separate, and a gap beside a frame keeps its wall closure.
import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

function fixture({ angle = 0, ppm = 0.05, mullion = true, brokenFace = true, frameDepth = 100, frameGap = 14, glassInWall = true, labels = [] } = {}) {
  const segments = [], c = Math.cos(angle), s = Math.sin(angle);
  const at = ([x, y]) => ({ x: (x * c - y * s + 10000) * ppm, y: (x * s + y * c + 10000) * ppm });
  const line = (a, b) => { const p = at(a), q = at(b); segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, path: segments.length, subpath: segments.length, widthPx: 0.24, paint: 'stroke', color: '#000000', dashed: false }); };
  const wall = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), n = [-dy / l * 50, dx / l * 50]; for (const k of [-1, 1]) line([a[0] + k * n[0], a[1] + k * n[1]], [b[0] + k * n[0], b[1] + k * n[1]]); };
  // A 7 x 6 m room of 100 mm walls; the top wall's outer face is broken where the frame meets it.
  // Both faces of the top wall are broken where the frame's caps and mullion run into them.
  const stops = brokenFace ? [-50, 2000, ...(mullion ? [2900] : []), 3800, 7050] : [-50, 7050];
  for (let i = 1; i < stops.length; i++) { line([stops[i - 1], -50], [stops[i], -50]); line([stops[i - 1], 50], [stops[i], 50]); }
  wall([7000, 0], [7000, 6000]); wall([7000, 6000], [0, 6000]); wall([0, 6000], [0, 0]);
  // The frame: two lines beyond the outer face, capped at both ends by lines running into the wall.
  const inner = -50 - frameGap, outer = inner - frameDepth;
  line([2000, inner], [3800, inner]); line([2000, outer], [3800, outer]);
  line([2000, 50], [2000, outer]); line([3800, 50], [3800, outer]);
  if (mullion) line([2900, 50], [2900, outer]);
  // One panel's glass line drawn between the wall faces (the wall pair there is no longer clean).
  if (glassInWall) line([2900, 0], [3800, 0]);
  const textItems = labels.map(([x, y, text]) => ({ ...at([x, y]), text, width: 10, height: 5 }));
  return { segments, at, context: { pixelsPerMm: ppm, logicalWidth: 24000 * ppm, logicalHeight: 24000 * ppm, textItems } };
}
const near = (f, found, point, mm) => found.openings.filter((o) => Math.hypot(o.x - f.at(point).x, o.y - f.at(point).y) <= mm * f.context.pixelsPerMm);
const topWallLength = (f, found) => found.walls.filter((w) => {
  const mid = { x: (w.nodes[0].x + w.nodes[1].x) / 2, y: (w.nodes[0].y + w.nodes[1].y) / 2 }, top = f.at([3500, 0]), dir = f.at([3501, 0]);
  const u = { x: dir.x - top.x, y: dir.y - top.y }, ul = Math.hypot(u.x, u.y);
  return Math.abs(((mid.x - top.x) * -u.y + (mid.y - top.y) * u.x) / ul) <= 30 * f.context.pixelsPerMm;
}).reduce((sum, w) => sum + w.lengthMm, 0);

for (const angle of [0, Math.PI / 2, Math.PI / 4]) for (const ppm of [0.03, 0.1]) {
  const f = fixture({ angle, ppm }), found = detectVectorWalls(f.segments, f.context);
  const frames = near(f, found, [2900, 0], 400);
  assert.equal(frames.length, 1, `one opening for the frame (angle ${angle.toFixed(2)}, ${ppm})`);
  assert.ok(Math.abs(frames[0].widthMm - 1800) <= 40, `frame width ${frames[0].widthMm}`);
  assert.equal(frames[0].needsClassification, true, 'window or sliding door is the builder\'s call: no quantity until confirmed');
  assert.equal(frames[0].measurements?.frameWidthMm, frames[0].widthMm, 'the frame width is recorded as a frame width');
  assert.equal(frames[0].measurements?.leafWidthMm, undefined, 'no leaf width is invented for a frame');
  assert.ok(topWallLength(f, found) >= 6500, `the wall behind the frame stays a wall (${topWallLength(f, found)} mm)`);
  assert.ok(!found.walls.some((w) => { const m = { x: (w.nodes[0].x + w.nodes[1].x) / 2, y: (w.nodes[0].y + w.nodes[1].y) / 2 }; const p = f.at([2900, -114]); return Math.hypot(m.x - p.x, m.y - p.y) <= 120 * ppm; }), 'the frame\'s own line pair is not a wall');
}
console.log('Frames beside a continuous wall: one held opening, frame width only, wall kept, frame pair not a wall (3 angles, 2 scales).');

// Without a mullion the frame is still one opening; a frame whose panels each carry a size label is
// separate windows only through the labelled window-box path, never merged here.
{
  const f = fixture({ mullion: false }), found = detectVectorWalls(f.segments, f.context);
  assert.equal(near(f, found, [2900, 0], 400).length, 1, 'single-panel frame');
}
{
  const f = fixture({}), found = detectVectorWalls(f.segments, f.context, { classify: false });
  assert.equal(found.classification, undefined, 'the classification stage can be switched off for comparison');
}
console.log('Frame variants: no mullion, classification stage switch.');
