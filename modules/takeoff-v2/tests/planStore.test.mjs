import assert from "node:assert/strict";

function createMemoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] || null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    _map: map,
  };
}

globalThis.window = { localStorage: createMemoryStorage() };

const {
  auditTakeoffLocalStorage,
  cleanupObsoleteTakeoffLocalStorage,
  deleteDocument,
  findDuplicateDocument,
  getDocumentFileBlob,
  getSelectedPageId,
  hashBlob,
  LEGACY_DOCUMENTS_KEY,
  LEGACY_PAGES_KEY,
  listAllPages,
  listDocuments,
  listPages,
  listStorageDocuments,
  migrateLegacyTakeoffStorage,
  saveDocument,
  savePage,
  savePages,
  setSelectedPageId,
} = await import("../persistence/planStore.js");
const {
  withPlanPageDefaults,
  EXTERIOR_SOURCE_MANUAL_TRACE_V2,
  EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR,
} = await import("../types.js");

function pdfBlob(text = "%PDF-1.7 test") {
  return new Blob([text], { type: "application/pdf" });
}

function page(id, documentId, pageNumber = 1) {
  return {
    id,
    documentId,
    pageNumber,
    sourceWidth: 612,
    sourceHeight: 792,
    rotation: 0,
    orientationConfirmed: false,
    calibration: null,
    detectedRotationSuggestion: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const jobId = "job-storage";
const file = pdfBlob("%PDF-1.7 large-content");
const doc = await saveDocument({
  id: "doc-1",
  jobId,
  fileName: "plan.pdf",
  mimeType: "application/pdf",
  fileSize: file.size,
}, file);

assert.equal(doc.storage, "indexeddb");
assert.equal(doc.originalFileUrl, "");
assert.equal((await listDocuments(jobId)).length, 1);
assert.equal(await (await getDocumentFileBlob("doc-1")).text(), "%PDF-1.7 large-content");
assert.equal(auditTakeoffLocalStorage().some((entry) => entry.hasPdfDataUrl || entry.hasBase64), false, "PDF data must not be written to localStorage");

await savePages("doc-1", [page("page-1", "doc-1", 1), page("page-2", "doc-1", 2)]);
assert.equal((await listPages("doc-1")).length, 2);

await savePage({ ...page("page-1", "doc-1", 1), rotation: 90 });
const pagesAfterRotate = await listPages("doc-1");
assert.equal(pagesAfterRotate.find((p) => p.id === "page-1").rotation, 90);
assert.equal(pagesAfterRotate.find((p) => p.id === "page-2").rotation, 0);

setSelectedPageId(jobId, "page-2");
assert.equal(getSelectedPageId(jobId), "page-2");

const duplicate = await findDuplicateDocument(jobId, pdfBlob("%PDF-1.7 large-content"));
assert.equal(duplicate.id, "doc-1");

const doc2Blob = pdfBlob("%PDF-1.7 other");
await saveDocument({ id: "doc-2", jobId, fileName: "other.pdf", fileSize: doc2Blob.size }, doc2Blob);
await savePages("doc-2", [page("page-3", "doc-2", 1)]);
await deleteDocument(jobId, "doc-1");
assert.equal((await listDocuments(jobId)).some((entry) => entry.id === "doc-1"), false);
assert.deepEqual(await listPages("doc-1"), []);
assert.equal((await listPages("doc-2")).length, 1, "deleting one plan must not delete another plan");

const storageDocs = await listStorageDocuments(jobId);
assert.equal(storageDocs.find((entry) => entry.id === "doc-2").pageCount, 1);

// Legacy base64 plan migrates into blob storage and removes the old large keys.
const legacyJob = "legacy-job";
const legacyDataUrl = `data:application/pdf;base64,${btoa("%PDF legacy")}`;
window.localStorage.setItem(LEGACY_DOCUMENTS_KEY(legacyJob), JSON.stringify([
  { id: "legacy-doc", jobId: legacyJob, fileName: "legacy.pdf", originalFileUrl: legacyDataUrl, createdAt: "2026-01-01T00:00:00.000Z" },
]));
window.localStorage.setItem(LEGACY_PAGES_KEY("legacy-doc"), JSON.stringify([page("legacy-page", "legacy-doc", 1)]));
const migration = await migrateLegacyTakeoffStorage(legacyJob);
assert.equal(migration.migratedDocuments, 1);
assert.equal(migration.migratedPages, 1);
assert.equal(window.localStorage.getItem(LEGACY_DOCUMENTS_KEY(legacyJob)), null);
assert.equal(window.localStorage.getItem(LEGACY_PAGES_KEY("legacy-doc")), null);
assert.equal(await (await getDocumentFileBlob("legacy-doc")).text(), "%PDF legacy");

// Repair removes obsolete Takeoff cache data without touching unrelated app keys.
window.localStorage.setItem("gr8:takeoff-v2:pages:obsolete", JSON.stringify([{ giant: legacyDataUrl }]));
window.localStorage.setItem("unrelated:key", legacyDataUrl);
const removed = cleanupObsoleteTakeoffLocalStorage();
assert.equal(removed.some((entry) => entry.key === "gr8:takeoff-v2:pages:obsolete"), true);
assert.equal(window.localStorage.getItem("unrelated:key"), legacyDataUrl);

// Quota failure on tiny selected-page state is repaired by cleaning obsolete Takeoff keys.
{
  const realSetItem = window.localStorage.setItem;
  let first = true;
  window.localStorage.setItem("gr8:takeoff-v2:documents:quota", JSON.stringify([{ originalFileUrl: legacyDataUrl }]));
  window.localStorage.setItem = (key, value) => {
    if (first && key.includes(":selectedPage:")) {
      first = false;
      throw new DOMException("quota", "QuotaExceededError");
    }
    return realSetItem.call(window.localStorage, key, value);
  };
  setSelectedPageId("quota", "page-ok");
  assert.equal(getSelectedPageId("quota"), "page-ok");
  window.localStorage.setItem = realSetItem;
}

// Legacy automatic exterior results are still quarantined on load.
{
  const legacyAuto = withPlanPageDefaults({
    ...page("legacy-auto", "doc-2", 1),
    exteriorWalls: {
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "s", aId: "a", bId: "b", source: "automatic", confirmed: true }],
      isClosed: true,
      detectedSnapshot: { vertices: [], segments: [] },
      detectionConfidence: 88,
    },
  });
  assert.equal(legacyAuto.exteriorWalls, null);
  assert.equal(legacyAuto.legacyExteriorWalls.source, EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR);
}

{
  const manual = withPlanPageDefaults({
    ...page("manual-trace", "doc-2", 1),
    exteriorWalls: {
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "s", aId: "a", bId: "b", source: "manual", confirmed: true }],
    },
  });
  assert.equal(manual.exteriorWalls.source, EXTERIOR_SOURCE_MANUAL_TRACE_V2);
}

assert.equal((await hashBlob(pdfBlob("same"))) === (await hashBlob(pdfBlob("same"))), true);
assert.equal((await listAllPages(jobId)).length, 1);

console.log("planStore.test.mjs passed");
