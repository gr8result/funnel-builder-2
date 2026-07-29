import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const builder = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const onlyoffice = read("lib/standard-inclusions/onlyoffice.js");
const upload = read("pages/api/standard-inclusions/onlyoffice/upload-pptx.js");
const callback = read("pages/api/standard-inclusions/onlyoffice/callback.js");
const exportPdf = read("pages/api/standard-inclusions/onlyoffice/export-pdf.js");
const fileRoute = read("pages/api/standard-inclusions/onlyoffice/file.js");
const editor = read("components/standard-inclusions/OnlyOfficePresentationEditor.jsx");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(builder.includes("STANDARD_INCLUSIONS_EDITOR_MODES"), "Workbook must use explicit Standard Inclusions editor modes");
assert(builder.includes("ONLYOFFICE_DOCX"), "DOCX uploads must select ONLYOFFICE DOCX mode");
assert(builder.includes("ONLYOFFICE_PPTX"), "PPTX uploads must select ONLYOFFICE PPTX mode");
assert(builder.includes("FINISHED_PDF"), "Finished PDF imports must select attachment mode");
assert(builder.includes("Import Editable Word Document (.docx)"), "Replace dialog must offer editable Word import");
assert(builder.includes("Import Editable PowerPoint (.pptx)"), "Replace dialog must offer editable PowerPoint import");
assert(builder.includes("Attach Finished PDF"), "Finished-PDF workflow must remain available");
assert(builder.includes("Use Premier Base Template"), "Premier base template must remain explicitly selectable");
assert(!builder.includes("importDocxAsStandardDocumentPreview"), "Normal DOCX upload must not call the custom DOCX reconstruction importer");
assert(!builder.includes("<DocxImportReview"), "Normal DOCX upload must not show the fragmented DOCX review screen");
assert(!builder.includes("/api/standard-inclusions/docx-import/upload-asset"), "Native DOCX upload must not extract embedded assets");

assert(onlyoffice.includes('ONLYOFFICE_DOCX: "onlyoffice-docx"'), "Shared ONLYOFFICE helper must define onlyoffice-docx mode");
assert(onlyoffice.includes('DOCUMENT_ENGINE: "document-engine"'), "Shared mode set must retain document-engine compatibility");
assert(onlyoffice.includes('FINISHED_PDF: "finished-pdf"'), "Shared mode set must retain finished PDF compatibility");
assert(onlyoffice.includes('documentType: onlyOfficeDocumentType(fileType)'), "Editor config must choose Word vs Presentation document type");
assert(onlyoffice.includes('fileType,'), "Editor config must pass the native Office file type");
assert(onlyoffice.includes("onlyOfficeDocumentKey(document)"), "Document key must remain versioned");
assert(onlyoffice.includes("templateScope"), "ONLYOFFICE records must track template ownership scope");

assert(upload.includes('".docx"'), "Signed upload route must accept DOCX");
assert(upload.includes("word/document.xml"), "Upload validation must verify DOCX package contents");
assert(upload.includes("editorModeForOnlyOfficeFileType"), "Upload completion must record the correct editor mode");
assert(upload.includes("createSignedUploadUrl"), "DOCX upload must use signed storage upload rather than API body upload");

assert(callback.includes("verifyOnlyOfficeJwt(token)"), "Callback must authenticate ONLYOFFICE save tokens");
assert(callback.includes("officeAssetId"), "Callback revision history must store native Office asset IDs");
assert(callback.includes("previousOfficeAssetId"), "Callback revision history must keep rollback pointers");
assert(callback.includes("current_exported_pdf_asset_id: null"), "Saving a new Office version must invalidate old exported PDFs");

assert(exportPdf.includes("standardInclusionsDocumentFileType"), "PDF conversion must use the current native Office file type");
assert(exportPdf.includes('outputtype: "pdf"'), "PDF export must request ONLYOFFICE PDF conversion");
assert(fileRoute.includes("onlyOfficeContentType(fileType)"), "File route must stream DOCX with the correct content type");

assert(editor.includes("ONLYOFFICE Word Editor"), "Editor shell must label native DOCX editing");
assert(editor.includes("Back to Standard Inclusions"), "Editor shell must provide Back to Standard Inclusions");
assert(editor.includes("Save As Copy"), "Editor shell must expose Save As Copy");
assert(editor.includes("Export PDF"), "Editor shell must expose PDF export");
assert(editor.includes("Version History"), "Editor shell must expose version history entry point");
assert(editor.includes("Close Editor"), "Editor shell must expose Close Editor");

console.log("Standard Inclusions native DOCX ONLYOFFICE contract checks passed.");
