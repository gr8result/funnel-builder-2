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
async function checksum(workbook) {
  const bytes = new TextEncoder().encode(jobContentSignature(workbook));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const queues = new Map();
const requiredSections = ["data", "quotation", "formulas", "clientPage", "cashflowPayments"];
function validate(workbook, previous) {
  if (!workbook?.jobId) throw new Error("The job has no stable jobId.");
  for (const key of requiredSections) {
    if (!workbook[key] || typeof workbook[key] !== "object") throw new Error(`Incomplete job: missing ${key}.`);
  }
  if (previous?.workbook) {
    if (previous.jobId && previous.jobId !== workbook.jobId) throw new Error("Job identity does not match the stored job.");
    for (const key of Object.keys(previous.workbook)) {
      if (previous.workbook[key] != null && !Object.hasOwn(workbook, key)) throw new Error(`Incomplete job: missing saved section ${key}.`);
    }
    for (const key of ["data", "quotation"]) {
      if (Object.keys(previous.workbook[key] || {}).length && !Object.keys(workbook[key]).length) throw new Error(`Refusing to replace saved ${key} with an empty payload.`);
    }
  }
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
  let snapshot = structuredClone(workbook);
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
        snapshot = normalizeRecovery({ ...current.workbook, jobId: current.jobId || current.workbook.jobId || key.slice(4) });
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
                schemaVersion: 1, revision, checksum: hash, requiredSections, workbook: storedWorkbook,
                ...(originalKey ? { recovery: { originalKey, sourceKey: key, working: true } } : {}) };
              if (previous?.workbook) {
                const revisionKey = `${key}:snapshot:revision-${revision - 1}-${previous.savedAt || "legacy"}`;
                store.put({ ...previous, key: revisionKey }, revisionKey);
              }
              store.put(record, key);
              store.put({ ...record, key: `${key}:snapshot:revision-${revision}-${savedAt}` }, `${key}:snapshot:revision-${revision}-${savedAt}`);
              store.put(activePointer(record), "active-job");
              const verify = store.get(key);
              verify.onsuccess = () => {
                if (jobContentSignature(verify.result) !== jobContentSignature(record)) abort(new Error("Job read-back verification failed; transaction rolled back."));
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
