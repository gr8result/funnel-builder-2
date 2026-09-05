import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const hookSource = readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const jobFileSource = readFileSync("lib/jobFile.ts", "utf8");

assert.ok(workbookSource.includes("import { readJob } from \"../../lib/jobFile\""), "Local file input must use the ZIP-aware .gr8job reader.");
assert.ok(workbookSource.includes("const parsed = await readJob(file);"), "Selecting a local file must parse it before any workbook state change.");
assert.ok(workbookSource.includes("if (!prompt.dirty)"), "Local file import must open immediately when there is no active dirty job.");
assert.ok(workbookSource.includes("mode: \"confirm-open\""), "Local file import must require confirmation before replacing an active dirty workbook.");
assert.ok(workbookSource.includes("Save Current Job"), "Dirty current jobs must offer a save-before-open option.");
assert.ok(workbookSource.includes("Discard Changes"), "Dirty current jobs must offer a discard-and-open option.");
assert.ok(workbookSource.includes("dirty: jobFile.hasActiveJob && jobFile.dirty"), "No active job must not produce a stale unsaved-current-job warning.");
assert.ok(workbookSource.includes("Warning: the selected filename does not match the job identity inside the file."), "Filename/internal identity mismatches must be visible.");
assert.ok(!workbookSource.includes("localJobFileResolvedToPlatformRef"), "Local files must not be rerouted into platform-project opens.");
assert.ok(!workbookSource.includes("resolvePlatformProjectForOpenedJob"), "The local-file open pipeline must not auto-resolve a platform project.");
assert.ok(!workbookSource.includes("function openJobFile(event, sheet)"), "The legacy immediate text-load helper must stay removed.");

assert.ok(hookSource.includes("workbookLoadOperationRef"), "Workbook loads must be guarded by an operation id.");
assert.ok(hookSource.includes("autosavePausedRef.current = true"), "Autosave must pause while a local job file is being validated and loaded.");
assert.ok(hookSource.includes("async function loadJobFileData"), "Parsed local job data must be loaded through a non-text path.");
assert.ok(hookSource.includes("local job file selected"), "Local file open diagnostics must log selected file metadata.");
assert.ok(hookSource.includes("local job file opened"), "Local file open diagnostics must log final active workbook identity.");
assert.ok(hookSource.includes("currentProjectIdBeforeImport"), "Diagnostics must include the project id before import.");
assert.ok(hookSource.includes("storageKey: workbookJobKey(draft)"), "Diagnostics must include the canonical storage key written.");

assert.ok(jobFileSource.includes("buffer.byteLength === 0"), "Empty .gr8job files must be rejected before parsing.");
assert.ok(jobFileSource.includes("Selected job file is empty."), "Empty local file errors must be explicit.");

const localJohnsonFile = "C:/Users/grant/Downloads/Johnson 123.gr8job";
if (existsSync(localJohnsonFile)) {
  const stat = statSync(localJohnsonFile);
  console.log(`Johnson 123.gr8job diagnostic fixture size: ${stat.size} bytes`);
}

console.log("Local .gr8job open integrity tests passed.");
