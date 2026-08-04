import assert from "node:assert/strict";
import { createWallSegment } from "../types.js";
import { assessExteriorDetectionGraph } from "../takeoff/wallDetectionQuality.js";

const vertices = [
  { id: "a", x: 0, y: 0 },
  { id: "b", x: 100, y: 0 },
  { id: "c", x: 220, y: 10 },
  { id: "d", x: 300, y: 10 },
  { id: "e", x: 20, y: 180 },
  { id: "f", x: 120, y: 180 },
];
const isolatedThree = [
  createWallSegment({ id: "s1", aId: "a", bId: "b", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "s2", aId: "c", bId: "d", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "s3", aId: "e", bId: "f", source: "automatic", confidence: "high" }),
];

{
  const quality = assessExteriorDetectionGraph(vertices, isolatedThree, 0.85);
  assert.equal(quality.useful, false);
  assert.equal(quality.connectedComponents, 3);
  assert.ok(quality.completeness < 50, `expected low completeness, got ${quality.completeness}`);
  assert.ok(quality.confidence < 85, `overall confidence must be downgraded, got ${quality.confidence}`);
  assert.ok(quality.warnings.some((warning) => warning.includes("No usable perimeter created")));
}

const perimeterVertices = [
  { id: "p1", x: 0, y: 0 },
  { id: "p2", x: 100, y: 0 },
  { id: "p3", x: 160, y: 40 },
  { id: "p4", x: 160, y: 120 },
  { id: "p5", x: 80, y: 180 },
  { id: "p6", x: 0, y: 120 },
];
const coherentPerimeter = [
  createWallSegment({ id: "p1", aId: "p1", bId: "p2", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "p2", aId: "p2", bId: "p3", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "p3", aId: "p3", bId: "p4", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "p4", aId: "p4", bId: "p5", source: "automatic", confidence: "medium" }),
  createWallSegment({ id: "p5", aId: "p5", bId: "p6", source: "automatic", confidence: "high" }),
  createWallSegment({ id: "p6", aId: "p6", bId: "p1", source: "automatic", confidence: "high" }),
];

{
  const quality = assessExteriorDetectionGraph(perimeterVertices, coherentPerimeter, 0.9);
  assert.equal(quality.useful, true);
  assert.equal(quality.connectedComponents, 1);
  assert.equal(quality.isClosed, true);
  assert.equal(quality.completeness, 100);
  assert.ok(quality.confidence >= 85);
}

console.log("wallDetectionQuality.test.mjs passed");
