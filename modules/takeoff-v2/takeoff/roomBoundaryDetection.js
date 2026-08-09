import { polygonAreaDocUnits2, isSimplePolygon, segmentIntersection } from "./geometry.js";
import { offsetPolygonInward } from "./polygonOffset.js";

const MAX_CYCLE_VERTICES = 24;
const MAX_CYCLES = 400;

export function pointInPolygon(point, polygon = []) {
  if (!point || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses = ((pi.y > point.y) !== (pj.y > point.y)) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-9) + pi.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function rectFromCorners(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function rectCenter(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function rectCorners(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function polygonIntersectsRect(polygon, rect) {
  if (!rect || polygon.length < 3) return false;
  if (polygon.some((p) => p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height)) return true;
  if (rectCorners(rect).some((corner) => pointInPolygon(corner, polygon))) return true;
  const corners = rectCorners(rect);
  const rectEdges = corners.map((point, index) => [point, corners[(index + 1) % corners.length]]);
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (rectEdges.some(([c, d]) => segmentIntersection(a, b, c, d))) return true;
  }
  return false;
}

function canonicalCycle(ids) {
  const variants = [];
  for (let i = 0; i < ids.length; i += 1) variants.push([...ids.slice(i), ...ids.slice(0, i)].join("|"));
  const reversed = [...ids].reverse();
  for (let i = 0; i < reversed.length; i += 1) variants.push([...reversed.slice(i), ...reversed.slice(0, i)].join("|"));
  variants.sort();
  return variants[0];
}

function orderedCyclePoints(cycleIds, vertexById) {
  return cycleIds.map((id) => vertexById.get(id)).filter(Boolean);
}

function collectGraphSegments(page, { includeCandidates = false } = {}) {
  const graphs = [page?.exteriorWalls, page?.internalWalls].filter(Boolean);
  return graphs.flatMap((graph) => (graph.segments || [])
    .filter((segment) => includeCandidates || segment.confirmed !== false || segment.source !== "automatic" || segment.confidence === "high")
    .map((segment) => ({ graph, segment })));
}

function buildRoomGraph(page, options = {}) {
  const vertexById = new Map();
  const adjacency = new Map();
  collectGraphSegments(page, options).forEach(({ graph, segment }) => {
    const a = graph.vertices.find((v) => v.id === segment.aId);
    const b = graph.vertices.find((v) => v.id === segment.bId);
    if (!a || !b) return;
    vertexById.set(a.id, a);
    vertexById.set(b.id, b);
    if (!adjacency.has(a.id)) adjacency.set(a.id, new Set());
    if (!adjacency.has(b.id)) adjacency.set(b.id, new Set());
    adjacency.get(a.id).add(b.id);
    adjacency.get(b.id).add(a.id);
  });
  return { vertexById, adjacency };
}

export function findWallCycles(page, options = {}) {
  const { vertexById, adjacency } = buildRoomGraph(page, options);
  const cycles = [];
  const seen = new Set();
  const ids = [...adjacency.keys()].sort();

  function dfs(startId, currentId, path) {
    if (cycles.length >= MAX_CYCLES || path.length > MAX_CYCLE_VERTICES) return;
    const neighbors = [...(adjacency.get(currentId) || [])].sort();
    neighbors.forEach((nextId) => {
      if (nextId === startId && path.length >= 3) {
        const key = canonicalCycle(path);
        if (seen.has(key)) return;
        seen.add(key);
        const points = orderedCyclePoints(path, vertexById);
        if (points.length === path.length && isSimplePolygon(points) && polygonAreaDocUnits2(points) > 0) {
          cycles.push({ vertexIds: [...path], points, areaDocUnits2: polygonAreaDocUnits2(points) });
        }
        return;
      }
      if (path.includes(nextId)) return;
      if (nextId < startId) return;
      dfs(startId, nextId, [...path, nextId]);
    });
  }

  ids.forEach((id) => dfs(id, id, [id]));
  cycles.sort((a, b) => a.areaDocUnits2 - b.areaDocUnits2);
  return cycles;
}

function applyInternalFaceOffset(points, { mmPerDocumentUnit, wallThicknessMm, seedPoint }) {
  if (!(mmPerDocumentUnit > 0) || !(wallThicknessMm > 0)) return points;
  const offset = offsetPolygonInward(points, (wallThicknessMm / 2) / mmPerDocumentUnit);
  if (!offset || (seedPoint && !pointInPolygon(seedPoint, offset))) return points;
  return offset;
}

function holeAreaM2(hole, mmPerDocumentUnit) {
  return polygonAreaDocUnits2(hole.vertices || []) * mmPerDocumentUnit * mmPerDocumentUnit / 1_000_000;
}

export function detectRoomBoundary({
  page,
  seedPoint = null,
  searchRect = null,
  roomLabels = [],
  exclusionCandidates = [],
  wallThicknessMm = 0,
} = {}) {
  if (!page?.calibration) return { valid: false, reason: "Room detection needs a calibrated scale." };
  const mmPerDocumentUnit = page.calibration.mmPerDocumentUnit;
  const point = seedPoint || (searchRect ? rectCenter(searchRect) : null);
  if (!point) return { valid: false, reason: "Room detection needs a click point or search rectangle." };

  const cycles = findWallCycles(page, { includeCandidates: false })
    .filter((cycle) => (searchRect ? polygonIntersectsRect(cycle.points, searchRect) : pointInPolygon(point, cycle.points)))
    .filter((cycle) => pointInPolygon(point, cycle.points) || !searchRect);
  const best = cycles[0];
  if (!best) {
    return { valid: false, reason: "No enclosed room boundary was found. Try a larger rectangle or trace manually." };
  }

  const outerBoundary = applyInternalFaceOffset(best.points, { mmPerDocumentUnit, wallThicknessMm, seedPoint: point });
  const grossAreaM2 = polygonAreaDocUnits2(outerBoundary) * mmPerDocumentUnit * mmPerDocumentUnit / 1_000_000;
  const holes = exclusionCandidates
    .filter((hole) => Array.isArray(hole.vertices) && hole.vertices.length >= 3)
    .filter((hole) => hole.vertices.every((p) => pointInPolygon(p, outerBoundary)))
    .map((hole, index) => ({ id: hole.id || `hole-${index + 1}`, type: hole.type || "custom", vertices: hole.vertices, included: hole.included !== false }));
  const excludedAreaM2 = holes.filter((hole) => hole.included).reduce((total, hole) => total + holeAreaM2(hole, mmPerDocumentUnit), 0);
  const label = roomLabels.find((item) => item?.text && pointInPolygon(item.point, outerBoundary));

  return {
    valid: true,
    source: searchRect ? "rectangle" : "room-detect",
    confidence: searchRect ? 0.82 : 0.88,
    reason: "",
    seedPoint: point,
    searchRect,
    outerBoundary,
    vertices: outerBoundary,
    holes,
    grossAreaM2,
    excludedAreaM2,
    netAreaM2: Math.max(0, grossAreaM2 - excludedAreaM2),
    calculatedAreaM2: Math.max(0, grossAreaM2 - excludedAreaM2),
    name: label?.text || "Room",
    areaType: label?.areaType || "Living Area",
  };
}
