import { normalizeRotation, rotateDimensions } from "../core/orientation.js";
import { analyzePdfTextDirection, analyzeRasterTextDirection } from "./imageTextAnalysis.js";
import { scoreTitleBlockOrientation } from "./titleBlockDetection.js";
import { scoreDrawingBoundsOrientation } from "./drawingBoundsAnalysis.js";

export const ORIENTATION_ANALYSIS_ROTATIONS = Object.freeze([0, 90, 180, 270]);
export const AUTO_ORIENTATION_MIN_CONFIDENCE = 0.74;
export const AUTO_ORIENTATION_MIN_GAP = 0.18;

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
  const ranked = ORIENTATION_ANALYSIS_ROTATIONS
    .map((rotation) => ({ rotation, score: Number(scores[rotation] || 0) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const gap = best.score - second.score;
  const highConfidence = best.score >= AUTO_ORIENTATION_MIN_CONFIDENCE && gap >= AUTO_ORIENTATION_MIN_GAP;
  const lowConfidence = !highConfidence && best.score >= 0.26;

  return {
    suggestedRotation: normalizeRotation(best.rotation),
    selectedRotation: highConfidence ? normalizeRotation(best.rotation) : 0,
    confidence: highConfidence ? "high" : lowConfidence ? "low" : "none",
    confidenceScore: best.score,
    scoreGap: gap,
    autoApplied: highConfidence,
    reason: highConfidence
      ? `High-confidence raster analysis selected ${best.rotation} degrees.`
      : `Orientation may need checking. Best suggestion is ${best.rotation} degrees, but confidence was not high enough to auto-rotate.`,
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
  if (currentOrientation?.orientationConfirmed) {
    return {
      selectedRotation: 0,
      suggestedRotation: normalizeRotation(currentOrientation.userRotation || currentOrientation.finalRotation || 0),
      confidence: "confirmed",
      confidenceScore: 1,
      scoreGap: 1,
      reason: "Orientation was confirmed manually and will not be overridden.",
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
  const titleBlockAnalysis = scoreTitleBlockOrientation({ ...sampleInput, ...(titleBlock || {}) });
  const drawingBoundsAnalysis = scoreDrawingBoundsOrientation({ ...sampleInput, ...(drawingBounds || {}) });
  const scores = createRotationScoreMap();

  addAnalysisScores(scores, metadataAnalysis, 0.15);
  addAnalysisScores(scores, textAnalysis, 0.72);
  addAnalysisScores(scores, rasterTextAnalysis, 1.25);
  addAnalysisScores(scores, titleBlockAnalysis, 0.95);
  addAnalysisScores(scores, drawingBoundsAnalysis, 0.55);

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
      titleBlock: titleBlockAnalysis,
      drawingBounds: drawingBoundsAnalysis,
    },
    diagnostics: {
      sampleScale: rasterSample?.sampleScale || 1,
      sampleWidth: rasterSample?.sampleWidth || imageWidth,
      sampleHeight: rasterSample?.sampleHeight || imageHeight,
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
  if (!selectedRotation || orientationAnalysis?.confidence !== "high") {
    return {
      imageDataUrl,
      imageWidth: Number(imageWidth || 0),
      imageHeight: Number(imageHeight || 0),
      appliedRotation: 0,
      rotation: 0,
      skippedReason: orientationAnalysis?.reason || "Orientation confidence was not high enough to auto-rotate.",
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
