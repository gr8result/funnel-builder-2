// Takeoff Engine V2 — PDF.js wrapper.
//
// Loads pdfjs-dist as a real npm dependency (not the legacy CDN <script> tag) and
// renders using page.rotation directly as the viewport rotation, per spec. Each
// renderer returned by createPageRenderer() owns its own in-flight render task, so
// the main viewer and page-strip thumbnails can render concurrently without
// cancelling each other.

let pdfjsLibPromise = null;

async function loadPdfjsLib() {
  if (typeof window === "undefined") {
    throw new Error("PdfViewport can only be used in the browser.");
  }
  if (!pdfjsLibPromise) {
    // The worker is served as a static asset from public/pdfjs/ (copied from
    // node_modules/pdfjs-dist/build/ at the version pinned in package.json) rather
    // than resolved via `new URL(..., import.meta.url)` — Next.js's webpack config
    // fails to bundle that pattern for an ESM package specifier ("Module not found:
    // ESM packages ... need to be imported"). Re-copy the file if pdfjs-dist's
    // version is ever bumped.
    pdfjsLibPromise = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function loadPdfDocument(originalFileUrl) {
  const pdfjsLib = await loadPdfjsLib();
  const data = dataUrlToUint8Array(originalFileUrl);
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function getPageDimensions(pdfDocument, pageNumber) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  return { width: viewport.width, height: viewport.height };
}

// Exposes the raw operator list (used by geometry/planVectorExtraction.js to
// pull real vector linework out of the PDF) alongside the same `OPS` enum
// pdfjs-dist uses to encode it, via the one shared pdfjs-dist loading path
// above rather than a second `import("pdfjs-dist")` call site.
export async function getOperatorListForPage(pdfDocument, pageNumber) {
  const pdfjsLib = await loadPdfjsLib();
  const page = await pdfDocument.getPage(pageNumber);
  const operatorList = await page.getOperatorList();
  return { operatorList, OPS: pdfjsLib.OPS };
}

/**
 * Creates an independent renderer bound to one canvas. Call `render` again with a
 * new rotation/scale to re-render (e.g. after a rotate click) — any in-flight
 * render task for THIS renderer is cancelled first, per spec.
 *
 * `scale` controls how many PDF-point-to-pixel detail actually gets drawn
 * (sharpness); `cssWidth`/`cssHeight` control how big the canvas ELEMENT sits
 * on screen. Passing a `scale` higher than what `cssWidth`/`cssHeight` implies
 * renders more pixels into the same on-screen box — that's the whole
 * high-resolution-zoom mechanism (see PlanViewer.jsx): the box size (and so
 * the coordinate system pageToScreenPoint/screenToPagePoint use) never
 * changes, only the pixel density backing it does.
 */
export function createPageRenderer(canvas) {
  let activeTask = null;

  async function render({ pdfDocument, pageNumber, rotation, scale, cssWidth, cssHeight }) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });

    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }

    const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Setting canvas.width/height (even to an unchanged value) clears the
    // bitmap per the HTML canvas spec, so no separate clearRect is needed.
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.ceil(cssWidth ?? viewport.width)}px`;
    canvas.style.height = `${Math.ceil(cssHeight ?? viewport.height)}px`;

    const context = canvas.getContext("2d");
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const task = page.render({ canvasContext: context, viewport, transform });
    activeTask = task;
    try {
      await task.promise;
    } finally {
      if (activeTask === task) activeTask = null;
    }
    return { viewport, page, outputScale };
  }

  function cancel() {
    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }
  }

  return { render, cancel };
}

// Backing-store safeguards for the high-resolution zoom re-render — well under
// typical browser canvas limits (Chrome/Firefox allow roughly 16384px per
// side and ~268M total pixels), leaving headroom rather than rendering right
// up to the edge of what crashes a tab.
export const MAX_RENDER_CANVAS_DIMENSION = 8000;
export const MAX_RENDER_CANVAS_PIXELS = 30_000_000;

/**
 * Caps baseScale*zoomScale so the backing-store canvas (already multiplied by
 * devicePixelRatio) can't exceed the safeguards above. Returns the actual
 * scale to render at — equal to the requested scale whenever it's within
 * limits, otherwise the largest safe scale.
 */
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

/**
 * Scale that fits the (already-rotated) viewport dimensions inside a container,
 * for fit-page / fit-width. Pass swapped source dims yourself if you need
 * unrotated math elsewhere — this takes already-rotation-aware page dimensions.
 */
export function computeFitScale({ pageWidth, pageHeight, containerWidth, containerHeight, mode }) {
  if (!pageWidth || !pageHeight || !containerWidth || !containerHeight) return 1;
  const widthScale = containerWidth / pageWidth;
  const heightScale = containerHeight / pageHeight;
  if (mode === "fit-width") return widthScale;
  return Math.min(widthScale, heightScale);
}

/** True at 90/270 where PDF.js swaps width/height in the viewport for you. */
export function isSideways(rotation) {
  return rotation === 90 || rotation === 270;
}
