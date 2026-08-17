import {
  CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
  EXTERIOR_SOURCE_AUTO_DETECTOR_V2,
  createWallSegment,
  createWallVertex,
} from "../types.js";
import { isPerimeterClosed } from "../takeoff/wallGraph.js";

export function normalisedWallsToWallGraph(walls = [], { wallType = "exterior", providerId = "provider" } = {}) {
  const vertices = [];
  const segments = [];
  const vertexByKey = new Map();

  const getVertex = (point) => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const key = `${roundCoord(x)},${roundCoord(y)}`;
    const existing = vertexByKey.get(key);
    if (existing) return existing;
    const vertex = createWallVertex({ x, y });
    vertexByKey.set(key, vertex);
    vertices.push(vertex);
    return vertex;
  };

  walls.forEach((wall) => {
    if (!wall?.start || !wall?.end) return;
    const effectiveType = wall.type === "unknown" ? wallType : wall.type;
    if (wallType && effectiveType !== wallType) return;
    const a = getVertex(wall.start);
    const b = getVertex(wall.end);
    if (!a || !b || a.id === b.id) return;
    segments.push(createWallSegment({
      wallType: effectiveType,
      aId: a.id,
      bId: b.id,
      source: providerId,
      confirmed: false,
      confidence: wall.confidence ?? null,
      thicknessMm: wall.thicknessMm ?? null,
      providerWallId: wall.id || null,
      innerFace: wall.innerFace || null,
      outerFace: wall.outerFace || null,
      intermediateFaces: Array.isArray(wall.intermediateFaces) ? wall.intermediateFaces : [],
      constructionLineCount: wall.constructionLineCount ?? null,
      providerGeometry: wall.providerGeometry || null,
      metadata: wall.metadata || {},
    }));
  });

  return {
    vertices,
    segments,
    isClosed: isPerimeterClosed(vertices, segments),
  };
}

export function normalisedWallsToExteriorCandidate(walls = [], { page = {}, providerId = "provider" } = {}) {
  const graph = normalisedWallsToWallGraph(walls, { wallType: "exterior", providerId });
  const confidences = graph.segments
    .map((segment) => Number(segment.confidence))
    .filter(Number.isFinite);
  const detectionConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null;

  return {
    boundaryBasis: page?.exteriorWalls?.boundaryBasis || "outside",
    wallThicknessMm: page?.exteriorWalls?.wallThicknessMm ?? 200,
    schemaVersion: CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
    source: EXTERIOR_SOURCE_AUTO_DETECTOR_V2,
    vertices: graph.vertices,
    segments: graph.segments,
    isClosed: graph.isClosed,
    confirmed: false,
    confirmedAt: null,
    reviewStatus: graph.segments.length ? "candidate-ready" : "candidate-empty",
    detectionConfidence,
    detectionCompleteness: null,
    connectedComponents: null,
    openGaps: 0,
    detectionWarnings: [],
    detectionDiagnostics: null,
    exteriorPerimeter: null,
    detectedSnapshot: {
      vertices: graph.vertices,
      segments: graph.segments,
    },
  };
}

function roundCoord(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
