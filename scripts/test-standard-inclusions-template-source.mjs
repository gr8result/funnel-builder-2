import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
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
const defaults = read("lib/builders/standardInclusions.js");
const estimateDefaults = read("lib/construction-estimation/estimateBuilderWorkbookDefaults.js");
const masterHelper = read("lib/standard-inclusions/masterTemplate.js");
const compatibilityHelper = read("components/document-engine/templates/premierInclusionsMasterTemplate.js");
const oldFallback = read("components/document-engine/templates/standardInclusionsTemplate.js");
const approvedMaster = json("standard-inclusions/premier-inclusions-template.full.json");

assert(Array.isArray(approvedMaster.pages) && approvedMaster.pages.length === 10, "Approved master template has 10 pages");
assert(approvedMaster.metadata?.documentSource === "native-master-template", "Approved master is marked as the native master template");
assert(masterHelper.includes("premier-inclusions-template.full.json"), "Master helper loads the approved JSON template");
assert(masterHelper.includes("createPremierInclusionsWorkingCopy"), "Master helper clones working copies");
assert(defaults.includes("createPremierInclusionsWorkingCopy"), "Default Standard Inclusions state uses the approved master clone");
assert(defaults.includes("documentBuilder: createPremierInclusionsWorkingCopy"), "Fresh estimates receive a cloned documentBuilder");
assert(defaults.includes("hasDeletedMarker ? value.documentBuilder || null"), "Explicit deleted schedules are not silently resurrected");
assert(estimateDefaults.includes('selected_standard_inclusions_package_id: "std-premier-range-inclusions"'), "Blank master estimate selects the Premier package ID");
assert(workbook.includes("createPremierInclusionsWorkingCopy"), "Workbook editor fallback uses the approved master clone");
assert(!workbook.includes("createPremierInclusionsDocument"), "Workbook no longer imports the three-page fallback creator");
assert(compatibilityHelper.includes("../../../lib/standard-inclusions/masterTemplate.js"), "Legacy master helper path re-exports the lib helper");
assert(oldFallback.includes("createCoverPage()") && oldFallback.includes("createIntroPage()") && oldFallback.includes("createConstructionPage()"), "Old three-page creator is identified and isolated");

if (process.exitCode) process.exit(process.exitCode);
