import assert from 'node:assert/strict';
import { createLevel, mergeDetections, computeRooms, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';

// A T stem and lower wall join after insertion, moving their node into snap
// reach of the upper wall. The shared node is no longer a free endpoint.
for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
  const point = (x, y) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
  const wall = (id, x, y, X, Y, thicknessMm = 70) => ({ a: point(x, y), b: point(X, Y), thicknessMm, detectionKey: id });
  const read = end => mergeDetections(createLevel({ id: 'late-tee' }), { walls: [
    wall('top', 0, 0, 4000, 0), wall('right', 4000, 0, 4000, 3000),
    wall('cross', 70, 1835, 4000, 1835), wall('lower', 0, 1870, 0, 3000, 140),
    wall('upper', 0, 70, 0, end, 140),
  ] }, { measuredLinework: true }).level;
  const level = read(1800);
  const byKey = key => Object.values(level.walls).find(w => w.detectionKey === key);
  assert.equal(computeRooms(level).length, 1, 'existing T node closes the measured room');
  const junction = byKey('cross').nodeIds.find(id => byKey('lower').nodeIds.includes(id));
  assert.ok(byKey('upper').nodeIds.includes(junction), 'all three measured walls share the existing junction');
  assert.equal(Object.keys(level.walls).length, 5, 'no additional wall or bridge is invented');
  assert.ok(wallPoints(level, byKey('right')).length >= 3, 'real opposing wall and its T junction remain');
  assert.equal(computeRooms(read(1300)).length, 0, 'a gap outside existing snap reach remains open');
}
console.log('Late T junction: shared node reused within existing snap reach; larger gap and real walls preserved.');
