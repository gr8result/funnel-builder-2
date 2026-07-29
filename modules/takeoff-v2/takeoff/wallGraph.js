// Exterior-wall vertex/segment graph: stitching raw polylines (from AI
// detection or manual drawing) into a connected, editable perimeter, plus all
// manual-edit operations (move/add/delete/split/join/close).
//
// A "graph" here is always the plain shape { vertices, segments } (matching
// PlanPage.exteriorWalls' vertices/segments fields) — callers decide what else
// (confirmed, detectionConfidence, ...) to merge around it.

import { generateId, createWallVertex, createWallSegment } from "../types.js";
import { distance, segmentIntersection } from "./geometry.js";

function findOrCreateVertex(vertices, point, tolerance) {
  for (const vertex of vertices) {
    if (distance(vertex, point) <= tolerance) return vertex;
  }
  const vertex = createWallVertex({ id: generateId("wv"), x: point.x, y: point.y });
  vertices.push(vertex);
  return vertex;
}

// polylines: [{ points: [{x,y}, ...], confidence: "high"|"medium"|"low"|null }]
export function buildWallGraphFromPolylines(polylines = [], { tolerance = 6, source = "automatic" } = {}) {
  const vertices = [];
  const segments = [];
  polylines.forEach((polyline) => {
    const points = polyline.points || [];
    const confidence = polyline.confidence || null;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = findOrCreateVertex(vertices, points[i], tolerance);
      const b = findOrCreateVertex(vertices, points[i + 1], tolerance);
      if (a.id === b.id) continue;
      segments.push(createWallSegment({ id: generateId("ws"), aId: a.id, bId: b.id, source, confidence }));
    }
  });
  return { vertices, segments };
}

export function vertexDegrees(vertices, segments) {
  const degree = new Map(vertices.map((v) => [v.id, 0]));
  segments.forEach((segment) => {
    degree.set(segment.aId, (degree.get(segment.aId) || 0) + 1);
    degree.set(segment.bId, (degree.get(segment.bId) || 0) + 1);
  });
  return degree;
}

function buildAdjacency(vertices, segments) {
  const adjacency = new Map(vertices.map((v) => [v.id, []]));
  segments.forEach((segment) => {
    adjacency.get(segment.aId)?.push(segment.bId);
    adjacency.get(segment.bId)?.push(segment.aId);
  });
  return adjacency;
}

export function isSingleConnectedComponent(vertices, segments) {
  if (vertices.length === 0) return true;
  const adjacency = buildAdjacency(vertices, segments);
  const visited = new Set();
  const stack = [vertices[0].id];
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    (adjacency.get(id) || []).forEach((neighbor) => {
      if (!visited.has(neighbor)) stack.push(neighbor);
    });
  }
  return visited.size === vertices.length;
}

export function hasDisconnectedSegments(vertices, segments) {
  return !isSingleConnectedComponent(vertices, segments);
}

// A perimeter is closed when every vertex has exactly two connecting segments
// and the whole graph is one connected cycle (no branches, no stray chains).
export function isPerimeterClosed(vertices, segments) {
  if (vertices.length < 3 || segments.length < 3) return false;
  const degree = vertexDegrees(vertices, segments);
  for (const vertex of vertices) {
    if (degree.get(vertex.id) !== 2) return false;
  }
  return isSingleConnectedComponent(vertices, segments);
}

// Walks the closed cycle in order, for area/perimeter calculation and for
// rendering the polygon fill. Returns null if the graph isn't a valid closed
// single cycle.
export function orderedPerimeterPoints(vertices, segments) {
  if (!isPerimeterClosed(vertices, segments)) return null;
  const byId = new Map(vertices.map((v) => [v.id, v]));
  const adjacency = buildAdjacency(vertices, segments);
  const ordered = [];
  const visited = new Set();
  let current = vertices[0].id;
  let prev = null;
  while (current && !visited.has(current)) {
    visited.add(current);
    ordered.push(byId.get(current));
    const neighbors = adjacency.get(current) || [];
    const next = neighbors.find((n) => n !== prev) ?? neighbors[0];
    prev = current;
    current = next;
  }
  return ordered.length === vertices.length ? ordered : null;
}

// Vertices with degree 1 — dangling ends of an open perimeter.
export function findOpenEndpoints(vertices, segments) {
  const degree = vertexDegrees(vertices, segments);
  return vertices.filter((vertex) => (degree.get(vertex.id) || 0) === 1);
}

export function addVertex(graph, point) {
  const vertex = createWallVertex({ id: generateId("wv"), x: point.x, y: point.y });
  return { vertices: [...graph.vertices, vertex], segments: graph.segments };
}

export function addSegment(graph, aId, bId, { wallType = "exterior", thicknessMm = null } = {}) {
  if (aId === bId) return graph;
  const exists = graph.segments.some(
    (s) => (s.aId === aId && s.bId === bId) || (s.aId === bId && s.bId === aId)
  );
  if (exists) return graph;
  const segment = createWallSegment({ id: generateId("ws"), aId, bId, wallType, thicknessMm, source: "manual" });
  return { vertices: graph.vertices, segments: [...graph.segments, segment] };
}

export function moveVertex(graph, vertexId, point) {
  return {
    vertices: graph.vertices.map((v) => (v.id === vertexId ? { ...v, x: point.x, y: point.y } : v)),
    segments: graph.segments,
  };
}

export function deleteVertex(graph, vertexId) {
  return {
    vertices: graph.vertices.filter((v) => v.id !== vertexId),
    segments: graph.segments.filter((s) => s.aId !== vertexId && s.bId !== vertexId),
  };
}

export function deleteSegment(graph, segmentId) {
  return { vertices: graph.vertices, segments: graph.segments.filter((s) => s.id !== segmentId) };
}

export function splitSegment(graph, segmentId, point) {
  const segment = graph.segments.find((s) => s.id === segmentId);
  if (!segment) return graph;
  const vertex = createWallVertex({ id: generateId("wv"), x: point.x, y: point.y });
  const shared = { wallType: segment.wallType, thicknessMm: segment.thicknessMm, source: segment.source, confirmed: segment.confirmed, confidence: segment.confidence };
  const segments = graph.segments
    .filter((s) => s.id !== segmentId)
    .concat([
      createWallSegment({ id: generateId("ws"), aId: segment.aId, bId: vertex.id, ...shared }),
      createWallSegment({ id: generateId("ws"), aId: vertex.id, bId: segment.bId, ...shared }),
    ]);
  return { vertices: [...graph.vertices, vertex], segments };
}

// Toggles a segment between "exterior" and "internal" (or sets an explicit
// type) — used by the generic Edit tool's "change wall type" action.
export function changeSegmentWallType(graph, segmentId, wallType) {
  return {
    vertices: graph.vertices,
    segments: graph.segments.map((s) => (s.id === segmentId ? { ...s, wallType } : s)),
  };
}

export function setSegmentThickness(graph, segmentId, thicknessMm) {
  return {
    vertices: graph.vertices,
    segments: graph.segments.map((s) => (s.id === segmentId ? { ...s, thicknessMm } : s)),
  };
}

// Produces the spec-shaped WallSegment view (id/wallType/thicknessMm/source/
// confirmed plus derived start/end/lengthMm) for display, the context panel,
// and the results panel — length is always derived from the vertex graph +
// calibration, never stored redundantly on the segment itself.
export function segmentToWallSegment(graph, segment, mmPerDocumentUnit) {
  const byId = new Map(graph.vertices.map((v) => [v.id, v]));
  const a = byId.get(segment.aId);
  const b = byId.get(segment.bId);
  const start = a ? { x: a.x, y: a.y } : null;
  const end = b ? { x: b.x, y: b.y } : null;
  const lengthMm = start && end && mmPerDocumentUnit ? distance(start, end) * mmPerDocumentUnit : null;
  return {
    id: segment.id,
    wallType: segment.wallType,
    thicknessMm: segment.thicknessMm,
    source: segment.source,
    confirmed: segment.confirmed,
    confidence: segment.confidence,
    start, end, lengthMm,
  };
}

// Total built length of every segment in a graph (does not require the graph
// to be closed — unlike calculatePerimeterMm in areaCalculation.js, which is
// specifically for a confirmed closed exterior perimeter). Used for the
// toolbar/results-panel running totals.
export function sumSegmentLengthsMm(vertices, segments, mmPerDocumentUnit) {
  if (!mmPerDocumentUnit) return 0;
  const byId = new Map(vertices.map((v) => [v.id, v]));
  return segments.reduce((total, segment) => {
    const a = byId.get(segment.aId);
    const b = byId.get(segment.bId);
    if (!a || !b) return total;
    return total + distance(a, b) * mmPerDocumentUnit;
  }, 0);
}

// Merges mergeId into keepId (used when the user drags one open endpoint onto
// another to join them).
export function joinVertices(graph, keepId, mergeId) {
  if (keepId === mergeId) return graph;
  const segments = graph.segments
    .map((s) => ({
      ...s,
      aId: s.aId === mergeId ? keepId : s.aId,
      bId: s.bId === mergeId ? keepId : s.bId,
    }))
    .filter((s) => s.aId !== s.bId);
  return { vertices: graph.vertices.filter((v) => v.id !== mergeId), segments };
}

// If exactly two open endpoints remain and they're within tolerance, closes
// the gap: merges them if effectively coincident, otherwise adds a connecting
// segment. Returns { graph, closed }.
// True if the straight line a->b would cross any segment in the graph that
// doesn't already share one of those two endpoints — used to reject a Close
// Shape action that would create a self-intersecting polygon.
export function wouldClosingSegmentCross(graph, a, b) {
  const byId = new Map(graph.vertices.map((v) => [v.id, v]));
  for (const segment of graph.segments) {
    if (segment.aId === a.id || segment.bId === a.id || segment.aId === b.id || segment.bId === b.id) continue;
    const p1 = byId.get(segment.aId);
    const p2 = byId.get(segment.bId);
    if (!p1 || !p2) continue;
    if (segmentIntersection(a, b, p1, p2)) return true;
  }
  return false;
}

// Returns { graph, closed, reason }. `reason` is only set when closed=false,
// with the exact spec-required wording for the self-intersection case.
export function closePerimeter(graph, toleranceDocUnits = Infinity) {
  const openEndpoints = findOpenEndpoints(graph.vertices, graph.segments);
  if (openEndpoints.length !== 2) {
    return { graph, closed: false, reason: "The perimeter needs exactly two open ends to close." };
  }
  const [a, b] = openEndpoints;
  const gap = distance(a, b);
  if (gap > toleranceDocUnits) {
    return { graph, closed: false, reason: "The two open ends are too far apart to close automatically." };
  }
  if (gap < 1e-6) {
    return { graph: joinVertices(graph, a.id, b.id), closed: true, reason: "" };
  }
  if (wouldClosingSegmentCross(graph, a, b)) {
    return { graph, closed: false, reason: "The perimeter cannot be closed because two wall segments intersect." };
  }
  return { graph: addSegment(graph, a.id, b.id), closed: true, reason: "" };
}
