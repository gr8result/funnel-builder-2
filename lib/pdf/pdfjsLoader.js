// Shared browser-side PDF.js loader.
//
// Consumers: Estimate Builder workbook PDF import and browser PDF rendering.
// The worker must be served from this app and must match the installed
// pdfjs-dist package.

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const PDFJS_VERSION = pdfjsLib.version;
const PDFJS_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

let pdfJsPromise = null;

export function workerSrcForPdfJs(module = pdfjsLib) {
  const version = String(module?.version || PDFJS_VERSION);
  if (version !== PDFJS_VERSION) {
    throw new Error(`PDF.js version mismatch: loaded ${version}, installed ${PDFJS_VERSION}.`);
  }
  return PDFJS_WORKER_SRC;
}

export function loadPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = Promise.resolve().then(() => {
    if (typeof window === "undefined") throw new Error("SSR");
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcForPdfJs(pdfjsLib);
    return pdfjsLib;
  });
  return pdfJsPromise;
}

export { PDFJS_VERSION, PDFJS_WORKER_SRC };
