// Geometry engine on a drawing whose true measurements are known by construction: a 230 mm
// external shell divided by a 90 mm partition with an 820 mm doorway, at 10 mm per pixel.
// The real-plan comparison is scripts/benchmark-plan-geometry.mjs.
import assert from 'node:assert/strict';
import { detectPlanGeometry, pointInPolygon } from '../components/construction-estimation/ai-plan-takeoff/geometry/planGeometry.js';
import { fuseSheetLinework } from '../components/construction-estimation/ai-plan-takeoff/geometry/lineworkFusion.js';
import { detectOpeningSymbolReviewCandidates } from '../components/construction-estimation/ai-plan-takeoff/geometry/openingSymbolReview.js';
import { polygonIntersectionOverUnion } from '../components/construction-estimation/ai-plan-takeoff/geometry/roomReferenceMetrics.js';

const width = 1000, height = 800;
const data = new Uint8ClampedArray(width * height * 4).fill(255);
const ink = (x, y) => { const p = (y * width + x) * 4; data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; };
const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x += 1) { ink(x, y); ink(x, y + 1); } };
const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) { ink(x, y); ink(x + 1, y); } };

// External shell: outer faces, then inner faces 230 mm in (broken where the partition joins).
hline(100, 100, 901); hline(700, 100, 901); vline(100, 100, 701); vline(900, 100, 701);
hline(123, 123, 499); hline(123, 511, 877); hline(676, 123, 499); hline(676, 511, 877);
vline(123, 123, 677); vline(876, 123, 677);
// Partition: faces 90 mm apart, with a doorway from y=300 to y=382 and capped ends.
for (const [y0, y1] of [[125, 299], [383, 675]]) { vline(500, y0, y1); vline(509, y0, y1); }
hline(298, 500, 510); hline(383, 500, 510);
// Joinery: a 600 mm strip of paired lines standing clear of every wall.
hline(500, 250, 310); hline(520, 250, 310);

const context = { pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height };
const raster = { width, height, data };
const within = (actual, expected, share, label) => assert.ok(Math.abs(actual - expected) / expected <= share, `${label}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
const lengthOf = (result, test) => result.walls.filter(test).reduce((sum, wall) => sum + wall.lengthMm, 0) / 1000;

// --- A door-width gap between two ends of one wall is a doorway on the drawing's own evidence ---
const doorway = detectPlanGeometry(raster, context).openings.filter((item) => item.widthMm >= 600);
assert.equal(doorway.length, 1);
assert.deepEqual([doorway[0].confirmed, doorway[0].basis, doorway[0].reviewRequired], [true, 'aligned-wall-ends', true], 'a doorway with nothing drawn in it is taken as an opening, flagged for its type');
assert.ok(doorway[0].hostWallId, 'and attached to its wall');

// --- With that rule off, and no evidence of an opening, the gap in the partition is only a gap. ---
const bare = detectPlanGeometry(raster, context, { alignedDoorways: false });
const gap = bare.openings.filter((item) => item.widthMm >= 600);
assert.equal(gap.length, 1, `one candidate opening (found ${gap.map((item) => item.widthMm).join(', ')})`);
assert.ok(Math.abs(gap[0].widthMm - 820) <= 80, `gap width ${gap[0].widthMm} mm`);
assert.equal(gap[0].confirmed, false);
assert.equal(gap[0].reviewRequired, true);
assert.equal(gap[0].hostWallId, null, 'an unconfirmed gap has no host wall');
within(lengthOf(bare, (wall) => wall.thicknessMm === 90), 5.53 - 0.82, 0.03, 'partition stops at the unconfirmed gap');
const verified = bare.rooms.filter((room) => room.verified);
assert.equal(verified.length, 1, 'the gap is not closed to make two rooms');
within(verified[0].netAreaM2, 3.77 * 5.53 + 3.66 * 5.53 + 0.09 * 0.82, 0.03, 'the one enclosed space');
const proposed = bare.rooms.filter((room) => !room.verified);
assert.equal(proposed.length, 2, 'each side is offered as a proposal');
assert.ok(proposed.every((room) => room.reviewRequired && /not confirmed/.test(room.reviewReason)));
// Paired lines that join no wall are not a wall.
assert.ok(!bare.walls.some((wall) => wall.nodes[0].y > 480 && wall.nodes[0].y < 540 && wall.nodes[0].x < 400), 'joinery strip is not a wall');
assert.ok(bare.diagnostics.some((item) => item.code === 'isolated-linework'));

// --- With an opening located there (placed by the estimator or read from the plan). -------------
const result = detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 480, y: 330, ref: 'D1' }] });
const rooms = result.rooms.filter((room) => room.verified);
assert.equal(rooms.length, 2, `two rooms are enclosed (found ${rooms.length})`);
assert.equal(result.rooms.length, 2, 'nothing is left as a proposal');
const left = rooms.find((room) => pointInPolygon({ x: 300, y: 400 }, room.polygon));
const right = rooms.find((room) => pointInPolygon({ x: 700, y: 400 }, room.polygon));
assert.ok(left && right && left !== right, 'each side of the partition is its own room');
within(left.netAreaM2, 3.77 * 5.53 - 0.6 * 0.2, 0.025, 'left room area');
within(right.areaM2, 3.66 * 5.53, 0.025, 'right room area');
within(left.perimeterM, 2 * (3.77 + 5.53), 0.03, 'left room perimeter');
assert.ok(left.polygon.length <= 8 && right.polygon.length <= 8, 'room boundaries are simple polygons');

const doors = result.openings.filter((item) => item.widthMm >= 600);
assert.equal(doors.length, 1);
assert.equal(doors[0].confirmed, true);
assert.equal(doors[0].evidenceRef, 'D1', 'the opening that confirmed the gap is recorded');
assert.ok(Math.abs(doors[0].x - 505) <= 6 && doors[0].y > 300 && doors[0].y < 382, 'the opening is positioned on the wall, not where the evidence said');
// A wall's run is gross: the confirmed doorway does not shorten the partition that hosts it.
within(lengthOf(result, (wall) => wall.thicknessMm === 90), 5.53, 0.03, 'partition gross length');
assert.equal(doors[0].hostWallId, result.walls.find((wall) => wall.thicknessMm === 90).id, 'the doorway is attached to the partition it sits in');
// Wall runs are measured between junctions (inner corner to inner corner). The takeoff's outer-face
// convention for external walls (8 m x 6 m here = 28 lm) is not applied by the engine yet.
within(lengthOf(result, (wall) => wall.thicknessMm === 230), 2 * (7.54 + 5.54), 0.03, 'external wall runs between corners');
assert.ok(result.walls.every((wall) => wall.connectedEnds >= 1), 'every wall joins another wall');

// A nearby AI fragment may classify a measured wall only when it supports a meaningful share of
// that run; midpoint proximity alone must not extrapolate a tiny fragment across the whole wall.
const measuredOuter = result.walls.find((wall) => wall.thicknessMm === 230 && wall.lengthMm > 5000);
assert.ok(measuredOuter, 'the known plan has a measurable external run');
const normalized = (point) => ({ x: point.x / width, y: point.y / height });
const start = measuredOuter.nodes[0], end = measuredOuter.nodes[1];
const at = (share) => normalized({ x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share });
const classification = { detectionId: 'external-run', category: 'exterior', confidence: 0.9, nodes: [at(0), at(1)] };
const fused = (wall, existing = {}) => fuseSheetLinework({ page: 1, walls: [wall], openings: [], rooms: [] }, raster,
	{ pageNumber: 1, logicalWidth: width, logicalHeight: height, pixelsPerMm: context.pixelsPerMm }, existing);
// Every measured wall is returned, external or internal by where the outside lies, whatever the
// plan reading traced; its construction details are taken only from a trace that supports the run.
const classified = fused({ ...classification, constructionSystem: 'Brick Veneer' });
assert.equal(classified.response.walls.length, classified.geometry.walls.length, 'every measured wall is returned');
const fusedOuter = classified.response.walls.find((wall) => wall.lineworkWallId === measuredOuter.id);
assert.equal(fusedOuter.category, 'exterior', 'a wall with the outside against its face is external');
assert.equal(fusedOuter.constructionSystem, 'Brick Veneer', 'a trace supporting the full measured run supplies its construction');
assert.equal(result.walls.filter((wall) => wall.category === 'exterior').length, 4, 'the four shell walls are external');
assert.ok(result.walls.filter((wall) => wall.category === 'interior').length >= 1 && result.walls.filter((wall) => wall.category === 'interior').every((wall) => wall.outsideShare < 0.25), 'the partition is internal');
const shortTrace = { ...classification, constructionSystem: 'Brick Veneer', nodes: [at(0.495), at(0.505)] };
const unsupported = fused(shortTrace);
assert.equal(unsupported.response.walls.length, unsupported.geometry.walls.length, 'a short trace does not remove a measured wall');
assert.equal(unsupported.response.walls.find((wall) => wall.lineworkWallId === measuredOuter.id).constructionSystem, undefined, 'a short trace cannot describe the entire measured run');
// The plan reading calling an external wall internal does not change what the drawing shows.
const contradicted = fused({ ...classification, category: 'interior' });
assert.equal(contradicted.response.walls.find((wall) => wall.lineworkWallId === measuredOuter.id).category, 'exterior');
assert.ok(contradicted.report.categoryDisagreementLm >= measuredOuter.lengthMm / 1000 - 0.01, 'the disagreement is reported');
// Evidence far from any gap confirms nothing.
assert.equal(detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 300, y: 600 }] }, { alignedDoorways: false }).openings.filter((item) => item.confirmed).length, 0);

// Identity is geometric, so analysing the same sheet again yields the same objects.
const again = detectPlanGeometry(raster, { ...context, openingEvidence: [{ x: 480, y: 330 }] });
assert.deepEqual(again.rooms.map((room) => room.id), result.rooms.map((room) => room.id), 'room ids are stable across runs');
assert.deepEqual(again.walls.map((wall) => wall.id), result.walls.map((wall) => wall.id), 'wall ids are stable across runs');

// A sheet with no confirmed calibration is refused, never guessed.
assert.throws(() => detectPlanGeometry(raster, { ...context, pixelsPerMm: 0 }), /calibration/);
const referenceSquare = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
assert.equal(polygonIntersectionOverUnion(referenceSquare, referenceSquare, 1, 1).iou, 1, 'identical manual and detected room polygons have IoU 1');
const halfOverlap = [{ x: 50, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }, { x: 50, y: 100 }];
assert.ok(Math.abs(polygonIntersectionOverUnion(referenceSquare, halfOverlap, 1, 1).iou - 1 / 3) < 0.02, 'polygon overlap is measured independently of room area totals');
assert.throws(() => polygonIntersectionOverUnion(referenceSquare, referenceSquare, 0), /positive plan scale/);

const singleFaceData = new Uint8ClampedArray(width * height * 4).fill(255);
const singleInk = (x, y) => { const p = (y * width + x) * 4; singleFaceData[p] = 0; singleFaceData[p + 1] = 0; singleFaceData[p + 2] = 0; };
for (const y of [177, 178, 200, 201]) for (let x = 400; x <= 600; x += 1) singleInk(x, y);
for (let x = 400; x <= 600; x += 1) singleInk(x, 600);
for (const x of [300, 301, 323, 324]) for (let y = 177; y <= 624; y += 1) singleInk(x, y);
for (let y = 200; y <= 600; y += 1) { const drift = Math.floor((y - 200) / 8) % 2; singleInk(500 + drift, y); singleInk(501 + drift, y); }
for (let x = 650; x <= 950; x += 1) singleInk(x, 750);
const singleFaceResult = detectPlanGeometry({ width, height, data: singleFaceData }, context);
const singleFaceCandidate = singleFaceResult.singleFaceReviewCandidates.find((candidate) => candidate.axis === 'v' && candidate.lengthMm > 3000);
assert.ok(singleFaceCandidate, 'a single face anchored by paired perpendicular walls at both ends is surfaced for review');
assert.equal(singleFaceCandidate.reviewRequired, true);
assert.ok(Math.abs(singleFaceCandidate.lengthMm - 4000) <= 40, 'one-pixel face drift does not fragment the measured review candidate');
assert.equal(singleFaceCandidate.endpointAnchorThicknessesMm.filter((value) => value !== null).length, 1, 'one paired thickness anchor supports review, not thickness inference');
assert.equal(singleFaceResult.walls.some((wall) => wall.axis === 'v' && wall.nodes[0].x > 495 && wall.nodes[0].x < 510 && wall.lengthMm > 3000), false, 'a single face never becomes a measured wall automatically');
assert.equal(singleFaceCandidate.inferredThicknessMm, undefined, 'single-face thickness is never inferred into a wall quantity');
assert.ok(!singleFaceResult.singleFaceReviewCandidates.some((candidate) => candidate.nodes[0].y > 700 || candidate.nodes[0].x > 640), 'an isolated long single line with no wall junction is not even a review candidate');
const candidateStart = singleFaceCandidate.nodes[0], candidateEnd = singleFaceCandidate.nodes[1];
const manualFootprint = { id: 'manual-footprint', page: 1, type: 'Footprint', nodes: [
	{ x: candidateStart.x - 2, y: candidateStart.y - 2 }, { x: candidateStart.x + 2, y: candidateStart.y - 2 },
	{ x: candidateEnd.x + 2, y: candidateEnd.y + 2 }, { x: candidateEnd.x - 2, y: candidateEnd.y + 2 },
] };
const candidateFusion = fuseSheetLinework({ page: 1, walls: [], openings: [], rooms: [] }, { width, height, data: singleFaceData },
	{ pageNumber: 1, logicalWidth: width, logicalHeight: height, pixelsPerMm: context.pixelsPerMm }, { completedFloorplans: [manualFootprint] });
assert.equal(candidateFusion.response.walls.length, candidateFusion.geometry.walls.length, 'only walls with two measured faces are returned');
assert.ok(candidateFusion.report.singleFaceReviewCandidates.every((candidate) => !candidateFusion.response.walls.some((wall) => wall.lineworkWallId === candidate.id)), 'a footprint-supported single face is still not measured automatically');
assert.equal(candidateFusion.report.singleFaceReviewCandidates.length, 1, 'manual footprint overlap may surface one candidate for human review');
assert.match(candidateFusion.report.review[0].message, /verify.*before measuring/i);
assert.equal(candidateFusion.report.review[0].code, 'single-face-line');

const openingRaster = new Uint8ClampedArray(width * height * 4).fill(255);
const openingInk = new Uint8Array(width * height);
const inkOpeningPixel = (x, y) => { const p = (y * width + x) * 4; openingRaster[p] = openingRaster[p + 1] = openingRaster[p + 2] = 0; openingInk[y * width + x] = 1; };
for (let y = 100; y <= 700; y += 1) for (const x of [400, 401, 423, 424]) inkOpeningPixel(x, y);
for (const y of [300, 360]) for (let x = 400; x <= 424; x += 1) inkOpeningPixel(x, y);
const symbolWall = { id: 'symbol-host', axis: 'v', measuredThicknessMm: 230, nodes: [{ x: 412, y: 100 }, { x: 412, y: 700 }] };
const symbolCandidates = detectOpeningSymbolReviewCandidates({ ink: openingInk, width, height, pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height, walls: [symbolWall] });
assert.equal(symbolCandidates.length, 1, 'two cross-wall frame marks inside a continuous band form one opening review candidate');
assert.equal(symbolCandidates[0].openingClass, 'Unclassified Opening', 'raster frame cues do not guess window versus door');
assert.equal(symbolCandidates[0].widthMm, 600);
assert.equal(symbolCandidates[0].reviewRequired, true);
const noFrameCandidates = detectOpeningSymbolReviewCandidates({ ink: new Uint8Array(width * height).fill(1), width, height, pixelsPerMm: 0.1, logicalWidth: width, logicalHeight: height, walls: [symbolWall] });
assert.equal(noFrameCandidates.length, 0, 'a continuous wall band without frame edges yields no opening candidate');

// A blank sheet reports that it found no walls.
const blank = detectPlanGeometry({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) }, context);
assert.equal(blank.rooms.length, 0);
assert.equal(blank.diagnostics.at(-1).code, 'no-walls');
console.log('plan geometry engine: ok');
