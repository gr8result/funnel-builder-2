import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workbookPath = path.join(root, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const apiClientPath = path.join(root, "components", "estimate-builder", "project-estimate", "persistence", "ProjectEstimateApiClient.ts");

const workbook = fs.readFileSync(workbookPath, "utf8");
const apiClient = fs.readFileSync(apiClientPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(workbook.includes("preserve-original"), "PDF importer must support Preserve Original mode.");
assert(workbook.includes("convert-to-editable"), "PDF importer must support Convert to Editable mode.");
assert(workbook.includes("rebuild-editable-template"), "PDF importer must support Rebuild as Editable Template mode.");
assert(workbook.includes("selectProjectEstimatePdfImportMode"), "Project Estimate import must select an explicit import mode.");
assert(!workbook.includes("Needs review image region"), "PDF importer must not create visible review-placeholder image blocks.");
assert(!/editableImageCount\s*\+=\s*1\s*;/.test(workbook), "Preserved raster regions must not be counted as editable images.");
assert(workbook.includes("preservedReason: \"raster-or-vector-artwork-not-separable\""), "Uneditable raster/vector regions must stay in the import report metadata.");
assert(workbook.includes("backgroundColor: \"transparent\""), "Extracted text must not create white masking boxes over imported PDFs.");
assert(workbook.includes("maskOriginal: false"), "Extracted text must not mask the preserved original PDF layer.");
assert(workbook.includes("ImportedPdfPageImage document={page.importedDocument}"), "Editable imported pages must render uploaded PDF references after embedded artwork is stripped.");
assert(workbook.includes("projectEstimateImportedPageTitle"), "Imported PDF pages must receive content-based titles instead of generic Project Estimate labels.");

assert(apiClient.includes("stripEmbeddedAssetPayloads"), "Project Estimate API client must strip embedded asset payloads.");
assert(apiClient.includes("isEmbeddedAssetString"), "Project Estimate API client must detect data/base64 strings.");
assert(apiClient.includes("baseArtwork: isProjectEstimatePdfPage ? \"\""), "Project Estimate PDF page saves must not persist canvas-rendered baseArtwork.");
assert(/blocks:\s*Array\.isArray\(builderPage\.blocks\)\s*\?\s*builderPage\.blocks\.map\(\(block\)\s*=>\s*stripEmbeddedAssetPayloads\(block\)\)/s.test(apiClient), "Builder page saves must sanitize block payloads.");

console.log("Project Estimate PDF importer regression checks passed.");
