import { normalizeRotation } from "../core/orientation.js";

export function createTitleBlockScores() {
  return { 0: 0, 90: 0, 180: 0, 270: 0 };
}

export function inferRotationFromTitleBlockPosition(position = "") {
  const value = String(position || "").toLowerCase();
  if (value.includes("bottom-right") || value.includes("right-bottom")) {
    return 0;
  }
  if (value.includes("top-right") || value.includes("right-top")) {
    return 90;
  }
  if (value.includes("top-left") || value.includes("left-top")) {
    return 180;
  }
  if (value.includes("bottom-left") || value.includes("left-bottom")) {
    return 270;
  }
  return 0;
}

function getDarkPixelRatio(imageData, x0, y0, width, height, threshold = 215) {
  const data = imageData?.data;
  const imageWidth = imageData?.width || 0;
  const imageHeight = imageData?.height || 0;
  if (!data || !imageWidth || !imageHeight || width <= 0 || height <= 0) {
    return 0;
  }

  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(imageWidth, Math.ceil(x0 + width));
  const endY = Math.min(imageHeight, Math.ceil(y0 + height));
  let dark = 0;
  let total = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * imageWidth + x) * 4;
      const average = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (average < threshold) {
        dark += 1;
      }
      total += 1;
    }
  }

  return total ? dark / total : 0;
}

function getRegionVariance(imageData, x0, y0, width, height) {
  const data = imageData?.data;
  const imageWidth = imageData?.width || 0;
  const imageHeight = imageData?.height || 0;
  if (!data || !imageWidth || !imageHeight || width <= 0 || height <= 0) {
    return 0;
  }

  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(imageWidth, Math.ceil(x0 + width));
  const endY = Math.min(imageHeight, Math.ceil(y0 + height));
  let sum = 0;
  let sumSquares = 0;
  let total = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const offset = (y * imageWidth + x) * 4;
      const average = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      sum += average;
      sumSquares += average * average;
      total += 1;
    }
  }

  if (!total) {
    return 0;
  }

  const mean = sum / total;
  return Math.max(0, sumSquares / total - mean * mean);
}

export function detectTitleBlockFromImageData({ imageData = null, imageWidth = 0, imageHeight = 0 } = {}) {
  if (!imageData || !imageWidth || !imageHeight) {
    return null;
  }

  const regionWidth = Math.max(20, Math.round(imageWidth * 0.28));
  const regionHeight = Math.max(20, Math.round(imageHeight * 0.28));
  const regions = [
    { position: "top-left", x: 0, y: 0 },
    { position: "top-right", x: imageWidth - regionWidth, y: 0 },
    { position: "bottom-left", x: 0, y: imageHeight - regionHeight },
    { position: "bottom-right", x: imageWidth - regionWidth, y: imageHeight - regionHeight },
  ].map((region) => {
    const darkRatio = getDarkPixelRatio(imageData, region.x, region.y, regionWidth, regionHeight);
    const variance = getRegionVariance(imageData, region.x, region.y, regionWidth, regionHeight);
    const score = darkRatio * 0.72 + Math.min(1, variance / 4200) * 0.28;
    return { ...region, darkRatio, variance, score };
  }).sort((a, b) => b.score - a.score);

  const best = regions[0];
  const second = regions[1] || { score: 0 };
  const gap = best.score - second.score;
  const confidence = best.score >= 0.055 && gap >= 0.012
    ? Math.min(0.82, 0.45 + gap * 5 + best.score)
    : best.score >= 0.035
      ? 0.32
      : 0;

  return {
    position: best.position,
    confidence,
    reason: confidence
      ? `Raster density suggests title block near ${best.position}.`
      : "No strong title block region found in raster corners.",
    regions,
  };
}

export function detectTitleBlockPosition({
  titleBlockPosition = "",
  titleBlockBounds = null,
  imageWidth = 0,
  imageHeight = 0,
  imageData = null,
} = {}) {
  if (titleBlockPosition) {
    return {
      position: titleBlockPosition,
      confidence: 0.78,
      reason: `Title block position supplied as ${titleBlockPosition}.`,
    };
  }

  if (titleBlockBounds && imageWidth && imageHeight) {
    const centerX = Number(titleBlockBounds.x || 0) + Number(titleBlockBounds.width || 0) / 2;
    const centerY = Number(titleBlockBounds.y || 0) + Number(titleBlockBounds.height || 0) / 2;
    const horizontal = centerX >= Number(imageWidth) / 2 ? "right" : "left";
    const vertical = centerY >= Number(imageHeight) / 2 ? "bottom" : "top";
    return {
      position: `${vertical}-${horizontal}`,
      confidence: 0.7,
      reason: "Title block bounds were detected from image regions.",
    };
  }

  const rasterDetection = detectTitleBlockFromImageData({ imageData, imageWidth, imageHeight });
  if (rasterDetection) {
    return rasterDetection;
  }

  return {
    position: "unknown",
    confidence: 0,
    reason: "No title block position detected.",
  };
}

export function scoreTitleBlockOrientation(input = {}) {
  const detection = detectTitleBlockPosition(input);
  const scores = createTitleBlockScores();
  const rotation = normalizeRotation(inferRotationFromTitleBlockPosition(detection.position));
  scores[rotation] = detection.confidence;

  return {
    selectedRotation: rotation,
    suggestedRotation: rotation,
    confidence: detection.confidence >= 0.68 ? "high" : detection.confidence >= 0.3 ? "low" : "none",
    confidenceScore: detection.confidence,
    reason: detection.reason,
    scores,
    method: "title-block-raster-position",
    position: detection.position,
    diagnostics: detection,
  };
}
