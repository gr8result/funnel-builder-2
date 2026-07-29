import assert from "node:assert/strict";
import { softAxisSnap } from "../takeoff/wallDrawing.js";

const lastPoint = { x: 0, y: 0 };

// ---- near-horizontal snaps exactly -----------------------------------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 100, y: 3 }, rotation: 0 }); // ~1.7deg
  assert.equal(result.locked, true);
  assert.equal(result.axis, "horizontal");
  assert.equal(result.angleDegrees, 0);
  assert.deepEqual(result.point, { x: 100, y: 0 });
}

// ---- near-vertical snaps exactly -------------------------------------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 3, y: 100 }, rotation: 0 }); // ~88.3deg
  assert.equal(result.locked, true);
  assert.equal(result.axis, "vertical");
  assert.deepEqual(result.point, { x: 0, y: 100 });
}

// ---- a genuine 45deg angle is left completely unchanged --------------------
{
  const raw = { x: 100, y: 100 };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0 });
  assert.equal(result.locked, false);
  assert.equal(result.axis, null);
  assert.deepEqual(result.point, raw);
}

// ---- just past the default 6deg tolerance stays free -----------------------
{
  const raw = { x: 100, y: 100 * Math.tan((7 * Math.PI) / 180) };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0 });
  assert.equal(result.locked, false);
}

// ---- just inside a wider, explicit tolerance snaps -------------------------
{
  const raw = { x: 100, y: 100 * Math.tan((7 * Math.PI) / 180) };
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0, toleranceDegrees: 10 });
  assert.equal(result.locked, true);
  assert.equal(result.axis, "horizontal");
}

// ---- forcedAxis (Shift) overrides the angle entirely -----------------------
{
  const raw = { x: 100, y: 3 }; // would normally lock horizontal
  const result = softAxisSnap({ lastPoint, rawPoint: raw, rotation: 0, forcedAxis: "vertical" });
  assert.equal(result.axis, "vertical");
  assert.deepEqual(result.point, { x: 0, y: 3 });
}

// ---- identical points (no movement yet) is safely unlocked -----------------
{
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 0, y: 0 }, rotation: 0 });
  assert.equal(result.locked, false);
  assert.deepEqual(result.point, { x: 0, y: 0 });
}

// ---- same screen-relative intent locks to the same base axis at every
//      rotation (mirrors axisLock.test.mjs's rotation-invariance table) -----
for (const rotation of [0, 90, 180, 270]) {
  const result = softAxisSnap({ lastPoint, rawPoint: { x: 100, y: 3 }, rotation });
  // At every rotation this should still resolve to *a* locked cardinal axis
  // (never left diagonal), since 100,3 is always within 6deg of some screen
  // cardinal regardless of how rotateDelta remaps it.
  assert.equal(result.locked, true, `rotation ${rotation} should still lock`);
  assert.ok(result.axis === "horizontal" || result.axis === "vertical");
}

console.log("wallDrawing.test.mjs passed");
