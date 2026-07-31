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

// ---- getCandidateWallSegments exposes snap-eligible plan geometry ----------
assert.equal(index.getCandidateWallSegments().length, 3);

// ---- local snap search returns at most one best candidate -----------------
{
  const crowded = buildPlanGeometryIndex([
    { id: "h2", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, axis: "horizontal" },
    { id: "v2", a: { x: 50, y: -50 }, b: { x: 50, y: 50 }, axis: "vertical" },
  ]);
  const candidates = crowded.findSnapCandidates({ x: 50, y: 0 }, 8);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].type, "intersection");
}

// ---- text, dimensions, title blocks, and page borders are rejected --------
{
  const filtered = buildPlanGeometryIndex([
    { id: "text-bound", type: "text", a: { x: 10, y: 10 }, b: { x: 80, y: 10 }, axis: "horizontal" },
    { id: "dimension", role: "dimension", a: { x: 20, y: 20 }, b: { x: 120, y: 20 }, axis: "horizontal" },
    { id: "title", classification: "title-block-rule", a: { x: 30, y: 30 }, b: { x: 160, y: 30 }, axis: "horizontal" },
    { id: "border", a: { x: 0, y: 0 }, b: { x: 900, y: 0 }, axis: "horizontal" },
    { id: "wall", a: { x: 200, y: 200 }, b: { x: 300, y: 200 }, axis: "horizontal" },
  ], { pageWidth: 900, pageHeight: 700 });
  assert.deepEqual(filtered.getCandidateWallSegments().map((segment) => segment.id), ["wall"]);
  assert.deepEqual(filtered.findSnapCandidates({ x: 45, y: 10 }, 10), []);
}

console.log("planGeometryIndex.test.mjs passed");
