import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLocalVectorAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorAnalysis.js';
import { vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';

import { resolveConstructionSystem } from '../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';
assert.equal(resolveConstructionSystem({ category: 'exterior', constructionSystem: 'unclassified', exteriorType: 'Face Brick Veneer' }).system, 'brick_veneer', 'legacy exterior classification must not throw on const reassignment');

const spec = { id: 'ground', name: 'Ground Floor', page: 1, pixelsPerMm: .1, logicalWidth: 1000, logicalHeight: 1000 };
const geometry = { walls: [
  { id: 'left', nodes: [{ x: 100, y: 100 }, { x: 100, y: 500 }], measuredThicknessMm: 90 },
  { id: 'top', nodes: [{ x: 100, y: 100 }, { x: 500, y: 100 }], measuredThicknessMm: 90 },
  { id: 'right', nodes: [{ x: 500, y: 100 }, { x: 500, y: 500 }], measuredThicknessMm: 90 },
], openings: [{ id: 'door', x: 100, y: 300, widthMm: 820, hostWallIds: ['left'], axis: 'v', kind: 'door', inWall: true, confirmed: true }] };
const initial = vectorAnalysisFromLinework(geometry, spec);
assert.equal(initial.response.walls.length, 0);
assert.equal(initial.reviewWallCandidates.length, 3);
assert.equal(initial.reviewOpeningCandidates.length, 1);
const decisions = { 'linework:left': 'interior', 'linework:right': 'reject' };
const accepted = vectorAnalysisFromLinework(geometry, spec, { wallDecisions: decisions });
assert.equal(accepted.response.walls.length, 1);
assert.equal(accepted.response.openings.length, 1, 'host classification recovers only its own opening');
assert.equal(accepted.reviewWallCandidates.length, 1);
assert.ok(!Object.values(accepted.level.walls).some(wall => wall.detectionKey === 'linework:right'));
assert.equal(accepted.rooms.length, 0, 'classification must not invent a room or close the U');
assert.deepEqual(vectorAnalysisFromLinework(geometry, spec, { wallDecisions: JSON.parse(JSON.stringify(decisions)) }), accepted, 'decisions survive saved JSON and rerun');
assert.deepEqual(vectorAnalysisFromLinework(geometry, spec), initial, 'review must not mutate input geometry');

// Actual captured Liberty linework exercises admission after 50 walls and 17
// openings already exist. This is a scripted manual decision, NOT AI accuracy.
const { createCanvas, loadImage } = await import('@napi-rs/canvas');
const { detectVectorWalls } = await import('../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js');
const fixture = new URL('../artifacts/test-results/vector-regression-2026-10-18/frozen/', import.meta.url);
const input = JSON.parse(fs.readFileSync(new URL('application-input.json', fixture)));
const image = await loadImage(fs.readFileSync(new URL('application-raster.png', fixture)));
const canvas = createCanvas(image.width, image.height);
canvas.getContext('2d').drawImage(image, 0, 0);
const raster = canvas.getContext('2d').getImageData(0, 0, image.width, image.height);
raster.storedPixelsPerMm = input.storedPixelsPerMm;
const replay = { detected: detectVectorWalls(input.vectorSegments, { ...input, raster }), context: {
  jobId: 'review-test', takeoffId: 'review-test', documentHash: 'fixture', pixelsPerMm: input.pixelsPerMm,
  pages: [{ pageNumber: input.pageNumber, logicalWidth: input.logicalWidth, logicalHeight: input.logicalHeight }],
  completedWallRuns: [], placedOpenings: [], sheetLevels: { [input.pageNumber]: 'Ground Floor' },
} };
const initialLocal = buildLocalVectorAnalysis({ planPage: input, detected: replay.detected, pixelsPerMm: input.pixelsPerMm, level: 'Ground Floor', context: replay.context, runId: 'first' });
const existing = convertAiTakeoffDetections(initialLocal.batch, replay.context);
const context = { ...replay.context, completedWallRuns: existing.completedWallRuns, placedOpenings: existing.placedOpenings };
const candidate = initialLocal.vector.reviewWallCandidates[0];
assert.ok(candidate, 'unresolved exterior fragments remain available for manual review');
const localDecisions = { [candidate.detectionKey]: 'interior' };
const resolved = buildLocalVectorAnalysis({ planPage: input, detected: replay.detected, pixelsPerMm: input.pixelsPerMm, level: 'Ground Floor', context, runId: 'review', wallDecisions: localDecisions, admitReviewedWallKeys: [candidate.detectionKey] });
const additions = convertAiTakeoffDetections(resolved.batch, context);
assert.equal(additions.completedWallRuns.length, 1, 'manual acceptance adds exactly its selected wall despite existing walls');
assert.equal(additions.placedOpenings.length, 0, 'classifying a wall without an opening must not invent a door');
const rerunContext = { ...context, completedWallRuns: [...context.completedWallRuns, ...additions.completedWallRuns], placedOpenings: [...context.placedOpenings, ...additions.placedOpenings] };
const rerun = buildLocalVectorAnalysis({ planPage: input, detected: replay.detected, pixelsPerMm: input.pixelsPerMm, level: 'Ground Floor', context: rerunContext, runId: 'rerun', wallDecisions: JSON.parse(JSON.stringify(localDecisions)) });
assert.equal(rerun.batch.detections.length, 0, 'rerun does not duplicate manual acceptance or openings');
const removedContext = { ...context, placedOpenings: context.placedOpenings };
const afterManualDeletion = buildLocalVectorAnalysis({ planPage: input, detected: replay.detected, pixelsPerMm: input.pixelsPerMm, level: 'Ground Floor', context: removedContext, runId: 'after-deletion', wallDecisions: localDecisions });
assert.equal(afterManualDeletion.batch.detections.length, 0, 'later reruns must not resurrect a manually removed reviewed wall');
console.log('Wall review: classify/reject, hosted recovery, saved decisions and Liberty admission/rerun passed.');
