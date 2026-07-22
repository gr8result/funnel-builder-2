import assert from "node:assert/strict";
import {
  activeTakeoffPageId,
  countTakeoffPages,
  hasSavedTakeoffState,
  resolveTakeoffProject,
} from "./aiTakeoffPersistence.js";

const uploadedProject = {
  id: "tp-uploaded",
  jobId: "job-1",
  plans: [{ id: "plan-1", fileName: "plan.pdf" }],
  pages: [{ id: "page-1", imageDataUrl: "data:image/png;base64,pdf" }],
  updatedAt: "2026-07-05T00:00:00.000Z",
};

const deletedAndSavedProject = {
  ...uploadedProject,
  plans: [],
  pages: [],
  activePageId: null,
  selectedPageId: null,
  measurements: [],
  areas: [],
  scale: null,
  orientation: null,
  updatedAt: "2026-07-05T00:01:00.000Z",
};

const staleLocalStorageLoader = () => uploadedProject;

assert.equal(hasSavedTakeoffState(deletedAndSavedProject), true);

const resolvedAfterReload = resolveTakeoffProject(deletedAndSavedProject, "job-1", {
  loadByJobId: staleLocalStorageLoader,
});

assert.equal(countTakeoffPages(resolvedAfterReload), 0);
assert.equal(activeTakeoffPageId(resolvedAfterReload), null);
assert.deepEqual(resolvedAfterReload.plans, []);
assert.deepEqual(resolvedAfterReload.pages, []);
assert.deepEqual(resolvedAfterReload.measurements, []);
assert.deepEqual(resolvedAfterReload.areas, []);
assert.equal(resolvedAfterReload.scale, null);
assert.equal(resolvedAfterReload.orientation, null);

const resolvedWithoutWorkbookState = resolveTakeoffProject(null, "job-1", {
  loadByJobId: staleLocalStorageLoader,
});

assert.equal(countTakeoffPages(resolvedWithoutWorkbookState), 0);
assert.equal(activeTakeoffPageId(resolvedWithoutWorkbookState), null);
assert.deepEqual(resolvedWithoutWorkbookState.plans, []);
assert.deepEqual(resolvedWithoutWorkbookState.pages, []);

console.log("ai takeoff persistence tests passed");
