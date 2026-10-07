import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import "./register-json-loader.mjs";
import { restoreCompleteWorkbook, PROTECTED_RECOVERY_JOB_KEY, jobContentSignature } from "../lib/construction-estimation/jobPersistence.js";

const { createEstimateBuilderWorkbookDefaults } = await import("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js");
const { normalizeTakeoffInputSection } = await import("../lib/construction-estimation/takeoffInputRows.js");
const { V4_DATA_SECTIONS } = await import("../lib/construction-estimation/estimateWorksheetV4Schema.js");
const source = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const tree = ts.createSourceFile("hook.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
const sectionKeys = source.slice(source.indexOf("const SAVED_JOB_PACKAGE_SECTION_KEYS = ["), source.indexOf("function hasOwnJobPackageValue("));
const functionNames = [
  "loadJobFileData", "describeWorkbookIdentity", "describeJobFileIdentity", "workbookAttachedProjectId", "dataValue",
  "recoveredWorkingCopyProjectId", "slug", "isCorruptEstimateJobFileName", "isCorruptEstimateJobWorkbook", "isCorruptEstimateJobText",
  "collectSavedJobPackageSections", "hasOwnJobPackageValue", "restoreSavedJobPackageSections",
  "migrateWorkbookToMasterTemplate", "applyTemplateDefaultsToJob", "normalizeWorkbook", "workbookHasExplicitJobIdentity",
  "workbookJobKey", "prepareWorkbookForJobSave", "compactWorkbookForStorage", "takeoffPersistenceCounts",
];
const definitions = sectionKeys + functionNames.map((name) => {
  assert.ok(functions.has(name), `Missing actual loader helper ${name}`);
  return functions.get(name);
}).join("\n");
const persistenceSource = fs.readFileSync("lib/construction-estimation/jobPersistence.js", "utf8");
const { validateJobWorkbook: validate } = await import("../lib/construction-estimation/jobPersistence.js");

// Execute the actual loader and its actual data transformations. Only storage,
// logging and React setters are isolated; no browser or existing job is modified.
function harness() {
  const state = {};
  const dependencies = {
    createEstimateBuilderWorkbookDefaults, normalizeTakeoffInputSection, V4_DATA_SECTIONS, restoreCompleteWorkbook, PROTECTED_RECOVERY_JOB_KEY,
    workbookRef: { current: {} }, workbookLoadOperationRef: { current: 0 }, autosavePausedRef: { current: false },
    MASTER_TEMPLATE_KEY: "template:master-estimate-template", MASTER_TEMPLATE_NAME: "Master Estimate Template",
    CORRUPT_ESTIMATE_JOB_FILE_NAME: "estimate-job.json", estimateBuilderLog: () => {},
    saveJobBackup: async () => {}, saveLocalDraftMetadata: () => {},
    saveVerifiedStoredJob: async (workbook) => { validate(workbook); state.saved = workbook; return { ok: true }; },
    saveExplicitActiveJobSessionKey: (key) => { state.activeKey = key; },
    setWorkbook: (workbook) => { state.loaded = workbook; },
    setActiveWorkbookPage: () => {}, resolveLastActiveWorkbookPage: (workbook) => workbook.page, setLastSavedAt: () => {},
    rememberRecentJob: () => {}, rememberRecentEstimateFile: () => {}, setRecentJobs: () => {}, setRecentEstimateFiles: () => {},
    loadRecentEstimateJobs: () => [], loadRecentEstimateFiles: () => [],
  };
  const helpers = new Function(...Object.keys(dependencies), `${definitions}; return { loadJobFileData, collectSavedJobPackageSections, restoreSavedJobPackageSections };`)(...Object.values(dependencies));
  return { ...helpers, state };
}

const documentBytes = "data:application/pdf;base64," + "QUJD".repeat(25000);
const rootBuilder = { pages: [{ id: "root", blocks: [{ dataUrl: documentBytes, unknown: { keep: true } }] }], extension: "root-value" };
const legacyBuilder = { importedDocuments: { plan: { bytes: documentBytes } }, pages: [], extension: "legacy-value" };
const base = { jobId: "restore-document-test", projectId: "restore-document-test", clientPage: { customClientField: "preserve" }, futureModule: { data: [0, false, ""] } };
const cases = [
  ["root-only", { ...base, projectEstimateBuilder: rootBuilder }],
  ["legacy-only", { ...base, clientPage: { ...base.clientPage, proposalBuilder: legacyBuilder } }],
  ["both-independent", { ...base, projectEstimateBuilder: rootBuilder, clientPage: { ...base.clientPage, proposalBuilder: legacyBuilder } }],
  ["explicit-empty", { ...base, projectEstimateBuilder: null, clientPage: { ...base.clientPage, proposalBuilder: null } }],
];
for (const [name, workbook] of cases) {
  const original = structuredClone(workbook);
  const test = harness();
  const preserved = test.collectSavedJobPackageSections(workbook);
  const migrated = structuredClone(workbook);
  if (Object.hasOwn(workbook, "projectEstimateBuilder")) migrated.projectEstimateBuilder = { wrong: true };
  if (Object.hasOwn(workbook.clientPage, "proposalBuilder")) migrated.clientPage.proposalBuilder = { wrong: true };
  const restored = test.restoreSavedJobPackageSections(migrated, preserved);
  assert.deepEqual(restored, original, `${name}: saved locations and independent values must survive restoration`);
  assert.equal(restored.projectEstimateBuilder, workbook.projectEstimateBuilder, `${name}: preservation must not clone embedded documents`);
  assert.equal(restored.clientPage.proposalBuilder, workbook.clientPage.proposalBuilder, `${name}: legacy documents retain their existing content reference`);
  assert.equal(JSON.stringify(restored).length, JSON.stringify(original).length, `${name}: restoration must not inflate the workbook`);

  const result = await test.loadJobFileData({ workbook, projectEstimate: workbook.projectEstimateBuilder || workbook.clientPage.proposalBuilder }, "Document.gr8job");
  assert.equal(result.ok, true);
  for (const output of [test.state.saved, test.state.loaded]) {
    assert.equal(Object.hasOwn(output, "projectEstimateBuilder"), Object.hasOwn(workbook, "projectEstimateBuilder"), `${name}: keep root location presence`);
    assert.equal(Object.hasOwn(output.clientPage, "proposalBuilder"), Object.hasOwn(workbook.clientPage, "proposalBuilder"), `${name}: keep legacy location presence`);
    assert.deepEqual(output.projectEstimateBuilder, workbook.projectEstimateBuilder);
    assert.deepEqual(output.clientPage.proposalBuilder, workbook.clientPage.proposalBuilder);
    assert.deepEqual(output.futureModule, workbook.futureModule);
    assert.equal(output.clientPage.customClientField, "preserve");
  }
  assert.deepEqual(workbook, original, `${name}: opening must not mutate the selected file`);
}
const packageOnly = harness();
await packageOnly.loadJobFileData({ workbook: base, projectEstimate: rootBuilder }, "Package only.gr8job");
assert.deepEqual(packageOnly.state.saved.projectEstimateBuilder, rootBuilder);
assert.equal(Object.hasOwn(packageOnly.state.saved.clientPage, "proposalBuilder"), false, "A section-only document should be imported once");
console.log("PASS actual job loader preserves root-only, legacy-only, independent dual documents, empty values, unknown fields and document bytes without adding aliases.");

const fixtureIndex = process.argv.indexOf("--fixture");
if (fixtureIndex >= 0) {
  const fixturePath = process.argv[fixtureIndex + 1];
  const { readJob } = await import("../lib/jobFile.ts");
  const start = performance.now();
  const bytes = fs.readFileSync(fixturePath);
  const parsed = await readJob(new File([bytes], "Existing.gr8job"));
  const beforeBytes = jobContentSignature(parsed.workbook).length;
  const test = harness();
  assert.equal((await test.loadJobFileData(parsed, "Existing.gr8job")).ok, true);
  const afterBytes = jobContentSignature(test.state.saved).length;
  assert.equal(Object.hasOwn(test.state.saved.clientPage, "proposalBuilder"), Object.hasOwn(parsed.workbook.clientPage, "proposalBuilder"));
  assert.deepEqual(test.state.saved.projectEstimateBuilder, parsed.workbook.projectEstimateBuilder);
  assert.ok(afterBytes < beforeBytes + 100000, "Opening the original fixture must not add another copy of its document");
  console.log(JSON.stringify({ fixture: fixturePath, archiveBytes: bytes.length, workbookBeforeChars: beforeBytes, workbookAfterChars: afterBytes, jobId: test.state.saved.jobId, elapsedMs: Math.round(performance.now() - start) }));
}
