import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalizePlanAnalysis, parseWindowSizeCode, resolveAnalysisScale } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';

for (const [code, heightMm, widthMm] of [['1218', 1200, 1800], ['0612', 600, 1200], ['0918', 900, 1800], ['1224', 1200, 2400], ['1824', 1800, 2400]]) assert.deepEqual(parseWindowSizeCode(code), { heightMm, widthMm, rawSizeCode: code });
for (const code of ['W1218', '12180', '0012', '', null]) assert.equal(parseWindowSizeCode(code), null, 'non-code tags must not be reinterpreted as dimensions');

const observed = { basis: 'OBSERVED', confidence: 0.95, evidence: 'Clearly visible printed plan symbol/text.' };
const pages = [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800, pdfUnits: true }];
const inspection = { page: 1, relevant: true, scale: { denominator: 100, ...observed }, writtenDimensions: [] };
let scale = resolveAnalysisScale({ pages, inspections: [inspection] });
assert.equal(scale.pixelsPerMm, 72 / 25.4 / 100);
assert.equal(scale.requiresConfirmation, true);
scale = resolveAnalysisScale({ pages: [{ ...pages[0], pdfUnits: false }], inspections: [inspection] });
assert.equal(scale.pixelsPerMm, null, 'a paper ratio alone cannot calibrate an arbitrary raster');
assert.ok(scale.conflicts.length);
const dimension = { valueMm: 4000, p1: { x: 0.1, y: 0.1 }, p2: { x: 0.5, y: 0.1 }, ...observed };
scale = resolveAnalysisScale({ pages, inspections: [{ ...inspection, writtenDimensions: [dimension] }], existingPixelsPerMm: 0.025 });
assert.equal(scale.pixelsPerMm, 0.025);
assert.equal(scale.source, 'existing-calibration');
assert.equal(scale.wouldChangeExistingCalibration, false);
assert.equal(scale.requiresConfirmation, false, 'The estimator already calibrated this drawing. Conflicting vision references become review notes.');
assert.ok(scale.review.length, 'contradictory nominal scale is reported');
scale = resolveAnalysisScale({ pages: [{ ...pages[0], pdfUnits: false }], inspections: [{ ...inspection, writtenDimensions: [{ ...dimension, basis: 'DERIVED' }] }], existingPixelsPerMm: 0.025 });
assert.equal(scale.source, 'existing-calibration', 'confirmed calibration precedes dimensions derived indirectly');
scale = resolveAnalysisScale({ pages: [...pages, { ...pages[0], pageNumber: 2 }], inspections: [inspection, { ...inspection, page: 2, scale: { ...observed, denominator: 200 } }] });
assert.equal(scale.pixelsPerMm, null, 'mixed sheet scales are never collapsed into one global scale');
assert.ok(scale.conflicts.length);
scale = resolveAnalysisScale({ pages, inspections: [{ ...inspection, writtenDimensions: [dimension, { ...dimension, valueMm: 8000 }] }] });
assert.equal(scale.pixelsPerMm, null, 'conflicting written references require review');
const openingCodeReferences = [
  { ...dimension, valueMm: 2124, evidence: "Explicit label '2124 SGD' above sliding glass door; endpoints are the door jamb extents." },
  { ...dimension, valueMm: 2448, evidence: "Explicit label '2448 CENTRE OPENING STACKER'; endpoints are the left and right opening extents." },
  { ...dimension, valueMm: 1218, evidence: 'Window code 1218 interpreted as a 1218 mm reference between its jambs.' },
];
scale = resolveAnalysisScale({ pages, inspections: [{ ...inspection, writtenDimensions: openingCodeReferences }] });
assert.equal(scale.source, 'detected-scale', 'opening codes do not outrank a reliable drawing scale');
assert.equal(scale.pixelsPerMm, 72 / 25.4 / 100);
assert.equal(scale.discardedCandidates.length, 3);
assert.ok(scale.review.every((message) => /discarded.*calibration reference/.test(message)), 'discarded code evidence is explained generically');
scale = resolveAnalysisScale({ pages, inspections: [{ ...inspection, writtenDimensions: [{ ...dimension, valueMm: 2124, evidence: "Independent dimension line explicitly marked '2124 mm', between extension-line endpoints beside a door; this is separate from the door tag." }] }] });
assert.equal(scale.source, 'written-dimension', 'a genuine explicit 2124 mm dimension line remains eligible even beside a door');
assert.equal(scale.pixelsPerMm, 400 / 2124);
assert.equal(scale.discardedCandidates.length, 0);
scale = resolveAnalysisScale({ pages, inspections: [{ ...inspection, writtenDimensions: [{ ...dimension, valueMm: 2124, evidence: 'Four-digit label 2124, endpoints at the marked features.' }] }] });
assert.equal(scale.source, 'detected-scale', 'ambiguous bare four-digit labels require independent dimension-line evidence');

const context = { jobId: 'job-1', takeoffId: 'takeoff-1', documentHash: 'document-hash', pixelsPerMm: 0.1, pages, completedWallRuns: [] };
const wall = { detectionId: 'wall-1', category: 'exterior', nodes: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }], thicknessMm: null, exteriorType: 'Other', wallHeightM: null, ...observed };
const window = { detectionId: 'window-1', type: 'window', openingClass: 'Window', x: 0.4, y: 0.1, hostDetectionId: 'wall-1', sizeCode: '1218', tag: 'W1 1218', quantity: 1, ...observed };
const footprint = { detectionId: 'footprint', type: 'Footprint', nodes: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.8 }, { x: 0.1, y: 0.8 }], ...observed };
const garage = { detectionId: 'garage', type: 'Garage', nodes: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 0.1, y: 0.3 }], ...observed };
const response = { page: 1, level: 'Ground Floor', walls: [wall], openings: [window], buildingAreas: [footprint, garage, { ...footprint, detectionId: 'living', type: 'Living' }], rooms: [{ name: 'Bedroom 1', x: 0.6, y: 0.4, polygon: footprint.nodes, ...observed }], fixtures: [{ type: 'WC', quantity: 1, room: 'WC', ...observed }], documentedQuantities: [{ label: 'Exterior walls', value: 7, unit: 'lm', ...observed }, { label: 'Living', value: 36, unit: 'm2', ...observed }] };
const normalize = (responses = [response], targetContext = context) => normalizePlanAnalysis({ context: targetContext, responses, runId: 'run-1', modelVersion: 'real-model-v1' });
const original = structuredClone({ response, context });
let output = normalize();
assert.deepEqual({ response, context }, original, 'normalization does not mutate model response or canvas context');
let canonical = convertAiTakeoffDetections(output.batch, context);
assert.equal(canonical.completedWallRuns[0].lengthMm, 7000);
assert.equal(canonical.completedWallRuns[0].ai.analysisEvidence.fields.thicknessMm.basis, 'ASSUMED');
assert.equal(canonical.completedWallRuns[0].ai.analysisEvidence.fields.lengthMm.basis, 'DERIVED');
assert.equal(canonical.placedOpenings[0].widthMm, 1800);
assert.equal(canonical.placedOpenings[0].heightMm, 1200);
assert.equal(canonical.placedOpenings[0].ai.analysisEvidence.originalTag, 'W1 1218');
assert.equal(canonical.placedOpenings[0].ai.analysisEvidence.rawSizeCode, '1218');
assert.deepEqual(canonical.completedFloorplans.map((item) => item.type), ['Footprint', 'Garage'], 'Living outline does not double-count aggregate footprint decomposition');
assert.equal(output.analysis.rooms.length, 1);
assert.equal(output.analysis.fixtures.length, 1);
assert.equal(output.analysis.rooms[0].polygon, undefined, 'analysis metadata does not create competing room geometry');
assert.ok(output.analysis.unresolved.every((item) => item.nodes === undefined && item.polygon === undefined));
assert.equal(output.analysis.benchmarks[0].measured, 7);
assert.ok(Math.abs(output.analysis.benchmarks[1].measured - 36) < 1e-10);

output = normalize([{ ...response, openings: [{ ...window, explicitWidthMm: 1900, explicitHeightMm: 1250 }] }]);
canonical = convertAiTakeoffDetections(output.batch, context);
assert.equal(canonical.placedOpenings[0].widthMm, 1900);
assert.equal(canonical.placedOpenings[0].heightMm, 1250);
assert.equal(canonical.placedOpenings[0].ai.analysisEvidence.discrepancies.length, 2);
assert.equal(output.analysis.review.filter((item) => item.code === 'dimension-conflict').length, 2);
output = normalize([{ ...response, openings: [{ ...window, sizeCode: null, tag: 'W1', widthMm: 1200, heightMm: 1800 }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'opening').length, 1, 'Observed opening counts survive missing dimensions.');
assert.equal(output.batch.detections.find((item) => item.kind === 'opening').heightMm, null, 'Unproven dimensions are not invented from provider defaults.');
assert.ok(output.analysis.review.some((item) => item.code === 'missing-dimension'));
output = normalize([{ ...response, walls: [{ ...wall, basis: 'ASSUMED' }], fixtures: [{ ...response.fixtures[0], basis: 'ASSUMED' }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'wall').length, 0, 'an assumed wall is withheld');
assert.equal(output.batch.detections.filter((item) => item.kind === 'opening').length, 0, 'an opening whose host wall is withheld cannot enter accepted geometry');
assert.equal(convertAiTakeoffDetections(output.batch, context).placedOpenings.length, 0);
assert.equal(output.analysis.fixtures.length, 0);
output = normalize([{ ...response, buildingAreas: [footprint, garage, { ...garage, detectionId: 'porch', type: 'Porch' }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'floorplan').length, 2, 'overlapping ancillary areas cannot both contribute');
output = normalize([{ ...response, buildingAreas: [{ ...garage, detectionId: 'porch', type: 'Porch' }] }]);
assert.equal(convertAiTakeoffDetections(output.batch, context).completedFloorplans[0].type, 'Porch', 'already-supported downstream Porch maps canonically');
output = normalize([{ ...response, walls: [wall, { ...wall, detectionId: 'wall-copy', nodes: [...wall.nodes].reverse() }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'wall').length, 1, 'reversed duplicate wall geometry is not counted twice');

output = normalize([{ ...response, openings: [{ ...window, y: 0.1125 }] }]);
canonical = convertAiTakeoffDetections(output.batch, context);
assert.equal(canonical.placedOpenings[0].y, 80, 'nearby opening points are projected onto the logical host trace');
assert.equal(canonical.placedOpenings[0].ai.analysisEvidence.fields.location.basis, 'DERIVED');
assert.match(canonical.placedOpenings[0].ai.analysisEvidence.fields.location.evidence, /100.0 mm/);
output = normalize([{ ...response, openings: [{ ...window, y: 0.8 }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'opening').length, 0, 'a distant opening is withheld rather than counted in accepted geometry');
assert.ok(output.analysis.review.some((item) => /too far/.test(item.message)));

output = normalize([{ ...response, openings: [{ ...window, hostDetectionId: null }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'opening').length, 1, 'Independent item pass links an observed opening to its unique nearby measured wall.');
assert.equal(output.batch.detections.find((item) => item.kind === 'opening').analysisEvidence.fields.hostWall.basis, 'DERIVED');
output = normalize([{ ...response, walls: [wall, { ...wall, detectionId: 'nearby-wall', nodes: wall.nodes.map((node) => ({ ...node, y: node.y + .001 })) }], openings: [{ ...window, hostDetectionId: null }] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'opening').length, 0, 'An ambiguous wall association is withheld.');
assert.ok(output.analysis.review.some((item) => item.code === 'withheld' && /equally close/.test(item.message)));

const frontPatio = { ...garage, detectionId: 'front-patio', type: 'Patio', label: 'Patio' };
const sidePatio = { ...garage, detectionId: 'side-patio', type: 'Patio', label: 'Side Patio', nodes: [{ x: 0.4, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }, { x: 0.4, y: 0.3 }] };
const print = (label, value) => ({ label, value, unit: 'm2', ...observed });
output = normalize([{ ...response, buildingAreas: [footprint, frontPatio, sidePatio], documentedQuantities: [print('Total Area', 39.2), print('Patio', 3.2), print('Side Patio', 1.6), print('Total Patio Area', 4.8)] }]);
for (let index = 0; index < 4; index += 1) assert.ok(Math.abs(output.analysis.benchmarks[index].difference) < 1e-10, 'printed named and total areas compare to matching canonical geometry');
output = normalize([{ ...response, buildingAreas: [footprint, { ...frontPatio, label: 'Front Patio' }, sidePatio], documentedQuantities: [print('Patio', 3.2)] }]);
assert.equal(output.analysis.benchmarks[0].measured, null, 'ambiguous printed Patio is not compared to combined Front and Side Patio');
assert.equal(output.analysis.benchmarks[0].difference, null);
assert.match(output.analysis.benchmarks[0].comparisonNote, /several separately named/);
assert.ok(output.analysis.review.some((item) => item.code === 'benchmark-scope'));
output = normalize([{ ...response, buildingAreas: [frontPatio], documentedQuantities: [print('Side Patio Area', 1.6), print('Patio Area', 3.2)] }]);
assert.equal(output.analysis.benchmarks[0].measured, null, 'a named Side Patio never falls back to the only generic Patio polygon');
assert.match(output.analysis.benchmarks[0].comparisonNote, /No traced polygon matches/);
assert.ok(Math.abs(output.analysis.benchmarks[1].difference) < 1e-10, 'generic Area suffix does not break the correct Patio match');
output = normalize([{ ...response, buildingAreas: [sidePatio], documentedQuantities: [print('Side Patio Area', 1.6)] }]);
assert.ok(Math.abs(output.analysis.benchmarks[0].difference) < 1e-10, 'the named polygon matches its printed quantity with an Area suffix');
output = normalize([{ ...response, buildingAreas: [footprint], documentedQuantities: [print('Total Area', 20)] }]);
assert.ok(output.analysis.review.some((item) => item.code === 'benchmark-discrepancy' && /Review measurement scope and calibration/.test(item.message)));
assert.equal(output.analysis.benchmarks[0].measuredBasis, 'DERIVED');
assert.equal(output.analysis.counts.review, output.analysis.review.length, 'benchmark warnings enter the final review count');
assert.deepEqual(output.batch.detections.find((item) => item.type === 'Footprint').nodes, footprint.nodes, 'benchmark differences never alter traced geometry');
output = normalize([{ ...response, buildingAreas: [footprint], documentedQuantities: [print('Total Area', 39.1)] }]);
assert.ok(!output.analysis.review.some((item) => item.code === 'benchmark-discrepancy'), 'small area rounding differences do not produce material discrepancy warnings');
const overlappingPatio = { ...sidePatio, nodes: [{ x: 0.2, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.3 }, { x: 0.2, y: 0.3 }] };
output = normalize([{ ...response, buildingAreas: [footprint, frontPatio, overlappingPatio], documentedQuantities: [] }]);
assert.equal(output.batch.detections.filter((item) => item.kind === 'floorplan').length, 2, 'overlap along collinear polygon boundaries is also withheld');
const toLogical = (item) => ({ ...item, id: `manual-${item.detectionId}`, page: 1, nodes: item.nodes.map((point) => ({ x: point.x * pages[0].logicalWidth, y: point.y * pages[0].logicalHeight })) });
const manualFloorplans = [toLogical(footprint), toLogical(garage)];
const preservedManual = structuredClone(manualFloorplans);
output = normalize([response], { ...context, completedFloorplans: manualFloorplans });
assert.equal(output.batch.detections.filter((item) => item.kind === 'floorplan').length, 0, 'manual footprint and ancillary geometry are protected even without assigned level metadata');
assert.deepEqual(manualFloorplans, preservedManual, 'normalizer never modifies existing manual floor geometry');
output = normalize([{ ...response, buildingAreas: [sidePatio] }], { ...context, completedFloorplans: [toLogical(frontPatio)] });
assert.equal(output.batch.detections.filter((item) => item.kind === 'floorplan').length, 1, 'non-overlapping manual and AI ancillary areas may coexist');

// Optional real-provider artifact replay exercises the actual rotation and full
// ingestion contract. No drawing-specific quantities are embedded in the test.
const artifact = new URL('../artifacts/test-artifacts/takeoff-ai-real/api-responses.json', import.meta.url);
if (existsSync(artifact)) {
  const requests = JSON.parse(readFileSync(artifact, 'utf8'));
  const latestSuccessful = (action) => [...new Map(requests.filter((item) => item.action === action && item.response?.ok && item.response?.analysis).map((item) => [item.page, item])).values()];
  const measured = latestSuccessful('measure');
  const inspected = latestSuccessful('inspect');
  if (measured.length && inspected.length) {
    const artifactPages = [...new Map(measured.map((item) => [item.page, { pageNumber: item.page, logicalWidth: item.logicalWidth, logicalHeight: item.logicalHeight, pdfUnits: true }])).values()];
    const artifactScale = resolveAnalysisScale({ pages: artifactPages, inspections: inspected.map((item) => item.response.analysis) });
    assert.ok(artifactScale.pixelsPerMm > 0, 'actual inspection resolves a usable, confirmed-candidate scale');
    const artifactContext = { ...context, pages: artifactPages, pixelsPerMm: artifactScale.pixelsPerMm };
    const responses = measured.map((item) => restoreAnalysisCoordinates(item.response.analysis, item.imageRotation || 0));
    const sourceSnapshot = structuredClone(responses);
    const replayed = normalizePlanAnalysis({ context: artifactContext, responses, runId: 'artifact-replay', modelVersion: measured[0].response.model });
    assert.ok(replayed.batch.detections.length > 0, 'the real provider response produces validated editable detections');
    assert.doesNotThrow(() => convertAiTakeoffDetections(replayed.batch, artifactContext));
    assert.deepEqual(responses, sourceSnapshot, 'real source detections are never adjusted to fit printed benchmarks');
    assert.equal(replayed.analysis.counts.review, replayed.analysis.review.length);
    console.log(`Optional real-provider replay passed: ${replayed.batch.detections.length} admitted detections; ${replayed.analysis.benchmarks.length} documented benchmarks.`);
  }
}

console.log('AI analysis contract checks passed: evidence, scale precedence/conflicts, height-first shorthand, explicit dimensions, safe floor areas and metadata.');
