// Takeoff Engine V2 — data model.
// One authoritative rotation field only: PlanPage.rotation. Never add a second
// rotation-like field (userRotation/finalRotation/displayRotation/normalizedRotation) —
// that duplication is what made the legacy engine's rotation unreliable.

export const ROTATIONS = [0, 90, 180, 270];
export const CURRENT_ORIENTATION_STATE_VERSION = 2;
export const CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION = 2;
export const EXTERIOR_SOURCE_MANUAL_TRACE_V2 = "manual-trace-v2";
export const EXTERIOR_SOURCE_ASSISTED_WALL_SELECTION = "assisted-wall-selection";
export const EXTERIOR_SOURCE_CONNECTED_WALL_SUGGESTION = "connected-wall-suggestion";
export const EXTERIOR_SOURCE_ASSISTED_PROPOSAL_V1 = "assisted-proposal-v1";
export const EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR = "legacy-auto-detector";
export const EXTERIOR_SOURCE_FUTURE_AUTO_DETECTOR = "future-auto-detector";
export const EXTERIOR_SOURCE_HIGHLIGHTER_V1 = "exterior-highlighter-v1";

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
 * @property {string} originalFileUrl   data URL of the uploaded PDF bytes
 * @property {string} createdAt         ISO timestamp
 */

export function createPlanDocument({ id, jobId, fileName, originalFileUrl }) {
  return {
    id,
    jobId: jobId || "",
    fileName,
    originalFileUrl,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @typedef {Object} Point
 * @property {number} x   page-space (unrotated PDF points)
 * @property {number} y   page-space (unrotated PDF points)
 */

/**
 * @typedef {Object} SnapMetadata
 * @property {"line"|"endpoint"|"intersection"|"manual"} kind
 * @property {string|null} lineId     set for "line"/"endpoint"
 * @property {string[]|null} lineIds  set for "intersection"
 */

/**
 * @typedef {Object} Calibration
 * @property {string} pageId
 * @property {Point} pointA
 * @property {Point} pointB
 * @property {"horizontal"|"vertical"} axis   the BASE-coordinate axis held constant
 * @property {number} actualLengthMm          real-world distance the user entered
 * @property {number} documentDistance        axis-aware distance: |Δx| (horizontal) or |Δy| (vertical), in page-space units
 * @property {number} mmPerDocumentUnit       the critical saved conversion value
 * @property {SnapMetadata} snapA
 * @property {SnapMetadata} snapB
 * @property {string} confirmedAt             ISO timestamp
 */

/**
 * @typedef {Object} DetectedWall
 * @property {string} id
 * @property {"exterior"|"interior"|"unknown"} type
 * @property {Point} start
 * @property {Point} end
 * @property {number|null} thickness
 * @property {number} confidence
 * @property {string[]} openings
 * @property {string[]} connectedWalls
 * @property {"pdf-vector"|"pdf-vector-single"|"raster"} source
 * @property {string[]} sourceSegmentIds
 */

/**
 * @typedef {Object} WallVertex
 * @property {string} id
 * @property {number} x   page-space
 * @property {number} y   page-space
 */

/**
 * @typedef {Object} WallSegment
 * @property {string} id
 * @property {string} aId   WallVertex id
 * @property {string} bId   WallVertex id
 * @property {"exterior"|"internal"} wallType
 * @property {number|null} thicknessMm   user-editable, defaults null (not yet specified)
 * @property {"automatic"|"manual"} source
 * @property {boolean} confirmed         true for manually-drawn segments; false for a fresh (unreviewed) automatic detection
 * @property {string|null} confidence    "high"|"medium"|"low"|null (automatic detections only)
 * @property {boolean} locked            locked segments cannot be edited until unlocked
 */

/**
 * @typedef {Object} WallGraph
 * @property {WallVertex[]} vertices
 * @property {WallSegment[]} segments
 * @property {boolean} isClosed
 * @property {boolean} confirmed
 * @property {string|null} confirmedAt
 * @property {number|null} detectionConfidence   0-100, null if never detected/manual only
 * @property {{vertices:WallVertex[],segments:WallSegment[]}|null} detectedSnapshot   for "Reset to Detected"
 * @property {number} schemaVersion
 * @property {"manual-trace-v2"|"assisted-wall-selection"|"connected-wall-suggestion"|"assisted-proposal-v1"|"legacy-auto-detector"|"future-auto-detector"|"exterior-highlighter-v1"} source
 */

/**
 * @typedef {Object} ExteriorWallsExtra
 * @property {"outside"|"centreline"|"inside"} boundaryBasis   which face of the wall the trace represents; defaults to "outside" (how automatic detection and most manual tracing works)
 * @property {number} wallThicknessMm   default external wall thickness used for the inward-offset internal-area estimate
 */

/**
 * @typedef {WallGraph & ExteriorWallsExtra} ExteriorWalls
 */

/**
 * @typedef {Object} PlanRegion
 * @property {number} x        page-space (unrotated PDF points)
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {boolean} confirmed
 * @property {"automatic"|"manual"} source
 */

/**
 * @typedef {Object} WallOpening
 * @property {string} id
 * @property {string} wallId          the hosting WallSegment's id
 * @property {"exterior"|"internal"} wallGraph   which graph wallId lives in
 * @property {"window"|"internal-door"|"external-door"|"sliding-door"|"garage-door"|"open-opening"} openingType
 * @property {Point} start            page-space, always exactly on the host wall's line
 * @property {Point} end
 * @property {number} widthMm         always computed from calibrated geometry, never trusted from a label
 * @property {number|null} heightMm
 * @property {number|null} sillHeightMm
 * @property {{hingeSide:"start"|"end", direction:"in"|"out"}|null} swing   hinged types only
 * @property {string} label
 * @property {"automatic"|"manual"} source
 * @property {boolean} confirmed
 */

/**
 * @typedef {Object} TakeoffArea
 * @property {string} id
 * @property {string} name
 * @property {string} areaType   "Living Area"|"Garage"|"Patio"|"Alfresco"|"Balcony"|"Porch"|"Upper Floor"|"Void"|"Custom"
 * @property {Point[]} vertices
 * @property {Point[]} outerBoundary
 * @property {{id:string,type:"robe"|"cabinetry"|"void"|"column"|"duct"|"custom",vertices:Point[],included:boolean}[]} holes
 * @property {number} calculatedAreaM2
 * @property {number} grossAreaM2
 * @property {number} excludedAreaM2
 * @property {number} netAreaM2
 * @property {number|null} confirmedAreaM2
 * @property {string} confirmedNote   required when confirmedAreaM2 !== calculatedAreaM2
 * @property {boolean} included       whether this area counts toward totals
 * @property {"automatic"|"manual"} source
 * @property {boolean} confirmed
 * @property {string|null} confirmedAt
 * @property {number|null} externalFootprintM2    set only for an area generated from a closed exterior perimeter (Method A) — the outside-face footprint, distinct from calculatedAreaM2's boundary-basis-as-traced value
 * @property {number|null} internalFloorAreaM2    the wall-thickness-adjusted internal estimate for that same perimeter, or null if it couldn't be calculated automatically
 * @property {number|null} confidence
 * @property {Point|null} seedPoint
 * @property {{x:number,y:number,width:number,height:number}|null} searchRect
 */

/**
 * @typedef {Object} LayerVisibility
 * @property {boolean} exteriorWalls
 * @property {boolean} internalWalls
 * @property {boolean} windows
 * @property {boolean} doors
 * @property {boolean} openings
 * @property {boolean} areas
 * @property {boolean} automaticCandidates   default false — unconfirmed automatic detections are opt-in to view
 */

export function createDefaultLayerVisibility() {
  return {
    exteriorWalls: true,
    internalWalls: true,
    windows: true,
    doors: true,
    openings: true,
    areas: true,
    automaticCandidates: false,
  };
}

/**
 * @typedef {Object} LengthMeasurement
 * @property {string} id
 * @property {Point} pointA
 * @property {Point} pointB
 * @property {number} lengthMm
 * @property {string} label
 * @property {string} createdAt
 */

/**
 * @typedef {Object} PlanPage
 * @property {string} id
 * @property {string} documentId
 * @property {number} pageNumber
 * @property {number} sourceWidth        unrotated PDF page width in PDF points
 * @property {number} sourceHeight       unrotated PDF page height in PDF points
 * @property {0|90|180|270} rotation     the ONLY authoritative rotation value
 * @property {boolean} orientationConfirmed
 * @property {"auto"|"manual"|"metadata"|"user-selection"|null} orientationSource
 * @property {number|null} orientationConfidence   0-100
 * @property {PageOrientationState|null} orientationState
 * @property {Calibration|null} calibration
 * @property {ExteriorWalls|null} exteriorWalls
 * @property {HighlightableWall[]} exteriorHighlightedWalls
 * @property {string[]} exteriorHighlightedWallIds
 * @property {WallGraph|null} internalWalls
 * @property {WallOpening[]} openings
 * @property {TakeoffArea[]} areas
 * @property {LengthMeasurement[]} measurements
 * @property {LayerVisibility} layerVisibility
 * @property {PlanRegion|null} planRegion
 * @property {number|null} detectedRotationSuggestion  null until Phase 11; a suggestion only, never auto-applied
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const DEFAULT_WALL_THICKNESS_MM = 200;

export function createPlanPage({ id, documentId, pageNumber, sourceWidth, sourceHeight }) {
  const now = new Date().toISOString();
  return {
    id,
    documentId,
    pageNumber,
    sourceWidth,
    sourceHeight,
    rotation: 0,
    orientationConfirmed: false,
    // null until first-import auto-detection or an explicit Re-detect runs.
    // "auto" | "manual" | "metadata" | "user-selection" once set.
    orientationSource: null,
    orientationConfidence: null,
    orientationState: null,
    calibration: null,
    exteriorWalls: null,
    exteriorHighlightedWalls: [],
    exteriorHighlightedWallIds: [],
    internalWalls: null,
    openings: [],
    areas: [],
    measurements: [],
    layerVisibility: createDefaultLayerVisibility(),
    planRegion: null,
    detectedRotationSuggestion: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Fills in any fields missing from an older saved PlanPage record (schema
// migration) so opening a job saved before a given feature shipped never
// crashes the viewer. Each section is normalized independently so a
// corrupted single section can't block the rest of the page from loading.
export function withPlanPageDefaults(rawPage) {
  const page = rawPage && typeof rawPage === "object" ? rawPage : {};
  const safe = (getValue, fallback) => {
    try {
      const value = getValue();
      return value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const orientationState = safe(() => normalizePageOrientationState(page), null);
  const staleManual = page.orientationSource === "manual" && orientationState?.source !== "manual";
  return {
    ...page,
    rotation: orientationState?.finalAppliedRotation ?? normaliseQuarterTurn(page.rotation),
    orientationSource: staleManual ? null : page.orientationSource,
    orientationConfirmed: staleManual ? false : Boolean(page.orientationConfirmed),
    orientationState,
    exteriorWalls: safe(() => normalizeExteriorWalls(page.exteriorWalls), null),
    legacyExteriorWalls: safe(() => (
      page.legacyExteriorWalls || (isLegacyAutomaticExteriorWalls(page.exteriorWalls) ? quarantineLegacyExteriorWalls(page.exteriorWalls) : null)
    ), null),
    detectedWalls: safe(() => (Array.isArray(page.detectedWalls) ? page.detectedWalls.map(withDetectedWallDefaults).filter(Boolean) : []), []),
    exteriorHighlightedWalls: safe(() => (Array.isArray(page.exteriorHighlightedWalls) ? page.exteriorHighlightedWalls.map(withHighlightableWallDefaults).filter(Boolean) : []), []),
    exteriorHighlightedWallIds: safe(() => {
      const ids = Array.isArray(page.exteriorHighlightedWallIds) ? page.exteriorHighlightedWallIds.filter((id) => typeof id === "string") : [];
      if (ids.length) return ids;
      return (Array.isArray(page.exteriorHighlightedWalls) ? page.exteriorHighlightedWalls : []).map((wall) => wall?.id).filter((id) => typeof id === "string");
    }, []),
    internalWalls: safe(() => page.internalWalls, null),
    openings: safe(() => (Array.isArray(page.openings) ? page.openings : []), []),
    areas: safe(() => (Array.isArray(page.areas) ? page.areas.map(withAreaDefaults) : []), []),
    measurements: safe(() => (Array.isArray(page.measurements) ? page.measurements : []), []),
    layerVisibility: safe(() => ({ ...createDefaultLayerVisibility(), ...(page.layerVisibility || {}) }), createDefaultLayerVisibility()),
    planRegion: safe(() => page.planRegion, null),
  };
}

function withLineSegmentDefaults(rawLine) {
  if (!rawLine?.start || !rawLine?.end) return null;
  return {
    start: { x: Number(rawLine.start.x) || 0, y: Number(rawLine.start.y) || 0 },
    end: { x: Number(rawLine.end.x) || 0, y: Number(rawLine.end.y) || 0 },
  };
}

function withWallJunctionDefaults(rawJunction, fallbackPoint, fallbackWallId) {
  if (!rawJunction && !fallbackPoint) return null;
  const rawPoint = rawJunction?.point || rawJunction || fallbackPoint;
  const point = { x: Number(rawPoint.x) || 0, y: Number(rawPoint.y) || 0 };
  return {
    id: rawJunction?.id || `hlj-${Math.round(point.x)}-${Math.round(point.y)}`,
    point,
    connectedWallIds: Array.isArray(rawJunction?.connectedWallIds)
      ? rawJunction.connectedWallIds.filter((id) => typeof id === "string")
      : (fallbackWallId ? [fallbackWallId] : []),
    confidence: Number.isFinite(Number(rawJunction?.confidence)) ? Number(rawJunction.confidence) : 0.7,
    source: rawJunction?.source || "face-termination",
  };
}

function withHighlightableWallDefaults(rawWall) {
  if (!rawWall || typeof rawWall !== "object") return null;
  const centreline = withLineSegmentDefaults(rawWall.centreline) || (
    rawWall.start && rawWall.end
      ? { start: { x: Number(rawWall.start.x) || 0, y: Number(rawWall.start.y) || 0 }, end: { x: Number(rawWall.end.x) || 0, y: Number(rawWall.end.y) || 0 } }
      : null
  );
  if (!centreline) return null;
  const startJunction = withWallJunctionDefaults(rawWall.startJunction, centreline.start, rawWall.id);
  const endJunction = withWallJunctionDefaults(rawWall.endJunction, centreline.end, rawWall.id);
  return {
    id: rawWall.id || `hl-wall-${Math.round(centreline.start.x)}-${Math.round(centreline.start.y)}-${Math.round(centreline.end.x)}-${Math.round(centreline.end.y)}`,
    centreline: { start: startJunction.point, end: endJunction.point },
    faceA: withLineSegmentDefaults(rawWall.faceA),
    faceB: withLineSegmentDefaults(rawWall.faceB),
    thickness: Number.isFinite(Number(rawWall.thickness)) ? Number(rawWall.thickness) : null,
    startJunction,
    endJunction,
    confidence: Number.isFinite(Number(rawWall.confidence)) ? Number(rawWall.confidence) : 0,
    endpointReview: rawWall.endpointReview || null,
    source: rawWall.source || "local-vector-wall-band",
    sourceSegmentIds: Array.isArray(rawWall.sourceSegmentIds) ? rawWall.sourceSegmentIds.filter((id) => typeof id === "string") : [],
  };
}

function withDetectedWallDefaults(rawWall) {
  if (!rawWall || typeof rawWall !== "object" || !rawWall.start || !rawWall.end) return null;
  const type = ["exterior", "interior", "unknown"].includes(rawWall.type) ? rawWall.type : "unknown";
  const start = { x: Number(rawWall.start.x) || 0, y: Number(rawWall.start.y) || 0 };
  const end = { x: Number(rawWall.end.x) || 0, y: Number(rawWall.end.y) || 0 };
  return {
    id: rawWall.id || `wall-${Math.round(start.x)}-${Math.round(start.y)}-${Math.round(end.x)}-${Math.round(end.y)}`,
    type,
    start,
    end,
    thickness: Number.isFinite(rawWall.thickness) ? rawWall.thickness : null,
    confidence: Number.isFinite(rawWall.confidence) ? rawWall.confidence : 0,
    openings: Array.isArray(rawWall.openings) ? rawWall.openings : [],
    connectedWalls: Array.isArray(rawWall.connectedWalls) ? rawWall.connectedWalls : [],
    source: rawWall.source || "pdf-vector",
    sourceSegmentIds: Array.isArray(rawWall.sourceSegmentIds) ? rawWall.sourceSegmentIds : [],
  };
}

function normalizePageOrientationState(page) {
  const existing = page.orientationState && typeof page.orientationState === "object" ? page.orientationState : null;
  if (existing) {
    const currentVersionManual = existing.source === "manual" && existing.version === CURRENT_ORIENTATION_STATE_VERSION;
    const detectedCorrection = normaliseQuarterTurn(existing.detectedCorrection ?? page.rotation);
    const manualOverride = currentVersionManual && existing.manualOverride != null ? normaliseQuarterTurn(existing.manualOverride) : undefined;
    const finalAppliedRotation = manualOverride ?? (currentVersionManual ? normaliseQuarterTurn(existing.finalAppliedRotation ?? page.rotation) : detectedCorrection);
    return {
      version: existing.version === CURRENT_ORIENTATION_STATE_VERSION ? CURRENT_ORIENTATION_STATE_VERSION : 0,
      pdfMetadataRotation: normaliseQuarterTurn(existing.pdfMetadataRotation),
      detectedCorrection,
      ...(manualOverride == null ? {} : { manualOverride }),
      finalAppliedRotation,
      source: currentVersionManual ? "manual" : (existing.source === "manual" ? (existing.autoSource || "metadata") : (existing.source || "metadata")),
      confidence: Number.isFinite(existing.confidence) ? existing.confidence : (page.orientationConfidence ?? 0),
      autoSource: existing.autoSource || (page.orientationSource === "manual" ? "metadata" : existing.source),
    };
  }
  if (page.orientationSource || page.orientationConfidence != null || page.rotation != null) {
    const rotation = normaliseQuarterTurn(page.rotation);
    return {
      pdfMetadataRotation: 0,
      detectedCorrection: rotation,
      ...(page.orientationSource === "manual" ? { manualOverride: rotation } : {}),
      finalAppliedRotation: rotation,
      source: page.orientationSource === "manual" ? "manual" : "metadata",
      confidence: page.orientationConfidence ?? 0,
      autoSource: page.orientationSource === "manual" ? "metadata" : (page.orientationSource || "metadata"),
    };
  }
  return null;
}

export function isLegacyAutomaticExteriorWalls(exteriorWalls) {
  if (!exteriorWalls || typeof exteriorWalls !== "object") return false;
  if (exteriorWalls.source === EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR) return true;
  if (
    exteriorWalls.source === EXTERIOR_SOURCE_FUTURE_AUTO_DETECTOR ||
    exteriorWalls.source === EXTERIOR_SOURCE_ASSISTED_PROPOSAL_V1 ||
    exteriorWalls.source === EXTERIOR_SOURCE_ASSISTED_WALL_SELECTION ||
    exteriorWalls.source === EXTERIOR_SOURCE_CONNECTED_WALL_SUGGESTION
  ) return true;
  const segments = Array.isArray(exteriorWalls.segments) ? exteriorWalls.segments : [];
  if (segments.some((segment) => (
    segment?.detectedWallId ||
    segment?.source === "assisted-wall-selection" ||
    segment?.source === "connected-wall-suggestion" ||
    segment?.source === "automatic"
  ))) return true;
  if (exteriorWalls.source === EXTERIOR_SOURCE_MANUAL_TRACE_V2) return false;
  if (exteriorWalls.schemaVersion >= CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION) return false;
  const hasManualSegments = segments.some((segment) => segment?.source === "manual");
  return Boolean(
    !hasManualSegments && (
      exteriorWalls.detectedSnapshot ||
      exteriorWalls.exteriorPerimeter ||
      exteriorWalls.detectionConfidence != null ||
      exteriorWalls.detectionUseful != null
    )
  );
}

function quarantineLegacyExteriorWalls(exteriorWalls) {
  return {
    ...exteriorWalls,
    source: EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR,
    quarantinedAt: new Date().toISOString(),
    quarantineReason: "Automatic exterior detection disabled because legacy geometry was unreliable.",
  };
}

function normalizeExteriorWalls(rawExteriorWalls) {
  if (!rawExteriorWalls) return null;
  if (isLegacyAutomaticExteriorWalls(rawExteriorWalls)) return null;
  return {
    boundaryBasis: "outside",
    wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
    schemaVersion: CURRENT_EXTERIOR_WALLS_SCHEMA_VERSION,
    source: rawExteriorWalls.source || EXTERIOR_SOURCE_MANUAL_TRACE_V2,
    detectedSnapshot: null,
    detectionConfidence: null,
    ...rawExteriorWalls,
  };
}

function withAreaDefaults(rawArea) {
  const area = rawArea && typeof rawArea === "object" ? rawArea : {};
  const boundary = Array.isArray(area.outerBoundary)
    ? area.outerBoundary
    : (Array.isArray(area.vertices) ? area.vertices : []);
  const calculated = Number.isFinite(area.calculatedAreaM2) ? area.calculatedAreaM2 : 0;
  const net = Number.isFinite(area.netAreaM2) ? area.netAreaM2 : (Number.isFinite(area.confirmedAreaM2) ? area.confirmedAreaM2 : calculated);
  return {
    ...area,
    vertices: boundary,
    outerBoundary: boundary,
    holes: Array.isArray(area.holes) ? area.holes : [],
    grossAreaM2: Number.isFinite(area.grossAreaM2) ? area.grossAreaM2 : calculated,
    excludedAreaM2: Number.isFinite(area.excludedAreaM2) ? area.excludedAreaM2 : 0,
    netAreaM2: net,
    confidence: area.confidence ?? null,
    seedPoint: area.seedPoint || null,
    searchRect: area.searchRect || null,
  };
}

export function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWallVertex({ id, x, y }) {
  return { id, x, y };
}

export function createWallSegment({ id, aId, bId, wallType = "exterior", thicknessMm = null, source = "manual", confirmed = source === "manual", confidence = null, locked = false }) {
  return { id, aId, bId, wallType, thicknessMm, source, confirmed, confidence, locked };
}

export function createMeasurement({ id, pointA, pointB, lengthMm, label = "" }) {
  return { id, pointA, pointB, lengthMm, label, createdAt: new Date().toISOString() };
}

export function createArea({
  id, name, areaType = "Custom", vertices, outerBoundary = null, holes = [],
  calculatedAreaM2, grossAreaM2 = null, excludedAreaM2 = 0, netAreaM2 = null,
  source = "manual", externalFootprintM2 = null, internalFloorAreaM2 = null,
  confidence = null, seedPoint = null, searchRect = null,
}) {
  const boundary = outerBoundary || vertices || [];
  const net = netAreaM2 ?? calculatedAreaM2 ?? 0;
  return {
    id,
    name,
    areaType,
    vertices: boundary,
    outerBoundary: boundary,
    holes,
    calculatedAreaM2: calculatedAreaM2 ?? net,
    grossAreaM2: grossAreaM2 ?? calculatedAreaM2 ?? net,
    excludedAreaM2,
    netAreaM2: net,
    confirmedAreaM2: null,
    confirmedNote: "",
    included: true,
    source,
    confirmed: false,
    confirmedAt: null,
    externalFootprintM2,
    internalFloorAreaM2,
    confidence,
    seedPoint,
    searchRect,
  };
}

export function createOpening({ id, wallId, wallGraph, openingType, start, end, widthMm, heightMm = null, sillHeightMm = null, swing = null, label = "", source = "manual", confirmed = source === "manual" }) {
  return { id, wallId, wallGraph, openingType, start, end, widthMm, heightMm, sillHeightMm, swing, label, source, confirmed };
}
