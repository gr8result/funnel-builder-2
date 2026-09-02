import assert from "node:assert/strict";
import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { softAxisSnap } from "../takeoff/wallDrawing.js";
import { resolveManualTracePoint, tracedSegmentHasWallEvidence, validateEditedExteriorGraph, snapLabelForCandidate, normalizeHighlightedWallJunctions, moveHighlightedWallJunction, highlightedWallsAreValid } from "../hooks/useTakeoffTools.js";
import { cursorForPlanViewer } from "../viewer/planViewerCursor.js";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { documentToScreenPoint, screenToDocumentPoint } from "../viewer/rotationTransform.js";
import { extractVectorSegmentsFromOperatorList } from "../geometry/planVectorExtraction.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { createWallSegment, createWallVertex, isLegacyAutomaticExteriorWalls, withPlanPageDefaults } from "../types.js";
import { addSegment, deleteVertexAndReconnect, moveVertex, splitSegment } from "../takeoff/wallGraph.js";
import { findNearestWallSegment } from "../takeoff/openingPlacement.js";
import { rectangleAreaMetrics, rectangleVerticesFromCorners } from "../takeoff/rectangleArea.js";
import { detectWallObjects } from "../takeoff/wallObjectDetection.js";
import { findHighlightableWallAtPoint } from "../takeoff/localWallHighlighter.js";
import { findRasterWallBandInImage, findRasterWallBandOnCanvas } from "../takeoff/localRasterWallHit.js";
import { detectExteriorCornerSnap, detectExteriorWallRunFromSeed, detectManualWallBand, detectWallRunFromSeed, buildWallBandSegmentMetadata } from "../takeoff/manualWallBand.js";

const lastPoint = { x: 0, y: 0 };

function wallBandWidthPlanUnits(segment) {
  const start = segment.centreline?.start || { x: 0, y: 0 };
  const end = segment.centreline?.end || { x: 1, y: 0 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  assert.ok(len > 0, "wall width measurement requires a non-zero centreline");
  const nx = -dy / len;
  const ny = dx / len;
  const faceA = ((segment.faceA.start.x - start.x) * nx + (segment.faceA.start.y - start.y) * ny);
  const faceB = ((segment.faceB.start.x - start.x) * nx + (segment.faceB.start.y - start.y) * ny);
  return Math.abs(faceA - faceB);
}

function assertBuilderWallThickness({ wallType, field, thicknessMm, mmPerDocumentUnit, constructionType = "custom", locked = true }) {
  const thicknessDocUnits = thicknessMm / mmPerDocumentUnit;
  const page = {
    calibration: {
      actualLengthMm: 7000,
      documentDistance: 7000 / mmPerDocumentUnit,
      mmPerDocumentUnit,
      pointA: { x: 0, y: 0 },
      pointB: { x: 7000 / mmPerDocumentUnit, y: 0 },
      axis: "horizontal",
    },
    [field]: { constructionType, wallThicknessMm: thicknessMm, thicknessLocked: locked },
  };
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 0, y: 0 }, { x: 100, y: 0 }, { id: "face-a" }),
      line({ x: 0, y: thicknessDocUnits }, { x: 100, y: thicknessDocUnits }, { id: "face-b" }),
    ],
  };
  const metadata = buildWallBandSegmentMetadata({ x: 0, y: 0 }, { x: 100, y: 0 }, { page, field, wallType, planGeometryIndex });
  const calculatedThicknessPlanPx = thicknessMm / mmPerDocumentUnit;
  const actualPolygonWidthPlanPx = wallBandWidthPlanUnits(metadata);
  const renderedGeometryThicknessMm = actualPolygonWidthPlanPx * mmPerDocumentUnit;
  assert.equal(metadata.geometryStatus, "resolved");
  assert.equal(metadata.thicknessSource, locked ? "user_locked" : "user_override");
  assert.ok(Math.abs(metadata.thicknessDocUnits - calculatedThicknessPlanPx) <= 1e-9);
  assert.ok(Math.abs(actualPolygonWidthPlanPx - calculatedThicknessPlanPx) <= 1e-9);
  assert.ok(Math.abs(renderedGeometryThicknessMm - thicknessMm) <= 1e-6);
  return { metadata, calculatedThicknessPlanPx, actualPolygonWidthPlanPx, renderedGeometryThicknessMm };
}

function roundedPointKey(point) {
  return `${Math.round(point.x * 1000) / 1000},${Math.round(point.y * 1000) / 1000}`;
}

function wallPolygonKey(segment) {
  return [
    segment.faceA.start,
    segment.faceA.end,
    segment.faceB.end,
    segment.faceB.start,
  ].map(roundedPointKey).sort().join("|");
}

// ---- manual wall clicks require a valid snap ------------------------------
{
  const result = resolveManualTracePoint({ x: 50, y: 60 }, { snapCandidate: null });
  assert.equal(result.valid, false);
  assert.equal(result.point, null);
  assert.equal(result.reason, "no_wall_corner_snap");
}

// ---- snapped manual wall clicks place the snap point, not raw cursor ------
{
  const result = resolveManualTracePoint(
    { x: 52, y: 63 },
    { snapCandidate: { type: "endpoint", point: { x: 50, y: 60 }, confidence: 0.9, lineId: "wall-end" } }
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.point, { x: 50, y: 60 });
  assert.equal(result.snap.kind, "endpoint");
  assert.equal(result.snap.confidence, 0.9);
}

// ---- near-horizontal snaps exactly -----------------------------------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 100, y: 3 }, rotation: 0 }); // ~1.7deg
  assert.equal(result.locked, true);
  assert.equal(result.axis, "horizontal");
  assert.equal(result.angleDegrees, 0);
  assert.deepEqual(result.point, { x: 100, y: 0 });
}

// ---- near-vertical snaps exactly -------------------------------------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 3, y: 100 }, rotation: 0 }); // ~88.3deg
  assert.equal(result.locked, true);
  assert.equal(result.axis, "vertical");
  assert.deepEqual(result.point, { x: 0, y: 100 });
}

// ---- a genuine 45deg angle is left completely unchanged --------------------
{
  const raw = { x: 100, y: 100 };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0 });
  assert.equal(result.locked, false);
  assert.equal(result.axis, null);
  assert.deepEqual(result.point, raw);
}

// ---- just past the default 6deg tolerance stays free -----------------------
{
  const raw = { x: 100, y: 100 * Math.tan((7 * Math.PI) / 180) };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0 });
  assert.equal(result.locked, false);
}

// ---- just inside a wider, explicit tolerance snaps -------------------------
{
  const raw = { x: 100, y: 100 * Math.tan((7 * Math.PI) / 180) };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0, toleranceDegrees: 10 });
  assert.equal(result.locked, true);
  assert.equal(result.axis, "horizontal");
}

// ---- forcedAxis (Shift) overrides the angle entirely -----------------------
{
  const raw = { x: 100, y: 3 }; // would normally lock horizontal
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0, forcedAxis: "vertical" });
  assert.equal(result.axis, "vertical");
  assert.deepEqual(result.point, { x: 0, y: 3 });
}

// ---- identical points (no movement yet) is safely unlocked -----------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 0, y: 0 }, rotation: 0 });
  assert.equal(result.locked, false);
  assert.deepEqual(result.point, { x: 0, y: 0 });
}

// ---- same screen-relative intent locks to the same base axis at every
//      rotation (mirrors axisLock.test.mjs's rotation-invariance table) -----
for (const rotation of [0, 90, 180, 270]) {
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 100, y: 3 }, rotation });
  // At every rotation this should still resolve to *a* locked cardinal axis
  // (never left diagonal), since 100,3 is always within 6deg of some screen
  // cardinal regardless of how rotateDelta remaps it.
  assert.equal(result.locked, true, `rotation ${rotation} should still lock`);
  assert.ok(result.axis === "horizontal" || result.axis === "vertical");
}

// ---- traced exterior segments require nearby wall evidence ----------------
{
  const planGeometryIndex = {
    segments: [
      { id: "wall", a: { x: 0, y: 100 }, b: { x: 200, y: 100 } },
    ],
  };
  assert.equal(
    tracedSegmentHasWallEvidence({ x: 0, y: 100 }, { x: 200, y: 100 }, planGeometryIndex, 8),
    true
  );
  assert.equal(
    tracedSegmentHasWallEvidence({ x: 0, y: 0 }, { x: 200, y: 200 }, planGeometryIndex, 8),
    false
  );
}

// ---- tracing cursors stay precise, while pan keeps the hand cursor ---------
{
  assert.equal(cursorForPlanViewer({ activeTool: "select" }), "default");
  assert.equal(cursorForPlanViewer({ activeTool: "pan" }), "grab");
  assert.equal(cursorForPlanViewer({ activeTool: "pan", dragMode: "pan" }), "grabbing");
  assert.equal(cursorForPlanViewer({ activeTool: "exterior-wall" }), "crosshair");
  assert.equal(cursorForPlanViewer({ activeTool: "exterior-wall", isSpacePanning: true }), "grab");
  assert.equal(cursorForPlanViewer({ activeTool: "edit-walls" }), "default");
  assert.equal(cursorForPlanViewer({ activeTool: "edit-walls", editHoverTarget: { type: "point" } }), "grab");
  assert.equal(cursorForPlanViewer({ activeTool: "edit-walls", editHoverTarget: { type: "segment" } }), "pointer");
  assert.equal(cursorForPlanViewer({ activeTool: "edit-walls", dragMode: "vertex" }), "grabbing");
  assert.equal(cursorForPlanViewer({ activeTool: "area", dragMode: "area-vertex" }), "grabbing");
}

// ---- traced points remain document-stable across zoom and pan --------------
{
  const viewport = {
    width: 600,
    height: 400,
    convertToViewportPoint: (x, y) => [x, y],
    convertToPdfPoint: (x, y) => [x, y],
  };
  const point = { x: 123.5, y: 87.25 };
  const firstView = { viewport, panX: 10, panY: 20, zoomScale: 1 };
  const zoomedView = { viewport, panX: -320, panY: 145, zoomScale: 4 };
  const firstScreen = pageToScreenPoint(firstView, point.x, point.y);
  const zoomedScreen = pageToScreenPoint(zoomedView, point.x, point.y);

  assert.deepEqual(screenToPagePoint(firstView, firstScreen.x, firstScreen.y), point);
  assert.deepEqual(screenToPagePoint(zoomedView, zoomedScreen.x, zoomedScreen.y), point);
}

function graphFromPoints(points) {
  const vertices = points.map((point, index) => createWallVertex({ id: `v${index}`, x: point.x, y: point.y }));
  const segments = vertices.map((vertex, index) => createWallSegment({
    id: `s${index}`,
    aId: vertex.id,
    bId: vertices[(index + 1) % vertices.length].id,
    wallType: "exterior",
    source: "manual",
  }));
  return { vertices, segments, isClosed: true };
}

// ---- edit exterior validation catches invalid drags -----------------------
{
  const rect = graphFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }]);
  assert.equal(validateEditedExteriorGraph(rect).valid, true);
  const crossed = {
    ...rect,
    vertices: rect.vertices.map((v) => (v.id === "v1" ? { ...v, x: 20, y: 100 } : v)),
  };
  assert.equal(validateEditedExteriorGraph(crossed, "v1").valid, false);
}

// ---- insert/delete preserve polygon order and reconnect neighbours --------
{
  const rect = graphFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }]);
  const inserted = splitSegment(rect, "s0", { x: 45, y: 0 });
  assert.equal(inserted.vertices.length, 5);
  assert.equal(inserted.segments.length, 5);
  assert.ok(inserted.segments.some((segment) => segment.aId === "v0" && segment.bId.startsWith("wv-")));
  const reconnected = deleteVertexAndReconnect(rect, "v1");
  assert.equal(reconnected.vertices.length, 3);
  assert.ok(reconnected.segments.some((segment) => (
    (segment.aId === "v0" && segment.bId === "v2") || (segment.aId === "v2" && segment.bId === "v0")
  )));
}

// ---- drag snap labels are local and explicit ------------------------------
{
  assert.equal(snapLabelForCandidate({ type: "endpoint" }), "Corner");
  assert.equal(snapLabelForCandidate({ type: "intersection" }), "Wall intersection");
  assert.equal(snapLabelForCandidate({ type: "line" }), "Wall line");
}

function rotatedViewport(width, height, rotation = 0, scale = 1) {
  const r = ((rotation % 360) + 360) % 360;
  return {
    width: (r === 90 || r === 270 ? height : width) * scale,
    height: (r === 90 || r === 270 ? width : height) * scale,
    convertToViewportPoint: (x, y) => {
      if (r === 90) return [y * scale, x * scale];
      if (r === 180) return [(width - x) * scale, y * scale];
      if (r === 270) return [(height - y) * scale, (width - x) * scale];
      return [x * scale, y * scale];
    },
    convertToPdfPoint: (x, y) => {
      const sx = x / scale;
      const sy = y / scale;
      if (r === 90) return [sy, sx];
      if (r === 180) return [width - sx, sy];
      if (r === 270) return [width - sy, height - sx];
      return [sx, sy];
    },
  };
}

let lineSeq = 0;
function line(a, b, extra = {}) {
  lineSeq += 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    id: `wall-line-${lineSeq}`,
    source: "vector",
    stroked: true,
    strokeColor: "#000000",
    a,
    b,
    length: Math.hypot(dx, dy),
    ...extra,
  };
}

function rectWallFaces(x1, y1, x2, y2, thickness = 8) {
  return [
    line({ x: x1, y: y1 }, { x: x2, y: y1 }),
    line({ x: x1, y: y1 + thickness }, { x: x2, y: y1 + thickness }),
    line({ x: x1, y: y2 }, { x: x2, y: y2 }),
    line({ x: x1, y: y2 - thickness }, { x: x2, y: y2 - thickness }),
    line({ x: x1, y: y1 }, { x: x1, y: y2 }),
    line({ x: x1 + thickness, y: y1 }, { x: x1 + thickness, y: y2 }),
    line({ x: x2, y: y1 }, { x: x2, y: y2 }),
    line({ x: x2 - thickness, y: y1 }, { x: x2 - thickness, y: y2 }),
  ];
}

// ---- coordinate conversion remains invertible across rotations -------------
{
  [0, 90, 180, 270].forEach((rotation) => {
    const viewport = rotatedViewport(500, 300, rotation, 2);
    const view = { viewport, panX: 31, panY: 47, zoomScale: 1.75 };
    const base = { x: 123, y: 210 };
    const screen = documentToScreenPoint(view, base);
    const roundTrip = screenToDocumentPoint(view, screen);
    assert.ok(Math.abs(roundTrip.x - base.x) < 1e-9, `x round trip failed at ${rotation}`);
    assert.ok(Math.abs(roundTrip.y - base.y) < 1e-9, `y round trip failed at ${rotation}`);
    assert.deepEqual(screenToPagePoint(view, pageToScreenPoint(view, base.x, base.y).x, pageToScreenPoint(view, base.x, base.y).y), base);
  });
}

// ---- manual trace rejects raw point when no close snap exists --------------
{
  const raw = { x: 220.25, y: 118.75 };
  const result = resolveManualTracePoint(raw);
  assert.equal(result.valid, false);
  assert.equal(result.point, null);
  assert.equal(result.snap, null);
}

// ---- close local corner and wall-edge candidates snap; Alt/raw does not ----
{
  const raw = { x: 100, y: 100 };
  const closeCorner = { type: "intersection", point: { x: 102, y: 99 }, distance: 2 };
  assert.deepEqual(resolveManualTracePoint(raw, { snapCandidate: closeCorner }).point, closeCorner.point);
  const lineCandidate = { type: "line", point: { x: 100, y: 80 }, distance: 1 };
  assert.deepEqual(resolveManualTracePoint(raw, { snapCandidate: lineCandidate }).point, lineCandidate.point);
  assert.equal(resolveManualTracePoint(raw, { snapCandidate: closeCorner, disableSnap: true }).valid, false);
}

// ---- rectangle area supports click-drag in any direction ------------------
{
  const forward = rectangleVerticesFromCorners({ x: 10, y: 20 }, { x: 50, y: 80 });
  const reverse = rectangleVerticesFromCorners({ x: 50, y: 80 }, { x: 10, y: 20 });
  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward, [
    { x: 10, y: 20 },
    { x: 50, y: 20 },
    { x: 50, y: 80 },
    { x: 10, y: 80 },
  ]);
  const metrics = rectangleAreaMetrics(forward, 1000);
  assert.equal(metrics.calculatedAreaM2, 2400);
  assert.equal(metrics.confirmedAreaM2, 2400);
}

// ---- no automatic wall extension: two clicks create one exact segment ------
{
  const first = createWallVertex({ id: "v0", x: 10, y: 20 });
  const second = createWallVertex({ id: "v1", x: 110, y: 55 });
  const graph = addSegment({ vertices: [first, second], segments: [] }, first.id, second.id, { wallType: "exterior" });
  assert.equal(graph.segments.length, 1);
  assert.equal(graph.segments[0].aId, "v0");
  assert.equal(graph.segments[0].bId, "v1");
  assert.deepEqual(graph.vertices[0], first);
  assert.deepEqual(graph.vertices[1], second);
}

// ---- manual trace preview can axis-lock, but never replaces endpoints ------
{
  const last = { x: 0, y: 0 };
  const raw = { x: 100, y: 3 };
  const result = resolveManualTracePoint(raw, { snapCandidate: { type: "endpoint", point: raw, confidence: 1 }, lastVertex: last, rotation: 0 });
  assert.deepEqual(result.point, { x: 100, y: 0 });
  const freeRaw = { x: 100, y: 20 };
  const free = resolveManualTracePoint(freeRaw, { snapCandidate: { type: "endpoint", point: freeRaw, confidence: 1 }, lastVertex: last, rotation: 0 });
  assert.deepEqual(free.point, { x: 100, y: 20 });
}

// ---- dragging a point changes only the shared vertex/adjacent segments -----
{
  const rect = graphFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }]);
  const moved = moveVertex(rect, "v1", { x: 110, y: 10 });
  assert.deepEqual(moved.vertices.find((v) => v.id === "v1"), { id: "v1", x: 110, y: 10 });
  assert.equal(moved.segments.length, rect.segments.length);
  assert.deepEqual(moved.segments.map((s) => [s.aId, s.bId]), rect.segments.map((s) => [s.aId, s.bId]));
}

// ---- stale assisted geometry is quarantined, manual trace persists ---------
{
  const assisted = {
    source: "manual-trace-v2",
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
    segments: [{ id: "s", aId: "a", bId: "b", source: "manual", detectedWallId: "dw-1" }],
  };
  assert.equal(isLegacyAutomaticExteriorWalls(assisted), true);
  const normalizedAssisted = withPlanPageDefaults({ id: "p1", exteriorWalls: assisted });
  assert.equal(normalizedAssisted.exteriorWalls, null);

  const manual = {
    source: "manual-trace-v2",
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
    segments: [{ id: "s", aId: "a", bId: "b", source: "manual" }],
  };
  const normalizedManual = withPlanPageDefaults({ id: "p2", exteriorWalls: manual });
  assert.equal(normalizedManual.exteriorWalls.segments.length, 1);

  const currentAutoCandidate = {
    source: "auto-detector-v2",
    schemaVersion: 2,
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }, { id: "c", x: 100, y: 100 }],
    segments: [
      { id: "s1", aId: "a", bId: "b", source: "automatic", wallType: "exterior", confirmed: true },
      { id: "s2", aId: "b", bId: "c", source: "automatic", wallType: "exterior", confirmed: true },
    ],
    exteriorPerimeter: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed: true, gapCount: 0 },
    detectedSnapshot: { vertices: [], segments: [] },
  };
  assert.equal(isLegacyAutomaticExteriorWalls(currentAutoCandidate), false);
  const normalizedAutoCandidate = withPlanPageDefaults({ id: "p3", exteriorWalls: currentAutoCandidate });
  assert.equal(normalizedAutoCandidate.exteriorWalls.vertices.length, 3);
  assert.equal(normalizedAutoCandidate.exteriorWalls.segments.length, 2);
}

// ---- wall-object detection creates independent classified wall objects -----
{
  const result = detectWallObjects({
    planGeometryIndex: {
      source: "fixture",
      segments: [
        ...rectWallFaces(100, 100, 300, 240),
        line({ x: 150, y: 112 }, { x: 150, y: 228 }),
        line({ x: 158, y: 112 }, { x: 158, y: 228 }),
      ],
    },
    page: { sourceWidth: 400, sourceHeight: 320, planRegion: { x: 90, y: 90, width: 230, height: 170, confirmed: true } },
  });
  assert.ok(result.summary.total >= 5);
  assert.ok(result.summary.exterior >= 4);
  assert.ok(result.summary.interior >= 1);
  assert.ok(result.walls.every((wall) => Array.isArray(wall.openings) && Array.isArray(wall.connectedWalls)));
}

// ---- dimension/title/page geometry is rejected before becoming walls -------
{
  const result = detectWallObjects({
    planGeometryIndex: {
      source: "fixture",
      segments: [
        line({ x: 100, y: 100 }, { x: 300, y: 100 }),
        line({ x: 100, y: 108 }, { x: 300, y: 108 }),
        line({ x: 50, y: 40 }, { x: 350, y: 40 }, { isDimension: true }),
        line({ x: 20, y: 300 }, { x: 360, y: 300 }, { classification: "title-block-rule" }),
      ],
    },
    page: { sourceWidth: 400, sourceHeight: 320 },
  });
  assert.equal(result.summary.total, 0);
  assert.equal(result.diagnostics.rejectedSegments, 2);
  assert.equal(result.diagnostics.rejectedCandidateWalls, 1);
}

// ---- detected wall objects persist through page defaults ------------------
{
  const page = withPlanPageDefaults({
    id: "page-wall-objects",
    detectedWalls: [{ id: "w1", type: "unknown", start: { x: 1, y: 2 }, end: { x: 3, y: 4 }, confidence: 0.54 }],
  });
  assert.equal(page.detectedWalls.length, 1);
  assert.equal(page.detectedWalls[0].type, "unknown");
  assert.deepEqual(page.detectedWalls[0].openings, []);
  assert.deepEqual(page.detectedWalls[0].connectedWalls, []);
}

// ---- local highlighter finds one complete wall under the cursor -----------
{
  const planGeometryIndex = { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) };
  const result = findHighlightableWallAtPoint({
    point: { x: 200, y: 104 },
    planGeometryIndex,
    page: { sourceWidth: 400, sourceHeight: 320 },
    searchRadiusDocUnits: 12,
  });
  assert.ok(result.wall, "clear external wall should preview");
  assert.equal(Math.round(result.wall.thickness), 8);
  assert.ok(Math.abs(result.wall.centreline.start.x - 100) < 0.01);
  assert.ok(Math.abs(result.wall.centreline.end.x - 300) < 0.01);
}

// ---- clicking either face or the centre band resolves to the same wall ----
{
  const planGeometryIndex = { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) };
  const faceA = findHighlightableWallAtPoint({ point: { x: 180, y: 100 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 320 }, searchRadiusDocUnits: 12 }).wall;
  const centre = findHighlightableWallAtPoint({ point: { x: 180, y: 104 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 320 }, searchRadiusDocUnits: 12 }).wall;
  const faceB = findHighlightableWallAtPoint({ point: { x: 180, y: 108 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 320 }, searchRadiusDocUnits: 12 }).wall;
  assert.ok(faceA && centre && faceB);
  assert.equal(faceA.id, centre.id);
  assert.equal(faceB.id, centre.id);
}

// ---- manual wall drawing stores the detected twin-face wall band ----------
{
  const planGeometryIndex = { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) };
  const page = { sourceWidth: 400, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 80 } };
  const band = detectManualWallBand({ x: 180, y: 108 }, { planGeometryIndex, page, zoomScale: 1 });
  assert.ok(band, "manual click on either wall face should resolve a band");
  assert.equal(Math.round(band.point.y), 104);
  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 104 },
    { x: 260, y: 104 },
    { wallBand: band, page, field: "internalWalls", wallType: "internal" }
  );
  assert.equal(metadata.type, "internal");
  assert.ok(metadata.faceA?.start && metadata.faceB?.end);
  assert.equal(Math.round(metadata.thicknessDocUnits), 8);
  assert.equal(Math.round(metadata.thicknessMm), 80);
  assert.equal(metadata.thicknessSource, "detected");
  assert.ok(metadata.confidence > 0.6);
}

// ---- exterior brick veneer clusters use outermost physical faces ----------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }),
      line({ x: 100, y: 108 }, { x: 340, y: 108 }),
      line({ x: 100, y: 116 }, { x: 340, y: 116 }),
      line({ x: 100, y: 124 }, { x: 340, y: 124 }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const band = detectManualWallBand({ x: 220, y: 108 }, { planGeometryIndex, page, zoomScale: 1, wallType: "exterior" });
  assert.ok(band, "exterior click should resolve a multi-line wall assembly");
  assert.equal(band.constructionLineCount, 4);
  assert.equal(Math.round(band.thicknessDocUnits), 24);
  assert.equal(Math.round(band.thicknessMm), 240);
  assert.equal(band.wallConstructionType, "brick veneer");
  assert.equal(band.passedThicknessValidation, true);
  assert.equal(Math.round(band.outerFace.start.y), 100);
  assert.equal(Math.round(band.innerFace.start.y), 124);
  assert.equal(band.intermediateFaces.length, 2);

  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 112 },
    { x: 320, y: 112 },
    { wallBand: band, page, field: "exteriorWalls", wallType: "exterior" }
  );
  assert.equal(metadata.constructionLineCount, 4);
  assert.equal(Math.round(metadata.thicknessMm), 240);
  assert.equal(Math.round(metadata.faceA.start.y), 124);
  assert.equal(Math.round(metadata.faceB.start.y), 100);
}

// ---- committed selected paths derive physical faces without changing snaps -
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "outer-face" }),
      line({ x: 100, y: 108 }, { x: 340, y: 108 }, { id: "cavity-face-a" }),
      line({ x: 100, y: 116 }, { x: 340, y: 116 }, { id: "cavity-face-b" }),
      line({ x: 100, y: 124 }, { x: 340, y: 124 }, { id: "inner-face" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const start = { x: 120, y: 112 };
  const end = { x: 320, y: 112 };
  const metadata = buildWallBandSegmentMetadata(start, end, {
    page,
    field: "exteriorWalls",
    wallType: "exterior",
    planGeometryIndex,
  });
  assert.deepEqual(metadata.centreline, { start, end }, "selected path must remain the wall topology");
  assert.equal(metadata.wallFacesUncertain, undefined);
  assert.equal(metadata.snapSource, "segment-guided-exterior-wall-band");
  assert.equal(metadata.constructionLineCount, 4);
  assert.equal(metadata.wallConstructionType, "brick veneer");
  assert.equal(Math.round(metadata.thicknessMm), 240);
  assert.equal(Math.round(metadata.faceA.start.y), 124);
  assert.equal(Math.round(metadata.faceB.start.y), 100);
}

// ---- segment-guided resolver rejects plausible bands beside selected path -
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 360, y: 100 }, { id: "actual-outer" }),
      line({ x: 100, y: 108 }, { x: 360, y: 108 }, { id: "actual-cavity-a" }),
      line({ x: 100, y: 116 }, { x: 360, y: 116 }, { id: "actual-cavity-b" }),
      line({ x: 100, y: 124 }, { x: 360, y: 124 }, { id: "actual-inner" }),
      line({ x: 100, y: 150 }, { x: 360, y: 150 }, { id: "wrong-parallel-a" }),
      line({ x: 100, y: 158 }, { x: 360, y: 158 }, { id: "wrong-parallel-b" }),
      line({ x: 100, y: 166 }, { x: 360, y: 166 }, { id: "wrong-parallel-c" }),
      line({ x: 100, y: 174 }, { x: 360, y: 174 }, { id: "wrong-parallel-d" }),
    ],
  };
  const page = { sourceWidth: 460, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const start = { x: 120, y: 112 };
  const end = { x: 340, y: 112 };
  const metadata = buildWallBandSegmentMetadata(start, end, {
    page,
    field: "exteriorWalls",
    wallType: "exterior",
    planGeometryIndex,
  });
  assert.equal(Math.round(metadata.faceA.start.y), 124);
  assert.equal(Math.round(metadata.faceB.start.y), 100);
  assert.ok(!metadata.sourceSegmentIds.includes("wrong-parallel-a"), "parallel wall beside selected path must be rejected");
  assert.ok(metadata.physicalBandDiagnostics?.rejectedCandidates.some((entry) => entry.reason === "rejected: selected path outside candidate band"));
}

// ---- selected path may coincide with one physical face --------------------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 360, y: 100 }, { id: "outer-face" }),
      line({ x: 100, y: 108 }, { x: 360, y: 108 }, { id: "cavity-a" }),
      line({ x: 100, y: 116 }, { x: 360, y: 116 }, { id: "cavity-b" }),
      line({ x: 100, y: 124 }, { x: 360, y: 124 }, { id: "inner-face" }),
    ],
  };
  const page = { sourceWidth: 460, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 100 },
    { x: 340, y: 100 },
    { page, field: "exteriorWalls", wallType: "exterior", planGeometryIndex }
  );
  assert.equal(metadata.wallFacesUncertain, undefined);
  assert.equal(metadata.physicalBandDiagnostics.chosen.selectedPathRelation, "touches-face");
  assert.equal(Math.round(metadata.thicknessMm), 240);
  assert.equal(Math.round(metadata.faceB.start.y), 100);
  assert.equal(Math.round(metadata.faceA.start.y), 124);
}

// ---- fragmented faces across openings still resolve by sample consensus ---
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 180, y: 100 }, { id: "outer-left" }),
      line({ x: 240, y: 100 }, { x: 360, y: 100 }, { id: "outer-right" }),
      line({ x: 100, y: 108 }, { x: 360, y: 108 }, { id: "mid-a" }),
      line({ x: 100, y: 116 }, { x: 360, y: 116 }, { id: "mid-b" }),
      line({ x: 100, y: 124 }, { x: 190, y: 124 }, { id: "inner-left" }),
      line({ x: 230, y: 124 }, { x: 360, y: 124 }, { id: "inner-right" }),
    ],
  };
  const page = { sourceWidth: 460, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 112 },
    { x: 340, y: 112 },
    { page, field: "exteriorWalls", wallType: "exterior", planGeometryIndex }
  );
  assert.equal(metadata.wallFacesUncertain, undefined);
  assert.equal(Math.round(metadata.thicknessMm), 240);
  const faceASupport = Number(metadata.physicalBandDiagnostics.chosen.faceASupport.split("/")[0]);
  const faceBSupport = Number(metadata.physicalBandDiagnostics.chosen.faceBSupport.split("/")[0]);
  assert.ok(faceASupport >= 3);
  assert.ok(faceBSupport >= 3);
  assert.ok(metadata.sourceSegmentIds.includes("outer-left"));
  assert.ok(metadata.sourceSegmentIds.includes("outer-right"));
}

// ---- wall-band selection requires the calibrated scale --------------------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }),
      line({ x: 100, y: 124 }, { x: 340, y: 124 }),
    ],
  };
  const uncalibrated = detectManualWallBand(
    { x: 220, y: 100 },
    { planGeometryIndex, page: { sourceWidth: 440, sourceHeight: 320 }, zoomScale: 1, wallType: "exterior" }
  );
  assert.equal(uncalibrated, null, "physical wall selection must not infer wall thickness without calibrated scale");
}

// ---- exterior corner snap wins even when drafting lines have tiny gaps ----
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 104, y: 100 }, { x: 340, y: 100 }),
      line({ x: 104, y: 108 }, { x: 340, y: 108 }),
      line({ x: 104, y: 116 }, { x: 340, y: 116 }),
      line({ x: 104, y: 124 }, { x: 340, y: 124 }),
      line({ x: 100, y: 96 }, { x: 100, y: 260 }),
      line({ x: 108, y: 96 }, { x: 108, y: 260 }),
      line({ x: 116, y: 96 }, { x: 116, y: 260 }),
      line({ x: 124, y: 96 }, { x: 124, y: 260 }),
    ],
  };
  const corner = detectExteriorCornerSnap({ x: 102, y: 102 }, { planGeometryIndex, page: { sourceWidth: 440, sourceHeight: 320 }, zoomScale: 1 });
  assert.ok(corner, "corner should be inferred from near-intersecting wall faces");
  assert.equal(corner.type, "intersection");
  assert.ok(Math.abs(corner.point.x - 100) <= 4);
  assert.ok(Math.abs(corner.point.y - 100) <= 4);
}

// ---- exterior clusters stop at adjacent physical faces, not distant lines -
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "face-outer" }),
      line({ x: 100, y: 108 }, { x: 340, y: 108 }, { id: "face-cavity-a" }),
      line({ x: 100, y: 116 }, { x: 340, y: 116 }, { id: "face-cavity-b" }),
      line({ x: 100, y: 124 }, { x: 340, y: 124 }, { id: "face-inner" }),
      line({ x: 100, y: 190 }, { x: 340, y: 190 }, { id: "far-internal" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const band = detectManualWallBand({ x: 220, y: 108 }, { planGeometryIndex, page, zoomScale: 1, wallType: "exterior" });
  assert.ok(band);
  assert.equal(band.constructionLineCount, 4);
  assert.equal(Math.round(band.thicknessDocUnits), 24);
  assert.ok(!band.sourceSegmentIds.includes("far-internal"), "distant parallel line must not join the cluster");
}

// ---- exterior lightweight/cladding bands pass the calibrated gate ---------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "clad-outer" }),
      line({ x: 100, y: 108 }, { x: 340, y: 108 }, { id: "clad-inner" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const band = detectManualWallBand({ x: 220, y: 100 }, { planGeometryIndex, page, zoomScale: 1, wallType: "exterior" });
  assert.ok(band, "80mm lightweight exterior wall should pass");
  assert.equal(band.constructionLineCount, 2);
  assert.equal(Math.round(band.thicknessMm), 80);
  assert.equal(band.wallConstructionType, "lightweight/cladding");
}

// ---- implausibly wide exterior bands are rejected without custom config ---
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "wide-a" }),
      line({ x: 100, y: 140 }, { x: 340, y: 140 }, { id: "wide-b" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const band = detectManualWallBand({ x: 220, y: 100 }, { planGeometryIndex, page, zoomScale: 1, wallType: "exterior" });
  assert.equal(band, null, "400mm exterior wall band must be rejected without explicit custom wall type");
}

// ---- explicit custom exterior range can accept special thick walls --------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "custom-a" }),
      line({ x: 100, y: 140 }, { x: 340, y: 140 }, { id: "custom-b" }),
    ],
  };
  const page = {
    sourceWidth: 440,
    sourceHeight: 320,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { wallThicknessRangeMm: { min: 380, max: 420, target: 400 } },
  };
  const band = detectManualWallBand({ x: 220, y: 100 }, { planGeometryIndex, page, zoomScale: 1, wallType: "exterior" });
  assert.ok(band, "custom exterior range should accept an explicitly configured 400mm wall");
  assert.equal(Math.round(band.thicknessMm), 400);
  assert.equal(band.wallConstructionType, "custom");
}

// ---- normal interior partitions pass, oversized partitions fail -----------
{
  const normalIndex = { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) };
  const page = { sourceWidth: 400, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const normal = detectManualWallBand({ x: 180, y: 108 }, { planGeometryIndex: normalIndex, page, zoomScale: 1, wallType: "internal" });
  assert.ok(normal, "80mm internal partition should pass");
  assert.equal(normal.wallConstructionType, "interior partition");

  const wideIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "internal-wide-a" }),
      line({ x: 100, y: 140 }, { x: 340, y: 140 }, { id: "internal-wide-b" }),
    ],
  };
  const wide = detectManualWallBand({ x: 220, y: 100 }, { planGeometryIndex: wideIndex, page, zoomScale: 1, wallType: "internal" });
  assert.equal(wide, null, "400mm internal wall band must be rejected as a normal partition");
}

// ---- interior selected path can be one wall face, not centreline ----------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "interior-face-a" }),
      line({ x: 100, y: 115 }, { x: 340, y: 115 }, { id: "interior-face-b" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 100 },
    { x: 320, y: 100 },
    { page, field: "internalWalls", wallType: "internal", planGeometryIndex }
  );
  assert.equal(metadata.geometryStatus, "resolved");
  assert.equal(metadata.resolutionFailure, null);
  assert.equal(metadata.selectedPathRelation, "touches-face");
  assert.equal(Math.round(metadata.thicknessMm), 150);
  assert.equal(metadata.wallConstructionType, "interior partition");
  assert.ok(metadata.faceA?.start && metadata.faceB?.start);
}

// ---- unresolved manual walls store explicit failure state -----------------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 340, y: 100 }, { id: "single-face-only" }),
    ],
  };
  const page = { sourceWidth: 440, sourceHeight: 320, calibration: { mmPerDocumentUnit: 10 } };
  const metadata = buildWallBandSegmentMetadata(
    { x: 120, y: 100 },
    { x: 320, y: 100 },
    { page, field: "internalWalls", wallType: "internal", planGeometryIndex }
  );
  assert.equal(metadata.geometryStatus, "unresolved");
  assert.equal(metadata.resolutionFailure, "no_opposing_face");
  assert.equal(metadata.reviewMessage, "Thickness unresolved");
  assert.equal(metadata.faceA, null);
  assert.ok(metadata.physicalBandDiagnostics?.crossSectionOffsets?.length >= 5);
}

// ---- openings snap to the physical wall band, not only a thin line --------
{
  const vertices = [
    createWallVertex({ id: "a", x: 120, y: 112 }),
    createWallVertex({ id: "b", x: 320, y: 112 }),
  ];
  const segments = [
    createWallSegment({
      id: "wall-band-host",
      aId: "a",
      bId: "b",
      wallType: "exterior",
      source: "manual",
      faceA: { start: { x: 120, y: 124 }, end: { x: 320, y: 124 } },
      faceB: { start: { x: 120, y: 100 }, end: { x: 320, y: 100 } },
      thicknessDocUnits: 24,
      thicknessMm: 240,
    }),
  ];
  const host = findNearestWallSegment(
    { x: 210, y: 123 },
    [{ key: "exterior", vertices, segments }],
    2
  );
  assert.ok(host, "click inside the green wall band should resolve the wall host");
  assert.equal(host.wallId, "wall-band-host");
  assert.equal(Math.round(host.point.y), 112, "opening offsets stay on the saved wall topology");
}

// ---- fragmented vector strokes merge into one highlightable wall ----------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 185, y: 100 }),
      line({ x: 215, y: 100 }, { x: 300, y: 100 }),
      line({ x: 100, y: 108 }, { x: 185, y: 108 }),
      line({ x: 215, y: 108 }, { x: 300, y: 108 }),
    ],
  };
  const result = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.ok(result.wall, "fragmented wall should still preview");
  assert.ok(result.wall.centreline.end.x - result.wall.centreline.start.x >= 198);
}

// ---- window/door-sized interruptions remain one wall when both faces match -
for (const gap of [30, 40]) {
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 200 - gap / 2, y: 100 }),
      line({ x: 200 + gap / 2, y: 100 }, { x: 300, y: 100 }),
      line({ x: 100, y: 108 }, { x: 200 - gap / 2, y: 108 }),
      line({ x: 200 + gap / 2, y: 108 }, { x: 300, y: 108 }),
    ],
  };
  const result = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.ok(result.wall, `gap ${gap} should merge where continuity is proven`);
  assert.ok(result.wall.centreline.end.x - result.wall.centreline.start.x >= 198);
}

// ---- annotation-like geometry is rejected by the local highlighter ---------
for (const extra of [
  { isDimension: true },
  { dashPattern: [6, 4] },
  { classification: "title-block-rule" },
  { classification: "cabinetry" },
  { classification: "furniture" },
]) {
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 300, y: 100 }, extra),
      line({ x: 100, y: 108 }, { x: 300, y: 108 }, extra),
    ],
  };
  const result = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.equal(result.wall, null, `${JSON.stringify(extra)} should not highlight`);
}

// ---- dimension chain with repeated ticks is rejected as a wall band --------
{
  const dimensionTicks = [100, 150, 200, 250, 300].map((x) => line({ x, y: 76 }, { x, y: 88 }));
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 80 }, { x: 320, y: 80 }),
      line({ x: 80, y: 100 }, { x: 320, y: 100 }),
      ...dimensionTicks,
    ],
  };
  const result = findHighlightableWallAtPoint({
    point: { x: 200, y: 80 },
    planGeometryIndex,
    page: { sourceWidth: 420, sourceHeight: 220 },
    searchRadiusDocUnits: 12,
    diagnosticsEnabled: true,
  });
  assert.equal(result.wall, null);
  assert.ok(result.diagnostics.some((entry) => entry.belongsToDimensionChain));
}

// ---- clicking a dimension chain near a real wall does not jump to the wall -
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 300, y: 100 }),
      line({ x: 100, y: 108 }, { x: 300, y: 108 }),
      line({ x: 100, y: 80 }, { x: 300, y: 80 }),
      line({ x: 120, y: 76 }, { x: 120, y: 88 }),
      line({ x: 180, y: 76 }, { x: 180, y: 88 }),
      line({ x: 240, y: 76 }, { x: 240, y: 88 }),
      line({ x: 300, y: 76 }, { x: 300, y: 88 }),
      line({ x: 100, y: 70 }, { x: 100, y: 130 }),
      line({ x: 108, y: 70 }, { x: 108, y: 130 }),
      line({ x: 300, y: 70 }, { x: 300, y: 130 }),
      line({ x: 292, y: 70 }, { x: 292, y: 130 }),
    ],
  };
  const dimensionClick = findHighlightableWallAtPoint({ point: { x: 200, y: 80 }, planGeometryIndex, page: { sourceWidth: 420, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.equal(dimensionClick.wall, null);
  const wallClick = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 420, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.ok(wallClick.wall);
  assert.equal(Math.round(wallClick.wall.centreline.start.x), 100);
  assert.equal(Math.round(wallClick.wall.centreline.end.x), 300);
}

// ---- a lone line and a distant pointer do not snap to nonexistent walls ----
{
  const planGeometryIndex = { source: "fixture", rawSegments: [line({ x: 100, y: 100 }, { x: 300, y: 100 })] };
  assert.equal(findHighlightableWallAtPoint({ point: { x: 200, y: 100 }, planGeometryIndex, page: { sourceWidth: 400, sourceHeight: 220 }, searchRadiusDocUnits: 12 }).wall, null);
  const wallIndex = { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) };
  assert.equal(findHighlightableWallAtPoint({ point: { x: 50, y: 50 }, planGeometryIndex: wallIndex, page: { sourceWidth: 400, sourceHeight: 320 }, searchRadiusDocUnits: 12 }).wall, null);
}

// ---- highlighted wall objects persist through page defaults ---------------
{
  const wall = findHighlightableWallAtPoint({
    point: { x: 200, y: 104 },
    planGeometryIndex: { source: "fixture", rawSegments: rectWallFaces(100, 100, 300, 240) },
    page: { sourceWidth: 400, sourceHeight: 320 },
    searchRadiusDocUnits: 12,
  }).wall;
  const page = withPlanPageDefaults({ id: "page-highlighted-wall", exteriorHighlightedWalls: [wall] });
  assert.equal(page.exteriorHighlightedWalls.length, 1);
  assert.equal(page.exteriorHighlightedWallIds[0], wall.id);
  assert.deepEqual(page.exteriorHighlightedWalls[0].centreline, wall.centreline);
}

// ---- overextended highlighted wall endpoints trim to structural junctions -
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 100 }, { x: 320, y: 100 }),
      line({ x: 80, y: 108 }, { x: 320, y: 108 }),
      line({ x: 100, y: 80 }, { x: 100, y: 140 }),
      line({ x: 108, y: 80 }, { x: 108, y: 140 }),
      line({ x: 300, y: 80 }, { x: 300, y: 140 }),
      line({ x: 292, y: 80 }, { x: 292, y: 140 }),
    ],
  };
  const result = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 420, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.ok(result.wall);
  assert.equal(Math.round(result.wall.centreline.start.x), 100);
  assert.equal(Math.round(result.wall.centreline.end.x), 300);
  assert.equal(result.wall.endpointReview, null);
}

// ---- dimension-line intersections are not accepted as wall endpoints -------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 100 }, { x: 320, y: 100 }),
      line({ x: 80, y: 108 }, { x: 320, y: 108 }),
      line({ x: 100, y: 80 }, { x: 100, y: 140 }, { isDimension: true }),
      line({ x: 300, y: 80 }, { x: 300, y: 140 }, { isDimension: true }),
    ],
  };
  const result = findHighlightableWallAtPoint({ point: { x: 200, y: 104 }, planGeometryIndex, page: { sourceWidth: 420, sourceHeight: 220 }, searchRadiusDocUnits: 12 });
  assert.ok(result.wall);
  assert.equal(Math.round(result.wall.centreline.start.x), 80);
  assert.equal(Math.round(result.wall.centreline.end.x), 320);
  assert.equal(result.wall.endpointReview, "Needs endpoint review");
}

// ---- adjoining highlighted walls share one editable junction --------------
{
  const walls = [
    { id: "h", centreline: { start: { x: 100, y: 100 }, end: { x: 202, y: 100 } }, confidence: 0.9 },
    { id: "v", centreline: { start: { x: 200, y: 98 }, end: { x: 200, y: 220 } }, confidence: 0.9 },
  ];
  const { walls: normalized, junctions } = normalizeHighlightedWallJunctions(walls);
  const shared = junctions.find((junction) => junction.connectedWallIds.includes("h") && junction.connectedWallIds.includes("v"));
  assert.ok(shared);
  assert.equal(Math.round(shared.point.x), 200);
  assert.equal(Math.round(shared.point.y), 100);
  assert.deepEqual(normalized.find((wall) => wall.id === "h").centreline.end, shared.point);
  assert.deepEqual(normalized.find((wall) => wall.id === "v").centreline.start, shared.point);

  const moved = moveHighlightedWallJunction(normalized, shared.id, { x: 205, y: 105 });
  assert.deepEqual(moved.find((wall) => wall.id === "h").centreline.end, { x: 205, y: 105 });
  assert.deepEqual(moved.find((wall) => wall.id === "v").centreline.start, { x: 205, y: 105 });
  assert.ok(highlightedWallsAreValid(moved));
}

// ---- highlight and area point rendering use reduced visible widths --------
{
  const overlay = fs.readFileSync(new URL("../components/TakeoffCanvasOverlay.jsx", import.meta.url), "utf8");
  const toolbar = fs.readFileSync(new URL("../components/TakeoffToolbar.jsx", import.meta.url), "utf8");
  assert.ok(overlay.includes('data-testid="wall-band-fill"'), "manual wall segments should render as translucent bands");
  assert.ok(overlay.includes("#31E85A") && overlay.includes("#168CFF") && overlay.includes("#00E5FF"), "wall overlay should use bright takeoff colours");
  assert.ok(overlay.includes("hasWallFaces(segment)") && overlay.includes('data-testid="wall-faces-uncertain-preview"'), "wall body fill must require detected faces and fall back to a narrow uncertain cue");
  assert.ok(!overlay.includes("nx * half"), "wall body must not be rendered from a thick centred stroke fallback");
  assert.ok(!overlay.includes('tools.activeTool === "internal-wall") && internalWalls && internalDisplayVertices'), "wall drawing mode should not show permanent vertex dots");
  assert.ok(overlay.includes('data-testid="exterior-highlight-junction-hit-area"'), "exterior junction hit area should remain separate");
  assert.ok(overlay.includes("r={10} fill=\"transparent\""), "exterior/area hit radius should remain easy to grab");
  assert.ok(overlay.includes("r={i === 0 ? 3.8 : 3.2}"), "area point visible radius should be reduced");
  assert.ok(overlay.includes('data-testid="area-vertex-handle"'), "saved rectangle areas should expose corner handles");
  assert.ok(!toolbar.includes("area-mode-room-detect"), "Area Tool should offer Rectangle and Manual Polygon only");
  assert.ok(toolbar.includes("area-mode-rectangle"));
  assert.ok(toolbar.includes("area-mode-manual-polygon"));
}

// ---- manual area polygons accept free-angle points ------------------------
{
  const toolsHook = fs.readFileSync(new URL("../hooks/useTakeoffTools.js", import.meta.url), "utf8");
  const planViewer = fs.readFileSync(new URL("../components/PlanViewer.jsx", import.meta.url), "utf8");
  const manualAreaStart = toolsHook.indexOf('if (areaMode !== "manual-polygon") return;');
  const manualAreaCloseCheck = toolsHook.indexOf("if (areaDraftVertices.length >= 3)", manualAreaStart);
  const manualAreaPointResolution = toolsHook.slice(manualAreaStart, manualAreaCloseCheck);
  assert.ok(manualAreaPointResolution.includes("const finalPoint = rawPoint;"), "manual polygon corners should preserve the clicked free-angle point");
  assert.ok(!manualAreaPointResolution.includes("snapPoint("), "manual polygon corners must not be forced through wall/measurement snapping");
  assert.ok(!manualAreaPointResolution.includes("bestSnapCandidate("), "manual polygon corners must not be forced through plan-geometry snapping");
  assert.ok(planViewer.includes('dragRef.current = { mode: "area-point" };'), "manual polygon clicks should place a point immediately instead of becoming pan drags");
  assert.ok(planViewer.includes('if (drag.mode === "area-point")'), "manual polygon point placement should not be replayed on pointerup");
}

// ---- locked thickness without twin faces does not create a fake band -------
{
  const metadata = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    {
      wallBand: { centreline: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }, thicknessDocUnits: 10 },
      page: { calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 100, thicknessLocked: true } },
      field: "internalWalls",
      wallType: "internal",
    }
  );
  assert.equal(metadata.faceA, null);
  assert.equal(metadata.faceB, null);
  assert.equal(metadata.geometryStatus, "unresolved_faces");
  assert.equal(metadata.resolutionFailure, "no_opposing_face");
  assert.equal(metadata.thicknessSource, "user_locked");
  assert.equal(Math.round(metadata.thicknessMm), 100);
}

// ---- locked builder thickness needs physical face support -----------------
{
  const exterior = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    {
      page: { calibration: { mmPerDocumentUnit: 10 }, exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 250, thicknessLocked: true } },
      field: "exteriorWalls",
      wallType: "exterior",
    }
  );
  assert.equal(exterior.geometryStatus, "unresolved_faces");
  assert.equal(exterior.thicknessSource, "user_locked");
  assert.equal(Math.round(exterior.thicknessMm), 250);
  assert.equal(Math.round(exterior.thicknessDocUnits), 25);
  assert.equal(exterior.faceA, null);
  assert.equal(exterior.faceB, null);

  const interior = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    {
      page: { calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 90, thicknessLocked: true } },
      field: "internalWalls",
      wallType: "internal",
    }
  );
  assert.equal(interior.geometryStatus, "unresolved_faces");
  assert.equal(interior.thicknessSource, "user_locked");
  assert.equal(Math.round(interior.thicknessMm), 90);
  assert.equal(Math.round(interior.thicknessDocUnits), 9);
  assert.equal(interior.faceA, null);
  assert.equal(interior.faceB, null);
}

// ---- builder thickness converts mm to plan geometry exactly ---------------
{
  const mmPerDocumentUnit = 35;
  const cases = [
    { wallType: "internal", field: "internalWalls", thicknessMm: 70, constructionType: "interior_partition" },
    { wallType: "internal", field: "internalWalls", thicknessMm: 90, constructionType: "interior_partition" },
    { wallType: "exterior", field: "exteriorWalls", thicknessMm: 230, constructionType: "brick_veneer" },
    { wallType: "exterior", field: "exteriorWalls", thicknessMm: 250, constructionType: "brick_veneer" },
  ];
  for (const testCase of cases) {
    const result = assertBuilderWallThickness({ ...testCase, mmPerDocumentUnit });
    assert.equal(result.renderedGeometryThicknessMm, testCase.thicknessMm);
  }
}

// ---- plan/real wall thickness is invariant across zoom and rotation -------
{
  const result = assertBuilderWallThickness({
    wallType: "internal",
    field: "internalWalls",
    thicknessMm: 70,
    mmPerDocumentUnit: 35,
    constructionType: "interior_partition",
  });
  for (const zoom of [0.5, 1, 2, 4]) {
    const screenWidth = result.actualPolygonWidthPlanPx * zoom;
    const recoveredPlanWidth = screenWidth / zoom;
    const recoveredMm = recoveredPlanWidth * 35;
    assert.ok(Math.abs(recoveredMm - 70) <= 1e-9);
  }
  const rotations = [
    { name: "none", point: ({ x, y }) => ({ x, y }) },
    { name: "right", point: ({ x, y }) => ({ x: y, y: -x }) },
    { name: "left", point: ({ x, y }) => ({ x: -y, y: x }) },
  ];
  for (const rotation of rotations) {
    const rotated = {
      centreline: {
        start: rotation.point(result.metadata.centreline.start),
        end: rotation.point(result.metadata.centreline.end),
      },
      faceA: {
        start: rotation.point(result.metadata.faceA.start),
        end: rotation.point(result.metadata.faceA.end),
      },
      faceB: {
        start: rotation.point(result.metadata.faceB.start),
        end: rotation.point(result.metadata.faceB.end),
      },
    };
    const recoveredMm = wallBandWidthPlanUnits(rotated) * 35;
    assert.ok(Math.abs(recoveredMm - 70) <= 1e-9, rotation.name);
  }
}

// ---- locked face search chooses the pair matching configured thickness ----
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 0, y: 0 }, { x: 100, y: 0 }, { id: "face-0" }),
      line({ x: 0, y: 7 }, { x: 100, y: 7 }, { id: "face-70" }),
      line({ x: 0, y: 9 }, { x: 100, y: 9 }, { id: "face-90" }),
    ],
  };
  const locked70 = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    {
      page: { calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 70, thicknessLocked: true } },
      field: "internalWalls",
      wallType: "internal",
      planGeometryIndex,
    }
  );
  assert.equal(locked70.geometryStatus, "resolved");
  assert.equal(Math.round(wallBandWidthPlanUnits(locked70)), 7);
  assert.ok(locked70.sourceSegmentIds.includes("face-70"));
  assert.ok(!locked70.sourceSegmentIds.includes("face-90"));
}

// ---- exterior wall tool resolves a complete run from one seed click -------
{
  const page = {
    sourceWidth: 500,
    sourceHeight: 300,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 240, thicknessLocked: true },
  };
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 420, y: 100 }, { id: "outside-face" }),
      line({ x: 100, y: 108 }, { x: 420, y: 108 }, { id: "brick-line" }),
      line({ x: 100, y: 116 }, { x: 420, y: 116 }, { id: "frame-line" }),
      line({ x: 100, y: 124 }, { x: 420, y: 124 }, { id: "room-face" }),
      line({ x: 100, y: 80 }, { x: 100, y: 150 }, { id: "left-return" }),
      line({ x: 420, y: 80 }, { x: 420, y: 150 }, { id: "right-return" }),
    ],
  };
  const result = detectExteriorWallRunFromSeed({ x: 250, y: 101 }, { planGeometryIndex, page, zoomScale: 1 });
  assert.equal(result.status, "resolved");
  assert.equal(result.metadata.geometryStatus, "resolved");
  assert.equal(Math.round(result.metadata.thicknessMm), 240);
  assert.equal(Math.round(result.start.x), 100);
  assert.equal(Math.round(result.end.x), 420);
  assert.equal(Math.round(result.metadata.faceA.start.y), 124);
  assert.equal(Math.round(result.metadata.faceB.start.y), 100);
  assert.equal(result.metadata.snapSource, "seeded-exterior-wall-run");
}

// ---- seeded exterior tracing bridges window/door interruptions ------------
{
  const page = {
    sourceWidth: 560,
    sourceHeight: 300,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 240, thicknessLocked: true },
  };
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 190, y: 100 }, { id: "outside-left" }),
      line({ x: 250, y: 100 }, { x: 460, y: 100 }, { id: "outside-right" }),
      line({ x: 100, y: 108 }, { x: 460, y: 108 }, { id: "brick-line" }),
      line({ x: 100, y: 116 }, { x: 460, y: 116 }, { id: "frame-line" }),
      line({ x: 100, y: 124 }, { x: 180, y: 124 }, { id: "room-left" }),
      line({ x: 260, y: 124 }, { x: 460, y: 124 }, { id: "room-right" }),
      line({ x: 100, y: 80 }, { x: 100, y: 150 }, { id: "left-return" }),
      line({ x: 460, y: 80 }, { x: 460, y: 150 }, { id: "right-return" }),
    ],
  };
  const result = detectExteriorWallRunFromSeed({ x: 310, y: 101 }, { planGeometryIndex, page, zoomScale: 1 });
  assert.equal(result.status, "resolved");
  assert.equal(Math.round(result.start.x), 100);
  assert.equal(Math.round(result.end.x), 460);
  assert.equal(Math.round(result.metadata.thicknessMm), 240);
}

// ---- seeded exterior tracing is independent of vector draw direction ------
{
  const page = {
    sourceWidth: 500,
    sourceHeight: 300,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { wallThicknessMm: 240, thicknessLocked: true },
  };
  const forwardIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 420, y: 100 }, { id: "outside-forward" }),
      line({ x: 100, y: 108 }, { x: 420, y: 108 }, { id: "mid-forward-a" }),
      line({ x: 100, y: 116 }, { x: 420, y: 116 }, { id: "mid-forward-b" }),
      line({ x: 100, y: 124 }, { x: 420, y: 124 }, { id: "inside-forward" }),
    ],
  };
  const reverseIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 420, y: 100 }, { x: 100, y: 100 }, { id: "outside-reverse" }),
      line({ x: 420, y: 108 }, { x: 100, y: 108 }, { id: "mid-reverse-a" }),
      line({ x: 420, y: 116 }, { x: 100, y: 116 }, { id: "mid-reverse-b" }),
      line({ x: 420, y: 124 }, { x: 100, y: 124 }, { id: "inside-reverse" }),
    ],
  };
  const forward = detectExteriorWallRunFromSeed({ x: 250, y: 101 }, { planGeometryIndex: forwardIndex, page, zoomScale: 1 });
  const reverse = detectExteriorWallRunFromSeed({ x: 250, y: 101 }, { planGeometryIndex: reverseIndex, page, zoomScale: 1 });
  assert.equal(forward.status, "resolved");
  assert.equal(reverse.status, "resolved");
  assert.equal(wallPolygonKey(reverse.metadata), wallPolygonKey(forward.metadata));
}

// ---- exterior wall seed rejects blank and dimension line clicks -----------
{
  const page = {
    sourceWidth: 500,
    sourceHeight: 300,
    calibration: { mmPerDocumentUnit: 10 },
    exteriorWalls: { wallThicknessMm: 240, thicknessLocked: true },
  };
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 100, y: 100 }, { x: 420, y: 100 }, { id: "outside-face" }),
      line({ x: 100, y: 124 }, { x: 420, y: 124 }, { id: "room-face" }),
      line({ x: 80, y: 60 }, { x: 450, y: 60 }, { id: "dimension-line", isDimension: true }),
    ],
  };
  const blank = detectExteriorWallRunFromSeed({ x: 250, y: 180 }, { planGeometryIndex, page, zoomScale: 1 });
  const dimension = detectExteriorWallRunFromSeed({ x: 250, y: 60 }, { planGeometryIndex, page, zoomScale: 1 });
  assert.equal(blank.status, "not_found");
  assert.equal(dimension.status, "not_found");
}

// ---- interior wall tool resolves a complete run from one seed click -------
{
  const page = {
    sourceWidth: 500,
    sourceHeight: 300,
    calibration: { mmPerDocumentUnit: 10 },
    internalWalls: { constructionType: "interior_partition", wallThicknessMm: 90, thicknessLocked: true },
  };
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 110, y: 140 }, { x: 410, y: 140 }, { id: "interior-face-a" }),
      line({ x: 110, y: 149 }, { x: 410, y: 149 }, { id: "interior-face-b" }),
      line({ x: 110, y: 90 }, { x: 110, y: 190 }, { id: "left-t" }),
      line({ x: 410, y: 90 }, { x: 410, y: 190 }, { id: "right-t" }),
    ],
  };
  const result = detectWallRunFromSeed(
    { x: 270, y: 141 },
    { planGeometryIndex, page, zoomScale: 1, wallType: "internal", field: "internalWalls" },
  );
  assert.equal(result.status, "resolved");
  assert.equal(result.field, "internalWalls");
  assert.equal(result.metadata.geometryStatus, "resolved");
  assert.equal(Math.round(result.metadata.thicknessMm), 90);
  assert.equal(Math.round(result.start.x), 110);
  assert.equal(Math.round(result.end.x), 410);
  assert.equal(result.metadata.snapSource, "seeded-internal-wall-run");
}

// ---- interior configured 70mm and 90mm thicknesses measure back correctly -
{
  for (const thicknessMm of [70, 90]) {
    const thicknessDocUnits = thicknessMm / 10;
    const page = {
      sourceWidth: 420,
      sourceHeight: 260,
      calibration: { mmPerDocumentUnit: 10 },
      internalWalls: { constructionType: "interior_partition", wallThicknessMm: thicknessMm, thicknessLocked: true },
    };
    const planGeometryIndex = {
      source: "fixture",
      rawSegments: [
        line({ x: 80, y: 120 }, { x: 340, y: 120 }, { id: `int-${thicknessMm}-a` }),
        line({ x: 80, y: 120 + thicknessDocUnits }, { x: 340, y: 120 + thicknessDocUnits }, { id: `int-${thicknessMm}-b` }),
      ],
    };
    const result = detectWallRunFromSeed(
      { x: 180, y: 120 },
      { planGeometryIndex, page, zoomScale: 1, wallType: "internal", field: "internalWalls" },
    );
    assert.equal(result.status, "resolved");
    assert.ok(Math.abs(result.metadata.thicknessMm - thicknessMm) <= 1e-9);
    assert.ok(Math.abs(wallBandWidthPlanUnits(result.metadata) * 10 - thicknessMm) <= 1e-9);
  }
}

// ---- interior seeded tracing is independent of vector draw direction ------
{
  const page = {
    sourceWidth: 420,
    sourceHeight: 260,
    calibration: { mmPerDocumentUnit: 10 },
    internalWalls: { wallThicknessMm: 90, thicknessLocked: true },
  };
  const forwardIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 80, y: 120 }, { x: 340, y: 120 }, { id: "forward-a" }),
      line({ x: 80, y: 129 }, { x: 340, y: 129 }, { id: "forward-b" }),
    ],
  };
  const reverseIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 340, y: 120 }, { x: 80, y: 120 }, { id: "reverse-a" }),
      line({ x: 340, y: 129 }, { x: 80, y: 129 }, { id: "reverse-b" }),
    ],
  };
  const forward = detectWallRunFromSeed({ x: 180, y: 120 }, { planGeometryIndex: forwardIndex, page, wallType: "internal", field: "internalWalls" });
  const reverse = detectWallRunFromSeed({ x: 180, y: 120 }, { planGeometryIndex: reverseIndex, page, wallType: "internal", field: "internalWalls" });
  assert.equal(forward.status, "resolved");
  assert.equal(reverse.status, "resolved");
  assert.equal(wallPolygonKey(reverse.metadata), wallPolygonKey(forward.metadata));
}

// ---- reverse trace direction produces the same physical wall polygon ------
{
  const planGeometryIndex = {
    source: "fixture",
    rawSegments: [
      line({ x: 0, y: 0 }, { x: 100, y: 0 }, { id: "face-a" }),
      line({ x: 0, y: 7 }, { x: 100, y: 7 }, { id: "face-b" }),
    ],
  };
  const page = { calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 70, thicknessLocked: true } };
  const forward = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { page, field: "internalWalls", wallType: "internal", planGeometryIndex }
  );
  const reverse = buildWallBandSegmentMetadata(
    { x: 100, y: 0 },
    { x: 0, y: 0 },
    { page, field: "internalWalls", wallType: "internal", planGeometryIndex }
  );
  assert.equal(forward.geometryStatus, "resolved");
  assert.equal(reverse.geometryStatus, "resolved");
  assert.equal(wallPolygonKey(reverse), wallPolygonKey(forward));
  assert.equal(Math.round(wallBandWidthPlanUnits(reverse) * 10), 70);
}

// ---- broken second face stays unresolved in either trace direction ---------
{
  const page = { calibration: { mmPerDocumentUnit: 10 }, internalWalls: { wallThicknessMm: 70, thicknessLocked: true } };
  const forward = buildWallBandSegmentMetadata(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { page, field: "internalWalls", wallType: "internal" }
  );
  const reverse = buildWallBandSegmentMetadata(
    { x: 100, y: 0 },
    { x: 0, y: 0 },
    { page, field: "internalWalls", wallType: "internal" }
  );
  assert.equal(forward.geometryStatus, "unresolved_faces");
  assert.equal(reverse.geometryStatus, "unresolved_faces");
  assert.equal(forward.faceA, null);
  assert.equal(reverse.faceA, null);
}

// ---- real sample plan rejects parallel annotation clutter -----------------
{
  const localSamplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";
  if (fs.existsSync(localSamplePath)) {
    const data = new Uint8Array(fs.readFileSync(localSamplePath));
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const pdfPage = await pdf.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
    const operatorList = await pdfPage.getOperatorList();
    const vectorSegments = extractVectorSegmentsFromOperatorList(
      { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS: pdfjsLib.OPS },
      { pageWidth: viewport.width, pageHeight: viewport.height }
    );
    const planGeometryIndex = {
      ...buildPlanGeometryIndex(vectorSegments, { pageWidth: viewport.width, pageHeight: viewport.height }),
      source: "vector",
      segmentCount: vectorSegments.length,
    };
    const result = detectWallObjects({
      planGeometryIndex,
      page: { sourceWidth: viewport.width, sourceHeight: viewport.height },
    });
    assert.ok(result.diagnostics.rawSegments > 3000, "sample plan should expose dense vector geometry");
    assert.ok(result.diagnostics.candidatePairs > result.summary.total, "parallel clutter must be filtered after pairing");
    assert.ok(result.diagnostics.rejectedCandidateWalls > 0, "non-structural candidate walls should be rejected");
    assert.ok(result.summary.total >= 12 && result.summary.total <= 40, `sample page 1 should produce structural walls only, got ${result.summary.total}`);
    assert.ok(result.summary.exterior >= 2, "sample should classify some perimeter-adjacent walls as exterior");
    assert.ok(result.summary.interior >= 8, "sample should keep connected interior structural walls");
  } else {
    console.warn(`Skipping real sample wall-object detection test; copy it to ${localSamplePath} or set TAKEOFF_SAMPLE_PLANS_PDF.`);
  }
}

function makeImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function darkPixel(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const idx = (y * image.width + x) * 4;
  image.data[idx] = 0;
  image.data[idx + 1] = 0;
  image.data[idx + 2] = 0;
  image.data[idx + 3] = 255;
}

function drawH(image, x1, x2, y, thickness = 1) {
  for (let x = x1; x <= x2; x += 1) {
    for (let dy = 0; dy < thickness; dy += 1) darkPixel(image, x, y + dy);
  }
}

function drawV(image, x, y1, y2, thickness = 1) {
  for (let y = y1; y <= y2; y += 1) {
    for (let dx = 0; dx < thickness; dx += 1) darkPixel(image, x + dx, y);
  }
}

function fakeCanvas(image) {
  return {
    width: image.width,
    height: image.height,
    getContext: () => ({
      getImageData: () => image,
    }),
  };
}

function rasterTestViewport(rotation, sourceWidth = 320, sourceHeight = 220) {
  const sideways = rotation === 90 || rotation === 270;
  return {
    width: sideways ? sourceHeight : sourceWidth,
    height: sideways ? sourceWidth : sourceHeight,
    convertToViewportPoint: (x, y) => {
      if (rotation === 90) return [sourceHeight - y, x];
      if (rotation === 180) return [sourceWidth - x, sourceHeight - y];
      if (rotation === 270) return [y, sourceWidth - x];
      return [x, y];
    },
    convertToPdfPoint: (x, y) => {
      if (rotation === 90) return [y, sourceHeight - x];
      if (rotation === 180) return [sourceWidth - x, sourceHeight - y];
      if (rotation === 270) return [sourceWidth - y, x];
      return [x, y];
    },
  };
}

// ---- local raster fallback detects one horizontal wall band end to end ----
{
  const image = makeImage(320, 180);
  drawH(image, 40, 130, 80);
  drawH(image, 165, 280, 80);
  drawH(image, 40, 130, 90);
  drawH(image, 165, 280, 90);
  drawV(image, 40, 70, 105);
  drawV(image, 280, 70, 105);
  drawV(image, 130, 80, 90);
  drawV(image, 165, 80, 90);
  const result = findRasterWallBandInImage({ image, pointer: { x: 150, y: 85 } });
  assert.ok(result.wall, "hover inside a window interruption should still resolve the same raster wall");
  assert.equal(Math.round(result.wall.centreline.start.x), 40);
  assert.equal(Math.round(result.wall.centreline.end.x), 280);
  assert.equal(Math.round(result.wall.centreline.start.y), 85);
}

// ---- local raster fallback detects a vertical wall band -------------------
{
  const image = makeImage(220, 320);
  drawV(image, 90, 40, 280);
  drawV(image, 102, 40, 280);
  drawH(image, 78, 114, 40);
  drawH(image, 78, 114, 280);
  const result = findRasterWallBandInImage({ image, pointer: { x: 96, y: 150 } });
  assert.ok(result.wall, "vertical raster wall should resolve");
  assert.equal(Math.round(result.wall.centreline.start.x), 96);
  assert.equal(Math.round(result.wall.centreline.start.y), 40);
  assert.equal(Math.round(result.wall.centreline.end.y), 280);
}

// ---- local raster fallback rejects dimension chains and blank space -------
{
  const image = makeImage(320, 180);
  drawH(image, 40, 280, 40);
  drawH(image, 40, 280, 52);
  [60, 95, 130, 165, 200, 235, 270].forEach((x) => drawV(image, x, 40, 52));
  const dimension = findRasterWallBandInImage({ image, pointer: { x: 150, y: 46 } });
  assert.equal(dimension.wall, null, "repeated dimension ticks must not become a wall");
  const blank = findRasterWallBandInImage({ image, pointer: { x: 150, y: 120 } });
  assert.equal(blank.wall, null, "blank space must not jump to distant geometry");
}

// ---- raster canvas wrapper uses the displayed rotation exactly once -------
{
  const point = { x: 72, y: 48 };
  [0, 90, 180, 270].forEach((rotation) => {
    const viewport = rasterTestViewport(rotation);
    const image = makeImage(viewport.width, viewport.height);
    const result = findRasterWallBandOnCanvas({ canvas: fakeCanvas(image), viewport, point });
    const [expectedX, expectedY] = viewport.convertToViewportPoint(point.x, point.y);
    assert.equal(Math.round(result.diagnostics.pointerImage.x), Math.round(expectedX), `rotation ${rotation} pointer x`);
    assert.equal(Math.round(result.diagnostics.pointerImage.y), Math.round(expectedY), `rotation ${rotation} pointer y`);
  });
}

console.log("wallDrawing.test.mjs passed");
