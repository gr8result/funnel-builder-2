// Complete job records, stored atomically with their previous successful revision.
// No browser metadata index is a source of truth for module payloads.
export function restoreCompleteWorkbook(defaults, saved = {}) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
  const result = { ...defaults, ...saved };
  for (const key of Object.keys(defaults || {})) {
    if (Object.hasOwn(saved, key) && defaults[key] && saved[key]
      && typeof defaults[key] === "object" && typeof saved[key] === "object"
      && !Array.isArray(defaults[key]) && !Array.isArray(saved[key])) {
      // Saved schedules/maps are authoritative, including intentional deletions.
      if (["quotation", "windowsDoors", "formulaRows", "formulas", "productLibrary"].includes(key)) continue;
      result[key] = restoreCompleteWorkbook(defaults[key], saved[key]);
    }
  }
  return result;
}

const SAVE_METADATA = new Set(["savedAt", "lastSavedAt", "page"]);
function ordered(value, root = false) {
  if (Array.isArray(value)) return value.map((item) => ordered(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => value[key] !== undefined && !(root && SAVE_METADATA.has(key)))
    .map((key) => [key, ordered(value[key])]));
}
export function jobContentSignature(workbook) {
  return JSON.stringify(ordered(workbook, true));
}
export function sameStoredJobValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.hasOwn(right, key) && sameStoredJobValue(left[key], right[key]));
}
async function checksum(workbook) {
  const bytes = new TextEncoder().encode(jobContentSignature(workbook));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const queues = new Map();
// ---- Job schema -----------------------------------------------------------------------------
// A saved job outlives the application version that wrote it. Every top-level section of a job
// belongs to exactly one class, and only the first two can stop a job from saving:
//
//   CORE       must exist in every job. A job without one is corrupt.
//   PROTECTED  project work. Optional in a job that never had it, but once saved with content a
//              later save may not silently drop it (that is a partial save, not an edit).
//   RETIRED    written by an earlier version and no longer used. Removed on load and on save.
//   anything else is OPTIONAL: feature data, derived reports, caches, audits and UI state. It may
//              be absent from an older job and may be added or removed by a newer version freely.
//
// Adding a section needs no change here. Retiring one means listing it in RETIRED_JOB_SECTIONS.
// 2: retired sections removed.  3: Client Selections cabinet schedules use the canonical cabinet
// items (migrateWorkbookCabinetSchedules, run by the job loader beside this normaliser).
export const JOB_SCHEMA_VERSION = 3;
const requiredSections = ["data", "quotation", "formulas", "clientPage", "cashflowPayments"];
export const CORE_JOB_SECTIONS = Object.freeze(["jobId", ...requiredSections]);
export const PROTECTED_JOB_SECTIONS = Object.freeze([
  "windowsDoors", "formulaRows", "quotationSectionOrder", "summaryAdjustments", "standardInclusions", "estimateInclusions",
  "productLibrary", "procurement", "purchaseOrders", "jobBoardTasks", "registeredJob", "jobFileMeta", "quoteHistory",
  "projectEstimateBuilder", "clientSelectionsBook", "selectionsBook", "selectionSchedule", "selectionSchedules",
  "aiPlanTakeoffJob", "takeoffEngine", "takeoffSchedule", "entryDoorFurnitureSchedule", "quotationSchedule",
  "procurementSchedule", "supplierPurchaseOrderSchedule",
]);
// section -> the schema version that stopped using it.
export const RETIRED_JOB_SECTIONS = Object.freeze({
  // Per-job reports left by the superseded cabinetry catalogue migration. The approved catalogue
  // (finalCabinetryQuotation.js) replaced them; they describe the catalogue, not this project.
  cabinetryCatalogueAudit: 2,
  cabinetryQuoteMigration: 2,
});
const jobSchemaVersionOf = (workbook) => Number(workbook?.jobSchemaVersion) || 1;

// The one place a job of any age is brought to the current schema: on load from browser storage,
// on opening a .gr8job, and before every save. It only removes retired sections, fills sections
// that are MISSING (from `defaults`, when given) and stamps the version. A section the job already
// has is never rebuilt, reset or replaced. Returns the same object when nothing needs to change.
export function normalizeJobForCurrentSchema(workbook, defaults = null) {
  if (!workbook || typeof workbook !== "object" || Array.isArray(workbook)) return workbook;
  const retired = Object.keys(RETIRED_JOB_SECTIONS).filter((key) => Object.hasOwn(workbook, key));
  const missing = Object.keys(defaults || {}).filter((key) => workbook[key] == null && defaults[key] != null && !(key in RETIRED_JOB_SECTIONS));
  if (!retired.length && !missing.length && jobSchemaVersionOf(workbook) >= JOB_SCHEMA_VERSION) return workbook;
  const next = { ...workbook };
  for (const key of retired) delete next[key];
  for (const key of missing) next[key] = defaults[key];
  // A job written by a newer version keeps its own, higher, version.
  next.jobSchemaVersion = Math.max(jobSchemaVersionOf(workbook), JOB_SCHEMA_VERSION);
  return next;
}

export function validateJobWorkbook(workbook, previous) {
  if (!workbook?.jobId) throw new Error("The job has no stable jobId.");
  for (const key of requiredSections) {
    if (!workbook[key] || typeof workbook[key] !== "object") throw new Error(`Incomplete job: missing ${key}.`);
  }
  if (previous?.workbook) {
    if (previous.jobId && previous.jobId !== workbook.jobId) throw new Error("Job identity does not match the stored job.");
    // Only project work is guarded. An optional or retired section missing from this save is
    // schema evolution, not data loss, and must never make an existing job unsaveable.
    for (const key of PROTECTED_JOB_SECTIONS) {
      if (previous.workbook[key] != null && !Object.hasOwn(workbook, key)) throw new Error(`Incomplete job: missing saved section ${key}.`);
    }
    for (const key of ["data", "quotation"]) {
      if (Object.keys(previous.workbook[key] || {}).length && !Object.keys(workbook[key]).length) throw new Error(`Refusing to replace saved ${key} with an empty payload.`);
    }
  }
}
const validate = validateJobWorkbook;
// Every save keeps the previous revisions as full copies of the job. They were never removed, so
// a large job autosaving through an editing session grew the browser database by two complete
// copies per save until the disk filled and the browser discarded ALL of this site's storage -
// the saved job, its revisions and the Master Template together. Only the newest revisions are
// kept; older copies are deleted in the same transaction as the save that supersedes them.
export const RETAINED_JOB_REVISIONS = 3;
export function supersededRevisionKeys(keys = [], key = "", revision = 0, retain = RETAINED_JOB_REVISIONS) {
  const prefix = `${key}:snapshot:revision-`;
  return keys.filter((item) => {
    const text = String(item);
    if (!text.startsWith(prefix)) return false;
    const number = Number(text.slice(prefix.length).split("-")[0]);
    return Number.isFinite(number) && number <= revision - retain;
  });
}
// The original key remains immutable; a recovered working copy needs a separate key.
export const PROTECTED_RECOVERY_JOB_KEY = "job:03-09/123";
export function isProtectedRecoveryRecord(record = {}) {
  return record.key === PROTECTED_RECOVERY_JOB_KEY || record.recoveryProtected === true;
}
export function recoveryOriginalKey(key) {
  return `${key}:snapshot:recovery-original`;
}
function readRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistCompleteJob({ openDatabase, storeName, key, workbook, name, savedAt, externalize, activePointer, initializeRecovery = false, normalizeRecovery = (value) => value }) {
  if (key === PROTECTED_RECOVERY_JOB_KEY) {
    throw new Error("New Job 03/09 is protected by recovery safe mode. Original records cannot be overwritten. Open a separately recovered copy before saving.");
  }
  // Capture the live edits before any asynchronous work. Never restore this snapshot into React on save.
  let snapshot = normalizeJobForCurrentSchema(structuredClone(workbook));
  validate(snapshot);
  if (key.includes(":snapshot:")) throw new Error("Recovery backups are immutable; save the working job instead.");
  if (key !== `job:${snapshot.jobId}`) throw new Error("Storage key does not match the current jobId.");
  const write = async () => {
    const db = await openDatabase();
    let record;
    try {
      // Opening a protected record is idempotent and shares the manual/autosave lock.
      // Re-read under the lock so another tab's working revision is never reset to the original.
      if (initializeRecovery) {
        const current = await readRecord(db, storeName, key);
        if (!current?.workbook) throw new Error("The recovered job could not be found.");
        if (current.recovery?.originalKey || !isProtectedRecoveryRecord(current)) return current;
        snapshot = normalizeJobForCurrentSchema(normalizeRecovery({ ...current.workbook, jobId: current.jobId || current.workbook.jobId || key.slice(4) }));
        name = current.name || name;
      }
      const storedWorkbook = externalize ? await externalize(snapshot) : snapshot;
      const hash = await checksum(storedWorkbook);
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        let failure;
        const abort = (error) => { failure = error; transaction.abort(); };
        transaction.oncomplete = resolve;
        transaction.onerror = transaction.onabort = () => reject(failure || transaction.error || new Error("Job save transaction was aborted."));
        const request = store.get(key);
        request.onsuccess = () => {
          const previous = request.result;
          const originalKey = previous?.recovery?.originalKey
            || (isProtectedRecoveryRecord({ ...previous, key }) ? recoveryOriginalKey(key) : "");
          const commitWorkingRecord = () => {
            try {
              validate(storedWorkbook, previous);
              const revision = Number(previous?.revision || 0) + 1;
              record = { type: "job", key, jobId: snapshot.jobId, name, savedAt,
                schemaVersion: 1, jobSchemaVersion: storedWorkbook.jobSchemaVersion, revision, checksum: hash, requiredSections, workbook: storedWorkbook,
                ...(originalKey ? { recovery: { originalKey, sourceKey: key, working: true } } : {}) };
              if (previous?.workbook) {
                const revisionKey = `${key}:snapshot:revision-${revision - 1}-${previous.savedAt || "legacy"}`;
                store.put({ ...previous, key: revisionKey }, revisionKey);
              }
              store.put(record, key);
              store.put({ ...record, key: `${key}:snapshot:revision-${revision}-${savedAt}` }, `${key}:snapshot:revision-${revision}-${savedAt}`);
              store.put(activePointer(record), "active-job");
              const revisionKeys = store.getAllKeys(IDBKeyRange.bound(`${key}:snapshot:revision-`, `${key}:snapshot:revision-\uffff`));
              revisionKeys.onsuccess = () => supersededRevisionKeys(revisionKeys.result, key, revision).forEach((oldKey) => store.delete(oldKey));
              const verify = store.get(key);
              verify.onsuccess = () => {
                // Compare the structured-cloned records directly. Serializing both
                // sides simultaneously duplicates every embedded image/document.
                if (!sameStoredJobValue(verify.result, record)) abort(new Error("Job read-back verification failed; transaction rolled back."));
              };
            } catch (error) { abort(error); }
          };
          if (!originalKey) { commitWorkingRecord(); return; }
          const originalRequest = store.get(originalKey);
          originalRequest.onsuccess = () => {
            try {
              if (originalRequest.result && (!originalRequest.result.immutable
                || !originalRequest.result.originalRecord?.workbook
                || originalRequest.result.jobId !== snapshot.jobId)) {
                throw new Error("The existing recovery backup is invalid; the working save was not committed.");
              }
              if (!originalRequest.result) {
                if (!previous?.workbook) throw new Error("The original recovery record is missing; the working save was not committed.");
                // add(), never put(): no successful save can overwrite the protected original.
                // Keep the entire original envelope byte-for-byte representable, including unknown fields.
                store.add({ type: "job-recovery-backup", key: originalKey, jobId: snapshot.jobId,
                  immutable: true, revision: Number(previous.revision || 0), sourceKey: key,
                  savedAt: previous.savedAt || "", originalRecord: previous }, originalKey);
              }
              commitWorkingRecord();
            } catch (error) { abort(error); }
          };
        };
      });
      const stored = await readRecord(db, storeName, key);
      if (stored?.jobId !== record.jobId || stored?.revision !== record.revision
        || stored?.checksum !== hash || await checksum(stored.workbook) !== hash) {
        throw new Error("Saved job read-back identity, revision or checksum did not match. Previous revisions remain available.");
      }
      if (record.recovery?.originalKey) {
        const original = await readRecord(db, storeName, record.recovery.originalKey);
        if (!original?.immutable || !original.originalRecord?.workbook || original.jobId !== record.jobId) {
          throw new Error("Recovery backup verification failed. Saved revisions remain available.");
        }
      }
      validate(stored.workbook);
      return record;
    } finally { db.close(); }
  };
  const previous = queues.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => globalThis.navigator?.locks
    ? navigator.locks.request(`estimate-builder-save:${key}`, write) : write());
  queues.set(key, pending);
  try { return await pending; }
  finally { if (queues.get(key) === pending) queues.delete(key); }
}
