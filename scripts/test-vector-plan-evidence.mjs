// Drawing evidence read from a vector PDF's linework, with known geometry at 0.1 px per mm:
// door swings (quarter circles drawn as chords) locate their doorways; frame and glass lines drawn
// across a gap make it a window; room outlines are moved onto the measured wall faces.
import assert from 'node:assert/strict';
import { detectVectorDoorSwings, swingEvidence } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorDoorSwings.js';
import { gapGlazingEvidence } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorGapEvidence.js';
import { snapRoomToWallFaces } from '../components/construction-estimation/ai-plan-takeoff/geometry/roomWallFaces.js';

const ppm = 0.1;
const arc = (cx, cy, r, fromDeg, toDeg, steps, path) => Array.from({ length: steps }, (_, i) => {
  const a0 = (fromDeg + (toDeg - fromDeg) * i / steps) * Math.PI / 180, a1 = (fromDeg + (toDeg - fromDeg) * (i + 1) / steps) * Math.PI / 180;
  return { x1: cx + r * Math.cos(a0), y1: cy + r * Math.sin(a0), x2: cx + r * Math.cos(a1), y2: cy + r * Math.sin(a1), path, subpath: path };
});

// ---- Door swings ------------------------------------------------------------------------------
// An 820 mm door hinged at (100, 200) in a horizontal wall: closed along the wall towards +x,
// open leaf drawn straight up from the hinge.
const door = [...arc(100, 200, 82, 0, -90, 16, 1), { x1: 100, y1: 200, x2: 100, y2: 118, path: 2, subpath: 2 }];
let swings = detectVectorDoorSwings(door, ppm);
assert.equal(swings.length, 1, 'one door');
assert.ok(Math.abs(swings[0].radiusMm - 820) <= 1, `leaf width from the radius (${swings[0].radiusMm})`);
assert.ok(swings[0].leafDrawn, 'the straight leaf is found');
assert.ok(Math.abs(swings[0].centre.x - 141) < 0.5 && Math.abs(swings[0].centre.y - 200) < 0.5, 'the doorway centre lies on the wall, half a leaf from the hinge');
assert.deepEqual(swingEvidence(swings)[0].kind, 'door');
// No leaf drawn: the hinge (a jamb) is the located point.
swings = detectVectorDoorSwings(arc(100, 200, 82, 0, -90, 16, 1), ppm);
assert.equal(swings[0].centre, null); assert.deepEqual([swingEvidence(swings)[0].x, swingEvidence(swings)[0].y].map(Math.round), [100, 200]);
// Not doors: a half circle (a basin), a tiny arc (a tap), a wide arc (a 2 m curve), a wobbly line.
assert.equal(detectVectorDoorSwings(arc(100, 200, 82, 0, 180, 16, 1), ppm).length, 0, 'a half circle is not a door');
assert.equal(detectVectorDoorSwings(arc(100, 200, 20, 0, 90, 8, 1), ppm).length, 0, 'a 200 mm arc is not a door');
assert.equal(detectVectorDoorSwings(arc(100, 200, 200, 0, 90, 16, 1), ppm).length, 0, 'a 2 m arc is not a door');
// One point 60 mm off the circle (moved outward along its radius).
const wobbly = arc(100, 200, 82, 0, -90, 16, 1).map((s, i) => {
  if (i !== 8) return s;
  const r = Math.hypot(s.x2 - 100, s.y2 - 200);
  return { ...s, x2: 100 + (s.x2 - 100) * (r + 6) / r, y2: 200 + (s.y2 - 200) * (r + 6) / r };
});
assert.equal(detectVectorDoorSwings(wobbly, ppm).length, 0, 'points off the circle are not a swing');
// The same swing drawn twice (two layers) is one door.
assert.equal(detectVectorDoorSwings([...arc(100, 200, 82, 0, -90, 16, 1), ...arc(100, 200, 82, 0, -90, 16, 3)], ppm).length, 1);

// ---- Glazing across a gap ---------------------------------------------------------------------
// A 230 mm wall centred y = 300 with a 1.2 m gap centred x = 500; a window draws three lines across it.
const gap = { x: 500, y: 300, axis: 'h', widthMm: 1200, hostThicknessMm: 230, confirmed: false, kind: 'wall-gap' };
const glass = [{ x1: 440, y1: 290, x2: 560, y2: 290 }, { x1: 440, y1: 300, x2: 560, y2: 300 }, { x1: 440, y1: 310, x2: 560, y2: 310 }];
let evidence = gapGlazingEvidence([gap], glass, ppm);
assert.equal(evidence.length, 1, 'frame and glass lines across a gap make it a window');
assert.deepEqual([evidence[0].x, evidence[0].y, evidence[0].kind, evidence[0].lines], [500, 300, 'window', 3]);
assert.equal(gapGlazingEvidence([gap], glass.slice(0, 1), ppm).length, 0, 'one line (a threshold, a step) is not enough');
assert.equal(gapGlazingEvidence([gap], glass.map((s) => ({ ...s, x2: s.x1 + 60 })), ppm).length, 0, 'lines across only half the gap are not a window');
assert.equal(gapGlazingEvidence([gap], glass.map((s) => ({ ...s, y1: s.y1 + 60, y2: s.y2 + 60 })), ppm).length, 0, 'lines outside the wall thickness (a bench, a dimension) are not');
assert.equal(gapGlazingEvidence([{ ...gap, confirmed: true }], glass, ppm).length, 0, 'a confirmed gap needs no more evidence');

// ---- Room outline onto wall faces -------------------------------------------------------------
// A room traced 1-2 px inside/outside its walls: 90 mm walls centred x=100, x=500, y=100, y=400.
const walls = [
  { axis: 'v', nodes: [{ x: 100, y: 100 }, { x: 100, y: 400 }], measuredThicknessMm: 90 },
  { axis: 'v', nodes: [{ x: 500, y: 100 }, { x: 500, y: 400 }], measuredThicknessMm: 90 },
  { axis: 'h', nodes: [{ x: 100, y: 100 }, { x: 500, y: 100 }], measuredThicknessMm: 90 },
  { axis: 'h', nodes: [{ x: 100, y: 400 }, { x: 500, y: 400 }], measuredThicknessMm: 90 },
];
const traced = [{ x: 106, y: 103 }, { x: 494, y: 103 }, { x: 494, y: 397 }, { x: 106, y: 397 }];
const { polygon, movedEdges, areaChangeM2 } = snapRoomToWallFaces(traced, walls, ppm);
assert.deepEqual(polygon, [{ x: 104.5, y: 104.5 }, { x: 495.5, y: 104.5 }, { x: 495.5, y: 395.5 }, { x: 104.5, y: 395.5 }], 'each edge on the inner face of its wall');
assert.equal(movedEdges, 4);
assert.ok(Math.abs(areaChangeM2 - ((391 * 291) - (388 * 294)) / 0.01 / 1e6) < 1e-9, 'area change follows the moved edges');
// An edge with no wall along it (an open-plan side) stays.
const open = snapRoomToWallFaces(traced, walls.slice(0, 3), ppm).polygon;
assert.equal(open[2].y, 397, 'an edge with no wall face stays where it was traced');

// A 20 mm notch whose two sides are both nearest the same wall face (x = 301.9): both would land on
// it and the notch's floor would collapse to nothing. The traced outline is kept rather than an
// invalid boundary.
const notch = [{ x: 106, y: 103 }, { x: 300, y: 103 }, { x: 300, y: 110 }, { x: 302, y: 110 }, { x: 302, y: 103 }, { x: 494, y: 103 }, { x: 494, y: 397 }, { x: 106, y: 397 }];
const notchWalls = [...walls, { axis: 'v', nodes: [{ x: 297.4, y: 100 }, { x: 297.4, y: 120 }], measuredThicknessMm: 90 }];
const folded = snapRoomToWallFaces(notch, notchWalls, ppm);
assert.ok(folded.rejected, 'a snap that would reverse an edge is refused');
assert.deepEqual(folded.polygon, notch, 'the traced outline is kept');

console.log('vector plan evidence: all checks passed');
