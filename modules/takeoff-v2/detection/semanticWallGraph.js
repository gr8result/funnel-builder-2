import { distance, polygonAreaDocUnits2 } from "../takeoff/geometry.js";

export function buildSemanticWallGraph({ walls = [], openings = [], scale = null } = {}) {
  const nodes = [];
  const nodeByKey = new Map();
  const getNode = (point) => {
    const key = pointKey(point);
    if (nodeByKey.has(key)) return nodeByKey.get(key);
    const node = { id: `node-${nodes.length + 1}`, point: { x: point.x, y: point.y }, connectedEdgeIds: [] };
    nodeByKey.set(key, node);
    nodes.push(node);
    return node;
  };
  const edges = walls.map((wall, index) => {
    const start = getNode(wall.start);
    const end = getNode(wall.end);
    const edge = {
      id: wall.id || `wall-edge-${index + 1}`,
      startNodeId: start.id,
      endNodeId: end.id,
      start: wall.start,
      end: wall.end,
      classification: wall.type || "unknown",
      confidence: wall.confidence ?? null,
      confidenceLabel: confidenceLabel(wall.confidence),
      thicknessMm: wall.thicknessMm ?? null,
      geometry: wall,
      source: wall.source || "semantic-segmentation",
      confirmed: wall.source === "manual" || wall.confirmed === true,
      openings: [],
      logicalContinuity: [],
      lengthMm: scale?.mmPerPixel ? distance(wall.start, wall.end) * scale.mmPerPixel : null,
    };
    start.connectedEdgeIds.push(edge.id);
    end.connectedEdgeIds.push(edge.id);
    return edge;
  });
  attachOpeningsToEdges(edges, openings, scale);
  return {
    nodes,
    edges,
    openings,
    scale,
    diagnostics: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      openingCount: openings.length,
    },
  };
}

export function applyOpeningGapContinuity(graph, { maxGapPx = null } = {}) {
  const edges = graph.edges.map((edge) => ({ ...edge, logicalContinuity: [...(edge.logicalContinuity || [])] }));
  const adaptiveGap = maxGapPx ?? adaptiveGapThreshold(edges, graph.openings);
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const left = edges[i];
      const right = edges[j];
      if (left.classification !== right.classification) continue;
      const bridge = openingBridgeBetween(left, right, graph.openings, adaptiveGap);
      if (!bridge) continue;
      left.logicalContinuity.push({ edgeId: right.id, openingId: bridge.id, reason: `${bridge.type || "opening"} continuity`, gapPx: bridge.gapPx });
      right.logicalContinuity.push({ edgeId: left.id, openingId: bridge.id, reason: `${bridge.type || "opening"} continuity`, gapPx: bridge.gapPx });
    }
  }
  return {
    ...graph,
    edges,
    diagnostics: {
      ...graph.diagnostics,
      continuityLinks: edges.reduce((sum, edge) => sum + edge.logicalContinuity.length, 0) / 2,
      adaptiveGapPx: adaptiveGap,
    },
  };
}

export function reconstructExteriorEnvelope(graph = {}) {
  const exteriorEdges = withContinuityEdges((graph.edges || []).filter((edge) => edge.classification === "exterior"));
  const loops = connectedLoops(exteriorEdges);
  const closedLoops = loops.filter((loop) => loop.closed && loop.points.length >= 4);
  const selected = closedLoops.sort((a, b) => Math.abs(polygonAreaDocUnits2(b.points)) - Math.abs(polygonAreaDocUnits2(a.points)))[0] || null;
  return {
    closed: Boolean(selected),
    points: selected?.points || [],
    edgeIds: selected?.edgeIds || [],
    areaDocUnits2: selected ? polygonAreaDocUnits2(selected.points) : 0,
    algorithm: "connected-wall-graph-loop",
    convexHullUsed: false,
    concavePreserved: selected ? hasConcaveTurn(selected.points) : false,
    diagnostics: {
      exteriorEdgeCount: exteriorEdges.length,
      loopCount: loops.length,
      closedLoopCount: closedLoops.length,
    },
  };
}

function withContinuityEdges(edges) {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const virtual = [];
  const seen = new Set();
  edges.forEach((edge) => {
    (edge.logicalContinuity || []).forEach((link) => {
      const other = byId.get(link.edgeId);
      if (!other) return;
      const key = [edge.id, other.id, link.openingId].sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      const pair = closestEndpointPair(edge, other);
      virtual.push({
        id: `continuity-${edge.id}-${other.id}-${link.openingId}`,
        classification: "exterior",
        start: pair.a,
        end: pair.b,
        source: "logical-opening-continuity",
        confidence: Math.min(edge.confidence ?? 0.5, other.confidence ?? 0.5),
        virtual: true,
      });
    });
  });
  return [...edges, ...virtual];
}

function closestEndpointPair(a, b) {
  return [
    [a.start, b.start],
    [a.start, b.end],
    [a.end, b.start],
    [a.end, b.end],
  ].map(([left, right]) => ({ a: left, b: right, distance: distance(left, right) }))
    .sort((left, right) => left.distance - right.distance)[0];
}

export function semanticPipelineFromMasks({ segmentation, scale = null, vectorise, fallbackWalls = [] } = {}) {
  if (!segmentation?.ok && fallbackWalls.length) {
    const graph = buildSemanticWallGraph({ walls: fallbackWalls, openings: [], scale });
    return { ok: true, source: "fallback-existing-candidates", graph, envelope: reconstructExteriorEnvelope(graph), diagnostics: { fallback: true } };
  }
  const vectors = vectorise(segmentation, { mmPerPixel: scale?.mmPerPixel || null });
  const graph = applyOpeningGapContinuity(buildSemanticWallGraph({ walls: vectors.walls, openings: vectors.openings, scale }));
  return {
    ok: true,
    source: segmentation.provider || "semantic-segmentation",
    vectors,
    graph,
    envelope: reconstructExteriorEnvelope(graph),
    diagnostics: { ...vectors.diagnostics, ...graph.diagnostics },
  };
}

function attachOpeningsToEdges(edges, openings, scale) {
  openings.forEach((opening) => {
    const best = edges
      .map((edge) => ({ edge, projection: projectOntoSegment(openingMidpoint(opening), edge.start, edge.end) }))
      .filter((item) => item.projection.t >= -0.08 && item.projection.t <= 1.08)
      .sort((a, b) => a.projection.distance - b.projection.distance)[0];
    if (!best) return;
    const widthMm = opening.widthMm ?? (scale?.mmPerPixel ? distance(opening.start, opening.end) * scale.mmPerPixel : null);
    best.edge.openings.push({
      id: opening.id,
      type: opening.type,
      startOffset: best.projection.t,
      endOffset: best.projection.t,
      widthMm,
      confidence: opening.confidence ?? null,
    });
  });
}

function openingBridgeBetween(a, b, openings, maxGapPx) {
  if (orientationOf(a) !== orientationOf(b)) return null;
  const pairs = [
    [a.end, b.start],
    [a.start, b.end],
    [a.start, b.start],
    [a.end, b.end],
  ];
  const closest = pairs
    .map(([leftPoint, rightPoint]) => ({ leftPoint, rightPoint, gapPx: distance(leftPoint, rightPoint) }))
    .sort((left, right) => left.gapPx - right.gapPx)[0];
  if (!closest || closest.gapPx > maxGapPx || closest.gapPx <= 4) return null;
  if (orientationBetween(closest.leftPoint, closest.rightPoint) !== orientationOf(a)) return null;
  const mid = midpoint(closest.leftPoint, closest.rightPoint);
  const opening = openings
    .filter((candidate) => ["door", "window", "garage-door", "garage_door", "opening"].includes(candidate.type))
    .map((candidate) => ({ ...candidate, distance: distance(openingMidpoint(candidate), mid) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!opening || opening.distance > Math.max(maxGapPx, closest.gapPx + 4)) return null;
  return { ...opening, gapPx: closest.gapPx };
}

function orientationOf(edge) {
  return Math.abs(edge.end.x - edge.start.x) >= Math.abs(edge.end.y - edge.start.y) ? "horizontal" : "vertical";
}

function orientationBetween(a, b) {
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "horizontal" : "vertical";
}

function connectedLoops(edges) {
  const unused = new Set(edges.map((edge) => edge.id));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const loops = [];
  while (unused.size) {
    const first = edgeById.get(unused.values().next().value);
    unused.delete(first.id);
    const points = [first.start, first.end];
    const edgeIds = [first.id];
    let extended = true;
    while (extended) {
      extended = false;
      for (const id of [...unused]) {
        const edge = edgeById.get(id);
        const head = points[points.length - 1];
        const tail = points[0];
        if (samePoint(edge.start, head)) {
          points.push(edge.end);
        } else if (samePoint(edge.end, head)) {
          points.push(edge.start);
        } else if (samePoint(edge.end, tail)) {
          points.unshift(edge.start);
        } else if (samePoint(edge.start, tail)) {
          points.unshift(edge.end);
        } else {
          continue;
        }
        unused.delete(id);
        edgeIds.push(id);
        extended = true;
      }
    }
    const closed = points.length > 3 && samePoint(points[0], points[points.length - 1]);
    loops.push({ points: closed ? points.slice(0, -1) : points, edgeIds, closed });
  }
  return loops;
}

function adaptiveGapThreshold(edges, openings) {
  const thicknesses = edges.map((edge) => Number(edge.geometry?.providerGeometry?.thicknessPx || edge.thicknessPx)).filter(Number.isFinite);
  const widths = openings.map((opening) => distance(opening.start || { x: 0, y: 0 }, opening.end || { x: 0, y: 0 })).filter(Number.isFinite);
  const thickness = median(thicknesses) || 8;
  const openingWidth = median(widths) || thickness * 8;
  return Math.max(thickness * 3, openingWidth * 1.15, 16);
}

function projectOntoSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 ? ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2 : 0;
  const clamped = Math.max(0, Math.min(1, t));
  const projected = { x: a.x + abx * clamped, y: a.y + aby * clamped };
  return { point: projected, t: clamped, distance: distance(point, projected) };
}

function confidenceLabel(confidence) {
  if (confidence >= 0.8) return "HIGH";
  if (confidence >= 0.55) return "MEDIUM";
  return "LOW";
}

function pointKey(point) {
  return `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
}

function samePoint(a, b) {
  return distance(a, b) <= 12;
}

function openingMidpoint(opening) {
  if (opening.start && opening.end) return midpoint(opening.start, opening.end);
  return { x: 0, y: 0 };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function hasConcaveTurn(points = []) {
  if (points.length < 4) return false;
  const signs = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-6) signs.push(Math.sign(cross));
  }
  return new Set(signs).size > 1;
}
