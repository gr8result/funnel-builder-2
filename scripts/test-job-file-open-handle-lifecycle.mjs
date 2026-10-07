import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the complete hook with in-memory React state and file services. No real
// browser storage, job files or file handles are read or written by this test.
const source = fs.readFileSync("hooks/useJobFile.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const state = [];
let cursor = 0;
const localStorage = new Map();
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  },
  useRef(initial) { return this.useState(() => ({ current: initial }))[0]; },
  useCallback(value) { return value; },
  useMemo(factory) { return factory(); },
  useEffect() {},
};
// Hook calls are compiled as detached functions, just as React exports are used.
react.useRef = (initial) => react.useState(() => ({ current: initial }))[0];
const saved = [];
const openErrors = [];
let selectedJobResult;
let pickerError;
const fileServices = {
  JOB_FILE_EXTENSION: ".gr8job",
  isAbortLikeFileSystemError: (error) => error?.name === "AbortError",
  async openJob() {
    if (pickerError) throw pickerError;
    return selectedJobResult;
  },
  async saveJob(data, handle) {
    saved.push({ data, handle });
    return { ok: true, data, handle, fileName: `${data.jobName}.gr8job`, storageLocation: handle ? "computer-file" : "download" };
  },
};
const hookModule = { exports: {} };
vm.runInNewContext(compiled, {
  exports: hookModule.exports,
  require(name) {
    if (name === "react") return react;
    if (name === "../lib/jobFile") return fileServices;
    throw new Error(`Unexpected dependency ${name}`);
  },
  window: { localStorage: {
    getItem: (key) => localStorage.get(key) || null,
    setItem: (key, value) => localStorage.set(key, value),
  } },
  console,
});
let failOpen = false;
const jobA = { jobId: "legacy-a", jobName: "Job A", lastModified: "2026-09-01T00:00:00Z" };
const jobB = { jobId: "legacy-b", jobName: "Job B", lastModified: "2026-09-02T00:00:00Z" };
let jobData = jobA;
const render = () => {
  cursor = 0;
  return hookModule.exports.useJobFile({
    jobData,
    onOpenJob: async (data) => {
      if (failOpen) throw new Error("Could not hydrate job");
      jobData = data;
    },
    onError: (message) => openErrors.push(message),
  });
};
const computerHandle = { name: "Job A.gr8job" };
let hook = render();
assert.equal((await hook.openParsedJob(jobA, computerHandle.name, computerHandle)).ok, true);
hook = render();
assert.equal(hook.currentHandle, computerHandle);
assert.equal(hook.recentJobs[0].projectId, jobA.jobId, "Legacy top-level jobId remains a usable recent-job identity");

failOpen = true;
assert.equal((await hook.openParsedJob(jobB, "Job B.gr8job", null)).ok, false);
hook = render();
assert.equal(hook.currentHandle, computerHandle, "Failed hydration must preserve the active job and its file handle");

selectedJobResult = { ok: true, data: jobB, fileName: "Job B.gr8job", handle: null };
const failedPickerOpen = await hook.open();
assert.equal(failedPickerOpen.ok, false);
assert.equal(failedPickerOpen.message, "Job B.gr8job: Could not hydrate job", "Picker-open errors must retain the selected filename and hydration failure");
assert.equal(openErrors.at(-1), failedPickerOpen.message, "The visible error callback must receive the original hydration failure");
hook = render();
assert.equal(hook.currentHandle, computerHandle);
assert.equal(hook.currentFileName, computerHandle.name);
assert.equal(jobData, jobA, "A failed picker open must preserve the previously active job");

pickerError = new Error("File permission expired");
assert.equal((await hook.open()).message, "File permission expired", "Picker failures must remain useful even before a filename is available");
pickerError = Object.assign(new Error("The user cancelled the picker"), { name: "AbortError" });
const errorCount = openErrors.length;
assert.equal((await hook.open()).cancelled, true);
assert.equal(openErrors.length, errorCount, "Picker cancellation must not display an error");
pickerError = null;

failOpen = false;
assert.equal((await hook.openParsedJob(jobB, "Job B.gr8job", null)).ok, true);
hook = render();
assert.equal(hook.currentHandle, null, "Opening a downloaded/parsed job must detach the previous job's file handle");
assert.equal(hook.currentFileName, "Job B.gr8job");
assert.equal(hook.hasActiveJob, true);
assert.equal(hook.recentJobs[0].projectId, jobB.jobId);
assert.equal((await hook.save()).ok, true);
assert.equal(saved[0].handle, null, "Saving Job B must never touch Job A's file");
assert.equal(saved[0].data.jobId, jobB.jobId);

const legacyWorkbookOnly = { jobName: "Job C", workbook: { jobId: "legacy-c" } };
assert.equal((await render().openParsedJob(legacyWorkbookOnly, "Job C.gr8job", null)).ok, true);
assert.equal(render().recentJobs[0].projectId, "legacy-c", "Older workbook-only identities remain discoverable");
const sameFileDifferentJob = { ...jobB, jobId: 'distinct-master-b', workbook: { jobId: 'distinct-master-b', projectId: jobB.jobId } };
assert.equal((await render().openParsedJob(sameFileDifferentJob, 'Job B.gr8job', null)).ok, true);
assert.equal(render().recentJobs.filter(job => job.fileName === 'Job B.gr8job').length, 2, 'Equal filenames cannot merge different master jobs');
const stableRecentId = render().recentJobs[0].id;
assert.equal((await render().openParsedJob(sameFileDifferentJob, 'Renamed.gr8job', null)).ok, true);
assert.equal(render().recentJobs[0].id, stableRecentId, 'Renaming keeps the same permanent handle registry identity');
console.log("PASS successful job changes clear stale handles, failed opens retain useful errors and the active handle, and legacy job IDs remain discoverable.");
