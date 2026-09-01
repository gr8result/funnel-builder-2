import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createJobData,
  getSavedFloorCoveringAreas,
  hasRecoverablePlanPages,
  prepareAiPlanTakeoffJobForSave,
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
assert.match(workbookSource, /initialJob:\s*selectAiPlanTakeoffJob\(sheet\.workbook\)/, "Takeoff page must choose the persisted takeoff job through the platform selector");
assert.match(workbookSource, /hasRecoverablePlanPages/, "Platform selector must prefer a takeoff job with recoverable embedded plan pages");
assert.match(workbookSource, /prepareAiPlanTakeoffJobForSave/, "Platform Save Job must create a revisioned atomic takeoff snapshot");

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
