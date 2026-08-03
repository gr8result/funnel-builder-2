import { distance } from "./geometry.js";

const MIN_WALL_LENGTH = 36;
const MIN_SOURCE_FRAGMENT_LENGTH = 10;
const MIN_THICKNESS = 3;
const MAX_THICKNESS = 34;
const MIN_FACE_OVERLAP = 12;
const PARALLEL_TOLERANCE_DEG = 3;
const SAME_FACE_TOLERANCE = 5;
const BAND_GAP_TOLERANCE = 42;
const MIN_CONFIDENCE = 0.64;
const REJECTED_TAGS = new Set([
  "annotation",
  "dimension",
  "dimension-line",
  "extension-line",
  "text",
  "text-bound",
  "door-arc",
  "symbol",
  "page-border",
  "title-block",
  "title-block-rule",
  "leader",
  "hatch",
  "hatching",
  "furniture",
  "furniture-edge",
  "cabinet",
  "cabinetry",
  "bench",
  "appliance",
  "note",
  "arrow",
  "setback",
]);

function rawSegments(planGeometryIndex) {
  const raw = Array.isArray(planGeometryIndex?.rawSegments)
    ? planGeometryIndex.rawSegments
    : typeof planGeometryIndex?.getCandidateWallSegments === "function"
      ? planGeometryIndex.getCandidateWallSegments()
      : planGeometryIndex?.segments;
  return Array.isArray(raw) ? raw : [];
}

function segmentTag(segment) {
  return String(segment?.geometryType || segment?.objectType || segment?.role || segment?.type || segment?.classification || "").toLowerCase();
}

function bounds(segment) {
  return {
    minX: Math.min(segment.a.x, segment.b.x),
    maxX: Math.max(segment.a.x, segment.b.x),
    minY: Math.min(segment.a.y, segment.b.y),
    maxY: Math.max(segment.a.y, segment.b.y),
  };
}

function isLikelyPageBorder(segment, page = {}) {
  const width = page.sourceWidth || page.width || 0;
  const height = page.sourceHeight || page.height || 0;
  if (!(width > 0) || !(height > 0) || !segment?.a || !segment?.b) return false;
  const b = bounds(segment);
  const marginX = width * 0.025;
  const marginY = height * 0.025;
  return (
    (b.maxX - b.minX > width * 0.82 && (b.minY <= marginY || b.maxY >= height - marginY)) ||
    (b.maxY - b.minY > height * 0.82 && (b.minX <= marginX || b.maxX >= width - marginX))
  );
}

function rejectionReason(segment, page) {
  if (!segment?.a || !segment?.b) return "missing endpoints";
  if (segment.stroked === false) return "not stroked";
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) return "annotation metadata";
  if (REJECTED_TAGS.has(segmentTag(segment))) return `rejected tag ${segmentTag(segment)}`;
  if (Array.isArray(segment.dashPattern) && segment.dashPattern.length) return "dashed annotation";
  if (isLikelyPageBorder(segment, page)) return "page border";
  if ((segment.length || distance(segment.a, segment.b)) < MIN_SOURCE_FRAGMENT_LENGTH) return "too short";
  return null;
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
  const a = segment.a.x * ux + segment.a.y * uy;
  const b = segment.b.x * ux + segment.b.y * uy;
  const fixed = ((segment.a.x * nx + segment.a.y * ny) + (segment.b.x * nx + segment.b.y * ny)) / 2;
  return {
    ...segment,
    angle,
    ux,
    uy,
    nx,
    ny,
    fixed,
    startAlong: Math.min(a, b),
    endAlong: Math.max(a, b),
    length,
  };
}

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function pointOn(line, along, fixed = line.fixed) {
  return { x: line.ux * along + line.nx * fixed, y: line.uy * along + line.ny * fixed };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.endAlong, b.endAlong) - Math.max(a.startAlong, b.startAlong));
}

function intervalContaining(intervals, along) {
  return intervals.find((interval) => along >= interval.start - BAND_GAP_TOLERANCE && along <= interval.end + BAND_GAP_TOLERANCE) || null;
}

function mergeIntervals(lines, alongHint) {
  const intervals = lines
    .map((line) => ({ start: line.startAlong, end: line.endAlong, ids: [line.id].filter(Boolean) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  intervals.forEach((interval) => {
    const current = merged[merged.length - 1];
    if (current && interval.start <= current.end + BAND_GAP_TOLERANCE) {
      current.end = Math.max(current.end, interval.end);
      current.ids.push(...interval.ids);
    } else {
      merged.push({ ...interval });
    }
  });
  return intervalContaining(merged, alongHint) || merged.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || null;
}

function sameFaceLines(lines, seed, fixed) {
  return lines.filter((line) => (
    angleDiffDeg(line.angle, seed.angle) <= PARALLEL_TOLERANCE_DEG &&
    Math.abs(line.fixed - fixed) <= SAME_FACE_TOLERANCE
  ));
}

function stableWallId(start, end, thickness) {
  const points = [
    `${Math.round(start.x)}-${Math.round(start.y)}`,
    `${Math.round(end.x)}-${Math.round(end.y)}`,
  ].sort();
  return `hl-wall-${points[0]}-${points[1]}-${Math.round(thickness * 10) / 10}`;
}

function makeCandidate(seed, partner, lines, pointer, pointerDistance) {
  const thickness = Math.abs(seed.fixed - partner.fixed);
  if (thickness < MIN_THICKNESS || thickness > MAX_THICKNESS) {
    return { rejected: true, reason: `thickness ${Math.round(thickness * 10) / 10} outside range` };
  }
  if (overlap(seed, partner) < MIN_FACE_OVERLAP) {
    return { rejected: true, reason: "parallel faces do not overlap" };
  }

  const pointerAlong = pointer.x * seed.ux + pointer.y * seed.uy;
  const faceAFixed = seed.fixed;
  const faceBFixed = partner.fixed;
  const faceALines = sameFaceLines(lines, seed, faceAFixed);
  const faceBLines = sameFaceLines(lines, seed, faceBFixed);
  const intervalA = mergeIntervals(faceALines, pointerAlong);
  const intervalB = mergeIntervals(faceBLines, pointerAlong);
  if (!intervalA || !intervalB) return { rejected: true, reason: "missing wall face interval" };

  const startAlong = Math.min(intervalA.start, intervalB.start);
  const endAlong = Math.max(intervalA.end, intervalB.end);
  const length = endAlong - startAlong;
  if (length < MIN_WALL_LENGTH) return { rejected: true, reason: `length ${Math.round(length)} below wall minimum` };

  const centerFixed = (faceAFixed + faceBFixed) / 2;
  const startJunction = pointOn(seed, startAlong, centerFixed);
  const endJunction = pointOn(seed, endAlong, centerFixed);
  const faceA = { start: pointOn(seed, startAlong, faceAFixed), end: pointOn(seed, endAlong, faceAFixed) };
  const faceB = { start: pointOn(seed, startAlong, faceBFixed), end: pointOn(seed, endAlong, faceBFixed) };
  const faceSupport = new Set([...(intervalA.ids || []), ...(intervalB.ids || [])]).size;
  const thicknessScore = thickness >= 5 && thickness <= 22 ? 0.16 : 0.08;
  const lengthScore = Math.min(0.18, length / 900);
  const supportScore = Math.min(0.16, faceSupport * 0.035);
  const distanceScore = Math.max(0, 0.16 - pointerDistance / 90);
  const confidence = Math.min(0.96, 0.38 + thicknessScore + lengthScore + supportScore + distanceScore);
  if (confidence < MIN_CONFIDENCE) return { rejected: true, reason: `confidence ${confidence.toFixed(2)} below threshold` };

  return {
    id: stableWallId(startJunction, endJunction, thickness),
    centreline: { start: startJunction, end: endJunction },
    faceA,
    faceB,
    thickness,
    startJunction,
    endJunction,
    confidence,
    source: "local-vector-wall-band",
    sourceSegmentIds: [...new Set([...(intervalA.ids || []), ...(intervalB.ids || [])])],
    diagnostics: {
      pointerDistance,
      candidateLength: length,
      parallelFaces: 2,
      estimatedThickness: thickness,
      startJunction,
      endJunction,
      reason: "accepted parallel structural wall band",
      rasterEvidence: "not-used",
    },
  };
}

export function findHighlightableWallAtPoint({ point, planGeometryIndex, page = {}, searchRadiusDocUnits = 12, diagnosticsEnabled = false } = {}) {
  if (!point || !planGeometryIndex) return { wall: null, diagnostics: [] };
  const diagnostics = [];
  const all = rawSegments(planGeometryIndex);
  const lines = all
    .map((segment) => {
      const reason = rejectionReason(segment, page);
      if (reason) {
        if (diagnosticsEnabled) diagnostics.push({ id: segment?.id, accepted: false, reason });
        return null;
      }
      return oriented(segment);
    })
    .filter(Boolean);
  const radius = Math.max(2, searchRadiusDocUnits);
  const seedHits = lines
    .map((line) => {
      const projected = nearestPointOnSegment(point, line.a, line.b);
      return { line, distance: distance(point, projected) };
    })
    .filter((hit) => hit.distance <= radius + MAX_THICKNESS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  const candidates = [];
  seedHits.forEach(({ line: seed, distance: pointerDistance }) => {
    lines.forEach((partner) => {
      if (partner.id === seed.id) return;
      if (angleDiffDeg(seed.angle, partner.angle) > PARALLEL_TOLERANCE_DEG) return;
      const candidate = makeCandidate(seed, partner, lines, point, pointerDistance);
      if (candidate.rejected) {
        if (diagnosticsEnabled) diagnostics.push({ seedId: seed.id, partnerId: partner.id, accepted: false, reason: candidate.reason });
        return;
      }
      candidates.push(candidate);
    });
  });

  const unique = new Map();
  candidates.forEach((candidate) => {
    const prior = unique.get(candidate.id);
    if (!prior || candidate.confidence > prior.confidence) unique.set(candidate.id, candidate);
  });
  const sorted = [...unique.values()].sort((a, b) => (
    b.confidence - a.confidence ||
    a.diagnostics.pointerDistance - b.diagnostics.pointerDistance ||
    b.diagnostics.candidateLength - a.diagnostics.candidateLength
  ));
  if (diagnosticsEnabled) {
    sorted.slice(0, 3).forEach((candidate) => diagnostics.push({ ...candidate.diagnostics, id: candidate.id, accepted: true }));
  }
  return { wall: sorted[0] || null, diagnostics };
}
