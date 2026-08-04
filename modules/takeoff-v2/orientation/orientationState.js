import { normaliseQuarterTurn } from "../types.js";

export const ORIENTATION_SOURCES = new Set(["metadata", "text-analysis", "raster-analysis", "manual"]);
export const CURRENT_ORIENTATION_STATE_VERSION = 2;

export function createPageOrientationState({
  pdfMetadataRotation = 0,
  detectedCorrection = 0,
  manualOverride,
  source = "metadata",
  confidence = 0,
  autoSource,
} = {}) {
  const normalizedDetectedCorrection = normaliseQuarterTurn(detectedCorrection);
  const normalizedManualOverride = manualOverride == null ? undefined : normaliseQuarterTurn(manualOverride);
  const normalizedAutoSource = autoSource || (source === "manual" ? "metadata" : source);
  return {
    version: CURRENT_ORIENTATION_STATE_VERSION,
    pdfMetadataRotation: normaliseQuarterTurn(pdfMetadataRotation),
    detectedCorrection: normalizedDetectedCorrection,
    ...(normalizedManualOverride == null ? {} : { manualOverride: normalizedManualOverride }),
    finalAppliedRotation: normalizedManualOverride ?? normalizedDetectedCorrection,
    source: ORIENTATION_SOURCES.has(source) ? source : "metadata",
    confidence: Math.max(0, Math.min(100, Math.round(Number(confidence) || 0))),
    autoSource: ORIENTATION_SOURCES.has(normalizedAutoSource) && normalizedAutoSource !== "manual"
      ? normalizedAutoSource
      : "metadata",
  };
}

export function createDetectedOrientationState(detection) {
  return createPageOrientationState({
    pdfMetadataRotation: detection?.pdfMetadataRotation ?? detection?.metadataRotation ?? 0,
    detectedCorrection: detection?.detectedCorrection ?? detection?.bestRotation ?? 0,
    source: detection?.source || "metadata",
    confidence: detection?.confidence ?? 0,
    autoSource: detection?.source || "metadata",
  });
}

export function applyManualOrientationState(currentState, manualRotation) {
  const baseState = createPageOrientationState(currentState || {});
  return createPageOrientationState({
    ...baseState,
    manualOverride: manualRotation,
    source: "manual",
    autoSource: baseState.autoSource || baseState.source,
  });
}

export function resetToDetectedOrientationState(currentState) {
  const baseState = createPageOrientationState(currentState || {});
  return createPageOrientationState({
    ...baseState,
    manualOverride: undefined,
    source: baseState.autoSource || "metadata",
    autoSource: baseState.autoSource || "metadata",
  });
}

export function orientationConfidenceLabel(confidence) {
  if (confidence == null) return "Low";
  if (confidence < 50) return "Low";
  return `${Math.round(confidence)}%`;
}
