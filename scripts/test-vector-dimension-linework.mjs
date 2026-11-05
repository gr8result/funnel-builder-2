import assert from 'node:assert/strict';
import { dimensionAnnotationStrokes } from '../components/construction-estimation/ai-plan-takeoff/geometry/dimensionLinework.js';

for (const scale of [.0283, .1]) for (const angle of [0, Math.PI / 2, Math.PI / 4]) {
  const point = (x, y) => ({ x: (20000 + x * Math.cos(angle) - y * Math.sin(angle)) * scale,
    y: (20000 + x * Math.sin(angle) + y * Math.cos(angle)) * scale });
  const stroke = (a, b, path) => { const p = point(...a), q = point(...b); return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, path }; };
  const baseline = stroke([0, 0], [9000, 0], 1);
  const markers = [-250, 9250].flatMap(x => [stroke([x - 250, 0], [x + 250, 0], 2),
    stroke([x, -400], [x, 400], 2), stroke([x - 125, -125], [x + 125, 125], 2)]);
  const label = { text: '9500', ...point(4500, -300) };
  const segments = [baseline, ...markers];
  const excluded = dimensionAnnotationStrokes(segments, [label], scale);
  assert.equal(excluded.size, 7, 'complete labelled dimension is excluded across rotation and scale');
  assert.equal(dimensionAnnotationStrokes(segments, [], scale).size, 0, 'no label: no inferred dimension');
  assert.equal(dimensionAnnotationStrokes(segments, [{ ...label, text: '8500' }], scale).size, 0, 'wrong measured value is not evidence');
  assert.equal(dimensionAnnotationStrokes(segments.slice(0, -1), [label], scale).size, 0, 'incomplete terminal figure is retained');
  const realFace = { ...baseline, path: 3 };
  const returnFace = stroke([9000, 0], [9000, 3000], 3);
  const withWall = dimensionAnnotationStrokes([...segments, realFace, returnFace], [label], scale);
  assert.ok(!withWall.has(realFace) && !withWall.has(returnFace), 'real L-shaped wall coincident with dimension is preserved');
  const ordinaryWall = [stroke([0, 90], [9000, 90], 4), stroke([9000, 90], [9000, 3000], 4)];
  assert.ok(ordinaryWall.every(s => !dimensionAnnotationStrokes([...segments, ...ordinaryWall], [label], scale).has(s)), 'adjacent real wall faces are preserved');
}
console.log('Dimension provenance: labelled figures excluded; incomplete figures, wrong labels and real walls retained.');

// Paint paths are not semantic objects: a disconnected cap can share a
// dimension's path, while a connected real return must remain protected.
{
  const ppm = .1;
  const line = (x1, y1, x2, y2, path, subpath) => ({ x1: x1 * ppm, y1: y1 * ppm, x2: x2 * ppm, y2: y2 * ppm, path, subpath });
  const baseline = line(250, 0, 3750, 0, 10, 1);
  const cap = line(9000, 9000, 9070, 9000, 10, 2);
  const markers = [0, 4000].flatMap((x, i) => [line(x - 250, 0, x + 250, 0, 20, i * 3),
    line(x, -400, x, 400, 20, i * 3 + 1), line(x - 125, -125, x + 125, 125, 20, i * 3 + 2)]);
  const label = { text: '4000', x: 2000 * ppm, y: -300 * ppm };
  const result = dimensionAnnotationStrokes([baseline, cap, ...markers], [label], ppm);
  assert.ok(result.has(baseline), 'dimension subpath is excluded');
  assert.ok(!result.has(cap), 'unrelated wall cap sharing the paint operation survives');
  const joined = line(3750, 0, 3750, 1000, 10, 3);
  assert.ok(!dimensionAnnotationStrokes([baseline, joined, ...markers], [label], ppm).has(baseline), 'connected wall return prevents subpath exclusion');
  const short = [0, 140].flatMap((x, i) => [line(x - 250, 0, x + 250, 0, 30, i * 3),
    line(x, -400, x, 400, 30, i * 3 + 1), line(x - 125, -125, x + 125, 125, 30, i * 3 + 2)]);
  const shortLabel = { text: '140', x: 70 * ppm, y: -300 * ppm };
  assert.equal(dimensionAnnotationStrokes(short, [shortLabel], ppm).size, 6, 'overlapping complete terminals need no baseline');
  assert.equal(dimensionAnnotationStrokes(short, [], ppm).size, 0, 'terminal geometry without a measured label is retained');
  assert.equal(dimensionAnnotationStrokes(short.slice(0, -1), [shortLabel], ppm).size, 0, 'missing tick is not a complete dimension');
}
