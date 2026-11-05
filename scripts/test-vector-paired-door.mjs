import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { levelFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const fixture = plan(scale, angle), { P, context } = fixture;
  const segments = fixture.segments.filter((s, i) => i < 4 || i > 7);
  const start = P([2400, -35]), end = P([3000, -35]);
  for (const s of segments) for (const i of [1, 2]) if (Math.hypot(s[`x${i}`] - start.x, s[`y${i}`] - start.y) < 1e-6) {
    s[`x${i}`] = end.x; s[`y${i}`] = end.y;
  }
  const add = (a, b, extra = {}) => { const p = P(a), q = P(b); const s = { x1: p.x, y1: p.y, x2: q.x, y2: q.y,
    path: 1000 + segments.length, subpath: 0, widthPx: .24, paint: 'stroke', color: '#000000', ...extra }; segments.push(s); return s; };
  const leaves = [add([1500, -35], [1500, -785]), add([3000, -35], [3000, -785])];
  for (const [x, startAngle, path] of [[1500, -Math.PI / 2, 9000], [3000, Math.PI, 9001]]) for (let i = 0; i < 12; i++) {
    const point = j => [x + 750 * Math.cos(startAngle + j * Math.PI / 24), -35 + 750 * Math.sin(startAngle + j * Math.PI / 24)];
    add(point(i), point(i + 1), { curve: true, path });
  }
  const found = detectVectorWalls(segments, context), centre = P([2250, 0]);
  const doors = found.openings.filter(o => o.kind === 'door' && Math.hypot(o.x - centre.x, o.y - centre.y) < 800 * scale);
  assert.equal(doors.length, 1, 'two meeting leaves produce one opening');
  assert.equal(doors[0].leafCount, 2, 'opposite hinges, drawn leaves and meeting closed tips establish the pair');
  const built = levelFromLinework(found, { id: 'paired', pixelsPerMm: scale });
  const converted = Object.values(built.level.openings).find(o => o.detectionKey === `linework-opening:${doors[0].id}`);
  assert.equal(converted.widthMm, 1500, 'model preserves full measured paired doorway width');
  const incomplete = detectVectorWalls(segments.filter(s => s !== leaves[1]), context);
  assert.ok(!incomplete.openings.some(o => o.leafCount === 2), 'missing radial leaf cannot establish a paired door');
  assert.ok(found.walls.some(w => w.lengthMm > 5000 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real wall remains');
}
console.log('Paired doors: one full-width opening; two leaf and hinge evidence required; real walls preserved.');
