import assert from "node:assert/strict";
import { restoreCompleteWorkbook, jobContentSignature } from "../lib/construction-estimation/jobPersistence.js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

const defaults = createEstimateBuilderWorkbookDefaults();
assert.equal(defaults.data.inputDataSheet.rows.lowerExternalWallLining.value, "Plasterboard to framed walls");
const saved = structuredClone(defaults);
saved.jobId = "test-stable-identity";
saved.data.inputDataSheet.rows.lowerExternalWallLining.value = "Raw blockwork";
saved.data.futureSection = { rows: { future: { value: 0, formula: "1+2", extra: false } } };
saved.quotation = { Custom: { extra: true, rows: [
  { id: "b", item: "Reordered", quantity: "0", manualRate: "0", unit: "LM" },
  { id: "a", item: "Added", productLibrarySnapshot: { stableProductId: "master-a", imageReference: "/images/a.png" } },
] } };
saved.formulas.lowerSlabAreaM2 = "123+7";
saved.formulaRows = [];
saved.windowsDoors = [];
saved.productLibrary.futureProperty = { preserved: true };
saved.futureModule = { pages: [{ imageData: "data:image/png;base64,unchanged", extension: { value: 7 } }] };
saved.cashflowPayments.extension = { deposits: [0, 15, 85] };
const restored = restoreCompleteWorkbook(defaults, saved);
assert.equal(calculateEstimateBuilderWorkbook(restored).quantities.lowerSlabAreaM2, 130, "Saved job formula must be evaluated, not merely stored");
for (const key of Object.keys(saved)) assert.deepEqual(restored[key], saved[key], key);
const before = jobContentSignature(saved);
for (const key of ["data", "quotation", "formulas", "clientPage", "cashflowPayments", "futureModule"]) {
  const edited = structuredClone(saved);
  edited[key].newField = "changed";
  assert.notEqual(jobContentSignature(edited), before, `${key} must mark the complete job dirty`);
}
assert.equal(jobContentSignature({ ...saved, savedAt: "new timestamp", page: "quotation" }), before);
console.log("PASS complete restoration: defaults, saved selections, deletions, order, formulas, images, zero values and unknown module fields.");

// Run the actual template sanitizer, isolated from React and browser hydration.
const fs = await import("node:fs");
const hookSource = fs.readFileSync("hooks/estimate-builder/useEstimateBuilderWorkbook.js", "utf8");
const templateSanitizerSource = hookSource.slice(hookSource.indexOf("function sanitizeTemplateData("), hookSource.indexOf("function shouldKeepTemplateDataValue("));
const sanitizeTemplate = new Function("V4_DATA_SECTIONS", "shouldKeepTemplateDataValue", templateSanitizerSource + "; return sanitizeTemplateData;")([], () => true);
const templateData = sanitizeTemplate(saved.data);
assert.equal(templateData.inputDataSheet.rows.lowerExternalWallLining.value, "Plasterboard to framed walls");
assert.equal(saved.data.inputDataSheet.rows.lowerExternalWallLining.value, "Raw blockwork", "Creating a template must not mutate the existing job");
console.log("PASS new template uses the exact wall finish default without changing the source job.");
