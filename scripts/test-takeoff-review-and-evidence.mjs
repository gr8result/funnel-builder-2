// AI Takeoff: cross-sheet evidence, authoritative calibration, automatic resolution and the
// builder review. Run with the JSON loader:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-review-and-evidence.mjs
import assert from 'node:assert/strict';
import { normalizePlanAnalysis, resolveAnalysisScale } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { compactPlanEvidence, evidenceRotation, findScheduleEntry, levelFromAreaLabel, mergePlanEvidence, parseOpeningSizeCode, projectDefaultsFromJobSetup, resolveOpeningSubType } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/planEvidence.js';
import { applyReviewDecision, buildTakeoffReview, reviewAudience } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/reviewSummary.js';
import { createJobSetupPayload, createTakeoffSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { TAKEOFF_EVIDENCE_SCHEMA, buildTakeoffProviderRequest, validateTakeoffAnalysisRequest } from '../lib/construction-estimation/aiTakeoffAnalysis.js';

const observed = { basis: 'OBSERVED', confidence: 0.95, evidence: 'Printed on the drawing.' };

// ---- Job Setup defaults and plan-set evidence ----------------------------------------------------
const defaults = projectDefaultsFromJobSetup({
  lowerCeilingHeight: { value: '2.74' }, upperCeilingHeight: { value: '2550' }, upperWallSystem: { value: 'Timber/Steel Framed 180 Linea Board Cladding' },
  lowerWallThicknessMm: { value: '230' }, lowerInternalWallSystem: { value: 'Plasterboard to framed walls' }, eavesWidthM: { value: '.60' },
});
assert.equal(defaults.levels['Ground Floor'].ceilingHeightMm, 2740, 'a ceiling height entered in metres is read as millimetres');
assert.equal(defaults.levels['Second Level'].ceilingHeightMm, 2550);
assert.deepEqual([defaults.levels['Second Level'].externalSystem, defaults.levels['Second Level'].externalFinish], ['lightweight_cladding', 'James Hardie Linea Weatherboard - 180mm']);
assert.equal(defaults.levels['Ground Floor'].externalFrameMm, null, 'an overall wall thickness typed into the frame field is not a frame size');
assert.equal(defaults.levels['Ground Floor'].internalFramed, true);
assert.equal(defaults.eaveWidthMm, 600);

const level = (name, extra) => ({ page: 4, level: name, ceilingHeightMm: null, externalWallSystem: null, externalFinish: null, externalFrameMm: null, externalWallThicknessMm: null, internalFrameMm: null, ...observed, ...extra });
const row = (extra) => ({ page: 6, tag: null, sizeCode: null, type: 'window', style: null, widthMm: null, heightMm: null, glassType: null, ...observed, ...extra });
const fact = (extra) => ({ ...observed, ...extra });
const evidence = mergePlanEvidence([
  { levels: [level('Ground Floor', { externalWallSystem: 'brick_veneer', externalFinish: 'rendered_brick' }), level('Second Level', { ceilingHeightMm: 2550, externalWallSystem: 'lightweight_cladding' })],
    openingSchedule: [row({ tag: 'W3', widthMm: 1810, heightMm: 1030 }), row({ sizeCode: '2136 SGD', type: 'door', widthMm: 3600, heightMm: 2100 })],
    windowCodeConvention: fact({ order: 'height-width' }), standardDoorHeight: fact({ valueMm: 2040 }), eaveWidth: fact({ valueMm: null }), roofPitch: fact({ degrees: 22.5 }), notes: ['Sheet 4: Rendered Brick Veneer'], review: [] },
  { levels: [level('Second Level', { page: 5, ceilingHeightMm: 2700 }), level('Third Level', { externalWallSystem: 'double_brick', basis: 'ASSUMED' })], openingSchedule: [], notes: [], review: [] },
]);
assert.equal(evidence.levels['Ground Floor'].externalSystem, 'brick_veneer');
assert.equal(evidence.levels['Second Level'].ceilingHeightMm, null, 'a value two sheets disagree about is not established');
assert.ok(evidence.conflicts.some((message) => /Second Level ceiling height/.test(message)));
assert.equal(evidence.levels['Third Level'], undefined, 'assumed evidence is never a plan-set fact');
assert.equal(evidence.standardDoorHeightMm, 2040);
assert.equal(compactPlanEvidence(evidence, defaults).levels['Second Level'].jobSetupDefault.ceilingHeightMm, 2550);
assert.equal(findScheduleEntry({ tag: 'w3', type: 'window' }, evidence).widthMm, 1810, 'an opening is matched to its schedule row by tag');
assert.equal(findScheduleEntry({ sizeCode: '2136SGD', type: 'door' }, evidence).heightMm, 2100, 'or by its size code');
assert.equal(findScheduleEntry({ tag: 'W9', type: 'window' }, evidence), null);

assert.deepEqual(parseOpeningSizeCode('1806dh'), { heightMm: 1800, widthMm: 600, rawSizeCode: '1806dh', suffix: 'dh' });
assert.equal(parseOpeningSizeCode('2136 SGD').widthMm, 3600);
assert.equal(parseOpeningSizeCode('1218', 'width-height').widthMm, 1200, 'a plan set documented as width-first is read that way');
for (const code of ['W1218', '12180', '0012', '720', 'D3']) assert.equal(parseOpeningSizeCode(code), null);
assert.equal(resolveOpeningSubType({ type: 'window', openingClass: 'Window', sizeCode: '1806dh' }), 'DH');
assert.equal(resolveOpeningSubType({ type: 'window', openingClass: 'Window', subType: 'FG' }), 'FG');
assert.equal(resolveOpeningSubType({ type: 'door', openingClass: 'Internal Door', tag: 'CSD' }), 'Cavity', 'a cavity slider lands in the cavity-cage schedule');
assert.equal(resolveOpeningSubType({ type: 'door', openingClass: 'Internal Door' }), 'Internal');
assert.equal(resolveOpeningSubType({ type: 'door', openingClass: 'Garage Door' }), 'PanelLift');
assert.equal(resolveOpeningSubType({ type: 'door', openingClass: 'Large Glazed/Stacker/Sliding Door', sizeCode: '2136 STACKER DOOR' }), 'Stacker');
assert.equal(levelFromAreaLabel('GND FL LIVING AREA'), 'Ground Floor');
assert.equal(levelFromAreaLabel('1ST FLOOR LIVING AREA'), 'Second Level');
assert.equal(levelFromAreaLabel('BALCONY AREA'), null);
const sheets = [{ pageNumber: 1, logicalWidth: 595, logicalHeight: 842 }, { pageNumber: 2, logicalWidth: 595, logicalHeight: 842 }];
const read = [{ page: 1, drawingType: 'floor_plan', relevant: true, rotationToUpright: 270 }, { page: 2, drawingType: 'elevation', relevant: false, rotationToUpright: 90 }];
assert.equal(evidenceRotation(read[1], read, sheets), 270, 'an elevation read exactly upside-down takes the floor plans orientation');
assert.equal(evidenceRotation({ page: 2, rotationToUpright: 0 }, read, sheets), 0, 'a genuinely different orientation is kept');

// ---- The server accepts the evidence request and hands evidence to measurement ---------------------
const image = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).toString('base64')}`;
const base = { jobId: 'job', takeoffId: 'takeoff', documentHash: 'hash', runId: 'run', page: { pageNumber: 4, logicalWidth: 595, logicalHeight: 842, imageDataUrl: image } };
const evidenceRequest = validateTakeoffAnalysisRequest({ ...base, action: 'evidence', contextPages: [{ pageNumber: 5, logicalWidth: 595, logicalHeight: 842, imageDataUrl: image }] });
const provider = buildTakeoffProviderRequest(evidenceRequest, 'gpt-5.4');
assert.equal(provider.text.format.name, 'takeoff_evidence_v1');
assert.deepEqual(provider.text.format.schema.required, TAKEOFF_EVIDENCE_SCHEMA.required);
assert.equal(provider.input[0].content.filter((item) => item.type === 'input_image').length, 2, 'every supplied sheet is read together');
const measureRequest = validateTakeoffAnalysisRequest({ ...base, action: 'measure', measurementScope: 'geometry', pixelsPerMm: 0.02, planEvidence: compactPlanEvidence(evidence, defaults) });
assert.ok(buildTakeoffProviderRequest(measureRequest, 'gpt-5.4').input[0].content.some((item) => item.type === 'input_text' && /^PLAN-SET EVIDENCE/.test(item.text)), 'the geometry half is no longer measured from an isolated image');
assert.match(buildTakeoffProviderRequest(measureRequest, 'gpt-5.4').input[0].content[0].text, /On a floor-plan page return exactly one Footprint polygon/);
assert.throws(() => validateTakeoffAnalysisRequest({ ...base, action: 'inspect', planEvidence: {} }), /planEvidence/);

// ---- Calibration: the estimator's calibration is authoritative ------------------------------------
const pages = [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800 }, { pageNumber: 2, logicalWidth: 1000, logicalHeight: 800 }];
const inspected = (page) => ({ page, relevant: true, scale: { denominator: 100, ...observed }, writtenDimensions: [] });
let scale = resolveAnalysisScale({ pages, inspections: [inspected(1), inspected(2)], existingPixelsPerMm: 0.02 });
assert.equal(scale.pixelsPerMm, 0.02);
assert.deepEqual(scale.review, [], 'a calibrated sheet never reports that its printed scale cannot determine pixels/mm');
assert.equal(scale.notes.length, 2);
assert.equal(scale.requiresConfirmation, false);
scale = resolveAnalysisScale({ pages, inspections: [inspected(1), inspected(2)], existingPixelsPerMm: 0.02, sheetCalibrations: { 2: { pixelsPerMm: 0.02 } } });
assert.equal(scale.pixelsPerMm, 0.02, 'a sheet calibrated on its own agrees with the takeoff calibration');
scale = resolveAnalysisScale({ pages, inspections: [inspected(1), inspected(2)], existingPixelsPerMm: 0.02, sheetCalibrations: { 2: { pixelsPerMm: 0.04 } } });
assert.equal(scale.pixelsPerMm, null, 'two sheets calibrated to different scales are a genuine conflict, never averaged');
scale = resolveAnalysisScale({ pages: [pages[0]], inspections: [inspected(1)] });
assert.ok(scale.review.some((message) => /cannot determine image pixels\/mm/.test(message)), 'an uncalibrated raster still says why its printed scale is not enough');

// ---- Automatic resolution in the analysis contract ------------------------------------------------
const context = { jobId: 'job', takeoffId: 'takeoff', documentHash: 'hash', pixelsPerMm: 0.1, pages: [pages[0]], completedWallRuns: [], placedOpenings: [], completedFloorplans: [] };
const wall = (id, category, nodes, extra = {}) => ({ detectionId: id, category, nodes, thicknessMm: null, wallHeightM: null, exteriorType: 'Other', constructionSystem: 'unclassified', frameThicknessMm: null, exteriorFinish: null, ...observed, ...extra });
const opening = (id, extra) => ({ detectionId: id, type: 'window', openingClass: 'Window', x: 0.4, y: 0.1, hostDetectionId: null, tag: null, sizeCode: null, quantity: 1, ...observed, ...extra });
const response = {
  page: 1, level: 'Ground Floor',
  walls: [wall('ext', 'exterior', [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }]), wall('int', 'interior', [{ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }])],
  openings: [opening('w1', { sizeCode: '1806dh' }), opening('w3', { x: 0.6, tag: 'W3' }), opening('d1', { type: 'door', openingClass: 'Internal Door', x: 0.3, y: 0.5, explicitWidthMm: 820 }),
    opening('csd', { type: 'door', openingClass: 'Internal Door', x: 0.5, y: 0.5, tag: 'CSD', explicitWidthMm: 720 }), opening('far', { x: 0.9, y: 0.9, sizeCode: '0612' })],
  buildingAreas: [], pillars: [], eaves: [{ detectionId: 'eave', nodes: [{ x: 0.1, y: 0.05 }, { x: 0.8, y: 0.05 }], widthMm: null, ...observed }],
  rooms: [{ name: 'BED 2', x: 0.32, y: 0.46, ...observed }], fixtures: [], documentedQuantities: [], review: ['Wall thicknesses are not legible on this sheet.'],
};
const normalize = (targetContext = context, extra = {}) => normalizePlanAnalysis({ context: targetContext, responses: [response], runId: 'run', modelVersion: 'model', planEvidence: evidence, projectDefaults: defaults, ...extra });
let output = normalize();
let canonical = convertAiTakeoffDetections(output.batch, context);
const [exterior, interior] = canonical.completedWallRuns;
assert.equal(exterior.constructionSystem, 'brick_veneer', 'the external wall type shown on the elevations classifies the floor-plan wall');
assert.equal(exterior.exteriorType, 'Rendered Brick Veneer');
assert.equal(exterior.exteriorFinish, 'rendered_brick');
assert.equal(exterior.thicknessMm, 230);
assert.equal(exterior.frameAssumed, true, 'an undocumented frame size stays flagged for one confirmation, not guessed silently');
assert.equal(exterior.ai.analysisEvidence.fields.constructionSystem.basis, 'DERIVED');
assert.equal(interior.constructionSystem, 'internal_timber_frame', 'Job Setup says internal walls are framed');
assert.equal(interior.thicknessMm, 70);
assert.equal(interior.frameAssumed, true);
assert.equal(exterior.wallHeightM, null, 'a Job Setup ceiling height is applied downstream, not copied onto the wall');
assert.ok(!output.analysis.review.some((item) => item.code === 'missing-height'), 'a known ceiling height is not flagged on every wall');
assert.ok(!output.analysis.review.some((item) => item.code === 'unclassified'));
const byTag = (tag) => canonical.placedOpenings.find((item) => item.itemTag === tag);
assert.deepEqual([byTag('1806dh').widthMm, byTag('1806dh').heightMm, byTag('1806dh').subType], [600, 1800, 'DH'], 'a size code with a style suffix resolves its size and style');
assert.deepEqual([byTag('W3').widthMm, byTag('W3').heightMm], [1810, 1030], 'a tagged window takes its size from the schedule on another sheet');
const hinged = canonical.placedOpenings.find((item) => item.widthMm === 820);
assert.deepEqual([hinged.heightMm, hinged.subType, hinged.location], [2040, 'Internal', 'BED 2'], 'a door with only its width printed takes the plan-set door height and its room');
assert.equal(canonical.placedOpenings.find((item) => item.widthMm === 720).subType, 'Cavity');
const far = byTag('0612');
assert.equal(far, undefined, 'an opening with no nearby host is withheld');
assert.equal(canonical.placedOpenings.length, 4, 'only uniquely hosted openings enter accepted geometry');
assert.equal(canonical.completedEaves[0].widthMm, 600, 'the Job Setup eave width fills an undocumented eave');
assert.deepEqual(output.analysis.review.filter((item) => item.audience === 'decision').map((item) => item.code), ['evidence-conflict'], 'the conflicting ceiling height requires confirmation');

// What the estimator already traced is authoritative: nothing is added a second time.
const existing = {
  completedWallRuns: [{ id: 'manual-wall', page: 1, category: 'exterior', thicknessMm: 230, lengthMm: 7000, nodes: [{ x: 100, y: 82 }, { x: 800, y: 82 }], exteriorType: 'Rendered Brick Veneer' }],
  placedOpenings: [{ id: 'manual-window', page: 1, type: 'window', openingClass: 'Window', x: 405, y: 82, widthMm: 600, heightMm: 1800, hostWallId: 'manual-wall' },
    ...[1, 2, 3].map((index) => ({ id: `manual-door-${index}`, page: 2, type: 'door', openingClass: 'Internal Door', x: 900, y: 100 * index, widthMm: 820, heightMm: 2100 }))],
};
output = normalize({ ...context, ...existing }, { planEvidence: { ...evidence, standardDoorHeightMm: null } });
canonical = convertAiTakeoffDetections(output.batch, { ...context, ...existing });
assert.deepEqual(canonical.completedWallRuns.map((item) => item.category), ['interior'], 'an AI trace of a wall already drawn is not added');
assert.ok(!canonical.placedOpenings.some((item) => item.itemTag === '1806dh'), 'an AI detection of a window already placed is not added');
assert.equal(canonical.placedOpenings.find((item) => item.itemTag === 'W3').hostWallId, 'manual-wall', 'a new opening attaches to the wall the estimator drew');
assert.equal(canonical.placedOpenings.find((item) => item.widthMm === 820).heightMm, 2100, 'with no stated door height, the height of the doors already in the takeoff is used');
assert.equal(output.analysis.alreadyMeasured.length, 2);
// A sheet whose walls and openings the estimator has already measured is not added to: a position
// read off a drawing is too approximate to sit beside a hand trace. What the AI saw is queried instead.
const traced = { completedWallRuns: [...existing.completedWallRuns, { id: 'manual-partition', page: 1, category: 'interior', thicknessMm: 70, lengthMm: 5000, nodes: [{ x: 100, y: 300 }, { x: 600, y: 300 }] }],
  placedOpenings: [...existing.placedOpenings.slice(0, 1), { id: 'manual-window-2', page: 1, type: 'window', openingClass: 'Window', x: 700, y: 82, widthMm: 1200, heightMm: 900, hostWallId: 'manual-wall' }] };
output = normalize({ ...context, ...traced });
canonical = convertAiTakeoffDetections(output.batch, { ...context, ...traced });
assert.equal(canonical.completedWallRuns.length, 0, 'an unmatched AI wall is not added beside the estimator trace');
assert.deepEqual(canonical.placedOpenings.map((item) => item.type), [], 'doors whose only possible manual host is spatially distant are withheld');
assert.deepEqual(output.analysis.notAdded.map((item) => item.kind).sort(), ['opening', 'opening', 'wall']);
assert.equal(output.analysis.review.filter((item) => item.code === 'possible-missing-openings' && item.audience === 'decision').length, 2, 'each possible missed opening is put to the builder, by room');
assert.ok(!output.analysis.review.some((item) => item.code === 'possible-missing-walls'), 'a shorter AI measurement than the trace raises nothing');
assert.ok(output.analysis.review.filter((item) => item.code === 'already-measured').every((item) => item.audience === 'diagnostic'));

// With nothing to go on, uncertainty stays uncertain - as ONE question each, not one per wall.
output = normalizePlanAnalysis({ context, responses: [response], runId: 'run', modelVersion: 'model' });
canonical = convertAiTakeoffDetections(output.batch, context);
assert.deepEqual(canonical.completedWallRuns.map((item) => item.constructionSystem), ['unclassified', 'unclassified'], 'no evidence and no default never becomes a guess');
assert.equal(canonical.placedOpenings.find((item) => item.widthMm === 820).heightMm, null, 'a door height is never invented');

// ---- The builder review ---------------------------------------------------------------------------
const takeoff = { ...canonical, completedMeasurements: [], pixelsPerMm: 0.1, totalPages: 1, sheetLevels: { 1: 'Ground Floor' }, scheduleState: { aiAnalysis: output.analysis } };
let payload = createJobSetupPayload(createTakeoffSchedule(takeoff), { sheetLevels: takeoff.sheetLevels, reviewOnly: true });
const ids = payload.review.decisions.map((item) => item.id);
assert.deepEqual(ids, ['external-wall-type:Ground Floor', 'ceiling-height:Ground Floor', 'internal-wall-type', 'door-height', 'opening-size', 'eave-width'], 'each open question appears once, whatever the number of walls or openings behind it');
assert.ok(payload.review.decisions.every((item) => item.title && item.detail && item.action?.type), 'every review item says what to confirm and how');
assert.ok(payload.review.diagnostics.some((text) => /Wall thicknesses are not legible/.test(text)), 'the AI notes are kept, as diagnostics');
assert.ok(!payload.warnings.some((text) => /not legible|manual default|not documented/.test(text)), 'AI diagnostics are never Job Setup warnings');
assert.ok(payload.review.checklist.some((item) => /2 windows identified/.test(item.label)));
assert.ok(payload.review.checklist.some((item) => /2 internal doors identified \(1 cavity\/sliding\)/.test(item.label)));

// Answering a review item changes the objects it names; the item then clears on its own.
const answer = (id, value) => Object.assign(takeoff, applyReviewDecision(payload.review.decisions.find((item) => item.id === id), value, takeoff));
answer('external-wall-type:Ground Floor', 'brick_veneer:rendered_brick');
answer('ceiling-height:Ground Floor', 2700);
answer('internal-wall-type', '90');
answer('door-height', 2040);
answer('eave-width', 600);
assert.deepEqual([takeoff.completedWallRuns[0].exteriorType, takeoff.completedWallRuns[0].frameThicknessMm, takeoff.completedWallRuns[0].wallHeightM], ['Rendered Brick Veneer', 70, 2.7]);
assert.deepEqual([takeoff.completedWallRuns[1].thicknessMm, takeoff.completedWallRuns[1].constructionSystem], [90, 'internal_timber_frame'], 'a 90 mm internal wall stays a 90 mm wall');
payload = createJobSetupPayload(createTakeoffSchedule(takeoff), { sheetLevels: takeoff.sheetLevels, reviewOnly: true });
assert.deepEqual(payload.review.decisions.map((item) => item.id), ['opening-size'], 'only what genuinely cannot be established remains');
assert.equal(payload.dataInputFields.lowerInternal90mmWallsLm > 0, true, '90 mm internal framing reaches its own Job Setup quantity');
assert.deepEqual(applyReviewDecision({ action: { field: 'heightMm', targets: ['x'] } }, 99999, takeoff), {}, 'an implausible answer changes nothing');

// Analysis findings only a person can settle are decisions; everything else is a diagnostic.
for (const code of ['sheet-failed', 'duplicate-level', 'benchmark-discrepancy', 'dimension-conflict']) assert.equal(reviewAudience({ code }), 'decision');
for (const code of ['review', 'inspection', 'scale-review', 'assumption', 'missing-height', 'withheld', 'refinement-failed', 'already-measured']) assert.equal(reviewAudience({ code }), 'diagnostic');
const legacy = buildTakeoffReview({ records: [], analysis: { review: [{ page: 2, code: 'assumption', message: 'Wall thickness uses the 230 mm manual default; verify on the drawing.' }, { page: 3, code: 'duplicate-level', message: 'Another floor-plan sheet describes Ground Floor.' }] } });
assert.deepEqual([legacy.decisions.length, legacy.diagnostics.length], [1, 1], 'a run saved before this change is presented the same way');
assert.equal(buildTakeoffReview({ records: [], analysis: { review: [{ code: 'duplicate-level', message: 'x' }], resolvedDecisions: { 'analysis:duplicate-level': {} } } }).decisions.length, 0, 'a checked item stays checked');

// ---- Floor areas ----------------------------------------------------------------------------------
const square = (x1, y1, x2, y2) => [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
const area = (id, type, nodes) => ({ id, page: 1, type, label: type, nodes });
const floors = { completedFloorplans: [area('f', 'Footprint', square(100, 100, 800, 800)), area('g', 'Garage', square(100, 100, 300, 300))], pixelsPerMm: 0.1, totalPages: 1, sheetLevels: { 1: 'Ground Floor' } };
const schedule = createTakeoffSchedule(floors);
const rows = Object.fromEntries(schedule.projectTotals.floorAreas.map((item) => [item.itemId, item.quantity]));
assert.equal(rows.floor_Living, 45, 'Living area is the footprint less the named areas, never 0 because no polygon is typed Living');
assert.equal(rows.floor_total_under_roof, 49, 'gross footprint is reported separately and is not the living area');
assert.equal(createJobSetupPayload(schedule, {}).dataInputFields.lowerFloorAreaM2, 45);
const printed = { completedFloorplans: [area('g', 'Garage', square(100, 100, 300, 300))], pixelsPerMm: 0.1, totalPages: 1, sheetLevels: { 1: 'Ground Floor' },
  scheduleState: { aiAnalysis: { review: [], documentedAreas: [{ level: 'Ground Floor', type: 'Living', valueM2: 148.02, label: 'GND FL LIVING AREA', page: 2 }, { level: 'Ground Floor', type: 'Garage', valueM2: 40.23, label: 'GARAGE AREA', page: 2 }, { level: 'Second Level', type: 'Balcony', valueM2: 16.37, label: 'BALCONY AREA', page: 2 }] } } };
const printedFields = createJobSetupPayload(createTakeoffSchedule(printed), { reviewOnly: true }).dataInputFields;
assert.equal(printedFields.lowerFloorAreaM2, 148.02, 'with no outline traced, the living area printed in the plan area table is used');
assert.equal(printedFields.lowerGarageAreaM2, 4, 'measured geometry always wins over a printed figure');
assert.equal(printedFields.balconyAreaM2, 16.37);
const table = [['GND FL LIVING AREA', 45], ['GARAGE AREA', 4], ['TOTAL GROUND FLOOR', 49], ['TOTAL AREA', 49]].map(([label, value]) => ({ label, value, unit: 'sqm', ...observed, confidence: 0.99 }));
output = normalizePlanAnalysis({ context: { ...context, completedFloorplans: floors.completedFloorplans, sheetLevels: { 1: 'Ground Floor' } }, runId: 'run', modelVersion: 'model',
  responses: [{ ...response, walls: [], openings: [], eaves: [], rooms: [], documentedQuantities: [...table, ...table] }] });
assert.equal(output.analysis.benchmarks.length, 4, 'an area table printed on several sheets is compared once');
assert.ok(output.analysis.benchmarks.every((item) => Math.abs(item.difference) < 1e-9), 'printed sqm areas are checked against the takeoff geometry, the estimator own outlines included');
assert.ok(!output.analysis.review.some((item) => item.code === 'benchmark-discrepancy'));

console.log('AI Takeoff review and evidence: cross-sheet evidence, Job Setup defaults, authoritative calibration, automatic resolution, de-duplication, builder review and floor areas passed.');
