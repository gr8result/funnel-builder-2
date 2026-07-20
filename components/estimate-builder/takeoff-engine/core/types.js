export const TAKEOFF_ENGINE_VERSION = 1;

export const ROTATIONS = Object.freeze([0, 90, 180, 270]);
export const PROCESSING_STATUS = Object.freeze({
  QUEUED: "queued",
  READING: "reading",
  ORIENTING: "orienting",
  EXTRACTING: "extracting",
  DETECTING_SCALE: "detecting_scale",
  DETECTING_WALLS: "detecting_walls",
  DETECTING_ROOMS: "detecting_rooms",
  DETECTING_OPENINGS: "detecting_openings",
  READY: "ready",
  FAILED: "failed",
});

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
  const orientation = createOrientationState({
    ...(overrides.orientation || {}),
    autoRotation: overrides.autoRotation ?? overrides.orientation?.autoRotation,
    manualRotation: overrides.manualRotation ?? overrides.orientation?.manualRotation,
    finalRotation: overrides.finalRotation ?? overrides.orientation?.finalRotation,
    orientationMode: overrides.orientationMode ?? overrides.orientation?.orientationMode,
  });

  return {
    id: overrides.id || `page-${Date.now()}`,
    documentId: overrides.documentId || overrides.takeoffDocumentId || "",
    pageNumber: Number(overrides.pageNumber || overrides.sourcePdfPageNumber || 1),
    sourceType: overrides.sourceType || "pdf",
    sourceFileName: overrides.sourceFileName || "",
    sourcePdfPageNumber: Number(overrides.sourcePdfPageNumber || 1),
    originalFileUrl: overrides.originalFileUrl || overrides.sourcePdfDataUrl || overrides.metadata?.sourcePdfDataUrl || "",
    fileHash: overrides.fileHash || overrides.sourceFingerprint || overrides.metadata?.sourceFingerprint || "",
    pdfMetadataRotation: orientation.metadataRotation,
    detectedRotation: orientation.detectedRotation,
    manualRotation: orientation.orientationMode === "manual" ? orientation.manualRotation : null,
    finalRotation: orientation.finalRotation,
    orientationConfidence: overrides.orientationConfidence ?? overrides.metadata?.orientationConfidence ?? orientation.confidence ?? "unknown",
    pageWidthPoints: Number(overrides.pageWidthPoints || overrides.metadata?.pageWidthPoints || 0),
    pageHeightPoints: Number(overrides.pageHeightPoints || overrides.metadata?.pageHeightPoints || 0),
    scaleStatus: overrides.scaleStatus || (overrides.scale ? "manual" : overrides.metadata?.suggestedScale ? "detected" : "unknown"),
    detectedScaleText: overrides.detectedScaleText ?? overrides.metadata?.detectedScaleText ?? null,
    scaleRatio: Number.isFinite(Number(overrides.scaleRatio ?? overrides.scale?.ratio ?? overrides.metadata?.suggestedScale?.ratio))
      ? Number(overrides.scaleRatio ?? overrides.scale?.ratio ?? overrides.metadata?.suggestedScale?.ratio)
      : null,
    pixelsPerMillimetre: Number.isFinite(Number(overrides.pixelsPerMillimetre ?? overrides.scale?.pixelsPerMillimetre))
      ? Number(overrides.pixelsPerMillimetre ?? overrides.scale?.pixelsPerMillimetre)
      : null,
    vectorData: overrides.vectorData || overrides.metadata?.vectorData || null,
    textData: Array.isArray(overrides.textData) ? overrides.textData : Array.isArray(overrides.metadata?.textData) ? overrides.metadata.textData : [],
    rasterPreviewUrl: overrides.rasterPreviewUrl || overrides.imageDataUrl || "",
    detections: createPlanDetections(overrides.detections),
    manualEdits: createPlanManualEdits(overrides.manualEdits),
    processingStatus: overrides.processingStatus || PROCESSING_STATUS.READY,
    imageDataUrl: overrides.imageDataUrl || "",
    imageWidth: Number.isFinite(width) ? width : 0,
    imageHeight: Number.isFinite(height) ? height : 0,
    dpi: Number(overrides.dpi || 300),
    renderScale: Number(overrides.renderScale || 1),
    format: overrides.format || "PNG",
    autoRotation: orientation.autoRotation,
    manualRotation: orientation.orientationMode === "manual" ? orientation.manualRotation : null,
    finalRotation: orientation.finalRotation,
    orientationMode: orientation.orientationMode,
    orientation,
    scale: overrides.scale || null,
    measurements: Array.isArray(overrides.measurements) ? overrides.measurements : [],
    areas: Array.isArray(overrides.areas) ? overrides.areas : [],
    viewState: overrides.viewState || null,
    orientationResetWarning: overrides.orientationResetWarning || "",
    metadata: overrides.metadata || {},
  };
}

export function createPlanDetections(overrides = {}) {
  return {
    walls: Array.isArray(overrides?.walls) ? overrides.walls : [],
    rooms: Array.isArray(overrides?.rooms) ? overrides.rooms : [],
    openings: Array.isArray(overrides?.openings) ? overrides.openings : [],
    columns: Array.isArray(overrides?.columns) ? overrides.columns : [],
    structuralElements: Array.isArray(overrides?.structuralElements) ? overrides.structuralElements : [],
  };
}

export function createPlanManualEdits(overrides = {}) {
  return {
    walls: Array.isArray(overrides?.walls) ? overrides.walls : [],
    rooms: Array.isArray(overrides?.rooms) ? overrides.rooms : [],
    openings: Array.isArray(overrides?.openings) ? overrides.openings : [],
    columns: Array.isArray(overrides?.columns) ? overrides.columns : [],
    measurements: Array.isArray(overrides?.measurements) ? overrides.measurements : [],
    areas: Array.isArray(overrides?.areas) ? overrides.areas : [],
    rejectedDetectionIds: Array.isArray(overrides?.rejectedDetectionIds) ? overrides.rejectedDetectionIds : [],
  };
}

export function createOrientationState(overrides = {}) {
  const orientationMode = overrides.orientationMode === "manual" ? "manual" : "auto";
  const legacyAutoRotation = Number(
    overrides.appliedRotation
    ?? overrides.finalRotation
    ?? (Number(overrides.metadataRotation || 0) + Number(overrides.detectedRotation || 0) + Number(overrides.userRotation || 0)),
  );
  const autoRotation = Number(overrides.autoRotation ?? legacyAutoRotation);
  const manualRotation = Number(overrides.manualRotation ?? overrides.userRotation ?? overrides.finalRotation ?? autoRotation);
  const finalRotation = Number(overrides.finalRotation ?? (orientationMode === "manual" ? manualRotation : autoRotation));

  return {
    autoRotation,
    manualRotation,
    finalRotation,
    orientationMode,
    metadataRotation: Number(overrides.metadataRotation || 0),
    detectedRotation: Number(overrides.detectedRotation || 0),
    userRotation: Number(overrides.userRotation || 0),
    appliedRotation: Number(overrides.appliedRotation || 0),
    confidence: overrides.confidence || "unknown",
    method: overrides.method || "none",
    orientationConfirmed: Boolean(overrides.orientationConfirmed),
    manualOverride: Boolean(overrides.manualOverride),
    autoApplied: Boolean(overrides.autoApplied),
    trusted: Boolean(overrides.trusted),
    warning: overrides.warning || "",
    rawDetectedRotation: Number(overrides.rawDetectedRotation || 0),
    scores: overrides.scores || null,
  };
}

export function createTakeoffDocument(overrides = {}) {
  const pages = Array.isArray(overrides.pages) ? overrides.pages : [];
  return {
    version: TAKEOFF_ENGINE_VERSION,
    id: overrides.id || `takeoff-${Date.now()}`,
    projectId: overrides.projectId || overrides.workbookId || "",
    fileName: overrides.fileName || overrides.name || "Untitled takeoff",
    originalFileUrl: overrides.originalFileUrl || "",
    fileHash: overrides.fileHash || "",
    pageCount: Number(overrides.pageCount ?? pages.length),
    createdAt: overrides.createdAt || new Date().toISOString(),
    name: overrides.name || "Untitled takeoff",
    pages,
    activePageId: overrides.activePageId || null,
    activeTool: overrides.activeTool || TOOL_IDS.SELECT,
    selectedMeasurementId: overrides.selectedMeasurementId || null,
    selectedAreaId: overrides.selectedAreaId || null,
    settings: overrides.settings && typeof overrides.settings === "object" ? overrides.settings : {},
    importMetadata: overrides.importMetadata && typeof overrides.importMetadata === "object" ? overrides.importMetadata : {},
    updatedAt: overrides.updatedAt || null,
  };
}
