import assert from "node:assert/strict";
import { createJobSetupWindowSchedule } from "../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import {
  canonicalWindowScheduleFromTakeoffJob,
  canonicalJobSetupWindowItem,
  sortWindowScheduleItemsByLevel,
  WINDOW_SCHEDULE_LEVEL_ORDER,
} from "../lib/builders/windowScheduleProjection.js";

// Synthetic two-level job: an exterior wall run on each of Ground Floor and Second Level, each
// hosting windows - including two windows with the IDENTICAL type/width/height on different
// levels, which is exactly the case the old type+size bucketing in Client Selections would have
// silently merged into one row. Also includes one internal door (must never appear in the window
// schedule) and one external door (must be excluded from the *window*-only projection but would
// still count in Job Setup's own combined Window Schedule table).
const PIXELS_PER_MM = 1;

function wall({ id, page, x1, y1, x2, y2, category = "Exterior", wallSystem = "Rendered Brick Veneer" }) {
  return {
    id,
    page,
    nodes: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    category,
    wallSystem,
    thicknessMm: 110,
  };
}

function opening({ id, page, hostWallId, widthMm, heightMm, type = "window", frameColour = "White", subType, location, glassType }) {
  return {
    id,
    page,
    hostWallId,
    type,
    widthMm,
    heightMm,
    frameColour,
    subType,
    location,
    glassType,
  };
}

const completedWallRuns = [
  wall({ id: "wall-ground-1", page: 1, x1: 0, y1: 0, x2: 4000, y2: 0 }),
  wall({ id: "wall-upper-1", page: 2, x1: 0, y1: 0, x2: 4000, y2: 0 }),
];

const placedOpenings = [
  // Ground Floor: 1809 window (1800h x 900w) + a duplicate-spec window at a different opening.
  opening({ id: "opening-ground-1", page: 1, hostWallId: "wall-ground-1", widthMm: 900, heightMm: 1800 }),
  opening({ id: "opening-ground-2", page: 1, hostWallId: "wall-ground-1", widthMm: 900, heightMm: 1800 }),
  // Second Level: same 1809 spec again - must stay a DISTINCT row from the ground floor ones.
  opening({ id: "opening-upper-1", page: 2, hostWallId: "wall-upper-1", widthMm: 900, heightMm: 1800 }),
  // Ground Floor: a different sized window (1809 vs 1212-style code).
  opening({ id: "opening-ground-3", page: 1, hostWallId: "wall-ground-1", widthMm: 1200, heightMm: 1200 }),
  // External door on the same exterior wall - must be excluded from the WINDOW-only projection
  // (it still counts in Job Setup's own combined Window Schedule table, just as an "External Door" row).
  opening({ id: "opening-ground-door", page: 1, hostWallId: "wall-ground-1", widthMm: 900, heightMm: 2100, type: "door", frameColour: undefined }),
  // A Fixed Glass window (opening.subType 'FG', the real AIPlanTakeoffStandalone.jsx "Window Type"
  // dropdown value) with real Location/Glass Type filled in on the opening itself - proves those
  // fields thread all the way from the raw opening through to the Client Selections item, and that
  // isFixed is read from the real subType, not guessed.
  opening({ id: "opening-bathroom-fixed", page: 1, hostWallId: "wall-ground-1", widthMm: 600, heightMm: 900, subType: "FG", location: "Bathroom", glassType: "Obscured" }),
  // An opening (non-fixed) window with its own real Location/Glass Type.
  opening({ id: "opening-living-awning", page: 1, hostWallId: "wall-ground-1", widthMm: 1200, heightMm: 900, subType: "AW", location: "Living", glassType: "Clear" }),
];

const sheetLevels = { 1: "Ground Floor", 2: "Second Level" };

const takeoffJobInputs = {
  completedWallRuns,
  placedOpenings,
  pixelsPerMm: PIXELS_PER_MM,
  sheetLevels,
  jobSetupRows: {},
};

// --- 1. The canonical Job Setup Window Schedule itself (unchanged, read-only import) ---
const jobSetupSchedule = createJobSetupWindowSchedule(takeoffJobInputs);
const jobSetupWindowRows = jobSetupSchedule.rows.filter((row) => row.openingType === "Window");
assert.equal(jobSetupWindowRows.length, 6, "Job Setup should show 6 window rows (2x duplicate ground, 1x upper, 1x different size, 1x fixed bathroom, 1x awning living) - one external door excluded");
assert.ok(jobSetupSchedule.rows.some((row) => row.openingType === "External Door"), "Job Setup's own combined schedule keeps the external door row");

// --- 2. The Client Selections projection must reuse those SAME rows, not re-bucket them ---
const projection = canonicalWindowScheduleFromTakeoffJob(takeoffJobInputs);
assert.ok(projection, "projection must be produced when a takeoff job with windows exists");
assert.equal(projection.rows.length, jobSetupWindowRows.length, "Client Selections must show the same window row count as Job Setup");
assert.deepEqual(
  projection.rows.map((row) => row.itemId).sort(),
  jobSetupWindowRows.map((row) => row.itemId).sort(),
  "Client Selections rows must be keyed by the exact same stable itemId Job Setup uses"
);

// --- 3. Stable identity: each physical opening keeps its OWN id, never window_schedule_N ---
projection.items.forEach((item) => {
  assert.ok(!/^window_schedule_\d+$/.test(item.id), `item id must not be a synthetic bucket id: ${item.id}`);
  assert.ok(placedOpenings.some((o) => o.id === item.id), `item id ${item.id} must be a real opening id`);
});

// --- 4. The two ground-floor duplicates AND the upper-level duplicate must all remain distinct rows ---
const duplicateSpecItems = projection.items.filter((item) => item.widthMm === 900 && item.heightMm === 1800);
assert.equal(duplicateSpecItems.length, 3, "three physically distinct 900x1800 windows (2 ground + 1 upper) must not be merged into one row");
assert.deepEqual(
  new Set(duplicateSpecItems.map((item) => item.id)).size,
  3,
  "each duplicate-spec window must keep a distinct stable id"
);

// --- 5. Field-by-field: Level / Type / Window Code / Height / Width / Qty / Area m2 / Wall System ---
const groundDuplicate = projection.items.find((item) => item.id === "opening-ground-1");
assert.equal(groundDuplicate.floor, "Ground Floor");
assert.equal(groundDuplicate.type, "Window");
assert.equal(groundDuplicate.windowCode, "1809", "1800mm high x 900mm wide must code as 1809, matching Job Setup's windowCodeForOpening");
assert.equal(groundDuplicate.heightMm, 1800);
assert.equal(groundDuplicate.widthMm, 900);
assert.equal(groundDuplicate.quantity, 1);
assert.equal(groundDuplicate.areaM2, jobSetupWindowRows.find((r) => r.itemId === "opening-ground-1").openingAreaM2, "areaM2 must come straight from the canonical row, not be recomputed");
assert.equal(groundDuplicate.wallSystem, "Rendered Brick Veneer");

// --- 6. Level ordering: Ground Floor before Second Level, canonical labels preserved verbatim ---
const floorsInOrder = projection.items.map((item) => item.floor);
const groundIndex = floorsInOrder.indexOf("Ground Floor");
const upperIndex = floorsInOrder.indexOf("Second Level");
assert.ok(groundIndex !== -1 && upperIndex !== -1 && groundIndex < upperIndex, "Ground Floor rows must sort before Second Level rows");
assert.ok(!floorsInOrder.some((floor) => floor === "Ground Level" || floor === "Upper" || floor === "Level 1"), "canonical level labels must never be remapped");

// --- 7. Reconciliation: removing one opening drops only that row; the rest keep their identity ---
const reconciledInputs = { ...takeoffJobInputs, placedOpenings: placedOpenings.filter((o) => o.id !== "opening-ground-2") };
const reconciledProjection = canonicalWindowScheduleFromTakeoffJob(reconciledInputs);
assert.equal(reconciledProjection.items.length, projection.items.length - 1, "removing one opening must remove exactly one row");
assert.ok(!reconciledProjection.items.some((item) => item.id === "opening-ground-2"), "the removed opening's row must be gone");
["opening-ground-1", "opening-upper-1", "opening-ground-3"].forEach((id) => {
  assert.ok(reconciledProjection.items.some((item) => item.id === id), `unaffected opening ${id} must keep its identity after another opening is removed`);
});

// --- 8. No takeoff / no windows -> null, so a caller can fall back rather than crash ---
assert.equal(canonicalWindowScheduleFromTakeoffJob({}), null, "no placed openings must yield null");
assert.equal(canonicalWindowScheduleFromTakeoffJob({ placedOpenings: [placedOpenings[4]] }), null, "an external-door-only takeoff (no windows) must yield null so the caller can fall back");

// --- 9. sortWindowScheduleItemsByLevel / canonicalJobSetupWindowItem exported and independently usable ---
const rawItem = canonicalJobSetupWindowItem({ itemId: "x1", level: "Third Level", openingType: "Window", windowCode: "0909", widthMm: 900, heightMm: 900, quantity: 2, openingAreaM2: 1.62, wallSystem: "Rendered Brick Veneer" }, 0);
assert.equal(rawItem.id, "x1");
assert.equal(rawItem.quantity, 2);
const sorted = sortWindowScheduleItemsByLevel([
  { id: "b", floor: "Second Level", windowCode: "0909" },
  { id: "a", floor: "Ground Floor", windowCode: "1809" },
  { id: "c", floor: "Unassigned Sheet 3", windowCode: "0606" },
]);
assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "c"], "unknown levels sort after the canonical order, never dropped");
assert.deepEqual(WINDOW_SCHEDULE_LEVEL_ORDER, ["Ground Floor", "Second Level", "Third Level"]);

// --- 10. Room/Location, Glass Type, opening style and isFixed thread all the way through from the
// raw opening's own real fields (opening.location, opening.glassType, opening.subType) - the exact
// same fields AIPlanTakeoffStandalone.jsx's editor writes to - never fabricated, never guessed. ---
const bathroomFixed = projection.items.find((item) => item.id === "opening-bathroom-fixed");
assert.equal(bathroomFixed.location, "Bathroom", "Room/Location must thread through from opening.location");
assert.equal(bathroomFixed.glassType, "Obscured", "Glass Type must thread through from opening.glassType");
assert.equal(bathroomFixed.openingStyle, "Fixed Window", "subType 'FG' must resolve to the real Fixed Window style label");
assert.equal(bathroomFixed.isFixed, true, "subType 'FG' must set isFixed true");

const livingAwning = projection.items.find((item) => item.id === "opening-living-awning");
assert.equal(livingAwning.location, "Living");
assert.equal(livingAwning.glassType, "Clear");
assert.equal(livingAwning.openingStyle, "Awning Window", "subType 'AW' must resolve to Awning Window");
assert.equal(livingAwning.isFixed, false, "an awning window must not be classified as fixed");

// Openings with no location/glassType/subType filled in yet must stay honestly empty, never
// "Unspecified" or any other fabricated placeholder.
assert.equal(groundDuplicate.location, "", "an opening with no Location/room filled in must read as '', not a fabricated value");
assert.equal(groundDuplicate.glassType, "", "an opening with no Glass Type filled in must read as '', not a fabricated value");
assert.equal(groundDuplicate.isFixed, false, "an opening with no subType must not be classified as fixed");

// --- 11. Regression: an opening with NO pre-set hostWallId (exactly what a freshly-placed/AI-
// detected opening looks like before anything manually links it to a wall) must still resolve its
// wall system by geometry - point-in-polygon / nearest-wall-segment against the opening's own
// x/y - on EVERY level, not just the one that happens to already have a stored hostWallId. This is
// the exact bug this test guards against: associateTakeoffMeasurements takes pixelsPerMm as its
// second argument specifically to convert opening/wall pixel coordinates into real-world mm for
// that geometric match; every call site in takeoffSchedule.js used to omit it, silently turning
// every coordinate into NaN and permanently disabling geometric linking - openings that happened to
// already carry a valid hostWallId still resolved (the fast path above never needed geometry), but
// any opening relying on the geometric fallback (no stored host link) never linked, and its Wall
// System rendered as "" ("-" in the UI) even though its wall's own construction was fully and
// correctly classified elsewhere in the same schedule.
function wallWithSystem({ id, page, x1, y1, x2, y2, constructionSystem, frameThicknessMm, exteriorFinish }) {
  return {
    id, page, nodes: [{ x: x1, y: y1 }, { x: x2, y: y2 }], category: "Exterior",
    constructionSystem, frameThicknessMm, exteriorFinish, thicknessMm: 110,
  };
}

const geometryWalls = [
  // Ground Floor: 230mm Brick Veneer, page 1.
  wallWithSystem({ id: "wall-ground-brick", page: 1, x1: 0, y1: 0, x2: 4000, y2: 0, constructionSystem: "brick_veneer", frameThicknessMm: 70 }),
  // Second Level: Lightweight Cladding / 70mm frame / James Hardie Linea Weatherboard, page 2 -
  // geometrically identical wall shape to the ground floor one, on a different page/level, so a
  // page-blind bug (matching across pages) would misattribute it, and a broken geometric match
  // would leave it unlinked entirely.
  wallWithSystem({ id: "wall-upper-cladding", page: 2, x1: 0, y1: 0, x2: 4000, y2: 0, constructionSystem: "lightweight_cladding", frameThicknessMm: 70, exteriorFinish: "James Hardie Linea Weatherboard - 180mm" }),
];

// No hostWallId on either opening - both must be resolved purely from their x/y position against
// their own level's wall, exercising the geometric fallback exactly as a freshly-placed opening
// (nothing has linked it yet) would on either level.
const geometryOpenings = [
  { id: "opening-ground-geo", page: 1, x: 1000, y: 5, type: "window", widthMm: 900, heightMm: 1800 },
  { id: "opening-upper-geo", page: 2, x: 1000, y: 5, type: "window", widthMm: 900, heightMm: 1800 },
];

const geometryInputs = {
  completedWallRuns: geometryWalls,
  placedOpenings: geometryOpenings,
  pixelsPerMm: PIXELS_PER_MM,
  sheetLevels,
  jobSetupRows: {},
};

const geometrySchedule = createJobSetupWindowSchedule(geometryInputs);
const groundGeoRow = geometrySchedule.rows.find((row) => row.itemId === "opening-ground-geo");
const upperGeoRow = geometrySchedule.rows.find((row) => row.itemId === "opening-upper-geo");

assert.ok(groundGeoRow, "the Ground Floor opening (no hostWallId) must still appear in the schedule - it must link to its wall by geometry");
assert.ok(upperGeoRow, "the Second Level opening (no hostWallId) must still appear in the schedule - it must link to its wall by geometry, exactly like Ground Floor");

assert.equal(groundGeoRow.wallId, "wall-ground-brick", "the ground floor opening must link to the ground floor wall specifically, not the upper one");
assert.equal(upperGeoRow.wallId, "wall-upper-cladding", "the upper level opening must link to the upper level wall specifically, not the ground one");

assert.equal(groundGeoRow.wallSystem, "Face Brick Veneer", "ground floor window must inherit its own wall's real construction system, not a default");
assert.equal(upperGeoRow.wallSystem, "Lightweight Cladding", "second level window must inherit its own wall's real construction system - proving the association is not broken on this level");
assert.notEqual(upperGeoRow.wallSystem, "", "second level window's wall system must never render as blank/'-' when its wall is fully classified");
assert.notEqual(upperGeoRow.wallSystem, groundGeoRow.wallSystem, "each level's window must resolve its OWN wall's system, never copied from another level");

// The richer wall-system reference (frame thickness + cladding product) must also be retained on
// the row, not just the flattened label, so downstream estimating/product logic can read it.
assert.equal(upperGeoRow.wallFrameThicknessMm, 70, "the upper level window must retain its wall's frame thickness");
assert.equal(upperGeoRow.wallExteriorFinish, "James Hardie Linea Weatherboard - 180mm", "the upper level window must retain its wall's cladding product, not just the short 'Lightweight Cladding' label");

// The exact same projection into Client Selections must carry the resolved wall system through too.
const geometryProjection = canonicalWindowScheduleFromTakeoffJob(geometryInputs);
const upperGeoItem = geometryProjection.items.find((item) => item.id === "opening-upper-geo");
assert.equal(upperGeoItem.wallSystem, "Lightweight Cladding", "Client Selections must show the same resolved wall system as Job Setup, not re-derive or default it");
assert.equal(upperGeoItem.wallExteriorFinish, "James Hardie Linea Weatherboard - 180mm", "Client Selections must retain the full wall-system reference too");

console.log("Window schedule canonical projection tests passed.");
