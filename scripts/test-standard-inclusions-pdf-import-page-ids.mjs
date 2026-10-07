import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPdfDetectedTextRegion,
  createPdfImportBatchId,
  createStableImportedPdfPageId,
} from "../lib/standard-inclusions/pdfPageImportModel.js";

const repoRoot = process.cwd();
const workbookSource = fs.readFileSync(path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js"), "utf8");
const importFunction = workbookSource.slice(
  workbookSource.indexOf("async function importPdfAsStandardDocumentPreview"),
  workbookSource.indexOf("async function importPptxAsStandardDocumentPreview")
);

const importId = createPdfImportBatchId("Premier Inclusions.pdf", 123456789);
const pageIds = Array.from({ length: 10 }, (_, index) => createStableImportedPdfPageId(importId, index + 1));
assert.equal(new Set(pageIds).size, 10, "10-page PDF must create 10 unique page IDs.");
assert.equal(pageIds[0], "standard-inclusions-pdf-premier-inclusions-123456789-page-01");
assert.equal(pageIds[9], "standard-inclusions-pdf-premier-inclusions-123456789-page-10");

const region = createPdfDetectedTextRegion({
  pageId: pageIds[0],
  index: 0,
  text: "Premier Inclusions Range",
  boundingBox: { x: 10, y: 20, width: 300, height: 40 },
});
assert.equal(region.pageId, pageIds[0], "Detected region must receive the exact page ID.");
assert.equal(region.id, `${pageIds[0]}-text-region-001`);

const saved = JSON.parse(JSON.stringify({
  document: {
    id: importId,
    pages: pageIds.map((pageId, index) => ({
      id: pageId,
      data: {
        originalPageAsset: `page-${index + 1}.jpg`,
        detectedRegions: [createPdfDetectedTextRegion({ pageId, index: 0, text: `Page ${index + 1}` })],
        acceptedEdits: [],
        acceptedMasks: [],
      },
      objects: [{
        id: `${pageId}-object-1`,
        data: {
          overlayMode: "pdf-text-activation",
          detectedRegion: true,
          acceptedEdit: false,
          edited: false,
        },
      }],
    })),
  },
}));
assert.equal(saved.document.pages.length, 10, "Saved/reloaded import state must keep all pages.");
saved.document.pages.forEach((page) => {
  assert.equal(page.data.detectedRegions[0].pageId, page.id, "Reloaded detected region pageId must match its page.");
  assert.equal(page.objects[0].data.acceptedEdit, false, "Detected regions must remain invisible/unaccepted by default.");
});

assert(importFunction.includes("const importId = createPdfImportBatchId(file.name)"), "Import function must create one batch/document ID.");
assert(importFunction.includes("const pageId = createStableImportedPdfPageId(importId, pageNumber)"), "Import function must create pageId inside the page loop.");
assert(importFunction.includes("id: pageId"), "Page model must use the same pageId.");
assert(importFunction.includes("detectedRegions.push(region)"), "Detected regions must be pushed after receiving the pageId.");
assert(!/detectedRegions\.push\(\{\s*id:\s*regionId,\s*pageId,/s.test(importFunction), "Import function must not use an undeclared pageId in an inline region literal.");
assert(!/const pageId = .*Date\.now\(\).*pageNumber/.test(workbookSource.slice(
  workbookSource.indexOf("async function renderPdfDataUrlToPageImages"),
  workbookSource.indexOf("async function importPdfAsStandardDocumentPreview")
)), "Non-import PDF rendering helper must not contain stray pageId declarations.");

console.log("Standard Inclusions PDF import page IDs are stable and consistent.");
