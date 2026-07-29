// Job summary for the banner. V2 never writes back to a job file — Open/Open
// Recent are read-only from V2's point of view, going through the exact same
// hooks/useJobFile.js + lib/jobFile.ts + components/estimate-builder/JobFileMenu.jsx
// used by Estimate Builder itself (see TakeoffV2Page.jsx). No legacy ai-takeoff
// component or its viewer/rotation state is imported here.

const NOT_ENTERED = "Not entered";

function valueOrNotEntered(value) {
  const text = String(value || "").trim();
  return text || NOT_ENTERED;
}

/** @param {URLSearchParams | Record<string, string | string[] | undefined>} query */
export function readJobSummaryFromQuery(query) {
  const get = (key) => {
    if (query instanceof URLSearchParams) return query.get(key) || "";
    const value = query?.[key];
    return Array.isArray(value) ? value[0] || "" : value || "";
  };
  return {
    projectName: valueOrNotEntered(get("projectName")),
    jobNumber: valueOrNotEntered(get("jobNumber")),
    projectAddress: valueOrNotEntered(get("projectAddress")),
    fileName: valueOrNotEntered(get("fileName")),
  };
}

/** JobFileData (lib/jobFile.ts) -> the banner's flat summary shape. */
export function jobSummaryFromJobFileData(job, fileName) {
  return {
    projectName: valueOrNotEntered(job?.jobName),
    jobNumber: valueOrNotEntered(job?.jobNumber),
    projectAddress: valueOrNotEntered(job?.address),
    fileName: valueOrNotEntered(fileName),
  };
}

/**
 * JobFileData has no persistent unique id (see lib/jobFile.ts's JobFileData
 * type) — the file itself, identified by name, is the closest stable identity
 * a job has. Slugified so it's safe to use as a storage key.
 */
export function deriveJobId(fileName) {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) return null;
  const withoutExtension = trimmed.replace(/\.gr8job$/i, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

export const NOT_ENTERED_LABEL = NOT_ENTERED;
export const DEFAULT_JOB_ID = "dev-job-1";
