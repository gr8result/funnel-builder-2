import assert from "node:assert/strict";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

// TIE DOWN automation: 3.0m/2.7m cyclone rods, connector nuts, chemset, and SQ washers/nuts, all
// derived from the canonical ground/upper exterior wall LM the Takeoff Schedule already computes
// (lowerExternalWallsLm / upperExternalWallsLm) - never re-measured or re-derived here.
//
// The imported catalogue carries TWO separate legacy "TIE DOWN" row groups (sourceRow 577-585,
// built around "CYCLONE RODS 2.7m", and 703-710, built around "CYCLONE RODS 3.0m") with their own
// duplicate CONNECTOR NUTS/SQ WASHERS/NUTS/CHEMSET rows. Per business confirmation: 3.0m rods
// (row 703) = ground floor, 2.7m rods (row 577) = upper floor, and only the row-703 group's
// dependent rows (705/707/708/710) are automated - the row-577 group's dependents (579/582/583/585)
// are deliberately left untouched/manual and must NOT receive a calculated quantity.

function minimalWorkbook({ rows, quotation = {} }) {
  return {
    data: { inputDataSheet: { rows: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, { value }])) } },
    windowsDoors: [],
    formulas: {},
    quotation,
  };
}

function tieDownRow(id, sourceRow, item, unit) {
  return { id, sourceRow, section: "TIE DOWN", item, quantity: "", unit, excelRate: "$1.00", sourceOfRate: "workbook", active: true };
}

const tieDownSection = {
  "TIE DOWN": {
    rows: [
      tieDownRow("quote-703", 703, "CYCLONE RODS 3.0m", "EACH"),
      tieDownRow("quote-577", 577, "CYCLONE RODS 2.7m", "EACH"),
      tieDownRow("quote-705", 705, "CONNECTOR NUTS", "EACH"),
      tieDownRow("quote-707", 707, "SQ WASHERS", "EACH"),
      tieDownRow("quote-708", 708, "NUTS", "EACH"),
      tieDownRow("quote-710", 710, "CHEMSET", "EACH"),
      // The OTHER legacy group - must stay untouched (blank quantity, no automation) throughout.
      tieDownRow("quote-579", 579, "CONNECTOR NUTS", "EACH"),
      tieDownRow("quote-582", 582, "SQ WASHERS", "EACH"),
      tieDownRow("quote-583", 583, "NUTS", "EACH"),
      tieDownRow("quote-585", 585, "CHEMSET", "EACH"),
    ],
  },
};

function rowById(preview, id) {
  return preview.quotation["TIE DOWN"].rows.find((row) => row.id === id);
}

// --- 1. Two-storey example from the spec: ground 120 LM, upper 54 LM ---
const twoStorey = calculateEstimateBuilderWorkbook(minimalWorkbook({
  rows: { floorCount: "Two storey", lowerExternalWallsLm: 120, upperExternalWallsLm: 54 },
  quotation: tieDownSection,
}));

assert.equal(twoStorey.quantities.tieDownGroundCycloneRods, 80, "120 / 1.5 must equal 80 ground-floor 3.0m rods");
assert.equal(twoStorey.quantities.tieDownUpperCycloneRods, 36, "54 / 1.5 must equal 36 upper-floor 2.7m rods");
assert.equal(twoStorey.quantities.tieDownConnectorNuts, 116, "connector nuts must be the SUM of the two rod counts (80 + 36), never derived from wall LM directly");
assert.equal(twoStorey.quantities.tieDownChemset, 8, "chemset must be the GROUND rod count / 10 (80 / 10 = 8), never the combined total");
assert.equal(twoStorey.quantities.tieDownSqWashersAndNuts, 80, "SQ washers/nuts must equal the ground rod count only, never the upper count or the combined total");

assert.equal(rowById(twoStorey, "quote-703").qty, 80, "row 703 (CYCLONE RODS 3.0m) must show the ground-floor rod qty");
assert.equal(rowById(twoStorey, "quote-577").qty, 36, "row 577 (CYCLONE RODS 2.7m) must show the upper-floor rod qty");
assert.equal(rowById(twoStorey, "quote-705").qty, 116, "row 705 (CONNECTOR NUTS, row-703's group) must show the combined rod total");
assert.equal(rowById(twoStorey, "quote-707").qty, 80, "row 707 (SQ WASHERS, row-703's group) must show the ground rod count");
assert.equal(rowById(twoStorey, "quote-708").qty, 80, "row 708 (NUTS, row-703's group) must show the ground rod count");
assert.equal(rowById(twoStorey, "quote-710").qty, 8, "row 710 (CHEMSET, row-703's group) must show ground rods / 10");

// The OTHER legacy group (579/582/583/585) must NOT receive an automatic quantity - confirmed by
// checking their quantityKey never resolved to one of the new tieDown* quantities.
["quote-579", "quote-582", "quote-583", "quote-585"].forEach((id) => {
  const row = rowById(twoStorey, id);
  assert.ok(!String(row.quantityKey || "").startsWith("tieDown"), `${id} (the other legacy group) must not be wired to a tieDown* quantity - got quantityKey "${row.quantityKey}"`);
});

// --- 2. Single-storey: upper floor rods/dependents must be 0/unused, ground-floor chain unaffected ---
const singleStorey = calculateEstimateBuilderWorkbook(minimalWorkbook({
  rows: { floorCount: "Single storey", lowerExternalWallsLm: 120, upperExternalWallsLm: 0 },
  quotation: tieDownSection,
}));

assert.equal(singleStorey.quantities.tieDownGroundCycloneRods, 80, "ground rods must be unaffected by storey count");
assert.equal(singleStorey.quantities.tieDownUpperCycloneRods, 0, "no upper floor -> 2.7m cyclone rods must be 0");
assert.equal(singleStorey.quantities.tieDownConnectorNuts, 80, "connector nuts must equal ground rods alone when there is no upper floor (80 + 0)");
assert.equal(singleStorey.quantities.tieDownChemset, 8, "chemset must still be ground rods / 10 regardless of storey count");
assert.equal(singleStorey.quantities.tieDownSqWashersAndNuts, 80, "SQ washers/nuts must still equal the ground rod count regardless of storey count");
assert.equal(rowById(singleStorey, "quote-577").qty, 0, "row 577 (2.7m rods) must show 0 for a single-storey project");

// --- 3. Rounding: a non-multiple-of-1.5 wall length must round UP to a whole rod, matching the
// existing architraveTotalLengthsQty precedent (a discrete stock item can't be joined from a
// fraction, so under-rounding would leave the job short). 100 / 1.5 = 66.667 -> 67, never 66. ---
const fractional = calculateEstimateBuilderWorkbook(minimalWorkbook({
  rows: { floorCount: "Two storey", lowerExternalWallsLm: 100, upperExternalWallsLm: 0 },
  quotation: tieDownSection,
}));
assert.equal(fractional.quantities.tieDownGroundCycloneRods, 67, "100 / 1.5 = 66.667 must round UP to 67 whole rods, matching the existing architrave stock-length rounding convention");

console.log("Tie down automation checks passed: 3.0m/2.7m cyclone rods, connector nuts, chemset, SQ washers/nuts, single-storey zeroing, round-up convention, and the untouched legacy row group.");
