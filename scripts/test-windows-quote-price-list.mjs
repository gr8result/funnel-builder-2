import assert from "node:assert/strict";
import { withWindowsPriceListQuotation, windowsPriceListQuoteRows, windowPriceListTakeoffQuantities } from "../lib/construction-estimation/windowsQuotePriceList.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

// Section 53 WINDOWS carries exactly the supplied window/door sizes (329) + the flyscreens that fit them
// (258 supplied + 5 awning 1500H flyscreens priced from the supplied equal-size awning flyscreen) + 3 headings.
const listRows = windowsPriceListQuoteRows();
assert.equal(listRows.length, 329 + 258 + 5 + 3);
assert.ok(listRows.some((row) => row.item === "1506 Awning Flyscreen - 1500H x 600W" && row.excelRate === "$98.55"), "1506 awning flyscreen is in the price list at the 600H x 1500W awning flyscreen price");
assert.equal(listRows.every((row) => row.windowPriceListHeading || !/Flyscreen/.test(row.item) || row.item.startsWith(`${row.windowCode} `)), true);
assert.deepEqual(listRows.filter((row) => row.windowPriceListHeading).map((row) => row.item), ["WINDOW SCHEDULE", "GLASS SLIDING DOORS", "FLYSCREENS"]);
const row1218 = listRows.find((row) => row.item === "1218 Sliding Window - 1200H x 1800W");
assert.equal(row1218.excelRate, "$1,002.36");
assert.equal(row1218.unit, "EACH");
assert.ok(listRows.some((row) => row.item === "1218 Sliding Window Flyscreen - 1200H x 1800W" && row.excelRate === "$180.42"), "flyscreen carries its window's number");
assert.equal(listRows.some((row) => /Fixed Glass Flyscreen/.test(row.item)), false, "no flyscreens for fixed glass");

// Merged into the job's existing WINDOWS section; placeholder rows removed; edits kept; idempotent.
const saved = { "WINDOWS (46)": { rows: [
  { id: "quote-748", excelRow: 748, item: "ITEM", unit: "UNIT" },
  { id: "quote-750", excelRow: 750, item: "WINDOWS QUOTE", unit: "QUOTE" },
  { id: "quote-753", excelRow: 753, item: "FLYSCREEN QUOTE", unit: "QUOTE" },
  { id: "manual-1", item: "My extra window line", quantity: "1" },
  { id: row1218.id, item: row1218.item, quantity: "9", quantityManualOverride: true, notes: "kept" },
] } };
const merged = withWindowsPriceListQuotation(saved);
const section = merged["WINDOWS (46)"].rows;
assert.deepEqual(section.slice(0, 2).map((row) => row.id), ["quote-748", "manual-1"]);
assert.equal(section.some((row) => /WINDOWS QUOTE|FLYSCREEN QUOTE/.test(row.item)), false);
const kept = section.find((row) => row.id === row1218.id);
assert.equal(kept.quantity, "9");
assert.equal(kept.notes, "kept");
assert.equal(withWindowsPriceListQuotation(merged), merged, "re-applying is a no-op");

// Quantities come from the takeoff Window Schedule.
const wall = { id: "w1", page: 1, nodes: [{ x: 0, y: 0 }, { x: 60000, y: 0 }], category: "Exterior", wallSystem: "Rendered Brick Veneer", thicknessMm: 110 };
const opening = (id, widthMm, heightMm, subType, extra = {}) => ({ id, page: 1, hostWallId: "w1", type: "window", widthMm, heightMm, subType, ...extra });
const workbook = {
  quotation: withWindowsPriceListQuotation({ "WINDOWS (46)": { rows: saved["WINDOWS (46)"].rows.slice(0, 3) } }),
  aiPlanTakeoffJob: { pixelsPerMm: 1, sheetLevels: { 1: "Ground Floor" }, completedWallRuns: [wall], placedOpenings: [
    ...[1, 2, 3, 4, 5, 6].map((n) => opening(`s${n}`, 1800, 1200, "standard")),
    opening("gsd", 1500, 2100, "SlidingGlass", { type: "door" }),
    opening("odd", 690, 690, "standard"),
    opening("fixed", 1800, 1200, "FG", { flyscreenRequired: true }),
  ] },
};
const { unmatched } = windowPriceListTakeoffQuantities(workbook);
assert.deepEqual(unmatched.map((u) => `${u.kind} ${u.productType} ${u.heightMm}x${u.widthMm}`), ["window Sliding Window 690x690", "flyscreen Sliding Window 690x690"], "sizes not in the price list are reported, not guessed");
const log = console.log; console.log = () => {};
const preview = calculateEstimateBuilderWorkbook(workbook);
console.log = log;
const rows = preview.quotation["WINDOWS (46)"].rows;
const qtyOf = (item) => rows.find((row) => row.item === item)?.qty;
assert.equal(qtyOf("1218 Sliding Window - 1200H x 1800W"), 6);
assert.equal(qtyOf("1218 Sliding Window Flyscreen - 1200H x 1800W"), 6);
assert.equal(qtyOf("2115 Glass Sliding Door - Single Opening Panel - 2100H x 1500W"), 1);
assert.equal(qtyOf("1218 Fixed Glass - 1200H x 1800W"), 1);
assert.equal(qtyOf("2115 Glass Sliding Door Flyscreen - 2100H x 1500W"), 1, "every window/door gets a flyscreen with the same Qty");
assert.equal(rows.some((row) => /Fixed Glass Flyscreen/.test(row.item)), false);
assert.equal(preview.quotation["WINDOWS (46)"].subtotal, Math.round((6014.16 + 1082.52 + 1406.77 + 253.22 + 735.60) * 100) / 100, "fixed glass priced, but no flyscreen added for it");

// A Qty typed over a window row carries through to its flyscreen.
const edited = { ...workbook, quotation: { "WINDOWS (46)": { rows: workbook.quotation["WINDOWS (46)"].rows.map((row) => row.item === "1218 Sliding Window - 1200H x 1800W" ? { ...row, quantity: "4", quantityManualOverride: true } : row) } } };
console.log = () => {};
const editedRows = calculateEstimateBuilderWorkbook(edited).quotation["WINDOWS (46)"].rows;
console.log = log;
assert.equal(editedRows.find((row) => row.item === "1218 Sliding Window - 1200H x 1800W").qty, 4);
assert.equal(editedRows.find((row) => row.item === "1218 Sliding Window Flyscreen - 1200H x 1800W").qty, 4);
assert.equal(rows.some((row) => /ALLOWANCE \(10%/.test(row.item)), false);
assert.equal(preview.windowScheduleUnmatched.length, 2);
const odd = rows.find((row) => row.item === "Sliding Window - 690H x 690W");
assert.ok(odd && odd.qty === 1 && odd.cost === 0 && odd.quoteRequired && odd.sourceOfRate === "rate missing", "an unmatched size is a visible unpriced Section 53 line");

// The reported job shape: a Laundry window, two custom fixed glass windows, a 1506 awning, an
// unmapped window type, a float-measured standard size, and an entry door (quoted elsewhere).
const job = { pixelsPerMm: 1, sheetLevels: { 1: "Ground Floor" }, completedWallRuns: [wall], placedOpenings: [
  opening("laundry", 610, 1030, "standard", { location: "Laundry" }),
  opening("fg1", 1345, 2230, "FG", { location: "Living" }),
  opening("fg2", 870, 455, "FG", { location: "Stair" }),
  opening("aw", 600, 1500, "AW"),
  opening("bifold", 1800, 1200, "BI"),
  opening("float", 1800.0000001, 1199.9999999, "standard"),
  opening("std", 1800, 1200, "standard"),
  opening("entry", 820, 2040, "Entry", { type: "door" }),
] };
const jobWorkbook = { quotation: withWindowsPriceListQuotation({ "WINDOWS (46)": { rows: [] } }), aiPlanTakeoffJob: job };
const calc = (wb) => { console.log = () => {}; try { return calculateEstimateBuilderWorkbook(wb); } finally { console.log = log; } };
const jobPreview = calc(jobWorkbook);
const jobRows = jobPreview.quotation["WINDOWS (46)"].rows;
const line = (item) => jobRows.find((row) => row.item === item);
const unpricedLine = (item, qty) => { const row = line(item); assert.ok(row, `${item} is in Section 53`); assert.equal(row.qty, qty); assert.equal(row.cost, 0); assert.equal(row.quoteRequired, true); assert.match(row.selectionSpec, /^Window Schedule: .* - RATE REQUIRED$/); return row; };
assert.match(unpricedLine("Sliding Window - 1030H x 610W", 1).selectionSpec, /laundry \(Laundry\)/, "Laundry window: visible, traced to its Window Schedule item");
unpricedLine("Fixed Glass - 2230H x 1345W", 1);
unpricedLine("Fixed Glass - 455H x 870W", 1);
unpricedLine("1218 Bifold Window - 1200H x 1800W", 1);
assert.equal(jobRows.some((row) => /Fixed Glass Flyscreen/.test(row.item)), false, "no flyscreen line for fixed glass, priced or not");
assert.equal(line("1506 Awning - 1500H x 600W").qty, 1);
assert.equal(line("1506 Awning Flyscreen - 1500H x 600W").qty, 1);
assert.equal(line("1506 Awning Flyscreen - 1500H x 600W").cost, 98.55, "1506 awning flyscreen is priced");
assert.equal(line("1218 Sliding Window - 1200H x 1800W").qty, 2, "a measured 1199.9999 x 1800.0000001 window is the 1218");
assert.equal(jobPreview.windowScheduleUnmatched.some((u) => /Awning/.test(u.style)), false, "no flyscreen warning for the 1506 awning");
const headingAt = jobRows.findIndex((row) => row.item === "WINDOW SCHEDULE ITEMS REQUIRING A RATE");
assert.ok(headingAt >= 0 && headingAt < jobRows.findIndex((row) => row.item === "WINDOW SCHEDULE"), "unpriced lines sit above the price list");
// Every schedule item has exactly one outcome and the quantities reconcile.
const rec = jobPreview.windowScheduleReconciliation;
assert.deepEqual([rec.scheduleItems, rec.scheduleQty, rec.section53Qty, rec.matchedQty, rec.unpricedQty, rec.elsewhereQty, rec.quoteSheetQty], [8, 8, 7, 3, 4, 1, 7]);
assert.equal(rec.balanced, true);
assert.deepEqual(rec.differences, []);
assert.deepEqual(jobPreview.windowScheduleOutcomes.map((o) => `${o.itemId}:${o.outcome}`).sort(), ["aw:matched", "bifold:unpriced", "entry:elsewhere", "fg1:unpriced", "fg2:unpriced", "float:matched", "laundry:unpriced", "std:matched"]);
assert.equal(new Set(jobRows.map((row) => row.id)).size, jobRows.length, "no duplicate window lines");

// A rate typed on an unpriced line is saved with the line (as the hook's updateQuote saves it),
// survives a save/reload, prices the line, and never duplicates it. A stale saved line whose
// schedule item is gone is dropped.
const laundryRow = line("Sliding Window - 1030H x 610W");
const savedRows = [...jobWorkbook.quotation["WINDOWS (46)"].rows,
  { id: laundryRow.id, section: "WINDOWS (46)", item: laundryRow.item, quantity: "", quantityKey: laundryRow.quantityKey, windowScheduleUnpricedRow: true, active: true, formulas: {}, manualRate: "$650.00" },
  { id: "quote-windows-unpriced-window-fixed-glass-1x1", section: "WINDOWS (46)", item: "gone", windowScheduleUnpricedRow: true, manualRate: "$1.00" }];
const reloadedQuotation = withWindowsPriceListQuotation(JSON.parse(JSON.stringify({ "WINDOWS (46)": { rows: savedRows } })));
const reloaded = calc({ quotation: reloadedQuotation, aiPlanTakeoffJob: JSON.parse(JSON.stringify(job)) });
const reloadedRows = reloaded.quotation["WINDOWS (46)"].rows;
const reloadedLaundry = reloadedRows.filter((row) => row.id === laundryRow.id);
assert.equal(reloadedLaundry.length, 1);
assert.deepEqual([reloadedLaundry[0].qty, reloadedLaundry[0].cost, reloadedLaundry[0].quoteRequired], [1, 650, false]);
assert.equal(reloadedRows.some((row) => row.item === "gone"), false);
assert.equal(new Set(reloadedRows.map((row) => row.id)).size, reloadedRows.length);
assert.deepEqual(reloadedRows.filter((row) => row.qty).map((row) => `${row.item}=${row.qty}`).sort(), jobRows.filter((row) => row.qty).map((row) => `${row.item}=${row.qty}`).sort(), "quantities survive save/reload");
assert.equal(reloaded.windowScheduleReconciliation.balanced, true);

console.log("Windows quote price list checks passed: 329 window/door sizes + 263 matching flyscreens + headings in Section 53, placeholders removed, edits kept, takeoff quantities, flyscreens, unmatched sizes as unpriced lines, schedule reconciliation, save/reload.");
