import assert from "node:assert/strict";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";

// A simple "L" of two segments meeting at (100,100), plus a third, far-away
// segment to prove distant geometry never shows up as a candidate.
const segments = [
  { id: "h1", a: { x: 0, y: 100 }, b: { x: 100, y: 100 }, axis: "horizontal" },
  { id: "v1", a: { x: 100, y: 100 }, b: { x: 100, y: 300 }, axis: "vertical" },
  { id: "far", a: { x: 900, y: 900 }, b: { x: 1000, y: 900 }, axis: "horizontal" },
];

const index = buildPlanGeometryIndex(segments);

// ---- endpoint/intersection coincide at the corner: intersection ranks first
{
  const candidates = index.findSnapCandidates({ x: 100.4, y: 99.7 }, 5);
  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].type, "intersection");
  assert.equal(candidates[0].point.x, 100);
  assert.equal(candidates[0].point.y, 100);
  assert.deepEqual([...candidates[0].lineIds].sort(), ["h1", "v1"]);
}

// ---- a point near a plain endpoint (no intersection there) ---------------
{
  const candidates = index.findSnapCandidates({ x: 0.5, y: 100.2 }, 5);
  assert.equal(candidates[0].type, "endpoint");
  assert.deepEqual(candidates[0].point, { x: 0, y: 100 });
  assert.equal(candidates[0].lineId, "h1");
}

// ---- nearest-point-on-line when not near any endpoint/intersection -------
{
  const candidates = index.findSnapCandidates({ x: 50, y: 102 }, 5);
  assert.equal(candidates[0].type, "line");
  assert.equal(candidates[0].point.x, 50);
  assert.equal(candidates[0].point.y, 100);
  assert.equal(candidates[0].lineId, "h1");
}

// ---- no valid snap target within tolerance --------------------------------
{
  const candidates = index.findSnapCandidates({ x: 500, y: 500 }, 5);
  assert.deepEqual(candidates, []);
}

// ---- tolerance is expressed in document units by the caller — the index
//      itself doesn't know about zoom, but a smaller effective tolerance
//      (as a caller would pass at high zoom) narrows/expands results --------
{
  const tight = index.findSnapCandidates({ x: 50, y: 100.4 }, 0.1);
  const loose = index.findSnapCandidates({ x: 50, y: 100.4 }, 1);
  assert.equal(tight.length, 0);
  assert.equal(loose.length, 1);
}

// ---- getCandidateWallSegments passes the raw segments through unchanged --
assert.equal(index.getCandidateWallSegments().length, 3);

console.log("planGeometryIndex.test.mjs passed");
