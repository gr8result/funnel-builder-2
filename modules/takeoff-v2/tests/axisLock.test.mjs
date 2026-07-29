import assert from "node:assert/strict";
import {
  rotateDelta,
  decideScreenAxis,
  screenAxisToBaseAxis,
  applyAxisConstraint,
  axisAngleDegrees,
  computeAxisLock,
} from "../takeoff/axisLock.js";

// ---- Spec's exact horizontal example -------------------------------------
{
  const pointA = { x: 100.3, y: 225.7 };
  const rawPointB = { x: 702.9, y: 228.4 };
  const result = computeAxisLock({ pointA, rawPointB, rotation: 0 });
  assert.equal(result.axis, "horizontal");
  assert.equal(result.angleDegrees, 0);
  assert.equal(result.pointB.x, 702.9);
  assert.equal(result.pointB.y, 225.7);
}

// ---- Spec's exact vertical example ---------------------------------------
{
  const pointA = { x: 480.6, y: 100.2 };
  const rawPointB = { x: 477.3, y: 800.8 };
  const result = computeAxisLock({ pointA, rawPointB, rotation: 0 });
  assert.equal(result.axis, "vertical");
  assert.equal(result.angleDegrees, 90);
  assert.equal(result.pointB.x, 480.6);
  assert.equal(result.pointB.y, 800.8);
}

// ---- Same behaviour (same base result) at every rotation -----------------
// A fixed base A/rawPointerB pair must resolve to the identical base axis +
// pointB no matter the page rotation — the rotation only changes how the
// *screen* delta is computed internally, never the final base-space result.
for (const [label, pointA, rawPointB, expectedAxis, expectedPointB] of [
  ["horizontal", { x: 100.3, y: 225.7 }, { x: 702.9, y: 228.4 }, "horizontal", { x: 702.9, y: 225.7 }],
  ["vertical", { x: 480.6, y: 100.2 }, { x: 477.3, y: 800.8 }, "vertical", { x: 480.6, y: 800.8 }],
]) {
  for (const rotation of [0, 90, 180, 270]) {
    const result = computeAxisLock({ pointA, rawPointB, rotation });
    assert.equal(result.axis, expectedAxis, `${label} @ rotation ${rotation}: axis`);
    assert.equal(result.pointB.x, expectedPointB.x, `${label} @ rotation ${rotation}: pointB.x`);
    assert.equal(result.pointB.y, expectedPointB.y, `${label} @ rotation ${rotation}: pointB.y`);
    assert.equal(result.angleDegrees, expectedAxis === "horizontal" ? 0 : 90);
  }
}

// ---- rotateDelta: linear part of pdf.js's own rotation --------------------
assert.deepEqual(rotateDelta(5, 2, 0), { x: 5, y: 2 });
assert.deepEqual(rotateDelta(5, 2, 90), { x: -2, y: 5 });
assert.deepEqual(rotateDelta(5, 2, 180), { x: -5, y: -2 });
assert.deepEqual(rotateDelta(5, 2, 270), { x: 2, y: -5 });

// ---- decideScreenAxis: ties favour horizontal ------------------------------
assert.equal(decideScreenAxis(10, 2), "screen-horizontal");
assert.equal(decideScreenAxis(2, 10), "screen-vertical");
assert.equal(decideScreenAxis(5, 5), "screen-horizontal");

// ---- screenAxisToBaseAxis: swaps only at 90/270 ----------------------------
assert.equal(screenAxisToBaseAxis("screen-horizontal", 0), "horizontal");
assert.equal(screenAxisToBaseAxis("screen-horizontal", 180), "horizontal");
assert.equal(screenAxisToBaseAxis("screen-horizontal", 90), "vertical");
assert.equal(screenAxisToBaseAxis("screen-horizontal", 270), "vertical");
assert.equal(screenAxisToBaseAxis("screen-vertical", 0), "vertical");
assert.equal(screenAxisToBaseAxis("screen-vertical", 90), "horizontal");

// ---- applyAxisConstraint / axisAngleDegrees --------------------------------
assert.deepEqual(applyAxisConstraint({ x: 1, y: 2 }, { x: 9, y: 9 }, "horizontal"), { x: 9, y: 2 });
assert.deepEqual(applyAxisConstraint({ x: 1, y: 2 }, { x: 9, y: 9 }, "vertical"), { x: 1, y: 9 });
assert.equal(axisAngleDegrees("horizontal"), 0);
assert.equal(axisAngleDegrees("vertical"), 90);

// ---- forcedAxis (H/V keyboard override) bypasses the auto-decide ----------
{
  const pointA = { x: 0, y: 0 };
  const rawPointB = { x: 1, y: 100 }; // would normally auto-decide "vertical"
  const forced = computeAxisLock({ pointA, rawPointB, rotation: 0, forcedAxis: "horizontal" });
  assert.equal(forced.axis, "horizontal");
  assert.deepEqual(forced.pointB, { x: 1, y: 0 });
}

console.log("axisLock.test.mjs passed");
