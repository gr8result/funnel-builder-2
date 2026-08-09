import assert from "node:assert/strict";
import { buildSnapCandidates, findNearestSnapPoint, snapPoint } from "../takeoff/snapping.js";

const rectanglePage = {
  exteriorWalls: {
    vertices: [
      { id: "v1", x: 0, y: 0 },
      { id: "v2", x: 10, y: 0 },
      { id: "v3", x: 10, y: 10 },
      { id: "v4", x: 0, y: 10 },
    ],
    segments: [
      { id: "s1", aId: "v1", bId: "v2" },
      { id: "s2", aId: "v2", bId: "v3" },
      { id: "s3", aId: "v3", bId: "v4" },
      { id: "s4", aId: "v4", bId: "v1" },
    ],
  },
  measurements: [],
};

const candidates = buildSnapCandidates(rectanglePage);
assert.equal(candidates.filter((c) => c.kind === "vertex").length, 4);
assert.equal(candidates.filter((c) => c.kind === "intersection").length, 0);

const near = findNearestSnapPoint({ x: 0.2, y: 0.1 }, candidates, 1);
assert.ok(near);
assert.equal(near.x, 0);
assert.equal(near.y, 0);

assert.equal(findNearestSnapPoint({ x: 5, y: 5 }, candidates, 1), null);

// excludeVertexId omits the vertex currently being dragged
const withoutV1 = buildSnapCandidates(rectanglePage, { excludeVertexId: "v1" });
assert.equal(withoutV1.some((c) => c.refId === "v1"), false);

// Segment intersections are discovered from any segments (walls or measurements)
const crossingPage = {
  exteriorWalls: { vertices: [], segments: [] },
  measurements: [
    { pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 10 } },
    { pointA: { x: 0, y: 10 }, pointB: { x: 10, y: 0 } },
  ],
};
const crossCandidates = buildSnapCandidates(crossingPage);
const intersection = crossCandidates.find((c) => c.kind === "intersection");
assert.ok(intersection);
assert.ok(Math.abs(intersection.x - 5) < 1e-9);
assert.ok(Math.abs(intersection.y - 5) < 1e-9);

// snapPoint converts a screen-pixel tolerance to page-space via zoomScale
const snappedNear = snapPoint({ x: 0.05, y: 0.05 }, candidates, { toleranceScreenPx: 10, zoomScale: 1 });
assert.equal(snappedNear.snappedTo.kind, "vertex");
assert.deepEqual(snappedNear.point, { x: 0, y: 0 });

const snappedFar = snapPoint({ x: 50, y: 50 }, candidates, { toleranceScreenPx: 10, zoomScale: 1 });
assert.equal(snappedFar.snappedTo, null);
assert.deepEqual(snappedFar.point, { x: 50, y: 50 });

// Higher zoom shrinks the effective page-space tolerance
const snappedAtHighZoom = snapPoint({ x: 0.5, y: 0.5 }, candidates, { toleranceScreenPx: 10, zoomScale: 100 });
assert.equal(snappedAtHighZoom.snappedTo, null);

console.log("snapping.test.mjs passed");
