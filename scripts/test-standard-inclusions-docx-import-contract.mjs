import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const importerPath = path.join(repoRoot, "lib", "standard-inclusions", "docxImport.js");
const reviewPath = path.join(repoRoot, "components", "document-engine", "import", "DocxImportReview.jsx");
const uploadRoutePath = path.join(repoRoot, "pages", "api", "standard-inclusions", "docx-import", "upload-asset.js");
const builderPath = path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const pageEnginePath = path.join(repoRoot, "components", "document-engine", "core", "pageEngine.js");

const importer = fs.readFileSync(importerPath, "utf8");
const review = fs.readFileSync(reviewPath, "utf8");
const uploadRoute = fs.readFileSync(uploadRoutePath, "utf8");
const builder = fs.readFileSync(builderPath, "utf8");
const pageEngine = fs.readFileSync(pageEnginePath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  "word/document.xml",
  "word/styles.xml",
  "word/numbering.xml",
  "word/_rels/document.xml.rels",
  "media/",
  "header",
  "footer",
  "pageBreak",
  "sectionBreak",
  "fixed-page",
  "wp:anchor",
  "txbxContent",
  "table",
  "image",
  "paragraph",
  "heading",
].forEach((needle) => assert(importer.includes(needle), `DOCX importer must handle ${needle}`));

assert(importer.includes("JSZip.loadAsync"), "DOCX importer must open the .docx as a ZIP package");
assert(importer.includes("DOMParser"), "DOCX importer must parse XML with DOMParser");
assert(importer.includes("upload(`data:${contentType};base64,"), "DOCX importer may use a transient data URL only for image upload");
assert(importer.includes("imageRef = await upload"), "DOCX image references must come back from asset upload");
assert(!importer.includes("data: { imageRef: `data:"), "Document JSON must not embed image data URLs");
assert(!importer.includes("fetch(\"/api/standard-inclusions/docx-import/upload-asset\""), "DOCX importer must not make an unauthenticated asset-upload fetch");
assert(importer.includes("docxPageSettings"), "DOCX page settings must be retained for future reflow");
assert(importer.includes("docProps/app.xml"), "DOCX importer must inspect Word extended properties for source page count");
assert(importer.includes("chooseDocxLayoutMode"), "DOCX importer must choose flow vs fixed-page layout mode");
assert(importer.includes("layoutDocxFixedPages"), "DOCX importer must support fixed-page designed layouts");
assert(importer.includes("wordAnchorToPageRect"), "DOCX importer must preserve Word anchor coordinates");
assert(importer.includes("twipsToDocumentUnits"), "DOCX importer must expose twip conversion helpers");
assert(importer.includes("emuToDocumentUnits"), "DOCX importer must expose EMU conversion helpers");
assert(importer.includes("validateImportedPageCount"), "DOCX importer must validate source and imported page counts");
assert(importer.includes("relayoutDocxFlowDocument"), "DOCX flow documents must support relayout after edits");

assert(uploadRoute.includes("MAX_ASSET_BYTES"), "Upload route must enforce an image size limit");
assert(uploadRoute.includes("STANDARD_INCLUSIONS_BUCKET"), "Upload route must store extracted images in the Standard Inclusions bucket");
assert(uploadRoute.includes("getPublicUrl"), "Upload route must return a durable public image URL");
assert(uploadRoute.includes("withWorkspace(handler)"), "Upload route must require workspace authentication");

assert(review.includes("Review Imported Word Schedule"), "DOCX imports must have a review screen");
assert(review.includes("Accept Import"), "Review screen must have an explicit accept action");
assert(review.includes("Return to Upload"), "Review screen must allow uploading a different DOCX");
assert(review.includes("Save Draft Base Template"), "Review screen must expose draft base-template save");
assert(review.includes("Import blocked"), "Review screen must block page-count mismatches");
assert(review.includes("sourcePageCount"), "Review screen must show source page count");
assert(review.includes("layoutMode"), "Review screen must show layout mode");

assert(builder.includes("autoActivate: false"), "DOCX base-template save must create a draft, not activate globally");
assert(builder.includes("validation?.mismatch"), "DOCX save paths must reject page-count mismatch imports");
assert(builder.includes("useApiFetch"), "DOCX image uploads must use the shared authenticated API fetch helper");
assert(builder.includes("uploadAsset: uploadDocxImportAsset"), "DOCX importer must receive an authenticated asset uploader from the UI");
assert(builder.includes("/api/standard-inclusions/docx-import/upload-asset"), "DOCX UI uploader must call the Standard Inclusions asset route");
assert(builder.includes("Your session has expired. Please sign in again"), "Expired sessions must produce a friendly DOCX upload error");
assert(builder.includes("x-workspace-id") || builder.includes("apiFetch(\"/api/standard-inclusions/docx-import/upload-asset\""), "DOCX upload must flow through workspace-aware authenticated fetch");
assert(builder.includes("Import Editable Word Document (.docx)"), "DOCX must be the primary editable import choice");
assert(builder.includes("Attach Finished PDF"), "Finished-PDF workflow must remain available");
assert(builder.includes("Use Premier Base Template"), "Premier base template must remain explicitly selectable");
assert(builder.includes("Upload PowerPoint Template"), "Existing PowerPoint route must remain available");

assert(pageEngine.includes("data: {"), "Document Engine pages must preserve page-level data for DOCX reflow");

console.log("Standard Inclusions DOCX importer contract checks passed.");
