import assert from "node:assert/strict";
import { createPlanDocument, createPlanPage } from "../core/types.js";
import { listDocuments, listPages, saveDocument, savePage, savePages, setSelectedPageId, getSelectedPageId } from "../persistence/planStore.js";

const store = new Map();
global.window = {
  localStorage: {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
};

const document = createPlanDocument({ id: "doc1", jobId: "job1", fileName: "plan.pdf", fileSize: 1 });
saveDocument({ ...document, rasterImage: "large-asset" });
assert.equal(listDocuments("job1")[0].rasterImage, undefined, "large document assets are not persisted in localStorage");

const page = createPlanPage({ id: "page1", documentId: "doc1", pageNumber: 1, sourceWidth: 100, sourceHeight: 100 });
savePages("doc1", [page]);
savePage({
  ...page,
  rotation: 90,
  rasterImage: "large-page-asset",
  geometry: {
    points: [{ id: "a", x: 0, y: 0 }],
    walls: [],
    openings: [],
  },
});

const savedPage = listPages("doc1")[0];
assert.equal(savedPage.rotation, 90, "rotation persists per page");
assert.equal(savedPage.rasterImage, undefined, "large page assets are not persisted in localStorage");
assert.equal(savedPage.geometry.points.length, 1, "TakeoffGeometry persists per page");
assert.equal(savedPage.version, 3, "version persists");

setSelectedPageId("job1", "page1");
assert.equal(getSelectedPageId("job1"), "page1");

console.log("takeoff-v3 persistence.test.mjs passed");
