import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPdfHybridPageModel,
  createPdfImportReviewSummary,
} from "../lib/standard-inclusions/pdfPageImportModel.js";

const repoRoot = process.cwd();
const workbookSource = fs.readFileSync(path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js"), "utf8");
const editorSource = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "editor", "DocumentPageBuilder.jsx"), "utf8");
const sourceTemplatePath = path.join(repoRoot, "standard-inclusions", "premier-inclusions-template.full.json");
const sourceTemplate = JSON.parse(fs.readFileSync(sourceTemplatePath, "utf8"));

assert.equal(sourceTemplate.pages.length, 10, "Grant's real Premier Inclusions template must remain a 10-page source.");

const page = {
  id: "standard-inclusions-pdf-premier-inclusions-page-01",
  width: 794,
  height: 1123,
  background: { imageRef: "data:image/jpeg;base64,page-artwork" },
  data: {
    originalPageAsset: "data:image/jpeg;base64,page-artwork",
    acceptedMasks: [{ id: "heading-mask", regionId: "heading", bounds: { x: 40, y: 52, width: 300, height: 44 } }],
  },
  objects: [
    {
      id: "heading",
      type: "text",
      x: 40,
      y: 52,
      width: 300,
      height: 44,
      rotation: 0,
      layer: 2,
      style: { fontFamily: "Arial", fontSize: 28, fontWeight: "800", color: "#111827" },
      data: { text: "PREMIER INCLUSIONS", acceptedEdit: true, maskOriginal: true, confidence: 0.86, editableSource: "pdf" },
    },
    {
      id: "photo",
      type: "image",
      x: 84,
      y: 260,
      width: 420,
      height: 240,
      layer: 3,
      style: { objectFit: "contain" },
      data: { imageRef: "data:image/png;base64,replacement", acceptedEdit: true, maskOriginal: true, confidence: 0.71, editableSource: "pdf" },
    },
    {
      id: "unaccepted-source-text",
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 18,
      data: { detectedRegion: true, acceptedEdit: false, text: "Hidden activation only" },
    },
  ],
};

const model = createPdfHybridPageModel(page, 0);
assert.deepEqual(Object.keys(model), ["id", "width", "height", "order", "baseArtwork", "blocks", "masks"], "Hybrid page model must expose the required shape.");
assert.equal(model.width, 794, "Page width must persist.");
assert.equal(model.height, 1123, "Page height must persist.");
assert.equal(model.order, 0, "Page order must persist.");
assert.equal(model.baseArtwork, page.data.originalPageAsset, "Rendered page artwork must persist separately from editable blocks.");
assert.equal(model.blocks.length, 2, "Only accepted/editable overlay blocks should become persisted editable blocks.");
assert.equal(model.blocks[0].content, "PREMIER INCLUSIONS", "Edited text content must persist.");
assert.equal(model.blocks[1].content, "data:image/png;base64,replacement", "Image replacement must persist.");
assert.equal(model.masks.length, 1, "Local mask metadata must persist.");
assert(!model.blocks.some((block) => block.content === "Hidden activation only"), "Unaccepted source text must not duplicate original/editable text.");

const summary = createPdfImportReviewSummary({ pageCount: 10, editableTextCount: 121, editableImageCount: 8, preservedElementCount: 10, needsReviewCount: 8 });
assert.equal(summary.status, "IMPORT COMPLETE");
assert.equal(summary.pageCount, 10);
assert.equal(summary.editableImageCount, 8);

assert(workbookSource.includes("createPdfHybridPageModel(page, index)"), "PDF import must persist hybrid page models.");
assert(workbookSource.includes("editableImageCount"), "PDF import must report editable image block count.");
assert(workbookSource.includes("Review Imported Pages"), "Import review must expose the requested review action.");
assert(editorSource.includes("hybridPageModel"), "Editor save/reload must sync the hybrid page model.");
assert(editorSource.includes("acceptedMasks") && editorSource.includes("masks: acceptedMasks"), "Editor must persist local masks.");

console.log("Standard Inclusions hybrid PDF model persistence checks passed.");
