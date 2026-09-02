import assert from "node:assert/strict";
import { findWallCornerSnap, findJambSnap, findWallChainSnap } from "../takeoff/wallChainSnap.js";

let lineSeq = 0;
function line(a, b, extra = {}) {
  lineSeq += 1;
  return {
    id: `line-${lineSeq}`,
    source: "vector",
    stroked: true,
    a,
    b,
    length: Math.hypot(b.x - a.x, b.y - a.y),
    ...extra,
  };
}

function normalizeAngle(angle) {
  let next = angle;
  while (next < 0) next += Math.PI;
  while (next >= Math.PI) next -= Math.PI;
  return next;
}

function oriented(segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const aAlong = segment.a.x * ux + segment.a.y * uy;
  const bAlong = segment.b.x * ux + segment.b.y * uy;
  return {
    id: segment.id,
    a: segment.a,
    b: segment.b,
    angle,
    ux,
    uy,
    nx,
    ny,
    fixed: ((segment.a.x * nx + segment.a.y * ny) + (segment.b.x * nx + segment.b.y * ny)) / 2,
    startAlong: Math.min(aAlong, bAlong),
    endAlong: Math.max(aAlong, bAlong),
    length: Math.hypot(dx, dy),
  };
}

// A re-entrant (internal) building corner in a 240 mm brick veneer wall.
//
//   outer face y=100 runs left, stops at x=400
//   inner face y=124 runs left, stops at x=376
//   a wall turns UP at the corner: outer face x=400, inner face x=376
//
// There are therefore FOUR face intersections within 24 units of each other:
//   (400,100) outer x outer   (376,100) inner x outer
//   (400,124) outer x inner   (376,124) inner x inner
const OUTER_Y = 100;
const INNER_Y = 124;
const OUTER_X = 400;
const INNER_X = 376;

const reentrantCorner = [
  line({ x: 100, y: OUTER_Y }, { x: OUTER_X, y: OUTER_Y }),
  line({ x: 100, y: INNER_Y }, { x: INNER_X, y: INNER_Y }),
  line({ x: OUTER_X, y: OUTER_Y }, { x: OUTER_X, y: 340 }),
  line({ x: INNER_X, y: INNER_Y }, { x: INNER_X, y: 340 }),
].map(oriented);

const thicknessRange = { min: 20, max: 30, target: 24 };

// The band being traced: the chain is running left-to-right along the wall
// whose outer face is y=100 and inner face is y=124.
const activeBand = {
  outerFace: { start: { x: 100, y: OUTER_Y }, end: { x: OUTER_X, y: OUTER_Y } },
  innerFace: { start: { x: 100, y: INNER_Y }, end: { x: INNER_X, y: INNER_Y } },
};

// ---- TEST C: the corner lands on the traced wall's own face --------------
{
  // Cursor is nearest the INNER corner (376,124) but the chain is being traced
  // along the OUTER face, so the outer intersection must win.
  const snap = findWallCornerSnap({ x: 379, y: 121 }, {
    structuralLines: reentrantCorner,
    fromPoint: { x: 150, y: OUTER_Y },
    activeBand,
    toleranceDocUnits: 30,
    thicknessRange,
  });
  assert.ok(snap, "a re-entrant corner must produce a snap");
  assert.equal(Math.round(snap.point.x), OUTER_X);
  assert.equal(Math.round(snap.point.y), OUTER_Y);
  assert.equal(snap.connectedFace, "outer");
  assert.equal(snap.scoreBreakdown.onActiveFace, true);
  assert.equal(snap.scoreBreakdown.connectedToDirection, true);
}

// ---- tracing the inner face instead picks the inner corner ---------------
{
  // Same geometry, but the chain is being traced along the INNER face, with
  // the cursor nearest the OUTER corner. Continuity must still win.
  const innerBand = {
    outerFace: { start: { x: 100, y: INNER_Y }, end: { x: INNER_X, y: INNER_Y } },
    innerFace: { start: { x: 100, y: OUTER_Y }, end: { x: OUTER_X, y: OUTER_Y } },
  };
  const snap = findWallCornerSnap({ x: 396, y: 105 }, {
    structuralLines: reentrantCorner,
    fromPoint: { x: 150, y: INNER_Y },
    activeBand: innerBand,
    toleranceDocUnits: 30,
    thicknessRange,
  });
  assert.ok(snap);
  assert.equal(Math.round(snap.point.x), INNER_X);
  assert.equal(Math.round(snap.point.y), INNER_Y);
}

// ---- cursor distance alone must never decide the corner ------------------
{
  // Cursor sits almost exactly on the wrong (inner x outer) intersection.
  const snap = findWallCornerSnap({ x: INNER_X + 0.5, y: OUTER_Y + 0.5 }, {
    structuralLines: reentrantCorner,
    fromPoint: { x: 150, y: OUTER_Y },
    activeBand,
    toleranceDocUnits: 30,
    thicknessRange,
  });
  assert.ok(snap);
  assert.equal(Math.round(snap.point.x), OUTER_X, "must not take the nearest construction-line crossing");
  assert.ok(snap.rejectedCandidates.length > 0, "rejected candidates are reported for diagnostics");
}

// ---- with no chain context the nearest corner is still returned ----------
{
  const snap = findWallCornerSnap({ x: 402, y: 98 }, {
    structuralLines: reentrantCorner,
    toleranceDocUnits: 12,
    thicknessRange,
  });
  assert.ok(snap, "first click of a chain still snaps");
  assert.equal(Math.round(snap.point.x), OUTER_X);
  assert.equal(Math.round(snap.point.y), OUTER_Y);
}

// ---- snap lock: nothing in range means no point --------------------------
{
  assert.equal(
    findWallCornerSnap({ x: 900, y: 900 }, { structuralLines: reentrantCorner, toleranceDocUnits: 12 }),
    null,
  );
  assert.equal(findWallChainSnap({ x: 10, y: 10 }, { planGeometryIndex: null }), null);
}

// ---- opposite jamb across a garage opening is a valid snap ---------------
{
  const garage = [
    line({ x: 60, y: OUTER_Y }, { x: 200, y: OUTER_Y }),
    line({ x: 60, y: INNER_Y }, { x: 200, y: INNER_Y }),
    line({ x: 460, y: OUTER_Y }, { x: 760, y: OUTER_Y }),
    line({ x: 460, y: INNER_Y }, { x: 760, y: INNER_Y }),
    line({ x: 200, y: OUTER_Y }, { x: 200, y: INNER_Y }),
    line({ x: 460, y: OUTER_Y }, { x: 460, y: INNER_Y }),
  ];
  const snap = findJambSnap({ x: 458, y: 113 }, {
    rawSegments: garage,
    fromPoint: { x: 200, y: 112 },
    activeBand: {
      outerFace: { start: { x: 60, y: OUTER_Y }, end: { x: 760, y: OUTER_Y } },
      innerFace: { start: { x: 60, y: INNER_Y }, end: { x: 760, y: INNER_Y } },
    },
    toleranceDocUnits: 14,
    mmPerDocumentUnit: 10,
  });
  assert.ok(snap, "the far jamb of a garage opening must be snappable");
  assert.equal(Math.round(snap.point.x), 460);
  assert.equal(snap.type, "opening_jamb_continuation");
  assert.equal(snap.openingCandidate, "garage_door");
  assert.equal(Math.round(snap.openingWidthMm), 2600);
}

console.log("wallChainSnap tests passed");
