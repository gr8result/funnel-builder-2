import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const mappingSource = source.slice(source.indexOf("function applyJobDetailsToWorkbook("), source.indexOf("function createBlankPreviewWorkbook("));
const applyProject = new Function("normalizeWorkbook", `${mappingSource}; return applyWorkspaceProjectToWorkbook;`)((value) => value);
const project = { id: "project-1", workspace_id: "workspace-1", project_name: "Old project", client_name: "Old client", site_address: "Old address", source_quote_number: "OLD-1" };
const workbook = {
  jobId: "job-1",
  data: { inputDataSheet: { rows: {
    projectName: { value: "Edited project" }, clientName: { value: "Edited client" },
    projectAddress: { value: "Edited address" }, quoteNumber: { value: "NEW-2" },
    marginPercent: { value: "23" }, notes: { value: "" },
  } } },
  clientPage: { clientName: "Proposal client", projectAddress: "Proposal address", quoteNumber: "PROPOSAL-3" },
  jobFileMeta: { customMetadata: "keep" },
};
const original = structuredClone(workbook);
const reopened = applyProject(workbook, project, "2026-09-07T00:00:00.000Z");
assert.deepEqual(reopened.data, original.data, "Reopening must preserve saved Job Setup fields");
assert.deepEqual(reopened.clientPage, original.clientPage, "Reopening must preserve saved proposal fields");
assert.equal(reopened.jobFileMeta.customMetadata, "keep");
assert.equal(reopened.registeredJob.jobName, "Edited project");
assert.equal(reopened.registeredJob.clientName, "Edited client");
assert.equal(reopened.registeredJob.siteAddress, "Edited address");
assert.equal(reopened.projectId, project.id);
assert.equal(reopened.jobId, workbook.jobId, 'Commercial registration must not replace the permanent master job ID');
assert.equal(reopened.registeredJob.workspaceId, project.workspace_id);
assert.deepEqual(workbook, original, "Reopening must not mutate its source");
const cleared = structuredClone(workbook);
cleared.data.inputDataSheet.rows.clientName.value = "";
assert.equal(applyProject(cleared, project).data.inputDataSheet.rows.clientName.value, "", "An intentionally cleared field must stay empty");
assert.equal(applyProject(cleared, project).registeredJob.clientName, "");
console.log("PASS saved Job Setup fields, cleared values, proposal content and metadata survive project reopening.");

// Exercise the actual open workflow with storage dependencies isolated.
const openSource = source.slice(source.indexOf("  async function openWorkspaceProjectJob("), source.indexOf("  async function loadJobFileData("));
const savedRecord = { key: "job:job-1", type: "job", revision: 8, checksum: "verified-checksum", savedAt: "2026-09-07T00:00:00.000Z", workbook };
const writes = [];
let openedWorkbook;
const deps = {
  loadStoredJob: async () => structuredClone(savedRecord),
  loadLatestWorkspaceProjectWorkbookSnapshot: async () => { throw new Error("Unexpected older snapshot fallback"); },
  isCorruptEstimateJobWorkbook: () => false,
  ESTIMATE_BUILDER_PAGE_KEYS: new Set(["dataInput"]),
  workbookRef: { current: { page: "dataInput" } },
  completedJobLoadVersionRef: { current: 0 },
  collectSavedJobPackageSections: (value) => value,
  restoreSavedJobPackageSections: (value) => value,
  applyTemplateDefaultsToJob: async (value) => value,
  migrateWorkbookToMasterTemplate: (value) => value,
  normalizeWorkbook: (value) => value,
  applyWorkspaceProjectToWorkbook: applyProject,
  prepareWorkbookForJobSave: (value) => value,
  workbookJobKey: (value) => `job:${value.jobId}`,
  workbookJobName: () => "Saved job",
  putStoredJobRecord: async (record) => writes.push(record),
  saveStoredJob: async (record) => writes.push(record),
  setActiveStoredJob: async (record) => assert.deepEqual(record, savedRecord),
  saveExplicitActiveJobSessionKey: () => {}, rememberRecentJob: () => {}, rememberRecentEstimateFile: () => {},
  setRecentJobs: () => {}, loadRecentEstimateJobs: () => [], setRecentEstimateFiles: () => {}, loadRecentEstimateFiles: () => [],
  setWorkbook: (value) => { openedWorkbook = value; }, setActiveWorkbookPage: () => {}, setLastSavedAt: () => {}, saveActiveWorkspaceProjectPointer: () => {},
  openProjectJobFailure: (details) => ({ ok: false, ...details }),
  console: { error: () => {} },
};
const makeOpen = () => new Function(...Object.keys(deps), `${openSource}; return openWorkspaceProjectJob;`)(...Object.values(deps));
const summary = { projectId: project.id, workspaceId: project.workspace_id, localJobKey: savedRecord.key, rawProject: project };
assert.equal((await makeOpen()(summary)).ok, true);
assert.equal(deps.completedJobLoadVersionRef.current, 1, 'Successful opens rehydrate the module workspace once');
assert.deepEqual(openedWorkbook.data, original.data);
assert.deepEqual(writes, [], "Opening a local job must not overwrite its saved record or reset its revision");
deps.loadStoredJob = async () => { throw new Error("Local storage is busy"); };
assert.equal((await makeOpen()(summary)).message, "Local storage is busy", "Local read errors must not fall back to older snapshots");
assert.equal(deps.completedJobLoadVersionRef.current, 1, 'Failed opens must retain the current module workspace');
assert.deepEqual(writes, []);
console.log("PASS project reopening preserves verified local records and surfaces local read failures.");
