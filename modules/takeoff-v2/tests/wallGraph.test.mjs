import assert from "node:assert/strict";
import {
  buildWallGraphFromPolylines,
  isPerimeterClosed,
  hasDisconnectedSegments,
  orderedPerimeterPoints,
  findOpenEndpoints,
  moveVertex,
  closePerimeter,
  addSegment,
  splitSegment,
  changeSegmentWallType,
  setSegmentThickness,
  segmentToWallSegment,
  sumSegmentLengthsMm,
} from "../takeoff/wallGraph.js";

// Simple rectangle
{
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  assert.equal(graph.vertices.length, 4);
  assert.equal(graph.segments.length, 4);
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), true);
}

// L-shaped plan
{
  const pts = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 },
  ];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  assert.equal(graph.vertices.length, 6);
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), true);
  assert.equal(orderedPerimeterPoints(graph.vertices, graph.segments).length, 6);
}

// Recessed entry (concave notch)
{
  const pts = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 8 },
    { x: 4, y: 8 }, { x: 4, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 },
  ];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), true);
}

// Garage projection (rectangular bump on one side)
{
  const pts = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 14, y: 5 }, { x: 14, y: 9 },
    { x: 10, y: 9 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 },
  ];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), true);
}

// Missing segment: chain never closes back on itself
{
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), false);
  assert.equal(findOpenEndpoints(graph.vertices, graph.segments).length, 2);

  const { graph: closed, closed: didClose } = closePerimeter(graph, 50);
  assert.equal(didClose, true);
  assert.equal(isPerimeterClosed(closed.vertices, closed.segments), true);
}

// A stray disconnected segment (e.g. an internal wall wrongly mixed into the
// exterior set) must be flagged, not silently included in the perimeter.
{
  const rectangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  const stray = { points: [{ x: 20, y: 20 }, { x: 25, y: 20 }] };
  const graph = buildWallGraphFromPolylines([{ points: rectangle }, stray], { tolerance: 0.5 });
  assert.equal(hasDisconnectedSegments(graph.vertices, graph.segments), true);
  assert.equal(isPerimeterClosed(graph.vertices, graph.segments), false);
}

// Manual point adjustment keeps the perimeter closed
{
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  const graph = buildWallGraphFromPolylines([{ points: pts }], { tolerance: 0.5 });
  const vertex = graph.vertices[0];
  const moved = moveVertex(graph, vertex.id, { x: 1, y: 1 });
  const updated = moved.vertices.find((v) => v.id === vertex.id);
  assert.equal(updated.x, 1);
  assert.equal(updated.y, 1);
  assert.equal(isPerimeterClosed(moved.vertices, moved.segments), true);
}

// segmentToWallSegment derives start/end/lengthMm from the vertex graph +
// calibration, and carries the spec-shaped wall fields.
{
  const graph = { vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 300, y: 0 }], segments: [] };
  const segment = { id: "s1", aId: "a", bId: "b", wallType: "internal", thicknessMm: 90, source: "manual", confirmed: true, confidence: null };
  const view = segmentToWallSegment(graph, segment, 10); // 10mm per doc unit
  assert.deepEqual(view.start, { x: 0, y: 0 });
  assert.deepEqual(view.end, { x: 300, y: 0 });
  assert.equal(view.lengthMm, 3000);
  assert.equal(view.wallType, "internal");
  assert.equal(view.thicknessMm, 90);
  assert.equal(view.confirmed, true);
}

// sumSegmentLengthsMm totals every segment regardless of connectivity (an
// open chain, unlike calculatePerimeterMm which requires a closed perimeter).
{
  const vertices = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }, { id: "c", x: 100, y: 40 }];
  const segments = [{ id: "s1", aId: "a", bId: "b" }, { id: "s2", aId: "b", bId: "c" }];
  assert.equal(sumSegmentLengthsMm(vertices, segments, 10), 1400); // (100 + 40) * 10
}

// addSegment records the requested wallType; splitSegment/changeSegmentWallType/
// setSegmentThickness preserve or update it correctly.
{
  let graph = { vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }], segments: [] };
  graph = addSegment(graph, "a", "b", { wallType: "internal", thicknessMm: 110 });
  assert.equal(graph.segments[0].wallType, "internal");
  assert.equal(graph.segments[0].thicknessMm, 110);

  const split = splitSegment(graph, graph.segments[0].id, { x: 50, y: 0 });
  assert.equal(split.segments.length, 2);
  assert.ok(split.segments.every((s) => s.wallType === "internal" && s.thicknessMm === 110));

  const retyped = changeSegmentWallType(graph, graph.segments[0].id, "exterior");
  assert.equal(retyped.segments[0].wallType, "exterior");

  const rethickened = setSegmentThickness(graph, graph.segments[0].id, 200);
  assert.equal(rethickened.segments[0].thicknessMm, 200);
}

// closePerimeter rejects a close that would self-intersect: a chain shaped
// like an open "bowtie" (A-B-C-D with A/D as the two open ends) where the
// straight closing segment A-D crosses the unrelated middle segment B-C.
{
  const vertices = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 10, y: 0 },
    { id: "c", x: 0, y: 10 },
    { id: "d", x: 10, y: 10 },
  ];
  const segments = [
    { id: "s1", aId: "a", bId: "b", wallType: "exterior", thicknessMm: null, source: "manual", confirmed: true, confidence: null },
    { id: "s2", aId: "b", bId: "c", wallType: "exterior", thicknessMm: null, source: "manual", confirmed: true, confidence: null },
    { id: "s3", aId: "c", bId: "d", wallType: "exterior", thicknessMm: null, source: "manual", confirmed: true, confidence: null },
  ];
  const graph = { vertices, segments };
  assert.equal(findOpenEndpoints(graph.vertices, graph.segments).length, 2);

  const result = closePerimeter(graph, Infinity);
  assert.equal(result.closed, false);
  assert.equal(result.reason, "The perimeter cannot be closed because two wall segments intersect.");
  assert.equal(result.graph.segments.length, 3); // untouched — no invalid segment added
}

console.log("wallGraph.test.mjs passed");
