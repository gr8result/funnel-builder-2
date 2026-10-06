import assert from "node:assert/strict";
import { syncWindowsFromTakeoff, windowQuotationRow, syncWindowQuotationFromTakeoff, WINDOWS_PARENT_SECTION, WINDOWS_QUOTATION_SUBSECTIONS, GLASS_SLIDING_DOORS_SECTION, FLYSCREENS_SECTION, SECURITY_SCREENS_SECTION } from "../lib/builders/windowQuotationSync.js";

const PIXELS_PER_MM = 1;
function wall({ id, page, x1, y1, x2, y2 }) {
  return { id, page, nodes: [{ x: x1, y: y1 }, { x: x2, y: y2 }], category: "Exterior", wallSystem: "Rendered Brick Veneer", thicknessMm: 110 };
}
function opening({ id, page, hostWallId, widthMm, heightMm, type = "window", subType, flyscreenRequired, securityScreenRequired }) {
  return { id, page, hostWallId, type, widthMm, heightMm, subType, flyscreenRequired, securityScreenRequired };
}

const completedWallRuns = [wall({ id: "wall-1", page: 1, x1: 0, y1: 0, x2: 10000, y2: 0 })];
const sheetLevels = { 1: "Ground Floor" };

// --- 1/2/3/4: single window, identical-pair aggregation, and same-size-different-type non-merge ---
const placedOpenings = [
  opening({ id: "o1", page: 1, hostWallId: "wall-1", widthMm: 600, heightMm: 600, subType: "standard" }), // QX0606 sliding
  opening({ id: "o2", page: 1, hostWallId: "wall-1", widthMm: 600, heightMm: 600, subType: "standard" }), // duplicate sliding -> aggregate
  opening({ id: "o3", page: 1, hostWallId: "wall-1", widthMm: 600, heightMm: 600, subType: "CA" }), // same size, CASEMENT -> must NOT merge with sliding
  opening({ id: "o4", page: 1, hostWallId: "wall-1", widthMm: 1200, heightMm: 2100, subType: "SlidingGlass", type: "door" }), // glass sliding door, 2100H x 1200W (GSD2112)
  opening({ id: "o5", page: 1, hostWallId: "wall-1", widthMm: 690, heightMm: 690, subType: "standard" }), // non-standard size -> unmatched
  opening({ id: "o6", page: 1, hostWallId: "wall-1", widthMm: 900, heightMm: 900, subType: "AW", flyscreenRequired: true }), // awning + flyscreen only
  opening({ id: "o7", page: 1, hostWallId: "wall-1", widthMm: 1200, heightMm: 1200, subType: "FG", securityScreenRequired: true }), // fixed + security screen only, no flyscreen
];

const takeoffJobInputs = { completedWallRuns, placedOpenings, pixelsPerMm: PIXELS_PER_MM, sheetLevels, jobSetupRows: {} };
const { matched, unmatched } = syncWindowsFromTakeoff(takeoffJobInputs, {});

const sliding = matched.find((m) => m.product.code === "QX0606");
assert.ok(sliding, "600x600 sliding window must resolve to catalogue code QX0606");
assert.equal(sliding.group.quantity, 2, "two identical 600x600 sliding windows must aggregate to qty 2, not two rows");
assert.equal(sliding.sectionName, WINDOWS_QUOTATION_SUBSECTIONS["Sliding Window"], "sliding windows must land in the Sliding subsection");

const casement = matched.find((m) => m.product.code === "QC0606");
assert.ok(casement, "600x600 casement window must resolve to its OWN catalogue code QC0606, not the sliding one");
assert.equal(casement.group.quantity, 1, "the single casement must not be merged into the sliding window's count just because dimensions match");
assert.notEqual(casement.sectionName, sliding.sectionName, "casement and sliding must land in different subsections");

const gsd = matched.find((m) => m.sectionName === GLASS_SLIDING_DOORS_SECTION);
assert.ok(gsd, "the 2100H x 1200W SlidingGlass door must resolve into GLASS SLIDING DOORS, not the window subsections");
assert.equal(gsd.product.code, "GSD2112", "must match the exact GSD catalogue code for 2100H x 1200W");

const unmatchedSize = unmatched.find((u) => u.heightMm === 690 && u.widthMm === 690);
assert.ok(unmatchedSize, "a non-standard 690x690 size must come back unmatched rather than being guessed to the nearest size");
assert.equal(unmatchedSize.reason, "no-size-match");

const flyscreenRow = matched.find((m) => m.sectionName === FLYSCREENS_SECTION);
assert.ok(flyscreenRow, "the awning window flagged flyscreenRequired must produce its own FLYSCREENS row");
assert.equal(flyscreenRow.product.windowCode, "QA0909", "the flyscreen must be tied to its own window's catalogue code (900x900 awning)");
assert.equal(matched.some((m) => m.sectionName === SECURITY_SCREENS_SECTION && m.product.windowCode === "QA0909"), false, "the awning window did NOT request a security screen - none must be generated for it");

const securityScreenRow = matched.find((m) => m.sectionName === SECURITY_SCREENS_SECTION);
assert.ok(securityScreenRow, "the fixed-glass window flagged securityScreenRequired must produce its own SECURITY SCREENS row");
assert.equal(matched.some((m) => m.sectionName === FLYSCREENS_SECTION && m.product.windowCode === "QF1212"), false, "the fixed window did NOT request a flyscreen - none must be generated for it");

// --- Multiple storeys: same style+size on two different levels/pages must still aggregate by
// identity+dimensions alone (the catalogue has no per-level pricing distinction) ---
const twoStoreyWalls = [
  wall({ id: "wall-ground", page: 1, x1: 0, y1: 0, x2: 10000, y2: 0 }),
  wall({ id: "wall-upper", page: 2, x1: 0, y1: 0, x2: 10000, y2: 0 }),
];
const twoStoreyOpenings = [
  opening({ id: "g1", page: 1, hostWallId: "wall-ground", widthMm: 900, heightMm: 900, subType: "standard" }),
  opening({ id: "u1", page: 2, hostWallId: "wall-upper", widthMm: 900, heightMm: 900, subType: "standard" }),
];
const twoStoreySync = syncWindowsFromTakeoff({
  completedWallRuns: twoStoreyWalls, placedOpenings: twoStoreyOpenings, pixelsPerMm: PIXELS_PER_MM,
  sheetLevels: { 1: "Ground Floor", 2: "Second Level" }, jobSetupRows: {},
}, {});
const crossLevelSliding = twoStoreySync.matched.find((m) => m.product.code === "QX0909");
assert.ok(crossLevelSliding, "900x900 sliding windows across two levels must still resolve to QX0909");
assert.equal(crossLevelSliding.group.quantity, 2, "one ground-floor + one second-level 900x900 sliding window must aggregate to qty 2");

// --- Stable row id / re-sync without duplicates ---
const row1 = windowQuotationRow(sliding);
const row2 = windowQuotationRow(matched.find((m) => m.product.code === "QX0606"));
assert.equal(row1.id, row2.id, "the same matched product+size must always produce the SAME row id, so re-syncing never creates a duplicate row");
assert.equal(row1.quantity, "2", "the generated row's quantity string must reflect the aggregated takeoff count");
assert.equal(row1.brand, "Trend");
assert.equal(row1.sku, "QX0606");
assert.ok(row1.priceStatus.includes("ESTIMATED TEMPLATE PRICE"), "the generated row must carry the template price-status label through, never presenting it as verified pricing");

// --- Workbook-level sync: no duplicate rows on re-sync, quantity change updates in place,
// manual overrides preserved, existing unrelated sections untouched ---
// Synced rows are written directly into Section 53 WINDOWS (the job's existing WINDOWS section).
const slidingSection = WINDOWS_PARENT_SECTION;
const slidingRowsIn = (wb) => wb.quotation[slidingSection].rows.filter((row) => row.productCode === "QX0606");
let workbook = { quotation: { "PRELIMINARIES": { rows: [{ id: "quote-1", item: "SITE ESTABLISHMENT" }] } } };
const first = syncWindowQuotationFromTakeoff(takeoffJobInputs, workbook);
workbook = first.workbook;
assert.equal(workbook.quotation["PRELIMINARIES"].rows.length, 1, "an unrelated existing section must be untouched by the windows sync");
const firstSlidingRows = slidingRowsIn(workbook);
assert.equal(firstSlidingRows.length, 1, "one sliding-window row (QX0606, aggregated qty 2) must be created");
assert.equal(firstSlidingRows[0].quantity, "2");

// Re-sync with the SAME takeoff data must not duplicate the row.
const resynced = syncWindowQuotationFromTakeoff(takeoffJobInputs, workbook).workbook;
assert.equal(slidingRowsIn(resynced).length, 1, "re-syncing identical takeoff data must not create a duplicate row");

// Takeoff quantity change (add a third identical sliding window) must UPDATE the existing row, not add a second.
const changedOpenings = [...placedOpenings, opening({ id: "o8", page: 1, hostWallId: "wall-1", widthMm: 600, heightMm: 600, subType: "standard" })];
const changedInputs = { ...takeoffJobInputs, placedOpenings: changedOpenings };
const afterChange = syncWindowQuotationFromTakeoff(changedInputs, resynced).workbook;
assert.equal(slidingRowsIn(afterChange).length, 1, "a takeoff quantity change must update the existing row in place, never add a second row for the same product");
assert.equal(slidingRowsIn(afterChange)[0].quantity, "3", "the existing row's quantity must reflect the new takeoff count (3)");

// A manually-overridden row must survive a re-sync untouched.
const manuallyEdited = {
  ...afterChange,
  quotation: {
    ...afterChange.quotation,
    [slidingSection]: {
      rows: afterChange.quotation[slidingSection].rows.map((row) => row.id === firstSlidingRows[0].id ? { ...row, quantity: "99", quantityManualOverride: true } : row),
    },
  },
};
const afterManualEditResync = syncWindowQuotationFromTakeoff(changedInputs, manuallyEdited).workbook;
assert.equal(afterManualEditResync.quotation[slidingSection].rows.find((row) => row.id === firstSlidingRows[0].id)?.quantity, "99", "a manually-overridden quantity must survive a re-sync, never be silently replaced by the takeoff value");

// --- Section 53 display: rows land in the job's existing WINDOWS section with product/code/size/qty/price ---
const realWorkbook = { quotation: {
  "WINDOWS (46)": { collapsed: true, rows: [
    { id: "quote-748", excelRow: 748, item: "ITEM", unit: "UNIT" },
    { id: "quote-750", excelRow: 750, item: "WINDOWS QUOTE", unit: "QUOTE" },
    { id: "quote-753", excelRow: 753, section: "WINDOWS (46)", item: "FLYSCREEN QUOTE", unit: "QUOTE" },
  ] },
  // Left behind by the earlier subsection-based sync - must be folded into Section 53.
  "WINDOWS - SLIDING": { rows: [{ ...windowQuotationRow(sliding), section: "WINDOWS - SLIDING", quantity: "1" }] },
} };
const section53Sync = syncWindowQuotationFromTakeoff({ ...takeoffJobInputs, placedOpenings: [
  ...[1, 2, 3, 4, 5, 6].map((n) => opening({ id: `s${n}`, page: 1, hostWallId: "wall-1", widthMm: 1800, heightMm: 1200, subType: "standard", flyscreenRequired: true })),
  ...placedOpenings,
] }, realWorkbook);
const section53 = section53Sync.workbook.quotation["WINDOWS (46)"];
assert.ok(section53, "rows must be written into the job's existing Section 53 WINDOWS section, not a new section");
assert.equal(section53.collapsed, false, "Section 53 opens after a sync so the product rows are visible");
assert.equal(section53Sync.workbook.quotation["WINDOWS - SLIDING"], undefined, "rows from the old subsection-based sync move into Section 53 and the empty subsection is removed");
assert.ok(!Object.keys(section53Sync.workbook.quotation).some((name) => /^(WINDOWS - |GLASS SLIDING DOORS|FLYSCREENS|SECURITY SCREENS)/.test(name)), "no separate window subsections are created");
const qx1218 = section53.rows.find((row) => row.productCode === "QX1218");
assert.ok(qx1218, "1200H x 1800W sliding windows must appear in Section 53 as catalogue product QX1218");
assert.equal(qx1218.item, "1218 Sliding Window - 1200H x 1800W");
assert.equal(qx1218.quantity, "6");
assert.equal(qx1218.unit, "EACH");
assert.equal(qx1218.excelRate, "$1002.36", "price comes from the catalogue row");
assert.equal(qx1218.section, "WINDOWS (46)");
assert.equal(section53.rows.filter((row) => row.productCode === "QX0606").length, 1, "the legacy QX0606 row and the fresh sync collapse to one row");
assert.equal(section53.rows.find((row) => row.productCode === "QX0606").quantity, "2", "the fresh takeoff quantity replaces the legacy row's quantity");
assert.ok(section53.rows.some((row) => row.productCode === "GSD2112"), "glass sliding door row is in Section 53");
const flyscreenRows = section53.rows.filter((row) => row.windowGroup === FLYSCREENS_SECTION);
assert.ok(flyscreenRows.some((row) => row.productCode === "QX1218-FS" && row.quantity === "6"), "flyscreens are their own product rows");
assert.ok(section53.rows.some((row) => row.windowGroup === SECURITY_SCREENS_SECTION), "security screens are their own product rows");
assert.deepEqual(section53.rows.slice(0, 3).map((row) => row.id), ["quote-748", "quote-750", "quote-753"], "existing Section 53 rows stay ahead of the synced product rows");
const groupOrder = section53.rows.filter((row) => row.windowGroup).map((row) => row.windowGroup);
assert.ok(groupOrder.indexOf(FLYSCREENS_SECTION) > groupOrder.lastIndexOf(GLASS_SLIDING_DOORS_SECTION), "window types, then glass sliding doors, then screens");
assert.deepEqual(section53.rows.filter((row) => row.windowSyncHeading).map((row) => row.item), ["WINDOW SCHEDULE", "GLASS SLIDING DOORS", "FLYSCREENS", "SECURITY SCREENS"], "Section 53 lists windows, glass sliding doors, flyscreens and security screens under their own headings");
const headingIndex = (name) => section53.rows.findIndex((row) => row.windowSyncHeading && row.item === name);
assert.ok(section53.rows.slice(headingIndex("FLYSCREENS") + 1, headingIndex("SECURITY SCREENS")).every((row) => row.windowGroup === FLYSCREENS_SECTION), "only flyscreens are listed under FLYSCREENS");
assert.ok(section53.rows.slice(headingIndex("SECURITY SCREENS") + 1).every((row) => row.windowGroup === SECURITY_SCREENS_SECTION), "only security screens are listed under SECURITY SCREENS");
assert.equal(qx1218.productDescription, "Window code 1218 · Sliding Window · H 1200 mm x W 1800 mm", "description shows window code, type, height and width");
const resyncedSection53 = syncWindowQuotationFromTakeoff({ ...takeoffJobInputs, placedOpenings: [...placedOpenings] }, section53Sync.workbook).workbook.quotation["WINDOWS (46)"];
assert.equal(resyncedSection53.rows.filter((row) => row.windowSyncHeading && row.item === "WINDOW SCHEDULE").length, 1, "re-syncing never duplicates a heading");

const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");
const quietLog = console.log; console.log = () => {};
const calculated = calculateEstimateBuilderWorkbook(section53Sync.workbook);
console.log = quietLog;
const calculatedRows = calculated.quotation["WINDOWS (46)"].rows;
assert.equal(calculatedRows.some((row) => /FLYSCREENS - ALLOWANCE/.test(row.item)), false, "the obsolete 10% flyscreen allowance row is removed once catalogue rows are synced");
assert.equal(calculatedRows.some((row) => row.item === "WINDOWS QUOTE"), false, "the obsolete WINDOWS QUOTE placeholder is removed once catalogue rows are synced");
assert.ok(calculatedRows.some((row) => row.item === "ITEM"), "unrelated existing Section 53 rows stay");
const calculatedQx1218 = calculatedRows.find((row) => row.productCode === "QX1218");
assert.equal(calculatedQx1218.qty, 6);
assert.equal(calculatedQx1218.cost, 6014.16, "6 x $1002.36 catalogue price");

console.log("Window quotation sync checks passed: catalogue matching, type-vs-size non-merge, aggregation, GSD, flyscreen/security-screen separation, unmatched sizes, cross-level aggregation, stable re-sync ids, no-duplicate re-sync, in-place quantity update, and manual-override preservation.");
