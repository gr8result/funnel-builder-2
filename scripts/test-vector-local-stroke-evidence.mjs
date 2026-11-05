import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

// Reproduce a corner window beside a perpendicular entrance door. The open
// leaf competes for the short return's inner face; an adjoining heavy detail
// must not change the wall pen over that return.
for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const { segments, P, context } = plan(scale, angle);
  const axis = angle === 0 ? 'x' : 'y';
  for (const s of segments) for (const end of [1, 2]) {
    for (const [from, to] of [[1500, 300], [2400, 1200]]) {
      if (Math.abs(s[`${axis}${end}`] - P([from, 0])[axis]) < 1e-6) s[`${axis}${end}`] = P([to, 0])[axis];
    }
  }
  const add = (a, b, props = {}) => {
    const p = P(a), q = P(b);
    const s = { x1: p.x, y1: p.y, x2: q.x, y2: q.y, paint: 'stroke', widthPx: .24,
      color: '#000000', path: 1000 + segments.length, subpath: 0, ...props };
    segments.push(s); return s;
  };
  add([-3000, -35], [-35, -35], { widthPx: .72 });
  add([-80, 350], [35, 350]); // separate jamb stroke merged into the leaf line
  const leaf = add([35, 350], [905, 350]);
  for (let i = 0; i < 12; i++) {
    const point = j => [35 + 870 * Math.cos(j * Math.PI / 24), 350 + 870 * Math.sin(j * Math.PI / 24)];
    add(point(i), point(i + 1), { curve: true, path: 9000 });
  }
  const found = detectVectorWalls(segments, context);
  const mid = w => ({ x: (w.nodes[0].x + w.nodes[1].x) / 2, y: (w.nodes[0].y + w.nodes[1].y) / 2 });
  const near = (w, point, mm) => Math.hypot(mid(w).x - P(point).x, mid(w).y - P(point).y) < mm * scale;
  assert.ok(found.walls.some(w => near(w, [167.5, 0], 20)), 'local wall pen and short return survive adjacent heavy line and leaf');
  assert.ok(!found.walls.some(w => near(w, [470, 192.5], 30)), 'open leaf cannot become a thick wall');
  assert.ok(found.openings.some(o => o.kind === 'window' && Math.hypot(o.x - P([750, 0]).x, o.y - P([750, 0]).y) < 30 * scale), 'projected window retains its measured host');
  assert.ok(found.walls.some(w => w.lengthMm > 5000 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real long walls remain');
  const withoutSwing = detectVectorWalls(segments.filter(s => s.path !== 9000), context);
  assert.ok(!withoutSwing.rejected.some(w => w.reason.includes('open door leaf')), 'a straight stroke without a swing is not classified as a door leaf');
  // A radius without the leaf is insufficient to reject a real face, and a
  // longer real wall coincident with a leaf radius must not be consumed.
  const real = segments.filter(s => s !== leaf);
  const extended = add([35, 350], [6000, 350]);
  const second = add([35, 420], [6000, 420]);
  const negative = detectVectorWalls([...real, extended, second], context);
  assert.ok(negative.walls.some(w => near(w, [3017.5, 385], 30) && w.lengthMm > 5000), 'real partition across a swing radius remains a wall');
}
console.log('Local stroke evidence: corner return and window preserved; open leaf excluded; real walls preserved at two scales and rotations.');
