import { bestSnapCandidate } from "./planSnap.js";
import { distance, isSimplePolygon, polygonAreaDocUnits2, polygonPerimeter } from "./geometry.js";
import { createWallSegment, createWallVertex, generateId } from "../types.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";

const NODE_TOLERANCE = 3;
const MIN_EDGE_LENGTH = 4;
const DEFAULT_SMALL_GAP_TOLERANCE = 0;

function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function normalizeAngle(value) {
  const twoPi = Math.PI * 2;
  let next = value % twoPi;
  if (next < 0) next += twoPi;
  return next;
}

function pointKey(point, tolerance = NODE_TOLERANCE) {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

function lineBounds(line) {
  return {
    minX: Math.min(line.start?.x ?? line.a.x, line.end?.x ?? line.b.x),
    minY: Math.min(line.start?.y ?? line.a.y, line.end?.y ?? line.b.y),
    maxX: Math.max(line.start?.x ?? line.a.x, line.end?.x ?? line.b.x),
    maxY: Math.max(line.start?.y ?? line.a.y, line.end?.y ?? line.b.y),
  };
}

function isAxisTraceLine(line) {
  if (!line?.start || !line?.end) return false;
  const dx = Math.abs(line.end.x - line.start.x);
  const dy = Math.abs(line.end.y - line.start.y);
  return Math.max(dx, dy) >= MIN_EDGE_LENGTH && Math.min(dx, dy) <= Math.max(2, Math.max(dx, dy) * 0.08);
}

function inRegion(point, region, pad = 8) {
  if (!region) return true;
  return (
    point.x >= region.x - pad &&
    point.y >= region.y - pad &&
    point.x <= region.x + region.width + pad &&
    point.y <= region.y + region.height + pad
  );
}

function pointOnLineCoordinate(point, line) {
  const horizontal = Math.abs(line.end.x - line.start.x) >= Math.abs(line.end.y - line.start.y);
  return horizontal ? point.x : point.y;
}

function pointOnSegment(point, line, tolerance = NODE_TOLERANCE) {
  const a = line.start;
  const b = line.end;
  const length = distance(a, b);
  if (length <= 0) return false;
  const area = Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x));
  if (area / length > tolerance) return false;
  const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
  return dot <= tolerance * tolerance;
}

function addNode(nodes, buckets, point, source = "line") {
  const bucket = pointKey(point);
  const nearby = [];
  const [kx, ky] = bucket.split(":").map(Number);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) nearby.push(`${kx + dx}:${ky + dy}`);
  }
  for (const key of nearby) {
    for (const id of buckets.get(key) || []) {
      const node = nodes.get(id);
      if (node && distance(node.point, point) <= NODE_TOLERANCE) {
        node.sources.add(source);
        return node.id;
      }
    }
  }
  const id = `tn-${nodes.size + 1}`;
  const node = { id, point: { x: point.x, y: point.y }, connectedEdgeIds: [], sources: new Set([source]) };
  nodes.set(id, node);
  if (!buckets.has(bucket)) buckets.set(bucket, []);
  buckets.get(bucket).push(id);
  return id;
}

function edgeKey(aId, bId) {
  return [aId, bId].sort().join("|");
}

function addEdge(edges, nodes, startNodeId, endNodeId, lineIds, bridgedGapLength = 0) {
  if (!startNodeId || !endNodeId || startNodeId === endNodeId) return null;
  const a = nodes.get(startNodeId);
  const b = nodes.get(endNodeId);
  if (!a || !b) return null;
  const length = distance(a.point, b.point);
  if (length < MIN_EDGE_LENGTH) return null;
  const key = edgeKey(startNodeId, endNodeId);
  const existing = edges.get(key);
  if (existing) {
    lineIds.forEach((lineId) => {
      if (lineId && !existing.lineIds.includes(lineId)) existing.lineIds.push(lineId);
    });
    existing.wallEvidence += 1;
    existing.bridgedGapLength = Math.min(existing.bridgedGapLength || Infinity, bridgedGapLength || 0);
    return existing.id;
  }
  const id = `te-${edges.size + 1}`;
  const edge = {
    id,
    startNodeId,
    endNodeId,
    lineIds: lineIds.filter(Boolean),
    length,
    angle: normalizeAngle(angle(a.point, b.point)),
    wallEvidence: Math.max(1, lineIds.filter(Boolean).length),
    wallSupport: Math.max(1, lineIds.filter(Boolean).length),
    traceable: bridgedGapLength === 0 && lineIds.filter(Boolean).length > 0,
    bridgedGapLength,
  };
  edges.set(key, edge);
  a.connectedEdgeIds.push(id);
  b.connectedEdgeIds.push(id);
  return id;
}

function edgeOtherNode(edge, nodeId) {
  return edge.startNodeId === nodeId ? edge.endNodeId : edge.startNodeId;
}

function graphBounds(nodes) {
  const list = Array.from(nodes.values());
  return list.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.point.x),
      minY: Math.min(acc.minY, node.point.y),
      maxX: Math.max(acc.maxX, node.point.x),
      maxY: Math.max(acc.maxY, node.point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function componentIds(graph) {
  const seen = new Set();
  const components = [];
  graph.nodes.forEach((node) => {
    if (seen.has(node.id)) return;
    const stack = [node.id];
    const ids = [];
    seen.add(node.id);
    while (stack.length) {
      const id = stack.pop();
      ids.push(id);
      const current = graph.nodeById.get(id);
      current.connectedEdgeIds.forEach((edgeId) => {
        const edge = graph.edgeById.get(edgeId);
        const otherId = edgeOtherNode(edge, id);
        if (!seen.has(otherId)) {
          seen.add(otherId);
          stack.push(otherId);
        }
      });
    }
    components.push(ids);
  });
  return components.sort((a, b) => b.length - a.length);
}

function pruneToMainComponent(graph) {
  const main = componentIds(graph)[0] || [];
  const keep = new Set(main);
  const nodes = graph.nodes.filter((node) => keep.has(node.id));
  const edges = graph.edges.filter((edge) => keep.has(edge.startNodeId) && keep.has(edge.endNodeId));
  return finalizeGraph(nodes, edges, graph.diagnostics);
}

function finalizeGraph(nodesInput, edgesInput, diagnostics = {}) {
  const nodes = nodesInput.map((node) => ({
    id: node.id,
    point: node.point,
    connectedEdgeIds: [...node.connectedEdgeIds],
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = edgesInput.map((edge) => ({ ...edge }));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  nodes.forEach((node) => { node.connectedEdgeIds = []; });
  edges.forEach((edge) => {
    nodeById.get(edge.startNodeId)?.connectedEdgeIds.push(edge.id);
    nodeById.get(edge.endNodeId)?.connectedEdgeIds.push(edge.id);
  });
  return { nodes, edges, nodeById, edgeById, bounds: graphBounds(nodeById), diagnostics };
}

export function buildTraceGraphFromPlanGeometry(planGeometryIndex, { planRegion = null, smallGapTolerance = DEFAULT_SMALL_GAP_TOLERANCE } = {}) {
  const rawLines = Array.isArray(planGeometryIndex?.lines) ? planGeometryIndex.lines : [];
  const lines = rawLines.filter(isAxisTraceLine).filter((line) => inRegion(line.start, planRegion) && inRegion(line.end, planRegion));
  const nodes = new Map();
  const buckets = new Map();
  const edgeMap = new Map();
  const pointsByLine = new Map();

  lines.forEach((line) => {
    pointsByLine.set(line.id, [line.start, line.end]);
  });

  (planGeometryIndex?.intersections || []).forEach((intersection) => {
    if (!inRegion(intersection.point, planRegion)) return;
    (intersection.lineIds || []).forEach((lineId) => {
      const line = lines.find((item) => item.id === lineId);
      if (line && pointOnSegment(intersection.point, line)) pointsByLine.get(lineId)?.push(intersection.point);
    });
  });

  lines.forEach((line) => {
    const values = (pointsByLine.get(line.id) || [])
      .filter((point) => pointOnSegment(point, line))
      .sort((a, b) => pointOnLineCoordinate(a, line) - pointOnLineCoordinate(b, line));
    const unique = [];
    values.forEach((point) => {
      const prev = unique[unique.length - 1];
      if (!prev || distance(prev, point) > NODE_TOLERANCE) unique.push(point);
    });
    for (let i = 0; i < unique.length - 1; i += 1) {
      const aId = addNode(nodes, buckets, unique[i], "line");
      const bId = addNode(nodes, buckets, unique[i + 1], "line");
      addEdge(edgeMap, nodes, aId, bId, [line.id], 0);
    }
  });

  const byAxis = new Map();
  lines.forEach((line) => {
    const horizontal = Math.abs(line.end.x - line.start.x) >= Math.abs(line.end.y - line.start.y);
    const fixed = horizontal ? (line.start.y + line.end.y) / 2 : (line.start.x + line.end.x) / 2;
    const key = `${horizontal ? "h" : "v"}:${Math.round(fixed / NODE_TOLERANCE)}`;
    if (!byAxis.has(key)) byAxis.set(key, []);
    byAxis.get(key).push({ line, horizontal, fixed, bounds: lineBounds(line) });
  });
  if (smallGapTolerance > 0) byAxis.forEach((group) => {
    group.sort((a, b) => (a.horizontal ? a.bounds.minX - b.bounds.minX : a.bounds.minY - b.bounds.minY));
    for (let i = 0; i < group.length - 1; i += 1) {
      const current = group[i];
      const next = group[i + 1];
      const gap = current.horizontal ? next.bounds.minX - current.bounds.maxX : next.bounds.minY - current.bounds.maxY;
      if (gap <= 0 || gap > smallGapTolerance) continue;
      const a = current.horizontal ? { x: current.bounds.maxX, y: current.fixed } : { x: current.fixed, y: current.bounds.maxY };
      const b = current.horizontal ? { x: next.bounds.minX, y: next.fixed } : { x: next.fixed, y: next.bounds.minY };
      const aId = addNode(nodes, buckets, a, "gap");
      const bId = addNode(nodes, buckets, b, "gap");
      addEdge(edgeMap, nodes, aId, bId, [current.line.id, next.line.id], gap);
    }
  });

  const graph = finalizeGraph(Array.from(nodes.values()), Array.from(edgeMap.values()), {
    source: "manual-trace-plan-geometry",
    lineCount: lines.length,
    intersectionCount: planGeometryIndex?.intersections?.length || 0,
  });
  return pruneToMainComponent(graph);
}

export function selectExteriorStartNode(graph) {
  const candidates = graph.nodes
    .filter((node) => node.connectedEdgeIds.length >= 2)
    .map((node) => {
      const edgeEvidence = node.connectedEdgeIds.reduce((sum, edgeId) => sum + (graph.edgeById.get(edgeId)?.wallEvidence || 0), 0);
      return { node, edgeEvidence };
    })
    .sort((a, b) => (
      a.node.point.y - b.node.point.y ||
      a.node.point.x - b.node.point.x ||
      b.edgeEvidence - a.edgeEvidence ||
      a.node.id.localeCompare(b.node.id)
    ));
  return candidates[0]?.node || null;
}

function directedKey(edgeId, fromNodeId) {
  return `${edgeId}:${fromNodeId}`;
}

function directedOutgoing(graph, nodeId) {
  const node = graph.nodeById.get(nodeId);
  return (node?.connectedEdgeIds || []).map((edgeId) => {
    const edge = graph.edgeById.get(edgeId);
    const toNodeId = edgeOtherNode(edge, nodeId);
    return { edge, fromNodeId: nodeId, toNodeId, angle: angle(graph.nodeById.get(nodeId).point, graph.nodeById.get(toNodeId).point) };
  }).sort((a, b) => normalizeAngle(a.angle) - normalizeAngle(b.angle));
}

function nextClockwiseHalfEdge(graph, current) {
  const reverseAngle = angle(graph.nodeById.get(current.toNodeId).point, graph.nodeById.get(current.fromNodeId).point);
  const outgoing = directedOutgoing(graph, current.toNodeId).filter((item) => item.toNodeId !== current.fromNodeId);
  if (!outgoing.length) return null;
  return outgoing
    .map((item) => ({ item, turn: normalizeAngle(reverseAngle - item.angle) }))
    .sort((a, b) => a.turn - b.turn || b.item.edge.wallEvidence - a.item.edge.wallEvidence || a.item.edge.id.localeCompare(b.item.edge.id))[0].item;
}

function loopFromHalfEdge(graph, first, debug) {
  const visited = new Set();
  const nodes = [first.fromNodeId];
  const edges = [];
  let current = first;
  for (let guard = 0; guard <= graph.edges.length * 2 + 10; guard += 1) {
    const key = directedKey(current.edge.id, current.fromNodeId);
    if (visited.has(key)) return null;
    visited.add(key);
    edges.push(current.edge);
    nodes.push(current.toNodeId);
    if (current.toNodeId === first.fromNodeId) {
      nodes.pop();
      return { nodeIds: nodes, edges, points: nodes.map((id) => graph.nodeById.get(id).point), debug };
    }
    const outgoing = directedOutgoing(graph, current.toNodeId);
    const rejected = outgoing
      .filter((item) => item.toNodeId === current.fromNodeId)
      .map((item) => ({ edgeId: item.edge.id, reason: "reject edge just travelled" }));
    const next = nextClockwiseHalfEdge(graph, current);
    if (!next) return null;
    debug.steps.push({
      nodeId: current.toNodeId,
      chosenEdgeId: next.edge.id,
      rejected,
    });
    current = next;
  }
  return null;
}

function loopHasRepeatedNodes(loop) {
  return new Set(loop.nodeIds).size !== loop.nodeIds.length;
}

function collinear(a, b, c) {
  return Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) <= 1e-6;
}

function simplifyCollinearLoop(loop) {
  if (!loop || loop.points.length < 4) return loop;
  const points = [...loop.points];
  const edges = [...loop.edges];
  const nodeIds = [...loop.nodeIds];
  let changed = true;
  while (changed && points.length >= 4) {
    changed = false;
    for (let i = 0; i < points.length; i += 1) {
      const prevIndex = (i - 1 + points.length) % points.length;
      const nextIndex = (i + 1) % points.length;
      if (!collinear(points[prevIndex], points[i], points[nextIndex])) continue;
      const prevEdge = edges[prevIndex];
      const nextEdge = edges[i];
      const merged = {
        ...prevEdge,
        id: `${prevEdge.id}+${nextEdge.id}`,
        endNodeId: nextEdge.endNodeId,
        lineIds: Array.from(new Set([...(prevEdge.lineIds || []), ...(nextEdge.lineIds || [])])),
        length: prevEdge.length + nextEdge.length,
        wallEvidence: (prevEdge.wallEvidence || 0) + (nextEdge.wallEvidence || 0),
        bridgedGapLength: (prevEdge.bridgedGapLength || 0) + (nextEdge.bridgedGapLength || 0),
      };
      edges[prevIndex] = merged;
      points.splice(i, 1);
      nodeIds.splice(i, 1);
      edges.splice(i, 1);
      changed = true;
      break;
    }
  }
  return { ...loop, points, edges, nodeIds };
}

export function manualTraceCanSnapTo(segment, { planGeometryIndex, zoomScale = 1 } = {}) {
  if (!segment?.a || !segment?.b || !planGeometryIndex) return false;
  if (segment.bridgedGapLength > 0) return false;
  const lineIds = new Set(segment.lineIds || []);
  if (!lineIds.size) return false;
  const midpoint = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
  const snap = bestSnapCandidate(midpoint, { planGeometryIndex, toleranceScreenPx: 12, zoomScale });
  if (!snap) return false;
  return snap.type === "line" && lineIds.has(snap.lineId);
}

export function walkExteriorBoundary(graph, { planGeometryIndex = null, minArea = 1000 } = {}) {
  const loops = [];
  graph.nodes.forEach((node) => {
    directedOutgoing(graph, node.id).forEach((first) => {
      const debug = { startNodeId: node.id, visitedNodeIds: [], steps: [{ nodeId: node.id, chosenEdgeId: first.edge.id, rejected: [] }] };
      const loop = loopFromHalfEdge(graph, first, debug);
      if (!loop || loop.points.length < 4 || loopHasRepeatedNodes(loop)) return;
      if (!isSimplePolygon(loop.points)) return;
      const area = polygonAreaDocUnits2(loop.points);
      if (area < minArea) return;
      const unsupported = loop.edges.filter((edge, index) => {
        const a = loop.points[index];
        const b = loop.points[(index + 1) % loop.points.length];
        if (!edge.traceable || edge.bridgedGapLength > 0 || !graph.nodeById.has(edge.startNodeId) || !graph.nodeById.has(edge.endNodeId)) return true;
        return !manualTraceCanSnapTo({ a, b, lineIds: edge.lineIds, bridgedGapLength: edge.bridgedGapLength }, { planGeometryIndex });
      });
      if (unsupported.length) return;
      loop.debug.visitedNodeIds = loop.nodeIds;
      loops.push({ ...loop, area: polygonAreaDocUnits2(loop.points), perimeter: polygonPerimeter(loop.points), bridgedGaps: loop.edges.filter((edge) => edge.bridgedGapLength > 0) });
    });
  });
  loops.sort((a, b) => b.area - a.area || a.points.length - b.points.length);
  const best = loops[0];
  if (!best) {
    const start = selectExteriorStartNode(graph);
    return { ok: false, reason: "Automatic exterior not detected reliably. Use Trace Exterior.", debug: { startNodeId: start?.id || null, steps: [], candidateLoopCount: loops.length, candidateLoopAreas: [] } };
  }
  best.debug.candidateLoopCount = loops.length;
  best.debug.candidateLoopAreas = loops.slice(0, 8).map((loop) => Math.round(loop.area));
  return { ok: true, loop: best, debug: best.debug };
}

export function traceLoopToExteriorGraph(loop) {
  const vertices = loop.points.map((point) => createWallVertex({ id: generateId("wv"), x: point.x, y: point.y }));
  const segments = vertices.map((vertex, index) => createWallSegment({
    id: generateId("ws"),
    aId: vertex.id,
    bId: vertices[(index + 1) % vertices.length].id,
    wallType: "exterior",
    source: "automatic",
    confidence: "high",
    sourceTraceEdgeId: loop.edges[index]?.id || null,
    sourceLineIds: loop.edges[index]?.lineIds || [],
    bridgedGapLength: loop.edges[index]?.bridgedGapLength || 0,
    confirmed: true,
  }));
  return { vertices, segments };
}

export function detectExteriorFromTraceGraph({ planGeometryIndex, page = {}, planRegion = null } = {}) {
  const safePage = page || {};
  const normalizedIndex = typeof planGeometryIndex?.findSnapCandidates === "function"
    ? planGeometryIndex
    : buildPlanGeometryIndex(planGeometryIndex?.segments || planGeometryIndex?.rawSegments || [], {
      pageWidth: safePage.sourceWidth || safePage.width || 0,
      pageHeight: safePage.sourceHeight || safePage.height || 0,
      source: planGeometryIndex?.source || "pdf-vector",
    });
  const graph = buildTraceGraphFromPlanGeometry(normalizedIndex, { planRegion });
  const pageArea = (safePage.sourceWidth || safePage.width || 0) * (safePage.sourceHeight || safePage.height || 0);
  const regionArea = planRegion?.width && planRegion?.height ? planRegion.width * planRegion.height : pageArea;
  const walked = walkExteriorBoundary(graph, { planGeometryIndex: normalizedIndex, minArea: Math.max(1000, regionArea * 0.01) });
  if (!walked.ok) {
    return {
      connected: true,
      vertices: [],
      segments: [],
      isClosed: false,
      exteriorPerimeter: null,
      detectionConfidence: 0,
      completeness: 0,
      connectedComponents: 0,
      openGaps: 0,
      useful: false,
      warnings: [walked.reason],
      diagnostics: { source: "manual-trace-graph", traceGraph: graph.diagnostics, traceGraphNodeCount: graph.nodes.length, traceGraphEdgeCount: graph.edges.length, traceGraphDebug: walked.debug },
      message: "Automatic exterior not detected reliably. Use Trace Exterior.",
    };
  }
  const exteriorGraph = traceLoopToExteriorGraph(walked.loop);
  const selfIntersectionCount = isSimplePolygon(walked.loop.points) ? 0 : 1;
  return {
    connected: true,
    vertices: exteriorGraph.vertices,
    segments: exteriorGraph.segments,
    isClosed: true,
    exteriorPerimeter: {
      points: walked.loop.points.map((point) => ({ x: point.x, y: point.y })),
      closed: true,
      area: walked.loop.area,
      perimeter: walked.loop.perimeter,
      selfIntersectionCount,
      selfIntersections: selfIntersectionCount,
      gapCount: walked.loop.bridgedGaps.length,
      bridgedGaps: walked.loop.bridgedGaps.map((edge) => ({ edgeId: edge.id, length: edge.bridgedGapLength, lineIds: edge.lineIds })),
      wallSupportRatio: 1,
      areaDocumentUnits: walked.loop.area,
      perimeterDocumentUnits: walked.loop.perimeter,
      confidence: 88,
    },
    detectionConfidence: 88,
    completeness: 100,
    connectedComponents: 1,
    openGaps: walked.loop.bridgedGaps.length,
    useful: true,
    warnings: [],
    diagnostics: {
      source: "manual-trace-graph",
      traceGraph: graph.diagnostics,
      traceGraphNodeCount: graph.nodes.length,
      traceGraphEdgeCount: graph.edges.length,
      traceGraphNodes: graph.nodes.map((node) => ({ id: node.id, x: node.point.x, y: node.point.y, connectedEdgeIds: node.connectedEdgeIds })),
      traceGraphEdges: graph.edges.map((edge) => ({
        id: edge.id,
        startNodeId: edge.startNodeId,
        endNodeId: edge.endNodeId,
        sourceLineIds: edge.lineIds,
        angle: edge.angle,
        length: edge.length,
        wallSupport: edge.wallSupport,
        traceable: edge.traceable,
      })),
      traceGraphDebug: walked.debug,
      startNodeId: walked.debug.startNodeId,
      finalLoop: {
        points: walked.loop.points.map((point, index) => ({ id: walked.loop.nodeIds[index] || `loop-${index + 1}`, x: point.x, y: point.y })),
        edges: walked.loop.edges.map((edge, index) => ({
          id: edge.id,
          from: walked.loop.points[index],
          to: walked.loop.points[(index + 1) % walked.loop.points.length],
          startNodeId: edge.startNodeId,
          endNodeId: edge.endNodeId,
          lineIds: edge.lineIds,
          bridgedGapLength: edge.bridgedGapLength,
          whySelected: "outer-face clockwise traceable edge walk",
        })),
      },
      manualTraceProof: exteriorGraph.segments.map((segment, index) => ({
        segmentId: segment.id,
        traceEdgeId: segment.sourceTraceEdgeId,
        sourceLineIds: segment.sourceLineIds,
        startNodeId: walked.loop.edges[index]?.startNodeId || null,
        endNodeId: walked.loop.edges[index]?.endNodeId || null,
        whySelected: "outer-face clockwise traceable edge walk",
        manualTraceable: manualTraceCanSnapTo({
          a: walked.loop.points[index],
          b: walked.loop.points[(index + 1) % walked.loop.points.length],
          lineIds: segment.sourceLineIds,
          bridgedGapLength: segment.bridgedGapLength,
        }, { planGeometryIndex: normalizedIndex }),
        manualTraceValidation: manualTraceCanSnapTo({
          a: walked.loop.points[index],
          b: walked.loop.points[(index + 1) % walked.loop.points.length],
          lineIds: segment.sourceLineIds,
          bridgedGapLength: segment.bridgedGapLength,
        }, { planGeometryIndex: normalizedIndex }) ? "PASS" : "FAIL",
      })),
    },
    message: `Exterior candidate found - one closed perimeter from ${walked.loop.points.length} trace-graph corners.`,
  };
}
