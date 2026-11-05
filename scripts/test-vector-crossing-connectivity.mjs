import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const { segments, P, context } = plan(scale, angle);
  const wall = y => [-35, 35].map(off => { const a = P([-1500, y + off]), b = P([1500, y + off]);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, path: 9000 + off, subpath: 0, paint: 'stroke', widthPx: .24, color: '#000000' }; });
  const centre = y => P([0, y]);
  const near = (w, y) => Math.hypot((w.nodes[0].x + w.nodes[1].x) / 2 - centre(y).x, (w.nodes[0].y + w.nodes[1].y) / 2 - centre(y).y) < 10 * scale;
  const found = detectVectorWalls([...segments, ...wall(4000)], context);
  assert.ok(found.walls.some(w => near(w, 4000) && w.lengthMm > 2900), 'measured mid-body intersection joins the real wall to the building');
  const apart = detectVectorWalls([...segments, ...wall(11000)], context);
  assert.ok(!apart.walls.some(w => near(w, 11000)), 'a detached pair cannot use an extrapolated intersection');
  assert.ok(found.walls.some(w => w.lengthMm > 5000), 'existing real outer walls remain');
}
console.log('Building connectivity: actual crossing retained; extrapolated crossing rejected; real outer walls preserved.');
