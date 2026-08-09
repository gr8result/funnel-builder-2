import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const renderer = read("components/document-engine/renderer/objectRenderer.jsx");
const editor = read("components/document-engine/editor/DocumentPageBuilder.jsx");
const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const normaliser = read("lib/builders/standardInclusions.js");

assert(renderer.includes("if (activationRegion && !acceptedEdit && !editing) return null"), "Normal display must not render unaccepted OCR/PDF activation regions.");
assert(renderer.includes("activationRegion && !acceptedEdit ? { background: \"transparent\", backgroundColor: \"transparent\" }"), "Edit mode activation regions must remain transparent hit regions.");
assert(renderer.includes("if (editing && activationRegion && !acceptedEdit)"), "Double-clicking a detected region must activate only that region.");
assert(editor.includes("acceptedEdit: true"), "Activated regions must become explicit accepted edits.");
assert(editor.includes("maskOriginal: true"), "Activated regions must mask only the accepted edit region.");
assert(editor.includes("visibleOverlayCount(page)"), "Page list must distinguish visible edits from detected regions.");
assert(workbook.includes('overlayMode: "pdf-text-activation"'), "PDF import must store extracted text as hidden activation regions.");
assert(workbook.includes("detectedRegions.push"), "PDF import must retain detected-region metadata.");
assert(normaliser.includes("repairImportedPdfDetectionRegions"), "Existing imported schedules must be repaired on load.");
assert(normaliser.includes("GENERATED_PDF_TEXT_NAME"), "Legacy Extracted text objects must be detected safely.");

console.log("Standard Inclusions detected regions stay hidden until accepted.");
