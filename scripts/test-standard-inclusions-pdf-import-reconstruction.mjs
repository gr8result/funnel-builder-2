import assert from "node:assert/strict";
import fs from "node:fs";
import {
  pdfPointToEditorPoint,
  pdfPointToDocumentPoint,
  editorPointToPdfPoint,
  documentPointToPdfPoint,
  pdfRectToEditorRect,
  pdfRectToDocumentRect,
  normalisePdfRotation,
  normalisePdfPageRotation,
  mapFontFamily,
  fontFallbackMap,
  classifyVectorPath,
  boxOverlapRatio,
  dedupeTextObjects,
  computePageFidelityScore,
} from "../lib/standard-inclusions/pdfImport.js";

// --- Coordinate helpers: PDF points (72/in) <-> CSS pixels (96/in) ----------
const CSS_PIXELS_PER_POINT = 96 / 72;
const point = pdfPointToEditorPoint(72, 144); // 1in, 2in
assert.equal(point.x, 72 * CSS_PIXELS_PER_POINT);
assert.equal(point.y, 144 * CSS_PIXELS_PER_POINT);
assert.deepEqual(pdfPointToDocumentPoint(72, 144), point, "document coordinate helper must share the same coordinate basis");

const roundTrip = editorPointToPdfPoint(point.x, point.y);
assert.ok(Math.abs(roundTrip.x - 72) < 1e-9, "editor->pdf must invert pdf->editor exactly");
assert.ok(Math.abs(roundTrip.y - 144) < 1e-9);
assert.deepEqual(documentPointToPdfPoint(point.x, point.y), roundTrip);

const rect = pdfRectToEditorRect({ x: 0, y: 0, width: 595.28, height: 841.89 }); // A4 in points
assert.ok(Math.abs(rect.width - 794) < 1, "a standard A4 PDF must land close to the document engine's 794px A4 default width");
assert.ok(Math.abs(rect.height - 1123) < 1, "a standard A4 PDF must land close to the document engine's 1123px A4 default height");
assert.deepEqual(pdfRectToDocumentRect({ x: 0, y: 0, width: 595.28, height: 841.89 }), rect);

assert.equal(normalisePdfRotation(-90), 270);
assert.equal(normalisePdfRotation(450), 90);
assert.equal(normalisePdfRotation(0), 0);
assert.equal(normalisePdfPageRotation(-90), 270);

// --- Font mapping: explicit substitution map first, heuristic fallback after, both reported ---
const substitutions = new Map();
assert.equal(mapFontFamily("Aptos", "", substitutions), fontFallbackMap.Aptos);
assert.equal(mapFontFamily("CanvaSans-Regular", "", substitutions), fontFallbackMap["CanvaSans-Regular"]);
assert.equal(mapFontFamily("Times New Roman", "", substitutions), "Georgia, 'Times New Roman', serif");
assert.equal(mapFontFamily("Consolas", "", substitutions), "'Courier New', Consolas, monospace");
assert.equal(mapFontFamily("SomeUnknownBrandFont", "", substitutions), "Inter, Arial, sans-serif");
assert.equal(substitutions.size, 5, "each distinct (original, substituted) pair should be tracked once");
const aptosEntry = substitutions.get("Aptos|Arial");
assert.equal(aptosEntry.method, "mapped");
assert.equal(aptosEntry.count, 1);
mapFontFamily("Aptos", "", substitutions);
assert.equal(substitutions.get("Aptos|Arial").count, 2, "repeated use of the same font should increment its substitution count for the report");
const unknownEntry = substitutions.get("SomeUnknownBrandFont|Inter, Arial, sans-serif");
assert.equal(unknownEntry.method, "heuristic");

// Subject-name prefix stripping (embedded PDF font subsetting, e.g. "ABCDEF+Calibri")
const prefixed = new Map();
mapFontFamily("ABCDEF+Georgia", "", prefixed);
assert.ok(prefixed.has("Georgia|Georgia, 'Times New Roman', serif"), "a subset-font prefix (XXXXXX+) must be stripped before matching");

// --- Vector path classification: rectangle, divider line, circle/ellipse ---
const fakeLib = { OPS: { moveTo: 1, lineTo: 2, curveTo: 3, closePath: 4, rectangle: 5 } };

// Fast-path rectangle op: subOps.length === 1
const rectPath = classifyVectorPath(fakeLib, [[fakeLib.OPS.rectangle], [10, 20, 100, 50]]);
assert.equal(rectPath.kind, "rect");
assert.deepEqual(rectPath.local, { x: 10, y: 20, width: 100, height: 50 });

// A negative-height/width rectangle (drawn from the far corner) must still normalise to a positive box.
const invertedRectPath = classifyVectorPath(fakeLib, [[fakeLib.OPS.rectangle], [110, 70, -100, -50]]);
assert.deepEqual(invertedRectPath.local, { x: 10, y: 20, width: 100, height: 50 });

// moveTo + 3 lineTo forming an axis-aligned rectangle (the "constructed" path case, not the fast rectangle op)
const polygonRect = classifyVectorPath(fakeLib, [
  [fakeLib.OPS.moveTo, fakeLib.OPS.lineTo, fakeLib.OPS.lineTo, fakeLib.OPS.lineTo],
  [0, 0, 200, 0, 200, 40, 0, 40],
]);
assert.equal(polygonRect.kind, "rect");
assert.deepEqual(polygonRect.local, { x: 0, y: 0, width: 200, height: 40 });

// A single moveTo + lineTo (2 points, never closed) is a divider line, not a filled shape.
const dividerLine = classifyVectorPath(fakeLib, [[fakeLib.OPS.moveTo, fakeLib.OPS.lineTo], [0, 100, 300, 100]]);
assert.equal(dividerLine.kind, "line");
assert.equal(dividerLine.local.width, 300);
assert.equal(dividerLine.local.height, 0);
const verticalDividerLine = classifyVectorPath(fakeLib, [[fakeLib.OPS.moveTo, fakeLib.OPS.lineTo], [20, 0, 20, 300]]);
assert.equal(verticalDividerLine.kind, "line");
assert.equal(verticalDividerLine.local.width, 0);
assert.equal(verticalDividerLine.local.height, 300);

// A curve-dominated closed path (the classic 4-bezier circle) should be recognised as a circle/ellipse.
const circlePath = classifyVectorPath(fakeLib, [
  [fakeLib.OPS.moveTo, fakeLib.OPS.curveTo, fakeLib.OPS.curveTo, fakeLib.OPS.curveTo, fakeLib.OPS.curveTo, fakeLib.OPS.closePath],
  [
    50, 0, // moveTo (top)
    80, 0, 100, 20, 100, 50, // curveTo -> right
    100, 80, 80, 100, 50, 100, // curveTo -> bottom
    20, 100, 0, 80, 0, 50, // curveTo -> left
    0, 20, 20, 0, 50, 0, // curveTo -> back to top
  ],
]);
assert.equal(circlePath.kind, "circle");
assert.ok(circlePath.local.width > 0 && circlePath.local.height > 0);

// An arbitrary non-axis-aligned triangle should be left unrecognised (not force-fit into a rectangle).
const triangle = classifyVectorPath(fakeLib, [
  [fakeLib.OPS.moveTo, fakeLib.OPS.lineTo, fakeLib.OPS.lineTo, fakeLib.OPS.closePath],
  [0, 0, 100, 0, 50, 80],
]);
assert.equal(triangle, null, "a non-axis-aligned polygon must not be misclassified as a rectangle");

// --- Box overlap / text dedupe -----------------------------------------------------
assert.equal(boxOverlapRatio({ x: 0, y: 0, width: 100, height: 20 }, { x: 0, y: 0, width: 100, height: 20 }), 1);
assert.equal(boxOverlapRatio({ x: 0, y: 0, width: 100, height: 20 }, { x: 500, y: 500, width: 10, height: 10 }), 0);

const duplicateBox = { x: 10, y: 10, width: 200, height: 20 };
const nearDuplicateBox = { x: 11, y: 10, width: 200, height: 20 };
const objects = [
  { type: "text", ...duplicateBox, data: { text: "Kitchen Inclusions" } },
  { type: "text", ...nearDuplicateBox, data: { text: "Kitchen Inclusions" } }, // same text, heavily overlapping -> duplicate
  { type: "text", x: 10, y: 200, width: 150, height: 20, data: { text: "Bathroom Inclusions" } }, // different text, not a duplicate
  { type: "image", x: 0, y: 0, width: 50, height: 50, data: {} },
];
const deduped = dedupeTextObjects(objects);
assert.equal(deduped.length, 3, "the near-identical duplicate run of the same text must be dropped, everything else kept");
assert.equal(deduped.filter((o) => o.type === "text").length, 2);

// --- Visual fidelity scoring: operates on plain ImageData-shaped objects -----------
function solidImage(width, height, rgb) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

const identicalScore = computePageFidelityScore(solidImage(40, 40, [200, 200, 200]), solidImage(40, 40, [200, 200, 200]));
assert.equal(identicalScore.score, 100, "two identical solid-colour images must score a perfect 100");
assert.equal(identicalScore.diffGrid.length, identicalScore.gridSize * identicalScore.gridSize);

const oppositeScore = computePageFidelityScore(solidImage(40, 40, [0, 0, 0]), solidImage(40, 40, [255, 255, 255]));
assert.equal(oppositeScore.score, 0, "pure black vs pure white must score 0 fidelity");

const closeScore = computePageFidelityScore(solidImage(40, 40, [200, 200, 200]), solidImage(40, 40, [210, 210, 210]));
assert.ok(closeScore.score > 90 && closeScore.score < 100, "a small colour difference should score high but not perfect");

// --- Structural assertions for the review/versioning wiring that can't run without a browser+DB ---
const workbookSource = fs.readFileSync(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
assert.match(workbookSource, /setPdfImportReview\(preview\)/, "importing a PDF must route into review state, not save immediately");
assert.match(workbookSource, /<PdfImportReview/, "the review screen must actually be rendered");
assert.match(workbookSource, /async function confirmPdfImportReview/, "saving must be a separate, explicit confirm step after review");
assert.match(workbookSource, /saveReviewedPdfAsBaseTemplate/, "the review screen must offer promoting the import to the shared base template");
assert.doesNotMatch(
  workbookSource.slice(workbookSource.indexOf("async function importPendingPdfNow"), workbookSource.indexOf("function cancelPdfImportReview")),
  /saveStandardWithRevision/,
  "importPendingPdfNow itself must no longer save/replace the live schedule directly"
);

const migrationSql = fs.readFileSync(new URL("../supabase/migrations/20260727_standard_inclusions_base_templates.sql", import.meta.url), "utf8");
assert.match(migrationSql, /check \(status in \('draft', 'active', 'archived'\)\)/, "the base template must support draft/active/archived status");
assert.match(migrationSql, /standard_inclusions_base_templates_single_active_uidx/, "at most one base template version may be active at a time");

const baseTemplateApi = fs.readFileSync(new URL("../pages/api/standard-inclusions/base-template.js", import.meta.url), "utf8");
assert.match(baseTemplateApi, /status: "archived"/, "activating a new version must archive the previously active one, never delete it");
assert.doesNotMatch(baseTemplateApi, /const\s+ADMIN_ROLES/, "system base-template management must not be granted to ordinary workspace admins");
assert.match(baseTemplateApi, /canManageSystemTemplates/, "system base-template writes must use an explicit platform-template permission check");
assert.match(baseTemplateApi, /PLATFORM_ADMIN_EMAILS/, "the current platform-admin model must be used for the system-template permission");

const reviewSource = fs.readFileSync(new URL("../components/document-engine/import/PdfImportReview.jsx", import.meta.url), "utf8");
assert.match(reviewSource, /Use Hybrid Import/, "failed pages must offer a hybrid import fallback");
assert.match(reviewSource, /unresolvedFailedPages/, "Accept all must block pages that require fallback selection");
assert.match(reviewSource, /could not be reconstructed accurately enough/, "the hard rejection message must be shown for failed pages");

const objectRendererSource = fs.readFileSync(new URL("../components/document-engine/renderer/objectRenderer.jsx", import.meta.url), "utf8");
assert.match(objectRendererSource, /pdf-text-activation/, "hybrid editable text overlays must stay hidden until edited to avoid duplicate visible text");
assert.match(objectRendererSource, /orientation === "vertical"/, "vertical dividers must render vertically");

const builderSource = fs.readFileSync(new URL("../components/document-engine/editor/DocumentPageBuilder.jsx", import.meta.url), "utf8");
assert.match(builderSource, /offsetWidth/, "PDF export must derive page size from the rendered document page width");
assert.match(builderSource, /96 \/ 72/, "PDF export must convert document CSS pixels back to PDF points");

const uploadAssetApi = fs.readFileSync(new URL("../pages/api/standard-inclusions/pdf-import/upload-asset.js", import.meta.url), "utf8");
assert.match(uploadAssetApi, /MAX_ASSET_BYTES/, "extracted image uploads must enforce a size limit rather than accepting an unbounded payload");
assert.doesNotMatch(uploadAssetApi, /base64.{0,80}document_json|document_json.{0,80}base64/is, "extracted images must be stored as assets, never inlined as base64 into the document JSON");

const pdfImportSource = fs.readFileSync(new URL("../lib/standard-inclusions/pdfImport.js", import.meta.url), "utf8");
assert.match(pdfImportSource, /opName === "clip"/, "clipping paths must be cleared instead of becoming visible filled rectangles");
assert.match(pdfImportSource, /paintInlineImageXObject/, "inline image operators must be inspected");
assert.match(pdfImportSource, /paintImageMaskXObject/, "image mask operators must be counted for fallback validation");
assert.match(pdfImportSource, /hybridPdfPageToDocumentObjects/, "the importer must expose an explicit hybrid page fallback");
assert.match(pdfImportSource, /overlayMode: "pdf-text-activation"/, "hybrid mode must avoid duplicate visible text over the page render");

console.log("Standard Inclusions PDF import reconstruction tests passed.");
