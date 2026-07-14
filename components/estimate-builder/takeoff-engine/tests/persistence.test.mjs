import assert from "node:assert/strict";
import { buildPolygonArea, createDistanceMeasurement } from "../core/measurement.js";
import { createScaleCalibration } from "../core/scale.js";
import { createRasterPage, createTakeoffDocument, TOOL_IDS } from "../core/types.js";
import { confirmOrientation } from "../core/orientation.js";
import { TAKEOFF_ACTIONS, takeoffReducer } from "../state/takeoffReducer.js";
import {
  createTakeoffCacheSnapshot,
  getTakeoffPersistenceDiagnostics,
  hydrateTakeoffStateFromWorkbook,
  TAKEOFF_ENGINE_STORAGE_KEY,
  hydrateTakeoffState,
  loadTakeoffStateFromStorage,
  saveTakeoffStateToStorage,
  serializeTakeoffState,
} from "../state/takeoffPersistence.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

const storage = createMemoryStorage();
const emptyState = createTakeoffDocument({ id: "empty", name: "Empty project" });
const emptySerialized = saveTakeoffStateToStorage(storage, emptyState);
const reloadedEmpty = loadTakeoffStateFromStorage(storage);

assert.equal(typeof emptySerialized, "string");
assert.equal(reloadedEmpty.pages.length, 0);
assert.equal(reloadedEmpty.activePageId, null);

const scale = createScaleCalibration({
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  realDistanceMm: 1000,
});
const measurement = createDistanceMeasurement({
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  scale,
  label: "Reference",
});
const area = buildPolygonArea({
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ],
  scale,
  label: "Room",
});
const page = createRasterPage({
  id: "page-1",
  sourceType: "image",
  sourceFileName: "plan.png",
  imageDataUrl: "data:image/png;base64,abc",
  imageWidth: 4200,
  imageHeight: 2970,
  scale,
  measurements: [measurement],
  areas: [area],
  orientation: confirmOrientation({
    metadataRotation: 0,
    detectedRotation: 0,
    userRotation: 0,
    confidence: "manual",
    orientationConfirmed: false,
  }),
});
const project = createTakeoffDocument({
  id: "project-1",
  name: "Project",
  pages: [page],
  activePageId: "page-1",
});

saveTakeoffStateToStorage(storage, project);
assert.equal(storage.getItem(TAKEOFF_ENGINE_STORAGE_KEY).includes("page-1"), true);

const loaded = loadTakeoffStateFromStorage(storage);
assert.equal(loaded.pages.length, 1);
assert.equal(loaded.activePageId, "page-1");
assert.equal(loaded.pages[0].imageWidth, 4200);

assert.equal(loaded.pages[0].measurements.length, 1);
assert.equal(loaded.pages[0].measurements[0].label, "Reference");
assert.deepEqual(loaded.pages[0].measurements[0].pointA, { x: 0, y: 0 });
assert.equal(Math.round(loaded.pages[0].measurements[0].lengthMm), 1000);

assert.equal(loaded.pages[0].areas.length, 1);
assert.equal(loaded.pages[0].areas[0].label, "Room");
assert.deepEqual(loaded.pages[0].areas[0].points[2], { x: 100, y: 50 });
assert.equal(Math.round(loaded.pages[0].areas[0].areaMm2), 500000);

assert.equal(loaded.pages[0].orientation.orientationConfirmed, true);
assert.equal(loaded.pages[0].orientation.confidence, "confirmed");

const deletedFinalPage = takeoffReducer(project, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-1" },
});
assert.equal(deletedFinalPage.pages.length, 0);
assert.equal(deletedFinalPage.activePageId, null);

const deletedSerialized = saveTakeoffStateToStorage(storage, deletedFinalPage);
const deletedReloaded = hydrateTakeoffState(deletedSerialized);
assert.equal(deletedReloaded.pages.length, 0);
assert.equal(deletedReloaded.activePageId, null);

const directSerialized = serializeTakeoffState(deletedFinalPage);
assert.equal(hydrateTakeoffState(directSerialized).pages.length, 0);

const pageA = createRasterPage({
  id: "page-a",
  sourceFileName: "A.png",
  imageDataUrl: "data:image/png;base64,a",
  imageWidth: 100,
  imageHeight: 100,
});
const pageB = createRasterPage({
  id: "page-b",
  sourceFileName: "B.png",
  imageDataUrl: "data:image/png;base64,b",
  imageWidth: 100,
  imageHeight: 100,
});
const pageC = createRasterPage({
  id: "page-c",
  sourceFileName: "C.png",
  imageDataUrl: "data:image/png;base64,c",
  imageWidth: 100,
  imageHeight: 100,
});

const threePageProject = createTakeoffDocument({
  id: "three-pages",
  pages: [pageA, pageB, pageC],
  activePageId: "page-a",
  activeTool: TOOL_IDS.MEASURE,
});

const deleteFirst = takeoffReducer(threePageProject, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-a" },
});
assert.deepEqual(deleteFirst.pages.map((item) => item.id), ["page-b", "page-c"]);
assert.equal(deleteFirst.activePageId, "page-b");

const middleActiveProject = createTakeoffDocument({
  id: "middle-active",
  pages: [pageA, pageB, pageC],
  activePageId: "page-b",
});
const deleteMiddle = takeoffReducer(middleActiveProject, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-b" },
});
assert.deepEqual(deleteMiddle.pages.map((item) => item.id), ["page-a", "page-c"]);
assert.equal(deleteMiddle.activePageId, "page-c");

const finalActiveProject = createTakeoffDocument({
  id: "final-active",
  pages: [pageA, pageB, pageC],
  activePageId: "page-c",
});
const deleteLast = takeoffReducer(finalActiveProject, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-c" },
});
assert.deepEqual(deleteLast.pages.map((item) => item.id), ["page-a", "page-b"]);
assert.equal(deleteLast.activePageId, "page-b");

const singlePageWithTool = createTakeoffDocument({
  id: "single",
  pages: [pageA],
  activePageId: "page-a",
  activeTool: TOOL_IDS.AREA,
});
const deleteOnly = takeoffReducer(singlePageWithTool, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-a" },
});
assert.equal(deleteOnly.pages.length, 0);
assert.equal(deleteOnly.activePageId, null);
assert.equal(deleteOnly.activeTool, TOOL_IDS.SELECT);

saveTakeoffStateToStorage(storage, deleteOnly);
const reloadAfterFinalDelete = loadTakeoffStateFromStorage(storage);
assert.equal(reloadAfterFinalDelete.pages.length, 0);
assert.equal(reloadAfterFinalDelete.activePageId, null);

saveTakeoffStateToStorage(storage, deleteMiddle);
const reloadAfterMiddleDelete = loadTakeoffStateFromStorage(storage);
assert.deepEqual(reloadAfterMiddleDelete.pages.map((item) => item.id), ["page-a", "page-c"]);
assert.equal(reloadAfterMiddleDelete.activePageId, "page-c");

const workbookWithUploadedPlan = createTakeoffDocument({
  id: "workbook-owned",
  pages: [page],
  activePageId: "page-1",
});
const staleCacheSnapshot = createTakeoffCacheSnapshot(workbookWithUploadedPlan);
assert.equal(hydrateTakeoffState(staleCacheSnapshot).pages.length, 1);

const workbookAfterDelete = takeoffReducer(workbookWithUploadedPlan, {
  type: TAKEOFF_ACTIONS.DELETE_PAGE,
  payload: { pageId: "page-1" },
});
assert.equal(workbookAfterDelete.pages.length, 0);
assert.equal(workbookAfterDelete.activePageId, null);

const reloadedFromWorkbook = hydrateTakeoffStateFromWorkbook(workbookAfterDelete);
assert.equal(reloadedFromWorkbook.pages.length, 0);
assert.equal(reloadedFromWorkbook.activePageId, null);
assert.equal(reloadedFromWorkbook.pages.some((item) => item.id === "page-1"), false);

const diagnosticsAfterSave = getTakeoffPersistenceDiagnostics({
  workbookState: workbookAfterDelete,
  reducerState: workbookAfterDelete,
  localStorageState: hydrateTakeoffState(createTakeoffCacheSnapshot(workbookAfterDelete)),
  indexedDBState: workbookAfterDelete,
  reactState: workbookAfterDelete,
});
assert.deepEqual(diagnosticsAfterSave, {
  workbookPages: 0,
  reducerPages: 0,
  localStoragePages: 0,
  indexedDBPages: 0,
  reactPages: 0,
});
assert.equal(workbookAfterDelete.pages.length, 0);

console.log("persistence tests passed");
