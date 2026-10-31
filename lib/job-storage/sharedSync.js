// Shared Storage for the live application. In LOCAL ONLY mode every function here does nothing.
// In SHARED mode the job a tab saves is, as part of that same save, committed to the builder's job
// server under its company and job id:
//
//   save     local save first (the work is never lost), then commit to the shared server with the
//            revision this computer last had. The server refuses a stale commit: the user is told
//            another user saved first, and nothing of theirs is overwritten.
//   open     openSharedJob() returns the job's current shared revision for the application to
//            store locally and open; listSharedJobs() is the company's job list.
//   offline  if the server cannot be reached the job stays saved locally and is marked "not yet
//            shared"; the next save (or publishPending) commits it - or reports the conflict if
//            someone else saved meanwhile.
//
// What this computer last had of each shared job is kept per company and job, never per browser.

import { JobConflictError, JobStorageOfflineError, RemoteJobClient } from "./jobClient.js";
import { loadStorageSettings } from "./storageSettings.js";
import { browserTenantKey } from "../builders/browserTenantStorage.js";

const text = (value) => String(value ?? "").trim();
const jobIdOf = (jobKey = "") => text(jobKey).replace(/^job:/, "");
const stateKey = (settings, jobId) => `${browserTenantKey("gr8:shared-job-state")}:${settings.companyId}:${jobId}`;
const storage = () => (typeof window !== "undefined" ? window.localStorage : null);

export function sharedStorageActive(settings = loadStorageSettings()) {
  return settings.mode === "shared" && Boolean(settings.serverUrl && settings.companyId && settings.token);
}
export function sharedClient(settings = loadStorageSettings(), fetchImpl = globalThis.fetch) {
  return new RemoteJobClient({ baseUrl: settings.serverUrl, token: settings.token, companyId: settings.companyId, fetch: fetchImpl.bind(globalThis) });
}
// { revision, pending, sharedAt, conflict } - what this computer knows of the shared job.
export function sharedJobState(jobKey, settings = loadStorageSettings()) {
  try { return JSON.parse(storage()?.getItem(stateKey(settings, jobIdOf(jobKey))) || "null") || { revision: 0, pending: false, sharedAt: "", conflict: null }; } catch { return { revision: 0, pending: false, sharedAt: "", conflict: null }; }
}
function rememberSharedJobState(jobKey, settings, state) {
  storage()?.setItem(stateKey(settings, jobIdOf(jobKey)), JSON.stringify(state));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gr8:shared-job-state", { detail: { jobKey, ...state } }));
}

// A large job takes seconds to commit, and this computer can start a second save of the same job
// meanwhile (autosave and a selection save, or two tabs). Commits of one job therefore run one at
// a time - across this browser's tabs where Web Locks exist - so a computer never conflicts with
// itself. Different jobs do not wait for each other.
const commitQueues = new Map();
function oneCommitAtATime(name, run) {
  if (typeof navigator !== "undefined" && navigator.locks?.request) return navigator.locks.request(`gr8-shared-commit:${name}`, run);
  const turn = (commitQueues.get(name) || Promise.resolve()).then(run, run);
  const settled = turn.catch(() => {});
  commitQueues.set(name, settled);
  void settled.then(() => { if (commitQueues.get(name) === settled) commitQueues.delete(name); });
  return turn;
}

// Called by the job save, after the local save has succeeded. Returns { shared, revision } |
// { shared: false, pending: true } (offline) | { shared: false } (local-only mode).
// Throws JobConflictError when another user has saved the job since this computer last had it.
export async function commitJobToSharedStorage(jobKey, workbook, { name = "", settings = loadStorageSettings(), fetchImpl = globalThis.fetch } = {}) {
  if (!sharedStorageActive(settings)) return { shared: false };
  const jobId = jobIdOf(jobKey);
  if (!jobId) throw new Error("A job id is required to save to shared storage.");
  return oneCommitAtATime(stateKey(settings, jobId), () => commitNow(jobKey, jobId, workbook, { name, settings, fetchImpl }));
}
async function commitNow(jobKey, jobId, workbook, { name, settings, fetchImpl }) {
  // Read only once this commit holds the job's turn: the base is the revision the previous
  // commit from this computer produced, not the one it started from.
  const state = sharedJobState(jobKey, settings);
  try {
    const saved = await sharedClient(settings, fetchImpl).save(jobId, workbook, { baseRevision: state.revision, name });
    rememberSharedJobState(jobKey, settings, { revision: saved.revision, pending: false, sharedAt: saved.updatedAt, conflict: null });
    return { shared: true, revision: saved.revision, uploadedAssets: saved.uploadedAssets };
  } catch (error) {
    if (error instanceof JobStorageOfflineError) { rememberSharedJobState(jobKey, settings, { ...state, pending: true }); return { shared: false, pending: true }; }
    if (error instanceof JobConflictError) {
      rememberSharedJobState(jobKey, settings, { ...state, pending: true, conflict: error.head });
      const conflict = new JobConflictError(error.head);
      conflict.message = `${error.head.updatedByName || "Another user"} saved this job to shared storage${error.head.updatedAt ? ` at ${new Date(error.head.updatedAt).toLocaleTimeString()}` : ""} (revision ${error.head.revision}) after you opened it. Your changes are saved on this computer only and were NOT shared; nothing of theirs was overwritten. Open the latest shared version from Storage Settings to continue.`;
      throw conflict;
    }
    throw error;
  }
}

export async function listSharedJobs(settings = loadStorageSettings(), fetchImpl = globalThis.fetch) {
  return sharedClient(settings, fetchImpl).list();
}
// The job's current shared revision, for the application to store locally and open. Opening it
// makes that revision this computer's base, which also clears an earlier conflict on the job.
export async function openSharedJob(jobId, settings = loadStorageSettings(), fetchImpl = globalThis.fetch) {
  const found = await sharedClient(settings, fetchImpl).open(jobId);
  if (!found) return null;
  rememberSharedJobState(`job:${jobId}`, settings, { revision: found.revision, pending: false, sharedAt: found.updatedAt, conflict: null });
  return found;
}
