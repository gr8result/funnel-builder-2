import assert from "node:assert/strict";
import { offsetPolygonInward, offsetPolygonOutward } from "../takeoff/polygonOffset.js";
import { polygonAreaDocUnits2, isSimplePolygon } from "../takeoff/geometry.js";

// Simple square: offsetting a 10x10 square inward by 1 unit gives an 8x8
// square (area 64), regardless of which winding order the vertices are in.
{
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const offset = offsetPolygonInward(square, 1);
  assert.ok(offset, "expected a valid offset polygon");
  assert.equal(offset.length, 4);
  assert.ok(Math.abs(polygonAreaDocUnits2(offset) - 64) < 1e-6);
}

// Winding order shouldn't matter — reversed vertex order gives the same result.
{
  const square = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }];
  const offset = offsetPolygonInward(square, 1);
  assert.ok(offset);
  assert.ok(Math.abs(polygonAreaDocUnits2(offset) - 64) < 1e-6);
}

// L-shaped (concave) plan: offsetting inward by a modest amount stays a
// valid simple polygon with a smaller area than the original.
{
  const lShape = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 10 }, { x: 0, y: 10 },
  ];
  const originalArea = polygonAreaDocUnits2(lShape);
  const offset = offsetPolygonInward(lShape, 0.5);
  assert.ok(offset, "expected a valid offset for a modest thickness");
  assert.ok(isSimplePolygon(offset));
  assert.ok(polygonAreaDocUnits2(offset) < originalArea);
  assert.ok(polygonAreaDocUnits2(offset) > 0);
}

// A narrow wing offset by more than half its width degenerates — the
// function must fail closed (null), never return a self-intersecting or
// inside-out polygon silently.
{
  const narrowCorridor = [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 2 }, { x: 0, y: 2 },
  ];
  const offset = offsetPolygonInward(narrowCorridor, 5); // wider than half of the 2-unit span
  assert.equal(offset, null);
}

// Zero/negative thickness or too-small input is rejected outright.
{
  assert.equal(offsetPolygonInward([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1), null);
  assert.equal(offsetPolygonInward([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0), null);
}

// Outward offset expands an 8x8 square to 10x10 (area 100).
{
  const square = [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }];
  const offset = offsetPolygonOutward(square, 1);
  assert.ok(offset);
  assert.ok(Math.abs(polygonAreaDocUnits2(offset) - 100) < 1e-6);
}

// Inward then outward by the same distance round-trips back to (approximately)
// the original polygon for a simple rectangle.
{
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }];
  const shrunk = offsetPolygonInward(rect, 2);
  const grown = offsetPolygonOutward(shrunk, 2);
  assert.ok(grown);
  assert.ok(Math.abs(polygonAreaDocUnits2(grown) - polygonAreaDocUnits2(rect)) < 1e-6);
}

console.log("polygonOffset.test.mjs passed");
