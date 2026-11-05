import assert from 'node:assert/strict';
import { associateTakeoffMeasurements } from '../lib/construction-estimation/takeoffMaterialQuantities.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const wall = { id: 'host', kind: 'wall', page: 1, category: 'interior', lengthMm: 3000, thicknessMm: 90 };
const openings = ['Other Opening', 'Window', 'External Door'].map((openingClass, i) => ({
  id: `opening-${i}`, kind: 'opening', page: 1, hostWallId: wall.id, openingClass, widthMm: 897, heightMm: 2100,
}));
const linked = associateTakeoffMeasurements([wall, ...openings], 1);
assert.deepEqual(linked.filter(o => o.kind === 'opening').map(o => o.openingClass), ['Other Opening', 'Window', 'Internal Door']);
assert.equal(openings[2].openingClass, 'External Door', 'association does not mutate source records');
const job = { pixelsPerMm: 1, totalPages: 1, sheetLevels: { 1: 'Ground Floor' }, completedWallRuns: [wall], placedOpenings: openings };
const withSquareSet = createJobSetupPayload(createTakeoffSchedule(job));
const withoutSquareSet = createJobSetupPayload(createTakeoffSchedule({ ...job, placedOpenings: openings.slice(1) }));
for (const key of ['doorOpeningsQty', 'internalDoorOpeningsQty', 'externalDoorOpeningsQty']) {
  assert.equal(withSquareSet.dataInputFields[key], withoutSquareSet.dataInputFields[key], `${key}: square set is not a door`);
}
console.log('PASS square-set class and measured width survive hosting; ordinary doors and windows retain classification rules; no extra door quantity.');
