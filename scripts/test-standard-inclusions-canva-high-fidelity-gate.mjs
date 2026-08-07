import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const nativeRoute = read("pages/api/standard-inclusions/canva/import-native.js");
const powerpointImport = read("lib/standard-inclusions/powerpointImport.js");

assert(nativeRoute.includes("CANVA_HIGH_FIDELITY_RENDER_REQUIRED"), "Low-fidelity Canva/PPTX conversion must return a hard validation failure");
assert(nativeRoute.includes("validateHighFidelityImport"), "Native Canva import must run high-fidelity visual validation");
assert(nativeRoute.includes("High-fidelity slide rendering was not available"), "The legacy PPTX conversion warning must be detected by the Canva import route");
assert(nativeRoute.includes("blankPreviewCount"), "Blank source-page previews must be counted and reported");
assert(nativeRoute.includes("thumbnailBlank"), "Per-page validation must reject blank thumbnails");
assert(nativeRoute.includes("canPublish: false"), "Failed high-fidelity imports must not be publishable");
assert(nativeRoute.includes("Your current Standard Inclusions template has not been changed"), "Failure response must explicitly preserve the active template");

assert(powerpointImport.includes("pptx-object-conversion"), "PowerPoint importer still identifies the legacy object-conversion mode");
assert(powerpointImport.includes("renderedSlideImages"), "PowerPoint importer must distinguish rendered visual bases from object conversion");

assert(workbook.includes('const [canvaImportMode, setCanvaImportMode] = useState("high-fidelity-hybrid")'), "Canva import must default to high-fidelity hybrid mode");
assert(workbook.includes("High-fidelity hybrid import"), "Import picker must show the high-fidelity hybrid option");
assert(workbook.includes("Finished PDF"), "Import picker must show the finished-PDF option");
assert(workbook.includes("Experimental full object conversion"), "Import picker must show the experimental object-conversion option");
assert(workbook.includes('payload?.code === "CANVA_HIGH_FIDELITY_RENDER_REQUIRED"'), "Client must open a failed review instead of throwing away validation details");
assert(workbook.includes("importPreview.validation && importPreview.validation.canPublish !== true"), "Confirm handler must block failed validation");
assert(workbook.includes("disabled={readonly || !importCanPublish}"), "Confirm Replacement must be disabled when validation failed");
assert(workbook.includes("Import failed visual validation."), "Review UI must label failed imports clearly");
assert(workbook.includes("Source render missing"), "Review UI must not show blank numbered placeholders for missing rendered pages");
assert(workbook.includes("Your current Standard Inclusions template has not been changed."), "Review UI must state that the active template was preserved");

console.log("Standard Inclusions Canva high-fidelity gate contract passed.");
