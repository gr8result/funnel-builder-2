import assert from "node:assert/strict";
import { buildPlanGeometryIndex } from "../../takeoff-v2/geometry/planGeometryIndex.js";
import { detectExteriorFromTraceGraph, manualTraceCanSnapTo } from "../../takeoff-v2/takeoff/traceGraph.js";
import { createV3TraceDiagnostics } from "../core/traceDiagnostics.js";

function seg(id, a, b, extra = {}) {
  return { id, a, b, ...extra };
}

function runFixture(segments, page = { sourceWidth: 500, sourceHeight: 500 }) {
  const planGeometryIndex = buildPlanGeometryIndex(segments, {
    pageWidth: page.sourceWidth,
    pageHeight: page.sourceHeight,
    source: "test-vector",
  });
  const started = performance.now();
  const result = detectExteriorFromTraceGraph({ planGeometryIndex, page });
  const diagnostics = createV3TraceDiagnostics({ planGeometryIndex, detectorResult: result, runtimeMs: performance.now() - started });
  return { planGeometryIndex, result, diagnostics };
}

const rectangle = [
  seg("top", { x: 100, y: 100 }, { x: 300, y: 100 }),
  seg("right", { x: 300, y: 100 }, { x: 300, y: 280 }),
  seg("bottom", { x: 300, y: 280 }, { x: 100, y: 280 }),
  seg("left", { x: 100, y: 280 }, { x: 100, y: 100 }),
];

const basic = runFixture(rectangle);
assert.equal(basic.planGeometryIndex.lines.length, 4, "traceable segments come from manual snap geometry");
assert.equal(basic.result.useful, true, "closed trace graph produces exterior candidate");
assert.equal(basic.result.exteriorPerimeter.closed, true, "candidate is closed");
assert.equal(basic.result.exteriorPerimeter.selfIntersectionCount, 0, "candidate is not self-intersecting");
assert.equal(basic.diagnostics.unsupportedEdges, 0, "automatic exterior has no unsupported edges");
assert.equal(basic.diagnostics.finalExteriorEdges, basic.result.segments.length, "final edge count is reported");
assert.ok(basic.diagnostics.graphNodes >= 4, "graph node count is reported");
assert.ok(basic.diagnostics.connectedComponents >= 1, "connected component count is reported");
assert.ok(basic.result.diagnostics.manualTraceProof.every((proof) => proof.manualTraceValidation === "PASS"), "every automatic edge has manual trace proof");

basic.result.diagnostics.finalLoop.edges.forEach((edge, index) => {
  assert.equal(manualTraceCanSnapTo({
    a: edge.from,
    b: edge.to,
    lineIds: edge.lineIds,
    bridgedGapLength: edge.bridgedGapLength,
  }, { planGeometryIndex: basic.planGeometryIndex }), true, `final loop edge ${index + 1} is manual-traceable`);
});

const withGarageRecess = runFixture([
  seg("a", { x: 80, y: 80 }, { x: 320, y: 80 }),
  seg("b", { x: 320, y: 80 }, { x: 320, y: 180 }),
  seg("c", { x: 320, y: 180 }, { x: 380, y: 180 }),
  seg("garage", { x: 380, y: 180 }, { x: 380, y: 280 }),
  seg("d", { x: 380, y: 280 }, { x: 260, y: 280 }),
  seg("recess-return", { x: 260, y: 280 }, { x: 260, y: 330 }),
  seg("e", { x: 260, y: 330 }, { x: 80, y: 330 }),
  seg("f", { x: 80, y: 330 }, { x: 80, y: 80 }),
  seg("internal-branch", { x: 170, y: 80 }, { x: 170, y: 330 }),
]);
assert.equal(withGarageRecess.result.useful, true, "garage/recess shape remains detectable");
assert.ok(withGarageRecess.result.exteriorPerimeter.points.some((point) => point.x === 380), "garage projection is included");
assert.ok(withGarageRecess.result.exteriorPerimeter.points.some((point) => point.x === 260 && point.y === 330), "recess return is preserved");
assert.equal(withGarageRecess.diagnostics.unsupportedEdges, 0, "garage/recess result has no unsupported edges");

const annotationRejected = runFixture([
  ...rectangle,
  seg("dimension", { x: 20, y: 20 }, { x: 460, y: 20 }, { geometryType: "dimension-line" }),
  seg("title", { x: 20, y: 450 }, { x: 460, y: 450 }, { geometryType: "title-block-rule" }),
]);
assert.equal(annotationRejected.planGeometryIndex.lines.some((line) => line.id === "dimension"), false, "dimension annotations are not traceable segments");
assert.equal(annotationRejected.planGeometryIndex.lines.some((line) => line.id === "title"), false, "title-block rules are not traceable segments");
assert.equal(annotationRejected.result.useful, true, "annotation rejection does not prevent exterior detection");

const branchOnly = runFixture([
  ...rectangle,
  seg("branch", { x: 300, y: 180 }, { x: 390, y: 180 }),
]);
assert.equal(branchOnly.result.useful, true, "internal branch does not prevent exterior detection");
assert.equal(branchOnly.result.diagnostics.finalLoop.edges.some((edge) => edge.lineIds?.includes("branch")), false, "internal branch is rejected from final perimeter");

console.log("takeoff-v3 traceDiagnostics.test.mjs passed");
