import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export const PDFJS_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
export const PDFJS_INIT_ERROR_MESSAGE = "PDF viewer failed to initialise. Refresh the page and try again.";
export const PDFJS_OPS = pdfjsLib.OPS;

let pdfjsInitPromise = null;
let pdfjsImporter = () => Promise.resolve(pdfjsLib);
let configureCount = 0;

export function isPdfJsChunkLoadError(error) {
  const text = `${error?.name || ""} ${error?.message || ""} ${error?.stack || ""}`.toLowerCase();
  return (
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("timeout loading") ||
    text.includes("/_next/static/chunks/") ||
    text.includes("pages-dir-browser_node_modules_pdfjs-dist")
  );
}

function configurePdfJs(pdfjs) {
  if (!pdfjs?.getDocument || !pdfjs?.GlobalWorkerOptions) {
    throw new Error("Invalid pdfjs-dist module.");
  }
  if (pdfjs.GlobalWorkerOptions.workerSrc !== PDFJS_WORKER_SRC) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    configureCount += 1;
  }
  return pdfjs;
}

async function initialisePdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF.js can only be initialised in the browser.");
  }
  return configurePdfJs(await pdfjsImporter());
}

export function getPdfJs({ retryOnChunkLoadError = true } = {}) {
  if (!pdfjsInitPromise) {
    pdfjsInitPromise = initialisePdfJs();
  }

  return pdfjsInitPromise.catch((error) => {
    pdfjsInitPromise = null;
    if (retryOnChunkLoadError && isPdfJsChunkLoadError(error)) {
      console.warn("[takeoff-v2] PDF.js chunk initialisation failed; retrying once.", error);
      return getPdfJs({ retryOnChunkLoadError: false });
    }
    console.error("[takeoff-v2] PDF.js initialisation failed.", error);
    throw new Error(PDFJS_INIT_ERROR_MESSAGE);
  });
}

export function getPdfJsWorkerVersion() {
  return pdfjsLib.version;
}

export function __getPdfJsClientStateForTests() {
  return { hasPromise: Boolean(pdfjsInitPromise), configureCount };
}

export function __resetPdfJsClientForTests() {
  pdfjsInitPromise = null;
  pdfjsImporter = () => Promise.resolve(pdfjsLib);
  configureCount = 0;
  if (pdfjsLib?.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = "";
}

export function __setPdfJsImporterForTests(importer) {
  pdfjsInitPromise = null;
  pdfjsImporter = importer;
}
