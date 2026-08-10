// Takeoff Engine V2 PDF.js wrapper.
//
// Uses the shared PDF.js client loader and renders with page.rotation directly
// as the viewport rotation. Each renderer owns its own in-flight render task, so
// the main viewer and page-strip thumbnails can render concurrently without
// cancelling each other.
import { getPdfJs, PDFJS_INIT_ERROR_MESSAGE } from "./pdfjsClient.js";

export const MAX_RENDER_CANVAS_DIMENSION = 8000;
export const MAX_RENDER_CANVAS_PIXELS = 30_000_000;

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pdfSourceToUint8Array(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }
  if (typeof source === "string") {
    if (source.startsWith("data:")) return dataUrlToUint8Array(source);
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not read PDF source (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error("Unsupported PDF source.");
}

export async function loadPdfDocument(pdfSource) {
  const pdfjsLib = await getPdfJs().catch((error) => {
    console.error("[takeoff-v2] PDF document load could not initialise PDF.js.", error);
    throw new Error(PDFJS_INIT_ERROR_MESSAGE);
  });
  const data = await pdfSourceToUint8Array(pdfSource);
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function getOperatorListForPage(pdfDocument, pageNumber) {
  const pdfjsLib = await getPdfJs();
  const page = await pdfDocument.getPage(pageNumber);
  return { operatorList: await page.getOperatorList(), OPS: pdfjsLib.OPS };
}

export async function getPageDimensions(pdfDocument, pageNumber) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  return { width: viewport.width, height: viewport.height };
}

export function createPageRenderer(canvas) {
  let activeTask = null;

  async function render({ pdfDocument, pageNumber, rotation, scale, displayScale = scale }) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });
    const displayViewport = displayScale === scale ? viewport : page.getViewport({ scale: displayScale, rotation });

    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }

    const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${Math.ceil(displayViewport.width)}px`;
    canvas.style.height = `${Math.ceil(displayViewport.height)}px`;

    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    const task = page.render({ canvasContext: context, viewport });
    activeTask = task;
    try {
      await task.promise;
    } finally {
      if (activeTask === task) activeTask = null;
    }
    return { viewport: displayViewport, renderViewport: viewport, page };
  }

  function cancel() {
    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }
  }

  return { render, cancel };
}

export function computeFitScale({ pageWidth, pageHeight, containerWidth, containerHeight, mode }) {
  if (!pageWidth || !pageHeight || !containerWidth || !containerHeight) return 1;
  const widthScale = containerWidth / pageWidth;
  const heightScale = containerHeight / pageHeight;
  if (mode === "fit-width") return widthScale;
  return Math.min(widthScale, heightScale);
}

export function clampSharpRenderScale({ baseScale, zoomScale, unrotatedWidth, unrotatedHeight, rotation, pixelRatio = 1 }) {
  const requestedScale = baseScale * zoomScale;
  if (!unrotatedWidth || !unrotatedHeight || !requestedScale) return requestedScale;

  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? unrotatedHeight : unrotatedWidth;
  const height = sideways ? unrotatedWidth : unrotatedHeight;

  const backingWidth = width * requestedScale * pixelRatio;
  const backingHeight = height * requestedScale * pixelRatio;

  const dimensionLimit = Math.min(
    MAX_RENDER_CANVAS_DIMENSION / backingWidth,
    MAX_RENDER_CANVAS_DIMENSION / backingHeight,
    1
  );
  const pixelLimit = Math.min(Math.sqrt(MAX_RENDER_CANVAS_PIXELS / (backingWidth * backingHeight)), 1);

  return requestedScale * Math.min(dimensionLimit, pixelLimit);
}

export function isSideways(rotation) {
  return rotation === 90 || rotation === 270;
}
