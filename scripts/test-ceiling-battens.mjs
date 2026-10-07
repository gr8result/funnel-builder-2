import assert from "node:assert/strict";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { calculateCeilingBattens, roofAreaOutline, CEILING_BATTEN_FORMULA } from "../lib/construction-estimation/ceilingBattens.js";

// CEILING BATTENS first row (sourceRow 588 "METAL 6M"):
//   CEILING(((roofed ceiling area / 0.45) + roofed ceiling perimeter) x 1.08 / 6.0)
// Area per level = canonical roof plan area; perimeter = outline of the Takeoff's Roof Area polygons.
// Run: node scripts/test-ceiling-battens.mjs

const PX_PER_MM = 0.01; // 1px = 100mm, so 10px = 1m
const m = (value) => value * 10;
const rect = (id, level, x, y, width, depth, page = 1) => ({ id, page, category: "Roof Area", level, exclusions: [], nodes: [{ x: m(x), y: m(y) }, { x: m(x + width), y: m(y) }, { x: m(x + width), y: m(y + depth) }, { x: m(x), y: m(y + depth) }] });
const poly = (id, level, points, page = 1) => ({ id, page, category: "Roof Area", level, exclusions: [], nodes: points.map(([x, y]) => ({ x: m(x), y: m(y) })) });
const expected = (areas, perimeters) => Math.ceil(((areas.reduce((a, b) => a + b, 0) / 0.45) + perimeters.reduce((a, b) => a + b, 0)) * 1.08 / 6 - 1e-9);

const battenSection = () => ({
  "CEILING BATTENS": {
    rows: [
      { id: "quote-588", sourceRow: 588, section: "CEILING BATTENS", item: "METAL 6M", selection: "6.6m", quantity: "", unit: "EACH", excelRate: "$5.48", sourceOfRate: "workbook", active: true },
      { id: "quote-589", sourceRow: 589, section: "CEILING BATTENS", item: "50 X 38 G.O.S. PINE", quantity: "", unit: "LM", excelRate: "$0.85", sourceOfRate: "workbook", active: true },
      // The second legacy "METAL 6M" must stay manual.
      { id: "quote-719", sourceRow: 719, section: "CEILING BATTENS", item: "METAL 6M", quantity: "", unit: "EACH", excelRate: "$5.67", sourceOfRate: "workbook", active: true },
    ],
  },
});

function workbook({ rows, areas = [], quotation = battenSection() }) {
  return {
    data: { inputDataSheet: { rows: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, { value }])) } },
    windowsDoors: [],
    formulas: {},
    quotation,
    aiPlanTakeoffJob: { pixelsPerMm: PX_PER_MM, completedAreas: areas, placedOpenings: [], completedWallRuns: [], completedFloorplans: [] },
  };
}
const battenRow = (result, id = "quote-588") => result.quotation["CEILING BATTENS"].rows.find((row) => row.id === id);
const report = {};

// --- geometry: outline of the combined zone, not every polygon's own perimeter
assert.deepEqual(roofAreaOutline({ pixelsPerMm: PX_PER_MM, completedAreas: [rect("a", "Ground Floor", 0, 0, 20, 10)] }, "Ground Floor").perimeterLm, 60);
const adjoining = roofAreaOutline({ pixelsPerMm: PX_PER_MM, completedAreas: [rect("a", "Ground Floor", 0, 0, 12, 10), rect("b", "Ground Floor", 12, 0, 8, 10)] }, "Ground Floor");
assert.equal(adjoining.zones, 1, "two polygons sharing an edge are one roofed zone");
assert.equal(Math.round(adjoining.perimeterLm * 100) / 100, 60, "shared edge is not perimeter: 12x10 + 8x10 side by side = 20x10 outline");
assert.equal(Math.round(adjoining.areaM2 * 100) / 100, 200);
const partShared = roofAreaOutline({ pixelsPerMm: PX_PER_MM, completedAreas: [rect("a", "Ground Floor", 0, 0, 10, 10), rect("b", "Ground Floor", 10, 2, 5, 4)] }, "Ground Floor");
assert.equal(Math.round(partShared.perimeterLm * 100) / 100, 50, "a partly shared edge removes only the shared 4m (40 + 18 - 8)");
const otherSheet = roofAreaOutline({ pixelsPerMm: PX_PER_MM, completedAreas: [rect("a", "Ground Floor", 0, 0, 12, 10), rect("b", "Ground Floor", 12, 0, 8, 10, 2)] }, "Ground Floor");
assert.equal(otherSheet.zones, 2, "polygons on different plan sheets never adjoin");
assert(roofAreaOutline({ pixelsPerMm: PX_PER_MM, completedAreas: [rect("a", "Ground Floor", 0, 0, 10, 10), rect("b", "Ground Floor", 5, 5, 10, 10)] }, "Ground Floor").overlapping, "overlapping polygons are flagged");

// --- 1. single storey: 20m x 10m roofed ceiling
const single = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Single storey", lowerFloorAreaM2: 200, lowerRoofPlanAreaM2: 200, lowerExternalWallsLm: 55 }, areas: [rect("r1", "Ground Floor", 0, 0, 20, 10)] }));
assert.equal(single.ceilingBattens.roofedCeilingAreaByLevel.lower, 200);
assert.equal(single.ceilingBattens.roofedCeilingPerimeterByLevel.lower, 60, "perimeter is the drawn roof outline, not external wall LM");
assert.equal(single.quantities.ceilingBattenQty, expected([200], [60]));
assert.equal(single.quantities.ceilingBattenQty, 91, "(200/0.45 + 60) x 1.08 / 6 = 90.8 -> 91");
const singleRow = battenRow(single);
assert.equal(singleRow.qty, 91);
assert.equal(singleRow.quantity, "91", "Qty is filled in, not left for the estimator");
assert.equal(singleRow.derivedQuantityFormula, CEILING_BATTEN_FORMULA);
assert.match(singleRow.derivedQuantityExplanation, /Ground roofed ceiling: Area 200\.00m² \/ 0\.45 = 444\.44 LM \| Perimeter = 60\.00 LM/);
assert.match(singleRow.derivedQuantityExplanation, /Total: 444\.44 \+ 60\.00 = 504\.44 LM\n\+ 8% = 544\.80 LM\n\/ 6\.0m effective coverage = 90\.80\nROUND UP = 91 BATTENS/);
assert.equal(singleRow.quantitySource.quantity, 91);
assert.equal(battenRow(single, "quote-719").quantity, "", "the second METAL 6M row is not automated");
assert.equal(battenRow(single, "quote-589").quantity, "");
assert.equal(single.quotation["CEILING BATTENS"].rows.filter((row) => row.quantityKey === "ceilingBattenQty").length, 1, "one batten row, no duplicate");
assert.notEqual(Math.ceil(((200 / 0.45) + 60) * 1.08 / 6.6), 91, "dividing by 6.6 would give a different (wrong) answer");
report.singleStorey = single.ceilingBattens.working;

// --- 2. two storey, roof only over the upper floor: the ground floor is NOT counted
const twoUpperOnly = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Two storey", lowerFloorAreaM2: 150, upperFloorAreaM2: 150, upperRoofPlanAreaM2: 150 }, areas: [rect("u", "Second Level", 0, 0, 15, 10)] }));
assert.deepEqual(twoUpperOnly.ceilingBattens.roofedCeilingAreaByLevel, { upper: 150 }, "intermediate floor under the upper storey is excluded");
assert.equal(twoUpperOnly.quantities.ceilingBattenQty, expected([150], [50]));
assert.equal(battenRow(twoUpperOnly).qty, 69);
report.twoStoreyUpperOnly = twoUpperOnly.ceilingBattens.working;

// --- 3. two storey with a separate ground-floor roof (garage / alfresco wing)
const twoPlusGround = calculateEstimateBuilderWorkbook(workbook({
  rows: { floorCount: "Two storey", lowerFloorAreaM2: 200, upperFloorAreaM2: 150, lowerRoofPlanAreaM2: 50, upperRoofPlanAreaM2: 150 },
  areas: [rect("u", "Second Level", 0, 0, 15, 10), rect("g", "Ground Floor", 0, 0, 10, 5, 2)],
}));
assert.deepEqual(twoPlusGround.ceilingBattens.roofedCeilingAreaByLevel, { lower: 50, upper: 150 });
assert.deepEqual(twoPlusGround.ceilingBattens.roofedCeilingPerimeterByLevel, { lower: 30, upper: 50 });
assert.equal(twoPlusGround.quantities.ceilingBattenQty, expected([50, 150], [30, 50]));
assert.match(battenRow(twoPlusGround).derivedQuantityExplanation, /Ground roofed ceiling: Area 50\.00m².*\nUpper roofed ceiling: Area 150\.00m²/);
report.twoStoreyPlusGroundRoof = twoPlusGround.ceilingBattens.working;

// --- 4. irregular (L-shaped) house: 20x10 with a 8x6 notch removed -> area 152, perimeter 60
const lShape = poly("l", "Ground Floor", [[0, 0], [20, 0], [20, 4], [12, 4], [12, 10], [0, 10]]);
const irregular = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Single storey", lowerFloorAreaM2: 152, lowerRoofPlanAreaM2: 152 }, areas: [lShape] }));
assert.equal(irregular.ceilingBattens.roofedCeilingPerimeterByLevel.lower, 60);
assert.equal(irregular.quantities.ceilingBattenQty, expected([152], [60]));
report.irregular = irregular.ceilingBattens.working;

// --- 5. multiple separate roofed zones on one level (house + detached garage)
const zones = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Single storey", lowerFloorAreaM2: 236, lowerRoofPlanAreaM2: 236 }, areas: [rect("house", "Ground Floor", 0, 0, 20, 10), rect("garage", "Ground Floor", 30, 0, 6, 6)] }));
assert.equal(zones.ceilingBattens.levels[0].zones, 2);
assert.equal(zones.ceilingBattens.roofedCeilingPerimeterByLevel.lower, 84, "each separate zone has its own outline: 60 + 24");
assert.equal(zones.quantities.ceilingBattenQty, expected([236], [84]));
report.multipleZones = zones.ceilingBattens.working;

// --- recalculation: Takeoff / Job Setup change, storey added, save + reload
const before = workbook({ rows: { floorCount: "Single storey", lowerFloorAreaM2: 200, lowerRoofPlanAreaM2: 200 }, areas: [rect("r1", "Ground Floor", 0, 0, 20, 10)] });
const first = calculateEstimateBuilderWorkbook(before);
// Save: the calculated quotation is what the job stores. Reload: recalculated from the stored job.
const reloaded = calculateEstimateBuilderWorkbook(JSON.parse(JSON.stringify({ ...before, quotation: first.quotation })));
assert.equal(battenRow(reloaded).qty, battenRow(first).qty, "same quantity after save + reload");
assert.equal(battenRow(reloaded).derivedQuantityExplanation, battenRow(first).derivedQuantityExplanation);
assert.equal(reloaded.quotation["CEILING BATTENS"].rows.length, 3, "reload does not duplicate the row");
const refreshed = calculateEstimateBuilderWorkbook({ ...JSON.parse(JSON.stringify({ ...before, quotation: first.quotation })), data: { inputDataSheet: { rows: { floorCount: { value: "Single storey" }, lowerFloorAreaM2: { value: 250 }, lowerRoofPlanAreaM2: { value: 250 } } } }, aiPlanTakeoffJob: { pixelsPerMm: PX_PER_MM, completedAreas: [rect("r1", "Ground Floor", 0, 0, 25, 10)] } });
assert.equal(battenRow(refreshed).qty, expected([250], [70]), "Takeoff refresh recalculates the stored row");
assert.notEqual(battenRow(refreshed).qty, battenRow(first).qty);
const storeyAdded = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Two storey", lowerFloorAreaM2: 200, upperFloorAreaM2: 200, upperRoofPlanAreaM2: 200 }, areas: [rect("u", "Second Level", 0, 0, 20, 10)], quotation: first.quotation }));
assert.deepEqual(storeyAdded.ceilingBattens.roofedCeilingAreaByLevel, { upper: 200 }, "adding a storey moves the roofed ceiling to the upper level");

// --- no Roof Area drawn: top storey falls back to measured external walls and says so
const noOutline = calculateEstimateBuilderWorkbook(workbook({ rows: { floorCount: "Single storey", lowerFloorAreaM2: 200, lowerRoofPlanAreaM2: 200, lowerExternalWallsLm: 58 } }));
assert.equal(noOutline.ceilingBattens.roofedCeilingPerimeterByLevel.lower, 58);
assert.match(battenRow(noOutline).derivedQuantityExplanation, /CHECK - Ground: perimeter taken from measured external walls/);
// --- nothing roofed: no quantity, no crash
assert.equal(calculateCeilingBattens({}).qty, 0);
// --- waste before rounding, always up
assert.equal(calculateCeilingBattens({ roofPlanAreaM2: { lower: 2.5 }, externalWallsLm: {}, topLevelPrefix: "lower" }).qty, 1);

console.log(JSON.stringify({ passed: true, report }, null, 2));
