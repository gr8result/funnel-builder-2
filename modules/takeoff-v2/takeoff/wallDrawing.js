// Freehand wall-drawing axis behavior: "lock to horizontal/vertical when
// close to those axes, allow a genuine angle when deliberately moved away."
// This is a *soft*, tolerance-based sibling to axisLock.js's *hard* lock
// used by Set Scale/Measure Length (which never allows a diagonal) — here a
// wall drawn at a real angle (e.g. an angled boundary wall) must stay exactly
// as drawn once the user is clearly past the near-axis tolerance.
//
// Like axisLock.js, the near-axis decision is made in *screen* space (what
// the user sees) via rotateDelta, then mapped back to which base axis to
// hold constant — so the same soft-lock behavior holds under every page
// rotation.

import { rotateDelta, applyAxisConstraint, axisAngleDegrees, screenAxisToBaseAxis } from "./axisLock.js";

const DEFAULT_TOLERANCE_DEGREES = 6;

function nearestCardinal(angleDegrees) {
  return (Math.round(angleDegrees / 90) % 4) * 90;
}

// Distance (degrees) from `angleDegrees` to the nearest multiple of 90,
// regardless of which one — e.g. 88 -> 2, 182 -> 2, 47 -> 43.
function distanceToNearestCardinal(angleDegrees) {
  const intoQuadrant = ((angleDegrees % 90) + 90) % 90;
  return Math.min(intoQuadrant, 90 - intoQuadrant);
}

// { point, axis, angleDegrees, locked }. `axis`/`angleDegrees` are null and
// `locked` is false when the segment is a genuine (non-axis) angle — the
// point is then returned completely unchanged.
export function softAxisSnap({ lastPoint, rawPoint, rotation = 0, toleranceDegrees = DEFAULT_TOLERANCE_DEGREES, forcedAxis = null }) {
  if (rawPoint.x === lastPoint.x && rawPoint.y === lastPoint.y) {
    return { point: rawPoint, axis: null, angleDegrees: null, locked: false };
  }

  if (forcedAxis) {
    const point = applyAxisConstraint(lastPoint, rawPoint, forcedAxis);
    return { point, axis: forcedAxis, angleDegrees: axisAngleDegrees(forcedAxis), locked: true };
  }

  const dx = rawPoint.x - lastPoint.x;
  const dy = rawPoint.y - lastPoint.y;
  const screenDelta = rotateDelta(dx, dy, rotation);
  const screenAngle = ((Math.atan2(screenDelta.y, screenDelta.x) * 180) / Math.PI + 360) % 360;

  if (distanceToNearestCardinal(screenAngle) > toleranceDegrees) {
    return { point: rawPoint, axis: null, angleDegrees: null, locked: false };
  }

  const cardinal = nearestCardinal(screenAngle);
  const screenAxis = cardinal === 0 || cardinal === 180 ? "screen-horizontal" : "screen-vertical";
  const axis = screenAxisToBaseAxis(screenAxis, rotation);
  const point = applyAxisConstraint(lastPoint, rawPoint, axis);
  return { point, axis, angleDegrees: axisAngleDegrees(axis), locked: true };
}
