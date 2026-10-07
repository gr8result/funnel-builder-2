import assert from "node:assert/strict";
import fs from "node:fs";
import { masterJobId } from '../lib/construction-estimation/masterJob.js';

const source = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const body = source.slice(source.indexOf("async function loadStoredJobUnlocked("), source.indexOf("async function listWorkspaceProjectJobs("));
const jobId = "existing-legacy-job";
const jobKey = `job:${jobId}`;
const backup = (key, savedAt, id = jobId) => ({
  type: "job-backup", key: `job-backup:${key}:${savedAt}`, savedAt, name: "Existing job",
  workbook: { jobId: id, registeredJob: { jobId: id }, data: { inputDataSheet: { rows: { retained: { value: key } } } }, aiPlanTakeoffJob: { completedWallRuns: [{ id: "saved-wall" }] } },
});
const records = new Map([
  ["first", backup("newer-name-but-older-backup", "2026-09-10T00:00:00Z")],
  ["latest", backup("older-name-but-newer-backup", "2026-09-16T00:00:00Z")],
  ["unrelated", backup("same-display-name", "2026-09-17T00:00:00Z", "different-job")],
  ["protected", backup("protected-original", "2026-09-17T00:00:00Z", "03-09/123")],
].map(([, record]) => [record.key, record]));
const original = JSON.stringify([...records]);
let backupScans = 0;
let payloadReads = 0;
let pendingPayloadReads = 0;
let maxPendingPayloadReads = 0;
const request = (result, onComplete = () => {}) => {
  const pending = {};
  queueMicrotask(() => { pending.result = result; onComplete(); pending.onsuccess?.(); });
  return pending;
};
const cursorRequest = (range, keysOnly, direction) => {
  if (range) backupScans += 1;
  const keys = [...records.keys()].sort().filter((key) => !range || key >= range.lower && key <= range.upper);
  if (direction === "prev") keys.reverse();
  let index = 0;
  const pending = {};
  const advance = () => queueMicrotask(() => {
    const key = keys[index++];
    pending.result = key === undefined ? null : { key, ...(keysOnly ? {} : { value: records.get(key) }), continue: advance };
    pending.onsuccess?.();
  });
  advance();
  return pending;
};
const db = {
  close() {},
  transaction(name, mode) {
    assert.equal(mode, "readonly", "Recovery discovery must never mutate browser records");
    return { objectStore: () => ({
      get: (key) => {
        if (records.has(key)) payloadReads += 1;
        pendingPayloadReads += 1;
        maxPendingPayloadReads = Math.max(maxPendingPayloadReads, pendingPayloadReads);
        return request(records.get(key), () => { pendingPayloadReads -= 1; });
      },
      openCursor: (range) => cursorRequest(range, false),
      openKeyCursor: (range, direction) => cursorRequest(range, true, direction),
    }) };
  },
};
const dependencies = {
  masterJobId,
  openTemplateDb: async () => db, JOB_STORE_NAME: "jobs",
  IDBKeyRange: { bound: (lower, upper) => ({ lower, upper }) },
  materializeTakeoffPlanPages: async (workbook) => structuredClone(workbook),
  isSnapshotJobKey: (key) => String(key).includes(":snapshot:"),
  isBlockedEstimateBuilderJobKey: () => false,
  isProtectedRecoveryRecord: ({ key }) => key === "job:03-09/123",
  isCorruptEstimateJobRecord: (record) => record.corrupt === true,
  isActiveJobPointer: (record) => record.type === "active-job-pointer",
  isBlockedEstimateBuilderActiveJob: () => false,
  workbookRecentMetadata: (workbook, savedAt) => ({ projectName: "Existing job", projectId: workbook.jobId, savedAt, kind: "job" }),
  workbookJobName: () => "Existing job",
};
const api = new Function(...Object.keys(dependencies), `${body}; return {loadStoredJobUnlocked, listStoredJobs};`)(...Object.values(dependencies));
const restored = await api.loadStoredJobUnlocked(jobKey);
assert.equal(restored.key, jobKey);
assert.equal(restored.jobId, jobId);
assert.equal(restored.workbook.jobId, jobId);
assert.equal(restored.recoveredFromBackupKey, "job-backup:older-name-but-newer-backup:2026-09-16T00:00:00Z");
assert.deepEqual(restored.workbook, records.get(restored.recoveredFromBackupKey).workbook);
assert.equal(await api.loadStoredJobUnlocked("job:unknown"), null, "Same display names must never substitute for a missing ID");
assert.equal(await api.loadStoredJobUnlocked("job:03-09/123"), null, "Original recovery protection remains intact");
assert.equal((await api.listStoredJobs()).filter((row) => row.key === jobKey).length, 1, "Legacy backups surface once per exact job ID");
assert.equal(JSON.stringify([...records]), original, "Opening backups leaves every saved record untouched");

const canonical = { type: "job", key: jobKey, jobId, revision: 42, checksum: "retained-checksum", savedAt: "2026-09-01T00:00:00Z", workbook: { jobId, data: { retained: "canonical content" } } };
records.set(jobKey, canonical);
const scansBefore = backupScans;
assert.deepEqual(await api.loadStoredJobUnlocked(jobKey), canonical, "A canonical record always wins, even when a backup has a newer timestamp");
assert.equal(backupScans, scansBefore, "Healthy jobs do not trigger a backup scan");
assert.equal((await api.listStoredJobs()).find((row) => row.key === jobKey).recoveredFromBackupKey, undefined);
records.set(jobKey, { ...canonical, corrupt: true });
assert.equal((await api.loadStoredJobUnlocked(jobKey)).corrupt, true, "A canonical failure is surfaced, never hidden by an older backup");
assert.equal((await api.listStoredJobs()).some((row) => row.key === jobKey), false);
records.clear();
for (let day = 1; day <= 10; day += 1) {
  const record = backup("same-name", `2026-09-${String(day).padStart(2, "0")}T00:00:00Z`);
  records.set(record.key, record);
}
payloadReads = 0;
maxPendingPayloadReads = 0;
const repeatedJobListing = await api.listStoredJobs();
assert.equal(repeatedJobListing.length, 1);
assert.equal(repeatedJobListing[0].savedAt, "2026-09-10T00:00:00Z");
assert.equal(payloadReads, 10, "Listing must inspect every backup's actual job ID before deduplicating");
assert.equal(maxPendingPayloadReads, 1, "Listing reads backup payloads sequentially");
assert.equal(repeatedJobListing.some((row) => "workbook" in row), false, "Listing retains summaries, not full workbooks");
payloadReads = 0;
assert.equal((await api.loadStoredJobUnlocked(jobKey)).savedAt, "2026-09-10T00:00:00Z");
assert.equal(payloadReads, 1, "Opening the newest matching backup must not deserialize older payloads");
const sameNameDifferentJob = backup("same-name", "2026-09-05T12:00:00Z", "different-job-with-same-name");
records.set(sameNameDifferentJob.key, sameNameDifferentJob);
payloadReads = 0;
maxPendingPayloadReads = 0;
const sameNameListing = await api.listStoredJobs();
assert.equal(sameNameListing.length, 2, "Separate job IDs remain visible even when their backup names match");
assert.equal(sameNameListing.find((row) => row.key === jobKey).savedAt, "2026-09-10T00:00:00Z");
assert.equal(sameNameListing.find((row) => row.key === "job:different-job-with-same-name").recoveredFromBackupKey, sameNameDifferentJob.key);
assert.equal(payloadReads, 11, "Older same-name backups must be inspected for separate job IDs");
assert.equal(maxPendingPayloadReads, 1, "Same-name discovery keeps only one payload read in flight");
console.log("PASS missing canonical jobs recover the latest exact-ID backup read-only; existing records and original protected jobs remain authoritative.");
