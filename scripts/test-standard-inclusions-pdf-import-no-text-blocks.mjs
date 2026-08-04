import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const standardInclusions = read("lib/builders/standardInclusions.js");
const pdfImport = read("lib/standard-inclusions/pdfImport.js");
const uploadAssetRoute = read("pages/api/standard-inclusions/pdf-import/upload-asset.js");

// PDF import used to live inline in the workbook file, first as a version
// that scattered one "text" object per raw PDF text item (hundreds of
// boxes), then as a "fix" that replaced it with a single locked page raster
// and zero objects (flat image, nothing editable). Neither is acceptable —
// the real extractor now lives in lib/standard-inclusions/pdfImport.js and
// the workbook just imports it, the same way it already imports the PPTX
// importer from lib/standard-inclusions/powerpointImport.js.
assert(!workbook.includes("async function importPdfAsStandardDocumentPreview"), "PDF import logic no longer lives inline in EstimateBuilderWorkbook.js");
assert(/import\s*\{\s*importPdfAsStandardDocumentPreview\s*\}\s*from\s*"\.\.\/\.\.\/lib\/standard-inclusions\/pdfImport"/.test(workbook), "EstimateBuilderWorkbook.js imports the real PDF importer module");
assert(!workbook.includes("STANDARD_INCLUSIONS_PDF_IMPORT_MODE"), "The old always-locked-background PDF import mode flag is gone");

// The specific old bug (one object per raw text item, named "Extracted text N")
// must not reappear, but PDF import must produce real, paragraph-grouped text
// objects — not the empty-objects flat-image regression that replaced it.
assert(pdfImport.includes("getTextContent"), "PDF import extracts real text via page.getTextContent()");
assert(pdfImport.includes('createObject("text"'), "PDF import creates text objects from extracted PDF content");
assert(pdfImport.includes("groupLines") && pdfImport.includes("groupParagraphs"), "PDF text items are grouped into lines/paragraphs, not emitted one object per raw item");
assert(!pdfImport.includes("Extracted text"), "PDF import never uses the old broken 'Extracted text N' naming");
assert(!/objects:\s*\[\]\s*,?\s*$/m.test(pdfImport.split("renderPageAsFallbackImage")[0] || ""), "The primary extraction path does not hardcode an empty objects array");

// Images and shapes must be real, individually editable objects, not one
// flattened page raster.
assert(pdfImport.includes('createObject("image"'), "PDF import creates individual image objects for embedded XObjects");
assert(pdfImport.includes('createObject("shape"'), "PDF import converts simple rectangles/banners into editable shape objects");
assert(pdfImport.includes("paintImageXObject") && pdfImport.includes("paintJpegXObject"), "Image extraction reads real image XObjects from the PDF operator list, not a page-level canvas render");

// Fonts: real per-run family/weight/style detection, not a blanket Arial
// substitution.
assert(pdfImport.includes("fontStyleFor") && pdfImport.includes("mapFontFamily"), "PDF import maps each text run's own font instead of hardcoding one family");
assert(!/fontFamily:\s*"Arial"/.test(pdfImport), "PDF import does not unconditionally replace every font with Arial");

// Layer order: text, shapes, and images share one sequence counter derived
// from the PDF's own draw order, not fixed per-type stacking.
assert(pdfImport.includes("_sequence") && pdfImport.includes("object.layer = index"), "Extracted objects are re-sorted into a single unified z-order matching PDF draw order");

// Save: extracted images must never be embedded as base64 inside the
// document JSON (that was the 413 cause) — every one goes through the
// upload-asset endpoint and is referenced by URL.
assert(pdfImport.includes("upload-asset"), "PDF import uploads extracted images via the dedicated asset endpoint");
assert(!/imageRef:\s*(dataUrl|canvas\.toDataURL)/.test(pdfImport), "Extracted image objects reference an uploaded URL, never an inline data URL");
assert(uploadAssetRoute.includes("uploadStandardInclusionsAsset"), "The asset upload route stores extracted images in Supabase Storage, not inline JSON");
assert(uploadAssetRoute.includes("getPublicUrl"), "The asset upload route returns a storage URL for the document to reference");
assert(/MAX_ASSET_BYTES/.test(uploadAssetRoute), "The asset upload route enforces a per-image size limit");

// The UI must not offer an "editable conversion" choice that implies text
// extraction only sometimes happens — it always happens now.
assert(!workbook.includes("Editable conversion"), "UI no longer offers an 'Editable conversion' PDF import option");
assert(!workbook.includes("Extract text into editable blocks"), "UI copy no longer promises PDF text extraction as an optional mode");

// Legacy schedules saved before the fix must still be sanitised wherever the
// document is loaded/saved, without touching PPTX imports or user blocks.
assert(standardInclusions.includes("stripLegacyPdfExtractedTextBlocks"), "normaliseStandardInclusions strips legacy extracted PDF text blocks");
assert(standardInclusions.includes('documentSource !== "pdf-import"'), "Legacy cleanup only touches pdf-import documents, not PPTX imports");
assert(standardInclusions.includes("LEGACY_PDF_EXTRACTED_TEXT_NAME"), "Legacy cleanup matches the exact 'Extracted text N' naming signature");

if (process.exitCode) process.exit(process.exitCode);
