export const TAKEOFF_ENGINE_VERSION = 1;

export const ROTATIONS = Object.freeze([0, 90, 180, 270]);

export const TOOL_IDS = Object.freeze({
  SELECT: "select",
  PAN: "pan",
  SCALE: "scale",
  MEASURE: "measure",
  AREA: "area",
});

export const MEASUREMENT_TYPES = Object.freeze({
  DISTANCE: "distance",
  AREA: "area",
});

export function createPoint(x = 0, y = 0) {
  return {
    x: Number.isFinite(Number(x)) ? Number(x) : 0,
    y: Number.isFinite(Number(y)) ? Number(y) : 0,
  };
}

export function createRasterPage(overrides = {}) {
  const width = Number(overrides.imageWidth ?? overrides.width ?? 0);
  const height = Number(overrides.imageHeight ?? overrides.height ?? 0);

  return {
    id: overrides.id || `page-${Date.now()}`,
    sourceType: overrides.sourceType || "pdf",
    sourceFileName: overrides.sourceFileName || "",
    sourcePdfPageNumber: Number(overrides.sourcePdfPageNumber || 1),
    imageDataUrl: overrides.imageDataUrl || "",
    imageWidth: Number.isFinite(width) ? width : 0,
    imageHeight: Number.isFinite(height) ? height : 0,
    dpi: Number(overrides.dpi || 300),
    renderScale: Number(overrides.renderScale || 1),
    format: overrides.format || "PNG",
    orientation: overrides.orientation || createOrientationState(),
    scale: overrides.scale || null,
    measurements: Array.isArray(overrides.measurements) ? overrides.measurements : [],
    areas: Array.isArray(overrides.areas) ? overrides.areas : [],
    viewState: overrides.viewState || null,
    orientationResetWarning: overrides.orientationResetWarning || "",
    metadata: overrides.metadata || {},
  };
}

export function createOrientationState(overrides = {}) {
  return {
    metadataRotation: Number(overrides.metadataRotation || 0),
    detectedRotation: Number(overrides.detectedRotation || 0),
    userRotation: Number(overrides.userRotation || 0),
    finalRotation: Number(overrides.finalRotation || 0),
    confidence: overrides.confidence || "unknown",
    method: overrides.method || "none",
    orientationConfirmed: Boolean(overrides.orientationConfirmed),
    warning: overrides.warning || "",
    rawDetectedRotation: Number(overrides.rawDetectedRotation || 0),
    scores: overrides.scores || null,
  };
}

export function createTakeoffDocument(overrides = {}) {
  return {
    version: TAKEOFF_ENGINE_VERSION,
    id: overrides.id || `takeoff-${Date.now()}`,
    name: overrides.name || "Untitled takeoff",
    pages: Array.isArray(overrides.pages) ? overrides.pages : [],
    activePageId: overrides.activePageId || null,
    activeTool: overrides.activeTool || TOOL_IDS.SELECT,
    selectedMeasurementId: overrides.selectedMeasurementId || null,
    selectedAreaId: overrides.selectedAreaId || null,
    settings: overrides.settings && typeof overrides.settings === "object" ? overrides.settings : {},
    importMetadata: overrides.importMetadata && typeof overrides.importMetadata === "object" ? overrides.importMetadata : {},
    updatedAt: overrides.updatedAt || null,
  };
}
