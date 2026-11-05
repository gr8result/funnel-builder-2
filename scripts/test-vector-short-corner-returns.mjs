import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const { segments, P, context } = plan(scale, angle);
  const near = (s, key, p) => Math.hypot(s[`${key}1`] - p[key]) < 1e-6;
  // Move the window end to leave a 135 mm inner return. The outer face turns
  // the corner in one CAD path; the inner face meets its perpendicular face.
  const oldEnd = P([9900, 0]), newEnd = P([9830, 0]);
  const axis = angle === 0 ? 'x' : 'y';
  for (const s of segments) for (const end of [1, 2]) {
    if (Math.abs(s[`${axis}${end}`] - oldEnd[axis]) < 1e-6) s[`${axis}${end}`] = newEnd[axis];
  }
  const outer = segments.find(s => near(s, axis, P([9830, -35])) && Math.hypot(s.x2 - P([10035, -35]).x, s.y2 - P([10035, -35]).y) < 1e-6);
  const cross = segments.find(s => Math.hypot(s.x1 - P([10035, -35]).x, s.y1 - P([10035, -35]).y) < 1e-6);
  assert.ok(outer && cross);
  cross.path = outer.path;
  const result = detectVectorWalls(segments, context);
  const returnAt = P([9897.5, 0]);
  const returns = result.walls.filter(w => w.lengthMm < 200 && Math.hypot((w.nodes[0].x + w.nodes[1].x) / 2 - returnAt.x,
    (w.nodes[0].y + w.nodes[1].y) / 2 - returnAt.y) < 30 * scale);
  assert.equal(returns.length, 1, 'capped short return with drawn corner survives');
  const withoutCap = segments.filter(s => !(Math.abs(s[`${axis}1`] - newEnd[axis]) < 1e-6 && Math.abs(s[`${axis}2`] - newEnd[axis]) < 1e-6));
  assert.ok(!detectVectorWalls(withoutCap, context).walls.some(w => w.lengthMm < 200), 'no invented short wall when the jamb cap is missing');
  assert.ok(result.walls.some(w => w.lengthMm > 5000 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real long walls survive the short-return rule');
}
console.log('Short returns: measured corner plus jamb required; real long walls preserved.');

for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const { segments, P, context } = plan(scale, angle);
  const add = (a, b, path) => { const p = P(a), q = P(b); segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y,
    path, paint: 'stroke', widthPx: .24, color: '#000000' }); return segments.at(-1); };
  add([35, 2050], [5965, 2050], 1000);
  add([35, 2120], [5965, 2120], 1000);
  add([5965, 2000], [5965, 2050], 1001);
  add([5965, 2120], [5965, 2170], 1002);
  add([6035, 2000], [6035, 2170], 1003);
  const cap = add([5965, 2000], [6035, 2000], 1004);
  add([5965, 2170], [6035, 2170], 1005);
  const expected = P([6000, 2085]);
  const jambs = result => result.walls.filter(w => Math.hypot((w.nodes[0].x + w.nodes[1].x) / 2 - expected.x,
    (w.nodes[0].y + w.nodes[1].y) / 2 - expected.y) < 5 * scale && Math.abs(w.lengthMm - 170) < 2);
  assert.equal(jambs(detectVectorWalls(segments, context)).length, 1, 'T-interrupted jamb reconstructed from crossing faces and caps');
  assert.equal(jambs(detectVectorWalls(segments.filter(s => s !== cap), context)).length, 0, 'a missing cap cannot establish the short jamb');
  assert.equal(jambs(detectVectorWalls(segments.filter(s => s.path !== 1000), context)).length, 0, 'an unexplained interruption cannot establish a jamb');
}
console.log('Short T-jambs: both caps and measured crossing faces required across rotation and scale.');
