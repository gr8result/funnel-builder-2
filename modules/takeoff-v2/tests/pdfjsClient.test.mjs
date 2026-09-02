import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PDFJS_INIT_ERROR_MESSAGE,
  PDFJS_WORKER_SRC,
  __getPdfJsClientStateForTests,
  __resetPdfJsClientForTests,
  __setPdfJsImporterForTests,
  getPdfJs,
  getPdfJsWorkerVersion,
  isPdfJsChunkLoadError,
} from "../viewer/pdfjsClient.js";

global.window = {};

function fakePdfJs() {
  return {
    version: "6.1.200",
    OPS: { constructPath: 91 },
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({ promise: Promise.resolve({ numPages: 1 }) }),
  };
}

{
  __resetPdfJsClientForTests();
  let calls = 0;
  const module = fakePdfJs();
  __setPdfJsImporterForTests(async () => {
    calls += 1;
    await Promise.resolve();
    return module;
  });
  const [a, b] = await Promise.all([getPdfJs(), getPdfJs()]);
  assert.equal(a, module);
  assert.equal(b, module);
  assert.equal(calls, 1, "concurrent callers must share one PDF.js initialisation");
  assert.equal(module.GlobalWorkerOptions.workerSrc, PDFJS_WORKER_SRC, "workerSrc must be configured once on the shared module");
  assert.equal(__getPdfJsClientStateForTests().configureCount, 1);
}

{
  __resetPdfJsClientForTests();
  let calls = 0;
  const module = fakePdfJs();
  __setPdfJsImporterForTests(async () => {
    calls += 1;
    if (calls === 1) {
      const err = new Error("Loading chunk pages-dir-browser_node_modules_pdfjs-dist_build_pdf_mjs failed (timeout loading /_next/static/chunks/x.js)");
      err.name = "ChunkLoadError";
      throw err;
    }
    return module;
  });
  assert.equal(await getPdfJs(), module, "ChunkLoadError must retry PDF.js initialisation once");
  assert.equal(calls, 2);
}

{
  __resetPdfJsClientForTests();
  let calls = 0;
  __setPdfJsImporterForTests(async () => {
    calls += 1;
    const err = new Error("Loading chunk failed");
    err.name = "ChunkLoadError";
    throw err;
  });
  await assert.rejects(() => getPdfJs(), { message: PDFJS_INIT_ERROR_MESSAGE });
  assert.equal(calls, 2, "PDF.js initialisation must not retry forever");
  assert.equal(__getPdfJsClientStateForTests().hasPromise, false, "failed initialisation must clear cached promise");
}

{
  __resetPdfJsClientForTests();
  let calls = 0;
  const module = fakePdfJs();
  __setPdfJsImporterForTests(async () => {
    calls += 1;
    return module;
  });
  await getPdfJs();
  await getPdfJs();
  await getPdfJs();
  assert.equal(calls, 1, "delete/reupload cycles must not reinitialise the shared PDF.js library");
}

{
  assert.equal(isPdfJsChunkLoadError(new Error("timeout loading /_next/static/chunks/pages-dir-browser_node_modules_pdfjs-dist_build_pdf_mjs.js")), true);
  assert.equal(isPdfJsChunkLoadError(new Error("Invalid PDF structure")), false);
}

{
  const packageJson = JSON.parse(fs.readFileSync("node_modules/pdfjs-dist/package.json", "utf8"));
  const worker = fs.readFileSync("public/pdfjs/pdf.worker.min.mjs", "utf8");
  const publicWorkerBytes = fs.readFileSync("public/pdfjs/pdf.worker.min.mjs");
  const installedLegacyWorkerBytes = fs.readFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  assert.equal(packageJson.version, getPdfJsWorkerVersion(), "main PDF.js package version should be the loaded library version");
  assert.match(worker, new RegExp(`pdfjsVersion = ${packageJson.version.replaceAll(".", "\\.")}`), "public worker must match the installed pdfjs-dist version");
  assert.deepEqual(publicWorkerBytes, installedLegacyWorkerBytes, "public worker must be copied from the installed legacy worker build");
}

delete global.window;
__resetPdfJsClientForTests();

console.log("pdfjsClient.test.mjs passed");
