// Takeoff Engine V2 persistence.
//
// Large plan data must never live in localStorage. This store keeps only tiny
// UI state in localStorage and writes PDFs/pages to IndexedDB.

import { withPlanPageDefaults } from "../types.js";

export const TAKEOFF_DB_NAME = "gr8-takeoff-db";
export const TAKEOFF_DB_VERSION = 1;
export const LOCAL_STORAGE_WARN_BYTES = 100 * 1024;

const DOCUMENTS_STORE = "documents";
const PAGES_STORE = "pages";
const THUMBNAILS_STORE = "thumbnails";
const ANALYSIS_STORE = "analysis";
const GEOMETRY_STORE = "geometry";

export const LEGACY_DOCUMENTS_KEY = (jobId) => `gr8:takeoff-v2:documents:${jobId || "unassigned"}`;
export const LEGACY_PAGES_KEY = (documentId) => `gr8:takeoff-v2:pages:${documentId}`;
export const SELECTED_PAGE_KEY = (jobId) => `gr8:takeoff-v2:selectedPage:${jobId || "unassigned"}`;
export const STORAGE_NOTICE_KEY = (jobId) => `gr8:takeoff-v2:storageNotice:${jobId || "unassigned"}`;

let dbPromise = null;
const memoryDb = {
  documents: new Map(),
  pages: new Map(),
  thumbnails: new Map(),
  analysis: new Map(),
  geometry: new Map(),
};

function hasWindow() {
  return typeof window !== "undefined";
}

function getLocalStorage() {
  return hasWindow() ? window.localStorage : null;
}

function isQuotaExceededError(err) {
  return typeof DOMException !== "undefined" && err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
}

function byteSize(value) {
  return new Blob([String(value || "")]).size;
}

function safeLocalStorageSet(key, value) {
  const storage = getLocalStorage();
  if (!storage) return;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (byteSize(text) > LOCAL_STORAGE_WARN_BYTES && process.env.NODE_ENV !== "production") {
    console.warn(`[takeoff-storage] localStorage value exceeds ${LOCAL_STORAGE_WARN_BYTES} bytes`, { key, bytes: byteSize(text) });
  }
  try {
    storage.setItem(key, text);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      cleanupObsoleteTakeoffLocalStorage({ preserveSelectedPage: true });
      storage.setItem(key, text);
      return;
    }
    throw err;
  }
}

function safeLocalStorageGetJson(key, fallback) {
  const storage = getLocalStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeLocalStorageRemove(key) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(key);
}

function openIndexedDb() {
  if (!hasWindow() || !window.indexedDB) return null;
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(TAKEOFF_DB_NAME, TAKEOFF_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const store = db.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
        store.createIndex("jobId", "jobId", { unique: false });
        store.createIndex("contentHash", "contentHash", { unique: false });
      }
      if (!db.objectStoreNames.contains(PAGES_STORE)) {
        const store = db.createObjectStore(PAGES_STORE, { keyPath: "id" });
        store.createIndex("documentId", "documentId", { unique: false });
      }
      if (!db.objectStoreNames.contains(THUMBNAILS_STORE)) db.createObjectStore(THUMBNAILS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ANALYSIS_STORE)) db.createObjectStore(ANALYSIS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(GEOMETRY_STORE)) db.createObjectStore(GEOMETRY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("IndexedDB could not be opened."));
    };
  });
  return dbPromise;
}

async function withStore(storeName, mode, callback) {
  let db = null;
  try {
    db = await openIndexedDb();
  } catch (err) {
    console.warn("[takeoff-storage] IndexedDB unavailable; using session memory storage.", err);
    db = null;
  }
  if (!db) return withMemoryStore(storeName, mode, callback);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
    result = callback(store);
  }).catch((err) => {
    if (isQuotaExceededError(err)) cleanupObsoleteTakeoffLocalStorage({ preserveSelectedPage: true });
    console.warn("[takeoff-storage] IndexedDB write failed; using session memory storage.", err);
    return withMemoryStore(storeName, mode, callback);
  });
}

function withMemoryStore(storeName, mode, callback) {
  const map = memoryDb[storeName] || new Map();
  const store = {
    put: (record) => { map.set(record.id, structuredCloneSafe(record)); return requestLike(record); },
    get: (id) => requestLike(map.get(id) || null),
    delete: (id) => { map.delete(id); return requestLike(undefined); },
    getAll: () => requestLike([...map.values()].map(structuredCloneSafe)),
    index: (name) => ({
      getAll: (value) => requestLike([...map.values()].filter((record) => record?.[name] === value).map(structuredCloneSafe)),
    }),
  };
  return Promise.resolve(callback(store));
}

function requestLike(value) {
  return { result: value };
}

function promisifyRequest(request) {
  if (request && Object.prototype.hasOwnProperty.call(request, "result") && typeof request.addEventListener !== "function") {
    return Promise.resolve(request.result);
  }
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
}

export async function hashBlob(blob) {
  if (!blob) return "";
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => { hash = ((hash << 5) - hash + byte) | 0; });
  return `fallback-${bytes.length}-${Math.abs(hash)}`;
}

export async function listDocuments(jobId) {
  const docs = await withStore(DOCUMENTS_STORE, "readonly", (store) => promisifyRequest(store.index("jobId").getAll(jobId || "unassigned")));
  return [...docs].sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

export async function saveDocument(document, fileBlob = null) {
  const now = new Date().toISOString();
  const existing = document?.id ? await getDocument(document.jobId, document.id) : null;
  const blob = fileBlob || existing?.fileBlob || null;
  const contentHash = document.contentHash || existing?.contentHash || (blob ? await hashBlob(blob) : "");
  const record = {
    ...(existing || {}),
    ...document,
    jobId: document.jobId || existing?.jobId || "unassigned",
    mimeType: document.mimeType || blob?.type || existing?.mimeType || "application/pdf",
    fileSize: Number(document.fileSize || blob?.size || existing?.fileSize || 0),
    contentHash,
    fileBlob: blob,
    originalFileUrl: document.originalFileUrl && !String(document.originalFileUrl).startsWith("data:") ? document.originalFileUrl : "",
    storage: blob ? "indexeddb" : (existing?.storage || "metadata-only"),
    createdAt: document.createdAt || existing?.createdAt || now,
    updatedAt: now,
    lastOpenedAt: document.lastOpenedAt || existing?.lastOpenedAt || now,
  };
  await withStore(DOCUMENTS_STORE, "readwrite", (store) => store.put(record));
  return publicDocument(record);
}

export async function findDuplicateDocument(jobId, fileBlob) {
  const contentHash = await hashBlob(fileBlob);
  const docs = await listDocuments(jobId);
  return docs.find((doc) => doc.contentHash && doc.contentHash === contentHash) || null;
}

export async function getDocument(jobId, documentId) {
  const record = await withStore(DOCUMENTS_STORE, "readonly", (store) => promisifyRequest(store.get(documentId)));
  return record && (!jobId || record.jobId === jobId) ? publicDocument(record) : null;
}

export async function getDocumentFileBlob(documentId) {
  const record = await withStore(DOCUMENTS_STORE, "readonly", (store) => promisifyRequest(store.get(documentId)));
  return record?.fileBlob || null;
}

export async function touchDocument(jobId, documentId) {
  const record = await withStore(DOCUMENTS_STORE, "readonly", (store) => promisifyRequest(store.get(documentId)));
  if (!record || record.jobId !== jobId) return null;
  record.lastOpenedAt = new Date().toISOString();
  await withStore(DOCUMENTS_STORE, "readwrite", (store) => store.put(record));
  return publicDocument(record);
}

export async function deleteDocument(jobId, documentId) {
  await withStore(DOCUMENTS_STORE, "readwrite", (store) => store.delete(documentId));
  const pages = await listPages(documentId);
  await Promise.all(pages.map((page) => deletePageRelatedRecords(page.id)));
  const selectedPageId = getSelectedPageId(jobId);
  if (selectedPageId) {
    const remainingPages = await listAllPages(jobId);
    if (!remainingPages.some((page) => page.id === selectedPageId)) setSelectedPageId(jobId, remainingPages[0]?.id || null);
  }
}

async function deletePageRelatedRecords(pageId) {
  await withStore(PAGES_STORE, "readwrite", (store) => store.delete(pageId));
  await withStore(THUMBNAILS_STORE, "readwrite", (store) => store.delete(pageId));
  await withStore(ANALYSIS_STORE, "readwrite", (store) => store.delete(pageId));
  await withStore(GEOMETRY_STORE, "readwrite", (store) => store.delete(pageId));
}

export async function listPages(documentId) {
  const pages = await withStore(PAGES_STORE, "readonly", (store) => promisifyRequest(store.index("documentId").getAll(documentId)));
  return [...pages].map(withPlanPageDefaults).sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function savePage(page) {
  const next = { ...page, updatedAt: new Date().toISOString() };
  await withStore(PAGES_STORE, "readwrite", (store) => store.put(next));
  return withPlanPageDefaults(next);
}

export async function getPage(documentId, pageId) {
  const page = await withStore(PAGES_STORE, "readonly", (store) => promisifyRequest(store.get(pageId)));
  return page?.documentId === documentId ? withPlanPageDefaults(page) : null;
}

export async function savePages(documentId, pages) {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  await withStore(PAGES_STORE, "readwrite", (store) => {
    sorted.forEach((page) => store.put({ ...page, documentId }));
  });
  return sorted.map(withPlanPageDefaults);
}

export function getSelectedPageId(jobId) {
  return safeLocalStorageGetJson(SELECTED_PAGE_KEY(jobId), null);
}

export function setSelectedPageId(jobId, pageId) {
  safeLocalStorageSet(SELECTED_PAGE_KEY(jobId), JSON.stringify(pageId || null));
}

export async function listAllPages(jobId) {
  const docs = await listDocuments(jobId);
  const pageLists = await Promise.all(docs.map((doc) => listPages(doc.id)));
  return pageLists.flat();
}

export async function estimateTakeoffStorageUsage(jobId = null) {
  const docs = jobId ? await listDocuments(jobId) : await withStore(DOCUMENTS_STORE, "readonly", (store) => promisifyRequest(store.getAll()).then((records) => records.map(publicDocument)));
  const bytes = docs.reduce((total, doc) => total + Number(doc.fileSize || 0), 0);
  return { bytes, documents: docs.length };
}

export async function listStorageDocuments(jobId) {
  const docs = await listDocuments(jobId);
  const withCounts = await Promise.all(docs.map(async (doc) => ({
    ...doc,
    pageCount: (await listPages(doc.id)).length,
  })));
  return withCounts;
}

export function takeoffLocalStorageKeys() {
  const storage = getLocalStorage();
  if (!storage) return [];
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (String(key || "").startsWith("gr8:takeoff-v2:") || String(key || "").startsWith("gr8:takeoff:")) keys.push(key);
  }
  return keys;
}

export function auditTakeoffLocalStorage() {
  const storage = getLocalStorage();
  return takeoffLocalStorageKeys().map((key) => {
    const value = storage.getItem(key) || "";
    return {
      key,
      bytes: byteSize(value),
      hasPdfDataUrl: /data:application\/pdf/i.test(value),
      hasImageDataUrl: /data:image\//i.test(value),
      hasBase64: /;base64,/i.test(value),
    };
  });
}

export function cleanupObsoleteTakeoffLocalStorage({ preserveSelectedPage = true } = {}) {
  const removed = [];
  const storage = getLocalStorage();
  if (!storage) return removed;
  takeoffLocalStorageKeys().forEach((key) => {
    const value = storage.getItem(key) || "";
    const isSelected = key.includes(":selectedPage:");
    const large = byteSize(value) > LOCAL_STORAGE_WARN_BYTES;
    const obsolete = key.includes(":documents:") || key.includes(":pages:") || /data:application\/pdf|data:image\/|;base64,/i.test(value);
    if ((obsolete || large) && !(preserveSelectedPage && isSelected)) {
      storage.removeItem(key);
      removed.push({ key, bytes: byteSize(value) });
    }
  });
  return removed;
}

export async function migrateLegacyTakeoffStorage(jobId) {
  const report = { migratedDocuments: 0, migratedPages: 0, removedKeys: [], quarantinedKeys: [], errors: [] };
  const storage = getLocalStorage();
  if (!storage) return report;
  const docsKey = LEGACY_DOCUMENTS_KEY(jobId);
  const legacyDocs = safeLocalStorageGetJson(docsKey, []);
  if (!Array.isArray(legacyDocs) || !legacyDocs.length) return report;

  for (const legacyDoc of legacyDocs) {
    try {
      const dataUrl = String(legacyDoc?.originalFileUrl || "");
      const blob = dataUrl.startsWith("data:application/pdf") ? dataUrlToBlob(dataUrl) : null;
      const saved = await saveDocument({
        ...legacyDoc,
        originalFileUrl: "",
        mimeType: "application/pdf",
        fileSize: blob?.size || legacyDoc.fileSize || 0,
      }, blob);
      report.migratedDocuments += 1;

      const pagesKey = LEGACY_PAGES_KEY(legacyDoc.id);
      const pages = safeLocalStorageGetJson(pagesKey, []);
      if (Array.isArray(pages) && pages.length) {
        await savePages(saved.id, pages.map((page) => ({ ...page, documentId: saved.id })));
        report.migratedPages += pages.length;
        safeLocalStorageRemove(pagesKey);
        report.removedKeys.push(pagesKey);
      }
    } catch (err) {
      const quarantineKey = `gr8:takeoff-v2:quarantine:${legacyDoc?.id || Date.now()}`;
      try {
        safeLocalStorageSet(quarantineKey, JSON.stringify({ reason: err?.message || "Migration failed", legacyDocId: legacyDoc?.id || "" }));
        report.quarantinedKeys.push(quarantineKey);
      } catch {
        report.errors.push(err?.message || "Migration failed");
      }
    }
  }
  safeLocalStorageRemove(docsKey);
  report.removedKeys.push(docsKey);
  return report;
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl || "").split(",");
  const type = (header.match(/^data:([^;]+)/i) || [])[1] || "application/octet-stream";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

function publicDocument(record) {
  if (!record) return null;
  const { fileBlob, ...metadata } = record;
  return {
    ...metadata,
    originalFileUrl: metadata.originalFileUrl || "",
    storage: metadata.storage || "indexeddb",
  };
}
