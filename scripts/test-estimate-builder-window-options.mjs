import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateWindowsDoors } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { doorScheduleRangeOptions, humeEntryDoorRangeOptions, humeEntryDoorRows, isLegacyEntryDoorScheduleRow, supplementalEntryDoorRows, withDoorScheduleSelection, withHumeEntryDoorSelection } from "../lib/construction-estimation/humeEntryDoorPricing.js";

const workbook = JSON.parse(readFileSync(new URL("../lib/construction-estimation/windowsDoorsWorkbookRows.json", import.meta.url), "utf8"));
const first = workbook.rows[0];

assert.ok(first?.code, "Default workbook should include a window/door SIZE code.");
const reorderedForDisplay = moveWindowDoorRowsAfterSource(workbook.rows, [98, 99, 100], 72);
const slidingOrder = reorderedForDisplay
  .filter((row) => String(row.section || "") === "Windows - Aluminium Sliding")
  .map((row) => Number(row.sourceRow));
const row72Index = slidingOrder.indexOf(72);
assert.deepEqual(slidingOrder.slice(row72Index, row72Index + 5), [72, 98, 99, 100, 73], "Rows 98, 99 and 100 must sit directly under row 72.");

const damagedTemplateRow = {
  ...first,
  code: "",
  values: ["", "", "", "", "", "", "", ""],
  width: "",
  height: "",
  quantity: "",
};

const fallback = first;
const restored = {
  ...fallback,
  ...damagedTemplateRow,
  values: damagedTemplateRow.values.some((value) => value !== "" && value !== null && value !== undefined)
    ? damagedTemplateRow.values
    : fallback.values,
  formulas: damagedTemplateRow.formulas && Object.keys(damagedTemplateRow.formulas).length ? damagedTemplateRow.formulas : fallback.formulas,
  section: damagedTemplateRow.section || fallback.section,
  type: damagedTemplateRow.type || fallback.type,
  code: !String(damagedTemplateRow.code || "").trim() ? fallback.code : damagedTemplateRow.code,
  width: damagedTemplateRow.width === "" || damagedTemplateRow.width === undefined || damagedTemplateRow.width === null ? fallback.width : damagedTemplateRow.width,
  height: damagedTemplateRow.height === "" || damagedTemplateRow.height === undefined || damagedTemplateRow.height === null ? fallback.height : damagedTemplateRow.height,
  area: damagedTemplateRow.area === "" || damagedTemplateRow.area === undefined || damagedTemplateRow.area === null ? fallback.area : damagedTemplateRow.area,
};

assert.equal(restored.code, first.code);
assert.equal(restored.width, first.width);
assert.equal(restored.height, first.height);

const calculated = calculateWindowsDoors([{
  id: "window-ground-level-selection",
  code: "2143 x 4330 6C",
  quantity: 1,
  level: "Ground Level",
  width: 2.143,
  height: 4.33,
  type: "Casement Window",
}]);

assert.equal(calculated.rows[0].level, "ground");
assert.equal(calculated.totals.groundFloorWindowCount, 1);
assert.equal(calculated.totals.groundFloorArea, 9.28);

const allCalculated = calculateWindowsDoors(workbook.rows);
const nonEntryRows = allCalculated.rows.filter((row) => !/entry door|garage door|internal door/i.test(`${row.section} ${row.type} ${row.code}`));
assert.equal(nonEntryRows.length, 673);
assert.equal(nonEntryRows.filter((row) => String(row.rate || "").trim()).length, 673);
const garageAndInternalRows = allCalculated.rows.filter((row) => /garage door|internal door/i.test(`${row.section} ${row.type} ${row.code}`));
assert.equal(garageAndInternalRows.filter((row) => String(row.rate || "").trim()).length, 7);
assert.equal(garageAndInternalRows.find((row) => row.code === "2.1 X 3.0 GARAGE DOOR")?.rate, "$2,450.00");
assert.equal(garageAndInternalRows.find((row) => row.code === "2.4 X 4.8 GARAGE DOOR")?.rate, "$4,500.00");
assert.equal(garageAndInternalRows.find((row) => row.code === "820 INTERNAL DOORS")?.rate, "$130.00");

const staleApproxRate = calculateWindowsDoors([{
  id: "stale-rate",
  section: "Windows - Aluminium Awning",
  type: "Windows - Aluminium Awning",
  code: "1800 x 1090 2L",
  quantity: 1,
  height: 1.8,
  width: 1.09,
  rate: "$81,920.00",
  sourceOfRate: "approx awning window allowance",
}]).rows[0];
assert.equal(staleApproxRate.rate, "$1,210.00");
assert.equal(staleApproxRate.cost, 1210);

const manualRate = calculateWindowsDoors([{
  id: "manual-rate",
  section: "Windows - Aluminium Awning",
  type: "Windows - Aluminium Awning",
  code: "1800 x 1090 2L",
  quantity: 1,
  height: 1.8,
  width: 1.09,
  rate: "$999.00",
  sourceOfRate: "manual window/door schedule",
}]).rows[0];
assert.equal(manualRate.rate, "$999.00");
assert.equal(manualRate.cost, 999);

const entryDoorRows = humeEntryDoorRows(workbook.rows);
assert.deepEqual(entryDoorRows.map((row) => row.code), ["820 ENTRY DOORS", "1200 ENTRY DOORS"]);
assert.deepEqual(entryDoorRows.map((row) => row.doorRange), ["Savoy 820", "Savoy 1200"]);
assert.deepEqual(entryDoorRows.map((row) => row.rate), ["$1,950.00", "$2,750.00"]);
assert.ok(humeEntryDoorRangeOptions("820").includes("Haven"));
assert.ok(humeEntryDoorRangeOptions("1200").includes("Linear"));
assert.equal(humeEntryDoorRangeOptions("1200").includes("Savoy 820"), false);
const preservedEntryRows = workbook.rows.filter((row) => (
  String(row.section || "").includes("Entry Doors") && !isLegacyEntryDoorScheduleRow(row)
));
assert.equal(preservedEntryRows.length, 7);
assert.ok(preservedEntryRows.some((row) => String(row.code || "").includes("GARAGE DOOR")));
assert.ok(preservedEntryRows.some((row) => String(row.code || "").includes("INTERNAL DOORS")));
const supplementalRows = supplementalEntryDoorRows(workbook.rows);
assert.deepEqual(supplementalRows.map((row) => row.code), ["820 LAUNDRY EXTERNAL DOOR", "820 GARAGE REAR DOOR"]);
assert.equal([...entryDoorRows, ...supplementalRows, ...preservedEntryRows].length, 11);

const changedHumeRange = calculateWindowsDoors([withHumeEntryDoorSelection({
  ...entryDoorRows[0],
  quantity: 1,
  doorRange: "Haven",
})]).rows[0];
assert.equal(changedHumeRange.rate, "$1,850.00");
assert.equal(changedHumeRange.cost, 1850);

const manualHumeRate = calculateWindowsDoors([withHumeEntryDoorSelection({
  ...entryDoorRows[0],
  quantity: 1,
  rate: "$1,111.00",
  sourceOfRate: "manual window/door schedule",
})]).rows[0];
assert.equal(manualHumeRate.rate, "$1,111.00");
assert.equal(manualHumeRate.cost, 1111);

assert.ok(doorScheduleRangeOptions({ code: "820 INTERNAL DOORS" }).includes("Accent"));
assert.ok(doorScheduleRangeOptions({ code: "2.1 X 4.8 GARAGE DOOR" }).includes("Insulated Sectional Door"));
const accentInternalDoor = calculateWindowsDoors([withDoorScheduleSelection({
  code: "820 INTERNAL DOORS",
  quantity: 2,
  width: 0.82,
  height: 2.1,
  doorRange: "Accent",
})]).rows[0];
assert.equal(accentInternalDoor.rate, "$185.00");
assert.equal(accentInternalDoor.cost, 370);

const rollerGarageDoor = calculateWindowsDoors([withDoorScheduleSelection({
  code: "2.1 X 4.8 GARAGE DOOR",
  quantity: 1,
  width: 4.8,
  height: 2.1,
  doorRange: "Roller Door",
})]).rows[0];
assert.equal(rollerGarageDoor.rate, "$3,500.00");
assert.equal(rollerGarageDoor.cost, 3500);

const linearExternalDoor = calculateWindowsDoors([withDoorScheduleSelection({
  code: "820 LAUNDRY EXTERNAL DOOR",
  quantity: 1,
  width: 0.82,
  height: 2.04,
  doorRange: "Linear External",
})]).rows[0];
assert.equal(linearExternalDoor.rate, "$760.00");
assert.equal(linearExternalDoor.cost, 760);

const duplicatedInternalRows = calculateWindowsDoors([
  {
    id: "window-11",
    section: "Entry Doors",
    code: "820 INTERNAL DOORS",
    quantity: 1,
    level: "Ground Level",
    width: 0.82,
    height: 2.1,
    doorRange: "Flush Hollow Core",
  },
  {
    id: "wd-custom-internal-second",
    section: "Entry Doors",
    code: "820 INTERNAL DOORS",
    quantity: 1,
    level: "Second Level",
    width: 0.82,
    height: 2.1,
    doorRange: "Flush Hollow Core",
  },
]).rows;
assert.equal(duplicatedInternalRows.length, 2);
assert.equal(duplicatedInternalRows[0].rate, "$130.00");
assert.equal(duplicatedInternalRows[1].rate, "$130.00");
assert.equal(duplicatedInternalRows[1].level, "second");

console.log("Estimate Builder window/door option recovery checks passed.");

function moveWindowDoorRowsAfterSource(rows = [], sourceRowsToMove = [], anchorSourceRow) {
  const moveSet = new Set(sourceRowsToMove.map((row) => String(row)));
  const movingRows = [];
  const remainingRows = [];
  rows.forEach((row) => {
    const sourceRow = String(row?.sourceRow ?? row?.importedWorkbookRow ?? "");
    if (moveSet.has(sourceRow)) movingRows.push(row);
    else remainingRows.push(row);
  });
  movingRows.sort((a, b) => sourceRowsToMove.indexOf(Number(a?.sourceRow ?? a?.importedWorkbookRow)) - sourceRowsToMove.indexOf(Number(b?.sourceRow ?? b?.importedWorkbookRow)));
  const anchorIndex = remainingRows.findIndex((row) => String(row?.sourceRow ?? row?.importedWorkbookRow ?? "") === String(anchorSourceRow));
  return [
    ...remainingRows.slice(0, anchorIndex + 1),
    ...movingRows,
    ...remainingRows.slice(anchorIndex + 1),
  ];
}
