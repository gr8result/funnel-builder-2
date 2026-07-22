import { normalizeRasterImagePage, rotateRasterImageDataUrl, RASTER_FORMAT, MIN_TARGET_DPI } from "./imageNormalizer.js";
import { extractScaleText } from "./scaleTextDetection.js";
import { analyzeRasterOrientation, applyOrientationAnalysisToRaster } from "../analysis/imageOrientationAnalysis.js";
import { normalizeRotation } from "../core/orientation.js";

export const PDF_POINTS_PER_INCH = 72;
export const DEFAULT_TARGET_DPI = 300;

export function calculatePdfRenderScale(targetDpi = DEFAULT_TARGET_DPI) {
  const dpi = Math.max(MIN_TARGET_DPI, Number(targetDpi || DEFAULT_TARGET_DPI));
  return dpi / PDF_POINTS_PER_INCH;
}

export function textContentToString(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  return items.map((item) => item?.str || "").filter(Boolean).join(" ");
}

export function getTextItemAngle(item) {
  const transform = item?.transform;
  if (!Array.isArray(transform) || transform.length < 4) {
    return 0;
  }

  const angle = Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
  return normalizeRotation(angle);
}

export function detectOrientationFromTextContent(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const readableItems = items.filter((item) => String(item?.str || "").trim().length >= 2);
  const counts = { 0: 0, 90: 0, 180: 0, 270: 0 };
  const correctionScores = { 0: 0, 90: 0, 180: 0, 270: 0 };

  for (const item of readableItems) {
    const angle = getTextItemAngle(item);
    const length = String(item.str || "").trim().length;
    const correction = normalizeRotation(360 - angle);
    counts[angle] = (counts[angle] || 0) + length;
    correctionScores[correction] = (correctionScores[correction] || 0) + length;
  }

  const ranked = Object.entries(correctionScores)
    .map(([rotation, score]) => ({ rotation: Number(rotation), score }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] || { rotation: 0, score: 0 };
  const second = ranked[1] || { rotation: 0, score: 0 };
  const total = ranked.reduce((sum, item) => sum + item.score, 0);
  const confidence = total > 0 && best.score >= Math.max(12, second.score * 2) ? "high" : total > 0 ? "low" : "none";

  return {
    detectedRotation: normalizeRotation(best.rotation),
    dominantTextAngle: Object.entries(counts)
      .map(([rotation, score]) => ({ rotation: Number(rotation), score }))
      .sort((a, b) => b.score - a.score)[0]?.rotation || 0,
    confidence,
    method: total > 0 ? "pdf-text-layer" : "none",
    scores: correctionScores,
    rawAngleScores: counts,
  };
}

export function createPdfRasterPageObject({
  pageNumber,
  sourceFileName = "",
  imageDataUrl,
  imageWidth,
  imageHeight,
  dpi = DEFAULT_TARGET_DPI,
  renderScale = calculatePdfRenderScale(dpi),
  metadataRotation = 0,
  orientationDetection = {},
  textContent = "",
  orientationApplied = false,
  orientationAnalysis = null,
} = {}) {
  const text = typeof textContent === "string" ? textContent : textContentToString(textContent);

  return normalizeRasterImagePage({
    sourceType: "pdf",
    sourceFileName,
    sourcePdfPageNumber: pageNumber,
    imageDataUrl,
    imageWidth,
    imageHeight,
    dpi,
    renderScale,
    format: RASTER_FORMAT,
    textContent: text,
    scaleTextCandidates: extractScaleText(text),
    orientation: {
      metadataRotation: normalizeRotation(metadataRotation),
      detectedRotation: normalizeRotation(orientationDetection.detectedRotation || 0),
      confidence: orientationDetection.confidence || "unknown",
      method: orientationDetection.method || "none",
      warning: orientationDetection.warning || "",
      rawDetectedRotation: orientationDetection.detectedRotation || 0,
      scores: orientationDetection.scores || null,
      orientationConfirmed: false,
    },
    orientationApplied,
    orientationAnalysis,
  });
}

export async function renderPdfPageToRaster(page, options = {}) {
  if (!page?.getViewport || !page?.render) {
    throw new Error("renderPdfPageToRaster requires a PDF.js page object.");
  }
  if (typeof document === "undefined") {
    throw new Error("renderPdfPageToRaster requires a browser canvas environment.");
  }

  const dpi = Math.max(MIN_TARGET_DPI, Number(options.dpi || DEFAULT_TARGET_DPI));
  const renderScale = calculatePdfRenderScale(dpi);
  options.onProgress?.({
    stage: "detecting-orientation",
    message: "Detecting orientation...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const textContent = page.getTextContent ? await page.getTextContent() : null;
  const orientationDetection = detectOrientationFromTextContent(textContent);
  const metadataRotation = normalizeRotation(page.rotate || 0);
  const viewport = page.getViewport({
    scale: renderScale,
    rotation: 0,
  });
  const defaultViewport = page.getViewport({ scale: renderScale });
  const pdfJsAlreadyAppliedRotation = normalizeRotation(page.rotate || 0) !== 0
    && (Math.round(defaultViewport.width) !== Math.round(viewport.width)
      || Math.round(defaultViewport.height) !== Math.round(viewport.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  options.onProgress?.({
    stage: "rendering-png",
    message: "Rendering high-resolution PNG...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  await page.render({ canvasContext: context, viewport }).promise;
  options.onProgress?.({
    stage: "checking-scale-text",
    message: "Checking for scale text...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const rasterImageDataUrl = canvas.toDataURL("image/png");
  const orientationAnalysis = await analyzeRasterOrientation({
    imageDataUrl: rasterImageDataUrl,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    pdfTextContent: textContent,
    pdfTextAnalysis: orientationDetection,
    metadataRotation,
  });
  const rotatedRaster = await applyOrientationAnalysisToRaster({
    imageDataUrl: rasterImageDataUrl,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    orientationAnalysis,
    rotateRaster: rotateRasterImageDataUrl,
  });
  const finalRotation = normalizeRotation(rotatedRaster.rotation ?? rotatedRaster.appliedRotation ?? 0);
  const suggestedRotation = normalizeRotation(orientationAnalysis.suggestedRotation ?? orientationAnalysis.selectedRotation ?? 0);
  const storedDetectedRotation = normalizeRotation(finalRotation - metadataRotation);
  const orientationDiagnostics = {
    metadataRotation,
    analysisSuggestedRotation: suggestedRotation,
    analysisSelectedRotation: normalizeRotation(orientationAnalysis.selectedRotation || 0),
    appliedRotation: finalRotation,
    finalRotation,
    confidence: orientationAnalysis.confidence,
    confidenceScore: orientationAnalysis.confidenceScore,
    scoreGap: orientationAnalysis.scoreGap,
    reason: orientationAnalysis.reason,
    imageWidth: rotatedRaster.imageWidth,
    imageHeight: rotatedRaster.imageHeight,
    pdfJsAlreadyAppliedRotation,
    rasterNormalizerAppliedRotation: finalRotation !== 0,
    rawPdfTextAngleScores: orientationDetection.rawAngleScores || null,
    pdfTextCorrectionScores: orientationDetection.scores || null,
    ranked: orientationAnalysis.ranked || [],
  };
  if (process.env.NODE_ENV !== "production") {
    console.info("[takeoff orientation import]", orientationDiagnostics);
  }

  return createPdfRasterPageObject({
    pageNumber: options.pageNumber || page.pageNumber || 1,
    sourceFileName: options.sourceFileName || "",
    imageDataUrl: rotatedRaster.imageDataUrl,
    imageWidth: rotatedRaster.imageWidth,
    imageHeight: rotatedRaster.imageHeight,
    dpi,
    renderScale,
    metadataRotation,
    orientationDetection: {
      detectedRotation: storedDetectedRotation,
      confidence: orientationAnalysis.confidence,
      method: "raster-orientation-analysis",
      warning: orientationAnalysis.confidence === "high" ? "" : "Orientation may need checking.",
      scores: orientationAnalysis.scores,
    },
    orientationAnalysis: {
      ...orientationAnalysis,
      selectedRotation: normalizeRotation(orientationAnalysis.selectedRotation || 0),
      suggestedRotation,
      appliedRotation: finalRotation,
      detectedRotation: storedDetectedRotation,
      diagnostics: orientationDiagnostics,
    },
    textContent,
    orientationApplied: true,
  });
}

export async function importPdfToRasterPages({ pdfjsLib, data, sourceFileName = "", dpi = DEFAULT_TARGET_DPI, maxPages = Infinity, onProgress } = {}) {
  if (!pdfjsLib?.getDocument) {
    throw new Error("importPdfToRasterPages requires a pdfjsLib object with getDocument().");
  }

  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages || 0, maxPages);
  const pages = [];

  for (let index = 1; index <= pageCount; index += 1) {
    onProgress?.({
      stage: "converting-page",
      message: `Converting PDF page ${index} of ${pageCount}...`,
      pageNumber: index,
      pageCount,
    });
    const page = await pdf.getPage(index);
    pages.push(await renderPdfPageToRaster(page, { pageNumber: index, sourceFileName, dpi, onProgress }));
  }

  return pages;
}
