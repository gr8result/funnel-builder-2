import assert from 'node:assert/strict';
import { plan } from './test-vector-window-boxes.mjs';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
for (const scale of [.0283, .09]) {
  const { segments, context } = plan(scale);
  const rectangle = (lo, hi, path, widthPx = .72) => [[lo, lo, hi, lo], [hi, lo, hi, hi], [hi, hi, lo, hi], [lo, hi, lo, lo]].map(([x1, y1, x2, y2]) =>
    ({ x1: x1 * scale, y1: y1 * scale, x2: x2 * scale, y2: y2 * scale, path, subpath: 0, paint: 'stroke', widthPx, color: '#000000' }));
  const border = rectangle(1500, 48500, 9000);
  const rules = rectangle(1700, 48300, 9001, .24);
  const found = detectVectorWalls([...segments, ...border, ...rules], context);
  assert.ok(!found.stats.wallPens.some(pen => pen.includes('|0.72|')), 'balanced full-sheet printing frame cannot teach a wall pen from title rules');
  assert.ok(found.walls.some(w => w.lengthMm > 5000 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real plan walls are preserved');
  const real = detectVectorWalls([...segments, ...rectangle(10000, 40000, 9100), ...rectangle(10070, 39930, 9101)], context);
  assert.ok(real.stats.wallPens.some(pen => pen.includes('|0.72|')), 'a real rectangular wall outline inside the page still teaches its pen');
  assert.ok(real.walls.some(w => w.lengthMm > 29000 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real rectangular wall faces remain admitted by detection');
}
console.log('Sheet frames: balanced paper perimeter excluded from learning; real rectangular walls retain their measured pen and geometry.');
