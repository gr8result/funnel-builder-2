import assert from "node:assert/strict";
import { createJobSetupImportPreview, applyJobSetupImport, describeProjectMismatch } from "../lib/construction-estimation/jobSetupTakeoffImport.js";
import { V4_DATA_SECTIONS } from "../lib/construction-estimation/estimateWorksheetV4Schema.js";
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

function workbook() {
  return {
    projectId: "project-a",
    registeredJob: { id: "project-a", projectName: "Existing job" },
    formulas: { ...V4_DEFAULT_FORMULAS },
    data: {
      inputDataSheet: {
        collapsed: false,
        hiddenRows: [],
        rows: Object.fromEntries(V4_DATA_SECTIONS.find((section) => section.key === "inputDataSheet").rows.map((row) => [row.key, { value: "", notes: "Keep the estimator's note" }])),
      },
      subcontractorQuotes: { rows: { plumber: { value: 4000 } } },
    },
    windowsDoors: [],
    quotation: {
      "CONCRETE SLAB": {
        rows: [{ id: "quote-30044", section: "CONCRETE SLAB", item: "TOTAL GROUND FLOOR AREA", quantity: "", quantityKey: "lowerSlabAreaM2", unit: "M2", excelRate: "$125.00", sourceOfRate: "workbook", active: true }],
      },
    },
    takeoffEngine: { quoteMappings: { slab: "quote-30044" }, aiPlanTakeoffJob: { id: "takeoff-a", planPages: [{ id: "plan-1" }], walls: [{ id: "wall-1" }] } },
  };
}

function payload(fields, extra = {}) {
  return {
    dataInputFields: fields,
    mappingPreview: Object.entries(fields).map(([destinationKey, value]) => ({ destinationKey, value, source: `Measured ${destinationKey}` })),
    provenance: { projectId: "project-a", takeoffId: "takeoff-a", revision: 3, transferredAt: "2026-09-10T02:00:00.000Z" },
    warnings: [],
    ...extra,
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const original = deepFreeze(workbook());
const firstPayload = deepFreeze(payload({ projectName: "Measured home", lowerFloorAreaM2: 140.5, lowerGarageAreaM2: 36, lowerAlfrescoAreaM2: 0, upperFloorAreaM2: 82, floorCount: "Two storey", lowerExternalWallsLm: 50, lowerCeilingHeight: 2.7 }));
const firstPreview = createJobSetupImportPreview(original, firstPayload);
assert.equal(firstPreview.warnings.length, 0);
assert.ok(firstPreview.rows.every((row) => row.status === "new" && row.selected));
assert.equal(firstPreview.rows.find((row) => row.destinationKey === "lowerAlfrescoAreaM2").unit, "M2");
assert.equal(firstPreview.rows.find((row) => row.destinationKey === "lowerCeilingHeight").unit, "MM");
assert.equal(createJobSetupImportPreview(original, payload({ lowerCeilingHeight: 2700 }, { mappingPreview: [{ destinationKey: "lowerCeilingHeight", unit: "mm" }] })).rows[0].unit, "mm", "Use mapped units when the template leaves them blank");
const imported = applyJobSetupImport(original, firstPayload);
assert.equal(original.data.inputDataSheet.rows.lowerFloorAreaM2.value, "");
assert.equal(imported.data.inputDataSheet.rows.lowerFloorAreaM2.value, "140.5");
assert.equal(imported.data.inputDataSheet.rows.lowerAlfrescoAreaM2.value, "0", "Measured zero is a real value");
assert.equal(imported.data.inputDataSheet.rows.lowerFloorAreaM2.notes, "Keep the estimator's note");
assert.equal(imported.formulas, original.formulas);
assert.equal(imported.quotation, original.quotation);
assert.equal(imported.windowsDoors, original.windowsDoors);
assert.equal(imported.takeoffEngine.aiPlanTakeoffJob, original.takeoffEngine.aiPlanTakeoffJob);
assert.equal(imported.takeoffEngine.quoteMappings, original.takeoffEngine.quoteMappings);
assert.equal(imported.data.subcontractorQuotes, original.data.subcontractorQuotes);
assert.equal(imported.data.inputDataSheet.rows.roofType, original.data.inputDataSheet.rows.roofType);
assert.deepEqual(imported.takeoffEngine.lastJobSetupSync.appliedFields.lowerFloorAreaM2, {
  value: "140.5", previousValue: "", source: "Measured lowerFloorAreaM2", unit: "M2", provenance: firstPayload.provenance, syncedAt: firstPayload.provenance.transferredAt,
});
const calculated = calculateEstimateBuilderWorkbook(imported);
assert.equal(calculated.quantities.lowerSlabAreaM2, 176.5, "Imported areas must recalculate the slab");
assert.equal(calculated.quantities.secondLevelFloorAreaM2, 82);
assert.equal(calculated.quotation["CONCRETE SLAB"].rows[0].qty, 176.5);
assert.equal(calculated.quotation["CONCRETE SLAB"].rows[0].cost, 22062.5, "Quote keeps the rate and recalculates the cost");

const repeated = createJobSetupImportPreview(imported, firstPayload);
assert.ok(repeated.rows.every((row) => row.status === "unchanged" && !row.selected));
assert.equal(applyJobSetupImport(imported, firstPayload), imported, "Identical reimport is a no-op");
assert.equal(applyJobSetupImport(original, firstPayload, []), original, "Empty selection is a no-op");

const manuallyChanged = structuredClone(imported);
manuallyChanged.data.inputDataSheet.rows.lowerFloorAreaM2.value = "155";
const revision = payload({ lowerFloorAreaM2: 150, lowerGarageAreaM2: 38, upperFloorAreaM2: 84 });
const revisedPreview = createJobSetupImportPreview(manuallyChanged, revision);
assert.deepEqual(revisedPreview.rows.map((row) => [row.destinationKey, row.status, row.selected]), [
  ["lowerFloorAreaM2", "changed", false], ["lowerGarageAreaM2", "changed", true], ["upperFloorAreaM2", "changed", true],
]);
const revised = applyJobSetupImport(manuallyChanged, revision);
assert.equal(revised.data.inputDataSheet.rows.lowerFloorAreaM2.value, "155", "Manual edit survives default reimport");
assert.equal(revised.data.inputDataSheet.rows.lowerGarageAreaM2.value, "38");
assert.deepEqual(Object.keys(revised.takeoffEngine.lastJobSetupSync.appliedFields), ["lowerGarageAreaM2", "upperFloorAreaM2"], "Audit records only fields applied in this import");
assert.equal(revised.takeoffEngine.lastJobSetupSync.importedFields.lowerFloorAreaM2.value, "140.5", "Partial import retains earlier per-field provenance");
const manualSelected = applyJobSetupImport(manuallyChanged, revision, ["lowerFloorAreaM2"]);
assert.equal(manualSelected.data.inputDataSheet.rows.lowerFloorAreaM2.value, "150", "Explicit selection can replace a manual value");
assert.equal(manualSelected.takeoffEngine.lastJobSetupSync.appliedFields.lowerFloorAreaM2.previousValue, "155");
assert.equal(manualSelected.data.inputDataSheet.rows.lowerGarageAreaM2.value, "36");
const removedLevelPayload = payload({ lowerFloorAreaM2: 140.5, floorCount: "Single storey" });
const removedLevelPreview = createJobSetupImportPreview(imported, removedLevelPayload);
assert.ok(removedLevelPreview.warnings.some((warning) => warning.includes("Second level floor area") && warning.includes("retained")), "Warn when a previously imported level no longer has a measurement");
assert.ok(!removedLevelPreview.warnings.some((warning) => warning.includes("Alfresco")), "A previous zero does not require a stale quantity warning");
const removedLevel = applyJobSetupImport(imported, removedLevelPayload);
assert.equal(removedLevel.data.inputDataSheet.rows.upperFloorAreaM2.value, "82", "Absent measurements never silently erase previous quantities");
assert.deepEqual(Object.keys(removedLevel.takeoffEngine.lastJobSetupSync.appliedFields), ["floorCount"]);
assert.equal(createJobSetupImportPreview(imported, { ...removedLevelPayload, provenance: { ...removedLevelPayload.provenance, takeoffId: "takeoff-b" } }).warnings.length, 0, "Stale measurements are compared only within the same takeoff");

const protectedWorkbook = workbook();
protectedWorkbook.data.inputDataSheet.hiddenRows.push("lowerGarageAreaM2");
protectedWorkbook.formulas.lowerFloorAreaM2 = "120 + 20";
protectedWorkbook.data.inputDataSheet.rows.lowerExternalWallsLm.formula = "25 * 2";
delete protectedWorkbook.data.inputDataSheet.rows.upperFloorAreaM2;
const protectedPayload = payload({ lowerSlabAreaM2: 999, lowerGarageAreaM2: 20, lowerFloorAreaM2: 160, lowerExternalWallsLm: 80, upperFloorAreaM2: 40, inventedInput: 999, heading_project_setup: "Overwrite", lowerPorchAreaM2: 8 });
const protections = createJobSetupImportPreview(protectedWorkbook, protectedPayload);
assert.ok(protections.rows.slice(0, 7).every((row) => row.status === "unavailable" && !row.selected));
assert.equal(protections.rows[7].status, "new");
deepFreeze(protectedWorkbook);
assert.throws(() => applyJobSetupImport(protectedWorkbook, protectedPayload, ["lowerPorchAreaM2", "lowerFloorAreaM2"]), /formula/);
assert.equal(protectedWorkbook.data.inputDataSheet.rows.lowerPorchAreaM2.value, "", "A failing selection writes nothing");
assert.throws(() => applyJobSetupImport(protectedWorkbook, protectedPayload, ["inventedInput"]), /No editable Job Setup destination/);
assert.throws(() => applyJobSetupImport(protectedWorkbook, protectedPayload, ["notEvenInPayload"]), /No mapped Job Setup destination/);
assert.equal(applyJobSetupImport(protectedWorkbook, protectedPayload).data.inputDataSheet.rows.lowerPorchAreaM2.value, "8");

for (const badValue of [-1, Infinity, -Infinity, NaN, "NaN", "Infinity", "-2", "five", {}, [], true, null, undefined, "", "   "]) {
  const badPayload = payload({ lowerFloorAreaM2: badValue });
  assert.equal(createJobSetupImportPreview(original, badPayload).rows[0].status, "unavailable", `Reject ${String(badValue)}`);
  assert.throws(() => applyJobSetupImport(original, badPayload, ["lowerFloorAreaM2"]));
}
assert.equal(createJobSetupImportPreview(original, payload({ floorCount: "Five storey" })).rows[0].status, "unavailable");
assert.equal(createJobSetupImportPreview(original, payload({ lowerFloorAreaM2: 0 }, { mappingPreview: [{ destinationKey: "lowerFloorAreaM2", status: "missing" }] })).rows[0].status, "unavailable", "A missing measurement cannot clear a real input through zero");

const wrongProject = payload({ lowerFloorAreaM2: 500 }, { provenance: { projectId: "project-b" } });
assert.equal(createJobSetupImportPreview(original, wrongProject).rows[0].status, "unavailable");
assert.throws(() => applyJobSetupImport(original, wrongProject), /different project/);
const identityAliases = structuredClone(original);
identityAliases.jobId = "local-job-a";
identityAliases.registeredJob.id = "registration-a";
identityAliases.registeredJob.projectId = "platform-project-a";
for (const projectId of ["project-a", "local-job-a", "registration-a", "platform-project-a"]) {
  assert.equal(applyJobSetupImport(identityAliases, payload({ lowerFloorAreaM2: 22 }, { provenance: { projectId } })).data.inputDataSheet.rows.lowerFloorAreaM2.value, "22", "Recognize an authoritative project ID alias");
}
const standalone = structuredClone(original);
standalone.projectId = "";
standalone.registeredJob = {};
assert.equal(applyJobSetupImport(standalone, firstPayload).data.inputDataSheet.rows.lowerFloorAreaM2.value, "140.5", "Locally saved jobs may have no platform project ID");
const legacy = workbook();
legacy.data.inputDataSheet.rows.lowerFloorAreaM2.value = 140.5;
legacy.takeoffEngine.lastJobSetupSync = { payload: firstPayload };
assert.equal(createJobSetupImportPreview(legacy, payload({ lowerFloorAreaM2: 150 })).rows[0].selected, true, "Recognize quantities written by older imports");
const legacyPartial = applyJobSetupImport(legacy, payload({ upperFloorAreaM2: 85 }));
assert.equal(createJobSetupImportPreview(legacyPartial, payload({ lowerFloorAreaM2: 150 })).rows[0].selected, true, "Keep earlier imported baselines when partially updating a legacy import");

// A stale project id blocks by default, but an explicit acknowledgement imports and is recorded.
const mismatchDetail = describeProjectMismatch(original, wrongProject);
assert.equal(mismatchDetail.sourceId, "project-b");
assert.equal(mismatchDetail.targetId, "project-a");
assert.equal(describeProjectMismatch(original, payload({ lowerFloorAreaM2: 1 })), null, "Matching ids report no mismatch");
const acknowledgedPreview = createJobSetupImportPreview(original, wrongProject, { allowProjectMismatch: true });
assert.equal(acknowledgedPreview.rows[0].status, "new", "Acknowledging the mismatch unlocks the row");
assert.equal(acknowledgedPreview.projectMismatch.sourceId, "project-b", "The preview still reports the mismatch");
assert.ok(acknowledgedPreview.warnings.some((warning) => /different project/.test(warning)), "The mismatch stays visible as a warning");
const acknowledged = applyJobSetupImport(original, wrongProject, ["lowerFloorAreaM2"], { allowProjectMismatch: true });
assert.equal(acknowledged.data.inputDataSheet.rows.lowerFloorAreaM2.value, "500", "An acknowledged mismatch imports the quantity");
assert.equal(acknowledged.takeoffEngine.lastJobSetupSync.projectMismatchAcknowledged.sourceId, "project-b", "The override is recorded against the sync");
assert.ok(acknowledged.takeoffEngine.lastJobSetupSync.projectMismatchAcknowledged.acknowledgedAt, "The override records when it was accepted");
assert.equal(applyJobSetupImport(original, payload({ lowerFloorAreaM2: 12 })).takeoffEngine.lastJobSetupSync.projectMismatchAcknowledged, null, "A matching import records no override");

console.log("Job Setup takeoff import: atomic updates, manual overrides, formulas, provenance, validation and quote recalculation passed.");
