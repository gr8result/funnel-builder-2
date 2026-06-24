export const HUME_ENTRY_DOOR_OPTIONS = [
  { label: "Haven", rate820: "$1,850.00", rate1200: "" },
  { label: "Savoy 820", rate820: "$1,950.00", rate1200: "" },
  { label: "Savoy 1200", rate820: "", rate1200: "$2,750.00" },
  { label: "Linear", rate820: "$1,400.00", rate1200: "$2,100.00" },
  { label: "Joinery", rate820: "$1,600.00", rate1200: "$2,400.00" },
  { label: "Illusion", rate820: "$2,200.00", rate1200: "$3,300.00" },
  { label: "Vaucluse", rate820: "$1,250.00", rate1200: "$1,875.00" },
  { label: "Newington", rate820: "$1,450.00", rate1200: "$2,175.00" },
  { label: "Regency", rate820: "$1,350.00", rate1200: "$2,025.00" },
  { label: "Nexus", rate820: "$1,750.00", rate1200: "$2,625.00" },
  { label: "Vaucluse Premier", rate820: "$1,650.00", rate1200: "$2,475.00" },
  { label: "Carringbush", rate820: "$1,800.00", rate1200: "$2,700.00" },
  { label: "Elite Aluminium", rate820: "$2,400.00", rate1200: "$3,600.00" },
];

export const HUME_INTERNAL_DOOR_OPTIONS = [
  { label: "Flush Hollow Core", base: 110 },
  { label: "Accent", base: 165 },
  { label: "Deco", base: 220 },
  { label: "Linear", base: 280 },
  { label: "Moulded Panel", base: 190 },
  { label: "Solicore Flush", base: 260 },
];

export const HUME_EXTERNAL_DOOR_OPTIONS = [
  { label: "External Flush", base: 460 },
  { label: "Accent External", base: 620 },
  { label: "Linear External", base: 760 },
  { label: "Solicore External", base: 690 },
];

export const GARAGE_DOOR_OPTIONS = [
  { label: "Roller Door", singleRate: "$2,100.00", doubleRate: "$3,500.00", highDoubleRate: "$3,900.00" },
  { label: "Sectional Door", singleRate: "$2,450.00", doubleRate: "$4,050.00", highDoubleRate: "$4,500.00" },
  { label: "Insulated Sectional Door", singleRate: "$3,200.00", doubleRate: "$5,200.00", highDoubleRate: "$5,750.00" },
];

export function humeEntryDoorRows(sourceRows = []) {
  const first = sourceRows.find(isLegacyEntryDoorScheduleRow)
    || sourceRows.find((row) => String(row?.section || "").toLowerCase().includes("entry doors"))
    || {};
  return [
    humeEntryDoorRow({ source: first, sourceRow: 8, id: "window-entry-door-820", code: "820 ENTRY DOORS", width: 0.82, doorSize: "820" }),
    humeEntryDoorRow({ source: first, sourceRow: 8.1, id: "window-entry-door-1200", code: "1200 ENTRY DOORS", width: 1.2, doorSize: "1200" }),
  ];
}

export function supplementalEntryDoorRows(sourceRows = []) {
  const first = sourceRows.find((row) => String(row?.section || "").toLowerCase().includes("entry doors")) || {};
  return [
    withDoorScheduleSelection(entryDoorScheduleRow({ source: first, sourceRow: 8.2, id: "window-laundry-external-door", code: "820 LAUNDRY EXTERNAL DOOR", width: 0.82, type: "External Door" })),
    withDoorScheduleSelection(entryDoorScheduleRow({ source: first, sourceRow: 8.3, id: "window-garage-rear-door", code: "820 GARAGE REAR DOOR", width: 0.82, type: "External Door" })),
  ];
}

export function withDoorScheduleSelection(row = {}) {
  if (isHumeEntryDoorRow(row)) return withHumeEntryDoorSelection(row);
  if (isInternalDoorScheduleRow(row)) return withInternalDoorSelection(row);
  if (isExternalDoorScheduleRow(row)) return withExternalDoorSelection(row);
  if (isGarageDoorScheduleRow(row)) return withGarageDoorSelection(row);
  return row;
}

export function withHumeEntryDoorSelection(row = {}) {
  if (!isHumeEntryDoorRow(row)) return row;
  const doorSize = humeEntryDoorSize(row);
  const availableRanges = humeEntryDoorRangeOptions(doorSize);
  const selectedRange = availableRanges.includes(row.doorRange) ? row.doorRange : defaultHumeDoorRange(doorSize);
  const rate = humeEntryDoorRate(selectedRange, doorSize);
  const manualRate = String(row.sourceOfRate || "") === "manual window/door schedule" && String(row.rate || "").trim();
  return {
    ...row,
    section: "Entry Doors",
    type: "Entry Door",
    code: doorSize === "1200" ? "1200 ENTRY DOORS" : "820 ENTRY DOORS",
    width: doorSize === "1200" ? 1.2 : 0.82,
    height: row.height || 2.04,
    doorRange: selectedRange,
    rate: manualRate ? row.rate : rate,
    sourceOfRate: manualRate ? row.sourceOfRate : (rate ? "approx Hume entry door allowance" : "rate missing"),
    notes: row.notes || "Approximate Hume entry door allowance. Confirm with supplier quote.",
  };
}

export function doorScheduleRangeOptions(row = {}) {
  if (isHumeEntryDoorRow(row)) return humeEntryDoorRangeOptions(humeEntryDoorSize(row));
  if (isInternalDoorScheduleRow(row)) return HUME_INTERNAL_DOOR_OPTIONS.map((option) => option.label);
  if (isExternalDoorScheduleRow(row)) return HUME_EXTERNAL_DOOR_OPTIONS.map((option) => option.label);
  if (isGarageDoorScheduleRow(row)) return GARAGE_DOOR_OPTIONS.map((option) => option.label);
  return [];
}

export function isDoorScheduleRangeRow(row = {}) {
  return doorScheduleRangeOptions(row).length > 0;
}

export function doorScheduleSize(row = {}) {
  if (isHumeEntryDoorRow(row)) return humeEntryDoorSize(row);
  const code = String(row.code || "");
  const sizeMatch = code.match(/\b(620|720|820|870|1200)\b/);
  if (sizeMatch) return sizeMatch[1];
  if (isGarageDoorScheduleRow(row)) {
    const width = positiveNumber(row.width);
    const height = positiveNumber(row.height);
    if (height >= 2.35 && width >= 4.5) return "high-double";
    if (width >= 4.5) return "double";
    return "single";
  }
  return "820";
}

export function humeEntryDoorRate(range, doorSize) {
  const option = HUME_ENTRY_DOOR_OPTIONS.find((item) => item.label === range);
  if (!option) return "";
  return doorSize === "1200" ? option.rate1200 : option.rate820;
}

export function humeEntryDoorRangeOptions(doorSize) {
  return HUME_ENTRY_DOOR_OPTIONS
    .filter((option) => doorSize === "1200" ? option.rate1200 : option.rate820)
    .map((option) => option.label);
}

export function humeEntryDoorSize(row = {}) {
  const text = `${row.code || ""} ${row.doorSize || ""}`.toLowerCase();
  return text.includes("1200") ? "1200" : "820";
}

export function isHumeEntryDoorRow(row = {}) {
  const code = String(row.code || "").trim().toLowerCase();
  const type = String(row.type || "").trim().toLowerCase();
  const text = `${row.section || ""} ${row.type || ""} ${row.code || ""}`.toLowerCase();
  const humeCode = code === "entry doors" || code === "820 entry doors" || code === "1200 entry doors";
  return (humeCode || type === "entry door" || type === "entry doors") && !text.includes("garage") && !text.includes("internal") && !text.includes("laundry");
}

export function isLegacyEntryDoorScheduleRow(row = {}) {
  return String(row?.section || "").toLowerCase().includes("entry doors")
    && String(row?.code || "").trim().toLowerCase() === "entry doors";
}

export function isInternalDoorScheduleRow(row = {}) {
  return String(row?.code || "").toLowerCase().includes("internal door");
}

export function isExternalDoorScheduleRow(row = {}) {
  const code = String(row?.code || "").toLowerCase();
  return code.includes("laundry external door") || code.includes("garage rear door");
}

export function isGarageDoorScheduleRow(row = {}) {
  return String(row?.code || "").toLowerCase().includes("garage door")
    && !String(row?.code || "").toLowerCase().includes("garage rear door");
}

function humeEntryDoorRow({ source, sourceRow, id, code, width, doorSize }) {
  return withHumeEntryDoorSelection({
    ...entryDoorScheduleRow({ source, sourceRow, id, code, width, type: "Entry Door" }),
    doorSize,
    doorRange: defaultHumeDoorRange(doorSize),
  });
}

function entryDoorScheduleRow({ source, sourceRow, id, code, width, type }) {
  return {
    ...source,
    id,
    sourceRow,
    section: "Entry Doors",
    values: [code, "", "", 2.04, width, 0, "", ""],
    formulas: {},
    code,
    quantity: "",
    level: "",
    height: 2.04,
    width,
    area: "",
    sillLength: "",
    architraveLength: "",
    type,
    unit: "EACH",
    rate: "",
    cost: "",
    notes: "",
  };
}

function defaultHumeDoorRange(doorSize) {
  return doorSize === "1200" ? "Savoy 1200" : "Savoy 820";
}

function withInternalDoorSelection(row = {}) {
  const selectedRange = rangeOrDefault(row, HUME_INTERNAL_DOOR_OPTIONS, "Flush Hollow Core");
  const rate = money(Math.round((optionBase(HUME_INTERNAL_DOOR_OPTIONS, selectedRange) + internalDoorWidthPremium(row)) / 5) * 5);
  return pricedDoorRow(row, selectedRange, rate, "approx Hume internal door allowance");
}

function withExternalDoorSelection(row = {}) {
  const selectedRange = rangeOrDefault(row, HUME_EXTERNAL_DOOR_OPTIONS, "External Flush");
  const rate = money(optionBase(HUME_EXTERNAL_DOOR_OPTIONS, selectedRange));
  return pricedDoorRow(row, selectedRange, rate, "approx Hume external door allowance");
}

function withGarageDoorSelection(row = {}) {
  const selectedRange = rangeOrDefault(row, GARAGE_DOOR_OPTIONS, "Sectional Door");
  const option = GARAGE_DOOR_OPTIONS.find((item) => item.label === selectedRange) || GARAGE_DOOR_OPTIONS[0];
  const size = doorScheduleSize(row);
  const rate = size === "high-double" ? option.highDoubleRate : size === "double" ? option.doubleRate : option.singleRate;
  return pricedDoorRow(row, selectedRange, rate, "approx garage door allowance");
}

function pricedDoorRow(row, selectedRange, rate, sourceOfRate) {
  const manualRate = String(row.sourceOfRate || "") === "manual window/door schedule" && String(row.rate || "").trim();
  return {
    ...row,
    doorRange: selectedRange,
    rate: manualRate ? row.rate : rate,
    sourceOfRate: manualRate ? row.sourceOfRate : sourceOfRate,
    notes: row.notes || `${sourceOfRate}. Confirm with supplier quote.`,
  };
}

function rangeOrDefault(row, options, fallback) {
  const labels = options.map((option) => option.label);
  return labels.includes(row.doorRange) ? row.doorRange : fallback;
}

function optionBase(options, label) {
  return options.find((option) => option.label === label)?.base || 0;
}

function internalDoorWidthPremium(row) {
  const size = Number(doorScheduleSize(row));
  if (!Number.isFinite(size)) return 0;
  if (size >= 870) return 30;
  if (size >= 820) return 20;
  if (size >= 720) return 10;
  return 0;
}

function positiveNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
