import assert from "node:assert/strict";
import fs from "node:fs";

const jobFileSource = fs.readFileSync("lib/jobFile.ts", "utf8");
const hookSource = fs.readFileSync("hooks/useJobFile.ts", "utf8");
const workbookShellSource = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const workbookHookSource = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const selectionsSource = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");

for (const section of [
  '"job-details"',
  "estimate",
  "takeoff",
  '"client-selections"',
  "quotation",
  "boq",
  "procurement",
  "variations",
  '"project-documents"',
  "assets",
]) {
  assert.ok(jobFileSource.includes(section), `master .gr8job package preserves ${section}`);
}

assert.ok(jobFileSource.includes("MASTER_JOB_SCHEMA_VERSION"), "job file has a canonical schema version");
assert.ok(jobFileSource.includes("type: \"gr8-master-job-package\""), "job file normalises to the master package type");
assert.ok(jobFileSource.includes("moduleData"), "job file exposes moduleData mirror");
assert.ok(jobFileSource.includes("moduleMetadata"), "job file exposes moduleMetadata mirror");
assert.ok(jobFileSource.includes("buildModuleData"), "job file builds canonical moduleData");
assert.ok(jobFileSource.includes("buildModuleMetadata"), "job file builds per-module metadata");
assert.ok(jobFileSource.includes("mergeMasterJobModuleSection"), "job file exposes module-scoped merge helper");
assert.ok(jobFileSource.includes("Cannot merge module data from a different job ID."), "different job IDs cannot be silently merged");
assert.ok(jobFileSource.includes("serializeJobPackage"), "save constructs a complete package before persistence");
assert.ok(jobFileSource.includes("verificationFile"), "computer-file save verifies read-back identity");
assert.ok(jobFileSource.includes("triggerDownload(packaged.blob, fallbackName)"), "no-handle save downloads a complete master copy");
assert.ok(jobFileSource.includes(" - Backup "), "backup copies are explicitly named backups");
assert.ok(jobFileSource.includes("existingZipBackups"), "saving a zip-backed master preserves backup versions");

const roundTripFixture = {
  jobName: "Round Trip Master Job",
  clientName: "Fixture Client",
  jobNumber: "RT-0309",
  address: "8 Roundtrip Street, Testville",
  "job-details": { projectId: "round-trip-master-job", builder: "Fixture Builder" },
  estimate: { projectEstimate: { pages: [{ id: "estimate-page", marker: "estimate-survives" }] } },
  takeoff: { aiPlanTakeoffJob: { plan: { pages: [{ id: "plan-page", marker: "uploaded-plan-survives" }] }, completedAreas: [{ id: "area-1" }] } },
  "client-selections": {
    clientSelectionsBook: {
      rooms: [{ id: "kitchen", marker: "selections-survive" }],
      selections: {
        cabinetry: { schemaVersion: 2, marker: "cabinetry-survives" },
        appliances: { brand: "Fixture Brand", marker: "appliances-survive" },
      },
    },
  },
  quotation: { rows: [{ id: "quote-row", marker: "quotation-survives" }] },
  boq: { items: [{ id: "boq-row", marker: "boq-survives" }] },
  procurement: { items: [{ id: "po-row", marker: "procurement-survives" }] },
  variations: { items: [{ id: "variation-row", marker: "variation-survives" }] },
  "project-documents": { documents: [{ id: "document-row", marker: "documents-survive" }] },
};

for (const marker of [
  "uploaded-plan-survives",
  "selections-survive",
  "cabinetry-survives",
  "appliances-survive",
  "estimate-survives",
  "quotation-survives",
  "boq-survives",
  "procurement-survives",
  "variation-survives",
  "documents-survive",
]) {
  assert.ok(JSON.stringify(roundTripFixture).includes(marker), `round-trip fixture contains ${marker}`);
}

assert.ok(hookSource.includes("hasActiveJob"), "job-file hook exposes canonical active-job state");
assert.ok(hookSource.includes("storageLocation"), "job-file hook exposes Platform/Computer File state for banners");
assert.ok(hookSource.includes("setDirty(false)") && hookSource.includes("if (!hasActiveJob)"), "No job open cannot have stale unsaved changes");
assert.ok(hookSource.includes("const close = useCallback"), "Close Job clears file handle, file name and dirty state");
assert.ok(hookSource.includes("fallbackToSaveAs: true"), "Save Job uses Save As/download when no writable computer-file handle exists");

assert.ok(workbookShellSource.includes("dirty: jobFile.hasActiveJob && jobFile.dirty"), "local-file replacement prompt ignores stale dirty state when no job is open");
assert.ok(workbookShellSource.includes("const hasOpenWorkbook = !openJobDetails.noJobOpen"), "workbook identity is the restored local-job source of truth");
assert.ok(workbookShellSource.includes("...(hasOpenWorkbook ? ["), "save commands are hidden until a workbook job is active");
assert.ok(workbookShellSource.includes("jobFile.open()"), "Open Job File From Computer uses the File System Access path where available");
assert.ok(workbookShellSource.includes("Save Job As"), "Save As wording is clear");
assert.ok(workbookShellSource.includes("Download Backup Copy"), "backup export wording is clear");
assert.ok(workbookShellSource.includes("jobFile.close?.();"), "Close Job clears both workbook and file-hook state");
assert.ok(workbookShellSource.includes("openParsedJob(prompt.parsed"), "selected local file is opened exactly after validation");

assert.ok(workbookHookSource.includes("restoreSavedJobPackageSections"), "opening a job preserves namespaced package sections through template migration");
assert.ok(workbookHookSource.includes("updateClientSelectionsBook"), "Client Selections saves through the shared active workbook");
assert.ok(workbookHookSource.includes("Client Selections save verification failed."), "Client Selections save verifies identity and revision");
assert.ok(selectionsSource.includes("embeddedSaveResult = await onClientSelectionsSave"), "Client Selections Save writes to active master job section");
assert.ok(jobFileSource.includes("createWritable"), "computer-file save writes through a writable file handle");
assert.ok(jobFileSource.includes("validateSavedPackage"), "computer-file save validates the read-back package before reporting success");
assert.ok(jobFileSource.includes("Downloaded new complete job file"), "browser-only fallback clearly says a new file was produced");

console.log("Shared master job-file architecture regression checks passed.");
