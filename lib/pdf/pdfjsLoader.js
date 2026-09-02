// Shared browser-side PDF.js loader.
//
// This loads PDF.js **from CDN** via an injected <script> tag, pinned to
// PDFJS_VERSION. It is deliberately distinct from the `pdfjs-dist` npm package
// used by the new AI Plan Takeoff engine
// (components/construction-estimation/ai-plan-takeoff/) — the two strategies
// coexist on purpose and must not be conflated.
//
// Consumers: Estimate Builder workbook PDF import (Project Estimate and
// Standard Inclusions). No takeoff involvement.

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let pdfJsPromise = null;

export function workerSrcForPdfJs(pdfjsLib) {
  const version = String(pdfjsLib?.version || PDFJS_VERSION);
  if (version === PDFJS_VERSION) return `${PDFJS_CDN}/pdf.worker.min.js`;
  return `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
}

export function loadPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("SSR")); return; }
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcForPdfJs(window.pdfjsLib);
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcForPdfJs(window.pdfjsLib);
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

export { PDFJS_VERSION, PDFJS_CDN };
