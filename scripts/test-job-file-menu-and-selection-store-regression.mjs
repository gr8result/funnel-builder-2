import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const jobFileHookSource = readFileSync("hooks/useJobFile.ts", "utf8");
const workbookHookSource = readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const selectionsSource = readFileSync("pages/modules/builders/selections-book.js", "utf8");

for (const label of [
  "New Job",
  "Open Platform Job",
  "Open Job File From Computer",
  "Open Template",
  "Save Job",
  "Save Job As",
  "Download Backup Copy",
  "RECENT JOBS",
]) {
  assert.ok(workbookSource.includes(label), `Shared File menu must include ${label}.`);
}

for (const forbidden of [
  "Open Saved Estimate",
  "Save Master Job File As",
  "Save Job File to Computer",
  "RECENT PLATFORM JOBS",
  "RECENT LOCAL JOB FILES",
]) {
  assert.ok(!workbookSource.includes(forbidden), `Shared File menu must not include ${forbidden}.`);
}

assert.ok(workbookSource.includes("mergeRecentJobRows(recentJobs, recentLocalJobFiles).slice(0, 3)"), "Recent Jobs must merge and cap at three.");
assert.ok(workbookSource.includes("isVisibleRecentJobRow"), "Recent Jobs must filter non-job records before display.");
assert.ok(workbookSource.includes("Open or create a job before making Client Selections."), "Client Selections must show a no-job guard.");
assert.ok(workbookSource.includes("!moduleContext?.projectId"), "Client Selections guard must key off canonical project identity.");
assert.ok(workbookSource.includes("includedJobFileSections(localJobFilePrompt.parsed)"), "Local file confirmation must show included sections.");
assert.ok(workbookSource.includes("jobFile.openParsedJob(prompt.parsed"), "Confirmed local opens must update the shared job-file state.");
assert.ok(!workbookSource.includes("projectId: \"\",\n        commercialProjectId: \"\",\n        registeredJobId: \"\""), "Local job open must not blank the canonical project id.");

assert.ok(jobFileHookSource.includes("filter(isGenuineRecentJob).slice(0, 3)"), "Local recent jobs must be filtered and capped.");
assert.ok(jobFileHookSource.includes("fallbackToSaveAs: true"), "Save Job must invoke Save As/download when no writable computer-file handle exists.");
assert.ok(jobFileHookSource.includes("Job saved in the platform. Use Download Backup Copy to update the computer file."), "No-handle save must give the required message.");
assert.ok(jobFileHookSource.includes("downloadBackupCopy"), "Download Backup Copy must use the job-file package exporter.");
assert.ok(jobFileHookSource.includes("hasActiveJob"), "Job-file hook must track whether a real job is active.");
assert.ok(jobFileHookSource.includes("storageLocation"), "Job-file hook must expose where the master job is stored.");
assert.ok(jobFileHookSource.includes("const close = useCallback"), "Job-file hook must clear active file state on Close Job.");
assert.ok(jobFileHookSource.includes("if (!hasActiveJob)"), "No active job must never report stale dirty state.");

assert.ok(workbookHookSource.includes("async function updateClientSelectionsBook"), "Workbook hook must expose active-project Client Selections persistence.");
assert.ok(workbookHookSource.includes("Client Selections save verification failed."), "Client Selections save must verify read-back identity/revision.");
assert.ok(workbookHookSource.includes("commercialProjectId: parsedIdentity.projectId"), "Local file load must keep canonical project identity.");
assert.ok(workbookHookSource.includes("filter(isGenuineRecentEstimateJob).slice(0, 3)"), "Platform recent jobs must be filtered and capped.");

assert.ok(selectionsSource.includes("onClientSelectionsSave = null"), "Embedded selections page must accept the active workbook save callback.");
assert.ok(selectionsSource.includes("embeddedSaveResult = await onClientSelectionsSave"), "Save Progress must save to the active master workbook.");
assert.ok(selectionsSource.includes("embeddedSaveResult?.ok === false"), "Failed active workbook save must not show Saved.");
assert.ok(selectionsSource.includes("async function saveGuidedCabinetryAndReturnToInterior"), "Finish Cabinetry must use the active-job save route.");
assert.ok(selectionsSource.includes("setGuidedScreen(\"interior\")"), "Finish Cabinetry must return directly to Interior categories.");
assert.ok(selectionsSource.includes("projectId={selectedProjectId}"), "Guided selections workflow must receive the canonical active project id.");
assert.ok(selectionsSource.includes("projectId={projectId}"), "Guided Cabinetry must receive project id from workflow props, not a parent-scope variable.");
assert.ok(selectionsSource.includes("onFinishCabinetry={saveGuidedCabinetryAndReturnToInterior}"), "Guided selections workflow must receive the explicit Cabinetry finish handler.");
assert.ok(selectionsSource.includes("onFinishCabinetry={onFinishCabinetry}"), "Guided Cabinetry must receive the finish handler from workflow props.");
assert.ok(!selectionsSource.includes("onFinishCabinetry={saveGuidedCabinetryAndReturnToInterior}\n          onSaveProgress"), "GuidedSelectionsWorkflow must not reference the parent finish handler directly inside the Cabinetry render.");
assert.ok(selectionsSource.includes("commitRequirement: !confirmRoom"), "Finish Cabinetry must not route through the generic product auto-advance.");
assert.ok(selectionsSource.includes("prior = cabinetryPlainObject(prior) ? prior : {}"), "Kick-panel finish records must tolerate null prior state.");
assert.ok(!selectionsSource.includes("const globalLatestPayload = JSON.parse(window.localStorage.getItem(globalLatestEmbeddedBookStorageKey())"), "Embedded selections must not hydrate from a global latest job draft.");
assert.ok(!selectionsSource.includes("function globalLatestEmbeddedBookStorageKey"), "Embedded selections must not keep a global latest job draft key.");
assert.ok(!selectionsSource.includes("selected_details?.cabinetrySelection || latestCabinetryDraftFromStorage()"), "Cabinetry completion must not read orphan draft storage.");

console.log("Job file menu and Client Selections store regression contracts passed.");
