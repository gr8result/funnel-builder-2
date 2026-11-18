import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';
import { tickedDimensionStrokes } from '../components/construction-estimation/ai-plan-takeoff/geometry/dimensionLinework.js';
import { buildingOutlines } from '../components/construction-estimation/ai-plan-takeoff/geometry/buildingOutline.js';

// General sheet conventions (2026-11-18), checked on drawings that are not any one job:
// 1. dimension strings with no text layer (outlined lettering) are recognised from their ticks and
//    extension lines, so paired extension lines are never read as walls;
// 2. a title-block strip (two edge-to-edge lines close together) and its tables teach nothing and are not walls;
// 3. the building outline follows the measured external walls, so an open-plan area that does not close as a
//    room is still floor area.
const W = 842, H = 1190, scale = 0.02834645669291339; // A3 portrait in points at 1:100
const segments = [];
let path = 0;
const line = (x1, y1, x2, y2, widthPx = 0.24, sameSubpath = false) => { segments.push({ x1, y1, x2, y2, path: sameSubpath ? path : ++path, subpath: segments.length, paint: 'stroke', widthPx, color: '#000000' }); return segments.at(-1); };
const mm = (v) => v * scale;
// Building 12 x 9 m with 230 mm external walls and one 90 mm internal wall, origin (300, 400) pt.
const ox = 300, oy = 400, bw = mm(12000), bh = mm(9000), t = mm(230), it = mm(90);
const rect = (x0, y0, x1, y1) => { line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0); };
rect(ox, oy, ox + bw, oy + bh); rect(ox + t, oy + t, ox + bw - t, oy + bh - t);
line(ox + mm(5000), oy + t, ox + mm(5000), oy + bh - t); line(ox + mm(5000) + it, oy + t, ox + mm(5000) + it, oy + bh - t);
// A mitre stroke at one outer corner (must NOT make the corner a dimension point).
const mitre = line(ox - 3, oy - 3, ox + 3, oy + 3, 0.72);
// Dimension strings above the building, drawn as the outlined-text CAD exports draw them: a dimension line,
// 45-degree ticks and extension lines crossing it. Extension lines are 230 mm apart where a wall is dimensioned.
const rows = [oy - 40, oy - 25];
const stations = [ox, ox + t, ox + mm(5000), ox + mm(5000) + it, ox + bw - t, ox + bw];
const dimStrokes = [];
for (const y of rows) {
  dimStrokes.push(line(stations[0], y, stations.at(-1), y, 0.24));
  dimStrokes.push(line(stations[0] - 4, y, stations[0], y, 0.72), line(stations.at(-1), y, stations.at(-1) + 4, y, 0.72));
  for (const x of stations) dimStrokes.push(line(x - 2.75, y + 2.75, x + 2.75, y - 2.75, 0.72));
}
for (const x of stations) dimStrokes.push(line(x, rows[0] - 6, x, oy - 8, 0.72));
// Title-block strip along the left edge: two edge-to-edge lines and an amendments table inside.
line(20, 26, 20, H - 26, 0.72); line(22.6, 28, 22.6, H - 28, 0.72); line(137, 28, 137, H - 28, 0.72);
for (let k = 0; k < 7; k += 1) line(36 + k * 17.3, 600, 36 + k * 17.3, 780, 0.72);
for (const y of [600, 640, 680, 720, 780]) line(22.6, y, 137, y, 0.72);

const context = { pixelsPerMm: scale, logicalWidth: W, logicalHeight: H };
// 1. Dimension strokes are recognised; the corner mitre is not.
const dims = tickedDimensionStrokes(segments);
assert.ok(dimStrokes.filter((s) => dims.has(s)).length >= dimStrokes.length - 2, `the dimension strings are recognised (${dimStrokes.filter((s) => dims.has(s)).length}/${dimStrokes.length})`);
assert.ok(!dims.has(mitre), 'a mitre stroke at a building corner is not a dimension tick');
assert.ok(![...dims].some((s) => s.widthPx === 0.24 && Math.abs(s.y1 - s.y2) < 0.01 && (Math.abs(s.y1 - oy) < 0.01 || Math.abs(s.y1 - (oy + t)) < 0.01)), 'no wall face is taken as a dimension line');
const found = detectVectorWalls(segments, context);
const inside = (w) => w.nodes.every((n) => n.x >= ox - 2 && n.x <= ox + bw + 2 && n.y >= oy - 2 && n.y <= oy + bh + 2);
assert.ok(found.walls.length >= 5 && found.walls.every(inside), `only the building's walls are walls (${found.walls.map((w) => `${Math.round(w.lengthMm)}@${Math.round(w.measuredThicknessMm)}`).join(', ')})`);
assert.ok(found.walls.some((w) => Math.abs(w.measuredThicknessMm - 230) < 10 && w.lengthMm > 11000), 'the 230 mm external walls are measured');
assert.ok(found.walls.some((w) => Math.abs(w.measuredThicknessMm - 90) < 10 && w.lengthMm > 8000), 'the 90 mm internal wall is measured');
assert.deepEqual(found.stats.wallPens, ['stroke|0.24|#000000'], 'wall pens are learned from the building, not the title block or dimensions');
// Without the recogniser the paired extension lines are wall candidates (other rules must then catch them);
// with it they never are (proves the test exercises the recogniser).
const aboveBuilding = (r) => Math.max(r.a.y, r.b.y) < oy - 2;
const unguarded = detectVectorWalls(segments, context, { tickedDimensions: false });
assert.ok(unguarded.rejected.some(aboveBuilding), 'without the recogniser, paired extension lines are wall candidates');
assert.ok(!found.rejected.some(aboveBuilding), 'with it, no extension-line pair is even a candidate');
// 2. A plan cropped tight to its building (walls nearly the sheet's length, not edge to edge) keeps its walls.
const cropped = segments.filter((s) => s.y1 > 300 && s.y2 > 300 && s.x1 > 150 && s.x2 > 150).map((s) => ({ ...s, x1: s.x1 - ox + 4, x2: s.x2 - ox + 4, y1: s.y1 - oy + 4, y2: s.y2 - oy + 4 }));
const tight = detectVectorWalls(cropped, { pixelsPerMm: scale, logicalWidth: bw + 8, logicalHeight: bh + 8 });
assert.ok(tight.walls.some((w) => w.lengthMm > 11000), 'a tightly cropped plan keeps its long walls');

// 3. The outline follows the external walls: one small closed room inside a 12 x 9 m external ring.
const ringWall = (a, b) => ({ nodes: [a, b], thicknessMm: 230 });
const ring = [ringWall({ x: 0, y: 0 }, { x: 12000, y: 0 }), ringWall({ x: 12000, y: 0 }, { x: 12000, y: 9000 }), ringWall({ x: 12000, y: 9000 }, { x: 0, y: 9000 }), ringWall({ x: 0, y: 9000 }, { x: 0, y: 0 })];
const room = [{ x: 115, y: 115 }, { x: 3000, y: 115 }, { x: 3000, y: 3000 }, { x: 115, y: 3000 }];
const roomsOnly = buildingOutlines([room], ring)[0];
const withEnvelope = buildingOutlines([room], ring, {}, ring)[0];
assert.ok(roomsOnly.areaM2 < 20, `rooms alone leave the open-plan area out (${roomsOnly.areaM2.toFixed(1)} m²)`);
assert.ok(Math.abs(withEnvelope.areaM2 - 12.23 * 9.23) < 2, `with the external walls the outline is the building to its outer face (${withEnvelope.areaM2.toFixed(1)} m²)`);
console.log('Sheet annotations: text-free dimension strings, title-block strips and the external-wall outline handled; corner mitres and cropped plans protected.');
