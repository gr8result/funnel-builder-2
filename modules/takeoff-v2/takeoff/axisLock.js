// Pure axis-locking math for scale calibration / orthogonal measurement.
// No pdf.js or React dependency — everything here is plain arithmetic so it
// can be unit-tested exhaustively (see tests/axisLock.test.mjs).
//
// The key subtlety this module exists to solve: the user's intent ("drag
// mostly sideways" / "drag mostly up-down") is a *screen* concept, but the
// stored constraint (pointB.x === pointA.x, etc.) must be exact in *base*
// document coordinates (unrotated PDF points) — and at 90°/270° rotation,
// screen-horizontal corresponds to base-vertical (and vice versa), because
// pdf.js's viewport rotation swaps which base axis maps to screen x vs y.

// The linear part only (no translation) of the same rotation pdf.js's
// getViewport({ rotation }) applies — translation cancels out in a delta
// calculation, so this is all that's needed to reason about "which way does
// the user see this movement going" without a full viewport object.
export function rotateDelta(dx, dy, rotation) {
  switch (rotation) {
    case 90: return { x: -dy, y: dx };
    case 180: return { x: -dx, y: -dy };
    case 270: return { x: dy, y: -dx };
    default: return { x: dx, y: dy };
  }
}

// Bigger screen-space delta wins. Ties favor horizontal.
export function decideScreenAxis(dx, dy) {
  return Math.abs(dx) >= Math.abs(dy) ? "screen-horizontal" : "screen-vertical";
}

// 90°/270° rotation swaps which base axis a screen axis corresponds to.
export function screenAxisToBaseAxis(screenAxis, rotation) {
  const swapped = rotation === 90 || rotation === 270;
  if (screenAxis === "screen-horizontal") return swapped ? "vertical" : "horizontal";
  return swapped ? "horizontal" : "vertical";
}

// The exact constraint, applied in base document coordinates. Horizontal
// holds pointA.y fixed (the line runs along x); vertical holds pointA.x fixed.
export function applyAxisConstraint(pointA, rawPointB, axis) {
  if (axis === "horizontal") return { x: rawPointB.x, y: pointA.y };
  return { x: pointA.x, y: rawPointB.y };
}

export function axisAngleDegrees(axis) {
  return axis === "horizontal" ? 0 : 90;
}

// Full pipeline: given the already-placed base point A, a raw (unsnapped)
// base candidate for point B, and the page's current rotation, decides the
// base axis from the user's on-screen movement and returns the exactly
// constrained point B. `forcedAxis` (from the H/V keyboard shortcuts) skips
// the auto-decide entirely.
export function computeAxisLock({ pointA, rawPointB, rotation = 0, forcedAxis = null }) {
  let axis = forcedAxis;
  if (!axis) {
    const baseDx = rawPointB.x - pointA.x;
    const baseDy = rawPointB.y - pointA.y;
    const screenDelta = rotateDelta(baseDx, baseDy, rotation);
    const screenAxis = decideScreenAxis(screenDelta.x, screenDelta.y);
    axis = screenAxisToBaseAxis(screenAxis, rotation);
  }
  return {
    axis,
    pointB: applyAxisConstraint(pointA, rawPointB, axis),
    angleDegrees: axisAngleDegrees(axis),
  };
}
