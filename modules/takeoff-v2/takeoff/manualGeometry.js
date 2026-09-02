import { distance, polygonAreaDocUnits2 } from "./geometry.js";
import { projectOntoWall } from "./openingPlacement.js";

export const OPENING_TYPE_ALIASES = {
  door: "door",
  "internal-door": "door",
  "external-door": "door",
  "sliding-door": "door",
  window: "window",
  opening: "opening",
  "open-opening": "opening",
  garage_door: "garage_door",
  "garage-door": "garage_door",
};

export function canonicalOpeningType(type) {
  return OPENING_TYPE_ALIASES[type] || type || "opening";
}

export function wallGraphKeyForField(field) {
  return field === "internalWalls" ? "internal" : "exterior";
}

export function wallTypeForField(field) {
  return field === "internalWalls" ? "interior" : "exterior";
}

export function fieldForWallGraphKey(key) {
  return key === "internal" ? "internalWalls" : "exteriorWalls";
}

export function wallRecordFromSegment({ graph, segment, field = "exteriorWalls", levelId = null, openings = [], mmPerDocumentUnit = null }) {
  const byId = new Map((graph?.vertices || []).map((vertex) => [vertex.id, vertex]));
  const start = byId.get(segment?.aId);
  const end = byId.get(segment?.bId);
  if (!segment || !start || !end) return null;
  const attachedOpeningIds = openings
    .filter((opening) => opening.wallId === segment.id)
    .map((opening) => opening.id);
  return {
    id: segment.id,
    type: wallTypeForField(field),
    levelId,
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    centreline: segment.centreline || { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
    innerFace: segment.innerFace || null,
    outerFace: segment.outerFace || null,
    faceA: segment.faceA || null,
    faceB: segment.faceB || null,
    intermediateFaces: Array.isArray(segment.intermediateFaces) ? segment.intermediateFaces : [],
    thicknessPx: segment.thicknessPx ?? null,
    thicknessMm: segment.thicknessMm ?? graph?.wallThicknessMm ?? null,
    constructionLineCount: segment.constructionLineCount ?? null,
    constructionType: segment.constructionType || inferredConstructionType(segment, field),
    source: segment.source === "automatic" ? "ai" : (segment.source || "manual"),
    confidence: segment.confidence ?? null,
    locked: Boolean(segment.locked),
    openings: attachedOpeningIds,
    lengthMm: mmPerDocumentUnit ? distance(start, end) * mmPerDocumentUnit : null,
    createdAt: segment.createdAt || null,
    updatedAt: segment.updatedAt || null,
  };
}

function inferredConstructionType(segment, field) {
  const thickness = Number(segment?.thicknessMm);
  if (field === "exteriorWalls") {
    if (thickness >= 180 && thickness <= 300 && Number(segment?.constructionLineCount || 0) >= 3) return "brick veneer";
    if (thickness > 0 && thickness < 180) return "lightweight cladding";
    return null;
  }
  if (thickness >= 55 && thickness <= 85) return "70mm frame";
  if (thickness > 85 && thickness <= 115) return "90mm frame";
  if (thickness > 115 && thickness <= 165) return "140mm frame";
  return null;
}

export function wallRecordsFromPage(page) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || null;
  const openings = page?.openings || [];
  return ["exteriorWalls", "internalWalls"].flatMap((field) => {
    const graph = page?.[field];
    if (!graph) return [];
    return (graph.segments || [])
      .map((segment) => wallRecordFromSegment({ graph, segment, field, levelId: page?.id || null, openings, mmPerDocumentUnit }))
      .filter(Boolean);
  });
}

export function vertexRecordsFromGraph(graph = {}) {
  const connected = new Map();
  (graph.vertices || []).forEach((vertex) => connected.set(vertex.id, []));
  (graph.segments || []).forEach((segment) => {
    connected.get(segment.aId)?.push(segment.id);
    connected.get(segment.bId)?.push(segment.id);
  });
  return (graph.vertices || []).map((vertex) => ({
    id: vertex.id,
    x: vertex.x,
    y: vertex.y,
    connectedWallIds: connected.get(vertex.id) || [],
  }));
}

export function openingRecordsFromPage(page) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || null;
  return (page?.openings || []).map((opening) => {
    const field = fieldForWallGraphKey(opening.wallGraph);
    const graph = page?.[field];
    const segment = graph?.segments?.find((candidate) => candidate.id === opening.wallId);
    const byId = new Map((graph?.vertices || []).map((vertex) => [vertex.id, vertex]));
    const wallStart = byId.get(segment?.aId);
    const wallEnd = byId.get(segment?.bId);
    const startOffset = wallStart && wallEnd ? projectOntoWall(opening.start, wallStart, wallEnd).t : null;
    const endOffset = wallStart && wallEnd ? projectOntoWall(opening.end, wallStart, wallEnd).t : null;
    const widthPx = distance(opening.start, opening.end);
    return {
      id: opening.id,
      wallId: opening.wallId,
      type: canonicalOpeningType(opening.openingType || opening.type),
      startOffset,
      endOffset,
      widthPx,
      widthMm: opening.widthMm ?? (mmPerDocumentUnit ? widthPx * mmPerDocumentUnit : null),
      source: opening.source === "automatic" ? "ai" : (opening.source || "manual"),
      confidence: opening.confidence ?? null,
    };
  });
}

export function roomRecordsFromPage(page) {
  const mmPerDocumentUnit = page?.calibration?.mmPerDocumentUnit || null;
  return (page?.areas || []).map((area) => {
    const polygon = area.outerBoundary || area.vertices || [];
    const areaPx2 = polygonAreaDocUnits2(polygon);
    return {
      id: area.id,
      name: area.name || "Area",
      polygon: polygon.map((point) => ({ x: point.x, y: point.y })),
      areaPx2,
      areaM2: mmPerDocumentUnit ? (areaPx2 * mmPerDocumentUnit * mmPerDocumentUnit) / 1_000_000 : null,
      source: area.source === "automatic" ? "ai" : (area.source || "manual"),
    };
  });
}

export function scaleRecordFromCalibration(calibration) {
  if (!calibration) return { calibrated: false, pointA: null, pointB: null, knownDistanceMm: null, pixelsPerMm: null };
  return {
    calibrated: true,
    pointA: calibration.pointA,
    pointB: calibration.pointB,
    knownDistanceMm: calibration.actualLengthMm,
    pixelsPerMm: calibration.documentDistance / calibration.actualLengthMm,
  };
}

export function manualGeometryFromPage(page) {
  return {
    walls: wallRecordsFromPage(page),
    vertices: {
      exterior: vertexRecordsFromGraph(page?.exteriorWalls),
      interior: vertexRecordsFromGraph(page?.internalWalls),
    },
    openings: openingRecordsFromPage(page),
    rooms: roomRecordsFromPage(page),
    scale: scaleRecordFromCalibration(page?.calibration),
  };
}
