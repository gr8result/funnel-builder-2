import assert from "node:assert/strict";

// Minimal localStorage stub so planStore's `typeof window === "undefined"` guard
// takes the browser path in this Node test. Must be installed before planStore.js
// is imported, since it reads `window` at call time (not at import time), but we
// set it up first regardless for clarity.
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}
globalThis.window = { localStorage: createMemoryStorage() };

const {
  listDocuments,
  saveDocument,
  deleteDocument,
  listPages,
  savePage,
  savePages,
  getSelectedPageId,
  setSelectedPageId,
  listAllPages,
} = await import("../persistence/planStore.js");
const {
  withPlanPageDefaults,
  EXTERIOR_SOURCE_MANUAL_TRACE_V2,
  EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR,
} = await import("../types.js");

const jobId = "job-1";
const doc = { id: "doc-1", jobId, fileName: "plan.pdf", originalFileUrl: "data:application/pdf;base64,AAAA", createdAt: new Date().toISOString() };
saveDocument(doc);

assert.deepEqual(listDocuments(jobId).map((d) => d.id), ["doc-1"]);

const pageA = { id: "page-1", documentId: "doc-1", pageNumber: 1, sourceWidth: 612, sourceHeight: 792, rotation: 0, orientationConfirmed: false, calibration: null, detectedRotationSuggestion: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const pageB = { ...pageA, id: "page-2", pageNumber: 2 };
savePages("doc-1", [pageA, pageB]);

assert.equal(listPages("doc-1").length, 2);

// Rotating one page must not touch the other (no shared-blob overwrite bug).
savePage({ ...pageA, rotation: 90 });
const pagesAfterRotate = listPages("doc-1");
assert.equal(pagesAfterRotate.find((p) => p.id === "page-1").rotation, 90);
assert.equal(pagesAfterRotate.find((p) => p.id === "page-2").rotation, 0);

// Selected page persists independently of document/page saves.
setSelectedPageId(jobId, "page-2");
assert.equal(getSelectedPageId(jobId), "page-2");

// Deleting a document removes it, all its pages, and clears selection if it pointed
// into the deleted document — this is the exact failure mode the legacy engine had.
deleteDocument(jobId, "doc-1");
assert.deepEqual(listDocuments(jobId), []);
assert.deepEqual(listPages("doc-1"), []);
assert.equal(getSelectedPageId(jobId), null);
assert.deepEqual(listAllPages(jobId), []);

// A second document's pages are unaffected by the first document's deletion.
const doc2 = { id: "doc-2", jobId, fileName: "other.pdf", originalFileUrl: "data:application/pdf;base64,BBBB", createdAt: new Date().toISOString() };
saveDocument(doc2);
savePages("doc-2", [{ ...pageA, id: "page-3", documentId: "doc-2" }]);
setSelectedPageId(jobId, "page-3");
saveDocument({ ...doc2, fileName: "renamed.pdf" });
assert.equal(getSelectedPageId(jobId), "page-3");
assert.equal(listPages("doc-2").length, 1);

// Legacy automatic exterior results are quarantined on load and never become
// active canvas geometry again.
{
  const legacyAuto = withPlanPageDefaults({
    ...pageA,
    id: "legacy-auto",
    exteriorWalls: {
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "s", aId: "a", bId: "b", source: "automatic", confirmed: true }],
      isClosed: true,
      confirmed: false,
      detectedSnapshot: { vertices: [], segments: [] },
      detectionConfidence: 88,
    },
  });
  assert.equal(legacyAuto.exteriorWalls, null);
  assert.equal(legacyAuto.legacyExteriorWalls.source, EXTERIOR_SOURCE_LEGACY_AUTO_DETECTOR);
}

// Genuine manual trace data is preserved and versioned as the active exterior
// workflow schema.
{
  const manual = withPlanPageDefaults({
    ...pageA,
    id: "manual-trace",
    exteriorWalls: {
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }],
      segments: [{ id: "s", aId: "a", bId: "b", source: "manual", confirmed: true }],
      isClosed: false,
      confirmed: false,
    },
  });
  assert.equal(manual.exteriorWalls.source, EXTERIOR_SOURCE_MANUAL_TRACE_V2);
  assert.equal(manual.exteriorWalls.vertices.length, 2);
  assert.equal(manual.exteriorWalls.segments.length, 1);
}

// A full localStorage quota surfaces a clear, actionable message instead of
// the raw browser DOMException text — this is what a real upload hits when
// too many plan PDFs have accumulated (see the screenshot this regression
// test was written from: "Failed to execute 'setItem' on 'Storage': ...
// exceeded the quota").
{
  const realStorage = globalThis.window.localStorage;
  globalThis.window.localStorage = {
    ...realStorage,
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
  };
  assert.throws(
    () => saveDocument({ id: "doc-3", jobId, fileName: "too-big.pdf", originalFileUrl: "data:application/pdf;base64,CCCC", createdAt: new Date().toISOString() }),
    /local storage is full/i
  );
  globalThis.window.localStorage = realStorage;
}

console.log("planStore.test.mjs passed");
