import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const source = fs.readFileSync(sourcePath, "utf8");
const editorSource = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "editor", "DocumentPageBuilder.jsx"), "utf8");
const docxImportSource = fs.readFileSync(path.join(repoRoot, "lib", "standard-inclusions", "docxImport.js"), "utf8");
const defaultSource = fs.readFileSync(path.join(repoRoot, "lib", "construction-estimation", "estimateBuilderWorkbookDefaults.js"), "utf8");
const standardBuilderSource = fs.readFileSync(path.join(repoRoot, "lib", "builders", "standardInclusions.js"), "utf8");
const masterTemplateSource = fs.readFileSync(path.join(repoRoot, "lib", "standard-inclusions", "masterTemplate.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getFunctionBody(name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} must exist`);
  const signatureEnd = source.indexOf(")", start);
  const open = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Could not read body for ${name}`);
}

const sheetBody = getFunctionBody("StandardInclusionsSheet");
const loadedEditorBody = getFunctionBody("StandardScheduleLoadedEditor");
const contextPanelBody = getFunctionBody("StandardScheduleContextPanel");
const emptyStateBody = getFunctionBody("StandardScheduleEmptyState");
const premierTemplateBody = getFunctionBody("usePremierTemplate");

const firstReturn = sheetBody.indexOf("return (");
const firstDormantLegacyDeclaration = sheetBody.indexOf("const pdfUploadRef", firstReturn);
const activeBody = sheetBody.slice(0, firstDormantLegacyDeclaration > -1 ? firstDormantLegacyDeclaration : sheetBody.length);
const activeReturn = sheetBody.slice(firstReturn);

assert(source.includes("createPremierInclusionsWorkingCopy"), "Standard Inclusions must keep the Premier Template available for deliberate use");
assert(premierTemplateBody.includes("resolveBaseStandardInclusionsTemplate"), "Premier Template action must resolve the active versioned base template");
assert(standardBuilderSource.includes("options.documentBuilder"), "Standard Inclusions defaults must accept an injected active base document");
assert(defaultSource.includes("standardInclusionsBaseDocument"), "Workbook defaults must support injecting the active Standard Inclusions base document");
assert(defaultSource.includes("createEstimateBuilderWorkbookDefaultsWithBaseTemplate"), "Bootstrap code must have an async active-base default factory");
assert(masterTemplateSource.includes("loadActiveBaseTemplateServer"), "The base-template resolver must support server-side bootstrap paths");
assert(masterTemplateSource.includes("standard_inclusions_base_templates"), "The server-side resolver must read the versioned shared base-template table");
assert(!activeBody.includes("isPremierInclusionsWorkingCopyCurrent"), "Opening Standard Inclusions must not autosave or auto-create a fallback document");
assert(!activeBody.includes("isPremierInclusionsWorkingCopyCurrent"), "Opening Standard Inclusions must not force the native master working copy");
assert(!source.includes("function StandardScheduleManagementPanel"), "The duplicated Schedule Management component must be removed");
assert(!activeReturn.includes("<StandardScheduleManagementPanel"), "StandardInclusionsSheet must not render the old management toolbar");
assert(activeReturn.includes("<StandardScheduleLoadedEditor"), "StandardInclusionsSheet must render the loaded editor component");
assert(activeReturn.includes("<StandardScheduleEmptyState"), "StandardInclusionsSheet must render an empty state when no document is loaded");
assert(activeReturn.includes("activeDocument ?"), "DocumentPageBuilder must render only when a workbook document exists");
assert(source.includes("importPdfAsStandardDocumentPreview"), "StandardInclusionsSheet must use the PDF importer");
assert(activeBody.includes("importPendingPdfAsHybrid"), "PDF imports must go through the hybrid review screen before save");
assert(loadedEditorBody.includes("More Options"), "Loaded editor toolbar must expose schedule management options");
assert(loadedEditorBody.includes("Delete Schedule"), "Loaded editor toolbar must expose Delete Schedule");
assert(loadedEditorBody.includes("<DocumentPageBuilder"), "Loaded editor component must host the native document page builder");
assert(emptyStateBody.includes("Create Standard Inclusions"), "Empty state must frame Standard Inclusions as a reusable builder-level template");
assert(emptyStateBody.includes("Import Existing Schedule"), "Empty state must show the import-existing-schedule workflow");
assert(emptyStateBody.includes("Import PDF"), "Empty state must offer PDF import directly");
assert(emptyStateBody.includes("Connect / Import from Canva"), "Empty state must preserve Canva as an optional import source");
assert(emptyStateBody.includes("Restore Latest Version"), "Empty state must expose Restore Latest Version");
assert(emptyStateBody.includes("Load Default Standard Inclusions Template"), "Empty state must expose deliberate default template loading");
assert(!emptyStateBody.includes("Delete Schedule"), "Empty state must not expose Delete Schedule");
assert(!source.includes("PDF upload mode"), "PDF upload mode controls must not render on the general screen");
assert(!source.includes("Import each page as a fixed page background"), "Fixed-background PDF copy must not be the default workflow");
assert(!source.includes("pdfImportMode"), "PDF import mode must not be global screen state");
assert(contextPanelBody.includes("managementMode === \"replace-options\""), "Replace Schedule must open the explicit replacement choice dialog");
assert(contextPanelBody.includes("Import PDF"), "Replace dialog must offer the hybrid PDF import path");
assert(contextPanelBody.includes("Load Default Standard Inclusions Template"), "Replace dialog must offer the active default base template");
assert(contextPanelBody.includes("Import PDF as Editable Schedule"), "PDF choices must include the hybrid editable import action");
assert(contextPanelBody.includes("managementMode === \"pdf-import-options\""), "PDF choices must be shown only after a PDF is selected");
assert(contextPanelBody.includes("Attach Finished PDF Now"), "PDF choices must include the finished-PDF attachment action");
assert(contextPanelBody.includes("Original Page Layer"), "Import review must describe the original PDF page layer");
assert(contextPanelBody.includes("Editable Overlay Layer"), "Import review must describe editable overlays");
assert(contextPanelBody.includes("Save as Standard Inclusions"), "Import review must save explicitly as Standard Inclusions");
assert(!activeBody.includes("createPremierInclusionsDocument("), "The three-page fallback must not be used in the active Standard Inclusions workflow");
assert(docxImportSource.includes("JSZip.loadAsync"), "DOCX importer must parse the ZIP package directly");
assert(docxImportSource.includes("word/document.xml"), "DOCX importer must read the main Open XML document part");
assert(docxImportSource.includes("word/styles.xml"), "DOCX importer must read styles.xml");
assert(docxImportSource.includes("word/numbering.xml"), "DOCX importer must read numbering.xml");
assert(docxImportSource.includes("word/_rels/document.xml.rels"), "DOCX importer must read document relationships");
assert(docxImportSource.includes("media/"), "DOCX importer must extract media from the DOCX package");
assert(docxImportSource.includes("DOMParser"), "DOCX importer must use a structured XML parser");
assert(fs.existsSync(path.join(repoRoot, "pages", "api", "standard-inclusions", "docx-import", "upload-asset.js")), "DOCX images must keep the authenticated asset route available");
assert(docxImportSource.includes("relayoutDocxFlowDocument"), "DOCX flow documents must support reflow after edits");

[
  "Add Page",
  "Duplicate Page",
  "Delete Page",
  "Move Up",
  "Move Down",
  "Save",
  "Preview",
  "Export PDF",
  "Replace Image",
].forEach((text) => assert(editorSource.includes(text), `Missing native editor control text: ${text}`));
["text", "image", "logo", "shape", "table", "icon"].forEach((type) => {
  assert(editorSource.includes(`"${type}"`), `Native editor must expose add control type: ${type}`);
});

console.log("Standard Inclusions simplified native editor regression checks passed.");
