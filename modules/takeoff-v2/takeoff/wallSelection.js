import { createWallSegment, createWallVertex, generateId } from "../types.js";
import { distance, segmentIntersection, isSimplePolygon } from "./geometry.js";

const DEFAULT_MAX_CLICK_DISTANCE = 16;
const DEFAULT_MIN_WALL_LENGTH = 16;
const MIN_OVERLAP = 12;
const MIN_THICKNESS = 2;
const MAX_THICKNESS = 26;
const JUNCTION_TOLERANCE = 10;
const PARALLEL_TOLERANCE_DEG = 3;
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
  return { distance: Math.min(centre.distance, faceA, faceB), projected: centre.point };
}

function isEligibleLine(line, page = {}) {
  if (!line?.a || !line?.b) return false;
  if (line.stroked === false) return false;
  if (line.isText || line.isDimension || line.isPageBorder || line.isTitleBlock || line.isDoorArc || line.isSymbol) return false;
  if (REJECTED_TAGS.has(lineTag(line))) return false;
  if (Array.isArray(line.dashPattern) && line.dashPattern.length > 0) return false;
  if (!colorLooksBlack(line.strokeColor)) return false;
  if (line.pathSegmentCount > 70 && line.length < 40) return false;
  if (isLikelyPageBorder(line, page.sourceWidth || page.width || 0, page.sourceHeight || page.height || 0)) return false;
  return (line.length || distance(line.a, line.b)) >= DEFAULT_MIN_WALL_LENGTH;
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
  const raw = typeof planGeometryIndex?.getCandidateWallSegments === "function"
    ? planGeometryIndex.getCandidateWallSegments()
    : planGeometryIndex?.segments;
  const lines = (Array.isArray(raw) ? raw : [])
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
  const unique = [];
  const seen = new Set();
  walls
    .sort((a, b) => b.confidence - a.confidence || b.length - a.length)
    .forEach((wall) => {
      const key = wallKey(wall);
      if (seen.has(key)) return;
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
    if (hit.distance > tolerance + (wall.thickness || 0) / 2) return;
    const score = wall.confidence * 100 + Math.min(25, wall.length / 12) - hit.distance * 4;
    if (!best || score > best.score) best = { wall, point: hit.projected, distance: hit.distance, score };
  });
  return best;
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
