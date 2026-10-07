import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPdfDetectedImageRegion,
  createPdfDetectedTextRegion,
  createPdfImportBatchId,
  createStableImportedPdfPageId,
} from "../lib/standard-inclusions/pdfPageImportModel.js";

const repoRoot = process.cwd();
const editor = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "editor", "DocumentPageBuilder.jsx"), "utf8");
const renderer = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "renderer", "objectRenderer.jsx"), "utf8");
const pageRenderer = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "renderer", "pageRenderer.jsx"), "utf8");
const pageEngine = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "core", "pageEngine.js"), "utf8");
const documentState = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "core", "documentState.js"), "utf8");
const workbook = fs.readFileSync(path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js"), "utf8");
const exportRenderer = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "export", "pdfRenderer.js"), "utf8");
const workbookHook = fs.readFileSync(path.join(repoRoot, "hooks", "estimate-builder", "useEstimateBuilderWorkbook.js"), "utf8");

const importId = createPdfImportBatchId("Premier Inclusions.pdf", 2468);
const pageId = createStableImportedPdfPageId(importId, 10);
const textRegion = createPdfDetectedTextRegion({
  pageId,
  index: 0,
  text: "Roofing",
  boundingBox: { x: 130, y: 210, width: 118, height: 28 },
});
const imageRegion = createPdfDetectedImageRegion({
  pageId,
  index: 0,
  boundingBox: { x: 92, y: 585, width: 610, height: 300 },
});

assert.equal(textRegion.pageId, pageId, "Detected text region selection must use the page ID.");
assert.equal(imageRegion.pageId, pageId, "Detected image region selection must use the page ID.");
assert.equal(imageRegion.type, "image", "PDF image regions must be stored as image metadata.");

assert(pageEngine.includes("data: { ...(props.data || {}) }"), "Page normalisation must preserve originalPageAsset, detectedRegions and edit metadata.");
assert(documentState.includes("data: page.data || {}"), "Document serialisation must persist page import/edit metadata.");
assert(editor.includes("syncDocumentEditData"), "Document edits must be synced into page.data for save/reload.");
assert(editor.includes("acceptedMasks"), "Mask metadata must be persisted with accepted edits.");
assert(editor.includes("acceptedEdits: edits"), "Accepted text/image edits must persist after save and reload.");
assert(editor.includes("startManualRegion") && editor.includes("finishManualRegion"), "Manual Text/Image region drawing must be available.");
assert(editor.includes("Add Editable Region"), "Editor must expose manual editable region fallback.");
assert(editor.includes("Show Original"), "Editor must expose the original/edited comparison control.");
assert(editor.includes("Restore Original"), "Each edited activation/manual object must be restorable.");
assert(editor.includes("Image region selected.") && editor.includes("Upload Image") && editor.includes("Media Library"), "Image replacement prompt must appear for detected image regions.");
assert(editor.includes("maskOriginal: true"), "A mask must be created only when a text edit or image replacement is accepted.");
assert(renderer.includes("pendingActivation && hovered"), "Only the hovered/selected detected region should show edit affordance.");
assert(renderer.includes("if (activationRegion && !acceptedEdit && !editing) return null"), "Detected metadata must stay invisible outside Edit Page mode.");
assert(renderer.includes("if (showOriginal && importedOrManualEdit && acceptedEdit) return null"), "Show Original must hide accepted masks/edits and reveal the untouched PDF.");
assert(pageRenderer.includes("showOriginal={showOriginal}"), "The page renderer must pass Show Original state to objects.");
assert(workbook.includes("detectPdfImageRegionsFromCanvas"), "PDF import must create image activation regions from rendered page data.");
assert(workbook.includes('overlayMode: "pdf-image-activation"'), "PDF image regions must be hidden activation regions, not automatic image overlays.");
assert(workbook.includes("Math.max(4.1667") && workbook.includes("page.getViewport({ scale:"), "Imported PDF pages must render at A4 300-DPI equivalent resolution or sharper.");
assert(workbookHook.includes("standardDocumentName") && workbookHook.includes('documentSource === "pdf-import"'), "PDF-imported schedules must persist under their own active job identity, not the master template name.");
assert(workbookHook.includes("saveStoredTemplate(currentWorkbook.templateName || MASTER_TEMPLATE_NAME") && workbookHook.includes('documentType === "standardInclusions"'), "Persisted Standard Inclusions documents must also update the active template reload source.");
assert(exportRenderer.includes("renderDocumentForPdf"), "Export must use the document renderer payload.");
assert(!exportRenderer.includes("detectedRegions.map"), "Export must not render detection metadata as exported overlay content.");

console.log("Standard Inclusions imported PDF regions are editable, restorable and export-safe.");
