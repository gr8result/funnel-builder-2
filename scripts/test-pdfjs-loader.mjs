// Guards the shared local PDF.js loader. The Estimate Builder workbook's PDF
// import paths (Project Estimate, Standard Inclusions) depend on this module.

import assert from "node:assert/strict";
import fs from "node:fs";

const loader = await import("../lib/pdf/pdfjsLoader.js");
const packageJson = JSON.parse(fs.readFileSync("node_modules/pdfjs-dist/package.json", "utf8"));

// --- exports -------------------------------------------------------------
assert.equal(typeof loader.loadPdfJs, "function", "lib/pdf/pdfjsLoader.js must export loadPdfJs.");
assert.equal(typeof loader.workerSrcForPdfJs, "function", "lib/pdf/pdfjsLoader.js must export workerSrcForPdfJs.");
assert.equal(loader.PDFJS_VERSION, packageJson.version, "The PDF.js loader must use the installed pdfjs-dist version.");
assert.equal(loader.PDFJS_WORKER_SRC, "/pdfjs/pdf.worker.min.mjs", "The PDF.js worker must be app-local.");

// --- workerSrcForPdfJs ---------------------------------------------------
assert.equal(
  loader.workerSrcForPdfJs({ version: packageJson.version }),
  "/pdfjs/pdf.worker.min.mjs",
  "The installed version must resolve to the local worker build.",
);
assert.equal(
  loader.workerSrcForPdfJs(undefined),
  "/pdfjs/pdf.worker.min.mjs",
  "A missing pdfjsLib must fall back to the installed local worker build.",
);
assert.throws(
  () => loader.workerSrcForPdfJs({ version: "4.2.67" }),
  /PDF\.js version mismatch/,
  "Any other version must fail instead of mixing worker versions.",
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
