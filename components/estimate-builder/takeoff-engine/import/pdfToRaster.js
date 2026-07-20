import { normalizeRasterImagePage, RASTER_FORMAT, MIN_TARGET_DPI } from "./imageNormalizer.js";
import { extractScaleText } from "./scaleTextDetection.js";
import { analyzeRasterOrientation } from "../analysis/imageOrientationAnalysis.js";
import { normalizeRotation } from "../core/orientation.js";
import { pdfToPlanCoordinates } from "../core/planCoordinates.js";

export const PDF_POINTS_PER_INCH = 72;
export const DEFAULT_TARGET_DPI = 300;
export const PLAN_ROTATIONS = Object.freeze([0, 90, 180, 270]);

/**
 * @typedef {0 | 90 | 180 | 270} PlanRotation
 */

export function toPlanRotation(rotation = 0) {
  return /** @type {PlanRotation} */ (normalizeRotation(rotation));
}

export function calculatePdfRenderScale(targetDpi = DEFAULT_TARGET_DPI) {
  const dpi = Math.max(MIN_TARGET_DPI, Number(targetDpi || DEFAULT_TARGET_DPI));
  return dpi / PDF_POINTS_PER_INCH;
}

export function textContentToString(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  return items.map((item) => item?.str || "").filter(Boolean).join(" ");
}

function getPagePointDimensions(page) {
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  return {
    pageWidthPoints: Number(viewport.width || 0),
    pageHeightPoints: Number(viewport.height || 0),
  };
}

export function extractPlanTextItems(textContent, pageInfo = {}) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  return items.map((item, index) => {
    const transform = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const pdfPoint = { x: Number(transform[4] || 0), y: Number(transform[5] || 0) };
    return {
      id: `text-${pageInfo.pageNumber || 1}-${index + 1}`,
      text: String(item?.str || ""),
      pdfPoint,
      planPoint: pdfToPlanCoordinates(pdfPoint, pageInfo),
      width: Number(item?.width || 0),
      height: Number(item?.height || 0),
      angle: getTextItemAngle(item),
      transform,
      fontName: item?.fontName || "",
      confidence: 1,
      source: "pdf-text",
    };
  }).filter((item) => item.text.trim());
}

export function getTextItemAngle(item) {
  const transform = item?.transform;
  if (!Array.isArray(transform) || transform.length < 4) {
    return 0;
  }

  const angle = Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
  return normalizeRotation(angle);
}

export function detectOrientationFromTextContent(textContent, metadataRotation = 0) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const readableItems = items.filter((item) => String(item?.str || "").trim().length >= 2);
  const counts = { 0: 0, 90: 0, 180: 0, 270: 0 };
  const finalRotationScores = { 0: 0, 90: 0, 180: 0, 270: 0 };

  for (const item of readableItems) {
    const angle = getTextItemAngle(item);
    const length = String(item.str || "").trim().length;
    counts[angle] = (counts[angle] || 0) + length;
    for (const rotation of PLAN_ROTATIONS) {
      if (normalizeRotation(angle + rotation - metadataRotation) === 0) {
        finalRotationScores[rotation] = (finalRotationScores[rotation] || 0) + length;
      }
    }
  }

  const ranked = Object.entries(finalRotationScores)
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
    scores: finalRotationScores,
    rawAngleScores: counts,
  };
}

function hasUsablePdfText(textContent) {
  return Array.isArray(textContent?.items)
    && textContent.items.some((item) => String(item?.str || "").trim().length >= 2);
}

function orientationConfidenceScore(confidence) {
  if (confidence === "high") return 1;
  if (confidence === "low") return 0.48;
  if (confidence === "manual" || confidence === "confirmed") return 1;
  return 0;
}

async function renderPdfPageToCanvas(page, { scale, rotation, alpha = false } = {}) {
  const viewport = page.getViewport({
    scale,
    rotation: toPlanRotation(rotation),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha });
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, viewport };
}

function pdfOperatorName(pdfjsLib, opCode) {
  const ops = pdfjsLib?.OPS || {};
  return Object.keys(ops).find((key) => ops[key] === opCode) || String(opCode);
}

function normalizeLineSegment(pointA, pointB, pageInfo, id, source = "pdf-operator") {
  if (!pointA || !pointB) return null;
  const planStart = pdfToPlanCoordinates(pointA, pageInfo);
  const planEnd = pdfToPlanCoordinates(pointB, pageInfo);
  const length = Math.hypot(planEnd.x - planStart.x, planEnd.y - planStart.y);
  if (!Number.isFinite(length) || length <= 0.01) return null;
  return {
    id,
    source,
    start: planStart,
    end: planEnd,
    pdfStart: pointA,
    pdfEnd: pointB,
    length,
  };
}

export async function extractPdfVectorData(page, pdfjsLib, pageInfo = {}) {
  const empty = {
    coordinateSpace: "plan",
    extractedAt: new Date().toISOString(),
    lineSegments: [],
    rectangles: [],
    paths: [],
    images: [],
    operatorSummary: {},
  };
  if (!page?.getOperatorList) return empty;

  const operatorList = await page.getOperatorList().catch(() => null);
  const fnArray = Array.isArray(operatorList?.fnArray) ? operatorList.fnArray : [];
  const argsArray = Array.isArray(operatorList?.argsArray) ? operatorList.argsArray : [];
  const segments = [];
  const rectangles = [];
  const paths = [];
  const images = [];
  const operatorSummary = {};
  let currentPoint = { x: 0, y: 0 };
  let subpathStart = null;

  for (let index = 0; index < fnArray.length; index += 1) {
    const opName = pdfOperatorName(pdfjsLib, fnArray[index]);
    const args = Array.isArray(argsArray[index]) ? argsArray[index] : [];
    operatorSummary[opName] = (operatorSummary[opName] || 0) + 1;

    if (opName === "moveTo") {
      currentPoint = { x: Number(args[0] || 0), y: Number(args[1] || 0) };
      subpathStart = currentPoint;
    } else if (opName === "lineTo") {
      const nextPoint = { x: Number(args[0] || 0), y: Number(args[1] || 0) };
      const segment = normalizeLineSegment(currentPoint, nextPoint, pageInfo, `vector-${pageInfo.pageNumber || 1}-${segments.length + 1}`);
      if (segment) segments.push(segment);
      currentPoint = nextPoint;
    } else if (opName === "rectangle") {
      const [x = 0, y = 0, width = 0, height = 0] = args.map((value) => Number(value || 0));
      const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
      const planCorners = corners.map((point) => pdfToPlanCoordinates(point, pageInfo));
      rectangles.push({
        id: `rect-${pageInfo.pageNumber || 1}-${rectangles.length + 1}`,
        source: "pdf-operator",
        pdfBox: { x, y, width, height },
        points: planCorners,
      });
      for (let corner = 0; corner < corners.length; corner += 1) {
        const segment = normalizeLineSegment(
          corners[corner],
          corners[(corner + 1) % corners.length],
          pageInfo,
          `vector-${pageInfo.pageNumber || 1}-${segments.length + 1}`,
        );
        if (segment) segments.push(segment);
      }
    } else if (opName === "closePath" && subpathStart) {
      const segment = normalizeLineSegment(currentPoint, subpathStart, pageInfo, `vector-${pageInfo.pageNumber || 1}-${segments.length + 1}`);
      if (segment) segments.push(segment);
      currentPoint = subpathStart;
    } else if (opName === "constructPath") {
      paths.push({
        id: `path-${pageInfo.pageNumber || 1}-${paths.length + 1}`,
        source: "pdf-operator",
        args,
      });
    } else if (/image/i.test(opName)) {
      images.push({
        id: `image-${pageInfo.pageNumber || 1}-${images.length + 1}`,
        source: "pdf-operator",
        operator: opName,
      });
    }
  }

  return {
    ...empty,
    lineSegments: segments,
    rectangles,
    paths,
    images,
    operatorSummary,
  };
}

async function detectPdfUprightCorrection({ page, textContent, metadataRotation, renderScale, onProgress, pageNumber } = {}) {
  const textDetection = detectOrientationFromTextContent(textContent, metadataRotation);
  if (hasUsablePdfText(textContent)) {
    const autoRotation = toPlanRotation(textDetection.detectedRotation);
    return {
      autoRotation,
      detectedCorrection: toPlanRotation(autoRotation - metadataRotation),
      orientationConfidence: textDetection.confidence,
      orientationConfidenceScore: orientationConfidenceScore(textDetection.confidence),
      method: "pdf-text-layer",
      scores: textDetection.scores,
      rawAngleScores: textDetection.rawAngleScores,
      analysis: {
        selectedRotation: autoRotation,
        suggestedRotation: autoRotation,
        confidence: textDetection.confidence,
        confidenceScore: orientationConfidenceScore(textDetection.confidence),
        reason: "PDF text extraction selected the upright correction.",
        scores: textDetection.scores,
        rawAngleScores: textDetection.rawAngleScores,
        method: "pdf-text-layer",
      },
    };
  }

  onProgress?.({
    stage: "detecting-orientation",
    message: "Analysing orientation...",
    detail: "Rendering page internally for OCR orientation scoring",
    pageNumber,
  });
  const preview = await renderPdfPageToCanvas(page, {
    scale: Math.min(renderScale, calculatePdfRenderScale(120)),
    rotation: metadataRotation,
  });
  const previewDataUrl = preview.canvas.toDataURL("image/png");
  const rasterAnalysis = await analyzeRasterOrientation({
    imageDataUrl: previewDataUrl,
    imageWidth: preview.canvas.width,
    imageHeight: preview.canvas.height,
    metadataRotation,
    pdfTextContent: textContent,
    pdfTextAnalysis: textDetection,
  });

  const autoRotation = toPlanRotation(rasterAnalysis.selectedRotation || 0);
  return {
    autoRotation,
    detectedCorrection: toPlanRotation(autoRotation - metadataRotation),
    orientationConfidence: rasterAnalysis.confidence,
    orientationConfidenceScore: Number(rasterAnalysis.confidenceScore || 0),
    method: rasterAnalysis.sources?.rasterText?.confidence !== "none" ? "raster-ocr-text-direction" : "raster-orientation-analysis",
    scores: rasterAnalysis.scores,
    rawAngleScores: textDetection.rawAngleScores,
    analysis: rasterAnalysis,
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
  sourceFingerprint = "",
  sourcePdfDataUrl = "",
  pageWidthPoints = 0,
  pageHeightPoints = 0,
  textData = [],
  vectorData = null,
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
      detectedRotation: normalizeRotation(orientationDetection.detectedCorrection ?? orientationDetection.detectedRotation ?? 0),
      autoRotation: normalizeRotation(orientationDetection.autoRotation ?? orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
      manualRotation: normalizeRotation(orientationDetection.manualRotation ?? orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
      finalRotation: normalizeRotation(orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
      confidence: orientationDetection.confidence || "unknown",
      method: orientationDetection.method || "none",
      warning: orientationDetection.warning || "",
      rawDetectedRotation: orientationDetection.detectedCorrection ?? orientationDetection.detectedRotation ?? 0,
      appliedRotation: orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0,
      autoApplied: Boolean(orientationDetection.autoApplied),
      scores: orientationDetection.scores || null,
      orientationMode: orientationDetection.orientationMode || "auto",
      orientationConfirmed: false,
    },
    orientationApplied,
    orientationAnalysis,
    orientationAutoApplied: Boolean(orientationDetection.autoApplied),
    orientationMode: orientationDetection.orientationMode || "auto",
    autoRotation: normalizeRotation(orientationDetection.autoRotation ?? orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
    manualRotation: normalizeRotation(orientationDetection.manualRotation ?? orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
    finalRotation: normalizeRotation(orientationDetection.finalRotation ?? orientationDetection.appliedRotation ?? 0),
    sourceFingerprint,
    sourcePdfDataUrl,
    originalFileUrl: sourcePdfDataUrl,
    fileHash: sourceFingerprint,
    pageWidthPoints,
    pageHeightPoints,
    textData,
    vectorData,
    rasterPreviewUrl: imageDataUrl,
    processingStatus: "ready",
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
    message: "Analysing orientation...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const textContent = page.getTextContent ? await page.getTextContent() : null;
  const metadataRotation = toPlanRotation(((Number(page.rotate || 0) % 360) + 360) % 360);
  const pageDimensions = getPagePointDimensions(page);
  const detected = options.orientationMode === "manual"
    ? {
      autoRotation: toPlanRotation(options.previousAutoRotation ?? options.autoRotation ?? 0),
      manualRotation: toPlanRotation(options.manualRotation || 0),
      detectedCorrection: toPlanRotation(Number(options.manualRotation || 0) - metadataRotation),
      orientationConfidence: "manual",
      orientationConfidenceScore: 1,
      method: "manual-pdf-render",
      scores: { 0: 0, 90: 0, 180: 0, 270: 0 },
      rawAngleScores: null,
      analysis: {
        selectedRotation: toPlanRotation(Number(options.manualRotation || 0) - metadataRotation),
        suggestedRotation: toPlanRotation(Number(options.manualRotation || 0) - metadataRotation),
        confidence: "manual",
        confidenceScore: 1,
        reason: "Manual PDF rotation override.",
        method: "manual-pdf-render",
      },
    }
    : await detectPdfUprightCorrection({
      page,
      textContent,
      metadataRotation,
      renderScale,
      onProgress: options.onProgress,
      pageNumber: options.pageNumber || page.pageNumber || 1,
    });
  const autoRotation = toPlanRotation(detected.autoRotation ?? (metadataRotation + detected.detectedCorrection));
  const manualRotation = toPlanRotation(detected.manualRotation ?? options.manualRotation ?? autoRotation);
  const finalRotation = toPlanRotation(options.orientationMode === "manual" ? manualRotation : autoRotation);
  const pageInfo = {
    pageNumber: options.pageNumber || page.pageNumber || 1,
    pageWidthPoints: pageDimensions.pageWidthPoints,
    pageHeightPoints: pageDimensions.pageHeightPoints,
    finalRotation,
  };
  const textData = extractPlanTextItems(textContent, pageInfo);

  options.onProgress?.({
    stage: "extracting-geometry",
    message: "Extracting drawing geometry...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const vectorData = await extractPdfVectorData(page, options.pdfjsLib, pageInfo);

  options.onProgress?.({
    stage: "checking-scale-text",
    message: "Detecting scale...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const { canvas } = await renderPdfPageToCanvas(page, {
    scale: renderScale,
    rotation: finalRotation,
  });
  options.onProgress?.({
    stage: "preparing-drawing",
    message: "Preparing drawing...",
    pageNumber: options.pageNumber || page.pageNumber || 1,
  });
  const rasterImageDataUrl = canvas.toDataURL("image/png");
  const orientationAnalysis = {
    ...(detected.analysis || {}),
    selectedRotation: detected.detectedCorrection,
    suggestedRotation: detected.detectedCorrection,
    detectedCorrection: detected.detectedCorrection,
    autoRotation,
    manualRotation,
    finalRotation,
    appliedRotation: finalRotation,
    orientationMode: options.orientationMode === "manual" ? "manual" : "auto",
    confidence: detected.orientationConfidence,
    confidenceScore: detected.orientationConfidenceScore,
    autoApplied: options.orientationMode !== "manual",
  };
  const orientationDiagnostics = {
    metadataRotation,
    detectedCorrection: detected.detectedCorrection,
    autoRotation,
    manualRotation,
    appliedRotation: finalRotation,
    finalRotation,
    confidence: detected.orientationConfidence,
    confidenceScore: detected.orientationConfidenceScore,
    scoreGap: orientationAnalysis.scoreGap || 0,
    reason: orientationAnalysis.reason,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    pdfJsViewportRotation: finalRotation,
    secondaryRotationApplied: false,
    rawPdfTextAngleScores: detected.rawAngleScores || null,
    pdfTextCorrectionScores: detected.scores || null,
    ranked: orientationAnalysis.ranked || [],
  };
  if (process.env.NODE_ENV !== "production") {
    console.info("[takeoff orientation import]", orientationDiagnostics);
  }

  return createPdfRasterPageObject({
    pageNumber: options.pageNumber || page.pageNumber || 1,
    sourceFileName: options.sourceFileName || "",
    imageDataUrl: rasterImageDataUrl,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    dpi,
    renderScale,
    metadataRotation,
    orientationDetection: {
      detectedCorrection: detected.detectedCorrection,
      autoRotation,
      manualRotation,
      finalRotation,
      appliedRotation: finalRotation,
      confidence: detected.orientationConfidence,
      method: detected.method,
      warning: detected.orientationConfidence === "none" ? "Orientation may need checking." : "",
      autoApplied: options.orientationMode !== "manual",
      scores: detected.scores,
      orientationMode: options.orientationMode === "manual" ? "manual" : "auto",
      sourcePdfDataUrl: options.sourcePdfDataUrl || "",
    },
    orientationAnalysis: {
      ...orientationAnalysis,
      selectedRotation: detected.detectedCorrection,
      suggestedRotation: detected.detectedCorrection,
      detectedCorrection: detected.detectedCorrection,
      autoRotation,
      manualRotation,
      finalRotation,
      appliedRotation: finalRotation,
      diagnostics: orientationDiagnostics,
    },
    textContent,
    orientationApplied: true,
    sourceFingerprint: options.sourceFingerprint || "",
    sourcePdfDataUrl: options.sourcePdfDataUrl || "",
    pageWidthPoints: pageDimensions.pageWidthPoints,
    pageHeightPoints: pageDimensions.pageHeightPoints,
    textData,
    vectorData,
  });
}

export async function importPdfToRasterPages({ pdfjsLib, data, sourceFileName = "", sourceFingerprint = "", sourcePdfDataUrl = "", dpi = DEFAULT_TARGET_DPI, maxPages = Infinity, onProgress } = {}) {
  if (!pdfjsLib?.getDocument) {
    throw new Error("importPdfToRasterPages requires a pdfjsLib object with getDocument().");
  }

  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages || 0, maxPages);
  const pages = [];

  for (let index = 1; index <= pageCount; index += 1) {
    onProgress?.({
      stage: "processing-page",
      message: `Processing page ${index} of ${pageCount}`,
      detail: `Page ${index} of ${pageCount}`,
      pageNumber: index,
      pageCount,
    });
    const page = await pdf.getPage(index);
    pages.push(await renderPdfPageToRaster(page, { pageNumber: index, sourceFileName, sourceFingerprint, sourcePdfDataUrl, dpi, onProgress, pdfjsLib }));
  }

  return pages;
}
