import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createJobData,
  createPortableTakeoffExport,
  getSavedFloorCoveringAreas,
  hasRecoverablePlanPages,
  prepareAiPlanTakeoffJobForSave,
  resolvePortableTakeoffImport,
  resolveAiPlanTakeoffJobData,
  verifyAiPlanTakeoffSavedJob,
} from "../components/construction-estimation/ai-plan-takeoff/jobPersistence.js";
import {
  applyQuotePreviewRows,
  createJobSetupPayload,
  createQuotePreviewRows,
  createTakeoffSchedule,
} from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";

const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
assert.match(workbookSource, /page:\s*"aiPlanTakeoff"/, "Project Dashboard card must target aiPlanTakeoff");
assert.match(workbookSource, /<WorkspaceNavGroup pages=\{DASHBOARD_PROJECT_WORKFLOW_CARDS\}/, "Workspace left nav must render workflow cards");
assert.match(workbookSource, /<AIPlanTakeoffPage \{\.\.\.takeoffEngineContext\} \/>/, "aiPlanTakeoff page must mount integrated page entry");
assert.match(workbookSource, /platformContext:\s*\{[\s\S]*projectId:/, "Takeoff page must receive current project identity");
assert.match(workbookSource, /saveAiPlanTakeoffJob/, "Save Job must persist to the platform workbook");
assert.match(workbookSource, /initialJob:\s*null/, "AI Plan Takeoff must open empty instead of auto-loading the platform workbook takeoff");
assert.match(workbookSource, /hasRecoverablePlanPages/, "Platform selector must prefer a takeoff job with recoverable embedded plan pages");
assert.match(workbookSource, /prepareAiPlanTakeoffJobForSave/, "Platform Save Job must create a revisioned atomic takeoff snapshot");
assert.match(workbookSource, /RECENT TAKEOFF JOBS/, "AI Plan Takeoff File menu must show takeoff-only recent records");

const takeoffStandaloneSource = readFileSync("components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx", "utf8");
assert.match(takeoffStandaloneSource, /pdfjs-dist\/legacy\/build\/pdf\.mjs/, "Standalone AI Plan Takeoff must use the legacy PDF.js module build.");
assert.match(takeoffStandaloneSource, /PDFJS_WORKER_SRC = '\/pdfjs\/pdf\.worker\.min\.mjs'/, "Standalone AI Plan Takeoff must use the local PDF.js worker.");
assert.doesNotMatch(takeoffStandaloneSource, /cdnjs|jsdelivr|unpkg\.com\/pdfjs-dist/, "Standalone AI Plan Takeoff must not hard-code a PDF worker CDN.");
assert.match(takeoffStandaloneSource, /The local PDF engine could not start\. Your takeoff has not been changed\./, "PDF import failure must surface the safe local-engine failure.");
assert.match(takeoffStandaloneSource, /SAVE FAILED – DO NOT CLOSE THIS TAKEOFF/, "Failed save verification must show the required warning.");
assert.match(takeoffStandaloneSource, /gr8:ai-plan-takeoff:recovery:/, "Failed save verification must create a recovery snapshot.");
assert.match(takeoffStandaloneSource, /requireVerifiedSave/, "Standalone save UI must gate Saved status on read-back verification.");

const schedule = createTakeoffSchedule({
  projectInfo: { projectName: "Johnson", clientName: "Grant", siteAddress: "1 Build St" },
  planFilename: "johnson.pdf",
  totalPages: 2,
  currentPage: 1,
  pixelsPerMm: 1,
  completedFloorplans: [
    { id: "fp-1", page: 1, type: "Footprint", nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] },
    { id: "garage-1", page: 2, type: "Garage", nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] },
  ],
  completedWallRuns: [
    { id: "wall-1", page: 1, category: "exterior", lengthMm: 3000, thicknessMm: 230, nodes: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] },
  ],
  placedOpenings: [{ id: "window-1", page: 1, type: "window", subType: "standard", widthMm: 1000, heightMm: 1200 }],
  completedAreas: [{ id: "tiles-1", page: 1, category: "Tiles", nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] }],
  completedEaves: [{ id: "eave-1", page: 1, level: "Ground Floor", widthOption: "600", widthMm: 600, lengthMm: 10000 }],
});

const jobSetup = createJobSetupPayload(schedule);
assert.equal(jobSetup.projectName, "Johnson", "Job Setup receives project name");
assert.equal(jobSetup.siteAddress, "1 Build St", "Job Setup receives site address");
assert.ok(jobSetup.floorAreas.length > 0, "Job Setup receives measured floor areas");

const quoteRows = [{ id: "quote-ext", category: "External walls", description: "External walls", quantity: 1, unit: "LM", rate: 125, formula: "B10*F10" }];
const previewRows = createQuotePreviewRows(schedule, quoteRows, { "walls_External walls_Sheet 1": "quote-ext" });
assert.equal(previewRows.find((row) => row.destinationRowId === "quote-ext")?.status, "changed", "Changed takeoff is identified before quote update");

const updatedQuoteRows = applyQuotePreviewRows(quoteRows, previewRows);
assert.equal(updatedQuoteRows[0].quantity, 3, "Quote quantity updates from takeoff");
assert.equal(updatedQuoteRows[0].rate, 125, "Quote rate is protected");
assert.equal(updatedQuoteRows[0].formula, "B10*F10", "Quote formula is protected");

const savedJob = createJobData({
  name: "Johnson",
  currentPage: 1,
  totalPages: 2,
  planPages: [{ pageNumber: 1, dataUrl: "data:image/png;base64,one" }, { pageNumber: 2, dataUrl: "data:image/png;base64,two" }],
  completedWallRuns: [{ id: "wall-1", page: 1 }],
  platformProject: { projectId: "project-123", jobNumber: "J-001" },
  scheduleState: { scheduleMappings: { "walls_External walls_Sheet 1": "quote-ext" } },
});
assert.equal(savedJob.platformProject.projectId, "project-123", "Project ID is preserved in takeoff job");
assert.equal(savedJob.plan.pages.length, 2, "Plan pages are restored from saved platform takeoff job");
assert.equal(savedJob.completedWallRuns.length, 1, "Takeoff overlays are restored from saved platform takeoff job");

const fivePagePlan = Array.from({ length: 5 }, (_, index) => ({
  pageNumber: index + 1,
  dataUrl: `data:image/png;base64,page-${index + 1}`,
  width: 1200,
  height: 900,
  logicalWidth: 1200,
  logicalHeight: 900,
  renderScale: 1,
  vectorSegments: [],
}));

const lowerFloorCoverings = [
  {
    id: "tiles-lower-1",
    page: 1,
    pageId: 1,
    level: "Lower Floor",
    category: "Tiles",
    customCategoryName: "",
    nodes: [
      { x: 100, y: 100 },
      { x: 1100, y: 100 },
      { x: 1100, y: 900 },
      { x: 100, y: 900 },
    ],
    colour: { fill: "rgba(76, 175, 80, 0.35)", stroke: "#2e7d32", text: "#1b5e20" },
    displayColour: "rgba(76, 175, 80, 0.35)",
    label: "Tiles: 0.80 m2",
    notes: "wet areas",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:05:00.000Z",
  },
  {
    id: "hybrid-lower-angled",
    page: 1,
    pageId: 1,
    level: "Lower Floor",
    category: "Hybrid",
    nodes: [
      { x: 1200, y: 100 },
      { x: 1900, y: 100 },
      { x: 2050, y: 450 },
      { x: 1750, y: 900 },
      { x: 1200, y: 850 },
    ],
    colour: { fill: "rgba(33, 150, 243, 0.35)", stroke: "#1565c0", text: "#0d47a1" },
    displayColour: "rgba(33, 150, 243, 0.35)",
    label: "Hybrid: angled workshop",
    notes: "angled polygon",
    createdAt: "2026-09-01T00:10:00.000Z",
    updatedAt: "2026-09-01T00:15:00.000Z",
  },
];

const scheduleBeforeFloorCoveringSave = createTakeoffSchedule({
  projectInfo: { projectName: "Johnson", clientName: "Grant", siteAddress: "1 Build St" },
  planFilename: "johnson-five-page.pdf",
  totalPages: 5,
  currentPage: 1,
  pixelsPerMm: 1,
  completedAreas: lowerFloorCoverings,
});

const floorCoveringSavedJob = createJobData({
  name: "Johnson floor coverings",
  currentPage: 1,
  totalPages: 5,
  pixelsPerMm: 1,
  planPages: fivePagePlan,
  completedAreas: lowerFloorCoverings,
  completedWallRuns: [],
  placedOpenings: [],
  completedFloorplans: [],
  completedMeasurements: [],
  completedEaves: [],
  projectInfo: { projectName: "Johnson", clientName: "Grant", siteAddress: "1 Build St" },
  planFilename: "johnson-five-page.pdf",
  platformProject: { projectId: "project-123", jobNumber: "J-001" },
});

const reopenedPortableJob = JSON.parse(JSON.stringify(floorCoveringSavedJob));
const gr8TakeoffFile = createPortableTakeoffExport(floorCoveringSavedJob, {
  projectId: "project-123",
  projectName: "Johnson 123",
  takeoffName: "Johnson",
});
assert.equal(gr8TakeoffFile.gr8FileType, "ai-plan-takeoff", "Portable takeoff backup uses the .gr8takeoff file type marker");
assert.equal(gr8TakeoffFile.schemaVersion, 1, "Portable takeoff backup uses the versioned Gr8 takeoff schema");
assert.equal(resolvePortableTakeoffImport(gr8TakeoffFile).ok, true, "Portable .gr8takeoff backup imports successfully");
const restoredPortableFloorCoverings = getSavedFloorCoveringAreas(reopenedPortableJob);
assert.equal(reopenedPortableJob.plan.pages.length, 5, "Portable Save As job keeps all five embedded plan pages");
assert.equal(restoredPortableFloorCoverings.length, lowerFloorCoverings.length, "Portable Open Job restores every floor-covering polygon");
assert.deepEqual(restoredPortableFloorCoverings.map((area) => area.id), ["tiles-lower-1", "hybrid-lower-angled"], "Floor-covering IDs are stable");
assert.deepEqual(restoredPortableFloorCoverings[1].nodes, lowerFloorCoverings[1].nodes, "Angled floor-covering polygon points are restored exactly");
assert.equal(restoredPortableFloorCoverings[1].category, "Hybrid", "Floor-covering category is restored");
assert.equal(restoredPortableFloorCoverings[1].page, 1, "Floor-covering page ID is restored");
assert.equal(restoredPortableFloorCoverings[1].displayColour, "rgba(33, 150, 243, 0.35)", "Floor-covering colour is restored");
assert.equal(Number(restoredPortableFloorCoverings[1].areaM2.toFixed(6)), Number(floorCoveringSavedJob.completedAreas[1].areaM2.toFixed(6)), "Calculated angled area is restored");

const scheduleAfterPortableOpen = createTakeoffSchedule({
  projectInfo: reopenedPortableJob.projectInfo,
  planFilename: reopenedPortableJob.planFilename,
  totalPages: reopenedPortableJob.totalPages,
  currentPage: reopenedPortableJob.currentPage,
  pixelsPerMm: reopenedPortableJob.pixelsPerMm,
  completedAreas: restoredPortableFloorCoverings,
});
assert.deepEqual(
  scheduleAfterPortableOpen.projectTotals.floorFinishes,
  scheduleBeforeFloorCoveringSave.projectTotals.floorFinishes,
  "Portable Open Job regenerates matching floor-covering schedule totals from restored polygons"
);

const workbookWithPlatformTakeoff = {
  aiPlanTakeoffJob: floorCoveringSavedJob,
  takeoffEngine: { aiPlanTakeoffJob: floorCoveringSavedJob },
};
const platformWrappedPortableJob = {
  type: "estimate-builder-job",
  jobName: "Johnson 07-123",
  workbook: workbookWithPlatformTakeoff,
};
const resolvedWrappedTakeoffJob = resolveAiPlanTakeoffJobData(platformWrappedPortableJob);
assert.equal(resolvedWrappedTakeoffJob.plan.pages.length, 5, "Open Job unwraps platform job files to the embedded AI Plan Takeoff job");
assert.equal(resolvedWrappedTakeoffJob.completedAreas.length, 2, "Open Job unwrap preserves floor-covering polygons");

const restoredPlatformFloorCoverings = getSavedFloorCoveringAreas(
  workbookWithPlatformTakeoff.aiPlanTakeoffJob || workbookWithPlatformTakeoff.takeoffEngine.aiPlanTakeoffJob
);
assert.deepEqual(restoredPlatformFloorCoverings, restoredPortableFloorCoverings, "Platform workbook persistence restores the same floor-covering source polygons");

const scheduleAfterPlatformRestore = createTakeoffSchedule({
  projectInfo: workbookWithPlatformTakeoff.aiPlanTakeoffJob.projectInfo,
  planFilename: workbookWithPlatformTakeoff.aiPlanTakeoffJob.planFilename,
  totalPages: workbookWithPlatformTakeoff.aiPlanTakeoffJob.totalPages,
  currentPage: workbookWithPlatformTakeoff.aiPlanTakeoffJob.currentPage,
  pixelsPerMm: workbookWithPlatformTakeoff.aiPlanTakeoffJob.pixelsPerMm,
  completedAreas: restoredPlatformFloorCoverings,
});
assert.deepEqual(
  scheduleAfterPlatformRestore.projectTotals.floorFinishes,
  scheduleBeforeFloorCoveringSave.projectTotals.floorFinishes,
  "Platform workbook restore regenerates matching floor-covering schedule totals"
);

const partialSecondSave = createJobData({
  name: "Johnson floor coverings",
  currentPage: 1,
  totalPages: 5,
  pixelsPerMm: 1,
  baseRevision: 1,
  planPages: [],
  completedAreas: [
    lowerFloorCoverings[0],
    {
      ...lowerFloorCoverings[1],
      nodes: [
        { x: 1200, y: 100 },
        { x: 1900, y: 100 },
        { x: 2100, y: 500 },
        { x: 1750, y: 900 },
        { x: 1200, y: 850 },
      ],
      updatedAt: "2026-09-01T00:20:00.000Z",
    },
  ],
  completedWallRuns: floorCoveringSavedJob.completedWallRuns,
  placedOpenings: floorCoveringSavedJob.placedOpenings,
  completedFloorplans: [
    { id: "garage-floor-area", page: 1, type: "Garage", nodes: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 600, y: 300 }, { x: 0, y: 300 }] },
  ],
  completedMeasurements: floorCoveringSavedJob.completedMeasurements,
  completedEaves: floorCoveringSavedJob.completedEaves,
});
const firstRevision = prepareAiPlanTakeoffJobForSave(null, floorCoveringSavedJob, "project-123");
assert.equal(firstRevision.ok, true, "First Save Job prepares a verified revisioned snapshot");
assert.equal(firstRevision.job.revision, 1, "First Save Job starts revision tracking");
assert.equal(firstRevision.job.projectId, "project-123", "Revisioned Save Job records the platform project ID");
assert.equal(typeof firstRevision.job.contentChecksum, "string", "Revisioned Save Job stores a content checksum");

const secondRevision = prepareAiPlanTakeoffJobForSave(firstRevision.job, partialSecondSave, "project-123");
assert.equal(secondRevision.ok, true, "Second Save Job prepares from the latest base revision");
assert.equal(secondRevision.job.revision, 2, "Second Save Job increments the revision");
const atomicSecondSave = secondRevision.job;
assert.equal(atomicSecondSave.plan.pages.length, 5, "Repeated Save Job keeps all five embedded plan pages when incoming state is partial");
assert.equal(hasRecoverablePlanPages(atomicSecondSave), true, "Repeated Save Job keeps renderable dataUrl plan pages");
assert.deepEqual(atomicSecondSave.completedAreas[1].nodes, partialSecondSave.completedAreas[1].nodes, "Repeated Save Job applies changed floor-covering geometry");
assert.equal(atomicSecondSave.completedFloorplans.length, 1, "Repeated Save Job preserves other overlay changes from the incoming snapshot");
assert.equal(verifyAiPlanTakeoffSavedJob(atomicSecondSave, JSON.parse(JSON.stringify(atomicSecondSave))).ok, true, "Read-back verification accepts matching revision, counts and checksum");

const staleWrite = prepareAiPlanTakeoffJobForSave(atomicSecondSave, { ...partialSecondSave, baseRevision: 1 }, "project-123");
assert.equal(staleWrite.ok, false, "Older base revision cannot overwrite a newer saved takeoff job");
assert.equal(staleWrite.conflict, true, "Stale write returns an explicit conflict");

const staleSameTakeoffWithPlan = prepareAiPlanTakeoffJobForSave(
  atomicSecondSave,
  {
    ...atomicSecondSave,
    baseRevision: 1,
    completedMeasurements: [
      ...(atomicSecondSave.completedMeasurements || []),
      { id: "stale-ui-measurement", page: 1, label: "Verified stale UI save", lengthMm: 1200, nodes: [{ x: 0, y: 0 }, { x: 1200, y: 0 }] },
    ],
  },
  "project-123"
);
assert.equal(staleSameTakeoffWithPlan.ok, true, "Same takeoff with recoverable plan pages can save forward from a stale UI base revision");
assert.equal(staleSameTakeoffWithPlan.job.revision, 3, "Stale same-takeoff save advances from the durable revision");

const staleDifferentTakeoffWithPlan = prepareAiPlanTakeoffJobForSave(
  atomicSecondSave,
  {
    ...atomicSecondSave,
    takeoffId: "different-takeoff-id",
    baseRevision: 1,
  },
  "project-123"
);
assert.equal(staleDifferentTakeoffWithPlan.ok, false, "Stale save from a different takeoff ID remains blocked");

const mandatoryTemporaryTakeoff = createJobData({
  name: "Codex temporary save verification",
  currentPage: 1,
  totalPages: 5,
  pixelsPerMm: 1,
  planPages: fivePagePlan,
  completedFloorplans: [
    {
      id: "temporary-angled-area",
      page: 1,
      type: "Footprint",
      nodes: [
        { x: 100, y: 100 },
        { x: 460, y: 80 },
        { x: 560, y: 280 },
        { x: 210, y: 340 },
      ],
    },
  ],
  completedAreas: [
    {
      id: "temporary-floor-covering",
      page: 1,
      category: "Tiles",
      nodes: [
        { x: 140, y: 380 },
        { x: 420, y: 380 },
        { x: 420, y: 560 },
        { x: 140, y: 560 },
      ],
    },
  ],
  completedWallRuns: [
    { id: "temporary-wall-1", page: 1, category: "exterior", nodes: [{ x: 100, y: 650 }, { x: 420, y: 650 }], lengthMm: 320, thicknessMm: 230 },
    { id: "temporary-wall-2", page: 1, category: "interior", nodes: [{ x: 420, y: 650 }, { x: 620, y: 760 }], lengthMm: 228, thicknessMm: 90 },
  ],
  placedOpenings: [
    { id: "temporary-window-1", page: 1, type: "window", openingType: "window", widthMm: 1200, heightMm: 1200, x: 260, y: 650 },
    { id: "temporary-door-1", page: 1, type: "door", openingType: "door", widthMm: 820, heightMm: 2040, x: 520, y: 705 },
  ],
  completedMeasurements: [],
  completedEaves: [],
  projectInfo: { projectName: "Johnson temporary test", clientName: "Grant", siteAddress: "1 Build St" },
  planFilename: "SAMPLE PLANS.pdf",
  platformProject: { projectId: "project-123", jobNumber: "J-TEMP" },
});
const preparedTemporary = prepareAiPlanTakeoffJobForSave(null, mandatoryTemporaryTakeoff, "project-123");
assert.equal(preparedTemporary.ok, true, "Temporary mandatory takeoff save prepares successfully");
const readBackTemporary = JSON.parse(JSON.stringify(preparedTemporary.job));
const temporaryVerification = verifyAiPlanTakeoffSavedJob(preparedTemporary.job, readBackTemporary);
assert.equal(temporaryVerification.ok, true, "Temporary mandatory takeoff read-back verification passes");
assert.equal(temporaryVerification.revisionMatches, true, "Temporary save verification matches revision");
assert.equal(temporaryVerification.planPageCountMatches, true, "Temporary save verification requires all five plan pages");
assert.equal(temporaryVerification.countsMatch, true, "Temporary save verification matches takeoff counts");
assert.equal(temporaryVerification.checksumMatches, true, "Temporary save verification matches checksum");
assert.equal(readBackTemporary.completedFloorplans.length, 1, "Temporary read-back keeps one angled area");
assert.equal(readBackTemporary.completedAreas.length, 1, "Temporary read-back keeps one floor-covering polygon");
assert.equal(readBackTemporary.completedWallRuns.length, 2, "Temporary read-back keeps two walls");
assert.equal(readBackTemporary.placedOpenings.filter((opening) => opening.type === "window" || opening.openingType === "window").length, 1, "Temporary read-back keeps one window");
assert.equal(readBackTemporary.placedOpenings.filter((opening) => opening.type === "door" || opening.openingType === "door").length, 1, "Temporary read-back keeps one door");
assert.equal(Boolean(readBackTemporary.pixelsPerMm), true, "Temporary read-back keeps calibration");
const temporaryBackup = createPortableTakeoffExport(readBackTemporary, {
  projectId: "project-123",
  projectName: "Johnson temporary test",
  takeoffName: "Codex temporary save verification",
});
const temporaryBackupText = JSON.stringify(temporaryBackup);
assert.ok(temporaryBackupText.length > 0, "Temporary .gr8takeoff backup is non-zero");
const independentlyImportedTemporary = resolvePortableTakeoffImport(JSON.parse(temporaryBackupText));
assert.equal(independentlyImportedTemporary.ok, true, "Temporary .gr8takeoff backup imports independently");
assert.equal(independentlyImportedTemporary.job.plan.pages.length, 5, "Temporary imported backup restores all five plan pages");
assert.equal(independentlyImportedTemporary.job.completedFloorplans.length, 1, "Temporary imported backup restores the angled area");
assert.equal(independentlyImportedTemporary.job.completedAreas.length, 1, "Temporary imported backup restores the floor-covering polygon");
assert.equal(independentlyImportedTemporary.job.completedWallRuns.length, 2, "Temporary imported backup restores both walls");
assert.equal(independentlyImportedTemporary.job.placedOpenings.length, 2, "Temporary imported backup restores the window and door");

const reopenedAfterRuntimeClear = JSON.parse(JSON.stringify(atomicSecondSave));
delete reopenedAfterRuntimeClear.objectUrl;
for (const page of reopenedAfterRuntimeClear.plan.pages) {
  delete page.objectUrl;
}
assert.equal(reopenedAfterRuntimeClear.plan.pages.length, 5, "Reopen after clearing runtime Blob URL state still has all five pages");
assert.equal(
  reopenedAfterRuntimeClear.plan.pages.every((page) => typeof page.dataUrl === "string" && page.dataUrl.startsWith("data:image/png")),
  true,
  "All restored pages use durable data URLs, not temporary Blob URLs"
);
assert.equal(reopenedAfterRuntimeClear.completedAreas.length, 2, "Floor coverings remain after runtime state is cleared and project is reopened");

console.log("AI Plan Takeoff integration regression checks passed.");
