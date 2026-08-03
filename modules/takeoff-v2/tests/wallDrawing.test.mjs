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
import { detectWallObjects } from "../takeoff/wallObjectDetection.js";
import { findHighlightableWallAtPoint } from "../takeoff/localWallHighlighter.js";

const lastPoint = { x: 0, y: 0 };

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

// ---- manual trace places raw point when no close snap exists ---------------
{
  const raw = { x: 220.25, y: 118.75 };
  const result = resolveManualTracePoint(raw);
  assert.deepEqual(result.point, raw);
  assert.equal(result.snap, null);
}

// ---- close local corner snaps, distant/line candidates do not --------------
{
  const raw = { x: 100, y: 100 };
  const closeCorner = { type: "intersection", point: { x: 102, y: 99 }, distance: 2 };
  assert.deepEqual(resolveManualTracePoint(raw, { snapCandidate: closeCorner }).point, closeCorner.point);
  const lineCandidate = { type: "line", point: { x: 100, y: 80 }, distance: 1 };
  assert.deepEqual(resolveManualTracePoint(raw, { snapCandidate: lineCandidate }).point, raw);
  assert.deepEqual(resolveManualTracePoint(raw, { snapCandidate: closeCorner, disableSnap: true }).point, raw);
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
  const result = resolveManualTracePoint(raw, { lastVertex: last, rotation: 0 });
  assert.deepEqual(result.point, { x: 100, y: 0 });
  const free = resolveManualTracePoint({ x: 100, y: 20 }, { lastVertex: last, rotation: 0 });
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
  assert.ok(overlay.includes("const strokeWidth = selected ? 3 : hovered ? 3 : 3"), "selected exterior highlight should render near 3px");
  assert.ok(overlay.includes('data-testid="exterior-highlight-junction-hit-area"'), "exterior junction hit area should remain separate");
  assert.ok(overlay.includes("r={10} fill=\"transparent\""), "exterior/area hit radius should remain easy to grab");
  assert.ok(overlay.includes("r={i === 0 ? 3.8 : 3.2}"), "area point visible radius should be reduced");
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

console.log("wallDrawing.test.mjs passed");
