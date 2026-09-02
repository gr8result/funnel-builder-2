// Guards the shared CDN PDF.js loader extracted from
// components/estimate-builder/ai-takeoff/pdfPlanRendering.js into
// lib/pdf/pdfjsLoader.js. The Estimate Builder workbook's PDF import paths
// (Project Estimate, Standard Inclusions) depend on this module.

import assert from "node:assert/strict";

const loader = await import("../lib/pdf/pdfjsLoader.js");

// --- exports -------------------------------------------------------------
assert.equal(typeof loader.loadPdfJs, "function", "lib/pdf/pdfjsLoader.js must export loadPdfJs.");
assert.equal(typeof loader.workerSrcForPdfJs, "function", "lib/pdf/pdfjsLoader.js must export workerSrcForPdfJs.");
assert.equal(loader.PDFJS_VERSION, "3.11.174", "The pinned PDF.js version must stay 3.11.174.");

// --- workerSrcForPdfJs ---------------------------------------------------
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

assert.equal(
  loader.workerSrcForPdfJs({ version: "3.11.174" }),
  `${CDN}/pdf.worker.min.js`,
  "The pinned version must resolve to the cdnjs worker build.",
);
assert.equal(
  loader.workerSrcForPdfJs(undefined),
  `${CDN}/pdf.worker.min.js`,
  "A missing pdfjsLib must fall back to the pinned cdnjs worker build.",
);
assert.equal(
  loader.workerSrcForPdfJs({ version: "4.2.67" }),
  "https://unpkg.com/pdfjs-dist@4.2.67/legacy/build/pdf.worker.min.mjs",
  "Any other version must resolve to the unpkg legacy worker build.",
);

// --- SSR rejection + memoisation ----------------------------------------
assert.equal(typeof globalThis.window, "undefined", "This test must run without a window global.");

const first = loader.loadPdfJs();
const second = loader.loadPdfJs();

assert.equal(first, second, "loadPdfJs must memoise and return the identical promise object.");

await assert.rejects(
  first,
  (error) => error instanceof Error && error.message === "SSR",
  "loadPdfJs must reject with \"SSR\" when window is undefined.",
);
// `second` is the same settled promise; consume it so no rejection goes unhandled.
await second.catch(() => {});

console.log("PDF.js loader checks passed.");
