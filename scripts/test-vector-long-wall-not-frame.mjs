import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
// Sunshine Cove sheet 4 (2026-11-17): a 200 mm exterior wall whose inner face runs to the outer corners,
// capped by the end walls' outer faces, with a hairline outer face, beside a short 70 mm internal wall,
// has the shape of a "projected frame drawn out from the wall beside it". The whole 18 m exterior wall
// was rejected as a window frame. A box wider than any opening cannot be a window or slider frame.
for (const scale of [.014132, .0283]) for (const angle of [0, Math.PI / 2]) {
  const point = (x, y) => ({ x: (20000 + x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: (2000 + x * Math.sin(angle) + y * Math.cos(angle)) * scale });
  const segments = [];
  const line = (x, y, X, Y, widthPx = .24) => { const a = point(x, y), b = point(X, Y);
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, path: segments.length, subpath: 0, paint: 'stroke', widthPx, color: '#000000' }); };
  // Exterior: outer faces hairline, inner faces 0.24; the right wall's inner face runs to the outer corners.
  line(0, 0, 7200, 0, .06); line(0, 18000, 7200, 18000, .06); line(0, 0, 0, 18000, .06); line(7200, 0, 7200, 18000, .06);
  line(200, 200, 7000, 200); line(200, 17800, 7000, 17800); line(200, 200, 200, 17800); line(7000, 0, 7000, 18000);
  // Internal 70 mm walls: a cross wall, and a short wall standing 200 mm inside the right exterior wall.
  line(200, 8000, 6730, 8000); line(200, 8070, 6730, 8070);
  line(6730, 8000, 6730, 9200); line(6800, 8070, 6800, 9200); line(6730, 9200, 6800, 9200);
  const context = { pixelsPerMm: scale, logicalWidth: 40000 * scale, logicalHeight: 40000 * scale };
  const found = detectVectorWalls(segments, context);
  const rightWall = found.walls.find(w => w.lengthMm > 17000 && Math.abs(w.measuredThicknessMm - 200) < 15
    && w.nodes.every(n => Math.abs((n.x / scale - 20000) * Math.cos(angle) + (n.y / scale - 2000) * Math.sin(angle) - 7100) < 30));
  assert.ok(rightWall, `the 18 m exterior wall is measured (scale ${scale}, angle ${angle}); rejected: ${JSON.stringify(found.rejected.filter(r => r.lengthMm > 17000).map(r => r.reason))}`);
  assert.ok(!found.rejected.some(r => r.lengthMm > 17000 && /projected frame/.test(r.reason)), 'an exterior wall is never a projected window frame');
  assert.ok(!found.openings.some(o => o.widthMm > 6200), 'no opening wider than any opening the engine admits');
  // The case reproduces when the bound is lifted (proves the test exercises the rule).
  const unbounded = detectVectorWalls(segments, context, { openingMaxMm: 1e9 });
  assert.ok(unbounded.rejected.some(r => r.lengthMm > 17000 && /projected frame/.test(r.reason)), 'without the bound the exterior wall is taken for a frame (reproduction)');
}
console.log('Long exterior wall: never taken for a projected window or slider frame; reproduction confirmed without the bound.');
