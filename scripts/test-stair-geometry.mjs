import assert from "node:assert/strict";
import { register } from "node:module";
import { DEFAULT_MAX_RISER_HEIGHT_MM, formatRiserHeight, resolveStairFlight, stairHeightSnapshot, stairRiserCalculation } from "../lib/construction-estimation/stairGeometry.js";

// The workbook calculations import JSON without an import attribute; supply it for this script only.
register("data:text/javascript," + encodeURIComponent('export async function load(url, context, next) { return next(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context); }'));
const { stairFlightsFromJobSetup } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");

// --- the riser rule ---
assert.equal(DEFAULT_MAX_RISER_HEIGHT_MM, 190);
const project = stairRiserCalculation(2740 + 319);
assert.equal(project.floorToFloorMm, 3059);
assert.equal(project.riserCount, 17, "3059 / 190 = 16.10 -> 17, never 16 (191.19mm > 190)");
assert.equal(formatRiserHeight(project.actualRiserHeightMm), "179.9");
assert.ok(Math.abs(project.actualRiserHeightMm - 179.941) < 0.001);
assert.equal(stairRiserCalculation(3040).riserCount, 16, "exact multiple of 190 is not over-counted");
assert.equal(stairRiserCalculation(3040).actualRiserHeightMm, 190);
assert.equal(stairRiserCalculation(3041).riserCount, 17, "just over the limit adds a riser");
assert.equal(stairRiserCalculation(2850).riserCount, 15, "2850 / 190 = 15 exactly");
assert.equal(stairRiserCalculation(2851).riserCount, 16);
assert.equal(stairRiserCalculation(0).riserCount, null, "no height, no invented risers");

// --- Job Setup is the source: Ground -> Second for a two-storey job ---
const rows = (values) => ({ data: { inputDataSheet: { rows: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])) }, projectSetup: { rows: { floorCount: { value: values.floorCount } } } } });
const twoStorey = rows({ floorCount: "Two Storey", lowerCeilingHeight: "2740", upperFloorDepthMm: "319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", upperCeilingHeight: "2550" });
const flights = stairFlightsFromJobSetup(twoStorey);
assert.equal(flights.length, 1);
const resolved = resolveStairFlight(flights[0]);
assert.equal(resolved.label, "Ground Level to Second Level");
assert.deepEqual([resolved.ceilingHeight.valueMm, resolved.ceilingHeight.source], [2740, "Imported from Job Setup"]);
assert.deepEqual([resolved.floorThickness.valueMm, resolved.floorThickness.source], [319, "Imported from Job Setup"]);
assert.deepEqual([resolved.floorToFloorMm, resolved.riserCount, formatRiserHeight(resolved.actualRiserHeightMm)], [3059, 17, "179.9"]);
assert.equal(resolved.explanation, "2740mm ceiling height + 319mm floor system = 3059mm; ceil(3059 / 190) = 17 risers @ 179.9mm");

// Job Setup change flows through (no override)
const raised = resolveStairFlight(stairFlightsFromJobSetup(rows({ floorCount: "Two Storey", lowerCeilingHeight: "2590", upperFloorDepthMm: "379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)" }))[0]);
assert.deepEqual([raised.floorToFloorMm, raised.riserCount], [2969, 16]);

// ceiling stored in metres; blank floor system uses the estimate's default and says so
const metres = resolveStairFlight(stairFlightsFromJobSetup(rows({ floorCount: "2", lowerCeilingHeight: "2.74", upperFloorDepthMm: "" }))[0]);
assert.equal(metres.ceilingHeight.valueMm, 2740);
assert.deepEqual([metres.floorThickness.valueMm, metres.floorThickness.source], [319, "Job Setup default floor system"]);

// --- three storeys: Ground -> Second and Second -> Third, each from its own levels ---
const threeStorey = stairFlightsFromJobSetup(rows({ floorCount: "Three Storey", lowerCeilingHeight: "2740", upperFloorDepthMm: "319mm Timber Floor System", upperCeilingHeight: "2590", thirdFloorDepthMm: "250mm Suspended Concrete Flooring" }));
assert.deepEqual(threeStorey.map((flight) => flight.label), ["Ground Level to Second Level", "Second Level to Third Level"]);
const second = resolveStairFlight(threeStorey[1]);
assert.deepEqual([second.ceilingHeight.valueMm, second.floorThickness.valueMm, second.floorToFloorMm, second.riserCount], [2590, 250, 2840, 15]);
assert.equal(stairFlightsFromJobSetup(rows({ floorCount: "Single Storey", lowerCeilingHeight: "2740" })).length, 0, "single storey has no stair flight");

// a level with no ceiling height is reported, not guessed
const missing = resolveStairFlight(stairFlightsFromJobSetup(rows({ floorCount: "Two Storey", upperFloorDepthMm: "319mm" }))[0]);
assert.equal(missing.ceilingHeight.source, "Not set in Job Setup");
assert.equal(missing.riserCount, null);

// --- override: stair-only, original Job Setup value kept for reset ---
const overridden = resolveStairFlight(flights[0], { floorThicknessMm: 335 });
assert.deepEqual([overridden.floorThickness.valueMm, overridden.floorThickness.jobSetupMm, overridden.floorThickness.overridden], [335, 319, true]);
assert.deepEqual([overridden.floorToFloorMm, overridden.riserCount], [3075, 17]);
assert.equal(resolveStairFlight(flights[0], { floorThicknessMm: 319 }).floorThickness.overridden, false, "same as Job Setup is not an override");
const snapshot = stairHeightSnapshot(overridden);
assert.deepEqual([snapshot.floorToFloorMm, snapshot.riserCount, snapshot.floorThicknessJobSetupMm, snapshot.floorThicknessOverridden], [3075, 17, 319, true]);
assert.equal(twoStorey.data.inputDataSheet.rows.upperFloorDepthMm.value.startsWith("319mm"), true, "Job Setup itself is unchanged");

console.log("stair geometry: 3059mm -> 17 risers @ 179.9mm, exact multiples, just-over limit, Job Setup import (mm / metres / default), Job Setup changes, three storeys, missing values, overrides passed");
