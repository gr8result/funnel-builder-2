export const TAKEOFF_V3_VERSION = 3;
export const ROTATIONS = [0, 90, 180, 270];

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

export function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPoint({ id, x, y }) {
  return { id: id || generateId("pt"), x: Number(x) || 0, y: Number(y) || 0 };
}

export function createWallSegment({
  id,
  startPointId,
  endPointId,
  wallType = "exterior",
  source = "manual",
  confirmed = false,
}) {
  return {
    id: id || generateId("wall"),
    startPointId,
    endPointId,
    wallType: wallType === "interior" ? "interior" : "exterior",
    source: source === "automatic" ? "automatic" : "manual",
    confirmed: Boolean(confirmed),
  };
}

export function createOpening({
  id,
  wallSegmentId,
  type = "opening",
  startOffset = 0,
  endOffset = 0,
}) {
  const safeType = ["door", "window", "opening"].includes(type) ? type : "opening";
  return {
    id: id || generateId("opening"),
    wallSegmentId,
    type: safeType,
    startOffset: Number(startOffset) || 0,
    endOffset: Number(endOffset) || 0,
  };
}

export function createEmptyGeometry() {
  return { points: [], walls: [], openings: [] };
}

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

export function createPlanPage({ id, documentId, pageNumber, sourceWidth, sourceHeight }) {
  const now = new Date().toISOString();
  return withPlanPageDefaults({
    id,
    documentId,
    pageNumber,
    sourceWidth,
    sourceHeight,
    rotation: 0,
    calibration: null,
    geometry: createEmptyGeometry(),
    exteriorConfirmed: false,
    exteriorConfirmedAt: null,
    version: TAKEOFF_V3_VERSION,
    createdAt: now,
    updatedAt: now,
  });
}

export function withPlanPageDefaults(rawPage = {}) {
  return {
    ...rawPage,
    rotation: normalizeRotation(rawPage.rotation),
    calibration: rawPage.calibration || null,
    geometry: normalizeGeometry(rawPage.geometry),
    exteriorConfirmed: Boolean(rawPage.exteriorConfirmed),
    exteriorConfirmedAt: rawPage.exteriorConfirmedAt || null,
    version: TAKEOFF_V3_VERSION,
  };
}

export function normalizeGeometry(geometry) {
  if (!geometry || typeof geometry !== "object") return createEmptyGeometry();
  return {
    points: Array.isArray(geometry.points) ? geometry.points.map(createPoint) : [],
    walls: Array.isArray(geometry.walls)
      ? geometry.walls
          .filter((wall) => wall?.startPointId && wall?.endPointId)
          .map((wall) => createWallSegment(wall))
      : [],
    openings: Array.isArray(geometry.openings)
      ? geometry.openings
          .filter((opening) => opening?.wallSegmentId)
          .map((opening) => createOpening(opening))
      : [],
  };
}
