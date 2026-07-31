import { createWallSegment, createWallVertex, generateId } from "../types.js";
import { distance, segmentIntersection, isSimplePolygon } from "./geometry.js";

const DEFAULT_MAX_CLICK_DISTANCE = 16;
const DEFAULT_MIN_WALL_LENGTH = 10;
const MIN_OVERLAP = 12;
const MIN_THICKNESS = 2;
const MAX_THICKNESS = 26;
const JUNCTION_TOLERANCE = 10;
const PARALLEL_TOLERANCE_DEG = 3;
const COLLINEAR_TOLERANCE = 6;
const FRAGMENT_GAP_TOLERANCE = 48;
const DEFAULT_ASSUMED_WALL_THICKNESS = 8;
const REJECTED_TAGS = new Set(["annotation", "dimension", "dimension-line", "extension-line", "text", "text-bound", "door-arc", "symbol", "page-border", "title-block", "title-block-rule", "leader"]);

function lineTag(line) {
  return String(line?.geometryType || line?.objectType || line?.role || line?.type || line?.classification || "").toLowerCase();
}

function colorLooksBlack(color) {
  if (!color) return true;
  if (String(color).toLowerCase() === "#000000") return true;
  const values = String(color).split(",").map(Number).filter(Number.isFinite);
  return values.length < 3 || values.slice(0, 3).every((value) => value <= 80 || value <= 0.35);
}

function bounds(line) {
  return {
    minX: Math.min(line.a.x, line.b.x),
    maxX: Math.max(line.a.x, line.b.x),
    minY: Math.min(line.a.y, line.b.y),
    maxY: Math.max(line.a.y, line.b.y),
  };
}

function isLikelyPageBorder(line, pageWidth, pageHeight) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return false;
  const b = bounds(line);
  const marginX = pageWidth * 0.025;
  const marginY = pageHeight * 0.025;
  return (
    (b.maxX - b.minX > pageWidth * 0.82 && (b.minY <= marginY || b.maxY >= pageHeight - marginY)) ||
    (b.maxY - b.minY > pageHeight * 0.82 && (b.minX <= marginX || b.maxX >= pageWidth - marginX))
  );
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized < 0) normalized += Math.PI;
  while (normalized >= Math.PI) normalized -= Math.PI;
  return normalized;
}

function angleDiffDeg(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff) * 180 / Math.PI;
}

function orientedLine(line) {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const rawLength = Math.hypot(dx, dy);
  if (!rawLength) return null;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const ta = line.a.x * ux + line.a.y * uy;
  const tb = line.b.x * ux + line.b.y * uy;
  const fixed = ((line.a.x * nx + line.a.y * ny) + (line.b.x * nx + line.b.y * ny)) / 2;
  const angleDeg = angle * 180 / Math.PI;
  return {
    ...line,
    angle,
    angleDeg,
    orientation: Math.abs(angleDeg) <= 0.5 || Math.abs(angleDeg - 180) <= 0.5 ? "horizontal" : Math.abs(angleDeg - 90) <= 0.5 ? "vertical" : "angled",
    ux,
    uy,
    nx,
    ny,
    fixed,
    start: Math.min(ta, tb),
    end: Math.max(ta, tb),
  };
}

function rawWallSegments(planGeometryIndex) {
  const raw = typeof planGeometryIndex?.getCandidateWallSegments === "function"
    ? planGeometryIndex.getCandidateWallSegments()
    : planGeometryIndex?.segments;
  return Array.isArray(raw) ? raw : [];
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function pointOnAxisLine(line, along) {
  return {
    x: line.ux * along + line.nx * line.fixed,
    y: line.uy * along + line.ny * line.fixed,
  };
}

function segmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (!lengthSquared) return { distance: distance(point, a), point: a, t: 0 };
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  const projected = { x: a.x + abx * t, y: a.y + aby * t };
  return { distance: distance(point, projected), point: projected, t };
}

function wallDistanceToPoint(wall, point) {
  const centre = segmentDistance(point, wall.centreline.start, wall.centreline.end);
  const faceA = wall.faceA ? segmentDistance(point, wall.faceA.a, wall.faceA.b).distance : Infinity;
  const faceB = wall.faceB ? segmentDistance(point, wall.faceB.a, wall.faceB.b).distance : Infinity;
  const bandDistance = Math.max(0, centre.distance - (wall.thickness || 0) / 2);
  return { distance: Math.min(bandDistance, faceA, faceB, centre.distance), projected: centre.point, centreDistance: centre.distance };
}

function lineRejectionReason(line, page = {}) {
  if (!line?.a || !line?.b) return "missing endpoints";
  const length = line.length || distance(line.a, line.b);
  if (line.stroked === false) return "not stroked";
  if (line.isText || line.isDimension || line.isPageBorder || line.isTitleBlock || line.isDoorArc || line.isSymbol) return "annotation metadata";
  if (REJECTED_TAGS.has(lineTag(line))) return `rejected tag ${lineTag(line)}`;
  if (Array.isArray(line.dashPattern) && line.dashPattern.length > 0) return "dashed annotation";
  if (!colorLooksBlack(line.strokeColor)) return "non-wall color";
  if (line.pathSegmentCount > 70 && length < 40) return "small complex symbol";
  if (isLikelyPageBorder(line, page.sourceWidth || page.width || 0, page.sourceHeight || page.height || 0)) return "page border";
  if (length < DEFAULT_MIN_WALL_LENGTH) return "too short";
  return null;
}

function isEligibleLine(line, page = {}) {
  return !lineRejectionReason(line, page);
}

function wallKey(wall) {
  const s = wall.centreline.start;
  const e = wall.centreline.end;
  const a = `${Math.round(s.x)},${Math.round(s.y)}`;
  const b = `${Math.round(e.x)},${Math.round(e.y)}`;
  return [a, b].sort().join("|");
}

function createDetectedWall(a, b, seq) {
  const thickness = Math.abs(a.fixed - b.fixed);
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  const fixed = (a.fixed + b.fixed) / 2;
  const centreAxis = { ...a, fixed };
  if (end - start < DEFAULT_MIN_WALL_LENGTH) return null;
  const centreStart = pointOnAxisLine(centreAxis, start);
  const centreEnd = pointOnAxisLine(centreAxis, end);
  const length = distance(centreStart, centreEnd);
  return {
    id: `dw-${seq}`,
    centreline: { start: centreStart, end: centreEnd },
    faceA: { a: pointOnAxisLine(a, start), b: pointOnAxisLine(a, end), sourceId: a.id },
    faceB: { a: pointOnAxisLine(b, start), b: pointOnAxisLine(b, end), sourceId: b.id },
    thickness,
    orientation: Math.round(a.angleDeg * 10) / 10,
    angle: a.angle,
    ux: a.ux,
    uy: a.uy,
    nx: a.nx,
    ny: a.ny,
    fixed,
    intersections: {},
    confidence: Math.min(1, 0.55 + Math.min(0.35, length / 500) + Math.min(0.1, overlap(a, b) / Math.max(a.end - a.start, b.end - b.start))),
    source: a.source === "raster" || b.source === "raster" ? "raster" : "pdf-vector",
    length,
  };
}

function createSingleStrokeWall(line, seq) {
  const thickness = Math.max(MIN_THICKNESS, Number(line.lineWidth || line.strokeWidth || line.width || DEFAULT_ASSUMED_WALL_THICKNESS));
  const start = pointOnAxisLine(line, line.start);
  const end = pointOnAxisLine(line, line.end);
  const length = distance(start, end);
  if (length < DEFAULT_MIN_WALL_LENGTH) return null;
  return {
    id: `dw-single-${seq}`,
    centreline: { start, end },
    faceA: null,
    faceB: null,
    thickness,
    orientation: Math.round(line.angleDeg * 10) / 10,
    angle: line.angle,
    ux: line.ux,
    uy: line.uy,
    nx: line.nx,
    ny: line.ny,
    fixed: line.fixed,
    intersections: {},
    confidence: Math.min(0.82, 0.42 + Math.min(0.28, length / 650) + (line.source === "raster" ? 0.02 : 0.08)),
    source: line.source === "raster" ? "local-raster" : "pdf-vector-single",
    length,
    rawLineIds: line.rawLineIds || [line.id].filter(Boolean),
  };
}

function mergeCollinearLines(lines) {
  const merged = [];
  lines
    .slice()
    .sort((a, b) => a.angle - b.angle || a.fixed - b.fixed || a.start - b.start)
    .forEach((line) => {
      const target = merged.find((candidate) => (
        angleDiffDeg(candidate.angle, line.angle) <= PARALLEL_TOLERANCE_DEG &&
        Math.abs(candidate.fixed - line.fixed) <= COLLINEAR_TOLERANCE &&
        line.start <= candidate.end + FRAGMENT_GAP_TOLERANCE &&
        line.end >= candidate.start - FRAGMENT_GAP_TOLERANCE
      ));
      if (!target) {
        merged.push({ ...line, rawLineIds: [line.id].filter(Boolean) });
        return;
      }
      target.start = Math.min(target.start, line.start);
      target.end = Math.max(target.end, line.end);
      target.fixed = (target.fixed + line.fixed) / 2;
      target.rawLineIds = [...(target.rawLineIds || []), line.id].filter(Boolean);
      target.a = pointOnAxisLine(target, target.start);
      target.b = pointOnAxisLine(target, target.end);
      target.length = distance(target.a, target.b);
    });
  return merged;
}

function trimWallToIntersections(wall, walls) {
  const values = [];
  walls.forEach((other) => {
    if (other.id === wall.id || angleDiffDeg(wall.angle, other.angle) <= PARALLEL_TOLERANCE_DEG) return;
    const hit = segmentIntersection(wall.centreline.start, wall.centreline.end, other.centreline.start, other.centreline.end, JUNCTION_TOLERANCE);
    if (!hit) return;
    const withinOther = segmentDistance(hit, other.centreline.start, other.centreline.end).distance <= JUNCTION_TOLERANCE;
    if (withinOther) values.push(hit.x * wall.ux + hit.y * wall.uy);
  });
  if (values.length < 2) return wall;
  values.sort((a, b) => a - b);
  const min = wall.centreline.start.x * wall.ux + wall.centreline.start.y * wall.uy;
  const max = wall.centreline.end.x * wall.ux + wall.centreline.end.y * wall.uy;
  const start = values.filter((value) => value <= min + JUNCTION_TOLERANCE).pop() ?? min;
  const end = values.find((value) => value >= max - JUNCTION_TOLERANCE) ?? max;
  if (end - start < DEFAULT_MIN_WALL_LENGTH) return wall;
  return {
    ...wall,
    centreline: {
      start: pointOnAxisLine(wall, start),
      end: pointOnAxisLine(wall, end),
    },
    intersections: {
      start: { point: pointOnAxisLine(wall, start), type: "junction" },
      end: { point: pointOnAxisLine(wall, end), type: "junction" },
    },
    length: end - start,
  };
}

export function buildDetectedWalls(planGeometryIndex, page = {}) {
  const lines = rawWallSegments(planGeometryIndex)
    .filter((line) => isEligibleLine(line, page))
    .map(orientedLine)
    .filter(Boolean);
  const walls = [];
  let seq = 0;
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (angleDiffDeg(a.angle, b.angle) > PARALLEL_TOLERANCE_DEG) continue;
      const thickness = Math.abs(a.fixed - b.fixed);
      if (thickness < MIN_THICKNESS || thickness > MAX_THICKNESS) continue;
      const shared = overlap(a, b);
      if (shared < MIN_OVERLAP) continue;
      const shorter = Math.min(a.end - a.start, b.end - b.start);
      if (shared / Math.max(shorter, 1) < 0.35) continue;
      seq += 1;
      const wall = createDetectedWall(a, b, seq);
      if (wall) walls.push(wall);
    }
  }
  mergeCollinearLines(lines).forEach((line) => {
    seq += 1;
    const wall = createSingleStrokeWall(line, seq);
    if (wall) walls.push(wall);
  });

  const unique = [];
  const seen = new Set();
  walls
    .sort((a, b) => b.confidence - a.confidence || b.length - a.length)
    .forEach((wall) => {
      const key = wallKey(wall);
      if (seen.has(key)) return;
      const duplicateStrongerWall = unique.some((candidate) => (
        angleDiffDeg(candidate.angle, wall.angle) <= PARALLEL_TOLERANCE_DEG &&
        Math.abs(candidate.fixed - wall.fixed) <= Math.max(candidate.thickness || 0, wall.thickness || 0, COLLINEAR_TOLERANCE) &&
        candidate.length >= wall.length * 0.9 &&
        overlap(
          { start: candidate.centreline.start.x * candidate.ux + candidate.centreline.start.y * candidate.uy, end: candidate.centreline.end.x * candidate.ux + candidate.centreline.end.y * candidate.uy },
          { start: wall.centreline.start.x * wall.ux + wall.centreline.start.y * wall.uy, end: wall.centreline.end.x * wall.ux + wall.centreline.end.y * wall.uy }
        ) >= Math.min(candidate.length, wall.length) * 0.75
      ));
      if (duplicateStrongerWall) return;
      seen.add(key);
      unique.push(wall);
    });
  return unique.map((wall) => trimWallToIntersections(wall, unique));
}

export function findWallUnderPointer(point, { walls = [], zoomScale = 1, toleranceScreenPx = DEFAULT_MAX_CLICK_DISTANCE } = {}) {
  const tolerance = toleranceScreenPx / Math.max(zoomScale, 0.01);
  let best = null;
  walls.forEach((wall) => {
    const hit = wallDistanceToPoint(wall, point);
    if (hit.distance > tolerance) return;
    const score = wall.confidence * 100 + Math.min(25, wall.length / 12) - hit.distance * 4 - hit.centreDistance * 0.2;
    if (!best || score > best.score) best = { wall, point: hit.projected, distance: hit.distance, score };
  });
  return best;
}

export function buildLocalRasterFallbackWalls(point, { planGeometryIndex, page = {}, zoomScale = 1, toleranceScreenPx = DEFAULT_MAX_CLICK_DISTANCE } = {}) {
  const tolerance = toleranceScreenPx / Math.max(zoomScale, 0.01);
  const nearbyRaster = rawWallSegments(planGeometryIndex)
    .filter((line) => line?.source === "raster")
    .filter((line) => !lineRejectionReason(line, page))
    .filter((line) => segmentDistance(point, line.a, line.b).distance <= tolerance * 3)
    .map(orientedLine)
    .filter(Boolean);
  return mergeCollinearLines(nearbyRaster)
    .map((line, index) => createSingleStrokeWall(line, `raster-${index + 1}`))
    .filter(Boolean)
    .map((wall) => ({ ...wall, source: "local-raster", confidence: Math.min(wall.confidence, 0.62), requiresConfirmation: true }));
}

export function findWallOrLocalRasterFallback(point, options = {}) {
  const vectorHit = findWallUnderPointer(point, options);
  if (vectorHit) return vectorHit;
  const rasterWalls = buildLocalRasterFallbackWalls(point, options);
  return findWallUnderPointer(point, { ...options, walls: rasterWalls, toleranceScreenPx: Math.max(options.toleranceScreenPx || DEFAULT_MAX_CLICK_DISTANCE, 20) });
}

export function diagnoseWallSelection(point, { planGeometryIndex, page = {}, walls = [], zoomScale = 1, toleranceScreenPx = DEFAULT_MAX_CLICK_DISTANCE } = {}) {
  const tolerance = toleranceScreenPx / Math.max(zoomScale, 0.01);
  const raw = rawWallSegments(planGeometryIndex);
  const nearbyRaw = raw
    .map((line) => {
      const d = line?.a && line?.b ? segmentDistance(point, line.a, line.b).distance : Infinity;
      return { line, distance: d, rejectionReason: lineRejectionReason(line, page) };
    })
    .filter((entry) => entry.distance <= tolerance * 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  const candidates = walls
    .map((wall) => {
      const hit = wallDistanceToPoint(wall, point);
      return {
        wall,
        distance: hit.distance,
        selected: hit.distance <= tolerance,
        rejectionReason: hit.distance <= tolerance ? null : `outside search radius (${hit.distance.toFixed(2)} > ${tolerance.toFixed(2)})`,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  const rasterFallbackWalls = buildLocalRasterFallbackWalls(point, { planGeometryIndex, page, zoomScale, toleranceScreenPx });
  const selected = findWallOrLocalRasterFallback(point, { planGeometryIndex, page, walls, zoomScale, toleranceScreenPx });
  return {
    point,
    pageBounds: { width: page?.sourceWidth || page?.width || 0, height: page?.sourceHeight || page?.height || 0 },
    toleranceDocUnits: tolerance,
    toleranceScreenPx,
    rawVectorSegmentCount: raw.length,
    nearbyRawVectorSegmentCount: nearbyRaw.length,
    wallBandCandidateCount: walls.length,
    localRasterFallbackCandidateCount: rasterFallbackWalls.length,
    nearbyWallBandCandidateCount: candidates.filter((candidate) => candidate.distance <= tolerance * 3).length,
    nearestCandidateDistance: candidates[0]?.distance ?? nearbyRaw[0]?.distance ?? null,
    topRawCandidates: nearbyRaw.map(({ line, distance, rejectionReason }) => ({
      id: line?.id || null,
      distance,
      rejectionReason,
      a: line?.a,
      b: line?.b,
    })),
    topWallCandidates: candidates.map(({ wall, distance, rejectionReason }) => ({
      id: wall.id,
      source: wall.source,
      distance,
      rejectionReason,
      start: wall.centreline.start,
      end: wall.centreline.end,
    })),
    selectedWall: selected ? { id: selected.wall.id, source: selected.wall.source, distance: selected.distance, start: selected.wall.centreline.start, end: selected.wall.centreline.end } : null,
    failureReason: selected ? null : (raw.length ? "no local wall candidate within search radius" : "vector data missing from spatial index"),
  };
}

function samePoint(a, b, tolerance = JUNCTION_TOLERANCE) {
  return Boolean(a && b && distance(a, b) <= tolerance);
}

export function connectedWallSuggestions(endpoint, { walls = [], selectedWalls = [], max = 2 } = {}) {
  if (!endpoint) return [];
  const selectedKeys = new Set(selectedWalls.map((wall) => wallKey(wall)));
  return walls
    .filter((wall) => !selectedKeys.has(wallKey(wall)))
    .map((wall) => {
      const startDistance = distance(endpoint, wall.centreline.start);
      const endDistance = distance(endpoint, wall.centreline.end);
      const d = Math.min(startDistance, endDistance);
      return { wall, distance: d, connectedAt: startDistance <= endDistance ? "start" : "end" };
    })
    .filter((candidate) => candidate.distance <= JUNCTION_TOLERANCE)
    .sort((a, b) => a.distance - b.distance || b.wall.confidence - a.wall.confidence)
    .slice(0, max);
}

function activeEndpoint(graph) {
  if (!graph?.vertices?.length || !graph?.segments?.length) return null;
  const degree = new Map(graph.vertices.map((v) => [v.id, 0]));
  graph.segments.forEach((segment) => {
    degree.set(segment.aId, (degree.get(segment.aId) || 0) + 1);
    degree.set(segment.bId, (degree.get(segment.bId) || 0) + 1);
  });
  const open = graph.vertices.filter((vertex) => (degree.get(vertex.id) || 0) === 1);
  return open[open.length - 1] || graph.vertices[graph.vertices.length - 1] || null;
}

function findOrAddVertex(vertices, point, tolerance = JUNCTION_TOLERANCE) {
  const existing = vertices.find((vertex) => samePoint(vertex, point, tolerance));
  if (existing) return { vertices, id: existing.id, existing: true };
  const vertex = createWallVertex({ id: generateId("wv"), x: point.x, y: point.y });
  return { vertices: [...vertices, vertex], id: vertex.id, existing: false };
}

function segmentExists(segments, aId, bId) {
  return segments.some((segment) => (
    (segment.aId === aId && segment.bId === bId) ||
    (segment.aId === bId && segment.bId === aId)
  ));
}

export function appendDetectedWallToExteriorGraph(currentGraph, detectedWall) {
  const current = currentGraph || { vertices: [], segments: [], isClosed: false };
  const endpoint = activeEndpoint(current);
  let start = detectedWall.centreline.start;
  let end = detectedWall.centreline.end;
  if (endpoint) {
    const startDistance = distance(endpoint, start);
    const endDistance = distance(endpoint, end);
    if (Math.min(startDistance, endDistance) > JUNCTION_TOLERANCE) {
      return { graph: current, accepted: false, reason: "Selected wall is not connected to the current exterior endpoint." };
    }
    if (endDistance < startDistance) [start, end] = [end, start];
  }
  let vertices = current.vertices || [];
  const startResult = findOrAddVertex(vertices, start);
  vertices = startResult.vertices;
  const endResult = findOrAddVertex(vertices, end);
  vertices = endResult.vertices;
  if (startResult.id === endResult.id || segmentExists(current.segments || [], startResult.id, endResult.id)) {
    return { graph: current, accepted: false, reason: "This wall is already part of the exterior path." };
  }
  const segment = createWallSegment({
    id: generateId("ws"),
    aId: startResult.id,
    bId: endResult.id,
    wallType: "exterior",
    source: "manual",
    confirmed: true,
    confidence: detectedWall.confidence >= 0.75 ? "high" : "medium",
  });
  const segments = [...(current.segments || []), { ...segment, detectedWallId: detectedWall.id }];
  const isClosed = vertices.length >= 3 && vertices.every((vertex) => segments.filter((s) => s.aId === vertex.id || s.bId === vertex.id).length === 2);
  const closedPoints = isClosed ? orderedPathPoints({ vertices, segments }) : [];
  if (isClosed && !isSimplePolygon(closedPoints)) {
    return { graph: current, accepted: false, reason: "Selected wall would create a self-intersecting exterior path." };
  }
  return {
    graph: { vertices, segments, isClosed },
    accepted: true,
    closed: isClosed,
    activeEndpoint: isClosed ? null : vertices.find((vertex) => vertex.id === endResult.id),
  };
}

export function orderedPathPoints(graph) {
  const vertices = graph?.vertices || [];
  const segments = graph?.segments || [];
  if (!vertices.length) return [];
  const byId = new Map(vertices.map((v) => [v.id, v]));
  const adjacency = new Map(vertices.map((v) => [v.id, []]));
  segments.forEach((segment) => {
    adjacency.get(segment.aId)?.push(segment.bId);
    adjacency.get(segment.bId)?.push(segment.aId);
  });
  const start = vertices.find((vertex) => (adjacency.get(vertex.id) || []).length === 1) || vertices[0];
  const ordered = [];
  const seen = new Set();
  let current = start.id;
  let previous = null;
  while (current && !seen.has(current)) {
    seen.add(current);
    ordered.push(byId.get(current));
    const next = (adjacency.get(current) || []).find((id) => id !== previous);
    previous = current;
    current = next;
  }
  return ordered.filter(Boolean);
}
