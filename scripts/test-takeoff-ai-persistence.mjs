import assert from 'node:assert/strict';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { createAiTakeoffDevelopmentFixture } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/developmentFixture.js';
import { fingerprintTakeoffDocument } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/documentIdentity.js';
import {
  createJobData, createTakeoffContentChecksum, prepareAiPlanTakeoffJobForSave,
  createPortableTakeoffExport, resolvePortableTakeoffImport, verifyAiPlanTakeoffSavedJob,
} from '../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

const pages = [{ pageNumber: 1, dataUrl: 'data:image/png;base64,fixture-content', width: 800, height: 600, logicalWidth: 800, logicalHeight: 600, renderScale: 1, vectorSegments: [] }];
const documentHash = await fingerprintTakeoffDocument(pages);
assert.equal(await fingerprintTakeoffDocument(structuredClone(pages)), documentHash, 'Document identity survives JSON/page object recreation.');
assert.notEqual(await fingerprintTakeoffDocument([{ ...pages[0], dataUrl: 'data:image/png;base64,different-content' }]), documentHash, 'A different image with identical dimensions is another document.');
assert.notEqual(await fingerprintTakeoffDocument([{ ...pages[0], logicalWidth: 801 }]), documentHash, 'Coordinate-space changes invalidate identity.');
await assert.rejects(() => fingerprintTakeoffDocument([{ ...pages[0], dataUrl: undefined, dataUrlAssetId: 'unresolved' }]), /Restore all plan images/);

const context = { jobId: 'phase1-test-job', takeoffId: 'phase1-test-takeoff', documentHash, pixelsPerMm: 0.1, pages, completedWallRuns: [] };
const input = createAiTakeoffDevelopmentFixture(context, 1);
const ai = convertAiTakeoffDetections(input, context);
const manual = { id: 'manual-keep', page: 1, nodes: [{ x: 20, y: 20 }, { x: 100, y: 20 }], category: 'interior', thicknessMm: 70, alignment: 'outer', lengthMm: 800, exteriorType: '', linedFaces: 2, openingDeductionsEnabled: true, wallHeightM: null };
const receipt = { jobId: context.jobId, takeoffId: context.takeoffId, documentHash, runId: input.runId };
const makeJob = (walls, receipts = []) => createJobData({
  name: 'AI persistence acceptance', takeoffId: context.takeoffId, associatedProjectId: context.jobId,
  currentPage: 1, totalPages: 1, rotation: 0, pixelsPerMm: 0.1, planPages: pages,
  ...ai, completedWallRuns: walls, sheetLevels: { 1: 'Ground Floor' },
  scheduleState: receipts.length ? { aiAppliedRuns: receipts } : {},
});
const legacy = makeJob([manual]);
const legacyHash = createTakeoffContentChecksum(legacy);
assert.equal(createTakeoffContentChecksum({ ...legacy, scheduleState: { aiAppliedRuns: [] } }), legacyHash, 'Empty receipt state does not alter legacy checksums.');
const job = makeJob([manual, ...ai.completedWallRuns], [receipt]);
const prepared = prepareAiPlanTakeoffJobForSave(null, job, context.jobId).job;
const copy = structuredClone(prepared);
assert.equal(verifyAiPlanTakeoffSavedJob(prepared, copy).ok, true);
assert.deepEqual(copy.completedWallRuns[0], manual, 'Canonical preparation preserves the original manual wall.');
assert.deepEqual(copy.completedWallRuns.filter((wall) => wall.source === 'ai'), ai.completedWallRuns);
assert.deepEqual(copy.placedOpenings, ai.placedOpenings);

const exported = createPortableTakeoffExport(copy);
const imported = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(exported)));
assert.equal(imported.ok, true);
assert.deepEqual(imported.job.completedWallRuns, job.completedWallRuns);
assert.deepEqual(imported.job.placedOpenings[0].ai, ai.placedOpenings[0].ai);
assert.equal(imported.job.placedOpenings[0].confidence, 0.9);
assert.deepEqual(imported.job.scheduleState.aiAppliedRuns, [receipt]);

// Receipt integrity matters even after the last object from a run is deleted.
const deleted = { ...makeJob([manual], [receipt]), placedOpenings: [] };
const persistedDeletion = prepareAiPlanTakeoffJobForSave(prepared, { ...deleted, baseRevision: prepared.revision }, context.jobId).job;
const reopened = resolvePortableTakeoffImport(JSON.parse(JSON.stringify(createPortableTakeoffExport(persistedDeletion)))).job;
assert.deepEqual(reopened.completedWallRuns, [manual]);
assert.deepEqual(reopened.placedOpenings, []);
assert.deepEqual(reopened.scheduleState.aiAppliedRuns, [receipt]);
const lostReceipt = structuredClone(persistedDeletion);
lostReceipt.scheduleState.aiAppliedRuns = [];
delete lostReceipt.contentChecksum;
assert.equal(verifyAiPlanTakeoffSavedJob(persistedDeletion, lostReceipt).ok, false, 'Lost receipts fail checksum verification even when object counts match.');
console.log('AI Takeoff document identity, canonical persistence, provenance and replay-receipt checks passed.');
