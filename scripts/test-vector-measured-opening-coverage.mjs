import assert from 'node:assert/strict';
import { createLevel, mergeDetections, wallPoints } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModel.js';
for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
  const point = (x, y) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
  const spec = (key, x, X, y, thicknessMm, attributes) => ({ a: point(x, y), b: point(X, y), thicknessMm, detectionKey: key, attributes });
  const walls = [spec('left', 0, 1000, 0, 70), spec('right', 4000, 5000, 0, 70), spec('parallel', 1000, 4000, 80, 230),
    spec('aperture', 970, 4030, 0, 70, { spansOpening: true })];
  const { level, report } = mergeDetections(createLevel({ id: 'coverage' }), { walls }, { measuredLinework: true });
  assert.equal(report.wallOutcomes.at(-1).status, 'inserted', 'nearby thick parallel wall cannot absorb the measured opening line');
  const aperture = Object.values(level.walls).find(w => w.detectionKey === 'aperture');
  assert.ok(aperture && wallPoints(level, aperture).every(p => Math.abs(-p.x * Math.sin(angle) + p.y * Math.cos(angle)) < .01), 'aperture remains on its measured host line');
  assert.ok(Object.values(level.walls).some(w => w.detectionKey === 'parallel'), 'real neighbouring wall remains');
  const rerun = mergeDetections(level, { walls }, { measuredLinework: true });
  assert.equal(Object.keys(rerun.level.walls).length, Object.keys(level.walls).length, 'rerun does not duplicate the aperture');
  const base = mergeDetections(createLevel({ id: 'manual' }), { walls: walls.slice(0, 3) }, { measuredLinework: true }).level;
  const existing = Object.values(base.walls).find(w => w.detectionKey === 'parallel');
  existing.locked = true; existing.edited = true;
  const corrected = mergeDetections(base, { walls: [walls[3]] }, { measuredLinework: true });
  assert.equal(corrected.report.wallsAdded, 0, 'manual correction retains the established overlap protection');
}
console.log('Measured opening coverage: parallel geometry retained; true host span inserted; reruns and manual corrections preserved.');
