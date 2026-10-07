import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const shellSource = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const standaloneSource = fs.readFileSync("pages/modules/builders/client-selections.js", "utf8");

const startupEffect = hookSource.slice(
  hookSource.indexOf("purgeCorruptEstimateJobLocalStorage();"),
  hookSource.indexOf("}, []);", hookSource.indexOf("purgeCorruptEstimateJobLocalStorage();")),
);

assert.ok(startupEffect.includes('source: "no-active-job"'), "startup records no-active-job instead of restoring a stale job");
assert.ok(startupEffect.includes("clearActiveRegisteredEstimateJob();"), "startup clears stale registered-job pointers");
assert.ok(startupEffect.includes("clearActiveStoredJob().catch"), "startup clears the IndexedDB active-job pointer");
assert.equal(startupEffect.includes("loadLastActiveOrRecentStoredJob()"), false, "startup does not load active/recent IndexedDB jobs");
assert.equal(startupEffect.includes("loadActiveRegisteredEstimateJob()"), false, "startup does not activate a localStorage registered-job pointer");

assert.ok(hookSource.includes("function workbookHasExplicitJobIdentity"), "job saves require explicit job identity");
assert.ok(hookSource.includes("Create or open a job before saving."), "saving a blank/no-job workbook is rejected");
assert.ok(hookSource.includes('status: "not_scoped"'), "unscoped platform project keys are rejected");
assert.ok(hookSource.includes("async function closeCurrentJob()"), "close job clears active in-memory state");
assert.ok(hookSource.includes("delete(ACTIVE_JOB_KEY)"), "close/startup clears only the active pointer");

assert.ok(shellSource.includes("<h2 style={styles.noJobGuardTitle}>No job open</h2>"), "Client Selections no-job screen is explicit");
assert.ok(shellSource.includes("Create New Job"), "no-job screen exposes Create New Job");
assert.ok(shellSource.includes("Open Job File From Computer"), "no-job screen exposes Open Job File From Computer");
assert.ok(shellSource.includes("No previous job data is active."), "no-job screen says previous data is inactive");
assert.ok(shellSource.includes("await sheet.closeCurrentJob?.();"), "invalid local file import clears the active job");
assert.ok(shellSource.includes("openJobDetails.noJobOpen ? \"\""), "commercial modules receive no project id when no job is open");
assert.equal(shellSource.includes("Johnson 123"), false, "Johnson 123 is not hard-coded in the shared workbook shell");
assert.equal(hookSource.includes("Johnson 123"), false, "Johnson 123 is not hard-coded in the shared workbook hook");

assert.equal(standaloneSource.includes("rows[0]?.id"), false, "standalone Client Selections no longer auto-selects first project");

console.log("Client Selections no-auto-job-open regression tests passed.");
