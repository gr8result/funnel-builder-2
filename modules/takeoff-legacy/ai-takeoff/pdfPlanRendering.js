import { calculateFinalRotation, normalizeRotation } from "./planCoordinateUtils.js";

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

export const DEFAULT_PDF_TARGET_DPI = 300;
export const MAX_PDF_TARGET_DPI = 400;
export const PDF_POINTS_PER_INCH = 72;
export const DEFAULT_PDF_RENDER_SCALE = DEFAULT_PDF_TARGET_DPI / PDF_POINTS_PER_INCH;
export const MAX_PDF_RENDER_SCALE = MAX_PDF_TARGET_DPI / PDF_POINTS_PER_INCH;
export const PDF_RASTER_FORMAT = "PNG";
export const PDF_RENDER_DPI = DEFAULT_PDF_TARGET_DPI;

let pdfJsPromise = null;

export const normalizePlanRotation = normalizeRotation;

export function getFinalPlanRotation(page = {}) {
  if (page.rotation != null) return normalizePlanRotation(page.rotation);
  return calculateFinalRotation({
    metadataRotation: page.metadataRotation ?? page.pdfMetadataRotation ?? 0,
    detectedRotation: page.detectedRotation ?? 0,
    userRotation: page.userRotation ?? page.planRotation ?? 0,
  });
}

export function clampTargetDpi(dpi) {
  const value = Number(dpi);
  if (!Number.isFinite(value)) return DEFAULT_PDF_TARGET_DPI;
  return Math.max(DEFAULT_PDF_TARGET_DPI, Math.min(MAX_PDF_TARGET_DPI, value));
}

export function clampRenderScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value)) return DEFAULT_PDF_RENDER_SCALE;
  return Math.max(DEFAULT_PDF_RENDER_SCALE, Math.min(MAX_PDF_RENDER_SCALE, value));
}

export function createRenderMetadata(targetDpi = DEFAULT_PDF_TARGET_DPI) {
  const dpi = clampTargetDpi(targetDpi);
  return {
    dpi,
    renderScale: dpi / PDF_POINTS_PER_INCH,
    format: PDF_RASTER_FORMAT,
  };
}

function normalizeDegrees(value) {
  const degrees = Number(value) || 0;
  return ((degrees % 360) + 360) % 360;
}

function angularDistance(a, b) {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff, 360 - diff);
}

function textWeight(item) {
  const text = String(item?.str || "").trim();
  if (text.length < 2) return 0;
  return Math.min(60, text.length);
}

export function extractDetectedScaleText(text = "") {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  const patterns = [
    /\bSCALE\s*(?:@?\s*A[0-4])?\s*[:\-]?\s*(1\s*:\s*\d{2,4})\b/i,
    /\b(1\s*:\s*(?:50|75|100|125|133|150|200|250|500))\b/i,
    /@\s*A[0-4]\b/i,
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match) return match[1] ? match[1].replace(/\s+/g, "") : match[0].toUpperCase();
  }
  return "";
}

export function detectOrientationFromTextItems(items = [], metadataRotation = 0) {
  const weightedAngles = items
    .map((item) => {
      const weight = textWeight(item);
      if (!weight) return null;
      const transform = item.transform || [];
      const angle = normalizeDegrees(Math.atan2(Number(transform[1]) || 0, Number(transform[0]) || 0) * 180 / Math.PI);
      return { angle, weight };
    })
    .filter(Boolean);

  const totalWeight = weightedAngles.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight < 20) {
    return {
      detectedRotation: 0,
      method: "raster-uncertain",
      confidence: "uncertain",
      scores: [],
    };
  }

  const scores = [0, 90, 180, 270].map((rotation) => {
    let score = 0;
    weightedAngles.forEach((item) => {
      const adjusted = normalizeDegrees(item.angle + metadataRotation + rotation);
      const upright = angularDistance(adjusted, 0);
      const upsideDown = angularDistance(adjusted, 180);
      const sideways = Math.min(angularDistance(adjusted, 90), angularDistance(adjusted, 270));
      if (upright <= 10) score += item.weight * 5;
      else if (upright <= 25) score += item.weight * 2;
      else if (upsideDown <= 12) score -= item.weight * 4;
      else if (sideways <= 15) score -= item.weight * 2;
      else score -= item.weight * 0.25;
    });
    return { rotation, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];
  const margin = best && second ? best.score - second.score : 0;
  const confident = margin > totalWeight * 0.4;

  return {
    detectedRotation: confident ? normalizePlanRotation(best.rotation) : 0,
    method: confident ? "raster-text" : "raster-text-uncertain",
    confidence: confident ? "high" : "uncertain",
    scores,
  };
}

async function getPageTextInfo(page, metadataRotation) {
  try {
    const textContent = await page.getTextContent();
    const items = Array.isArray(textContent?.items) ? textContent.items : [];
    const text = items.map((item) => item.str || "").join(" ");
    return {
      orientation: detectOrientationFromTextItems(items, metadataRotation),
      detectedScaleText: extractDetectedScaleText(text),
    };
  } catch {
    return {
      orientation: {
        detectedRotation: 0,
        method: "raster-ocr-unavailable",
        confidence: "uncertain",
        scores: [],
      },
      detectedScaleText: "",
    };
  }
}

function dimensionOrientationFallback(page, metadataRotation) {
  const rawViewport = page.getViewport({ scale: 1, rotation: 0 });
  const metadataViewport = page.getViewport({ scale: 1, rotation: metadataRotation });
  if (metadataViewport.height > metadataViewport.width && rawViewport.height > rawViewport.width) {
    return {
      detectedRotation: 90,
      method: "raster-dimensions",
      confidence: "low",
      scores: [],
    };
  }
  return {
    detectedRotation: 0,
    method: "raster-dimensions",
    confidence: "uncertain",
    scores: [],
  };
}

async function detectRasterPageOrientation(page, metadataRotation, rotationState = null) {
  if (rotationState?.detectedRotation != null) {
    return {
      detectedRotation: normalizePlanRotation(rotationState.detectedRotation),
      method: rotationState.orientationMethod || "stored",
      confidence: rotationState.orientationConfidence || "stored",
      scores: rotationState.orientationScores || [],
      detectedScaleText: rotationState.detectedScaleText || "",
    };
  }

  const textInfo = await getPageTextInfo(page, metadataRotation);
  if (textInfo.orientation.confidence === "high") {
    return {
      ...textInfo.orientation,
      detectedScaleText: textInfo.detectedScaleText,
    };
  }

  return {
    ...dimensionOrientationFallback(page, metadataRotation),
    scores: textInfo.orientation.scores,
    detectedScaleText: textInfo.detectedScaleText,
  };
}

export function normalizedDimensions(width, height, finalRotation) {
  const rotation = normalizePlanRotation(finalRotation);
  return rotation === 90 || rotation === 270
    ? { normalizedWidth: height, normalizedHeight: width }
    : { normalizedWidth: width, normalizedHeight: height };
}

export function loadPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("SSR")); return; }
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }

    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

export function dataUrlToArrayBuffer(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function rotateRasterImageDataUrl(imageDataUrl, rotationDegrees = 0) {
  const rotation = normalizePlanRotation(rotationDegrees);
  if (!imageDataUrl || !rotation) return {
    dataUrl: imageDataUrl,
    width: 0,
    height: 0,
  };

  const image = await loadImage(imageDataUrl);
  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? image.naturalHeight || image.height : image.naturalWidth || image.width;
  canvas.height = swap ? image.naturalWidth || image.width : image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(image, -(image.naturalWidth || image.width) / 2, -(image.naturalHeight || image.height) / 2);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load raster image."));
    image.src = src;
  });
}

export function buildRasterPageMetadata({
  dataUrl,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  canvasCssWidth,
  canvasCssHeight,
  originalWidth,
  originalHeight,
  metadataRotation,
  detectedRotation,
  userRotation,
  rotation,
  renderScale,
  dpi,
  sourcePdfPageNumber,
  orientationMethod,
  orientationConfidence,
  orientationConfirmed = false,
  orientationScores = [],
  detectedScaleText = "",
}) {
  const finalRotation = normalizePlanRotation(rotation ?? calculateFinalRotation({ metadataRotation, detectedRotation, userRotation }));
  return {
    imageDataUrl: dataUrl,
    imageWidth: canvasWidth,
    imageHeight: canvasHeight,
    viewportWidth: viewportWidth ?? canvasWidth,
    viewportHeight: viewportHeight ?? canvasHeight,
    canvasPixelWidth: canvasWidth,
    canvasPixelHeight: canvasHeight,
    canvasCssWidth: canvasCssWidth ?? viewportWidth ?? canvasWidth,
    canvasCssHeight: canvasCssHeight ?? viewportHeight ?? canvasHeight,
    normalizedWidth: canvasWidth,
    normalizedHeight: canvasHeight,
    naturalWidth: canvasWidth,
    naturalHeight: canvasHeight,
    originalWidth,
    originalHeight,
    metadataRotation,
    detectedRotation,
    userRotation,
    finalRotation,
    planRotation: finalRotation,
    rotation: finalRotation,
    dpi,
    renderScale,
    format: PDF_RASTER_FORMAT,
    sourcePdfPageNumber,
    orientationMethod,
    orientationConfidence,
    orientationConfirmed,
    orientationScores,
    detectedScaleText,
  };
}

export async function renderPdfPageToDataUrl(pdfDoc, pageNum, targetDpi = DEFAULT_PDF_TARGET_DPI, rotationState = null) {
  const page = await pdfDoc.getPage(pageNum);
  const { renderScale, dpi, format } = createRenderMetadata(targetDpi);
  const rawViewport = page.getViewport({ scale: 1, rotation: 0 });
  const originalWidth = rawViewport.width;
  const originalHeight = rawViewport.height;
  const metadataRotation = normalizePlanRotation(rotationState?.metadataRotation ?? page.rotate ?? 0);
  const detection = await detectRasterPageOrientation(page, metadataRotation, rotationState);
  const detectedRotation = normalizePlanRotation(detection.detectedRotation);
  const userRotation = normalizePlanRotation(rotationState?.userRotation ?? 0);
  const finalRotation = normalizePlanRotation(
    rotationState?.rotation
      ?? rotationState?.pageRotation
      ?? calculateFinalRotation({ metadataRotation, detectedRotation, userRotation }),
  );
  const viewport = page.getViewport({ scale: renderScale, rotation: finalRotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  canvas.style.transform = "none";
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    ...buildRasterPageMetadata({
      dataUrl: canvas.toDataURL("image/png"),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      canvasCssWidth: viewport.width,
      canvasCssHeight: viewport.height,
      originalWidth,
      originalHeight,
      metadataRotation,
      detectedRotation,
      userRotation,
      rotation: finalRotation,
      renderScale,
      dpi,
      sourcePdfPageNumber: pageNum,
      orientationMethod: detection.method,
      orientationConfidence: detection.confidence,
      orientationConfirmed: Boolean(rotationState?.orientationConfirmed),
      orientationScores: detection.scores,
      detectedScaleText: detection.detectedScaleText,
    }),
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    format,
  };
}

export async function renderPdfDataUrlPage(originalFileUrl, pageNumber, rotationState = {}, targetDpi = DEFAULT_PDF_TARGET_DPI) {
  const pdfjsLib = await loadPdfJs();
  const pdfDoc = await pdfjsLib.getDocument({ data: dataUrlToArrayBuffer(originalFileUrl) }).promise;
  return renderPdfPageToDataUrl(pdfDoc, pageNumber, targetDpi, rotationState);
}
