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

/**
 * Creates an independent renderer bound to one canvas. Call `render` again with a
 * new rotation/scale to re-render (e.g. after a rotate click) — any in-flight
 * render task for THIS renderer is cancelled first, per spec.
 */
export function createPageRenderer(canvas) {
  let activeTask = null;

  async function render({ pdfDocument, pageNumber, rotation, scale }) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });

    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }

    const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;

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
    return { viewport, page };
  }

  function cancel() {
    if (activeTask) {
      activeTask.cancel();
      activeTask = null;
    }
  }

  return { render, cancel };
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
