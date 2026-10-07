import assert from 'node:assert/strict';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

const context = {
  jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'pdf-hash', pixelsPerMm: 0.1,
  pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800 }, { pageNumber: 2, logicalWidth: 1200, logicalHeight: 900 }],
  completedWallRuns: [{ id: 123, page: 1, category: 'exterior' }],
};
const wall = {
  detectionId: 'wall-1', kind: 'wall', page: 1, confidence: 0.95,
  coordinates: { space: 'logical' }, nodes: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
  category: 'exterior', thicknessMm: 230, alignment: 'outer', exteriorType: 'Face Brick Veneer',
};
const opening = {
  detectionId: 'window-1', kind: 'opening', page: 1, confidence: 0.9,
  coordinates: { space: 'logical' }, x: 200, y: 100,
  type: 'window', openingClass: 'Window', widthMm: 1200, heightMm: 1800, hostDetectionId: 'wall-1',
};
const floorplan = {
  detectionId: 'living-1', kind: 'floorplan', page: 1, confidence: 0.8,
  coordinates: { space: 'logical' }, type: 'Living',
  nodes: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 300 }, { x: 100, y: 300 }],
};
const area = { ...floorplan, detectionId: 'tiles-1', kind: 'area', category: 'Tiles', exclusions: [{ nodes: [{ x: 200, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 200 }, { x: 200, y: 200 }] }] };
const batch = { jobId: context.jobId, takeoffId: context.takeoffId, documentHash: context.documentHash, runId: 'run-1', modelVersion: 'mock-v1', detections: [wall, opening, floorplan, area] };
const clone = (value) => structuredClone(value);
const convert = (detections) => convertAiTakeoffDetections({ ...batch, detections }, context);
const rejects = (detection, pattern) => assert.throws(() => convert([detection]), pattern);
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const before = clone({ batch, context });
freeze(batch);
freeze(context);
const converted = convertAiTakeoffDetections(batch, context);
assert.deepEqual({ batch, context }, before, 'conversion leaves source batch and context unchanged');
assert.deepEqual(Object.keys(converted).sort(), ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedMeasurements', 'completedEaves', 'completedPillars'].sort());
assert.equal(converted.completedWallRuns[0].lengthMm, 4000);
assert.equal(converted.completedWallRuns[0].linedFaces, 2);
assert.equal(converted.completedWallRuns[0].openingDeductionsEnabled, true);
assert.equal(converted.completedWallRuns[0].wallHeightM, null);
assert.equal(converted.placedOpenings[0].hostWallId, converted.completedWallRuns[0].id);
assert.equal(converted.placedOpenings[0].source, 'ai');
assert.deepEqual(converted.placedOpenings[0].ai, { runId: 'run-1', detectionId: 'window-1', documentHash: 'pdf-hash', sourcePage: 1, modelVersion: 'mock-v1' });
assert.equal(converted.completedFloorplans[0].label, 'Living Area');
assert.equal(converted.completedAreas[0].exclusions.length, 1);
assert.deepEqual(convertAiTakeoffDetections(batch, context), converted, 'repeated conversion produces stable IDs and values');
assert.deepEqual(convert([opening, wall]).placedOpenings, converted.placedOpenings, 'batch host resolution is independent of detection order');

const scaled = convert([{ ...wall, coordinates: { space: 'image', width: 2000, height: 1600 }, nodes: [{ x: 200, y: 200 }, { x: 1000, y: 200 }] }]).completedWallRuns[0];
assert.deepEqual(scaled.nodes, converted.completedWallRuns[0].nodes);
assert.equal(scaled.lengthMm, 4000);
const normalized = convert([{ ...wall, coordinates: { space: 'normalized' }, nodes: [{ x: 0.1, y: 0.125 }, { x: 0.5, y: 0.125 }] }]).completedWallRuns[0];
assert.deepEqual(normalized.nodes, converted.completedWallRuns[0].nodes);
assert.equal(convert([{ ...wall, lengthMm: 999999, nodes: [{ x: 100, y: 100 }, { x: 100, y: 400 }, { x: 500, y: 400 }] }]).completedWallRuns[0].lengthMm, 7000, 'cached model length is ignored');
assert.equal(convert([{ ...wall, thicknessMm: 140 }]).completedWallRuns[0].thicknessMm, 140, 'active canvas thickness list is preserved');
const hostedExisting = { ...opening, hostDetectionId: undefined, hostWallId: 123 };
assert.equal(convert([hostedExisting]).placedOpenings[0].hostWallId, 123, 'existing numeric manual wall ID retains its type');
assert.notEqual(convert([{ ...wall, detectionId: 'a:b' }]).completedWallRuns[0].id, convertAiTakeoffDetections({ ...batch, runId: 'run-1:a', detections: [{ ...wall, detectionId: 'b' }] }, context).completedWallRuns[0].id, 'encoded ID components cannot collide through delimiters');
assert.equal(convert([{ ...wall, source: 'manual', ai: { runId: 'fake' }, arbitrary: 'ignored', lengthMm: 1 }]).completedWallRuns[0].arbitrary, undefined);

const schedule = createTakeoffSchedule({ ...converted, totalPages: 2, pixelsPerMm: context.pixelsPerMm, sheetLevels: { 1: 'Ground Floor' }, jobSetupRows: { lowerCeilingHeight: { value: '2400' } } });
const payload = createJobSetupPayload(schedule);
assert.equal(payload.dataInputFields.lowerBrickVeneer70mmWallsLm, 4, 'existing schedule/import consumes adapted walls');
assert.equal(payload.dataInputFields.lowerFloorAreaM2, 8, 'existing area calculation consumes adapted polygons');
assert.equal(payload.dataInputFields.windowOpeningsQty, 1);
assert.equal(payload.dataInputFields.lowerExternalOpeningAreaM2, 2.16, 'hosted adapted opening deducts canonical wall area');
assert.equal(payload.dataInputFields.floorFinishTilesM2, 7.75, 'existing exclusion calculation consumes adapted areas');

for (const key of ['jobId', 'takeoffId', 'documentHash']) assert.throws(() => convertAiTakeoffDetections({ ...batch, [key]: 'wrong' }, context), /does not match/);
for (const value of [0, -1, NaN, Infinity, '0.1']) assert.throws(() => convertAiTakeoffDetections(batch, { ...context, pixelsPerMm: value }), /positive finite/);
assert.throws(() => convertAiTakeoffDetections({ ...batch, pixelsPerMm: 0.2 }, context), /mixed scales/);
assert.throws(() => convertAiTakeoffDetections(batch, { ...context, pages: [{ ...context.pages[0], pixelsPerMm: 0.2 }] }), /mixed scales/);
for (const page of ['1', 0, -1, 1.5, 3, NaN]) rejects({ ...wall, page }, /loaded numeric page/);
for (const x of [NaN, Infinity, '100', -1, 1001]) rejects({ ...wall, nodes: [{ x, y: 100 }, { x: 500, y: 100 }] }, /finite numbers|outside page bounds/);
for (const confidence of [-0.1, 1.1, '0.5', NaN]) rejects({ ...wall, confidence }, /confidence/);
rejects({ ...wall, coordinates: { space: 'image', height: 800 } }, /image width/);
rejects({ ...wall, coordinates: { space: 'normalized' }, nodes: wall.nodes }, /outside page bounds/);
rejects({ ...wall, coordinates: { space: 'percent' } }, /coordinates.space/);
rejects({ ...wall, coordinates: { space: 'logical', rotation: 90 } }, /full unrotated page/);
rejects({ ...wall, coordinates: { space: 'image', width: 1000, height: 800, crop: [0, 0, 100, 100] } }, /full unrotated page/);
rejects({ ...wall, category: 'externalWall' }, /category/);
rejects({ ...wall, thicknessMm: 0 }, /thicknessMm/);
rejects({ ...wall, alignment: 'centre' }, /alignment/);
rejects({ ...wall, nodes: [{ x: 100, y: 100 }, { x: 100, y: 100 }] }, /zero-length segment/);
rejects({ ...wall, openingDeductionsEnabled: 'true' }, /boolean/);
rejects({ ...wall, kind: 'room' }, /kind/);
rejects({ ...floorplan, type: 'Room' }, /floorplan type/);
rejects({ ...floorplan, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }, /non-zero finite area/);
rejects({ ...floorplan, nodes: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }] }, /self-intersect/);
rejects({ ...area, exclusions: [{ nodes: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }] }] }, /exclusion must lie inside/);
rejects({ ...area, exclusions: [...area.exclusions, ...area.exclusions] }, /exclusions must not overlap/);
rejects({ ...area, category: 'Roof Area' }, /roof exclusions/);
assert.throws(() => convert([wall, wall]), /Duplicate detectionId/);
assert.throws(() => convert([wall, { ...opening, hostDetectionId: 'missing' }]), /must identify a wall/);
assert.throws(() => convert([wall, { ...opening, page: 2 }]), /same page/);
assert.throws(() => convert([wall, { ...opening, hostWallId: 123 }]), /exactly one/);
rejects({ ...hostedExisting, hostWallId: 999 }, /existing wall/);
assert.throws(() => convert([wall, { ...opening, widthMm: -1 }]), /widthMm/);
assert.throws(() => convert([wall, { ...opening, nodes: [{ x: 200, y: 100 }] }]), /unambiguous point/);
assert.throws(() => convert([wall, { ...opening, nodes: 'invalid' }]), /unambiguous point/);
assert.throws(() => convert([wall, { ...opening, type: 'door' }]), /conflict/);
const validThenInvalid = [wall, { ...floorplan, type: 'Room' }];
const untouched = clone(validThenInvalid);
assert.throws(() => convert(validThenInvalid), /floorplan type/);
assert.deepEqual(validThenInvalid, untouched, 'failed batch validation never mutates an earlier valid detection');
assert.deepEqual(convert([]), { completedWallRuns: [], placedOpenings: [], completedFloorplans: [], completedAreas: [], completedMeasurements: [], completedEaves: [], completedPillars: [] });
console.log('takeoff AI adapter: canonical conversion, quantities, identity, geometry, scales, hosts and rejection checks passed');
