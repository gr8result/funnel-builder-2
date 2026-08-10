import assert from "node:assert/strict";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import {
  buildTraceGraphFromPlanGeometry,
  detectExteriorFromTraceGraph,
  manualTraceCanSnapTo,
  selectExteriorStartNode,
  walkExteriorBoundary,
} from "../takeoff/traceGraph.js";

function line(id, a, b) {
  return { id, a, b, start: a, end: b, length: Math.hypot(b.x - a.x, b.y - a.y), source: "vector", axis: Math.abs(a.y - b.y) < 0.1 ? "horizontal" : "vertical" };
}

function indexFor(segments) {
  return buildPlanGeometryIndex(segments, { pageWidth: 300, pageHeight: 300, pageId: "test" });
}

const rectangle = [
  line("top", { x: 20, y: 20 }, { x: 180, y: 20 }),
  line("right", { x: 180, y: 20 }, { x: 180, y: 140 }),
  line("bottom", { x: 180, y: 140 }, { x: 20, y: 140 }),
  line("left", { x: 20, y: 140 }, { x: 20, y: 20 }),
  line("internal-branch", { x: 80, y: 20 }, { x: 80, y: 100 }),
];

{
  const index = indexFor(rectangle);
  const graph = buildTraceGraphFromPlanGeometry(index);
  assert.ok(graph.nodes.length >= 5, "trace graph should expose explicit corner/branch nodes");
  assert.ok(graph.edges.length >= 5, "trace graph should expose adjacency edges");
  const branchNode = graph.nodes.find((node) => Math.abs(node.point.x - 80) < 3 && Math.abs(node.point.y - 20) < 3);
  assert.ok(branchNode?.connectedEdgeIds.length >= 3, "interior branch should be explicit adjacency, not hidden");

  const start = selectExteriorStartNode(graph);
  assert.ok(start, "deterministic start node should be selected");
  assert.deepEqual(start.point, { x: 20, y: 20 }, "start node should be the upper-left exterior corner");

  const walked = walkExteriorBoundary(graph, { planGeometryIndex: index });
  assert.equal(walked.ok, true, "clockwise outside-face traversal should close the rectangle");
  assert.equal(walked.loop.points.length, 4, "internal branch must be rejected from the exterior loop");
  assert.equal(walked.loop.bridgedGaps.length, 0, "solid rectangle should have no gaps");
  walked.loop.edges.forEach((edge, edgeIndex) => {
    assert.equal(
      manualTraceCanSnapTo({
        a: walked.loop.points[edgeIndex],
        b: walked.loop.points[(edgeIndex + 1) % walked.loop.points.length],
        lineIds: edge.lineIds,
        bridgedGapLength: edge.bridgedGapLength,
      }, { planGeometryIndex: index }),
      true,
      "every automatic edge must be reachable by manual trace snapping"
    );
  });
}

{
  const opened = [
    line("top-a", { x: 20, y: 20 }, { x: 94, y: 20 }),
    line("top-b", { x: 102, y: 20 }, { x: 180, y: 20 }),
    line("right", { x: 180, y: 20 }, { x: 180, y: 140 }),
    line("bottom", { x: 180, y: 140 }, { x: 20, y: 140 }),
    line("left", { x: 20, y: 140 }, { x: 20, y: 20 }),
  ];
  const index = indexFor(opened);
  const result = detectExteriorFromTraceGraph({ planGeometryIndex: index });
  assert.equal(result.useful, true, "small compatible opening should be bridged");
  assert.equal(result.exteriorPerimeter.bridgedGaps.length, 1, "small opening bridge should be recorded");
  assert.equal(result.exteriorPerimeter.selfIntersectionCount, 0, "bridged loop must not self-intersect");
  assert.ok(result.diagnostics.manualTraceProof.every((item) => item.manualTraceable), "bridged auto result must still prove trace snap reachability");
}

{
  const largeGap = [
    line("top-a", { x: 20, y: 20 }, { x: 70, y: 20 }),
    line("top-b", { x: 105, y: 20 }, { x: 180, y: 20 }),
    line("right", { x: 180, y: 20 }, { x: 180, y: 140 }),
    line("bottom", { x: 180, y: 140 }, { x: 20, y: 140 }),
    line("left", { x: 20, y: 140 }, { x: 20, y: 20 }),
  ];
  const result = detectExteriorFromTraceGraph({ planGeometryIndex: indexFor(largeGap) });
  assert.equal(result.useful, false, "large blank gap must reject automatic exterior");
  assert.equal(result.exteriorPerimeter, null, "large gap must not render a partial fake perimeter");
}

{
  const bowTie = [
    line("top", { x: 20, y: 20 }, { x: 180, y: 20 }),
    line("right", { x: 180, y: 20 }, { x: 180, y: 140 }),
    line("bottom", { x: 180, y: 140 }, { x: 20, y: 140 }),
    line("left", { x: 20, y: 140 }, { x: 20, y: 20 }),
    line("cross-a", { x: 20, y: 20 }, { x: 180, y: 140 }),
    line("cross-b", { x: 180, y: 20 }, { x: 20, y: 140 }),
  ];
  const graph = buildTraceGraphFromPlanGeometry(indexFor(bowTie));
  const walked = walkExteriorBoundary(graph, { planGeometryIndex: indexFor(bowTie) });
  assert.equal(walked.ok, true, "outer face can still close when self-intersecting internal lines exist");
  assert.equal(walked.loop.points.length, 4, "self-intersecting internal branches must be rejected");
}

console.log("traceGraph.test.mjs passed");
