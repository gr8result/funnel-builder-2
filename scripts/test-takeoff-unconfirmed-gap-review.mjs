// A gap in a wall line with nothing drawn in it (no swing, frame, glass or symbol) is kept for builder
// review: the wall line continues across it so the rooms on either side close, but neither the gap nor
// the span across it counts in quantities until the builder confirms it.
import assert from 'node:assert/strict';
import { vectorAnalysisFromLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/planModelAdapter.js';
import { normalizePlanAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';

const spec = { id: 'ground', name: 'Ground Floor', page: 1, pixelsPerMm: 1, logicalWidth: 8000, logicalHeight: 7000 };
const wall = (id, ax, ay, bx, by, category) => ({ id, nodes: [{ x: ax, y: ay }, { x: bx, y: by }], measuredThicknessMm: 90, category });
// 6000 x 5000 box split by a partition at x = 4000 with an unmarked 900 mm gap (y 3000-3900).
const geometry = (gapConfirmed) => ({
  walls: [
    wall('north', 1000, 1000, 7000, 1000, 'exterior'), wall('east', 7000, 1000, 7000, 6000, 'exterior'),
    wall('south', 7000, 6000, 1000, 6000, 'exterior'), wall('west', 1000, 6000, 1000, 1000, 'exterior'),
    wall('part-a', 4000, 1000, 4000, 3000, 'interior'), wall('part-b', 4000, 3900, 4000, 6000, 'interior'),
  ],
  openings: [{ id: 'gap-1', x: 4000, y: 3450, axis: 'v', direction: { x: 0, y: 1 }, widthMm: 900, hostThicknessMm: 90,
    kind: gapConfirmed ? 'door' : 'opening', confirmed: gapConfirmed, evidence: gapConfirmed ? 'door swing' : 'a gap in the wall line with nothing drawn to say what it is' }],
});
const labels = [{ x: 2500, y: 3500, name: 'Bed 1' }, { x: 5500, y: 3500, name: 'Robe' }];

const unconfirmed = vectorAnalysisFromLinework(geometry(false), spec, { labels });
assert.equal(unconfirmed.rooms.length, 2, `the unconfirmed gap still separates the two rooms (got ${unconfirmed.rooms.map((r) => r.name).join(', ')})`);
assert.deepEqual(unconfirmed.rooms.map((room) => room.name).sort(), ['Bed 1', 'Robe']);
assert.equal(unconfirmed.reviewBridgeCandidates.length, 1, 'the span across the gap is listed for review');
assert.match(unconfirmed.reviewBridgeCandidates[0].reason, /unconfirmed gap/);
assert.equal(unconfirmed.response.openings.length, 0, 'the unconfirmed gap is not an admitted opening');
assert.equal(unconfirmed.reviewOpeningCandidates.length, 1, 'the unconfirmed gap is listed for review, not dropped');
assert.equal(unconfirmed.reviewOpeningCandidates[0].widthMm, 900);
const interiorMm = (analysis) => analysis.response.walls.filter((item) => item.category === 'interior')
  .reduce((sum, item) => sum + Math.hypot((item.nodes[1].x - item.nodes[0].x) * spec.logicalWidth, (item.nodes[1].y - item.nodes[0].y) * spec.logicalHeight) / spec.pixelsPerMm, 0);
assert.ok(Math.abs(interiorMm(unconfirmed) - 4100) <= 100, `wall quantity excludes the unconfirmed span (interior ${Math.round(interiorMm(unconfirmed))} mm)`);

// Through the application's detection contract nothing unconfirmed is imported as a quantity.
const context = { jobId: 'gap-job', takeoffId: 'gap-takeoff', documentHash: 'gap-doc', pixelsPerMm: 1,
  pages: [{ pageNumber: 1, logicalWidth: 8000, logicalHeight: 7000 }], completedWallRuns: [], placedOpenings: [], completedFloorplans: [], sheetLevels: { 1: 'Ground Floor' } };
const canonical = convertAiTakeoffDetections(normalizePlanAnalysis({ context, responses: [unconfirmed.response], runId: 'gap', modelVersion: 'test' }).batch, context);
assert.equal(canonical.placedOpenings.length, 0, 'no placed opening for the unconfirmed gap');

// A confirmed doorway behaves as before: an admitted opening, and the span is part of the gross wall run.
const confirmed = vectorAnalysisFromLinework(geometry(true), spec, { labels });
assert.equal(confirmed.rooms.length, 2);
assert.equal(confirmed.response.openings.length, 1, 'a confirmed door is an admitted opening');
assert.notEqual(confirmed.response.openings[0].needsClassification, true);
assert.equal(confirmed.reviewBridgeCandidates.length, 0);

// The option can switch the behaviour off (gap dropped, rooms merge) for callers that need the old reading.
const off = vectorAnalysisFromLinework(geometry(false), spec, { labels, bridgeUnconfirmedMaxMm: 0 });
assert.equal(off.rooms.length, 1, 'without the review span the two spaces are one face');
assert.equal(off.reviewOpeningCandidates.length, 0);
console.log('Unconfirmed gaps: rooms close, gap and span listed for review, excluded from quantities; confirmed doors unchanged.');
