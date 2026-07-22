import assert from "node:assert/strict";
import { boundingBox, distancePx, midpoint, polygonAreaPx2, polylineLengthPx } from "../core/geometry.js";

assert.equal(distancePx({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
assert.deepEqual(midpoint({ x: 10, y: 20 }, { x: 30, y: 40 }), { x: 20, y: 30 });
assert.equal(polylineLengthPx([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 8 }]), 10);
assert.equal(polygonAreaPx2([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }]), 50);
assert.deepEqual(boundingBox([{ x: 5, y: 2 }, { x: 10, y: 20 }, { x: -5, y: 6 }]), {
  minX: -5,
  minY: 2,
  maxX: 10,
  maxY: 20,
  width: 15,
  height: 18,
});

console.log("geometry tests passed");

