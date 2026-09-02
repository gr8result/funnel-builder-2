// Takeoff Engine V2 — data model.
// One authoritative rotation field only: PlanPage.rotation. Never add a second
// rotation-like field (userRotation/finalRotation/displayRotation/normalizedRotation) —
// that duplication is what made the legacy engine's rotation unreliable.

export const ROTATIONS = [0, 90, 180, 270];
export const CURRENT_ORIENTATION_STATE_VERSION = 2;
export const CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION = 2;
export const EXTERIOR_SOURCE_MANUAL_TRACE_V2 = "manual-trace-v2";
export const EXTERIOR_SOURCE_AUTO_DETECTOR_V2 = "auto-detector-v2";

export function isValidRotation(value) {
  return ROTATIONS.includes(value);
}

export function normalizeRotation(value) {
  const n = ((Number(value) || 0) % 360 + 360) % 360;
  return ROTATIONS.includes(n) ? n : 0;
}

export function normaliseQuarterTurn(value) {
  return normalizeRotation(value);
}

export function sourceOrientationToCorrection(sourceRotation) {
  return normaliseQuarterTurn(360 - normaliseQuarterTurn(sourceRotation));
}

export function rotateRight(rotation) {
  return normalizeRotation(normalizeRotation(rotation) + 90);
}

export function rotateLeft(rotation) {
  return normalizeRotation(normalizeRotation(rotation) + 270);
}

/**
 * @typedef {Object} PlanDocument
 * @property {string} id
 * @property {string} jobId
 * @property {string} fileName
 * @property {string} fileStorageKey    IndexedDB key for the uploaded PDF bytes
 * @property {number} fileSize          uploaded PDF byte size
 * @property {string} mimeType          uploaded PDF MIME type
 * @property {string} createdAt         ISO timestamp
 */

export function createPlanDocument({ id, jobId, fileName, fileStorageKey, fileSize, mimeType }) {
  return {
    id,
    jobId: jobId || "",
    fileName,
    fileStorageKey: fileStorageKey || id,
    fileSize: Number(fileSize) || 0,
    mimeType: mimeType || "application/pdf",
    createdAt: new Date().toISOString(),
  };
}

/**
 * @typedef {Object} PlanPage
 * @property {string} id
 * @property {string} documentId
 * @property {number} pageNumber
 * @property {number} sourceWidth        unrotated PDF page width in PDF points
 * @property {number} sourceHeight       unrotated PDF page height in PDF points
 * @property {0|90|180|270} rotation     the ONLY authoritative rotation value
 * @property {boolean} orientationConfirmed
 * @property {Object|null} calibration   null until Phase 9 (scale calibration)
 * @property {number|null} detectedRotationSuggestion  null until Phase 11; a suggestion only, never auto-applied
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function createPlanPage({ id, documentId, pageNumber, sourceWidth, sourceHeight }) {
  const now = new Date().toISOString();
  return withPlanPageDefaults({
    id,
    documentId,
    pageNumber,
    sourceWidth,
    sourceHeight,
    rotation: 0,
    orientationConfirmed: false,
    calibration: null,
    detectedRotationSuggestion: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWallVertex(point = {}) {
  return {
    id: point.id || generateId("vertex"),
    x: Number(point.x) || 0,
    y: Number(point.y) || 0,
  };
}

export function createWallSegment({ aId, bId, wallType = "exterior", source = "manual", confirmed = source === "manual", ...rest }) {
  return {
    id: rest.id || generateId("segment"),
    aId,
    bId,
    wallType,
    thicknessMm: rest.thicknessMm ?? null,
    source,
    confirmed,
    confidence: rest.confidence ?? null,
    locked: Boolean(rest.locked),
    ...rest,
  };
}

export function createMeasurement({ pointA, pointB, lengthMm, ...rest }) {
  return {
    id: rest.id || generateId("measurement"),
    pointA,
    pointB,
    lengthMm: Number(lengthMm) || 0,
    createdAt: rest.createdAt || new Date().toISOString(),
    ...rest,
  };
}

export function createArea({ vertices = [], name = "Area", areaType = "Room", ...rest }) {
  return {
    id: rest.id || generateId("area"),
    name,
    areaType,
    vertices,
    outerBoundary: rest.outerBoundary || vertices,
    holes: rest.holes || [],
    included: rest.included !== false,
    confirmed: Boolean(rest.confirmed),
    createdAt: rest.createdAt || new Date().toISOString(),
    ...rest,
  };
}

export function createOpening({ openingType = "window", start, end, wallId = null, wallGraph = "exterior", ...rest }) {
  return {
    id: rest.id || generateId("opening"),
    wallId,
    wallGraph,
    openingType,
    start,
    end,
    widthMm: rest.widthMm ?? null,
    heightMm: rest.heightMm ?? null,
    sillHeightMm: rest.sillHeightMm ?? null,
    swing: rest.swing ?? null,
    label: rest.label || "",
    source: rest.source || "manual",
    confirmed: rest.confirmed !== false,
    ...rest,
  };
}

export function createDefaultLayerVisibility() {
  return {
    exteriorWalls: true,
    internalWalls: true,
    automaticCandidates: true,
    openings: true,
    areas: true,
  };
}

export function isLegacyAutomaticExteriorWalls(exteriorWalls) {
  if (
    exteriorWalls?.source === EXTERIOR_SOURCE_AUTO_DETECTOR_V2 &&
    (exteriorWalls.schemaVersion || CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION) >= CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION &&
    Array.isArray(exteriorWalls.vertices) &&
    Array.isArray(exteriorWalls.segments)
  ) {
    return false;
  }
  return Boolean(
    exteriorWalls &&
    (
      exteriorWalls.exteriorPerimeter ||
      exteriorWalls.detectedSnapshot ||
      (Array.isArray(exteriorWalls.segments) && exteriorWalls.segments.some((segment) => segment.detectedWallId))
    )
  );
}

function normalizeWallGraph(graph, wallType = "exterior") {
  const defaultThicknessMm = wallType === "exterior" ? 250 : 90;
  const defaultConstructionType = wallType === "exterior" ? "brick_veneer" : "interior_partition";
  if (!graph || typeof graph !== "object") {
    return {
      vertices: [],
      segments: [],
      isClosed: false,
      confirmed: false,
      confirmedAt: null,
      detectionConfidence: null,
      detectedSnapshot: null,
      schemaVersion: CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
      source: wallType === "exterior" ? EXTERIOR_SOURCE_MANUAL_TRACE_V2 : "manual-trace-v2",
      boundaryBasis: "outside",
      constructionType: defaultConstructionType,
      wallThicknessMm: defaultThicknessMm,
      thicknessLocked: false,
    };
  }
  return {
    vertices: Array.isArray(graph.vertices) ? graph.vertices : [],
    segments: Array.isArray(graph.segments) ? graph.segments : [],
    isClosed: Boolean(graph.isClosed),
    confirmed: Boolean(graph.confirmed),
    confirmedAt: graph.confirmedAt || null,
    detectionConfidence: graph.detectionConfidence ?? null,
    detectedSnapshot: graph.detectedSnapshot || null,
    schemaVersion: graph.schemaVersion || CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
    source: graph.source || (wallType === "exterior" ? EXTERIOR_SOURCE_MANUAL_TRACE_V2 : "manual-trace-v2"),
    boundaryBasis: graph.boundaryBasis || "outside",
    ...graph,
    constructionType: graph.constructionType || defaultConstructionType,
    wallThicknessMm: graph.wallThicknessMm ?? defaultThicknessMm,
    thicknessLocked: Boolean(graph.thicknessLocked),
  };
}

function normalizeDetectedWall(wall) {
  if (!wall || typeof wall !== "object") return null;
  return {
    type: "unknown",
    thickness: null,
    confidence: 0,
    openings: [],
    connectedWalls: [],
    source: "pdf-vector",
    sourceSegmentIds: [],
    ...wall,
    openings: Array.isArray(wall.openings) ? wall.openings : [],
    connectedWalls: Array.isArray(wall.connectedWalls) ? wall.connectedWalls : [],
    sourceSegmentIds: Array.isArray(wall.sourceSegmentIds) ? wall.sourceSegmentIds : [],
  };
}

export function withPlanPageDefaults(rawPage) {
  const page = rawPage && typeof rawPage === "object" ? rawPage : {};
  const rawOrientation = page.orientationState || null;
  const staleManualOrientation = page.orientationSource === "manual" &&
    rawOrientation?.source === "manual" &&
    rawOrientation.version !== CURRENT_ORIENTATION_STATE_VERSION;
  const orientationState = staleManualOrientation
    ? {
      ...rawOrientation,
      version: rawOrientation.version || 0,
      source: "metadata",
      finalAppliedRotation: normaliseQuarterTurn(rawOrientation.detectedCorrection ?? page.rotation),
    }
    : rawOrientation;
  const exteriorWalls = isLegacyAutomaticExteriorWalls(page.exteriorWalls) ? null : normalizeWallGraph(page.exteriorWalls, "exterior");
  const exteriorHighlightedWalls = Array.isArray(page.exteriorHighlightedWalls) ? page.exteriorHighlightedWalls : [];
  const exteriorHighlightedWallIds = Array.isArray(page.exteriorHighlightedWallIds) && page.exteriorHighlightedWallIds.length
    ? page.exteriorHighlightedWallIds
    : exteriorHighlightedWalls.map((wall) => wall?.id).filter((id) => typeof id === "string");
  return {
    ...page,
    rotation: normaliseQuarterTurn(orientationState?.finalAppliedRotation ?? page.rotation),
    orientationConfirmed: staleManualOrientation ? false : Boolean(page.orientationConfirmed),
    orientationSource: staleManualOrientation ? null : (page.orientationSource || null),
    orientationConfidence: page.orientationConfidence ?? null,
    orientationState,
    calibration: page.calibration || null,
    detectedRotationSuggestion: page.detectedRotationSuggestion ?? null,
    exteriorWalls,
    legacyExteriorWalls: page.legacyExteriorWalls || (exteriorWalls ? null : page.exteriorWalls || null),
    detectedWalls: Array.isArray(page.detectedWalls) ? page.detectedWalls.map(normalizeDetectedWall).filter(Boolean) : [],
    exteriorHighlightedWalls,
    exteriorHighlightedWallIds,
    internalWalls: normalizeWallGraph(page.internalWalls, "internal"),
    openings: Array.isArray(page.openings) ? page.openings : [],
    windowRecords: Array.isArray(page.windowRecords) ? page.windowRecords : [],
    windowOrderLines: Array.isArray(page.windowOrderLines) ? page.windowOrderLines : [],
    windowReconciliation: page.windowReconciliation && typeof page.windowReconciliation === "object" ? page.windowReconciliation : null,
    windowsDoorsModel: page.windowsDoorsModel && typeof page.windowsDoorsModel === "object" ? page.windowsDoorsModel : null,
    quotationBuilderModel: page.quotationBuilderModel && typeof page.quotationBuilderModel === "object" ? page.quotationBuilderModel : null,
    boqWindowLines: Array.isArray(page.boqWindowLines) ? page.boqWindowLines : [],
    supplierQuotationWindowLines: Array.isArray(page.supplierQuotationWindowLines) ? page.supplierQuotationWindowLines : [],
    procurementWindowLines: Array.isArray(page.procurementWindowLines) ? page.procurementWindowLines : [],
    purchaseOrderWindowLines: Array.isArray(page.purchaseOrderWindowLines) ? page.purchaseOrderWindowLines : [],
    projectEstimateWindowLines: Array.isArray(page.projectEstimateWindowLines) ? page.projectEstimateWindowLines : [],
    areas: Array.isArray(page.areas) ? page.areas : [],
    measurements: Array.isArray(page.measurements) ? page.measurements : [],
    layerVisibility: { ...createDefaultLayerVisibility(), ...(page.layerVisibility || {}) },
    planRegion: page.planRegion || null,
  };
}
