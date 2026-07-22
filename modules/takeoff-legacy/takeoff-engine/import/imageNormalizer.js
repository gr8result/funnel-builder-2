import { createRasterPage } from "../core/types.js";
import { createOrientation, rotateDimensions, shouldAutoOrient, normalizeRotation } from "../core/orientation.js";
import { bestScaleTextCandidate, detectScaleSuggestions, extractScaleText } from "./scaleTextDetection.js";

export const RASTER_FORMAT = "PNG";
export const MIN_TARGET_DPI = 300;

export function createOrientationResult(overrides = {}) {
  const confidence = overrides.confidence || "unknown";
  const trusted = confidence === "high" || confidence === "confirmed";
  const orientation = createOrientation({
    metadataRotation: overrides.metadataRotation || 0,
    detectedRotation: overrides.detectedRotation || 0,
    userRotation: overrides.userRotation || 0,
    confidence,
    method: overrides.method || "none",
    orientationConfirmed: Boolean(overrides.orientationConfirmed),
    warning: overrides.warning || (trusted ? "" : "Orientation may need checking"),
  });

  return {
    ...orientation,
    rawDetectedRotation: overrides.detectedRotation || 0,
    trusted,
    scores: overrides.scores || null,
  };
}

export function normalizeRasterImagePage(input = {}) {
  const dpi = Math.max(MIN_TARGET_DPI, Number(input.dpi || MIN_TARGET_DPI));
  const orientation = createOrientationResult(input.orientation || {});
  const dimensions = input.orientationApplied
    ? { width: Number(input.imageWidth || 0), height: Number(input.imageHeight || 0) }
    : rotateDimensions(input.imageWidth, input.imageHeight, orientation.finalRotation);
  const scaleDetection = input.scaleDetection || detectScaleSuggestions({
    text: input.textContent || "",
    ocrText: input.ocrText || "",
    dpi,
    source: input.sourceType || "import-text",
  });
  const scaleTextCandidates = input.scaleTextCandidates || scaleDetection.scaleTextCandidates || extractScaleText(input.textContent || "");
  const bestScaleText = input.detectedScaleText || bestScaleTextCandidate(input.textContent || "");

  return createRasterPage({
    id: input.id,
    sourceType: input.sourceType || "pdf",
    sourceFileName: input.sourceFileName || "",
    sourcePdfPageNumber: input.sourcePdfPageNumber || input.pageNumber || 1,
    imageDataUrl: input.imageDataUrl || "",
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    dpi,
    renderScale: Number(input.renderScale || dpi / 72),
    format: input.format || RASTER_FORMAT,
    orientation,
    metadata: {
      originalImageWidth: Number(input.imageWidth || 0),
      originalImageHeight: Number(input.imageHeight || 0),
      orientationApplied: Boolean(input.orientationApplied),
      orientationAnalysis: input.orientationAnalysis || null,
      scaleTextCandidates,
      scaleSuggestions: input.scaleSuggestions || scaleDetection.suggestions || [],
      suggestedScale: input.suggestedScale || scaleDetection.bestSuggestion || null,
      dimensionCandidates: input.dimensionCandidates || scaleDetection.dimensionCandidates || [],
      detectedScaleText: bestScaleText?.normalized || "",
      detectedScaleTextRaw: bestScaleText?.text || "",
      orientationNeedsReview: shouldAutoOrient(orientation) && !orientation.trusted,
      importedAt: input.importedAt || new Date().toISOString(),
    },
  });
}

export function getRotatedRasterDimensions(width, height, rotation = 0) {
  return rotateDimensions(width, height, rotation);
}

export function loadRasterImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Raster image loading requires a browser image environment."));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function rotateRasterImageDataUrl({ imageDataUrl, imageWidth = 0, imageHeight = 0, rotation = 0 } = {}) {
  const finalRotation = normalizeRotation(rotation);
  const width = Number(imageWidth || 0);
  const height = Number(imageHeight || 0);

  if (!finalRotation) {
    return {
      imageDataUrl,
      imageWidth: width,
      imageHeight: height,
      rotation: 0,
    };
  }

  if (typeof document === "undefined") {
    throw new Error("Raster rotation requires a browser canvas environment.");
  }

  const image = await loadRasterImage(imageDataUrl);
  const dimensions = getRotatedRasterDimensions(width || image.naturalWidth || image.width, height || image.naturalHeight || image.height, finalRotation);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(dimensions.width);
  canvas.height = Math.round(dimensions.height);
  const context = canvas.getContext("2d");

  if (finalRotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (finalRotation === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (finalRotation === 270) {
    context.translate(0, canvas.height);
    context.rotate((3 * Math.PI) / 2);
  }

  context.drawImage(image, 0, 0, width || image.naturalWidth || image.width, height || image.naturalHeight || image.height);

  return {
    imageDataUrl: canvas.toDataURL("image/png"),
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    rotation: finalRotation,
  };
}

export async function rotateRasterPage(page, deltaRotation = 0) {
  const rotated = await rotateRasterImageDataUrl({
    imageDataUrl: page?.imageDataUrl,
    imageWidth: page?.imageWidth,
    imageHeight: page?.imageHeight,
    rotation: deltaRotation,
  });

  return {
    ...page,
    imageDataUrl: rotated.imageDataUrl,
    imageWidth: rotated.imageWidth,
    imageHeight: rotated.imageHeight,
    scale: null,
    measurements: [],
    areas: [],
    viewState: null,
    orientationResetWarning: "This page was rotated. Scale and measurements were reset because the coordinate system changed.",
  };
}

export function createImportStatus(status, message, details = {}) {
  return {
    status,
    message,
    details,
    at: new Date().toISOString(),
  };
}
