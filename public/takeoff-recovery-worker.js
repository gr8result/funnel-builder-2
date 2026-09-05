/* Original storage is read-only. Mount listing reads keys and scalar metadata
 * only. Explicit inspection/export structured-clones one legacy record into a
 * disposable worker; no payload reaches React. Only the separate metadata
 * catalog may be created/written. No collection stringify/checksum/getAll. */
const DB = 'estimate-builder-template-db';
const CATALOG = 'gr8-takeoff-recovery-metadata-v1';
function scalarMetadata(row, key = row?.id) {
  const text = (value, limit = 256) => typeof value === 'string' ? value.slice(0, limit) : '';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  return { id: text(key, 1024), projectId: text(row?.projectId), name: text(row?.name), savedAt: text(row?.savedAt, 100), revision: number(row?.revision), pageCount: number(row?.pageCount), byteSize: number(row?.byteSize) };
}
async function catalog(row, key) {
  if (row) row = scalarMetadata(row);
  if (!row && !(await indexedDB.databases()).some(db => db.name === CATALOG)) return null;
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(CATALOG, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('metadata');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      // Only derived scalar metadata is writable, in a separate database.
      const tx = db.transaction('metadata', row ? 'readwrite' : 'readonly');
      const store = tx.objectStore('metadata');
      const request = row ? store.put({ id: row.id, projectId: row.projectId, name: row.name, savedAt: row.savedAt, revision: row.revision, pageCount: row.pageCount, byteSize: row.byteSize }, row.id) : store.get(key);
      tx.oncomplete = () => resolve(row || (request.result ? scalarMetadata(request.result, key) : null));
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function openDb() {
  const databases = await indexedDB.databases();
  if (!databases.some(db => db.name === DB)) throw new Error('No Takeoff database in this browser profile/origin.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function jobOf(record) {
  const candidates = [record?.workbook?.aiPlanTakeoffJob, record?.workbook?.takeoffEngine?.aiPlanTakeoffJob, record?.takeoffJob, record?.jobData];
  return candidates.find(job => (job?.plan?.pages || job?.planPages || []).length) || candidates.find(Boolean) || {};
}
function metadata(record, key) {
  const job = jobOf(record);
  const pages = job.plan?.pages || job.planPages || [];
  return scalarMetadata({ id: String(key), projectId: job.associatedProjectId || job.platformProject?.projectId || record.workbook?.registeredJob?.jobId || '',
    name: job.takeoffName || job.jobName || record.name || '', savedAt: record.savedAt || job.updatedAt || '',
    revision: job.revision ?? null, pageCount: pages.length, byteSize: record.byteSize ?? jsonByteSize(record) });
}
function jsonByteSize(record) {
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const token of jsonTokens(record)) bytes += encoder.encode(token).length;
  return bytes;
}
// JSON tokens are emitted in bounded chunks, including large base64 strings.
// Supports the plain JSON record format used by the legacy workbook store.
function* jsonTokens(value) {
  if (value === null || value === undefined) { yield 'null'; return; }
  if (typeof value === 'string') {
    if (value.length <= 16384) { yield JSON.stringify(value); return; }
    yield '"';
    for (let i = 0; i < value.length; i += 16384) {
      let end = Math.min(i + 16384, value.length);
      if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--;
      yield JSON.stringify(value.slice(i, end)).slice(1, -1);
      i = end - 16384;
    }
    yield '"'; return;
  }
  if (typeof value !== 'object') { yield JSON.stringify(value); return; }
  if (value instanceof Date) { yield JSON.stringify(value.toJSON()); return; }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Non-JSON legacy value; export stopped without changing source.');
  const array = Array.isArray(value);
  yield array ? '[' : '{';
  let first = true;
  const keys = array ? Array.from({ length: value.length }, (_, i) => i) : Object.keys(value);
  for (const key of keys) {
    if (!array && value[key] === undefined) continue;
    if (!first) yield ',';
    first = false;
    if (!array) { yield JSON.stringify(key); yield ':'; }
    yield* jsonTokens(value[key]);
  }
  yield array ? ']' : '}';
}
async function readRecord(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function list(db, prefix) {
  // Key cursor first: values and revision collection never accumulate.
  let after;
  while (true) {
    const key = await new Promise((resolve, reject) => {
      const range = after === undefined ? IDBKeyRange.bound(prefix, prefix + '\uffff') : IDBKeyRange.bound(after, prefix + '\uffff', true);
      const req = db.transaction('jobs', 'readonly').objectStore('jobs').openKeyCursor(range);
      req.onsuccess = () => resolve(req.result?.key);
      req.onerror = () => reject(req.error);
    });
    if (key === undefined) break;
    if (key === prefix || String(key).startsWith(prefix + ':snapshot:') || (prefix.startsWith('job-backup:') && String(key).startsWith(prefix))) {
      // Mount-time listing must NEVER read legacy values. Old records have no
      // separate metadata index, so missing fields stay explicitly unknown until
      // one-record inspection or independent backup verification builds a catalog.
      const row = await catalog(null, key) || {
        id: String(key), projectId: String(key).startsWith('job:') ? String(key).slice(4).split(':snapshot:')[0] : '',
        name: '', savedAt: String(key).split(':snapshot:')[1] || '',
        revision: null, pageCount: null, byteSize: null,
      };
      postMessage({ type: 'metadata', row });
    }
    after = key;
  }
}
let running = false;
self.onmessage = async ({ data }) => {
  if (running) return;
  running = true;
  let db, sink;
  try {
    db = await openDb();
    if (data.action === 'inspect') {
      const row = metadata(await readRecord(db, data.key), data.key);
      await catalog(row);
      postMessage({ type: 'metadata', row });
    } else if (data.action === 'catalog') {
      await catalog(data.row);
    } else if (data.action === 'list') {
      await list(db, data.prefix || 'job:');
      if (data.prefix === 'job:03-09/123') await list(db, 'job-backup:new-job-03-09:');
    }
    else if (data.action === 'export') {
      const record = await readRecord(db, data.key);
      if (!record) throw new Error('Record not found.');
      // The local recovery harness can supply a loopback streaming sink. Normal
      // UI exports always use the user-selected File System Access handle.
      sink = data.handle ? await data.handle.createWritable() : {
        async write(bytes) {
          const url = new URL(data.endpoint);
          if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('Recovery sink must be loopback HTTP.');
          const response = await fetch(url, { method: 'POST', body: bytes });
          if (!response.ok) throw new Error('Disk backup sink rejected a chunk.');
        },
        async close() {}, async abort() {},
      };
      let chunk = '', bytes = 0;
      const encoder = new TextEncoder();
      for (const token of jsonTokens(record)) {
        chunk += token;
        if (chunk.length >= 4194304) { const encoded = encoder.encode(chunk); await sink.write(encoded); bytes += encoded.length; chunk = ''; }
      }
      if (chunk) { const encoded = encoder.encode(chunk); await sink.write(encoded); bytes += encoded.length; }
      if (!bytes) throw new Error('Empty export.');
      await sink.close(); sink = null;
      postMessage({ type: 'done', bytes, message: `Exported ${bytes} bytes. Independent disk verification is still required.` });
      return;
    }
    postMessage({ type: 'done', message: 'Metadata scan complete. Export records individually; originals remain untouched.' });
  } catch (error) {
    if (sink) await sink.abort().catch(() => {});
    postMessage({ type: 'error', message: error.message });
  } finally { db?.close(); running = false; }
};
