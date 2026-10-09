// Explicit job context. No module may read or write job data without a jobId.
//
//   THE URL IS THE SOURCE OF TRUTH for which job a browser tab is working on (?jobId=...), so
//   two tabs can hold two different jobs, a reload reopens the same job, and a link names its job.
//   A "last opened job" pointer is only a hint for a tab that arrives with no jobId: it never
//   changes the job of a tab that already has one.
//
//   Every cache / draft / persistence key is scoped builderId + jobId + module (jobScopedKey).
//
//   A save carries the revision its tab loaded. A job that has since been saved by ANOTHER tab or
//   user is never silently overwritten: the write is rejected as a JobConflictError.

export const JOB_ID_URL_PARAM = "jobId";
const JOB_KEY_PREFIX = "job:";
const text = (value) => String(value ?? "").trim();

export const jobIdFromKey = (key = "") => (text(key).startsWith(JOB_KEY_PREFIX) ? text(key).slice(JOB_KEY_PREFIX.length) : text(key));
export const jobKeyFromId = (jobId = "") => (text(jobId) ? `${JOB_KEY_PREFIX}${jobIdFromKey(jobId)}` : "");

// builder_01:job_123:estimate - the one shape for every job-scoped storage / cache key.
export function jobScopedKey(builderId = "", jobId = "", module = "") {
  const builder = text(builderId), job = jobIdFromKey(jobId), part = text(module);
  if (!builder || !job || !part) throw new Error(`A job-scoped key needs a builder, a job and a module (got "${builder}", "${job}", "${part}").`);
  return `${builder}:${job}:${part}`;
}

// The job this tab's URL names, as a storage key ("job:<id>"), or "".
export function jobKeyFromLocation(location = typeof window !== "undefined" ? window.location : null) {
  if (!location) return "";
  try { return jobKeyFromId(new URLSearchParams(location.search || "").get(JOB_ID_URL_PARAM) || ""); } catch { return ""; }
}

// The same address with its job set (or cleared). Every other parameter is kept.
export function urlWithJob(href = "", jobKey = "") {
  const url = new URL(href, "http://local");
  const jobId = jobIdFromKey(jobKey);
  if (jobId) url.searchParams.set(JOB_ID_URL_PARAM, jobId); else url.searchParams.delete(JOB_ID_URL_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

// Writes the open job into this tab's address without navigating, reloading or remounting.
export function writeJobToLocation(jobKey = "") {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const next = urlWithJob(window.location.href, jobKey);
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", next);
  } catch {}
}

// One id per browser tab (per page load), stamped on every job this tab writes.
let tabId = "";
export function currentTabId() {
  if (!tabId) tabId = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return tabId;
}

// The revision of each job this tab last loaded or saved: what its next save is based on.
const baseRevisions = new Map();
export const rememberJobRevision = (jobKey = "", revision) => { if (jobKey && Number.isFinite(Number(revision))) baseRevisions.set(jobKey, Number(revision)); };
export const knownJobRevision = (jobKey = "") => (baseRevisions.has(jobKey) ? baseRevisions.get(jobKey) : null);
export const forgetJobRevision = (jobKey = "") => { baseRevisions.delete(jobKey); };

export class JobConflictError extends Error {
  constructor({ jobKey = "", baseRevision = null, storedRevision = null, savedAt = "", updatedBy = null } = {}) {
    super(`This job was saved somewhere else${savedAt ? ` at ${new Date(savedAt).toLocaleTimeString()}` : ""} (revision ${storedRevision}; this tab has revision ${baseRevision}). Nothing was overwritten. Reload the job to get the newer version before saving again.`);
    this.name = "JobConflictError";
    this.code = "JOB_CONFLICT";
    Object.assign(this, { jobKey, baseRevision, storedRevision, savedAt, updatedBy });
  }
}

// A write is stale when the stored job is newer than the revision this writer loaded AND that
// newer revision was written by somebody else (another tab or user). A writer never conflicts
// with its own earlier saves, and a record with no writer stamp (saved before stamps existed, or
// by a maintenance path) never blocks a save.
export function staleWriteConflict(previous = null, { baseRevision = null, writer = null, jobKey = "" } = {}) {
  if (!previous || baseRevision == null || !writer?.tabId) return null;
  const stored = Number(previous.revision || 0);
  const other = previous.updatedBy?.tabId && previous.updatedBy.tabId !== writer.tabId;
  if (!(stored > Number(baseRevision)) || !other) return null;
  return new JobConflictError({ jobKey, baseRevision: Number(baseRevision), storedRevision: stored, savedAt: previous.savedAt || "", updatedBy: previous.updatedBy });
}
