import { distance } from "./geometry.js";

const MIN_WALL_LENGTH = 12;
const MIN_THICKNESS = 2;
const MAX_THICKNESS = 34;
const MIN_OVERLAP = 10;
const PARALLEL_TOLERANCE_DEG = 3;
const CONNECT_TOLERANCE = 10;
const REJECTED_TAGS = new Set(["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "door-arc", "symbol", "page-border", "title-block", "title-block-rule", "leader", "hatch", "hatching", "furniture", "note", "arrow"]);

function rawSegments(planGeometryIndex) {
  const raw = typeof planGeometryIndex?.getCandidateWallSegments === "function"
    ? planGeometryIndex.getCandidateWallSegments()
    : planGeometryIndex?.segments;
  return Array.isArray(raw) ? raw : [];
}

function tag(segment) {
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
  if (!(width > 0) || !(height > 0)) return false;
  const b = bounds(segment);
  const marginX = width * 0.02;
  const marginY = height * 0.02;
  return (
    (b.maxX - b.minX > width * 0.86 && (b.minY <= marginY || b.maxY >= height - marginY)) ||
    (b.maxY - b.minY > height * 0.86 && (b.minX <= marginX || b.maxX >= width - marginX))
  );
}

function rejectionReason(segment, page) {
  if (!segment?.a || !segment?.b) return "missing endpoints";
  if (segment.stroked === false) return "not stroked";
  if (segment.isText || segment.isDimension || segment.isPageBorder || segment.isTitleBlock || segment.isDoorArc || segment.isSymbol) return "annotation metadata";
  if (REJECTED_TAGS.has(tag(segment))) return `rejected tag ${tag(segment)}`;
  if (Array.isArray(segment.dashPattern) && segment.dashPattern.length) return "dashed annotation";
  if (isLikelyPageBorder(segment, page)) return "page border";
  if ((segment.length || distance(segment.a, segment.b)) < MIN_WALL_LENGTH) return "too short";
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
    start: Math.min(a, b),
    end: Math.max(a, b),
    length,
  };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function pointOn(line, along, fixed = line.fixed) {
  return { x: line.ux * along + line.nx * fixed, y: line.uy * along + line.ny * fixed };
}

function wallKey(wall) {
  const s = wall.start;
  const e = wall.end;
  return [`${Math.round(s.x)},${Math.round(s.y)}`, `${Math.round(e.x)},${Math.round(e.y)}`].sort().join("|");
}

function createWallFromPair(a, b, seq, page) {
  const thickness = Math.abs(a.fixed - b.fixed);
  if (thickness < MIN_THICKNESS || thickness > MAX_THICKNESS) return null;
  const shared = overlap(a, b);
  if (shared < MIN_OVERLAP) return null;
  const startAlong = Math.max(a.start, b.start);
  const endAlong = Math.min(a.end, b.end);
  if (endAlong - startAlong < MIN_WALL_LENGTH) return null;
  const fixed = (a.fixed + b.fixed) / 2;
  const start = pointOn(a, startAlong, fixed);
  const end = pointOn(a, endAlong, fixed);
  return {
    id: `wall-${seq}`,
    type: classifyWall({ start, end }, page),
    start,
    end,
    thickness,
    confidence: Math.min(0.98, 0.72 + Math.min(0.18, distance(start, end) / 900) + Math.min(0.08, shared / Math.max(a.length, b.length))),
    openings: [],
    connectedWalls: [],
    source: a.source === "raster" || b.source === "raster" ? "raster" : "pdf-vector",
    sourceSegmentIds: [a.id, b.id].filter(Boolean),
  };
}

function createWallFromSingle(line, seq, page) {
  const start = pointOn(line, line.start);
  const end = pointOn(line, line.end);
  return {
    id: `wall-${seq}`,
    type: classifyWall({ start, end }, page),
    start,
    end,
    thickness: Number(line.lineWidth || line.strokeWidth || 0) || null,
    confidence: Math.min(0.74, 0.42 + Math.min(0.22, line.length / 900) + (line.source === "raster" ? 0.02 : 0.08)),
    openings: [],
    connectedWalls: [],
    source: line.source === "raster" ? "raster" : "pdf-vector-single",
    sourceSegmentIds: [line.id].filter(Boolean),
  };
}

function classifyWall(wall, page = {}) {
  const region = page.planRegion?.confirmed ? page.planRegion : null;
  const minX = region?.x ?? 0;
  const minY = region?.y ?? 0;
  const maxX = region ? region.x + region.width : (page.sourceWidth || page.width || 0);
  const maxY = region ? region.y + region.height : (page.sourceHeight || page.height || 0);
  if (!(maxX > minX) || !(maxY > minY)) return "unknown";
  const margin = Math.max(24, Math.min(maxX - minX, maxY - minY) * 0.08);
  const nearEdge = (p) => p.x <= minX + margin || p.x >= maxX - margin || p.y <= minY + margin || p.y >= maxY - margin;
  if (nearEdge(wall.start) && nearEdge(wall.end)) return "exterior";
  return "interior";
}

function addConnectivity(walls) {
  return walls.map((wall) => {
    const connectedWalls = walls
      .filter((other) => other.id !== wall.id)
      .filter((other) => (
        distance(wall.start, other.start) <= CONNECT_TOLERANCE ||
        distance(wall.start, other.end) <= CONNECT_TOLERANCE ||
        distance(wall.end, other.start) <= CONNECT_TOLERANCE ||
        distance(wall.end, other.end) <= CONNECT_TOLERANCE
      ))
      .map((other) => other.id);
    return { ...wall, connectedWalls };
  });
}

export function summarizeDetectedWalls(walls = []) {
  const counts = { total: walls.length, exterior: 0, interior: 0, unknown: 0, lowConfidence: 0 };
  walls.forEach((wall) => {
    counts[wall.type] = (counts[wall.type] || 0) + 1;
    if ((wall.confidence || 0) < 0.65) counts.lowConfidence += 1;
  });
  const confidenceValues = walls.map((wall) => wall.confidence).filter(Number.isFinite);
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0;
  return { ...counts, averageConfidence };
}

export function detectWallObjects({ planGeometryIndex, page = {} } = {}) {
  const sourceSegments = rawSegments(planGeometryIndex);
  const rejected = [];
  const lines = sourceSegments
    .map((segment) => {
      const reason = rejectionReason(segment, page);
      if (reason) rejected.push({ id: segment?.id || null, reason });
      return reason ? null : oriented(segment);
    })
    .filter(Boolean);

  const walls = [];
  let seq = 0;
  const pairedSegmentIds = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (angleDiffDeg(a.angle, b.angle) > PARALLEL_TOLERANCE_DEG) continue;
      const wall = createWallFromPair(a, b, seq + 1, page);
      if (!wall) continue;
      seq += 1;
      wall.sourceSegmentIds.forEach((id) => pairedSegmentIds.add(id));
      walls.push(wall);
    }
  }

  lines
    .filter((line) => !pairedSegmentIds.has(line.id))
    .forEach((line) => {
      seq += 1;
      walls.push(createWallFromSingle(line, seq, page));
    });

  const unique = [];
  const seen = new Set();
  walls
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence || distance(b.start, b.end) - distance(a.start, a.end))
    .forEach((wall) => {
      const key = wallKey(wall);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(wall);
    });

  const detectedWalls = addConnectivity(unique).map((wall) => ({
    ...wall,
    confidence: Math.round(wall.confidence * 100) / 100,
  }));

  return {
    walls: detectedWalls,
    summary: summarizeDetectedWalls(detectedWalls),
    diagnostics: {
      source: planGeometryIndex?.source || "unknown",
      rawSegments: sourceSegments.length,
      eligibleSegments: lines.length,
      rejectedSegments: rejected.length,
      rejected,
    },
  };
}
