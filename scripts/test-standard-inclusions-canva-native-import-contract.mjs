import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const nativeRoute = read("pages/api/standard-inclusions/canva/import-native.js");
const powerpointImport = read("lib/standard-inclusions/powerpointImport.js");
const standardInclusions = read("lib/builders/standardInclusions.js");

assert(nativeRoute.includes('FORMAT_PREFERENCE = ["pptx", "powerpoint", "presentation"]'), "Native Canva import must prefer structured PPTX exports");
assert(nativeRoute.includes("/export-formats"), "Native Canva import must audit Canva export formats before choosing a source");
assert(nativeRoute.includes("selectedFormat"), "Native Canva import must report the selected source format");
assert(nativeRoute.includes("PDF can be used only as a visual reference"), "Native Canva import must not treat PDF as the editable model");
assert(nativeRoute.includes("importPptxAsStandardDocumentPreview"), "Native Canva import must convert PPTX into the existing native Standard Inclusions document model");
assert(nativeRoute.includes("expectedSlideCount"), "Native Canva import must enforce the expected Canva page count");
assert(nativeRoute.includes("text: 0") && nativeRoute.includes("image: 0") && nativeRoute.includes("shape: 0"), "Native Canva import must count editable text, image and shape objects");
assert(nativeRoute.includes("format: { type: formatType }"), "Native Canva import must export the selected structured format");
assert(!nativeRoute.includes("pages: [1]") && !nativeRoute.includes("pages:["), "Native Canva import must not request only page 1");

assert(powerpointImport.includes("pptxSlideToEditableOverlayObjects"), "PPTX importer must expose editable text/image activation overlays");
assert(powerpointImport.includes("pptxTextRuns"), "PPTX importer must preserve text run metadata");
assert(powerpointImport.includes("pptxImageCrop"), "PPTX importer must preserve image crop data");
assert(powerpointImport.includes("pptxShapeToDocumentObjects"), "PPTX importer must convert shapes and panels");

assert(workbook.includes("/api/standard-inclusions/canva/import-native"), "Selecting a Canva design must call the native import endpoint");
assert(workbook.includes("System Base Standard Inclusions Template"), "Converted Canva imports must become the system base template");
assert(workbook.includes("documentBuilder: document"), "Converted Canva imports must save native documentBuilder pages");
assert(workbook.includes('setManagementMode("import-preview")'), "Converted Canva imports must go through import review before publishing");
assert(workbook.includes('reviewMode: "canva-native-import"'), "Canva native imports must carry review metadata");
assert(workbook.includes("Original Canva/PDF reference | Native Gr8 Result conversion"), "Canva import review must compare the original reference with native conversion");
assert(workbook.includes("publish-canva-native-system-base"), "Confirming Canva import must publish the system base template as a revision");
assert(workbook.includes("readOnly: true"), "Published system base template must be read-only at master level");
assert(workbook.includes("editorMode: STANDARD_INCLUSIONS_EDITOR_MODES.DOCUMENT_ENGINE"), "Converted Canva imports must switch back to native Gr8 Result editing");
assert(workbook.includes("Canva is only an administrator source for one-time master-template imports."), "UI must explain Canva is not the builder editor");
assert(workbook.includes("Admin Template Import from Canva"), "Canva area must be renamed to admin template import");
assert(workbook.includes("Convert to native base template"), "Design picker must convert Canva templates into native pages");
assert(!workbook.includes("Use Canva as the native editor"), "UI must not claim Canva is the native editor");

const canvaActionsStart = workbook.indexOf("function CanvaScheduleActions");
const canvaActionsEnd = workbook.indexOf("function dashboardProjectContextParams");
const canvaActions = workbook.slice(canvaActionsStart, canvaActionsEnd);
assert(!canvaActions.includes("Open in Canva"), "Standard action cluster must not send builders to Canva for editing");
assert(!canvaActions.includes("Export latest PDF"), "Standard action cluster must not make Canva PDF export the editing workflow");

assert(standardInclusions.includes("masterTemplate"), "Standard Inclusions state must support saved master templates");

console.log("Standard Inclusions Canva native import contract passed.");
