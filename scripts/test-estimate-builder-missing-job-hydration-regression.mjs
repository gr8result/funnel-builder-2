import assert from "node:assert/strict";
import fs from "node:fs";

// A stale "explicit active job" pointer must never strand the builder on the loading
// screen: the dashboard has to hydrate even when the pointed-at record is gone.
const source = fs.readFileSync(process.env.WORKBOOK_HOOK_PATH || "hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8").replace(/\r\n/g, "\n");
const startMarker = "      clearActiveRegisteredEstimateJob();\n";
const endMarker = "      setHydrated(true);\n    })();";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
assert.ok(start > -1 && end > start, "Could not locate the startup hydration effect body");
const body = source.slice(start, end + endMarker.length - "\n    })();".length);

function runStartup({ explicitJobKey, urlJobKey = "", loadStoredJob, fallbackRecovered = null }) {
  const calls = { persistenceStatus: [], clearedExplicitKey: 0, hydrated: 0, log: [], clearedActiveStoredJob: 0, savedExplicitKeys: [], workbook: null };
  const deps = {
    cancelled: false,
    startupLoadOperationId: 0,
    workbookLoadOperationRef: { current: 0 },
    workbookRef: { current: {} },
    lastAutosaveSignatureRef: { current: "" },
    clearActiveRegisteredEstimateJob: () => {},
    loadExplicitActiveJobSessionKey: () => urlJobKey || explicitJobKey,
    loadStoredJob,
    loadLastActiveOrRecentStoredJob: async () => fallbackRecovered,
    saveExplicitActiveJobSessionKey: (key) => calls.savedExplicitKeys.push(key),
    workbookJobKey: (workbook) => `job:${workbook.jobId}`,
    clearExplicitActiveJobSessionKey: () => { calls.clearedExplicitKey += 1; },
    clearActiveStoredJob: async () => { calls.clearedActiveStoredJob += 1; },
    setPersistenceStatus: (value) => calls.persistenceStatus.push(value),
    setHydrated: () => { calls.hydrated += 1; },
    estimateBuilderLog: (message, detail) => calls.log.push(detail),
    workbookHasExplicitJobIdentity: () => true,
    normalizeWorkbook: (value) => value,
    resolveLastActiveWorkbookPage: () => "projectDashboard",
    jobContentSignature: () => "signature",
    jobKeyFromLocation: () => urlJobKey,
    loadRecentEstimateJobs: () => [],
    loadRecentEstimateFiles: () => [],
    setWorkbook: (workbook) => { calls.workbook = workbook; }, setActiveWorkbookPage: () => {}, setLastSavedAt: () => {},
    setSavedContentSignature: () => {}, setRecentJobs: () => {}, setRecentEstimateFiles: () => {},
  };
  const names = Object.keys(deps);
  const startup = new Function(...names, `return (async () => {\n${body}\n})();`);
  return startup(...names.map((name) => deps[name])).then(() => calls);
}

// 1. The pointer outlived its record.
let calls = await runStartup({ explicitJobKey: "job:gone", loadStoredJob: async () => null });
assert.equal(calls.hydrated, 1, "A missing saved job must still hydrate the dashboard");
assert.equal(calls.clearedExplicitKey, 1, "A pointer with no record must be cleared, not left to block every reload");
assert.equal(calls.persistenceStatus.at(-1).state, "error");
assert.match(calls.persistenceStatus.at(-1).label, /saved in this browser is missing/);
assert.equal(calls.log.at(-1).destination, "builder-dashboard");
console.log("PASS a missing saved job hydrates the dashboard and clears the stale pointer.");

// 2. A transient read failure.
calls = await runStartup({ explicitJobKey: "job:locked", loadStoredJob: async () => { throw new Error("database is locked"); } });
assert.equal(calls.hydrated, 1, "A failed read must still hydrate the dashboard");
assert.equal(calls.clearedExplicitKey, 0, "A transient read failure must keep the pointer so a reload can retry");
assert.match(calls.persistenceStatus.at(-1).label, /database is locked/);
console.log("PASS a failed read hydrates the dashboard and keeps the pointer for a retry.");

// 3. The healthy path is untouched.
calls = await runStartup({
  explicitJobKey: "job:ok",
  loadStoredJob: async () => ({ type: "job", workbook: { jobId: "ok" }, savedAt: "2026-09-09T00:00:00.000Z" }),
});
assert.equal(calls.hydrated, 1);
assert.equal(calls.clearedExplicitKey, 0, "A recoverable job must keep its pointer");
assert.equal(calls.clearedActiveStoredJob, 0, "A recoverable job must not fall through to the dashboard path");
assert.equal(calls.log.at(-1).destination, "builder-workspace");
console.log("PASS a recoverable saved job still opens the workspace.");

// 4. With no URL or explicit active key, a discoverable backup is not silently substituted.
const backupWorkbook = { jobId: "retained-id", data: { savedValue: "keep" } };
calls = await runStartup({
  explicitJobKey: "",
  loadStoredJob: async () => { throw new Error("No explicit pointer should be loaded"); },
  fallbackRecovered: { type: "job", key: "job:retained-id", recoveredFromBackupKey: "job-backup:existing:timestamp", workbook: backupWorkbook },
});
assert.equal(calls.hydrated, 1);
assert.equal(calls.clearedActiveStoredJob, 1);
assert.deepEqual(calls.savedExplicitKeys, []);
assert.equal(calls.workbook, null);
assert.equal(calls.log.at(-1).destination, "builder-dashboard");
console.log("PASS without a requested or explicit job ID, the loader does not substitute a discoverable backup.");

// 5. URL identity wins over stale browser-wide storage, including after switching jobs.
const jobs = new Map([
  ["job:isolated-a", { type: "job", key: "job:isolated-a", workbook: { jobId: "isolated-a", quotation: { A: { rows: [{ id: "a-row", quantity: 2, excelRate: 50 }] } }, summary: { finalQuoteTotal: 110 } } }],
  ["job:isolated-b", { type: "job", key: "job:isolated-b", workbook: { jobId: "isolated-b", quotation: { B: { rows: [{ id: "b-row", quantity: 3, excelRate: 25 }] } }, summary: { finalQuoteTotal: 82.5 } } }],
]);
const isolatedA = await runStartup({
  explicitJobKey: "job:stale-protected-job",
  urlJobKey: "job:isolated-a",
  loadStoredJob: async (key) => jobs.get(key) || null,
});
assert.equal(isolatedA.workbook.jobId, "isolated-a");
assert.deepEqual(Object.values(isolatedA.workbook.quotation).flatMap((section) => section.rows.map((row) => row.id)), ["a-row"]);
assert.equal(isolatedA.workbook.summary.finalQuoteTotal, 110);
assert.equal(isolatedA.clearedActiveStoredJob, 0, "A requested URL job never falls through to stale global storage.");
console.log("PASS URL job ID overrides stale local/session pointers and preserves row identity and quote total.");

const isolatedB = await runStartup({
  explicitJobKey: "job:isolated-a",
  urlJobKey: "job:isolated-b",
  loadStoredJob: async (key) => jobs.get(key) || null,
});
assert.equal(isolatedB.workbook.jobId, "isolated-b", "Switching jobs follows the new URL ID, not the previous job pointer.");
assert.deepEqual(Object.values(isolatedB.workbook.quotation).flatMap((section) => section.rows.map((row) => row.id)), ["b-row"]);
assert.equal(isolatedB.workbook.summary.finalQuoteTotal, 82.5);
console.log("PASS switching between two jobs loads the newly requested job only.");

const refreshedJob = await runStartup({
  explicitJobKey: "job:stale-job",
  urlJobKey: "job:isolated-a",
  loadStoredJob: async (key) => jobs.get(key) || null,
});
assert.deepEqual(refreshedJob.workbook, isolatedA.workbook, "A hard-refresh startup reads the same saved job, rows and total.");
console.log("PASS hard-refresh startup restores the same job ID, quotation rows and total.");

const missingUrlJob = await runStartup({
  explicitJobKey: "job:isolated-a",
  urlJobKey: "job:missing",
  loadStoredJob: async (key) => jobs.get(key) || null,
  fallbackRecovered: jobs.get("job:isolated-a"),
});
assert.equal(missingUrlJob.workbook, null, "A missing requested URL job never opens the available stale/recent job.");
assert.equal(missingUrlJob.clearedActiveStoredJob, 0);
assert.equal(missingUrlJob.hydrated, 1);
assert.equal(missingUrlJob.clearedExplicitKey, 1);
assert.match(missingUrlJob.persistenceStatus.at(-1).label, /saved in this browser is missing/);
console.log("PASS a missing requested job ID fails closed without substituting another saved job.");

const noJobId = await runStartup({
  explicitJobKey: "",
  urlJobKey: "",
  loadStoredJob: async () => null,
  fallbackRecovered: jobs.get("job:isolated-a"),
});
assert.equal(noJobId.workbook, null, "No requested job ID or explicit pointer leaves the dashboard empty.");
assert.equal(noJobId.clearedActiveStoredJob, 1);
assert.equal(noJobId.hydrated, 1);
console.log("PASS a route with no job ID does not inherit browser-wide active/recent job data.");
