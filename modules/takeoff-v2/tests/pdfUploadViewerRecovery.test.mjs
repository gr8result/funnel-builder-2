import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const documentList = read("modules/takeoff-v2/components/PlanDocumentList.jsx");
const planStore = read("modules/takeoff-v2/persistence/planStore.js");
const pdfViewport = read("modules/takeoff-v2/viewer/PdfViewport.js");
const planViewer = read("modules/takeoff-v2/components/PlanViewer.jsx");
const usePdfDocument = read("modules/takeoff-v2/viewer/usePdfDocument.js");
const takeoffPage = read("modules/takeoff-v2/components/TakeoffV2Page.jsx");

assert.doesNotMatch(documentList, /readAsDataURL|FileReader|toDataURL/, "PDF upload must not convert full files or canvases into persisted data URLs.");
assert.match(documentList, /savePdfFile\(documentId, file\)/, "Upload must save PDF bytes into the file store.");
assert.match(documentList, /loadPdfDocument\(file\)/, "Upload metadata extraction must read the File directly, not a persisted raster/source URL.");

assert.match(planStore, /DOCUMENT_FIELDS_NOT_STORED_LOCALLY/, "planStore must strip large document fields before localStorage writes.");
assert.match(planStore, /originalFileUrl/, "planStore must explicitly reject legacy PDF data URLs.");
assert.match(planStore, /rasterImage/, "planStore must explicitly reject raster/debug image persistence.");
assert.match(planStore, /fileStorageKey/, "localStorage document metadata must keep only a file-store key.");

assert.match(usePdfDocument, /getPdfFileBlob/, "Viewer must load PDF bytes from the file store.");
assert.match(usePdfDocument, /URL\.createObjectURL/, "Viewer must create an object URL for the PDF Blob.");
assert.match(usePdfDocument, /URL\.revokeObjectURL/, "Viewer must revoke object URLs when cached documents are forgotten.");

assert.match(pdfViewport, /source instanceof Blob/, "PDF.js loader must accept Blob sources.");
assert.match(pdfViewport, /fetch\(source\)/, "PDF.js loader must accept object URL sources.");
assert.match(pdfViewport, /displayScale = scale/, "PDF renderer must separate display scale from render scale.");
assert.match(pdfViewport, /renderViewport/, "PDF renderer must expose the high-resolution render viewport.");

assert.match(planViewer, /scale: fitScaleRef\.current \* zoomScale/, "Zoom must request a higher-resolution PDF render.");
assert.match(planViewer, /displayScale: fitScaleRef\.current/, "Zoom must keep viewer coordinates tied to the fit-page display scale.");
assert.doesNotMatch(takeoffPage, /state-diagnostics|DOCUMENT COUNT|SOURCE URL PRESENT/, "Developer diagnostics must not render above the production viewer.");

console.log("pdfUploadViewerRecovery.test.mjs passed");
