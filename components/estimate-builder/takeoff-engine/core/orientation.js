import { ROTATIONS, createOrientationState } from "./types.js";

export function normalizeRotation(rotation = 0) {
  const normalized = ((Math.round(Number(rotation) / 90) * 90) % 360 + 360) % 360;
  return ROTATIONS.includes(normalized) ? normalized : 0;
}

export function combineRotations(...rotations) {
  return normalizeRotation(rotations.reduce((total, rotation) => total + Number(rotation || 0), 0));
}

export function calculateFinalRotation({ metadataRotation = 0, detectedRotation = 0, userRotation = 0 } = {}) {
  return combineRotations(metadataRotation, detectedRotation, userRotation);
}

export function calculatePlanFinalRotation({ orientationMode = "auto", autoRotation = 0, manualRotation = 0 } = {}) {
  return orientationMode === "manual" ? normalizeRotation(manualRotation) : normalizeRotation(autoRotation);
}

export function rotateDimensions(width, height, rotation = 0) {
  const finalRotation = normalizeRotation(rotation);
  if (finalRotation === 90 || finalRotation === 270) {
    return { width: Number(height || 0), height: Number(width || 0) };
  }
  return { width: Number(width || 0), height: Number(height || 0) };
}

export function createOrientation(overrides = {}) {
  const orientation = createOrientationState(overrides);
  const orientationMode = orientation.orientationMode === "manual" ? "manual" : "auto";
  const autoRotation = normalizeRotation(orientation.autoRotation);
  const manualRotation = normalizeRotation(orientation.manualRotation);
  const finalRotation = calculatePlanFinalRotation({ orientationMode, autoRotation, manualRotation });
  return {
    ...orientation,
    autoRotation,
    manualRotation,
    finalRotation,
    orientationMode,
    metadataRotation: normalizeRotation(orientation.metadataRotation),
    detectedRotation: normalizeRotation(orientation.detectedRotation),
    userRotation: normalizeRotation(orientation.userRotation),
    appliedRotation: normalizeRotation(orientation.appliedRotation),
  };
}

export function createOrientationScore({
  rotation = 0,
  confidence = 0,
  method = "none",
  reason = "",
  scores = null,
} = {}) {
  const value = Math.max(0, Math.min(1, Number(confidence || 0)));
  return {
    rotation: normalizeRotation(rotation),
    confidence: value,
    confidenceLabel: value >= 0.72 ? "high" : value >= 0.35 ? "low" : "none",
    method,
    reason,
    scores,
  };
}

export function chooseBestOrientationScore(scores = []) {
  const candidates = Array.isArray(scores) ? scores : [];
  const best = candidates
    .filter(Boolean)
    .map((score) => createOrientationScore(score))
    .sort((a, b) => b.confidence - a.confidence)[0];

  return best || createOrientationScore();
}

export async function detectRasterTextOrientation() {
  return createOrientationScore({
    rotation: 0,
    confidence: 0,
    method: "ocr-adapter-unavailable",
    reason: "Browser OCR adapter is not connected yet.",
  });
}

export function detectTitleBlockOrientationHeuristic({ width = 0, height = 0 } = {}) {
  const imageWidth = Number(width || 0);
  const imageHeight = Number(height || 0);
  if (!imageWidth || !imageHeight) {
    return createOrientationScore({
      method: "title-block-heuristic",
      reason: "No raster dimensions available.",
    });
  }

  return createOrientationScore({
    rotation: imageHeight > imageWidth ? 90 : 0,
    confidence: 0.28,
    method: "title-block-heuristic",
    reason: "Weak fallback based on drawing frame aspect.",
  });
}

export function detectDrawingAspectOrientation({ width = 0, height = 0 } = {}) {
  const imageWidth = Number(width || 0);
  const imageHeight = Number(height || 0);
  if (!imageWidth || !imageHeight) {
    return createOrientationScore({
      method: "drawing-aspect-heuristic",
      reason: "No raster dimensions available.",
    });
  }

  const ratio = Math.max(imageWidth, imageHeight) / Math.max(1, Math.min(imageWidth, imageHeight));
  return createOrientationScore({
    rotation: imageHeight > imageWidth ? 90 : 0,
    confidence: ratio >= 1.15 ? 0.42 : 0.18,
    method: "drawing-aspect-heuristic",
    reason: "Floor plan drawings are usually wider than tall after normalization.",
  });
}

export async function detectRasterOrientation({ imageDataUrl = "", imageWidth = 0, imageHeight = 0, pdfTextOrientation = null, metadataRotation = 0 } = {}) {
  const rasterTextOrientation = await detectRasterTextOrientation({ imageDataUrl, imageWidth, imageHeight });
  const textScore = pdfTextOrientation
    ? createOrientationScore({
      rotation: pdfTextOrientation.detectedRotation,
      confidence: pdfTextOrientation.confidence === "high" ? 0.86 : pdfTextOrientation.confidence === "low" ? 0.48 : 0,
      method: "pdf-text-layer",
      reason: "PDF text item direction suggests readable orientation.",
      scores: pdfTextOrientation.scores || null,
    })
    : createOrientationScore();
  const metadataScore = createOrientationScore({
    rotation: metadataRotation,
    confidence: normalizeRotation(metadataRotation) ? 0.5 : 0.2,
    method: "pdf-metadata",
    reason: "PDF page metadata rotation.",
  });
  const titleBlockScore = detectTitleBlockOrientationHeuristic({ width: imageWidth, height: imageHeight });
  const aspectScore = detectDrawingAspectOrientation({ width: imageWidth, height: imageHeight });
  const best = chooseBestOrientationScore([
    rasterTextOrientation,
    textScore,
    metadataScore,
    titleBlockScore,
    aspectScore,
  ]);

  return {
    detectedRotation: best.rotation,
    confidence: best.confidenceLabel,
    method: best.method,
    confidenceScore: best.confidence,
    warning: best.confidenceLabel === "high" ? "" : "Orientation may need checking.",
    scores: {
      rasterText: rasterTextOrientation,
      pdfText: textScore,
      metadata: metadataScore,
      titleBlock: titleBlockScore,
      aspect: aspectScore,
    },
  };
}

export function applyManualRotation(orientation, deltaRotation) {
  const current = createOrientation(orientation);
  const manualRotation = combineRotations(current.finalRotation, deltaRotation);
  const userRotation = combineRotations(current.userRotation, deltaRotation);
  return createOrientation({
    ...current,
    manualRotation,
    userRotation,
    appliedRotation: manualRotation,
    orientationMode: "manual",
    confidence: "manual",
    method: "manual",
    manualOverride: true,
    orientationConfirmed: true,
    warning: "",
  });
}

export function confirmOrientation(orientation) {
  const current = createOrientation(orientation);
  return createOrientation({
    ...current,
    orientationMode: "manual",
    manualRotation: current.finalRotation,
    userRotation: current.finalRotation,
    appliedRotation: current.finalRotation,
    orientationConfirmed: true,
    confidence: "confirmed",
    warning: "",
  });
}

export function shouldAutoOrient(orientation) {
  return !orientation?.orientationConfirmed && !orientation?.manualOverride;
}
