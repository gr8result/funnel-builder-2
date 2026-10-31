import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const source = fs.readFileSync(sourcePath, "utf8");
const editorSource = fs.readFileSync(path.join(repoRoot, "components", "document-engine", "editor", "DocumentPageBuilder.jsx"), "utf8");
const librarySource = fs.readFileSync(path.join(repoRoot, "pages", "modules", "builders", "standard-inclusions.js"), "utf8");
const brochureBuilderSource = fs.readFileSync(path.join(repoRoot, "pages", "modules", "builders", "standard-inclusions", "[scheduleId].js"), "utf8");

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
assert(premierTemplateBody.includes("createPremierInclusionsWorkingCopy"), "Premier Template must load only from the explicit template action");
assert(!activeBody.includes("createPremierInclusionsWorkingCopy()"), "Opening Standard Inclusions must not auto-create a fallback document");
assert(activeBody.includes("fetchStandardInclusionsPdfLibrary"), "Opening Standard Inclusions should read the persistent PDF library");
assert(!activeBody.includes("isPremierInclusionsWorkingCopyCurrent"), "Opening Standard Inclusions must not force the native master working copy");
assert(!source.includes("function StandardScheduleManagementPanel"), "The duplicated Schedule Management component must be removed");
assert(!activeReturn.includes("<StandardScheduleManagementPanel"), "StandardInclusionsSheet must not render the old management toolbar");
assert(activeReturn.includes("<StandardScheduleLoadedEditor"), "StandardInclusionsSheet must render the loaded editor component");
assert(activeReturn.includes("<StandardScheduleEmptyState"), "StandardInclusionsSheet must render an empty state when no document is loaded");
assert(activeReturn.includes("activeDocument ?"), "DocumentPageBuilder must render only when a workbook document exists");
assert(loadedEditorBody.includes("Import Existing Schedule"), "Loaded editor toolbar must expose Import Existing Schedule");
assert(loadedEditorBody.includes("Import PDF"), "Loaded editor toolbar must expose Import PDF");
assert(loadedEditorBody.includes("SAVE AS STANDARD INCLUSIONS"), "Loaded editor toolbar must expose Save as Standard Inclusions");
assert(loadedEditorBody.includes("Delete Schedule"), "Loaded editor toolbar must expose Delete Schedule");
assert(loadedEditorBody.includes("<DocumentPageBuilder"), "Loaded editor component must host the native document page builder");
assert(emptyStateBody.includes("No Standard Inclusions Schedule is currently loaded."), "Empty state copy must match the required wording");
assert(emptyStateBody.includes("Upload PowerPoint"), "Empty state must expose Upload PowerPoint once");
assert(emptyStateBody.includes("Import PDF"), "Empty state must expose Import PDF once");
assert(emptyStateBody.includes("Create Blank Schedule"), "Empty state must expose Create Blank Schedule");
assert(emptyStateBody.includes("Restore Previous Version"), "Empty state must expose Restore Previous Version");
assert(emptyStateBody.includes("Use Premier Template"), "Empty state must expose deliberate Premier Template loading");
assert(!emptyStateBody.includes("Replace Schedule"), "Empty state must not expose Replace Schedule");
assert(!emptyStateBody.includes("Delete Schedule"), "Empty state must not expose Delete Schedule");
assert(!source.includes("PDF upload mode"), "PDF upload mode controls must not render on the general screen");
assert(!source.includes("Import each page as a fixed page background"), "Fixed-background PDF copy must not be the default workflow");
assert(!source.includes("pdfImportMode"), "PDF import mode must not be global screen state");
assert(contextPanelBody.includes("managementMode === \"pdf-import-options\""), "PDF choices must be shown only after a PDF is selected");
assert(contextPanelBody.includes("Editable conversion"), "PDF choices must include editable conversion");
assert(contextPanelBody.includes("High-quality fixed-page import"), "PDF choices must include fixed-page import as an explicit choice");
assert(!activeBody.includes("createPremierInclusionsDocument("), "The three-page fallback must not be used in the active Standard Inclusions workflow");

[
  "Add Blank Page",
  "Previous",
  "Next",
  "Zoom",
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

["Package", "Inclusions & brands", "Images", "Design style", "Generate"].forEach((step) => {
  assert(brochureBuilderSource.includes(`"${step}"`), `AI brochure builder must expose the ${step} step`);
});
["Budget", "Mid-range", "High-end", "Custom"].forEach((tier) => {
  assert(brochureBuilderSource.includes(tier), `AI brochure builder must expose the ${tier} package`);
});
["Luxury", "Modern", "Coastal"].forEach((style) => {
  assert(brochureBuilderSource.includes(`${style}:`), `AI brochure builder must expose the ${style} design`);
});
assert(librarySource.includes('workflowStatus: "Draft"'), "Creating a schedule must preserve a draft before AI generation");
assert(!librarySource.includes('dialog === "create" ? "Generate schedule"'), "The library must not generate before the five-step workflow");
assert(librarySource.includes("CREATE INCLUSIONS BROCHURE WITH AI"), "The Standard Inclusions homepage must lead with AI brochure creation");
assert(librarySource.includes("Import Existing PDF"), "Existing PDF import must remain available as a secondary action");
assert(!librarySource.includes("Build your schedule library"), "The homepage must not use the rejected upload-first empty state");
assert(!librarySource.includes("Upload a current inclusions PDF to preserve it"), "The homepage must not imply that an existing PDF is required");
["Edit", "Preview", "Manage"].forEach((action) => {
  assert(librarySource.includes(` /> ${action}</button>`), `Schedule cards must expose ${action}`);
});
assert(brochureBuilderSource.includes("applyBrochurePresentation"), "Brochure presentation must remain a separate transformation");
assert(brochureBuilderSource.includes("Structured inclusions, products and prices were preserved."), "Layout regeneration must explicitly preserve commercial data");
assert(brochureBuilderSource.includes("Review Required"), "Genuine catalogue gaps must appear in a compact review panel");
assert(brochureBuilderSource.includes("<DocumentPageBuilder"), "Generated brochures must open in the visual page editor");

console.log("Standard Inclusions simplified native editor regression checks passed.");
