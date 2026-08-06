import { distance } from "./geometry.js";

const MIN_WALL_LENGTH = 28;
const MIN_THICKNESS = 3;
const MAX_THICKNESS = 30;
const MIN_OVERLAP = 24;
const MIN_OVERLAP_RATIO = 0.58;
const PARALLEL_TOLERANCE_DEG = 3;
const CONNECT_TOLERANCE = 16;
const ROOM_CLOSURE_TOLERANCE = 22;
const REJECTED_TAGS = new Set(["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "door", "door-arc", "symbol", "page-border", "title-block", "title-block-rule", "leader", "hatch", "hatching", "furniture", "cabinet", "cabinetry", "appliance", "note", "arrow", "stair", "stair-tread", "tread"]);

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

function nearestPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function pointToWallDistance(point, wall) {
  return distance(point, nearestPointOnSegment(point, wall.start, wall.end));
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
  const overlapRatio = shared / Math.min(a.length, b.length);
  if (overlapRatio < MIN_OVERLAP_RATIO) return null;
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
    confidence: Math.min(0.98, 0.66 + Math.min(0.16, distance(start, end) / 900) + Math.min(0.12, overlapRatio * 0.12)),
    openings: [],
    connectedWalls: [],
    source: a.source === "raster" || b.source === "raster" ? "raster" : "pdf-vector",
    sourceSegmentIds: [a.id, b.id].filter(Boolean),
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

function endpointTouchesWall(point, wall) {
  return (
    distance(point, wall.start) <= CONNECT_TOLERANCE ||
    distance(point, wall.end) <= CONNECT_TOLERANCE ||
    pointToWallDistance(point, wall) <= CONNECT_TOLERANCE
  );
}

function wallsTouch(a, b) {
  return (
    endpointTouchesWall(a.start, b) ||
    endpointTouchesWall(a.end, b) ||
    endpointTouchesWall(b.start, a) ||
    endpointTouchesWall(b.end, a)
  );
}

function addConnectivity(walls) {
  return walls.map((wall) => {
    const connectedWalls = walls
      .filter((other) => other.id !== wall.id)
      .filter((other) => wallsTouch(wall, other))
      .map((other) => other.id);
    return { ...wall, connectedWalls };
  });
}

function wallAxis(wall) {
  return Math.abs(wall.end.x - wall.start.x) >= Math.abs(wall.end.y - wall.start.y) ? "horizontal" : "vertical";
}

function componentBounds(walls) {
  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function endpointKey(point) {
  const q = ROOM_CLOSURE_TOLERANCE;
  return `${Math.round(point.x / q)}:${Math.round(point.y / q)}`;
}

function hasRoomLikeClosure(walls) {
  if (walls.length < 4) return false;
  const axes = new Set(walls.map(wallAxis));
  if (!(axes.has("horizontal") && axes.has("vertical"))) return false;
  const b = componentBounds(walls);
  if (b.maxX - b.minX < MIN_WALL_LENGTH * 2 || b.maxY - b.minY < MIN_WALL_LENGTH * 2) return false;
  const wellConnectedWalls = walls.filter((wall) => wall.connectedWalls?.length >= 2).length;
  if (wellConnectedWalls >= 4) return true;
  const nodeDegree = new Map();
  walls.forEach((wall) => {
    const a = endpointKey(wall.start);
    const bKey = endpointKey(wall.end);
    nodeDegree.set(a, (nodeDegree.get(a) || 0) + 1);
    nodeDegree.set(bKey, (nodeDegree.get(bKey) || 0) + 1);
  });
  const closedNodes = [...nodeDegree.values()].filter((degree) => degree >= 2).length;
  return closedNodes >= 4 || walls.length >= nodeDegree.size;
}

function structuralComponents(walls) {
  const byId = new Map(walls.map((wall) => [wall.id, wall]));
  const seen = new Set();
  const components = [];
  walls.forEach((wall) => {
    if (seen.has(wall.id)) return;
    const stack = [wall.id];
    const ids = [];
    seen.add(wall.id);
    while (stack.length) {
      const id = stack.pop();
      ids.push(id);
      const current = byId.get(id);
      current.connectedWalls.forEach((connectedId) => {
        if (seen.has(connectedId)) return;
        seen.add(connectedId);
        stack.push(connectedId);
      });
    }
    components.push(ids.map((id) => byId.get(id)).filter(Boolean));
  });
  return components;
}

function filterStructuralWalls(walls) {
  const connected = addConnectivity(walls);
  const structuralIds = new Set();
  structuralComponents(connected).forEach((component) => {
    const connectedEnough = component.length >= 2 && component.some((wall) => wall.connectedWalls.length > 0);
    const roomLike = hasRoomLikeClosure(component);
    if (!connectedEnough || !roomLike) return;
    component.forEach((wall) => structuralIds.add(wall.id));
  });
  return connected
    .filter((wall) => structuralIds.has(wall.id))
    .map((wall) => ({
      ...wall,
      confidence: Math.round((wall.confidence + (wall.connectedWalls.length ? 0.08 : 0)) * 100) / 100,
    }));
}

function wallPairCandidates(lines, page) {
  const candidates = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (angleDiffDeg(a.angle, b.angle) > PARALLEL_TOLERANCE_DEG) continue;
      const wall = createWallFromPair(a, b, candidates.length + 1, page);
      if (!wall) continue;
      const shared = overlap(a, b);
      const overlapRatio = shared / Math.min(a.length, b.length);
      const score = overlapRatio * 3 - Math.abs(wall.thickness - 8) / 20 + Math.min(distance(wall.start, wall.end) / 500, 0.5);
      candidates.push({ wall, aId: a.id, bId: b.id, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
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
  const diagnostics = {
    source: planGeometryIndex?.source || "unknown",
    rawSegments: sourceSegments.length,
    eligibleSegments: 0,
    rejectedSegments: 0,
    rejected,
    candidatePairs: 0,
    acceptedPairs: 0,
    singleStrokeCandidates: 0,
    singleStrokeRejected: 0,
    structuralWalls: 0,
    rejectedCandidateWalls: 0,
  };
  const lines = sourceSegments
    .map((segment) => {
      const reason = rejectionReason(segment, page);
      if (reason) rejected.push({ id: segment?.id || null, reason });
      return reason ? null : oriented(segment);
    })
    .filter(Boolean);
  diagnostics.eligibleSegments = lines.length;
  diagnostics.rejectedSegments = rejected.length;

  const walls = [];
  let seq = 0;
  const pairedSegmentIds = new Set();
  const candidates = wallPairCandidates(lines, page);
  diagnostics.candidatePairs = candidates.length;
  candidates.forEach((candidate) => {
    if (pairedSegmentIds.has(candidate.aId) || pairedSegmentIds.has(candidate.bId)) return;
    seq += 1;
    const wall = { ...candidate.wall, id: `wall-${seq}` };
    wall.sourceSegmentIds.forEach((id) => pairedSegmentIds.add(id));
    walls.push(wall);
  });
  diagnostics.acceptedPairs = walls.length;

  diagnostics.singleStrokeRejected = lines.filter((line) => !pairedSegmentIds.has(line.id)).length;

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

  const detectedWalls = filterStructuralWalls(unique).map((wall) => ({
    ...wall,
    confidence: Math.min(0.99, Math.round(wall.confidence * 100) / 100),
  }));
  diagnostics.structuralWalls = detectedWalls.length;
  diagnostics.rejectedCandidateWalls = Math.max(0, unique.length - detectedWalls.length);

  return {
    walls: detectedWalls,
    summary: summarizeDetectedWalls(detectedWalls),
    diagnostics,
  };
}
