import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("components/estimate-builder/EstimateBuilderWorkbook.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(source.includes("function ProjectEstimateDocumentHeader("), "Project Estimate document header component is missing.");
assert(source.includes("function ProjectEstimateEditorToolbar("), "Project Estimate editor toolbar component is missing.");
assert(source.includes("function ProjectEstimateDocumentInspector("), "Project Estimate document inspector component is missing.");
assert(!source.includes('<div className="proposal-builder-tools" style={styles.proposalBuilderToolbar}>'), "Old dark Project Estimate top toolbar is still mounted.");

[
  "New Project Estimate",
  "New Blank Document",
  "Create From Template",
  "Open Project Estimate From Computer",
  "Open Platform Project Estimate",
  "Import PDF",
  "Insert Standard Inclusions Schedule",
  "Insert Plans PDF",
  "Save Copy to Computer",
  "Save as My Template",
  "Update My Template",
  "Preview PDF",
  "Download PDF",
  "Document Information",
  "Page Setup",
  "Version History",
  "Revert to Last Saved Version",
  "Add Text",
  "Add Image",
  "Move Page Up",
  "Move Page Down",
].forEach((label) => {
  assert(source.includes(label), `Project Estimate File menu is missing "${label}".`);
});

assert(source.includes("...(isPlatformAdminUser ? [{"), "Platform base-template menu actions are not gated by platform admin state.");
assert(source.includes("Save as Platform Base Template"), "Admin-only base-template save action is missing.");
assert(source.includes("Update Platform Base Template"), "Admin-only base-template update action is missing.");
assert(source.includes("projectEstimateAssetManifest"), "Project Estimate local package asset manifest helper is missing.");
assert(source.includes("pageSetup: { ...pageSetup, ...patch }"), "Document page setup updates are not wired to page state.");
assert(source.includes("copySelectedProjectEstimateBlock"), "Project Estimate keyboard copy support is missing.");
assert(source.includes("pasteProjectEstimateBlock"), "Project Estimate keyboard paste support is missing.");

console.log("Project Estimate page-builder shell checks passed.");
