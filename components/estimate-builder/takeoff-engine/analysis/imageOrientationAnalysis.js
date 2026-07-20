import { normalizeRotation, rotateDimensions } from "../core/orientation.js";
import { analyzePdfTextDirection, analyzeRasterTextDirection } from "./imageTextAnalysis.js";
import { scoreTitleBlockOrientation } from "./titleBlockDetection.js";
import { scoreDrawingBoundsOrientation } from "./drawingBoundsAnalysis.js";

export const ORIENTATION_ANALYSIS_ROTATIONS = Object.freeze([0, 90, 180, 270]);
export const AUTO_ORIENTATION_MIN_CONFIDENCE = 0.74;
export const AUTO_ORIENTATION_MIN_GAP = 0.18;
export const AUTO_ORIENTATION_MIN_EVIDENCE = 0.05;

export function createRotationScoreMap() {
  return ORIENTATION_ANALYSIS_ROTATIONS.reduce((scores, rotation) => ({
    ...scores,
    [rotation]: 0,
  }), {});
}

export function confidenceToWeight(confidence) {
  if (typeof confidence === "number") {
    return Math.max(0, Math.min(1, confidence));
  }

  if (confidence === "high" || confidence === "confirmed") {
    return 1;
  }
  if (confidence === "manual") {
    return 0.85;
  }
  if (confidence === "low") {
    return 0.42;
  }
  return 0;
}

function rankRotationScores(scores) {
  return ORIENTATION_ANALYSIS_ROTATIONS
    .map((rotation) => ({ rotation, score: Number(scores[rotation] || 0) }))
    .sort((a, b) => b.score - a.score);
}

function textItemsFromPdfContent(textContent) {
  return Array.isArray(textContent?.items) ? textContent.items : [];
}

function getTextItemCorrection(item) {
  const transform = item?.transform;
  if (!Array.isArray(transform) || transform.length < 4) {
    return 0;
  }
  const angle = Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
  return normalizeRotation(360 - angle);
}

function scorePdfTextItemsByPattern(textContent, pattern, { method, label, minWeight = 6 } = {}) {
  const scores = createRotationScoreMap();
  const items = textItemsFromPdfContent(textContent);
  let matchedWeight = 0;

  for (const item of items) {
    const text = String(item?.str || "").trim();
    if (!text || !pattern.test(text)) {
      continue;
    }

    const weight = Math.max(minWeight, Math.min(80, text.length * 1.8));
    const correction = getTextItemCorrection(item);
    scores[correction] += weight;
    matchedWeight += weight;
  }

  const ranked = rankRotationScores(scores);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const dominance = matchedWeight ? best.score / matchedWeight : 0;
  const confidence = matchedWeight && best.score >= Math.max(minWeight * 2, second.score * 1.8)
    ? "high"
    : matchedWeight
      ? "low"
      : "none";

  return {
    selectedRotation: best.rotation,
    suggestedRotation: best.rotation,
    confidence,
    confidenceScore: dominance,
    reason: matchedWeight
      ? `${label} direction favours ${best.rotation} degrees.`
      : `No ${label.toLowerCase()} text was available.`,
    scores,
    ranked,
    matchedWeight,
    method,
  };
}

export function scoreDimensionTextOrientation(textContent) {
  return scorePdfTextItemsByPattern(
    textContent,
    /\b(\d+(?:\.\d+)?\s*(?:mm|cm|m)\b|\d+\s*[xX]\s*\d+|\d+\s*['"]|rl\s*\d|fcl|ffl|diam|dia)/i,
    { method: "dimension-text-direction", label: "Dimension text", minWeight: 8 },
  );
}

export function scoreCompassSymbolOrientation(textContent) {
  return scorePdfTextItemsByPattern(
    textContent,
    /^(?:n|north|true\s+north|project\s+north)$/i,
    { method: "north-point-text-direction", label: "North point text", minWeight: 14 },
  );
}

export function scoreSheetBorderOrientation({ imageWidth = 0, imageHeight = 0, imageData = null } = {}) {
  const boundsAnalysis = scoreDrawingBoundsOrientation({ imageWidth, imageHeight, imageData });
  return {
    ...boundsAnalysis,
    method: "sheet-border-raster-orientation",
    reason: boundsAnalysis.bounds
      ? "Sheet border and drawing extents favour the stored page orientation."
      : boundsAnalysis.reason,
  };
}

function darkPixelAt(data, width, x, y, threshold) {
  const offset = (y * width + x) * 4;
  return ((data[offset] + data[offset + 1] + data[offset + 2]) / 3) < threshold;
}

export function scoreDrawingGeometryOrientation({ imageData = null, imageWidth = 0, imageHeight = 0, threshold = 215 } = {}) {
  const scores = createRotationScoreMap();
  const data = imageData?.data;
  const width = Number(imageWidth || imageData?.width || 0);
  const height = Number(imageHeight || imageData?.height || 0);
  if (!data || width < 12 || height < 12) {
    return {
      selectedRotation: 0,
      suggestedRotation: 0,
      confidence: "none",
      confidenceScore: 0,
      reason: "No raster geometry sample was available.",
      scores,
      ranked: rankRotationScores(scores),
      method: "drawing-geometry-raster",
    };
  }

  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));
  let horizontalRuns = 0;
  let verticalRuns = 0;
  let dark = 0;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      if (!darkPixelAt(data, width, x, y, threshold)) {
        continue;
      }
      dark += 1;
      if (darkPixelAt(data, width, x - step, y, threshold) && darkPixelAt(data, width, x + step, y, threshold)) {
        horizontalRuns += 1;
      }
      if (darkPixelAt(data, width, x, y - step, threshold) && darkPixelAt(data, width, x, y + step, threshold)) {
        verticalRuns += 1;
      }
    }
  }

  const lineEnergy = dark ? (horizontalRuns + verticalRuns) / dark : 0;
  const axisOrthogonality = (horizontalRuns + verticalRuns)
    ? 1 - (Math.abs(horizontalRuns - verticalRuns) / (horizontalRuns + verticalRuns)) * 0.35
    : 0;
  const aspectPreference = width >= height ? 0 : 90;
  const score = Math.min(0.46, Math.max(0, lineEnergy * axisOrthogonality));
  scores[aspectPreference] = score;
  scores[normalizeRotation(aspectPreference + 180)] = score * 0.82;

  const ranked = rankRotationScores(scores);
  const best = ranked[0] || { rotation: 0, score: 0 };

  return {
    selectedRotation: best.rotation,
    suggestedRotation: best.rotation,
    confidence: score >= 0.32 ? "low" : score > 0.08 ? "low" : "none",
    confidenceScore: score,
    reason: score
      ? "Raster line geometry favours the orientation where walls remain orthogonal and the sheet reads naturally."
      : "No strong horizontal or vertical drawing geometry was found.",
    scores,
    ranked,
    diagnostics: { horizontalRuns, verticalRuns, darkPixels: dark, lineEnergy, axisOrthogonality, sampleStep: step },
    method: "drawing-geometry-raster",
  };
}

export function loadImageForAnalysis(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load raster for orientation analysis"));
    image.src = src;
  });
}

export async function getRasterImageData({ imageDataUrl = "", imageWidth = 0, imageHeight = 0, maxSampleSize = 1200 } = {}) {
  if (!imageDataUrl || typeof document === "undefined") {
    return null;
  }

  const image = await loadImageForAnalysis(imageDataUrl);
  if (!image) {
    return null;
  }

  const sourceWidth = Number(imageWidth || image.naturalWidth || image.width || 0);
  const sourceHeight = Number(imageHeight || image.naturalHeight || image.height || 0);
  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const scale = Math.min(1, maxSampleSize / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    imageData: context.getImageData(0, 0, canvas.width, canvas.height),
    sampleWidth: canvas.width,
    sampleHeight: canvas.height,
    sampleScale: scale,
  };
}

export function addAnalysisScores(targetScores, analysis, weight = 1) {
  const selectedRotation = normalizeRotation(analysis?.suggestedRotation ?? analysis?.selectedRotation ?? analysis?.detectedRotation ?? 0);
  const sourceScores = analysis?.scores && typeof analysis.scores === "object" ? analysis.scores : null;
  const baseWeight = confidenceToWeight(analysis?.confidence) * weight;

  if (sourceScores) {
    for (const rotation of ORIENTATION_ANALYSIS_ROTATIONS) {
      const sourceValue = Number(sourceScores[rotation] || 0);
      targetScores[rotation] = (targetScores[rotation] || 0) + sourceValue * weight;
    }
    return targetScores;
  }

  targetScores[selectedRotation] = (targetScores[selectedRotation] || 0) + baseWeight;
  return targetScores;
}

export function scoreMetadataRotation(metadataRotation = 0) {
  const rotation = normalizeRotation(metadataRotation);
  const scores = createRotationScoreMap();
  scores[0] = 0.02;
  return {
    selectedRotation: 0,
    suggestedRotation: rotation,
    confidence: "none",
    confidenceScore: 0.02,
    reason: `PDF metadata rotation ${rotation} degrees recorded for diagnostics only; metadata is not trusted as the primary method.`,
    scores,
    method: "pdf-metadata-diagnostic-only",
    metadataRotation: rotation,
  };
}

export function selectRotationFromScores(scores = {}) {
  const ranked = rankRotationScores(scores);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const gap = best.score - second.score;
  const highConfidence = best.score >= AUTO_ORIENTATION_MIN_CONFIDENCE && gap >= AUTO_ORIENTATION_MIN_GAP;
  const lowConfidence = !highConfidence && best.score >= 0.26;
  const hasUsableEvidence = best.score >= AUTO_ORIENTATION_MIN_EVIDENCE;
  const selectedRotation = hasUsableEvidence ? normalizeRotation(best.rotation) : 0;

  return {
    suggestedRotation: normalizeRotation(best.rotation),
    selectedRotation,
    confidence: highConfidence ? "high" : lowConfidence ? "low" : "none",
    confidenceScore: best.score,
    scoreGap: gap,
    autoApplied: hasUsableEvidence,
    reason: highConfidence
      ? `High-confidence raster analysis selected ${best.rotation} degrees.`
      : lowConfidence
        ? `Best available orientation evidence selected ${best.rotation} degrees with low confidence.`
        : "No usable orientation evidence was found; keeping the source orientation.",
    ranked,
  };
}

export async function analyzeRasterOrientation({
  imageDataUrl = "",
  imageWidth = 0,
  imageHeight = 0,
  metadataRotation = 0,
  pdfTextContent = null,
  pdfTextAnalysis = null,
  titleBlock = null,
  drawingBounds = null,
  currentOrientation = null,
  ocrAdapter = null,
} = {}) {
  if (currentOrientation?.orientationConfirmed || currentOrientation?.manualOverride) {
    return {
      selectedRotation: 0,
      suggestedRotation: normalizeRotation(currentOrientation.userRotation || currentOrientation.finalRotation || 0),
      confidence: currentOrientation?.manualOverride ? "manual" : "confirmed",
      confidenceScore: 1,
      scoreGap: 1,
      reason: "Orientation was manually confirmed and will not be overridden.",
      scores: createRotationScoreMap(),
      ranked: ORIENTATION_ANALYSIS_ROTATIONS.map((rotation) => ({ rotation, score: 0 })),
      sources: {},
      diagnostics: { confirmedOrientation: true },
      skipAutoOrientation: true,
      autoApplied: false,
    };
  }

  const rasterSample = await getRasterImageData({ imageDataUrl, imageWidth, imageHeight });
  const sampleInput = rasterSample
    ? {
      imageData: rasterSample.imageData,
      imageWidth: rasterSample.sampleWidth,
      imageHeight: rasterSample.sampleHeight,
    }
    : { imageWidth, imageHeight };

  const metadataAnalysis = scoreMetadataRotation(metadataRotation);
  const textAnalysis = pdfTextAnalysis || analyzePdfTextDirection(pdfTextContent);
  const rasterTextAnalysis = await analyzeRasterTextDirection({ imageDataUrl, imageWidth, imageHeight, ocrAdapter });
  const dimensionTextAnalysis = scoreDimensionTextOrientation(pdfTextContent);
  const compassAnalysis = scoreCompassSymbolOrientation(pdfTextContent);
  const titleBlockAnalysis = scoreTitleBlockOrientation({ ...sampleInput, ...(titleBlock || {}) });
  const sheetBorderAnalysis = scoreSheetBorderOrientation({ ...sampleInput, ...(drawingBounds || {}) });
  const drawingGeometryAnalysis = scoreDrawingGeometryOrientation(sampleInput);
  const drawingBoundsAnalysis = scoreDrawingBoundsOrientation({ ...sampleInput, ...(drawingBounds || {}) });
  const scores = createRotationScoreMap();

  addAnalysisScores(scores, metadataAnalysis, 0.15);
  addAnalysisScores(scores, textAnalysis, 0.72);
  addAnalysisScores(scores, rasterTextAnalysis, 1.25);
  addAnalysisScores(scores, dimensionTextAnalysis, 0.9);
  addAnalysisScores(scores, compassAnalysis, 0.72);
  addAnalysisScores(scores, titleBlockAnalysis, 0.95);
  addAnalysisScores(scores, sheetBorderAnalysis, 0.52);
  addAnalysisScores(scores, drawingGeometryAnalysis, 0.44);
  addAnalysisScores(scores, drawingBoundsAnalysis, 0.32);

  const selected = selectRotationFromScores(scores);

  return {
    selectedRotation: selected.selectedRotation,
    suggestedRotation: selected.suggestedRotation,
    confidence: selected.confidence,
    confidenceScore: selected.confidenceScore,
    scoreGap: selected.scoreGap,
    reason: selected.reason,
    scores,
    ranked: selected.ranked,
    autoApplied: selected.autoApplied,
    sources: {
      metadata: metadataAnalysis,
      pdfText: textAnalysis,
      rasterText: rasterTextAnalysis,
      dimensionText: dimensionTextAnalysis,
      northPoint: compassAnalysis,
      titleBlock: titleBlockAnalysis,
      sheetBorder: sheetBorderAnalysis,
      drawingGeometry: drawingGeometryAnalysis,
      drawingBounds: drawingBoundsAnalysis,
    },
    diagnostics: {
      sampleScale: rasterSample?.sampleScale || 1,
      sampleWidth: rasterSample?.sampleWidth || imageWidth,
        sampleHeight: rasterSample?.sampleHeight || imageHeight,
      minEvidenceScore: AUTO_ORIENTATION_MIN_EVIDENCE,
      highConfidenceThreshold: AUTO_ORIENTATION_MIN_CONFIDENCE,
      minScoreGap: AUTO_ORIENTATION_MIN_GAP,
      metadataUsedAsPrimaryMethod: false,
    },
    skipAutoOrientation: false,
  };
}

export async function applyOrientationAnalysisToRaster({
  imageDataUrl,
  imageWidth,
  imageHeight,
  orientationAnalysis,
  rotateRaster,
} = {}) {
  const selectedRotation = normalizeRotation(orientationAnalysis?.selectedRotation || 0);
  if (!selectedRotation || orientationAnalysis?.skipAutoOrientation) {
    return {
      imageDataUrl,
      imageWidth: Number(imageWidth || 0),
      imageHeight: Number(imageHeight || 0),
      appliedRotation: 0,
      rotation: 0,
      skippedReason: orientationAnalysis?.reason || "No automatic orientation rotation was selected.",
    };
  }

  if (typeof rotateRaster === "function") {
    return rotateRaster({
      imageDataUrl,
      imageWidth,
      imageHeight,
      rotation: selectedRotation,
    });
  }

  const dimensions = rotateDimensions(imageWidth, imageHeight, selectedRotation);
  return {
    imageDataUrl,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    appliedRotation: selectedRotation,
    rotation: selectedRotation,
  };
}
