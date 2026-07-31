import assert from "node:assert/strict";
import { softAxisSnap } from "../takeoff/wallDrawing.js";
import { tracedSegmentHasWallEvidence, validateEditedExteriorGraph, snapLabelForCandidate } from "../hooks/useTakeoffTools.js";
import { cursorForPlanViewer } from "../viewer/planViewerCursor.js";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { screenToPagePoint } from "../viewer/screenToPagePoint.js";
import { createWallSegment, createWallVertex } from "../types.js";
import { deleteVertexAndReconnect, splitSegment } from "../takeoff/wallGraph.js";
import { appendDetectedWallToExteriorGraph, buildDetectedWalls, connectedWallSuggestions, findWallUnderPointer, orderedPathPoints } from "../takeoff/wallSelection.js";

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

let lineSeq = 0;
function line(a, b, extra = {}) {
  lineSeq += 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    id: `proposal-line-${lineSeq}`,
    source: "vector",
    stroked: true,
    strokeColor: "#000000",
    axis: Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical",
    a,
    b,
    length: Math.hypot(dx, dy),
    ...extra,
  };
}

function rectBands(x1, y1, x2, y2, thickness = 8) {
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

// ---- click near wall selects full wall from junction to junction -----------
{
  const walls = buildDetectedWalls({
    source: "fixture",
    segments: [...rectBands(100, 100, 360, 280), ...rectBands(360, 160, 450, 280)],
  }, { sourceWidth: 500, sourceHeight: 400 });
  const hit = findWallUnderPointer({ x: 230, y: 104 }, { walls, zoomScale: 1 });
  assert.ok(hit, "expected click near wall face to select a wall");
  assert.equal(hit.wall.orientation, 0);
  assert.ok(hit.wall.centreline.start.x <= 110);
  assert.ok(hit.wall.centreline.end.x >= 350);
  assert.equal(hit.wall.source, "pdf-vector");
}

// ---- angled vector wall faces are selectable as one wall ------------------
{
  const walls = buildDetectedWalls({
    source: "fixture",
    segments: [
      line({ x: 100, y: 100 }, { x: 260, y: 180 }),
      line({ x: 96.4, y: 107.2 }, { x: 256.4, y: 187.2 }),
    ],
  }, { sourceWidth: 500, sourceHeight: 400 });
  const hit = findWallUnderPointer({ x: 178, y: 142 }, { walls, zoomScale: 1 });
  assert.ok(hit, "expected click near angled wall face to select a wall");
  assert.ok(Math.abs(hit.wall.orientation - 26.6) < 1);
  assert.ok(hit.wall.length > 170);
}

// ---- rejected annotation geometry is not selectable -----------------------
{
  const walls = buildDetectedWalls({
    source: "fixture",
    segments: [...rectBands(100, 100, 360, 280), ...rectBands(360, 160, 450, 280)],
  }, { sourceWidth: 500, sourceHeight: 400 });
  const rejected = buildDetectedWalls({
    source: "fixture",
    segments: [
      line({ x: 10, y: 10 }, { x: 490, y: 10 }, { isPageBorder: true }),
      line({ x: 80, y: 40 }, { x: 420, y: 40 }, { isDimension: true }),
      line({ x: 80, y: 48 }, { x: 420, y: 48 }, { isDimension: true }),
      line({ x: 20, y: 350 }, { x: 240, y: 350 }, { classification: "title-block-rule" }),
      line({ x: 20, y: 358 }, { x: 240, y: 358 }, { classification: "title-block-rule" }),
    ],
  }, { sourceWidth: 500, sourceHeight: 400 });
  assert.ok(walls.length > 0);
  assert.equal(rejected.length, 0);
}

// ---- path appends only local connected walls and rejects distant jumps -----
{
  const walls = buildDetectedWalls({
    source: "fixture",
    segments: rectBands(100, 100, 300, 250),
  }, { sourceWidth: 500, sourceHeight: 400 });
  const first = findWallUnderPointer({ x: 160, y: 104 }, { walls });
  const second = connectedWallSuggestions(first.wall.centreline.end, { walls, selectedWalls: [first.wall] })[0];
  assert.ok(second, "expected one local next-wall suggestion");
  const firstAppend = appendDetectedWallToExteriorGraph(null, first.wall);
  assert.equal(firstAppend.accepted, true);
  const secondAppend = appendDetectedWallToExteriorGraph(firstAppend.graph, second.wall);
  assert.equal(secondAppend.accepted, true);
  const distant = {
    ...first.wall,
    id: "distant",
    centreline: { start: { x: 900, y: 900 }, end: { x: 1000, y: 900 } },
  };
  const rejected = appendDetectedWallToExteriorGraph(secondAppend.graph, distant);
  assert.equal(rejected.accepted, false);
}

// ---- ordered path closes cleanly -----------------------------------------
{
  const walls = buildDetectedWalls({
    source: "fixture",
    segments: rectBands(100, 100, 300, 250),
  }, { sourceWidth: 500, sourceHeight: 400 });
  let graph = null;
  let current = findWallUnderPointer({ x: 160, y: 104 }, { walls }).wall;
  for (let i = 0; i < 4; i += 1) {
    const result = appendDetectedWallToExteriorGraph(graph, current);
    assert.equal(result.accepted, true);
    graph = result.graph;
    const suggestions = connectedWallSuggestions(result.activeEndpoint, {
      walls,
      selectedWalls: walls.filter((wall) => graph.segments.some((segment) => segment.detectedWallId === wall.id)),
    });
    current = suggestions[0]?.wall;
    if (!current) break;
  }
  assert.equal(graph.isClosed, true);
  assert.equal(orderedPathPoints(graph).length, 4);
}

console.log("wallDrawing.test.mjs passed");
