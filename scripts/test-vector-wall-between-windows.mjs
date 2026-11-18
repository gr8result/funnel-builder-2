import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
// Sunshine Cove sheet 4 (2026-11-18): the kitchen's exterior wall is drawn as three short pieces between two
// window boxes (1.06 + 1.12 + 0.53 m), 90 mm thick in a drawing whose clean walls are 70 mm. No piece is long
// enough on its own to prove the thickness, so all three were rejected and the kitchen was cut off from the
// building. Pieces on exactly the same two face lines, across opening-sized breaks capped at both sides,
// are one wall as long as the pieces together.
for (const scale of [.014132, .0283]) for (const angle of [0, Math.PI / 2]) {
  const point = (x, y) => ({ x: (20000 + x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: (2000 + x * Math.sin(angle) + y * Math.cos(angle)) * scale });
  const segments = [];
  const line = (x, y, X, Y) => { const a = point(x, y), b = point(X, Y);
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, path: segments.length, subpath: 0, paint: 'stroke', widthPx: .24, color: '#000000' }); };
  // Room 8000 x 4900 inside; top, bottom and right walls 70 mm; the left wall 90 mm, broken by two windows.
  line(-90, 0, 8000, 0); line(-90, -70, 8070, -70);
  line(-90, 4900, 8000, 4900); line(-90, 4970, 8070, 4970);
  line(8000, 0, 8000, 4900); line(8070, -70, 8070, 4970);
  const pieces = [[0, 1060], [2160, 3280], [4380, 4900]];
  for (const [lo, hi] of pieces) { line(0, lo, 0, hi); line(-90, lo === 0 ? -70 : lo, -90, hi === 4900 ? 4970 : hi); }
  // Window boxes drawn out from the wall: caps across the wall at both sides, the outer frame line beyond.
  // (as Sunshine draws them: the frame's inner line on the wall's inner face, its outer line 70 mm outside).
  for (const [lo, hi] of [[1060, 2160], [3280, 4380]]) { line(0, lo, -160, lo); line(0, hi, -160, hi); line(-160, lo, -160, hi); line(0, lo, 0, hi); }
  const context = { pixelsPerMm: scale, logicalWidth: 40000 * scale, logicalHeight: 40000 * scale };
  const along = (n) => (n.x / scale - 20000) * Math.cos(angle) + (n.y / scale - 2000) * Math.sin(angle);
  const leftPieces = (found) => found.walls.filter((w) => w.nodes.every((n) => Math.abs(along(n) + 45) < 15) && Math.abs(w.measuredThicknessMm - 90) < 8);
  const found = detectVectorWalls(segments, context);
  assert.equal(leftPieces(found).length, 3, `all three pieces of the wall between the windows are walls (scale ${scale}, angle ${angle}); rejected: ${JSON.stringify(found.rejected.filter((r) => Math.abs(r.thicknessMm - 90) < 8).map((r) => `${r.lengthMm} ${r.reason}`))}`);
  assert.ok(pieces.every(([lo, hi]) => hi - lo < 1500), 'no single piece is long enough on its own');
  // Reproduction: without the long-run exception the pieces are rejected (90 mm is not one of the clean thicknesses).
  const strict = detectVectorWalls(segments, context, { cleanLongWallMm: 1e9 });
  assert.equal(leftPieces(strict).length, 0, 'the pieces depend on being recognised as one long run');
}
console.log('Wall between windows: pieces on the same face lines across capped window breaks are one wall; reproduction confirmed.');
