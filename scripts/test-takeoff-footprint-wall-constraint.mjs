// The plan reading's footprint is moved onto measured drawing geometry: the outer face of measured
// external walls, or a drawn outdoor outline on an open side. Synthetic plans in millimetres.
import assert from 'node:assert/strict';
import { constrainFootprintToWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/footprintWallConstraint.js';

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const area = (nodes) => Math.abs(nodes.reduce((s, p, i) => { const q = nodes[(i + 1) % nodes.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2) / 1e6;
const wall = (id, a, b, thicknessMm = 250) => ({ id, nodes: [a, b], thicknessMm });
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
// A 20 x 10 m house whose external wall centrelines are this rectangle: outer faces 125 mm outside.
const houseWalls = [
  wall('n', { x: 0, y: 0 }, { x: 20000, y: 0 }), wall('e', { x: 20000, y: 0 }, { x: 20000, y: 10000 }),
  wall('s', { x: 20000, y: 10000 }, { x: 0, y: 10000 }), wall('w', { x: 0, y: 10000 }, { x: 0, y: 0 }),
];
const outer = (20000 + 250) * (10000 + 250) / 1e6;

// 1. Reading 300-600 mm out on every side: every edge lands on the outer face.
{
  const fit = constrainFootprintToWalls(rect(-500, -300, 20600, 10400), houseWalls);
  assert.equal(fit.status, 'constrained');
  assert.equal(fit.movedEdges, 4);
  near(fit.afterM2, outer, 0.01, 'area to outer faces');
  near(fit.nodes[0].x, -125, 1, 'west face'); near(fit.nodes[0].y, -125, 1, 'north face');
}
// 2. Same result whichever way round the outline is drawn, and from inside the walls.
{
  const reversed = constrainFootprintToWalls(rect(-500, -300, 20600, 10400).reverse(), houseWalls);
  near(reversed.afterM2, outer, 0.01, 'reversed outline');
  const inside = constrainFootprintToWalls(rect(200, 150, 19800, 9850), houseWalls);
  near(inside.afterM2, outer, 0.01, 'outline read inside the walls moves out to the faces');
}
// 3. An open side (patio) with no wall stays where the reading put it unless a drawn outline is there.
{
  // House plus a 4 m patio to the east; the reading stretches the patio edge 2 m too far.
  const reading = rect(-300, -300, 26000, 10300);
  const noOutline = constrainFootprintToWalls(reading, houseWalls.filter((w) => w.id !== 'e'));
  near(noOutline.nodes[1].x, 26000, 1, 'open side without drawn geometry is left alone');
  const patioOutline = { id: 'outline:PATIO', nodes: rect(20125, 2000, 24000, 10125), closed: true, kind: 'outline', thicknessMm: 0 };
  const withOutline = constrainFootprintToWalls(reading, [...houseWalls.filter((w) => w.id !== 'e'), patioOutline]);
  near(withOutline.nodes[1].x, 24000, 1, 'open side follows the drawn patio outline');
  assert.ok(withOutline.moves.some((m) => m.onto === 'outline'), 'move records it came from an outline');
}
// 4. A wall further than the reach is not used.
{
  const fit = constrainFootprintToWalls(rect(-4000, -300, 20300, 10300), houseWalls);
  near(fit.nodes[0].x, -4000, 1, 'west edge 3.9 m from the wall face stays');
  assert.ok(!fit.moves.some((m) => m.id === 'w'));
}
// 5. Walls of a different building (area would change > 12%): rejected, outline unchanged.
{
  const small = [wall('a', { x: 0, y: 0 }, { x: 20000, y: 0 }), wall('b', { x: 0, y: 7500 }, { x: 20000, y: 7500 })];
  const reading = rect(0, -200, 20000, 10200);
  const fit = constrainFootprintToWalls(reading, small);
  assert.equal(fit.status, 'rejected');
  assert.deepEqual(fit.nodes, reading, 'rejected fit keeps the reading');
  assert.match(fit.reason, /changed the area/);
}
// 6. No supports: unverified, unchanged. Short jogs keep their line and follow their neighbours.
{
  const reading = rect(0, 0, 10000, 5000);
  const none = constrainFootprintToWalls(reading, []);
  assert.equal(none.status, 'unverified'); assert.deepEqual(none.nodes, reading);
  // L-shape with a 600 mm jog: the long edges move, the jog stays on its own line.
  const l = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 5000 }, { x: 6000, y: 5000 }, { x: 6000, y: 5600 }, { x: 0, y: 5600 }];
  const walls = [wall('n', { x: 0, y: 200 }, { x: 10000, y: 200 }, 200), wall('s1', { x: 10000, y: 4800 }, { x: 6000, y: 4800 }, 200), wall('s2', { x: 6000, y: 5400 }, { x: 0, y: 5400 }, 200)];
  const fit = constrainFootprintToWalls(l, walls);
  near(fit.nodes[0].y, 100, 1, 'north edge onto outer face');
  near(fit.nodes[3].x, 6000, 1, 'jog keeps its line'); near(fit.nodes[3].y, 4900, 1, 'jog end follows south edge');
  near(fit.nodes[4].y, 5500, 1, 'jog other end follows the other south edge');
}
// 7. Equal output never contains NaN and keeps the node count.
{
  const fit = constrainFootprintToWalls(rect(-500, -300, 20600, 10400), houseWalls);
  assert.equal(fit.nodes.length, 4);
  assert.ok(fit.nodes.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  near(area(fit.nodes), fit.afterM2, 1e-6, 'reported area is the outline area');
}
console.log('PASS: footprint edges move onto external wall faces or drawn outdoor outlines; open sides, far walls, other buildings and missing geometry leave the reading unchanged.');
