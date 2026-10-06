import assert from "node:assert/strict";
import {
  createTakeoffSchedule,
  createJobSetupPayload,
} from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";

// Job Setup's wall, floor-area and roof-area inputs are all per building level. A measurement can
// only reach one of them if its plan sheet has been assigned to a level, because a sheet's position
// in the PDF says nothing about the storey it draws - sheet 3 of a two-storey set is not a third
// level. These checks pin that contract end to end: schedule in, Job Setup fields out.

const PX_PER_MM = 1;
const wall = (id, page, category, lengthMm, extra = {}) => ({
  id,
  page,
  category,
  nodes: [{ x: 0, y: 0 }, { x: lengthMm, y: 0 }],
  lengthMm,
  thicknessMm: category === "exterior" ? 230 : 90,
  alignment: "outer",
  exteriorType: category === "exterior" ? "Brick Veneer" : "",
  linedFaces: 2,
  openingDeductionsEnabled: true,
  wallHeightM: null,
  ...extra,
});

// A two-storey job drawn across three sheets: the upper storey lives on sheet 3.
const completedWallRuns = [
  wall("w1", 1, "interior", 20000),
  wall("w2", 3, "interior", 40000),
  wall("w3", 3, "interior", 23000),
  wall("w4", 3, "exterior", 48680),
];

function payloadFor(sheetLevels) {
  const schedule = createTakeoffSchedule({
    projectInfo: { projectName: "Level import", siteAddress: "1 Test St" },
    planFilename: "plans.pdf",
    totalPages: 3,
    currentPage: 3,
    pixelsPerMm: PX_PER_MM,
    completedWallRuns,
    sheetLevels,
  });
  return createJobSetupPayload(schedule, { sheetLevels });
}

// These fixture walls are all 90mm-thick interior and 230mm (-> 70mm frame) exterior, so their
// measured lengths land in the hidden Internal90mmWallsLm / BrickVeneer70mmWallsLm rows - the
// authoritative imported measurement per level (lowerInternalWallsLm/upperExternalWallsLm etc. are
// derived sheet totals, not import destinations).

// Unassigned sheets import nothing and say so, rather than guessing a storey from the sheet number.
const unassigned = payloadFor({});
assert.equal(unassigned.dataInputFields.lowerInternal90mmWallsLm, undefined, "An unassigned sheet must not import wall lengths");
assert.equal(unassigned.dataInputFields.upperInternal90mmWallsLm, undefined, "An unassigned sheet must not import wall lengths");
assert.equal(unassigned.dataInputFields.thirdInternal90mmWallsLm, undefined, "A sheet number must never be treated as a storey");
assert.ok(
  unassigned.warnings.some((warning) => /assign the measured plan sheets to building levels/i.test(warning)),
  "Unassigned sheets carrying measurements must warn the estimator",
);

// Assigning sheet 3 to the second level routes its 63 lm of internal walls to the upper inputs.
const assigned = payloadFor({ 1: "Ground Floor", 3: "Second Level" });
assert.equal(assigned.dataInputFields.lowerInternal90mmWallsLm, 20, "Sheet 1 internal walls import to the ground level");
assert.equal(assigned.dataInputFields.upperInternal90mmWallsLm, 63, "Sheet 3 internal walls import to the level that sheet was assigned");
assert.equal(assigned.dataInputFields.thirdInternal90mmWallsLm, undefined, "A two-storey job must leave the third level empty");
assert.equal(assigned.dataInputFields.upperBrickVeneer70mmWallsLm, 48.68, "Exterior walls follow the same sheet assignment");
assert.equal(assigned.dataInputFields.upperInternalWallThicknessMm, 90, "A level with one internal thickness imports it");

// The same sheet assigned elsewhere moves its quantities, proving nothing is keyed off the number.
const shifted = payloadFor({ 1: "Ground Floor", 3: "Third Level" });
assert.equal(shifted.dataInputFields.upperInternal90mmWallsLm, undefined, "Reassigning a sheet must move its quantities");
assert.equal(shifted.dataInputFields.thirdInternal90mmWallsLm, 63, "Reassigning a sheet must move its quantities");

// Every destination the payload claims to fill must be a real editable Job Setup row.
for (const row of assigned.mappingPreview) {
  assert.ok(row.destinationKey, "Every mapped field needs a destination key");
  assert.equal(row.status, "ready", `${row.destinationKey} should be ready`);
}

console.log("Takeoff sheet level import checks passed.");
