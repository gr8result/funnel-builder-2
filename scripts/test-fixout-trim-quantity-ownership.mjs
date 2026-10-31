import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import JSZip from "jszip";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

const sourcePath = "artifacts/test-results/real-job-repair-2026-10-24/New Job 03 09 - PRE-REPAIR EXACT COPY.gr8job";
const expectedHash = "72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088";
const sourceBytes = fs.readFileSync(sourcePath);
assert.equal(crypto.createHash("sha256").update(sourceBytes).digest("hex"), expectedHash);

const zip = await JSZip.loadAsync(sourceBytes);
const estimate = JSON.parse(await zip.file("estimate.json").async("string"));
const takeoff = JSON.parse(await zip.file("takeoff.json").async("string"));
const selections = JSON.parse(await zip.file("client-selections.json").async("string"));
const source = { ...estimate.workbook, ...takeoff, ...selections };

const sourceRow = (workbook, id) => Object.values(workbook.quotation)
  .flatMap((section) => section.rows || [])
  .find((row) => row.id === id);
const calculatedRow = (calculated, id) => Object.values(calculated.quotation)
  .flatMap((section) => section.rows || [])
  .find((row) => row.id === id);
const input = (workbook, key) => workbook.data.inputDataSheet.rows[key];

assert.equal(sourceRow(source, "quote-159").formulas.B, "skirtingLm");
assert.equal(sourceRow(source, "quote-1356").formulas.B, "architraveLengthsEach*5.4");
assert.equal(sourceRow(source, "quote-1363").formulas.B, "skirtingLengthsEach*5.4");

const calculated = calculateEstimateBuilderWorkbook(structuredClone(source));
assert.equal(calculated.quantities.skirtingLm, 314.28);
assert.equal(calculated.quantities.lowerSkirtingLm, 161.52);
assert.equal(calculated.quantities.upperSkirtingLm, 152.76);
assert.equal(calculated.quantities.skirtingLengthsEach, 59);
assert.equal(calculated.quantities.skirtingPurchaseLm, 318.6);
assert.equal(calculated.quantities.skirtingStockOffcutLm, 4.32);
assert.equal(calculated.quantities.architraveMeasuredLm, 402.15);
assert.equal(calculated.quantities.architraveWasteLm, 24.45);
assert.equal(calculated.quantities.architraveLm, 402.15);
assert.equal(calculated.quantities.architraveLengthsEach, 79);
assert.equal(calculated.quantities.robeArchitraveOpeningCount, 4);
assert.equal(calculated.quantities.robeArchitraveMeasuredLm, 52.48);
assert.equal(calculated.quantities.robeArchitraveLengthsEach, 12);
assert.equal(calculated.quantities.robeArchitravePurchaseLm, 64.8);
assert.equal(calculated.quantities.robeArchitraveWasteLm, 12.32);
assert.equal(calculated.quantities.nonRobeArchitraveLengthsEach, 67);

const selectedSkirting = calculatedRow(calculated, "quote-159");
assert.equal(selectedSkirting.qty, 318.6);
assert.equal(selectedSkirting.unit, "LM");
assert.equal(selectedSkirting.cost, 5575.5);
assert.equal(selectedSkirting.derivedQuantityFormula, "skirtingPurchaseLm");
assert.match(selectedSkirting.derivedQuantityExplanation, /Ground 161\.52 \+ Second 152\.76 \+ Third 0 = 314\.28 LM/);
assert.match(selectedSkirting.derivedQuantityExplanation, /59 x 5\.4 m = 318\.6 LM purchased; 4\.32 LM stock-rounding offcut/);

const aggregateArchitraves = calculatedRow(calculated, "quote-1356");
assert.equal(aggregateArchitraves.qty, 67);
assert.equal(aggregateArchitraves.unit, "LENGTH");
assert.equal(aggregateArchitraves.finalRateUsed, "$12.15");
assert.equal(aggregateArchitraves.cost, 814.05);
assert.equal(aggregateArchitraves.derivedQuantityFormula, "nonRobeArchitraveLengthsEach");

for (const id of ["quote-1357", "quote-1361"]) {
  const row = calculatedRow(calculated, id);
  assert.equal(row.qty, 0);
  assert.equal(row.cost, 0);
  assert.equal(row.active, false);
  assert.match(`${row.inactiveReason || ""} ${row.derivedQuantityExplanation || ""}`, /included in the measured aggregate architrave LM/i);
}
const robeArchitraves = calculatedRow(calculated, "quote-1362");
assert.equal(robeArchitraves.active, true);
assert.equal(robeArchitraves.qty, 64.8);
assert.equal(robeArchitraves.unit, "LM");
assert.equal(robeArchitraves.cost, 97.2);
assert.match(robeArchitraves.derivedQuantityExplanation, /4 robe openings .*2400 x 2040 mm.*2100 x 2040 mm.*both faces, head plus two jambs per face/);
assert.match(robeArchitraves.derivedQuantityExplanation, /52\.48 LM required; packed as 12 x 5\.4 m = 64\.8 LM purchased with 12\.32 LM cutting offcut/);
assert.match(aggregateArchitraves.derivedQuantityExplanation, /402\.15 LM required; 79 x 5\.4 m = 426\.6 LM purchased with 24\.45 LM total cutting offcut/);
assert.match(aggregateArchitraves.derivedQuantityExplanation, /349\.67 LM required; 67 x 5\.4 m = 361\.8 LM purchased with 12\.13 LM offcut/);

const alternativeSkirting = calculatedRow(calculated, "quote-1363");
assert.equal(alternativeSkirting.qty, 0);
assert.equal(alternativeSkirting.cost, 0);
assert.equal(alternativeSkirting.active, false);
assert.match(`${alternativeSkirting.inactiveReason || ""} ${alternativeSkirting.derivedQuantityExplanation || ""}`, /selected profile is 68x11/i);

const remeasured = structuredClone(source);
input(remeasured, "architraveMeasuredLm").value = "407.55";
input(remeasured, "architraveLengthsQty").value = "80";
input(remeasured, "architraveWasteLm").value = "24.45";
const remeasuredCalculation = calculateEstimateBuilderWorkbook(remeasured);
assert.equal(remeasuredCalculation.quantities.architraveLm, 407.55);
assert.equal(remeasuredCalculation.quantities.architraveLengthsEach, 80);
assert.equal(calculatedRow(remeasuredCalculation, "quote-1356").qty, 68);
assert.equal(calculatedRow(remeasuredCalculation, "quote-1356").cost, 826.2);

const reopened = JSON.parse(JSON.stringify(source));
const reopenedCalculation = calculateEstimateBuilderWorkbook(reopened);
for (const id of ["quote-159", "quote-1356", "quote-1357", "quote-1361", "quote-1363"]) {
  const before = calculatedRow(calculated, id);
  const after = calculatedRow(reopenedCalculation, id);
  assert.deepEqual(
    { qty: after.qty, unit: after.unit, rate: after.finalRateUsed, cost: after.cost, active: after.active },
    { qty: before.qty, unit: before.unit, rate: before.finalRateUsed, cost: before.cost, active: before.active },
  );
}

assert.equal(crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"), expectedHash);

const overridden = structuredClone(source);
overridden.formulas.lowerSkirtingLm = "((GroundLevelInternalWallsLm * 2) + GroundLevelExternalWallsLm) * 0.8 + 5";
overridden.formulaOverrides = {
  ...(overridden.formulaOverrides || {}),
  lowerSkirtingLm: {
    expression: "((GroundLevelInternalWallsLm * 2) + GroundLevelExternalWallsLm) * 0.8 + 5",
    note: "Formula editor persistence test",
    changedAt: "2026-10-25T00:00:00.000Z",
  },
};
const overriddenCalculation = calculateEstimateBuilderWorkbook(overridden);
assert.equal(overriddenCalculation.quantities.lowerSkirtingLm, 166.52);
assert.equal(overriddenCalculation.quantities.skirtingLm, 319.28);
assert.equal(calculatedRow(overriddenCalculation, "quote-159").qty, 324);

const persistedOverride = JSON.parse(JSON.stringify(overridden));
const reopenedOverrideCalculation = calculateEstimateBuilderWorkbook(persistedOverride);
assert.equal(reopenedOverrideCalculation.quantities.lowerSkirtingLm, 166.52);
assert.equal(calculatedRow(reopenedOverrideCalculation, "quote-159").qty, 324);

delete persistedOverride.formulaOverrides.lowerSkirtingLm;
persistedOverride.formulas.lowerSkirtingLm = "((GroundLevelInternalWallsLm * 2) + GroundLevelExternalWallsLm) * 0.8";
const resetCalculation = calculateEstimateBuilderWorkbook(persistedOverride);
assert.equal(resetCalculation.quantities.lowerSkirtingLm, 161.52);
assert.equal(resetCalculation.quantities.skirtingLm, 314.28);
assert.equal(calculatedRow(resetCalculation, "quote-159").qty, 318.6);
console.log("PASS fix-out trim quantity ownership");
