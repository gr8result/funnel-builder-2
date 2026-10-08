import assert from 'node:assert/strict';
import { normalizePlanAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';
import { createTakeoffSchedule, createJobSetupPayload, flattenScheduleRows } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { applyJobSetupImport } from '../lib/construction-estimation/jobSetupTakeoffImport.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';

// Synthetic geometry is test input only. Production acceptance uses the actual
// Johnson plan and recorded live provider responses separately.
const evidence = { basis: 'OBSERVED', confidence: .95, evidence: 'Visible on test drawing.' };
const rectangle = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }];
const context = { jobId: 'flow-job', takeoffId: 'flow-takeoff', documentHash: 'flow-document', pixelsPerMm: .1, pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 1000 }] };
const response = {
  page: 1, level: 'Ground Floor',
  walls: [{ ...evidence, detectionId: 'wall', category: 'interior', nodes: [{ x: .1, y: .1 }, { x: .9, y: .1 }], thicknessMm: 90, constructionSystem: 'internal_timber_frame', frameThicknessMm: 90, wallHeightM: 2.7 }],
  openings: Array.from({ length: 20 }, (_, i) => ({ ...evidence, detectionId: `door-${i}`, x: .12 + i * .035, y: .1, type: 'door', openingClass: 'Internal Door', subType: i < 4 ? 'Cavity' : 'Internal', hostDetectionId: 'wall', quantity: 1, widthMm: 820, heightMm: null, dimensionBasis: 'OBSERVED' })),
  buildingAreas: [{ ...evidence, detectionId: 'floor', type: 'Living', nodes: rectangle }, { ...evidence, detectionId: 'roof', type: 'Roof Area', nodes: rectangle }],
  pillars: [{ ...evidence, detectionId: 'post', nodes: [{ x: .2, y: .2 }, { x: .21, y: .2 }, { x: .21, y: .21 }, { x: .2, y: .21 }], coreType: 'steel', coreWidthMm: 100, coreDepthMm: 100, steelSectionType: 'SHS', surroundType: 'none', heightMm: 2700, quantity: 1 }],
  eaves: [{ ...evidence, detectionId: 'eave', nodes: [{ x: .1, y: .1 }, { x: .9, y: .1 }], widthMm: 600 }],
  rooms: [{ ...evidence, name: 'Kitchen', x: .3, y: .4 }],
  fixtures: [{ ...evidence, type: 'WC', room: 'Bathroom', quantity: 2 }],
  documentedQuantities: [{ ...evidence, label: 'roofPitchDegrees', value: 22.5, unit: 'degrees' }, { ...evidence, label: 'Living area', value: 65, unit: 'm2' }],
};
const { batch, analysis } = normalizePlanAnalysis({ context, responses: [response], runId: 'flow-run', modelVersion: 'test-only' });
const canonical = convertAiTakeoffDetections(batch, context);
assert.equal(canonical.placedOpenings.length, 20, 'Unknown door height cannot remove observed door counts.');
assert.ok(canonical.placedOpenings.every((item) => item.heightMm === null));
assert.equal(canonical.completedPillars.length, 1, 'Posts accepted by the schema also pass canonical admission.');
assert.equal(canonical.completedAreas[0].category, 'Roof Area');
assert.equal(canonical.completedEaves[0].lengthMm, 8000);
const schedule = createTakeoffSchedule({ ...canonical, pixelsPerMm: .1, scheduleState: { aiAnalysis: analysis } });
assert.equal(schedule.projectTotals.rooms[0].category, 'Kitchen');
assert.equal(schedule.projectTotals.customTakeoffs.find((row) => row.category === 'WC — Bathroom').quantity, 2);
assert.ok(flattenScheduleRows(schedule).some((row) => row.category === 'Living area' && row.quantity === 65), 'Printed benchmark remains visible alongside geometry.');
assert.throws(() => createJobSetupPayload(schedule), /geometry has not passed/, 'Incomplete AI analysis cannot enter the estimate.');
const payload = createJobSetupPayload(schedule, { jobId: context.jobId, takeoffId: context.takeoffId, reviewOnly: true });
assert.equal(payload.dataInputFields.internalDoorOpeningsQty, 20);
assert.equal(payload.dataInputFields.lowerFloorAreaM2, 64, 'Printed benchmark never overwrites measured geometry.');
assert.equal(payload.dataInputFields.roofPitchDegrees, 22.5);
assert.equal(payload.dataInputFields.lowerRoofPlanAreaM2, 64);
assert.equal(payload.dataInputFields.lowerEavesLm, 8);
assert.equal(payload.dataInputFields.architraveLengthsQty, undefined, 'No invented architraves for unknown heights.');
assert.ok(payload.unsupported.some((item) => /No matching Job Setup/.test(item.reason)), 'Fixtures without input fields stay visible, not silently dropped.');
let workbook = createEstimateBuilderWorkbookDefaults();
workbook.jobId = context.jobId;
workbook.aiPlanTakeoffJob = { ...canonical, pixelsPerMm: .1, scheduleState: { aiAnalysis: analysis } };
assert.throws(() => applyJobSetupImport(workbook, payload, Object.keys(payload.dataInputFields)), /geometry has not passed/);
// Exercise existing quantity calculations separately with a deliberately manual test takeoff.
const manualPayload = { ...payload, schedule: { ...payload.schedule, aiAnalysis: null } };
workbook = applyJobSetupImport(workbook, manualPayload, Object.keys(payload.dataInputFields));
const reopened = JSON.parse(JSON.stringify(workbook));
assert.equal(reopened.data.inputDataSheet.rows.internalDoorOpeningsQty.value, '20');
assert.equal(createTakeoffSchedule(reopened.aiPlanTakeoffJob).projectTotals.rooms[0].category, 'Kitchen');
const calculated = calculateEstimateBuilderWorkbook(reopened);
assert.equal(calculated.quantities.internalDoors, 20);
assert.equal(calculated.quantities.cavityDoorQty, 4);
const labour = Object.values(calculated.quotation).flatMap((section) => section.rows || []).find((row) => row.id === 'quote-152');
assert.equal(labour.qty, 16);
assert.match(labour.derivedQuantityExplanation, /20.*4.*16/);
const conflicting = createTakeoffSchedule({ ...canonical, pixelsPerMm: .1, aiAnalysis: { ...analysis, documentedQuantities: [...analysis.documentedQuantities, { ...evidence, page: 1, label: 'roofPitchDegrees', value: 30, unit: 'degrees' }] } });
assert.equal(createJobSetupPayload(conflicting, { reviewOnly: true }).dataInputFields.roofPitchDegrees, undefined);
const rotated = restoreAnalysisCoordinates({ pillars: [{ nodes: rectangle }], eaves: [{ nodes: rectangle }] }, 90);
assert.deepEqual(rotated.pillars[0].nodes[0], { x: .1, y: .9 });
assert.deepEqual(rotated.eaves[0].nodes[0], { x: .1, y: .9 });
console.log('PASS: AI review/import guards and explicit manual schedule → Job Setup → quotation → reopen; rooms, fixtures, roofs, eaves, posts, unknown dimensions, conflicts and 20 - 4 = 16.');
