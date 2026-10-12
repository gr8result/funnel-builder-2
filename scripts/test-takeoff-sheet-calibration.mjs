// Each plan sheet is measured at its own scale. Walls, openings, floor areas and rooms on a sheet
// calibrated on its own use that calibration; every other sheet uses the job's. Changing one
// sheet's calibration changes that sheet's quantities and no other sheet's.
import assert from 'node:assert/strict';
import { JOB_SCALE_KEY, jobPixelsPerMm, sheetPixelsPerMm, toCommonScale, rescaleRunLengths, hasMixedSheetScales } from '../components/construction-estimation/ai-plan-takeoff/sheetScale.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { resolveAnalysisScale } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';

const close = (actual, expected, message, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);

// --- The scale of a sheet -------------------------------------------------------------------------
assert.equal(sheetPixelsPerMm(3, 0.1, {}), 0.1, 'a takeoff with one calibration uses it on every sheet');
assert.equal(jobPixelsPerMm(0.1, { 2: { pixelsPerMm: 0.05, calibratedAt: '2026-01-02' }, 1: { pixelsPerMm: 0.1, calibratedAt: '2026-01-01' } }), 0.1, 'without a recorded job scale it is the first sheet calibrated');
const calibrations = { [JOB_SCALE_KEY]: { pixelsPerMm: 0.1, calibratedAt: '2026-01-01' }, 1: { pixelsPerMm: 0.1, calibratedAt: '2026-01-01' }, 2: { pixelsPerMm: 0.05, calibratedAt: '2026-01-02' } };
assert.equal(sheetPixelsPerMm(1, 0.05, calibrations), 0.1, 'a sheet\'s own calibration is used whatever the working scale is');
assert.equal(sheetPixelsPerMm(2, 0.1, calibrations), 0.05);
assert.equal(sheetPixelsPerMm(3, 0.05, calibrations), 0.1, 'a sheet never calibrated on its own uses the job scale, not the scale of the sheet on screen');
assert.equal(hasMixedSheetScales(0.1, calibrations), true);
assert.equal(hasMixedSheetScales(0.1, { 1: { pixelsPerMm: 0.1 } }), false);
const same = [{ id: 'a', page: 1, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }];
assert.equal(toCommonScale(same, 0.1, calibrations), same, 'geometry already at the working scale is returned untouched');
assert.equal(toCommonScale(same, 0.1, {}), same, 'a takeoff with one calibration is never restated');

// --- Schedule: the same drawing on three sheets, sheet 2 at half scale ---------------------------
// A 10 m x 8 m room outline and one 10 m wall, drawn at each sheet's own scale.
const sheet = (page, pixelsPerMm) => {
  const w = 10000 * pixelsPerMm, h = 8000 * pixelsPerMm;
  return {
    floorplan: { id: `fp-${page}`, page, type: 'Living', nodes: [{ x: 50, y: 50 }, { x: 50 + w, y: 50 }, { x: 50 + w, y: 50 + h }, { x: 50, y: 50 + h }] },
    wall: { id: `w-${page}`, page, category: 'interior', nodes: [{ x: 50, y: 50 }, { x: 50 + w, y: 50 }], lengthMm: 10000, thicknessMm: 90, alignment: 'outer', exteriorType: '', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null },
    tiles: { id: `t-${page}`, page, category: 'Tiles', nodes: [{ x: 50, y: 50 }, { x: 50 + w / 2, y: 50 }, { x: 50 + w / 2, y: 50 + h / 2 }, { x: 50, y: 50 + h / 2 }] },
  };
};
const drawn = [sheet(1, 0.1), sheet(2, 0.05), sheet(3, 0.1)];
const sheetLevels = { 1: 'Ground Floor', 2: 'Second Level', 3: 'Third Level' };
const scheduleWith = (pixelsPerMm, sheetCalibrations, items = drawn) => createTakeoffSchedule({ projectInfo: {}, planFilename: 'plans.pdf', totalPages: 3, currentPage: 1, pixelsPerMm,
  completedFloorplans: items.map((item) => item.floorplan), completedWallRuns: items.map((item) => item.wall), completedAreas: items.map((item) => item.tiles), sheetLevels, scheduleState: { sheetCalibrations } });
const areaOn = (schedule, page) => schedule.measurementRecords.find((record) => record.id === `fp-${page}`).quantity;
const tilesOn = (schedule, page) => schedule.measurementRecords.find((record) => record.id === `t-${page}`).quantity;
const measured = scheduleWith(0.1, calibrations);
for (const page of [1, 2, 3]) {
  close(areaOn(measured, page), 80, `sheet ${page} floor area`, 1e-6);
  close(tilesOn(measured, page), 20, `sheet ${page} tiled area`, 1e-6);
}
// The working scale is whichever sheet is on screen; the quantities do not depend on it.
const onSheetTwo = scheduleWith(0.05, calibrations);
for (const page of [1, 2, 3]) close(areaOn(onSheetTwo, page), 80, `sheet ${page} floor area with sheet 2 on screen`, 1e-6);
assert.deepEqual(onSheetTwo.project.calibratedScaleBySheet, [{ page: 1, pixelsPerMm: 0.1 }, { page: 2, pixelsPerMm: 0.05 }, { page: 3, pixelsPerMm: 0.1 }]);
// Measured with one scale for every sheet, sheet 2 would be a quarter of its size: the error this prevents.
close(areaOn(scheduleWith(0.1, {}), 2), 20, 'the same sheet measured at the wrong scale', 1e-6);
const fields = createJobSetupPayload(measured, { sheetLevels }).dataInputFields;
for (const prefix of ['lower', 'upper', 'third']) close(fields[`${prefix}Internal90mmWallsLm`], 10, `${prefix} internal wall length`);

// --- Recalibrating one sheet changes that sheet only ----------------------------------------------
const recalibrated = { ...calibrations, 2: { pixelsPerMm: 0.04, calibratedAt: '2026-01-02' } };
const before = (page) => sheetPixelsPerMm(page, 0.05, calibrations), after = (page) => sheetPixelsPerMm(page, 0.04, recalibrated);
const walls = rescaleRunLengths(drawn.map((item) => item.wall), before, after);
assert.equal(walls[0].lengthMm, 10000, 'sheet 1 wall is not changed');
assert.equal(walls[2].lengthMm, 10000, 'sheet 3 wall is not changed');
close(walls[1].lengthMm, 12500, 'sheet 2 wall follows its new scale', 1e-6);
const after2 = scheduleWith(0.04, recalibrated, drawn.map((item, index) => ({ ...item, wall: walls[index] })));
close(areaOn(after2, 1), 80, 'sheet 1 area after sheet 2 is recalibrated');
close(areaOn(after2, 3), 80, 'sheet 3 area after sheet 2 is recalibrated');
close(areaOn(after2, 2), 80 * (0.05 / 0.04) ** 2, 'sheet 2 area follows its new scale', 1e-6);
const fieldsAfter = createJobSetupPayload(after2, { sheetLevels }).dataInputFields;
close(fieldsAfter.lowerInternal90mmWallsLm, 10, 'ground walls unchanged'); close(fieldsAfter.thirdInternal90mmWallsLm, 10, 'third level walls unchanged'); close(fieldsAfter.upperInternal90mmWallsLm, 12.5, 'second level walls follow');
// Recalibrating the job's sheet moves every sheet that measures at the job scale, and no sheet with its own.
const jobMoved = { ...calibrations, [JOB_SCALE_KEY]: { pixelsPerMm: 0.08 }, 1: { pixelsPerMm: 0.08 } };
const moved = rescaleRunLengths(drawn.map((item) => item.wall), (page) => sheetPixelsPerMm(page, 0.1, calibrations), (page) => sheetPixelsPerMm(page, 0.08, jobMoved));
assert.deepEqual(moved.map((wall) => Math.round(wall.lengthMm)), [12500, 10000, 12500]);

// --- AI import: each detection is measured at its own sheet's scale ------------------------------
const context = { jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'pdf-hash', pixelsPerMm: 0.1, sheetCalibrations: calibrations,
  pages: [1, 2, 3].map((pageNumber) => ({ pageNumber, logicalWidth: 1200, logicalHeight: 1000 })), completedWallRuns: [] };
const detection = (page, pixelsPerMm) => ({ detectionId: `wall-${page}`, kind: 'wall', page, confidence: 0.9, coordinates: { space: 'logical' },
  nodes: [{ x: 50, y: 50 }, { x: 50 + 10000 * pixelsPerMm, y: 50 }], category: 'interior', thicknessMm: 90, alignment: 'outer' });
const batch = { jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'pdf-hash', runId: 'run-1', modelVersion: 'test', detections: [detection(1, 0.1), detection(2, 0.05), detection(3, 0.1)] };
const imported = convertAiTakeoffDetections(batch, context).completedWallRuns;
assert.deepEqual(imported.map((wall) => Math.round(wall.lengthMm)), [10000, 10000, 10000], 'a wall on each sheet is 10 m at that sheet\'s scale');
assert.deepEqual(convertAiTakeoffDetections(batch, { ...context, sheetCalibrations: {} }).completedWallRuns.map((wall) => Math.round(wall.lengthMm)), [10000, 5000, 10000], 'with one scale the half-scale sheet reads half: the error this prevents');
assert.throws(() => convertAiTakeoffDetections({ ...batch, detections: [{ ...detection(2, 0.05), pixelsPerMm: 0.1 }] }, context), /sheet's calibration/, 'a detection that claims another scale than its sheet is refused');

// --- Scale resolution: sheets at different scales are measured, each at its own -------------------
const pages = [{ pageNumber: 1, logicalWidth: 1200, logicalHeight: 1000 }, { pageNumber: 2, logicalWidth: 1200, logicalHeight: 1000 }];
const inspections = [1, 2].map((page) => ({ page, relevant: true, drawingType: 'floor_plan', level: page === 1 ? 'Ground Floor' : 'Second Level', scale: null, writtenDimensions: [] }));
const resolved = resolveAnalysisScale({ pages, inspections, existingPixelsPerMm: 0.1, sheetCalibrations: calibrations });
assert.ok(resolved.pixelsPerMm > 0, `differently scaled sheets that are each calibrated are measured: ${JSON.stringify(resolved.conflicts)}`);
assert.ok(resolved.review.some((message) => /different scales/i.test(typeof message === 'string' ? message : message.message)), 'and the estimator is told');

console.log('takeoff sheet calibration: per-sheet scale for walls, areas, rooms and AI import ok');
