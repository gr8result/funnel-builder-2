import assert from "node:assert/strict";
import { createTakeoffSchedule, createJobSetupPayload } from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { ARCHITRAVE_DEFAULTS, architravePieces, packLengths, packOpenings } from "../lib/construction-estimation/architraveCutting.js";
import { V4_DATA_SECTIONS } from "../lib/construction-estimation/estimateWorksheetV4Schema.js";
import { calculateEstimateBuilderWorkbook, V4_DEFAULT_FORMULAS } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

function sheet(values = {}) {
  const rows = Object.fromEntries(V4_DATA_SECTIONS.find((s) => s.key === "inputDataSheet").rows.map((r) => [r.key, { value: "" }]));
  for (const [key, value] of Object.entries(values)) rows[key] = { value };
  return { projectId: "p", formulas: { ...V4_DEFAULT_FORMULAS }, data: { inputDataSheet: { rows, hiddenRows: [], collapsed: false } }, windowsDoors: [], quotation: {} };
}
const mm = (metres) => Math.round(metres * 1000);

// --- Piece geometry -------------------------------------------------------
// A piece is longer than the opening it trims. A door architrave starts at the floor, 25mm below
// the 2040 door, and runs 45mm past the head to carry its mitre: 2110, not 2040.
assert.deepEqual(architravePieces("Internal Door", 820, 2040).map(mm), [2110, 2110, 910, 2110, 2110, 910], "Both faces, jambs from the floor through the mitre");
assert.deepEqual(architravePieces("External Door", 920, 2040).map(mm), [2110, 2110, 1010], "Inside face only, no sill");
// A window is mitred at all four corners, so both ends of every piece carry an allowance.
assert.deepEqual(architravePieces("Window", 1800, 1200).map(mm), [1290, 1290, 1890, 1890], "1800 wide needs an 1890 head");
assert.deepEqual(architravePieces("Garage Door", 4800, 2400), [], "Garage doors carry no architrave");
assert.deepEqual(architravePieces("Large Glazed/Stacker/Sliding Door", 2400, 2100).map(mm), [2170, 2170, 2490], "Glass sliding door: head and two jambs");
// A full-height (2100) window runs to the floor like a door: three sides, no sill.
assert.deepEqual(architravePieces("Window", 1800, 2100).map(mm), [2170, 2170, 1890], "2100 high window: head and two jambs");
assert.equal(architravePieces("Window", 1800, 2050).length, 4, "A window under 2100 keeps all four sides");
// A head longer than one 5.4m length is joined from a full length plus the remainder.
assert.equal(packOpenings([{ openingClass: "Large Glazed/Stacker/Sliding Door", widthMm: 5500, heightMm: 2100 }]).oversized, false);
// quantity 3 means three openings, each trimmed in full.
assert.equal(packOpenings([{ openingClass: "Window", widthMm: 900, heightMm: 900, quantity: 3 }]).pieceCount, 12);
assert.equal(architravePieces("Window", 0, 1200), null, "An unmeasured opening is not zero");

// --- Cutting --------------------------------------------------------------
// Three 1890 heads do not come out of one 5400 length, which is why metres cannot simply be divided.
assert.equal(packLengths([1.89, 1.89, 1.89]).lengths, 2, "3 x 1890 exceeds 5400");
const twoHeads = packLengths([1.89, 1.89]);
assert.equal(twoHeads.lengths, 1);
assert.equal(mm(twoHeads.offcuts[0]), 1620, "Two heads leave a 1620 offcut");
// One face of an internal door comes out of one length: 2110 + 2110 + 910 = 5130.
assert.equal(packLengths(architravePieces("Internal Door", 820, 2040).slice(0, 3)).lengths, 1);
assert.equal(packLengths(architravePieces("Internal Door", 820, 2040)).lengths, 2, "A door needs two");
assert.equal(packLengths([ARCHITRAVE_DEFAULTS.stockLengthM + 0.1]).oversized, true, "A piece longer than the stock cannot be cut from it");

// That 1620 offcut trims a smaller window rather than going in the bin, so the job is packed from
// one pool of stock and comes out below the sum of the openings cut in isolation.
const windows = Array.from({ length: 12 }, (_, i) => ({ id: "w" + i, openingClass: "Window", widthMm: 1800, heightMm: 1200 }))
  .concat(Array.from({ length: 10 }, (_, i) => ({ id: "s" + i, openingClass: "Window", widthMm: 900, heightMm: 1200 })));
const pooled = packOpenings(windows);
const isolated = windows.reduce((sum, opening) => sum + packOpenings([opening]).lengths, 0);
assert.ok(pooled.lengths < isolated, "Reusing offcuts must beat cutting each opening alone: " + pooled.lengths + " < " + isolated);
assert.equal(pooled.wasteM, Math.round(((pooled.lengths * ARCHITRAVE_DEFAULTS.stockLengthM) - pooled.requiredM) * 1000) / 1000, "Waste is what was bought less what was cut");
assert.equal(packOpenings([{ openingClass: "Window", widthMm: 0, heightMm: 0 }]).unmeasured.length, 1);

// --- Takeoff export -------------------------------------------------------
const opening = (id, openingClass, widthMm, heightMm) => ({ id, openingClass, widthMm, heightMm, page: 1, level: "Ground Floor" });
const payload = createJobSetupPayload(createTakeoffSchedule({
  totalPages: 1,
  placedOpenings: [
    ...Array.from({ length: 8 }, (_, i) => opening("d" + i, "Internal Door", 820, 2040)),
    opening("x1", "External Door", 920, 2040),
    opening("s1", "Large Glazed/Stacker/Sliding Door", 2400, 2100),
    opening("g1", "Garage Door", 4800, 2400),
    opening("w1", "Window", 1800, 1200),
    opening("w2", "Window", 900, 1200),
  ],
}), { takeoffId: "t1", projectId: "p" });
const f = payload.dataInputFields;
assert.equal(f.internalDoorOpeningsQty, 8, "Internal doors are counted separately");
assert.equal(f.externalDoorOpeningsQty, 1);
assert.equal(f.slidingDoorOpeningsQty, 1);
assert.equal(f.garageDoorOpeningsQty, 1);
assert.equal(f.doorOpeningsQty, 11, "The merged door count still covers every door class");
assert.equal(f.architraveLengthsQty, 21, "Lengths to order once the job is packed");
assert.equal(f.architraveMeasuredLm, 105.06, "Metres cut, mitre allowances included");
assert.equal(f.architraveWasteLm, 8.34);
assert.equal(f.internalDoorArchitraveLm, 82.08, "8 doors x 2 faces x (2.11 + 2.11 + 0.91)");
assert.equal(f.slidingDoorArchitraveLm, 6.83, "Two jambs and a head, no sill");
assert.equal(f.garageDoorArchitraveLm, undefined, "Garage doors carry no architrave");
assert.ok(f.architraveLengthsQty > f.architraveMeasuredLm / ARCHITRAVE_DEFAULTS.stockLengthM, "Cutting always costs more than dividing suggests");

// An opening with no measured size must not silently contribute zero.
const unmeasured = createJobSetupPayload(createTakeoffSchedule({
  totalPages: 1,
  placedOpenings: [opening("w1", "Window", 1800, 1200), opening("w2", "Window", 0, 0)],
}), { takeoffId: "t2", projectId: "p" });
assert.equal(unmeasured.dataInputFields.architraveLengthsQty, undefined, "An unmeasured opening blocks the job total");
assert.ok(unmeasured.warnings.some((w) => /no architrave could be cut/.test(w)));

// --- Job Setup ------------------------------------------------------------
const q = calculateEstimateBuilderWorkbook(sheet({
  internalDoorOpeningsQty: 8, windowOpeningsQty: 22,
  architraveMeasuredLm: 216.06, architraveLengthsQty: 43, architraveWasteLm: 16.14,
})).quantities;
assert.equal(q.internalDoors, 8, "Internal doors come from the takeoff when no schedule exists");
assert.equal(q.architraveLm, 216.06, "Metres cut, taken from the takeoff");
assert.equal(q.architraveLengthsEach, 43, "Lengths come from the cutting calculation");
assert.notEqual(q.architraveLengthsEach, Math.round((216.06 / 5.4) * 100) / 100, "Never re-derived by dividing metres by the stock length");

// With no takeoff openings the manually keyed count still drives the total, rounded to whole lengths.
const manual = calculateEstimateBuilderWorkbook(sheet({ internalDoors: 5 })).quantities;
assert.equal(manual.architraveLm, 54, "5 doors x 10.8m");
assert.equal(manual.architraveLengthsEach, 10, "Whole lengths only, never a fraction");

// --- Total plasterboard ---------------------------------------------------
const plaster = calculateEstimateBuilderWorkbook(sheet({
  lowerExternalWallsLm: 63.02, lowerInternalWallsLm: 64.11, lowerCeilingHeight: 2.74,
  upperExternalWallsLm: 48.68, upperInternalWallsLm: 70.78, upperCeilingHeight: 2.74,
  floorCount: "Two storey", upperFloorAreaM2: 152.15,
})).quantities;
assert.equal(plaster.lowerPlasterboardWallM2, 523.99);
assert.equal(plaster.upperPlasterboardWallM2, 521.25);
assert.equal(plaster.plasterboardWallM2, 1045.24, "The walls subtotal keeps meaning walls only");
assert.equal(
  plaster.totalPlasterboardM2,
  Math.round((plaster.plasterboardWallM2 + plaster.groundFloorCeilingsM2 + plaster.secondFloorCeilingsM2 + plaster.thirdFloorCeilingsM2) * 100) / 100,
  "Total plasterboard adds every level ceiling to every level wall",
);

console.log("Architrave mitre geometry, offcut reuse, door classification and total plasterboard passed.");
