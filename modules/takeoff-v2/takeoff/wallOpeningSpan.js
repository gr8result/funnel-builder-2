// Opening-aware exterior wall topology.
//
// CONSTRUCTION RULE: an opening does not break wall topology.
//
//   SOLID WALL -> GARAGE DOOR OPENING -> SOLID WALL
//
// is still ONE continuous exterior boundary run. The coloured physical wall
// material is absent across the opening, but the exterior-wall axis continues
// from jamb to jamb, so the perimeter/topology never breaks there.
//
// Two dimensions are measured on DIFFERENT axes and must never be confused:
//
//   wall thickness -> measured PERPENDICULAR to the wall direction
//   opening width  -> measured ALONG the wall direction
//
// A garage door is several metres wide along the wall. That width is never
// validated against wall-thickness rules — only the perpendicular face
// separation is.
//
// Everything here works in a "guide frame": `along` is distance parallel to
// the wall direction, `fixed` is signed offset perpendicular to it, matching
// the frame produced by takeoff/manualWallBand.js.

import { distance } from "./geometry.js";

// Opening width ranges measured ALONG the wall, in mm. Deliberately generous:
// per spec we would rather emit a low-confidence `opening_candidate` than
// reject the wall chain.
export const OPENING_WIDTH_RANGES_MM = [
  { type: "door", min: 600, max: 1400, confidence: 0.78 },
  { type: "opening_candidate", min: 1400, max: 1900, confidence: 0.6 },
  { type: "garage_door", min: 1900, max: 7200, confidence: 0.76 },
];

// Absolute ceiling for a bridgeable gap. Beyond this the "gap" is not an
// opening, it is simply two different walls.
export const MAX_BRIDGEABLE_OPENING_MM = 7200;
const MIN_BRIDGEABLE_OPENING_MM = 350;

// Perpendicular evidence within this fraction of the wall thickness of the
// gap edge counts as a jamb for that edge.
const JAMB_ALONG_TOLERANCE_FACTOR = 0.9;
const JAMB_MIN_ALONG_TOLERANCE = 4;
const JAMB_PERPENDICULAR_MIN_DEG = 60;
const JAMB_PERPENDICULAR_MAX_DEG = 120;
const DEFAULT_FACE_FRAGMENT_GAP = 10;

// Tolerances are derived from the wall thickness rather than fixed in document
// units, because the same 240 mm wall is ~24 units on a large-scale detail and
// under 7 units on a 1:100 A3 sheet. Fixed values that feel right on one sheet
// are wildly loose on the other.
function jambFaceTolerance(thickness) {
  return Math.max(2, Math.min(8, thickness * 0.5));
}

function faceFragmentGap(thickness) {
  if (!(thickness > 0)) return DEFAULT_FACE_FRAGMENT_GAP;
  return Math.max(2, Math.min(DEFAULT_FACE_FRAGMENT_GAP, thickness * 0.6));
}

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

// Raw plan strokes projected into the guide frame. Unlike the structural-line
// filter used for wall faces this keeps short strokes and symbol-tagged
// geometry, because a jamb tick is exactly the kind of short perpendicular
// stroke the structural filter throws away.
export function projectRawSegmentToGuide(segment, guide) {
  if (!segment?.a || !segment?.b) return null;
  const length = distance(segment.a, segment.b);
  if (!(length > 0)) return null;
  const angle = normalizeAngle(Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x));
  const aAlong = segment.a.x * guide.ux + segment.a.y * guide.uy;
  const bAlong = segment.b.x * guide.ux + segment.b.y * guide.uy;
  const aFixed = segment.a.x * guide.nx + segment.a.y * guide.ny;
  const bFixed = segment.b.x * guide.nx + segment.b.y * guide.ny;
  return {
    id: segment.id || null,
    angle,
    angleDiffFromGuide: angleDiffDeg(angle, guide.angle),
    startAlong: Math.min(aAlong, bAlong),
    endAlong: Math.max(aAlong, bAlong),
    midAlong: (aAlong + bAlong) / 2,
    minFixed: Math.min(aFixed, bFixed),
    maxFixed: Math.max(aFixed, bFixed),
    fixed: (aFixed + bFixed) / 2,
    length,
  };
}

// Perpendicular evidence crossing the wall band at `along` — the jamb return
// that closes off the wall material at the edge of an opening.
export function findJambsAt(rawGuideLines, { along, faceLowFixed, faceHighFixed, alongTolerance = null }) {
  const thickness = Math.abs(faceHighFixed - faceLowFixed);
  const tolerance = alongTolerance ?? Math.max(JAMB_MIN_ALONG_TOLERANCE, thickness * JAMB_ALONG_TOLERANCE_FACTOR);
  const faceTolerance = jambFaceTolerance(thickness);
  const minFixed = Math.min(faceLowFixed, faceHighFixed) - faceTolerance;
  const maxFixed = Math.max(faceLowFixed, faceHighFixed) + faceTolerance;
  return rawGuideLines
    .filter((line) => {
      if (line.angleDiffFromGuide < JAMB_PERPENDICULAR_MIN_DEG || line.angleDiffFromGuide > JAMB_PERPENDICULAR_MAX_DEG) return false;
      // A jamb spans (roughly) the wall thickness. Allow generous slack for
      // rendered jamb ticks and for reveals drawn slightly proud of the face.
      if (line.length < Math.max(2, thickness * 0.35)) return false;
      // A jamb return spans roughly the wall thickness. Anything much longer
      // is a wall running away perpendicular, not a jamb.
      if (line.length > Math.max(12, thickness * 4)) return false;
      if (Math.abs(line.midAlong - along) > tolerance) return false;
      return line.minFixed <= maxFixed && line.maxFixed >= minFixed;
    })
    .map((line) => line.id)
    .filter(Boolean);
}

// Width classification is measured ALONG the wall only. Never compared with
// wall thickness.
export function classifyOpeningWidthMm(widthMm, { hasStartJamb = false, hasEndJamb = false } = {}) {
  if (!Number.isFinite(widthMm) || widthMm < MIN_BRIDGEABLE_OPENING_MM) return null;
  if (widthMm > MAX_BRIDGEABLE_OPENING_MM) return null;
  const jambCount = (hasStartJamb ? 1 : 0) + (hasEndJamb ? 1 : 0);
  const range = OPENING_WIDTH_RANGES_MM.find((entry) => widthMm >= entry.min && widthMm <= entry.max);
  if (!range) {
    return {
      type: "opening_candidate",
      confidence: 0.52 + jambCount * 0.06,
      reason: `unclassified ${Math.round(widthMm)} mm gap along wall bridged as opening candidate`,
    };
  }
  // Both jambs present is the strong case; a single jamb still continues the
  // chain, just with lower confidence and (when ambiguous) as a candidate.
  if (jambCount === 0 && range.type !== "garage_door") {
    return {
      type: "opening_candidate",
      confidence: 0.5,
      reason: `${Math.round(widthMm)} mm gap along wall with no jamb evidence`,
    };
  }
  return {
    type: range.type,
    confidence: Math.min(0.92, range.confidence + jambCount * 0.06),
    reason: `${Math.round(widthMm)} mm gap along wall classified as ${range.type}${jambCount ? ` with ${jambCount} jamb${jambCount > 1 ? "s" : ""}` : ""}`,
  };
}

// Union of the along-intervals covered by wall-face linework at a given face
// offset, merged across small drafting fragment breaks.
export function faceCoverageIntervals(guideLines, fixed, faceTolerance, fragmentGap = DEFAULT_FACE_FRAGMENT_GAP) {
  return mergeIntervals(
    guideLines
      .filter((line) => Math.abs(line.fixed - fixed) <= faceTolerance)
      .map((line) => ({ start: line.startAlong, end: line.endAlong })),
    fragmentGap,
  );
}

function mergeIntervals(intervals, fragmentGap = DEFAULT_FACE_FRAGMENT_GAP) {
  return intervals
    .slice()
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce((merged, interval) => {
      const current = merged[merged.length - 1];
      if (current && interval.start <= current.end + fragmentGap) {
        current.end = Math.max(current.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
      return merged;
    }, []);
}

// Gaps in physical wall material between `spanStart` and `spanEnd`, classified
// as openings. Solid material either side of a gap is what makes it an
// opening rather than the end of the wall run.
export function detectOpeningIntervals({
  guideLines,
  rawGuideLines = [],
  faceLowFixed,
  faceHighFixed,
  spanStart,
  spanEnd,
  faceTolerance = 2.5,
  mmPerDocumentUnit = 1,
  // Raised bar used when the wall band already resolves on its own: only a
  // gap closed off by a jamb at BOTH ends may interrupt a working wall, so
  // ordinary drafting breaks never split a good green band.
  requireBothJambs = false,
}) {
  const fragmentGap = faceFragmentGap(Math.abs(faceHighFixed - faceLowFixed));
  const coverage = mergeIntervals([
    ...faceCoverageIntervals(guideLines, faceLowFixed, faceTolerance, fragmentGap),
    ...faceCoverageIntervals(guideLines, faceHighFixed, faceTolerance, fragmentGap),
  ], fragmentGap);
  if (coverage.length < 2) return [];

  const openings = [];
  for (let index = 1; index < coverage.length; index += 1) {
    const gapStart = coverage[index - 1].end;
    const gapEnd = coverage[index].start;
    if (gapEnd <= gapStart) continue;
    // Only gaps that actually fall inside the traced span matter.
    if (gapEnd <= spanStart || gapStart >= spanEnd) continue;
    const widthMm = (gapEnd - gapStart) * mmPerDocumentUnit;
    const startJambIds = findJambsAt(rawGuideLines, { along: gapStart, faceLowFixed, faceHighFixed });
    const endJambIds = findJambsAt(rawGuideLines, { along: gapEnd, faceLowFixed, faceHighFixed });
    if (requireBothJambs && !(startJambIds.length > 0 && endJambIds.length > 0)) continue;
    const classification = classifyOpeningWidthMm(widthMm, {
      hasStartJamb: startJambIds.length > 0,
      hasEndJamb: endJambIds.length > 0,
    });
    if (!classification) continue;
    openings.push({
      start: gapStart,
      end: gapEnd,
      widthMm,
      type: classification.type,
      confidence: classification.confidence,
      reason: classification.reason,
      startJambIds,
      endJambIds,
    });
  }
  return openings;
}

// The jamb-to-jamb case: the user clicked one jamb and then the opposite
// jamb, so the traced span contains no wall material at all. The span is a
// valid exterior run when the SAME pair of wall faces continues beyond both
// ends — that is the "continuation of the same wall direction beyond jamb B"
// test from the construction rule.
export function detectOpeningSpan({
  guideLines,
  rawGuideLines = [],
  spanStart,
  spanEnd,
  thicknessRange,
  mmPerDocumentUnit = 1,
  faceTolerance = 2.5,
  minFlankCoverage = 6,
}) {
  const spanWidthMm = (spanEnd - spanStart) * mmPerDocumentUnit;
  if (!(spanWidthMm >= MIN_BRIDGEABLE_OPENING_MM) || spanWidthMm > MAX_BRIDGEABLE_OPENING_MM) return null;

  // Distinct candidate face offsets present anywhere in the search strip.
  const offsets = [];
  guideLines.forEach((line) => {
    const existing = offsets.find((entry) => Math.abs(entry.fixed - line.fixed) <= faceTolerance);
    if (existing) existing.lines.push(line);
    else offsets.push({ fixed: line.fixed, lines: [line] });
  });

  // A face qualifies only if it has real material on BOTH sides of the span.
  const flanking = offsets
    .map((entry) => {
      const coverage = faceCoverageIntervals(entry.lines, entry.fixed, faceTolerance, faceFragmentGap(thicknessRange?.target));
      const before = coverage
        .map((interval) => Math.min(interval.end, spanStart) - interval.start)
        .filter((value) => value > 0)
        .reduce((sum, value) => sum + value, 0);
      const after = coverage
        .map((interval) => interval.end - Math.max(interval.start, spanEnd))
        .filter((value) => value > 0)
        .reduce((sum, value) => sum + value, 0);
      return {
        fixed: entry.fixed,
        before,
        after,
        sourceLineIds: entry.lines.map((line) => line.id).filter(Boolean),
      };
    })
    .filter((entry) => entry.before >= minFlankCoverage && entry.after >= minFlankCoverage)
    .sort((left, right) => left.fixed - right.fixed);

  if (flanking.length < 2) return null;

  // Choose the flanking face pair whose PERPENDICULAR separation is a valid
  // wall thickness. The span width along the wall plays no part in this.
  let best = null;
  for (let low = 0; low < flanking.length; low += 1) {
    for (let high = low + 1; high < flanking.length; high += 1) {
      const thickness = flanking[high].fixed - flanking[low].fixed;
      if (thickness < thicknessRange.min || thickness > thicknessRange.max) continue;
      const score = (flanking[low].before + flanking[low].after + flanking[high].before + flanking[high].after)
        - Math.abs(thickness - thicknessRange.target) * 4;
      if (!best || score > best.score) {
        best = { score, low: flanking[low], high: flanking[high], thickness };
      }
    }
  }
  if (!best) return null;

  const startJambIds = findJambsAt(rawGuideLines, {
    along: spanStart,
    faceLowFixed: best.low.fixed,
    faceHighFixed: best.high.fixed,
  });
  const endJambIds = findJambsAt(rawGuideLines, {
    along: spanEnd,
    faceLowFixed: best.low.fixed,
    faceHighFixed: best.high.fixed,
  });
  const classification = classifyOpeningWidthMm(spanWidthMm, {
    hasStartJamb: startJambIds.length > 0,
    hasEndJamb: endJambIds.length > 0,
  });
  if (!classification) return null;

  return {
    faceLowFixed: best.low.fixed,
    faceHighFixed: best.high.fixed,
    thicknessDocUnits: best.thickness,
    widthMm: spanWidthMm,
    type: classification.type,
    confidence: classification.confidence,
    reason: classification.reason,
    startJambIds,
    endJambIds,
    sourceLineIds: [...new Set([...best.low.sourceLineIds, ...best.high.sourceLineIds])],
  };
}
