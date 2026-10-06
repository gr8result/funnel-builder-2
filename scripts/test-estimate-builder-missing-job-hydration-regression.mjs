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

function runStartup({ explicitJobKey, loadStoredJob, fallbackRecovered = null }) {
  const calls = { persistenceStatus: [], clearedExplicitKey: 0, hydrated: 0, log: [], clearedActiveStoredJob: 0, savedExplicitKeys: [], workbook: null };
  const deps = {
    cancelled: false,
    startupLoadOperationId: 0,
    workbookLoadOperationRef: { current: 0 },
    workbookRef: { current: {} },
    lastAutosaveSignatureRef: { current: "" },
    clearActiveRegisteredEstimateJob: () => {},
    loadExplicitActiveJobSessionKey: () => explicitJobKey,
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
assert.match(calls.persistenceStatus.at(-1).label, /could not be found/);
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

// 4. A legacy job backup remains openable when both active pointers are missing.
const backupWorkbook = { jobId: "retained-id", data: { savedValue: "keep" } };
calls = await runStartup({
  explicitJobKey: "",
  loadStoredJob: async () => { throw new Error("No explicit pointer should be loaded"); },
  fallbackRecovered: { type: "job", key: "job:retained-id", recoveredFromBackupKey: "job-backup:existing:timestamp", workbook: backupWorkbook },
});
assert.equal(calls.hydrated, 1);
assert.equal(calls.clearedActiveStoredJob, 0);
assert.deepEqual(calls.savedExplicitKeys, ["job:retained-id"]);
assert.deepEqual(calls.workbook, backupWorkbook);
assert.equal(calls.log.at(-1).destination, "builder-workspace");
console.log("PASS a discoverable legacy backup hydrates with its existing identity and saved fields.");
