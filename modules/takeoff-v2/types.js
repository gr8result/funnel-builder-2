// Takeoff Engine V2 — data model.
// One authoritative rotation field only: PlanPage.rotation. Never add a second
// rotation-like field (userRotation/finalRotation/displayRotation/normalizedRotation) —
// that duplication is what made the legacy engine's rotation unreliable.

export const ROTATIONS = [0, 90, 180, 270];

export function isValidRotation(value) {
  return ROTATIONS.includes(value);
}

export function normalizeRotation(value) {
  const n = ((Number(value) || 0) % 360 + 360) % 360;
  return ROTATIONS.includes(n) ? n : 0;
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
 * @property {number} calculatedAreaM2
 * @property {number|null} confirmedAreaM2
 * @property {string} confirmedNote   required when confirmedAreaM2 !== calculatedAreaM2
 * @property {boolean} included       whether this area counts toward totals
 * @property {"automatic"|"manual"} source
 * @property {boolean} confirmed
 * @property {string|null} confirmedAt
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
 * @property {Calibration|null} calibration
 * @property {ExteriorWalls|null} exteriorWalls
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
    calibration: null,
    exteriorWalls: null,
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
  return {
    ...page,
    exteriorWalls: safe(() => (page.exteriorWalls ? {
      boundaryBasis: "outside",
      wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
      ...page.exteriorWalls,
    } : null), null),
    internalWalls: safe(() => page.internalWalls, null),
    openings: safe(() => (Array.isArray(page.openings) ? page.openings : []), []),
    areas: safe(() => (Array.isArray(page.areas) ? page.areas : []), []),
    measurements: safe(() => (Array.isArray(page.measurements) ? page.measurements : []), []),
    layerVisibility: safe(() => ({ ...createDefaultLayerVisibility(), ...(page.layerVisibility || {}) }), createDefaultLayerVisibility()),
    planRegion: safe(() => page.planRegion, null),
  };
}

export function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWallVertex({ id, x, y }) {
  return { id, x, y };
}

export function createWallSegment({ id, aId, bId, wallType = "exterior", thicknessMm = null, source = "manual", confirmed = source === "manual", confidence = null }) {
  return { id, aId, bId, wallType, thicknessMm, source, confirmed, confidence };
}

export function createMeasurement({ id, pointA, pointB, lengthMm, label = "" }) {
  return { id, pointA, pointB, lengthMm, label, createdAt: new Date().toISOString() };
}

export function createArea({ id, name, areaType = "Custom", vertices, calculatedAreaM2, source = "manual" }) {
  return {
    id,
    name,
    areaType,
    vertices,
    calculatedAreaM2,
    confirmedAreaM2: null,
    confirmedNote: "",
    included: true,
    source,
    confirmed: false,
    confirmedAt: null,
  };
}

export function createOpening({ id, wallId, wallGraph, openingType, start, end, widthMm, heightMm = null, sillHeightMm = null, swing = null, label = "", source = "manual", confirmed = source === "manual" }) {
  return { id, wallId, wallGraph, openingType, start, end, widthMm, heightMm, sillHeightMm, swing, label, source, confirmed };
}
