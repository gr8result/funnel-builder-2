import { V4_DATA_SECTIONS } from "./estimateWorksheetV4Schema.js";
import { V4_DEFAULT_FORMULAS } from "./estimateWorksheetV4Calculations.js";
import importedWorkbook from "./importedExcelWorkbookTemplate.json";
import windowsWorkbook from "./windowsDoorsWorkbookRows.json";

const REMOVED_QUOTE_SECTION_NAMES = new Set(["upper level framing"]);
const BLANK_INPUT_QUOTE_SECTION_NAMES = new Set(["roof framing"]);
const BLANK_QTY_QUOTE_SECTION_NAMES = new Set(["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials"]);

export function createEstimateWorksheetV4Defaults(plannerAnswers = {}) {
  const values = { ...templateValues(), ...defaultValues(plannerAnswers) };
  const windowsSource = windowsWorkbook?.rows?.length ? windowsWorkbook : importedWorkbook.windows;
  return {
    page: "dataInput",
    activeSection: "inputDataSheet",
    formulas: { ...templateFormulas(), ...V4_DEFAULT_FORMULAS },
    importedWorkbook,
    data: Object.fromEntries(V4_DATA_SECTIONS.map((section) => [section.key, {
      collapsed: false,
      rows: Object.fromEntries(section.rows.map((row) => [row.key, {
        value: values[row.key] ?? "",
        notes: "",
      }])),
    }])),
    importedSheets: {
      dataInput: importedWorkbook.dataInput,
      quotation: importedWorkbook.quotation,
      windows: windowsSource,
    },
    importReport: importedWorkbook.importReport || {},
    windowsDoors: (windowsSource?.rows || []).map((row) => importedOpening(row, windowsSource?.columns || [])),
    quotation: buildWorkbookQuoteSections(importedWorkbook.quotation),
  };
}

function importedOpening(row, columns) {
  return {
    id: `window-${row.sourceRow}`,
    sourceRow: row.sourceRow,
    section: row.section,
    values: row.values || [],
    formulas: row.formulas || {},
    code: valueFor(row, columns, "SIZE"),
    quantity: blankInputs ? "" : valueFor(row, columns, "QTY"),
    level: valueFor(row, columns, "LEVEL"),
    width: valueFor(row, columns, "WIDTH"),
    height: valueFor(row, columns, "HEIGHT"),
    area: valueFor(row, columns, "AREA"),
    totalArea: valueFor(row, columns, "TOTAL") || valueFor(row, columns, "AREA"),
    sillLength: valueFor(row, columns, "SILL"),
    architraveLength: valueFor(row, columns, "ARCH"),
    type: openingType(row.section),
    rate: "",
    cost: "",
    notes: "",
    sourceFormulas: row.formulas || {},
  };
}

function templateValues() {
  return Object.fromEntries(V4_DATA_SECTIONS.flatMap((section) => (
    section.rows.map((row) => [row.key, row.defaultValue ?? ""])
  )));
}

function templateFormulas() {
  return Object.fromEntries(V4_DATA_SECTIONS.flatMap((section) => (
    section.rows.filter((row) => row.defaultFormula).map((row) => [row.key, row.defaultFormula])
  )));
}

function openingType(section) {
  const text = String(section || "").toLowerCase();
  if (text.includes("internal doors")) return "Internal Door";
  if (text.includes("entry doors")) return "Entry Door";
  if (text.includes("doors") && text.includes("sliding")) return "Sliding Door";
  if (text.includes("sliding")) return "Sliding Window";
  if (text.includes("awning")) return "Awning Window";
  if (text.includes("double hung")) return "Double Hung Window";
  if (text.includes("casement")) return "Casement Window";
  if (text.includes("louvre")) return "Louvre Window";
  if (text.includes("fixed")) return "Fixed Window";
  return section || "Workbook item";
}

function importedQuoteRow(row, columns) {
  const blankInputs = isBlankInputQuoteSection(row.section);
  const blankQty = isBlankQtyQuoteSection(row.section);
  const excelRate = valueFor(row, columns, "RATE");
  return {
    id: `quote-${row.sourceRow}`,
    excelRow: row.sourceRow,
    importedWorkbookRow: true,
    section: row.section,
    values: row.values || [],
    formulas: row.formulas || {},
    item: valueFor(row, columns, "ITEM"),
    quantity: blankInputs || blankQty ? "" : valueFor(row, columns, "QTY"),
    quantityKey: "",
    unit: valueFor(row, columns, "UNIT"),
    excelRate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: excelRate ? "workbook" : "rate missing",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: blankInputs ? "" : valueFor(row, columns, "COST"),
    rawText: (row.values || []).filter(Boolean).join(" | "),
    notes: row.notes || "",
  };
}

function buildWorkbookQuoteSections(sheet) {
  const columns = sheet?.columns || [];
  return Object.fromEntries((sheet?.sections || [])
    .filter((section) => !isRemovedQuoteSection(section.label))
    .map((section, index) => [uniqueSectionKey(section.label, index), {
        collapsed: index > 5,
        columns,
        rows: (section.rows || [])
          .filter((row) => !isRemovedQuoteSection(row.section))
          .map((row) => importedQuoteRow(row, columns)),
      }]));
}

function valueFor(row, columns, label) {
  const index = columns.findIndex((column) => String(column?.label ?? column ?? "").trim().toUpperCase() === label);
  return index >= 0 ? row.values?.[index] || "" : "";
}

function uniqueSectionKey(label, index) {
  return `${label || "Ungrouped"}${index ? ` (${index + 1})` : ""}`;
}

function isRemovedQuoteSection(section) {
  return REMOVED_QUOTE_SECTION_NAMES.has(normalizeQuoteSectionName(section));
}

function isBlankInputQuoteSection(section) {
  return BLANK_INPUT_QUOTE_SECTION_NAMES.has(normalizeQuoteSectionName(section));
}

function isBlankQtyQuoteSection(section) {
  const name = normalizeQuoteSectionName(section);
  return BLANK_QTY_QUOTE_SECTION_NAMES.has(name) || name.startsWith("roof cover");
}

function normalizeQuoteSectionName(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultValues(answers) {
  const isDouble = answers.projectType === "Double Storey Home";
  const isTriple = answers.projectType === "Three Storey Home" || answers.projectType === "Triple Storey Home";
  const values = {
    projectName: answers.projectName || answers.name || "",
    projectAddress: answers.projectAddress || answers.address || "",
  };
  if (isTriple) values.floorCount = "Three storey";
  else if (isDouble) values.floorCount = "Two storey";
  if (answers.groundExternalWall || answers.wallConstruction) {
    values.lowerWallSystem = answers.groundExternalWall || answers.wallConstruction;
    values.lowerExternalWallLining = defaultExternalWallLining(values.lowerWallSystem);
  }
  if (answers.firstExternalWall) {
    values.upperWallSystem = answers.firstExternalWall;
    values.upperExternalWallLining = defaultExternalWallLining(values.upperWallSystem);
  }
  if (answers.thirdExternalWall) {
    values.thirdWallSystem = answers.thirdExternalWall;
    values.thirdExternalWallLining = defaultExternalWallLining(values.thirdWallSystem);
  }
  if (answers.roofType) values.roofType = answers.roofType;
  return values;
}

function defaultExternalWallLining(wallSystem) {
  return wallSystem === "Blockwork" ? "Raw blockwork" : "Plasterboard to framed walls";
}
