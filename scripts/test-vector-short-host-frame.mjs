import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
for (const scale of [.0283, .09]) for (const angle of [0, Math.PI / 2]) {
  const point = (x, y) => ({ x: (15000 + x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: (15000 + x * Math.sin(angle) + y * Math.cos(angle)) * scale });
  const segments = [];
  const line = (x, y, X, Y) => { const a = point(x, y), b = point(X, Y); const s = { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    path: segments.length, subpath: 0, paint: 'stroke', widthPx: .24, color: '#000000' }; segments.push(s); return s; };
  line(35, 35, 3965, 35); line(-35, -35, 500, -35); line(3500, -35, 4035, -35);
  line(-35, -35, -35, 5035); line(35, 35, 35, 4965);
  line(4035, -35, 4035, 5035); line(3965, 35, 3965, 4965);
  line(-35, 5035, 4035, 5035); line(35, 4965, 3965, 4965);
  const cap = line(500, 35, 500, -259); line(3500, 35, 3500, -259);
  line(500, -110, 3500, -110); line(500, -259, 3500, -259);
  const context = { pixelsPerMm: scale, logicalWidth: 30000 * scale, logicalHeight: 30000 * scale };
  const found = detectVectorWalls(segments, context);
  assert.ok(found.openings.some(o => o.kind === 'window' && Math.abs(o.widthMm - 3000) < 30), 'two measured short corner returns support the complete projected window');
  assert.ok(!found.walls.some(w => w.measuredThicknessMm > 120), 'neither inner nor outer frame pair becomes a solid wall');
  assert.ok(found.walls.some(w => w.lengthMm > 4900 && Math.abs(w.measuredThicknessMm - 70) < 1), 'real full-height walls remain');
  const incomplete = detectVectorWalls(segments.filter(s => s !== cap), context);
  assert.ok(!incomplete.rejected.some(w => w.reason === 'inside a fully capped projected frame adjoining a measured wall'), 'an incomplete cap cannot exclude a real wall pair as a complete frame');
}
console.log('Projected frames: short measured corner hosts suffice; all internal frame pairs excluded; missing cap and real walls protected.');
