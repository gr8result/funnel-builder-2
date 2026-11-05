import assert from 'node:assert/strict';
import { createTakeoffSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { rescaleRunLengths } from '../components/construction-estimation/ai-plan-takeoff/sheetScale.js';
import { takeoffCalibrationCheck } from '../lib/construction-estimation/takeoffCalibrationGate.js';
const floors = [1, 2].map(page => ({ id: `floor-${page}`, page, type: 'Living',
  nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }));
const original = JSON.stringify(floors);
const base = { totalPages: 2, completedFloorplans: floors,
  scheduleState: { sheetCalibrations: { 0: { pixelsPerMm: .01 }, 2: { pixelsPerMm: .005 } } } };
for (const pixelsPerMm of [.01, .005]) {
  const schedule = createTakeoffSchedule({ ...base, pixelsPerMm });
  assert.equal(schedule.projectTotals.floorAreas.find(r => r.itemId === 'floor_Living').quantity, 5,
    '1 m² lower + 4 m² upper: quantities do not depend on the active sheet');
  assert.deepEqual(schedule.project.calibratedScaleBySheet.map(s => s.pixelsPerMm), [.01, .005]);
  const job = { ...base, pixelsPerMm };
  assert.equal(takeoffCalibrationCheck(job, schedule).ok, true, 'mixed scales with measured export evidence are allowed');
  assert.equal(takeoffCalibrationCheck(job).ok, false, 'legacy mixed-scale exports without evidence remain blocked');
  const staleExport = structuredClone(schedule);
  staleExport.project.calibratedScaleBySheet[1].pixelsPerMm = .02;
  assert.equal(takeoffCalibrationCheck(job, staleExport).ok, false, 'stale export calibration is rejected');
  const missingSheet = structuredClone(job);
  delete missingSheet.scheduleState.sheetCalibrations[2];
  delete missingSheet.scheduleState.sheetCalibrations[0];
  delete missingSheet.pixelsPerMm;
  assert.equal(takeoffCalibrationCheck(missingSheet, schedule).ok, false, 'a measured sheet cannot borrow another sheet calibration');
  const inconsistentStamp = structuredClone(job);
  inconsistentStamp.completedFloorplans[1].sheetPixelsPerMm = .02;
  assert.equal(takeoffCalibrationCheck(inconsistentStamp, schedule).ok, false, 'stale measurement calibration is rejected');
  const missingEvidence = structuredClone(schedule);
  for (const record of missingEvidence.measurementRecords) delete record.measuredAtSheetScale;
  assert.equal(takeoffCalibrationCheck(job, missingEvidence).ok, false, 'mixed geometry must carry its actual measurement scale');
  for (const invalid of [0, -1, NaN, Infinity, 'bad']) {
    const bad = structuredClone(job);
    bad.scheduleState.sheetCalibrations[2].pixelsPerMm = invalid;
    assert.equal(takeoffCalibrationCheck(bad, schedule).ok, false, 'invalid explicit calibration cannot fall back to the job scale');
  }
}
assert.equal(JSON.stringify(floors), original, 'schedule conversion never moves saved drawing coordinates');
const runs = [{ page: 1, lengthMm: 1000 }, { page: 2, lengthMm: 1000 }];
const rescaled = rescaleRunLengths(runs, () => .01, page => page === 2 ? .005 : .01);
assert.equal(rescaled[0], runs[0], 'other sheets are unchanged');
assert.equal(rescaled[1].lengthMm, 2000);
const inconsistent = { ...base, pixelsPerMm: .01, completedWallRuns: [{ page: 2, nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], lengthMm: 1000 }] };
assert.equal(takeoffCalibrationCheck(inconsistent, createTakeoffSchedule(inconsistent)).ok, false, 'stale cached wall lengths cannot reach quotation');
inconsistent.completedWallRuns[0].lengthMm = 2000;
assert.equal(takeoffCalibrationCheck(inconsistent, createTakeoffSchedule(inconsistent)).ok, true);
inconsistent.completedWallRuns[0].lengthMm = -2000;
assert.equal(takeoffCalibrationCheck(inconsistent, createTakeoffSchedule(inconsistent)).ok, false, 'invalid lengths are rejected');
assert.equal(takeoffCalibrationCheck({ completedWallRuns: [{ page: 1 }] }).ok, false, 'no calibration is rejected');
console.log('Per-sheet calibration: lengths, area quantities, active-sheet independence and original geometry preserved.');
