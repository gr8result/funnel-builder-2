// Wall topology: measured walls are fitted to the drawing's vector face lines, and walls that meet
// share one junction point. Known geometry at 0.1 px per mm (10 mm per pixel).
import assert from 'node:assert/strict';
import { connectWallJunctions } from '../components/construction-estimation/ai-plan-takeoff/geometry/wallJunctions.js';
import { fitWallsToVectorLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWallFit.js';

const ppm = 0.1;
const h = (id, y, x0, x1, t = 90) => ({ id, axis: 'h', nodes: [{ x: x0, y }, { x: x1, y }], thicknessMm: t, measuredThicknessMm: t, lengthMm: (x1 - x0) / ppm });
const v = (id, x, y0, y1, t = 90) => ({ id, axis: 'v', nodes: [{ x, y: y0 }, { x, y: y1 }], thicknessMm: t, measuredThicknessMm: t, lengthMm: (y1 - y0) / ppm });
const byId = (walls) => new Map(walls.map((wall) => [wall.id, wall]));
const same = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;

// ---- L corner: each wall stops at the other's outer face, as raster bands do --------------------
// Horizontal 230 mm wall centred y=100 from x=88.5 (outer face of the vertical) to 400; vertical
// centred x=100 from y=88.5 to 400. Their centrelines must meet at (100, 100).
{
  const { walls, junctions, report } = connectWallJunctions([h('top', 100, 88.5, 400, 230), v('left', 100, 88.5, 400, 230)], ppm);
  const w = byId(walls);
  assert.ok(same(w.get('top').nodes[0], { x: 100, y: 100 }), 'L: horizontal end moved to the corner');
  assert.ok(same(w.get('left').nodes[0], { x: 100, y: 100 }), 'L: vertical end moved to the corner');
  assert.equal(w.get('top').junctionIds[0], w.get('left').junctionIds[0], 'L: both ends share one junction id');
  assert.equal(junctions.length, 1); assert.equal(junctions[0].kind, 'L');
  assert.equal(report.joined, 2); assert.equal(report.free, 2);
  assert.ok(Math.abs(w.get('top').lengthMm - 3000) < 1e-6, 'L: length recomputed to the junction (3.0 m centreline)');
}

// ---- T junction: a stem short of the through wall's face, and one that ran past its centreline ----
// A wall ending against a wall that runs on past it is built to that wall's face (y = 200 + 4.5).
{
  const { walls, junctions } = connectWallJunctions([h('wall', 200, 0, 600), v('stem', 300, 207, 500), v('over', 450, 190, 500)], ppm);
  const w = byId(walls);
  assert.ok(same(w.get('stem').nodes[0], { x: 300, y: 204.5 }), 'T: a stem stopping short is lengthened to the through wall face');
  assert.ok(same(w.get('over').nodes[0], { x: 450, y: 204.5 }), 'T: a stem that ran past the centreline is shortened to the face');
  assert.ok(Math.abs(w.get('stem').lengthMm - 2955) < 1e-6, 'T: the stem measures face to face (as framed)');
  assert.deepEqual(w.get('wall').nodes, [{ x: 0, y: 200 }, { x: 600, y: 200 }], 'T: the through wall keeps its ends');
  const stemJunction = junctions.find((item) => item.id === w.get('stem').junctionIds[0]);
  assert.equal(stemJunction.kind, 'T'); assert.ok(stemJunction.wallIds.includes('wall') && stemJunction.wallIds.includes('stem'), 'T: the junction names both walls');
}

// ---- One wall broken by a sliver is joined; a doorway-wide gap is not --------------------------
{
  const { walls } = connectWallJunctions([h('a', 100, 0, 200), h('b', 100.5, 220, 400), h('c', 100, 482, 700)], ppm);
  const w = byId(walls);
  assert.ok(same(w.get('a').nodes[1], w.get('b').nodes[0]), 'line: a 200 mm sliver between pieces of one wall is closed at a shared point');
  assert.equal(w.get('a').junctionIds[1], w.get('b').junctionIds[0]);
  assert.equal(w.get('b').nodes[1].x, 400, 'line: an 820 mm doorway is never closed');
  assert.equal(w.get('c').junctionIds[0], null, 'line: the far side of the doorway stays free');
}

// ---- Far walls are not joined; a nub inside a crossing wall is set aside; one wall never joins
//      the same crossing wall at both ends -----------------------------------------------------
{
  const { walls, setAside } = connectWallJunctions([h('wall', 100, 0, 500, 230), v('far', 300, 160, 400), v('nub', 250, 92, 108), h('short', 300, 180, 205)], ppm);
  const w = byId(walls);
  assert.equal(w.get('far').junctionIds[0], null, 'a wall 600 mm from another is not joined to it');
  assert.ok(!w.has('nub') && setAside.some((item) => item.id === 'nub'), 'a piece inside a crossing wall\'s thickness is set aside, not kept as a wall');
  assert.ok(w.get('short').lengthMm > 0, 'a short wall is not collapsed to nothing');
}

// ---- Vector fit: raster faces a line-width out, thickness over-read ---------------------------
{
  // Drawn: a 90 mm wall with faces at y = 100 and y = 109 (x 0..400), a 1 m door gap at x 200..300
  // in its faces; and a wall with only one drawn face.
  const segments = [
    { x1: 0, y1: 100, x2: 200, y2: 100 }, { x1: 300, y1: 100, x2: 400, y2: 100 },
    { x1: 0, y1: 109, x2: 200, y2: 109 }, { x1: 300, y1: 109, x2: 400, y2: 109 },
    { x1: 600, y1: 0, x2: 600, y2: 300 }, // single face
    { x1: 0, y1: 105, x2: 3, y2: 107 }, // lettering
  ];
  const raster = [h('w', 106, 0, 200, 130), v('lone', 604, 0, 300, 90)];
  const { walls, report } = fitWallsToVectorLinework(raster, segments, ppm);
  const w = byId(walls);
  assert.equal(w.get('w').nodes[0].y, 104.5, 'fit: centreline is the midpoint of the drawn faces');
  assert.equal(w.get('w').measuredThicknessMm, 90, 'fit: thickness is the drawn face separation');
  assert.equal(w.get('w').thicknessMm, 90);
  assert.equal(w.get('w').nodes[1].x, 200, 'fit: a free end goes to where both faces stop (the door jamb)');
  assert.equal(w.get('w').positionBasis, 'pdf-vector');
  assert.equal(w.get('lone').positionBasis, 'raster', 'fit: a wall with one drawn face keeps its raster position');
  assert.equal(w.get('lone').nodes[0].x, 604);
  assert.equal(report.fitted, 1); assert.equal(report.unfitted, 1);
  assert.deepEqual(fitWallsToVectorLinework(raster, [], ppm).walls, raster, 'fit: no linework, no change');
}

console.log('wall topology: all checks passed');
