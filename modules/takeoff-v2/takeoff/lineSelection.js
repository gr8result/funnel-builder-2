import { distance, segmentIntersection } from "./geometry.js";
import { bestSnapCandidate } from "./planSnap.js";

export const SHARED_LINE_SELECTION_TOLERANCE_SCREEN_PX = 12;
const COLLINEAR_TOLERANCE_DOC_UNITS = 4;
const WALL_SUPPORT_GAP_DOC_UNITS = 18;
const INTERSECTION_SEARCH_DOC_UNITS = 18;
const DIMENSION_TICK_MIN = 3;
const DIMENSION_TICK_MAX = 30;

function pointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return { point: a, t: 0, distance: distance(point, a) };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  const projected = { x: a.x + abx * t, y: a.y + aby * t };
  return { point: projected, t, distance: distance(point, projected) };
}

function segmentLength(segment) {
  return distance(segment.a, segment.b);
}

function angleOf(line) {
  return Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
}

function normalizeAngle(angle) {
  let next = angle;
  while (next < 0) next += Math.PI;
  while (next >= Math.PI) next -= Math.PI;
  return next;
}

function angleDiff(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI - diff);
}

function basisFor(line) {
  const angle = normalizeAngle(angleOf(line));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  return { angle, ux, uy, nx, ny };
}

function projectPoint(point, basis) {
  return {
    along: point.x * basis.ux + point.y * basis.uy,
    fixed: point.x * basis.nx + point.y * basis.ny,
  };
}

function pointFromProjection(along, fixed, basis) {
  return {
    x: basis.ux * along + basis.nx * fixed,
    y: basis.uy * along + basis.ny * fixed,
  };
}

function lineFromSegment(segment) {
  return { start: segment.a, end: segment.b };
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function isStronglyTaggedDimension(segment) {
  const tag = segmentTag(segment);
  return Boolean(segment?.isDimension || tag.includes("dimension") || tag.includes("annotation") || tag.includes("extension"));
}

function nearestSegmentByLineId(planGeometryIndex, lineId) {
  if (!lineId) return null;
  return (planGeometryIndex?.segments || []).find((segment) => segment.id === lineId) ||
    (planGeometryIndex?.rawSegments || []).find((segment) => segment.id === lineId) ||
    null;
}

export function findLineNearPointer({
  page = null,
  documentPoint,
  screenTolerance = SHARED_LINE_SELECTION_TOLERANCE_SCREEN_PX,
  orientation = null,
  zoom = 1,
  planGeometryIndex = null,
} = {}) {
  if (!documentPoint || !planGeometryIndex) return null;
  const snap = bestSnapCandidate(documentPoint, {
    toleranceScreenPx: screenTolerance,
    zoomScale: zoom,
    planGeometryIndex,
    page,
  });
  if (!snap) return null;

  const lineId = snap.lineId || snap.lineIds?.[0] || null;
  const segment = nearestSegmentByLineId(planGeometryIndex, lineId);
  if (!segment?.a || !segment?.b) return null;
  if (orientation && axisForLine(lineFromSegment(segment)) !== orientation) return null;

  const projected = pointToSegment(documentPoint, segment.a, segment.b);
  return {
    line: lineFromSegment(segment),
    source: segment.source === "raster" ? "raster" : "pdf-vector",
    sourceSegmentId: segment.id,
    snap,
    snapPoint: snap.point || projected.point,
    distanceFromPointer: snap.distance ?? projected.distance,
    confidence: Math.max(0.55, Math.min(0.98, 1 - (snap.distance || 0) / Math.max(screenTolerance / Math.max(zoom, 0.01), 1))),
    angle: normalizeAngle(angleOf(lineFromSegment(segment))) * 180 / Math.PI,
    orientation: axisForLine(lineFromSegment(segment)),
  };
}

export function scaleToolLineSelection(args = {}) {
  return findLineNearPointer(args);
}

export function expandLineToWall(hit, { planGeometryIndex = null } = {}) {
  if (!hit?.line || !planGeometryIndex) return null;
  const basis = basisFor(hit.line);
  const seedStart = projectPoint(hit.line.start, basis);
  const seedEnd = projectPoint(hit.line.end, basis);
  const seedFixed = (seedStart.fixed + seedEnd.fixed) / 2;
  const seedAlong = [seedStart.along, seedEnd.along].sort((a, b) => a - b);
  const allSegments = planGeometryIndex.segments || [];
  const support = allSegments
    .filter((segment) => segment?.a && segment?.b)
    .map((segment) => {
      const line = lineFromSegment(segment);
      const diff = angleDiff(angleOf(line), basis.angle);
      const a = projectPoint(segment.a, basis);
      const b = projectPoint(segment.b, basis);
      const fixed = (a.fixed + b.fixed) / 2;
      return {
        segment,
        diff,
        fixed,
        start: Math.min(a.along, b.along),
        end: Math.max(a.along, b.along),
        length: segmentLength(segment),
      };
    })
    .filter((item) => item.diff <= Math.PI / 72 && Math.abs(item.fixed - seedFixed) <= COLLINEAR_TOLERANCE_DOC_UNITS && item.length >= 6)
    .sort((a, b) => a.start - b.start);

  const connected = mergeSupportIntervals(support, seedAlong);
  if (!connected) return null;
  const trimmed = trimToIntersections({ interval: connected, basis, fixed: seedFixed, planGeometryIndex });
  const start = pointFromProjection(trimmed.start, seedFixed, basis);
  const end = pointFromProjection(trimmed.end, seedFixed, basis);
  const dimension = classifyLineForExterior(hit, { planGeometryIndex, expandedLine: { start, end } });
  const length = distance(start, end);

  return {
    id: stableExteriorLineId(start, end),
    line: { start, end },
    centreline: { start, end },
    initialLine: hit.line,
    scaleToolLine: hit.line,
    source: hit.source,
    sourceSegmentIds: [...new Set(support.map((item) => item.segment.id).filter(Boolean))],
    distanceFromPointer: hit.distanceFromPointer,
    confidence: Math.min(0.98, hit.confidence + (trimmed.startReason.includes("intersection") && trimmed.endReason.includes("intersection") ? 0.08 : 0)),
    angle: hit.angle,
    initialSegmentLength: distance(hit.line.start, hit.line.end),
    expandedWallLength: length,
    startEndpointReason: trimmed.startReason,
    endEndpointReason: trimmed.endReason,
    endpointReview: trimmed.startReason === "last supported visible point" || trimmed.endReason === "last supported visible point" ? "Endpoint needs review" : null,
    dimensionRejectionScore: dimension.score,
    exteriorClassification: dimension.classification,
    rejected: dimension.classification === "dimension-or-annotation",
    rejectionReason: dimension.reason,
    debug: {
      scaleSelection: hit.line,
      initialSharedHit: hit.line,
      expandedExteriorWall: { start, end },
    },
  };
}

export function classifyLineForExterior(hit, { planGeometryIndex = null, expandedLine = null } = {}) {
  if (!hit?.line) return { classification: "uncertain", score: 0.5, reason: "No line." };
  const line = expandedLine || hit.line;
  const basis = basisFor(line);
  const start = projectPoint(line.start, basis);
  const end = projectPoint(line.end, basis);
  const interval = { start: Math.min(start.along, end.along), end: Math.max(start.along, end.along) };
  const fixed = (start.fixed + end.fixed) / 2;
  const segments = [...(planGeometryIndex?.rawSegments || []), ...(planGeometryIndex?.segments || [])];
  const selectedSegment = segments.find((segment) => segment.id === hit.sourceSegmentId);
  let score = selectedSegment && isStronglyTaggedDimension(selectedSegment) ? 0.55 : 0;

  const ticks = segments.filter((segment) => {
    if (!segment?.a || !segment?.b) return false;
    const lineAngle = angleOf(lineFromSegment(segment));
    const diff = angleDiff(lineAngle, basis.angle);
    const length = segmentLength(segment);
    if (diff < Math.PI * 0.35 || diff > Math.PI * 0.65) return false;
    if (length < DIMENSION_TICK_MIN || length > DIMENSION_TICK_MAX) return false;
    const a = projectPoint(segment.a, basis);
    const b = projectPoint(segment.b, basis);
    const minFixed = Math.min(a.fixed, b.fixed);
    const maxFixed = Math.max(a.fixed, b.fixed);
    const midAlong = (a.along + b.along) / 2;
    return minFixed <= fixed + 5 && maxFixed >= fixed - 5 && midAlong >= interval.start - 6 && midAlong <= interval.end + 6;
  });
  if (ticks.length >= 3) score += 0.75;

  const nearbyParallel = segments.filter((segment) => {
    if (!segment?.a || !segment?.b || segment.id === hit.sourceSegmentId) return false;
    const diff = angleDiff(angleOf(lineFromSegment(segment)), basis.angle);
    if (diff > Math.PI / 72) return false;
    const a = projectPoint(segment.a, basis);
    const b = projectPoint(segment.b, basis);
    const otherFixed = (a.fixed + b.fixed) / 2;
    const overlap = Math.max(0, Math.min(interval.end, Math.max(a.along, b.along)) - Math.max(interval.start, Math.min(a.along, b.along)));
    return Math.abs(otherFixed - fixed) >= 3 && Math.abs(otherFixed - fixed) <= 30 && overlap >= Math.min(24, (interval.end - interval.start) * 0.25);
  });
  if (!nearbyParallel.length) score += 0.15;

  const classification = score >= 0.75 ? "dimension-or-annotation" : score >= 0.45 ? "uncertain" : "possible-structural-wall";
  const reason = classification === "dimension-or-annotation"
    ? "Rejected: repeated ticks, annotation metadata, or no nearby paired wall face."
    : classification === "uncertain"
      ? "Uncertain: limited nearby paired wall evidence."
      : "Possible structural wall.";
  return { classification, score: Math.min(1, score), reason, tickCount: ticks.length, nearbyParallelCount: nearbyParallel.length };
}

function mergeSupportIntervals(support, seedAlong) {
  const seedCenter = (seedAlong[0] + seedAlong[1]) / 2;
  const intervals = support.map((item) => ({ start: item.start, end: item.end })).sort((a, b) => a.start - b.start);
  let current = null;
  for (const interval of intervals) {
    if (!current) current = { ...interval };
    else if (interval.start <= current.end + WALL_SUPPORT_GAP_DOC_UNITS) current.end = Math.max(current.end, interval.end);
    else {
      if (seedCenter >= current.start - WALL_SUPPORT_GAP_DOC_UNITS && seedCenter <= current.end + WALL_SUPPORT_GAP_DOC_UNITS) return current;
      current = { ...interval };
    }
  }
  if (current && seedCenter >= current.start - WALL_SUPPORT_GAP_DOC_UNITS && seedCenter <= current.end + WALL_SUPPORT_GAP_DOC_UNITS) return current;
  return null;
}

function trimToIntersections({ interval, basis, fixed, planGeometryIndex }) {
  const baseStart = pointFromProjection(interval.start, fixed, basis);
  const baseEnd = pointFromProjection(interval.end, fixed, basis);
  const crossings = [];
  for (const segment of planGeometryIndex.segments || []) {
    if (!segment?.a || !segment?.b) continue;
    const diff = angleDiff(angleOf(lineFromSegment(segment)), basis.angle);
    if (diff < Math.PI / 8 || diff > Math.PI * 0.875) continue;
    const hit = segmentIntersection(baseStart, baseEnd, segment.a, segment.b, 1e-6);
    if (!hit) continue;
    const projected = projectPoint(hit, basis);
    if (projected.along >= interval.start - INTERSECTION_SEARCH_DOC_UNITS && projected.along <= interval.end + INTERSECTION_SEARCH_DOC_UNITS) {
      crossings.push(projected.along);
    }
  }
  crossings.sort((a, b) => a - b);
  const startCrossing = crossings.find((value) => Math.abs(value - interval.start) <= INTERSECTION_SEARCH_DOC_UNITS);
  const endCrossing = [...crossings].reverse().find((value) => Math.abs(value - interval.end) <= INTERSECTION_SEARCH_DOC_UNITS);
  return {
    start: startCrossing ?? interval.start,
    end: endCrossing ?? interval.end,
    startReason: startCrossing == null ? "last supported visible point" : "intersection",
    endReason: endCrossing == null ? "last supported visible point" : "intersection",
  };
}

function axisForLine(line) {
  const dx = Math.abs(line.end.x - line.start.x);
  const dy = Math.abs(line.end.y - line.start.y);
  if (dx >= dy * 3) return "horizontal";
  if (dy >= dx * 3) return "vertical";
  return "angled";
}

function stableExteriorLineId(start, end) {
  const key = [`${Math.round(start.x)}-${Math.round(start.y)}`, `${Math.round(end.x)}-${Math.round(end.y)}`].sort().join("-");
  return `hl-wall-${key}`;
}
