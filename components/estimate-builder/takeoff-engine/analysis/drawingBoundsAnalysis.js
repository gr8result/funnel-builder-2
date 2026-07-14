import { normalizeRotation } from "../core/orientation.js";

export function createDrawingBoundsScores() {
  return { 0: 0, 90: 0, 180: 0, 270: 0 };
}

export function detectDrawingBoundsFromImageData({ imageData = null, imageWidth = 0, imageHeight = 0, threshold = 230 } = {}) {
  const data = imageData?.data;
  if (!data || !imageWidth || !imageHeight) {
    return null;
  }

  let minX = imageWidth;
  let minY = imageHeight;
  let maxX = 0;
  let maxY = 0;
  let darkPixels = 0;
  const step = Math.max(1, Math.floor(Math.max(imageWidth, imageHeight) / 1200));

  for (let y = 0; y < imageHeight; y += step) {
    for (let x = 0; x < imageWidth; x += step) {
      const offset = (y * imageWidth + x) * 4;
      const average = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (average < threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        darkPixels += 1;
      }
    }
  }

  if (!darkPixels) {
    return null;
  }

  const bounds = {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
  const coverage = darkPixels / Math.max(1, Math.ceil(imageWidth / step) * Math.ceil(imageHeight / step));

  return {
    bounds,
    confidence: Math.min(0.72, Math.max(0.18, coverage * 18)),
    reason: "Drawing bounds detected from dark raster pixels.",
    darkPixels,
    coverage,
    sampleStep: step,
  };
}

export function detectDrawingBounds({ imageWidth = 0, imageHeight = 0, drawingBounds = null, imageData = null } = {}) {
  if (drawingBounds) {
    return {
      bounds: drawingBounds,
      confidence: 0.62,
      reason: "Drawing bounds supplied by import analysis.",
    };
  }

  const rasterBounds = detectDrawingBoundsFromImageData({ imageData, imageWidth, imageHeight });
  if (rasterBounds) {
    return rasterBounds;
  }

  return {
    bounds: {
      x: 0,
      y: 0,
      width: Number(imageWidth || 0),
      height: Number(imageHeight || 0),
    },
    confidence: Number(imageWidth || 0) && Number(imageHeight || 0) ? 0.18 : 0,
    reason: "Using full raster bounds as a weak drawing bounds fallback.",
  };
}

export function scoreDrawingBoundsOrientation(input = {}) {
  const detection = detectDrawingBounds(input);
  const width = Number(detection.bounds?.width || input.imageWidth || 0);
  const height = Number(detection.bounds?.height || input.imageHeight || 0);
  const scores = createDrawingBoundsScores();

  if (!width || !height) {
    return {
      selectedRotation: 0,
      suggestedRotation: 0,
      confidence: "none",
      confidenceScore: 0,
      reason: "No drawing bounds available.",
      scores,
      method: "drawing-bounds-raster",
      bounds: detection.bounds,
    };
  }

  const aspectRatio = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const rotation = normalizeRotation(height > width ? 90 : 0);
  const score = aspectRatio >= 1.2 ? detection.confidence : Math.min(detection.confidence, 0.18);
  scores[rotation] = score;

  return {
    selectedRotation: rotation,
    suggestedRotation: rotation,
    confidence: score >= 0.62 ? "high" : score >= 0.3 ? "low" : "none",
    confidenceScore: score,
    reason: detection.reason,
    scores,
    method: "drawing-bounds-raster",
    bounds: detection.bounds,
    diagnostics: detection,
  };
}
