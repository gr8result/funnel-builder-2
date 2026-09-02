// Wall-side-aware snapping for the exterior/internal wall chain.
//
// An exterior wall has several construction faces (outside face, one or two
// construction lines, inside room face). At an internal / re-entrant corner
// those faces produce SEVERAL geometric intersections within a few document
// units of each other. Picking the nearest one to the cursor makes the corner
// jump between outer and inner faces at random, which is what leaves gaps,
// diagonal jumps and offset corners in the traced perimeter.
//
// Instead every candidate is scored, with continuity outranking cursor
// distance (spec order A-E):
//
//   A. connected to the current confirmed wall direction
//   B. belongs to the current wall's detected physical faces
//   C. produces a plausible wall thickness after the turn
//   D. continues exterior topology
//   E. closest to cursor - only ever a tie-break
//
// The snap lock is preserved: no valid candidate means no point. The valid
// snap types are simply widened to include opening jambs, inferred jamb
// intersections, re-entrant physical-wall corners and continuation corners
// across an opening.

import { distance } from "./geometry.js";
import { findJambsAt, projectRawSegmentToGuide, classifyOpeningWidthMm } from "./wallOpeningSpan.js";

const CORNER_ANGLE_MIN_DEG = 65;
const CORNER_ANGLE_MAX_DEG = 115;
const PARALLEL_TOLERANCE_DEG = 6;
const FACE_MATCH_TOLERANCE_DOC_UNITS = 2.5;
const EXTENSION_TOLERANCE_DOC_UNITS = 6;
const END_OF_RUN_TOLERANCE_DOC_UNITS = 10;

// Continuity weights. A-D dominate; E can only ever separate equals.
const SCORE_CONNECTED_DIRECTION = 4;
// The decisive term: an exterior wall has several parallel construction faces
// and ALL of them belong to the band, so "is on a band face" cannot pick the
// right corner on its own. What picks it is which face the traced path is
// actually running along.
const SCORE_SAME_TRACED_FACE = 6;
const SCORE_ON_ACTIVE_FACE = 1;
const SCORE_PLAUSIBLE_TURN_THICKNESS = 2.5;
const SCORE_CONTINUES_TOPOLOGY = 2;
const SCORE_CURSOR_WEIGHT = 1;

function normalizeAngle(angle) {
  let next = angle;
  while (next < 0) next += Math.PI;
  while (next >= Math.PI) next -= Math.PI;
  return next;
}

function angleDiffDeg(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff) * 180 / Math.PI;
}

function oriented(segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const aAlong = segment.a.x * ux + segment.a.y * uy;
  const bAlong = segment.b.x * ux + segment.b.y * uy;
  return {
    id: segment.id || null,
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
    length,
  };
}

function infiniteLineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const px = ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator;
  const py = ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator;
  return { x: px, y: py };
}

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function alongOn(line, point) {
  return point.x * line.ux + point.y * line.uy;
}

function includesAlong(line, along, tolerance) {
  return along >= line.startAlong - tolerance && along <= line.endAlong + tolerance;
}

// Perpendicular offsets of the active wall band's physical faces, expressed in
// the frame of the wall currently being traced.
function activeFaceOffsets(activeBand, direction) {
  if (!activeBand || !direction) return [];
  const faces = [activeBand.outerFace, activeBand.innerFace, activeBand.faceA, activeBand.faceB]
    .filter((face) => face?.start && face?.end);
  const offsets = [];
  faces.forEach((face) => {
    const fixed = ((face.start.x * direction.nx + face.start.y * direction.ny)
      + (face.end.x * direction.nx + face.end.y * direction.ny)) / 2;
    if (!offsets.some((value) => Math.abs(value - fixed) <= 0.5)) offsets.push(fixed);
  });
  return offsets;
}

// The direction of the wall band currently being traced.
function wallDirectionFrame(activeBand) {
  const reference = [activeBand?.centreline, activeBand?.outerFace, activeBand?.innerFace, activeBand?.faceA, activeBand?.faceB]
    .find((face) => face?.start && face?.end);
  return reference ? directionFrame(reference.start, reference.end) : null;
}

// Which construction face of the active band a matched offset belongs to, so
// the debug readout can say whether the corner landed on the inner or outer
// face rather than leaving the user guessing.
function faceRoleForOffset(activeBand, direction, offset) {
  if (!activeBand || !direction || !Number.isFinite(offset)) return "unknown";
  const offsetFor = (face) => (face?.start && face?.end
    ? ((face.start.x * direction.nx + face.start.y * direction.ny)
      + (face.end.x * direction.nx + face.end.y * direction.ny)) / 2
    : null);
  const outer = offsetFor(activeBand.outerFace);
  const inner = offsetFor(activeBand.innerFace);
  if (Number.isFinite(outer) && Math.abs(outer - offset) <= FACE_MATCH_TOLERANCE_DOC_UNITS) return "outer";
  if (Number.isFinite(inner) && Math.abs(inner - offset) <= FACE_MATCH_TOLERANCE_DOC_UNITS) return "inner";
  return "unknown";
}

function directionFrame(from, to) {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  return {
    ux: dx / length,
    uy: dy / length,
    nx: -dy / length,
    ny: dx / length,
    angle: normalizeAngle(Math.atan2(dy, dx)),
    length,
  };
}

/**
 * Score and rank corner candidates around `point`.
 *
 * `fromPoint` is the current confirmed chain vertex and `activeBand` the wall
 * band being traced through it; together they define "the current physical
 * wall" whose continuity must be preserved.
 */
export function findWallCornerSnap(point, {
  structuralLines = [],
  fromPoint = null,
  activeBand = null,
  toleranceDocUnits = 12,
  thicknessRange = null,
} = {}) {
  if (!point || !structuralLines.length) return null;
  // The frame must come from the wall band actually being traced. Deriving it
  // from the cursor instead would tilt the perpendicular axis by however far
  // the mouse has drifted, and the face offsets would stop lining up with the
  // real construction faces.
  const direction = wallDirectionFrame(activeBand) || directionFrame(fromPoint, point);
  const faceOffsets = activeFaceOffsets(activeBand, direction);
  // Perpendicular offset of the boundary the user is actually tracing. When
  // the chain runs along the outer face this is the outer face offset, and the
  // outer corner wins even if the inner corner is nearer the cursor.
  const tracedFixed = direction && fromPoint ? fromPoint.x * direction.nx + fromPoint.y * direction.ny : null;
  const bandThickness = faceOffsets.length >= 2
    ? Math.max(...faceOffsets) - Math.min(...faceOffsets)
    : null;

  const near = structuralLines.filter(
    (line) => distance(point, nearestPointOnSegment(point, line.a, line.b)) <= toleranceDocUnits + EXTENSION_TOLERANCE_DOC_UNITS,
  );

  const candidates = [];
  const rejected = [];
  for (let i = 0; i < near.length; i += 1) {
    for (let j = i + 1; j < near.length; j += 1) {
      const a = near[i];
      const b = near[j];
      const turn = angleDiffDeg(a.angle, b.angle);
      if (turn < CORNER_ANGLE_MIN_DEG || turn > CORNER_ANGLE_MAX_DEG) continue;
      const hit = infiniteLineIntersection(a.a, a.b, b.a, b.b);
      if (!hit) continue;
      const cursorDistance = distance(point, hit);
      if (cursorDistance > toleranceDocUnits) continue;
      // The intersection must lie on (or barely beyond) both strokes, so we
      // never invent a corner out in space where two lines would eventually
      // have met.
      if (!includesAlong(a, alongOn(a, hit), EXTENSION_TOLERANCE_DOC_UNITS)
        || !includesAlong(b, alongOn(b, hit), EXTENSION_TOLERANCE_DOC_UNITS)) {
        rejected.push({ point: hit, reason: "intersection lies beyond both strokes", cursorDistance });
        continue;
      }

      // Which of the pair runs along the wall we are currently tracing?
      const alongLine = direction
        ? [a, b].find((line) => angleDiffDeg(line.angle, direction.angle) <= PARALLEL_TOLERANCE_DEG)
        : null;
      const crossLine = alongLine ? (alongLine === a ? b : a) : null;

      // A. connected to the current confirmed wall direction
      const connectedToDirection = Boolean(alongLine);

      // B. belongs to the current wall's detected physical faces
      const hitFixed = direction ? hit.x * direction.nx + hit.y * direction.ny : null;
      const onActiveFace = Boolean(
        direction
        && faceOffsets.length
        && faceOffsets.some((offset) => Math.abs(offset - hitFixed) <= FACE_MATCH_TOLERANCE_DOC_UNITS),
      );
      const matchedFaceOffset = onActiveFace
        ? faceOffsets.find((offset) => Math.abs(offset - hitFixed) <= FACE_MATCH_TOLERANCE_DOC_UNITS)
        : null;

      // C. produces a plausible wall thickness after the turn
      let turnThickness = null;
      if (crossLine && thicknessRange) {
        const partner = near
          .filter((line) => line.id !== crossLine.id)
          .filter((line) => angleDiffDeg(line.angle, crossLine.angle) <= PARALLEL_TOLERANCE_DEG)
          .map((line) => Math.abs(line.fixed - crossLine.fixed))
          .filter((value) => value >= thicknessRange.min && value <= thicknessRange.max)
          .sort((left, right) => Math.abs(left - thicknessRange.target) - Math.abs(right - thicknessRange.target))[0];
        if (Number.isFinite(partner)) turnThickness = partner;
      }
      const plausibleTurnThickness = Number.isFinite(turnThickness);

      // D. continues exterior topology - the traced wall actually ends here,
      // rather than the corner sitting somewhere mid-run.
      const continuesTopology = Boolean(
        alongLine
        && (Math.abs(alongOn(alongLine, hit) - alongLine.startAlong) <= END_OF_RUN_TOLERANCE_DOC_UNITS
          || Math.abs(alongOn(alongLine, hit) - alongLine.endAlong) <= END_OF_RUN_TOLERANCE_DOC_UNITS),
      );

      // E. cursor distance, normalised, and only worth a single point.
      const cursorScore = 1 - Math.min(1, cursorDistance / Math.max(toleranceDocUnits, 0.001));

      // Continuity of the CURRENT physical wall: how well this intersection
      // preserves the perpendicular offset of the boundary being traced.
      const sameTracedFace = Number.isFinite(tracedFixed) && Number.isFinite(hitFixed)
        ? 1 - Math.min(1, Math.abs(hitFixed - tracedFixed) / Math.max(bandThickness || FACE_MATCH_TOLERANCE_DOC_UNITS, 0.001))
        : 0;

      const score = (connectedToDirection ? SCORE_CONNECTED_DIRECTION : 0)
        + sameTracedFace * SCORE_SAME_TRACED_FACE
        + (onActiveFace ? SCORE_ON_ACTIVE_FACE : 0)
        + (plausibleTurnThickness ? SCORE_PLAUSIBLE_TURN_THICKNESS : 0)
        + (continuesTopology ? SCORE_CONTINUES_TOPOLOGY : 0)
        + cursorScore * SCORE_CURSOR_WEIGHT;

      candidates.push({
        type: turn >= CORNER_ANGLE_MIN_DEG && direction && onActiveFace ? "reentrant_corner" : "corner",
        point: hit,
        lineIds: [a.id, b.id].filter(Boolean),
        distance: cursorDistance,
        score,
        connectedFace: onActiveFace ? faceRoleForOffset(activeBand, direction, matchedFaceOffset) : "unknown",
        continuationScore: score,
        scoreBreakdown: {
          connectedToDirection,
          sameTracedFace: Math.round(sameTracedFace * 100) / 100,
          onActiveFace,
          plausibleTurnThickness,
          continuesTopology,
          cursorScore: Math.round(cursorScore * 100) / 100,
        },
        turnThicknessDocUnits: turnThickness,
      });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((left, right) => right.score - left.score || left.distance - right.distance);
  const winner = candidates[0];
  const maxScore = SCORE_CONNECTED_DIRECTION + SCORE_SAME_TRACED_FACE + SCORE_ON_ACTIVE_FACE
    + SCORE_PLAUSIBLE_TURN_THICKNESS + SCORE_CONTINUES_TOPOLOGY + SCORE_CURSOR_WEIGHT;
  return {
    ...winner,
    confidence: Math.max(0.3, Math.min(0.97, 0.35 + (winner.score / maxScore) * 0.6)),
    rejectedCandidates: [
      ...rejected.slice(0, 4),
      ...candidates.slice(1, 5).map((candidate) => ({
        point: candidate.point,
        cursorDistance: candidate.distance,
        reason: candidate.scoreBreakdown.onActiveFace
          ? `lower continuation score ${candidate.score.toFixed(2)}`
          : "not on the current wall's physical faces",
      })),
    ],
  };
}

/**
 * Snap to an opening jamb, including the jamb on the FAR side of an opening
 * the chain is currently crossing. This is what lets the user click one jamb
 * then the opposite jamb and have the exterior topology continue.
 */
export function findJambSnap(point, {
  rawSegments = [],
  fromPoint = null,
  activeBand = null,
  toleranceDocUnits = 12,
  mmPerDocumentUnit = 1,
} = {}) {
  const direction = directionFrame(fromPoint, point);
  if (!direction || !activeBand) return null;
  const faceOffsets = activeFaceOffsets(activeBand, direction);
  if (faceOffsets.length < 2) return null;
  const faceLowFixed = Math.min(...faceOffsets);
  const faceHighFixed = Math.max(...faceOffsets);

  const guide = { ux: direction.ux, uy: direction.uy, nx: direction.nx, ny: direction.ny, angle: direction.angle };
  const rawGuideLines = rawSegments
    .map((segment) => projectRawSegmentToGuide(segment, guide))
    .filter(Boolean);

  const fromAlong = fromPoint.x * guide.ux + fromPoint.y * guide.uy;
  const pointAlong = point.x * guide.ux + point.y * guide.uy;

  // Candidate jamb positions are the perpendicular returns within reach of the
  // cursor along the current wall direction.
  const jambAlongs = [];
  rawGuideLines.forEach((line) => {
    if (line.angleDiffFromGuide < 60 || line.angleDiffFromGuide > 120) return;
    if (Math.abs(line.midAlong - pointAlong) > toleranceDocUnits) return;
    if (!jambAlongs.some((value) => Math.abs(value - line.midAlong) <= 2)) jambAlongs.push(line.midAlong);
  });
  if (!jambAlongs.length) return null;

  const best = jambAlongs
    .map((along) => {
      const ids = findJambsAt(rawGuideLines, { along, faceLowFixed, faceHighFixed });
      if (!ids.length) return null;
      const widthMm = Math.abs(along - fromAlong) * mmPerDocumentUnit;
      const opening = classifyOpeningWidthMm(widthMm, { hasStartJamb: true, hasEndJamb: true });
      // Place the snap on the centre of the wall band at the jamb, so the
      // traced axis stays continuous through the opening.
      const centreFixed = (faceLowFixed + faceHighFixed) / 2;
      return {
        type: opening ? "opening_jamb_continuation" : "jamb",
        point: { x: guide.ux * along + guide.nx * centreFixed, y: guide.uy * along + guide.ny * centreFixed },
        along,
        jambIds: ids,
        openingCandidate: opening ? opening.type : "none",
        openingWidthMm: opening ? widthMm : null,
        confidence: opening ? opening.confidence : 0.6,
        reason: opening ? opening.reason : "jamb return crossing the current wall band",
      };
    })
    .filter(Boolean)
    .map((candidate) => ({ ...candidate, distance: distance(point, candidate.point) }))
    .filter((candidate) => candidate.distance <= toleranceDocUnits)
    .sort((left, right) => left.distance - right.distance)[0] || null;

  return best;
}

const orientedCache = new WeakMap();

function orientedStructuralLines(planGeometryIndex, raw, page, structuralFilter) {
  const cached = orientedCache.get(planGeometryIndex);
  if (cached && cached.raw === raw) return cached.lines;
  const lines = raw
    .filter((segment) => (structuralFilter ? structuralFilter(segment, page) : Boolean(segment?.a && segment?.b)))
    .map(oriented)
    .filter(Boolean);
  orientedCache.set(planGeometryIndex, { raw, lines });
  return lines;
}

/**
 * The one entry point the wall-drawing tool uses. Returns the best available
 * wall-aware snap, or null - in which case the caller must place no point.
 */
export function findWallChainSnap(point, {
  planGeometryIndex = null,
  page = null,
  fromPoint = null,
  activeBand = null,
  toleranceDocUnits = 12,
  thicknessRange = null,
  structuralFilter = null,
} = {}) {
  if (!point || !planGeometryIndex) return null;
  const raw = Array.isArray(planGeometryIndex.rawSegments)
    ? planGeometryIndex.rawSegments
    : (planGeometryIndex.segments || []);
  // Hover fires on every pointer move, so orienting the whole plan each time
  // would make tracing sluggish on a large drawing. The oriented set only
  // depends on the geometry index, so cache it against that.
  const structural = orientedStructuralLines(planGeometryIndex, raw, page, structuralFilter);

  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || 1;

  const corner = findWallCornerSnap(point, {
    structuralLines: structural,
    fromPoint,
    activeBand,
    toleranceDocUnits,
    thicknessRange,
  });
  const jamb = findJambSnap(point, {
    rawSegments: raw,
    fromPoint,
    activeBand,
    toleranceDocUnits,
    mmPerDocumentUnit,
  });

  if (corner && jamb) {
    // A jamb that continues the chain across an opening beats a nearby corner
    // only when the corner has no continuity evidence at all.
    return corner.scoreBreakdown.onActiveFace || corner.scoreBreakdown.connectedToDirection ? corner : jamb;
  }
  return corner || jamb || null;
}
