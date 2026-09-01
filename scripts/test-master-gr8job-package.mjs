import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const jobFileSource = readFileSync("lib/jobFile.ts", "utf8");
const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const projectStoreSource = readFileSync("lib/projectStore.ts", "utf8");

[
  "import JSZip from \"jszip\"",
  "MASTER_JOB_FORMAT_NAME",
  "serializeJobPackage",
  "readMasterZipPackage",
  "backupVersions",
  "BACKUP_VERSION_LIMIT = 5",
  "gr8-master-job-package",
  "gr8job.package.v1",
  "buildMasterJobManifest",
  "buildMasterJobSections",
  "\"job-details\"",
  "\"client-selections\"",
  "\"project-documents\"",
  "compatibilityMirror: \"workbook\"",
  "moduleSectionsAreIndependent: true",
].forEach((snippet) => {
  assert.ok(jobFileSource.includes(snippet), `.gr8job serializer must include ${snippet}`);
});

[
  "job-details",
  "estimate",
  "takeoff",
  "client-selections",
  "quotation",
  "boq",
  "procurement",
  "variations",
  "project-documents",
  "assets",
].forEach((sectionName) => {
  assert.ok(jobFileSource.includes(`"${sectionName}"`), `Master package must include the ${sectionName} section`);
  assert.ok(workbookSource.includes(sectionName), `Workbook save audit must mention ${sectionName}`);
});

assert.ok(jobFileSource.includes("path: `${name}.json`"), "Manifest must expose section JSON paths");
assert.ok(jobFileSource.includes("zip.file(\"manifest.json\""), "Master .gr8job must be written as a ZIP container with manifest.json");
assert.ok(jobFileSource.includes("zip.file(`${name}.json`"), "Master .gr8job must write independent section JSON files");
assert.ok(jobFileSource.includes("extractWorkbookFromJobPackage"), "Opening a master .gr8job must restore its workbook mirror");
assert.ok(jobFileSource.includes("input.estimate?.workbook"), "Opening a package can restore from estimate/workbook section");
assert.ok(jobFileSource.includes("record.manifest"), "Package-shaped files must be accepted as workbook-like payloads");
assert.ok(projectStoreSource.includes("updateMasterJobSection"), "Project store must expose safe section replacement");
assert.ok(projectStoreSource.includes("...masterJob"), "Project store must preserve the existing master job when updating one section");
assert.ok(projectStoreSource.includes("saveMasterJob"), "Project store must expose a single master save path");

console.log("Master .gr8job package contract tests passed.");
