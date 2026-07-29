import assert from "node:assert/strict";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { findSnapCandidates, bestSnapCandidate } from "../takeoff/planSnap.js";

const planGeometryIndex = buildPlanGeometryIndex([
  { id: "wall-1", a: { x: 0, y: 100 }, b: { x: 200, y: 100 }, axis: "horizontal" },
]);

const page = {
  exteriorWalls: {
    vertices: [{ id: "wv1", x: 300, y: 300 }, { id: "wv2", x: 400, y: 300 }],
    segments: [{ id: "ws1", aId: "wv1", bId: "wv2" }],
  },
  measurements: [],
};

// ---- plan-geometry candidate wins when nearest ---------------------------
{
  const candidates = findSnapCandidates({ x: 50, y: 101 }, { toleranceScreenPx: 10, zoomScale: 1, planGeometryIndex, page });
  assert.equal(candidates[0].type, "line");
  assert.equal(candidates[0].point.y, 100);
}

// ---- page-state (wall vertex) candidate surfaces as an endpoint ----------
{
  const candidates = findSnapCandidates({ x: 300.4, y: 300.2 }, { toleranceScreenPx: 10, zoomScale: 1, planGeometryIndex, page });
  assert.equal(candidates[0].type, "endpoint");
  assert.equal(candidates[0].lineId, "wv1");
}

// ---- merge + priority: an intersection from plan geometry still wins over
//      a slightly-closer plain endpoint from page state -------------------
{
  const crossingIndex = buildPlanGeometryIndex([
    { id: "h", a: { x: 0, y: 500 }, b: { x: 1000, y: 500 }, axis: "horizontal" },
    { id: "v", a: { x: 500, y: 0 }, b: { x: 500, y: 1000 }, axis: "vertical" },
  ]);
  const nearIntersectionPage = { exteriorWalls: { vertices: [{ id: "wv9", x: 500.05, y: 500 }], segments: [] }, measurements: [] };
  const candidates = findSnapCandidates({ x: 500, y: 500 }, { toleranceScreenPx: 10, zoomScale: 1, planGeometryIndex: crossingIndex, page: nearIntersectionPage });
  assert.equal(candidates[0].type, "intersection");
}

// ---- bestSnapCandidate returns null when nothing is in range -------------
{
  const result = bestSnapCandidate({ x: 9000, y: 9000 }, { toleranceScreenPx: 10, zoomScale: 1, planGeometryIndex, page });
  assert.equal(result, null);
}

// ---- zoom widens/narrows the effective tolerance --------------------------
{
  const farFromLine = { x: 50, y: 106 }; // 6 doc-units from the line at zoom 1
  const atLowZoom = bestSnapCandidate(farFromLine, { toleranceScreenPx: 10, zoomScale: 1, planGeometryIndex, page });
  const atHighZoom = bestSnapCandidate(farFromLine, { toleranceScreenPx: 10, zoomScale: 5, planGeometryIndex, page });
  assert.ok(atLowZoom); // 10px tolerance / zoom 1 = 10 doc units, covers 6
  assert.equal(atHighZoom, null); // 10px / zoom 5 = 2 doc units, doesn't cover 6
}

console.log("planSnap.test.mjs passed");
