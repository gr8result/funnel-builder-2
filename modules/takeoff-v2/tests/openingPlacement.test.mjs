import assert from "node:assert/strict";
import {
  projectOntoWall,
  computeOpeningWidthMm,
  findNearestWallSegment,
  reattachOpeningToWall,
  reattachOpeningsToWall,
} from "../takeoff/openingPlacement.js";

// ---- projectOntoWall --------------------------------------------------
{
  const wallStart = { x: 0, y: 0 };
  const wallEnd = { x: 100, y: 0 };
  const mid = projectOntoWall({ x: 50, y: 12 }, wallStart, wallEnd);
  assert.deepEqual(mid.point, { x: 50, y: 0 });
  assert.equal(mid.t, 0.5);

  // Clamps to the segment's endpoints for out-of-range projections.
  const beyondStart = projectOntoWall({ x: -30, y: 5 }, wallStart, wallEnd);
  assert.deepEqual(beyondStart.point, { x: 0, y: 0 });
  assert.equal(beyondStart.t, 0);
  const beyondEnd = projectOntoWall({ x: 130, y: -5 }, wallStart, wallEnd);
  assert.deepEqual(beyondEnd.point, { x: 100, y: 0 });
  assert.equal(beyondEnd.t, 1);
}

// ---- computeOpeningWidthMm ---------------------------------------------
assert.equal(computeOpeningWidthMm({ x: 0, y: 0 }, { x: 90, y: 0 }, 10), 900);

// ---- findNearestWallSegment across exterior + internal graphs ----------
{
  const wallGraphs = [
    { key: "exterior", vertices: [{ id: "ea", x: 0, y: 0 }, { id: "eb", x: 100, y: 0 }], segments: [{ id: "es1", aId: "ea", bId: "eb" }] },
    { key: "internal", vertices: [{ id: "ia", x: 50, y: 0 }, { id: "ib", x: 50, y: 80 }], segments: [{ id: "is1", aId: "ia", bId: "ib" }] },
  ];
  const nearExterior = findNearestWallSegment({ x: 20, y: 2 }, wallGraphs, 10);
  assert.equal(nearExterior.wallGraph, "exterior");
  assert.equal(nearExterior.wallId, "es1");

  const nearInternal = findNearestWallSegment({ x: 52, y: 40 }, wallGraphs, 10);
  assert.equal(nearInternal.wallGraph, "internal");
  assert.equal(nearInternal.wallId, "is1");

  const nothingNearby = findNearestWallSegment({ x: 500, y: 500 }, wallGraphs, 10);
  assert.equal(nothingNearby, null);
}

// ---- reattachOpeningToWall keeps fractional position after the wall moves
{
  const opening = { id: "op1", wallId: "es1", start: { x: 25, y: 0 }, end: { x: 35, y: 0 } }; // 25%-35% along a 0..100 wall
  const moved = reattachOpeningToWall(opening, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 }); // wall doubled in length
  assert.deepEqual(moved.start, { x: 50, y: 0 });
  assert.deepEqual(moved.end, { x: 70, y: 0 });
}

// ---- reattachOpeningsToWall only touches openings on the moved wall -----
{
  const openings = [
    { id: "op1", wallId: "es1", start: { x: 25, y: 0 }, end: { x: 35, y: 0 } },
    { id: "op2", wallId: "other-wall", start: { x: 5, y: 5 }, end: { x: 5, y: 15 } },
  ];
  const result = reattachOpeningsToWall(openings, "es1", { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 });
  assert.deepEqual(result.find((o) => o.id === "op1").start, { x: 50, y: 0 });
  assert.deepEqual(result.find((o) => o.id === "op2"), openings[1]); // untouched
}

console.log("openingPlacement.test.mjs passed");
