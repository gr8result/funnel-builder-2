import { V4_DATA_SECTIONS } from "./estimateWorksheetV4Schema.js";
import { V4_DEFAULT_FORMULAS } from "./estimateBuilderWorkbookCalculations.js";
import importedWorkbook from "./importedExcelWorkbookTemplate.json";
import windowsWorkbook from "./windowsDoorsWorkbookRows.json";
import appliancePackageRows from "./appliancePackageRows.json";
import { withWindowDoorApproximateRate } from "./windowDoorApproximatePricing.js";
import { humeEntryDoorRows, isLegacyEntryDoorScheduleRow, supplementalEntryDoorRows } from "./humeEntryDoorPricing.js";

const REMOVED_QUOTE_SECTION_NAMES = new Set(["upper level framing", "lock up materials", "quick render estimate", "project management", "entry doors", "entry doors - complete", "standard 820 entrace door", "plasterer", "fixout", "fix out", "specials", "internal door complete", "internal cavity sliding door complete", "internal doors"]);
const REMOVED_IMPORTED_QUOTE_SOURCE_ROWS = new Set([1248, 1250, 1251, 1350, 1351]);
const QUOTE_ROWS_WITHOUT_IMPORTED_DATA = new Set([1272, 1373, 1374, 1380, 1381, 1382]);
const STANDARD_THREE_DOOR_ROBE_SECTION = "STANDARD 3 DOOR ROBE UP TO 3.6M WIDE";
const STANDARD_TWO_DOOR_LINEN_SECTION = "STANDARD 2 DOOR LINEN UP TO 2.4M WIDE";
const STANDARD_THREE_DOOR_LINEN_SECTION = "STANDARD 3 DOOR LINEN UP TO 3.6M WIDE";
const CABINET_MAKER_SECTION = "CABINET MAKER";
const APPLIANCE_PACKAGE_SECTION = "APPLIANCE PACKAGE";
const CABINET_MAKER_BUTLERS_PANTRY_SECTION = "BUTLERS PANTRY";
const CABINET_MAKER_LAUNDRY_SECTION = "LAUNDRY";
const CABINET_MAKER_BATHROOMS_SECTION = "BATHROOMS";
const CABINET_MAKER_WARDROBES_SECTION = "WARDROBES";
const OLD_LINEN_AND_ROBE_DOOR_SECTIONS = new Set([
  "space saver sling robe doors",
  "standard linen complete (2.4m wide)",
  "1800 wide 2 door x 2100 high",
  "3000 wide 3 door x 2100 high",
  "1800 wide 2 door x 2400 high",
  "3000 wide 3 door x 2400 high",
]);
const OLD_CABINET_MAKER_SECTIONS = new Set([
  "cabinet maker",
  "misc cabinetry",
  "whitegoods",
  "arc",
  "euromaid",
  "ariston",
  "omega",
  "blanco",
  "blanco upgrade options",
  "smeg",
  "smeg upgrade options",
]);
const BLANK_INPUT_QUOTE_SECTION_NAMES = new Set(["roof framing"]);
const BLANK_QTY_QUOTE_SECTION_NAMES = new Set(["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials", "renderers labour", "misc rendering"]);
const BLANK_VALUE_QUOTE_SECTION_NAMES = new Set(["hourly rate"]);
const TILING_MANUAL_QUOTE_SECTION_NAMES = new Set(["tiling", "toilet", "other room/s", "kitchen", "tile layer", "plumbing fittings & tapwear", "kitchen sinks", "kitchen taps", "vanity basins"]);

export function createEstimateBuilderWorkbookDefaults(plannerAnswers = {}) {
  const values = { ...templateValues(), ...defaultValues(plannerAnswers) };
  const windowsSource = windowsWorkbook?.rows?.length ? windowsWorkbook : importedWorkbook.windows;
  const quotation = buildWorkbookQuoteSections(importedWorkbook.quotation);
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
      dataInput: null,
      quotation: importedWorkbook.quotation,
      windows: windowsSource,
    },
    importReport: importedWorkbook.importReport || {},
    windowsDoors: normalizeDefaultWindowsDoors((windowsSource?.rows || []).map((row) => importedOpening(row, windowsSource?.columns || []))),
    formulaRows: flooringQuoteFormulaRows(),
    quotation,
    quotationSectionOrder: Object.keys(quotation),
    summaryAdjustments: {
      preliminaryCostsPercent: "",
      overheadsPercent: "",
      marginPercent: "",
      profitPercent: "",
      gstPercent: "",
      qbsaRegistration: "",
      qLeaveFees: "",
      salesCommissionPercent: "",
    },
    clientPage: {
      companyName: "",
      logoUrl: "",
      estimateTitle: "Estimate / Quote",
      clientName: "",
      projectAddress: values.projectAddress || "",
      quoteNumber: "",
      quoteDate: "",
      expiryDate: "",
      introduction: "Thank you for the opportunity to provide this quotation.",
      scopeOfWorks: "This quote includes the works listed below.",
      exclusions: "Items not expressly included in this quotation are excluded.",
      terms: "This quotation is valid until the expiry date shown above and is subject to final contract documentation.",
      acceptance: "I/we accept this quotation and authorise the works to proceed.",
    },
  };
}

function quoteSectionBaseName(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/['â€™]/g, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function flooringQuoteFormulaRows() {
  return [
    flooringQuoteFormulaRow("quoteFloorSystemGround300M2", "GROUND FLOOR 319mm Timber Floor System Qty", "M2", 593400),
    flooringQuoteFormulaRow("quoteFloorSystemGround360M2", "GROUND FLOOR 379mm Timber Floor System Qty", "M2", 593500),
    flooringQuoteFormulaRow("quoteFloorSystemSecond300M2", "SECOND FLOOR 319mm Timber Floor System Qty", "M2", 593600),
    flooringQuoteFormulaRow("quoteFloorSystemSecond360M2", "SECOND FLOOR 379mm Timber Floor System Qty", "M2", 593700),
    flooringQuoteFormulaRow("quoteFloorSystemThird300M2", "THIRD FLOOR 319mm Timber Floor System Qty", "M2", 593800),
    flooringQuoteFormulaRow("quoteFloorSystemThird360M2", "THIRD FLOOR 379mm Timber Floor System Qty", "M2", 593900),
  ];
}

function flooringQuoteFormulaRow(key, label, unit, order) {
  return {
    key,
    label,
    unit,
    calculated: true,
    custom: true,
    order,
  };
}

function importedOpening(row, columns) {
  return withWindowDoorApproximateRate({
    id: `window-${row.sourceRow}`,
    sourceRow: row.sourceRow,
    section: row.section,
    values: row.values || [],
    formulas: row.formulas || {},
    code: valueFor(row, columns, "SIZE"),
    quantity: valueFor(row, columns, "QTY"),
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
  });
}

function normalizeDefaultWindowsDoors(rows = []) {
  const legacyEntryRows = rows.filter(isLegacyEntryDoorScheduleRow);
  const remainingRows = rows.filter((row) => !isLegacyEntryDoorScheduleRow(row));
  const insertIndex = rows.findIndex(isLegacyEntryDoorScheduleRow);
  if (insertIndex < 0) return orderWindowDoorRows(rows);
  const before = remainingRows.filter((row) => rows.indexOf(row) < insertIndex);
  const after = remainingRows.filter((row) => rows.indexOf(row) > insertIndex);
  return orderWindowDoorRows([...before, ...humeEntryDoorRows(legacyEntryRows), ...supplementalEntryDoorRows(rows), ...after]);
}

function orderWindowDoorRows(rows = []) {
  return moveWindowDoorRowsAfterSource(rows, [98, 99, 100], 72);
}

function moveWindowDoorRowsAfterSource(rows = [], sourceRowsToMove = [], anchorSourceRow) {
  const moveSet = new Set(sourceRowsToMove.map((row) => String(row)));
  const movingRows = [];
  const remainingRows = [];
  (rows || []).forEach((row) => {
    const sourceRow = String(row?.sourceRow ?? row?.importedWorkbookRow ?? "");
    if (moveSet.has(sourceRow)) movingRows.push(row);
    else remainingRows.push(row);
  });
  if (!movingRows.length) return rows;
  movingRows.sort((a, b) => sourceRowsToMove.indexOf(Number(a?.sourceRow ?? a?.importedWorkbookRow)) - sourceRowsToMove.indexOf(Number(b?.sourceRow ?? b?.importedWorkbookRow)));
  const anchorIndex = remainingRows.findIndex((row) => String(row?.sourceRow ?? row?.importedWorkbookRow ?? "") === String(anchorSourceRow));
  if (anchorIndex < 0) return [...remainingRows, ...movingRows];
  return [
    ...remainingRows.slice(0, anchorIndex + 1),
    ...movingRows,
    ...remainingRows.slice(anchorIndex + 1),
  ];
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
  const item = valueFor(row, columns, "ITEM");
  const rawText = (row.values || []).filter(Boolean).join(" | ");
  const blankInputs = isBlankInputQuoteSection(row.section);
  const blankQty = isBlankQtyQuoteSection(row.section) || TILING_MANUAL_QUOTE_SECTION_NAMES.has(quoteSectionBaseName(row.section));
  const blankValues = isBlankValueQuoteSection(row.section);
  const excelRate = valueFor(row, columns, "RATE");
  return {
    id: `quote-${row.sourceRow}`,
    excelRow: row.sourceRow,
    importedWorkbookRow: true,
    section: row.section,
    values: blankValues && Array.isArray(row.values) ? [item, "", "", valueFor(row, columns, "UNIT"), "", "", ""] : row.values || [],
    formulas: row.formulas || {},
    item,
    quantity: "",
    importedQuantity: blankInputs || blankQty || blankValues ? "" : valueFor(row, columns, "QTY"),
    quantityKey: blankInputs || blankQty || blankValues ? "" : quantityKeyForQuoteRow(`${row.section || ""} ${item} ${rawText}`),
    unit: valueFor(row, columns, "UNIT"),
    excelRate: blankValues ? "" : excelRate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: !blankValues && excelRate ? "workbook" : "rate missing",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: blankInputs || blankValues ? "" : valueFor(row, columns, "COST"),
    rawText,
    notes: blankValues ? "" : row.notes || "",
  };
}

function buildWorkbookQuoteSections(sheet) {
  const columns = sheet?.columns || [];
  const entries = movePlastererQuoteRowToSupplyInstall((sheet?.sections || [])
    .filter((section) => !isRemovedQuoteSection(section.label))
    .map((section, index) => {
      const sectionLabel = normalizeDefaultQuoteSectionLabel(section.label);
      return [uniqueSectionKey(sectionLabel, index), {
        collapsed: true,
        columns,
        rows: normalizeDefaultQuoteSectionRows(sectionLabel, (section.rows || [])
          .filter((row) => !isRemovedQuoteSection(row.section))
          .map((row) => importedQuoteRow(row, columns))),
      }];
    }));
  return Object.fromEntries(orderTilingSubsections(insertFloorcoveringQuoteSections(insertAppliancePackageSection(insertManualLinenSections(insertCabinetMakerSection(insertStandardThreeDoorRobeSection(entries)))))));
}

function orderTilingSubsections(entries = []) {
  const withTiling = moveDefaultSectionsAfter(entries, [
    "bathroom",
    "ensuite",
    "toilet",
    "other room/s",
    "kitchen",
    "tile layer",
  ], "tiling");
  return orderPainterSubsections(orderMirrorsShowerScreensSubsections(orderElectricalSubsections(orderPlumbingFittingsSubsections(withTiling))));
}

function orderPlumbingFittingsSubsections(entries = []) {
  return moveDefaultSectionsAfter(entries, [
    "kitchen sinks",
    "kitchen taps",
    "vanity basins",
    "wall mixers",
    "bath spouts",
    "showers",
    "toilets",
    "baths",
    "spa baths",
    "laundry tubs",
    "laundry taps",
    "washing machine taps",
    "projix",
    "lucerne",
    "singulier",
    "filtered water taps",
    "insinkerators",
    "plumbing fixtures",
  ], "plumbing fittings & tapwear");
}

function orderElectricalSubsections(entries = []) {
  return moveDefaultSectionsAfter(entries, [
    "electrical fixtures",
    "lightfittings",
    "ceiling fans",
    "misc electrical fittings",
  ], "electrical");
}

function orderPainterSubsections(entries = []) {
  return moveDefaultSectionsAfter(entries, [
    "cleaning",
    "landscaping",
  ], "painter");
}

function insertAppliancePackageSection(entries = []) {
  const withoutGenerated = entries.filter(([sectionName]) => !isGeneratedAppliancePackageSection(sectionName));
  const applianceEntries = appliancePackageQuoteSections();
  const cabinetIndex = withoutGenerated.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(CABINET_MAKER_SECTION));
  if (cabinetIndex < 0) return [...withoutGenerated, ...applianceEntries];
  return [
    ...withoutGenerated.slice(0, cabinetIndex + 1),
    ...applianceEntries,
    ...withoutGenerated.slice(cabinetIndex + 1),
  ];
}

function appliancePackageQuoteSections() {
  const sections = [[APPLIANCE_PACKAGE_SECTION, {
    collapsed: true,
    columns: ["Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"],
    rows: [],
  }]];
  let currentBrand = "";
  appliancePackageRows.forEach((row) => {
    if (row.heading && Number(row.headingLevel || 0) === 1) {
      currentBrand = String(row.item || row.brand || "").trim();
      if (!currentBrand) return;
      sections.push([applianceBrandSectionName(currentBrand), {
        collapsed: true,
        columns: ["Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"],
        rows: [],
      }]);
      return;
    }
    if (!currentBrand) currentBrand = "GENERAL";
    const sectionName = applianceBrandSectionName(currentBrand);
    const section = sections.find(([name]) => name === sectionName)?.[1];
    if (section) section.rows.push(appliancePackageQuoteRow(row, section.rows.length, sectionName));
  });
  return sections;
}

function applianceBrandSectionName(brand) {
  return `${APPLIANCE_PACKAGE_SECTION} - ${String(brand || "GENERAL").trim()}`;
}

function isGeneratedAppliancePackageSection(sectionName) {
  const normalized = normalizeQuoteSectionName(sectionName);
  return normalized === normalizeQuoteSectionName(APPLIANCE_PACKAGE_SECTION) || normalized.startsWith(`${normalizeQuoteSectionName(APPLIANCE_PACKAGE_SECTION)} - `);
}

function appliancePackageQuoteRow(row, rowIndex, sectionName = APPLIANCE_PACKAGE_SECTION) {
  const item = String(row.item || row.section || "").trim();
  const heading = row.heading === true || !String(row.item || "").trim();
  const headingLevel = Number(row.headingLevel || (heading ? 2 : 0));
  const rate = row.rate === "" || row.rate === undefined || row.rate === null ? "" : row.rate;
  const cost = row.cost === "" || row.cost === undefined || row.cost === null ? "" : row.cost;
  return {
    id: `quote-appliance-package-${row.sourceRow || rowIndex + 1}`,
    excelRow: row.sourceRow || 0,
    importedWorkbookRow: false,
    section: sectionName,
    values: [item, row.qty || "", row.unit || "", rate, cost, row.source || "", row.notes || ""],
    formulas: heading ? {} : { G: `B${row.sourceRow}*F${row.sourceRow}` },
    item,
    quantity: row.qty || "",
    importedQuantity: row.qty || "",
    quantityKey: "",
    unit: row.unit || "",
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? row.source || "workbook" : "manual",
    quoteRequired: false,
    lineType: heading ? "Appliance heading" : "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: cost,
    rawText: [row.section, row.item, row.unit, rate, cost, row.notes].filter(Boolean).join(" | "),
    notes: row.notes || "",
    applianceHeading: heading,
    applianceHeadingLevel: headingLevel,
    applianceBrand: row.brand || "",
    appliancePackage: row.package || "",
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function insertFloorcoveringQuoteSections(entries = []) {
  const generatedBaseNames = new Set(floorcoveringImportedSections().map(([sectionName]) => normalizeQuoteSectionName(sectionName)));
  const withoutGenerated = entries.filter(([sectionName]) => !generatedBaseNames.has(normalizeQuoteSectionName(sectionName)));
  const floorcoveringsIndex = withoutGenerated.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "floorcoverings");
  const generatedSections = floorcoveringImportedSections();
  const withGenerated = floorcoveringsIndex < 0
    ? [...withoutGenerated, ["FLOORCOVERINGS", { collapsed: true, columns: [], rows: [] }], ...generatedSections]
    : [
        ...withoutGenerated.slice(0, floorcoveringsIndex + 1),
        ...generatedSections,
        ...withoutGenerated.slice(floorcoveringsIndex + 1),
      ];
  return moveDefaultSectionsAfter(withGenerated, [
    ...floorcoveringImportedSections().map(([sectionName]) => normalizeQuoteSectionName(sectionName)),
    "misc flooring",
  ], "floorcoverings");
}

function floorcoveringImportedSections() {
  const sections = [
    ["CERAMIC TILES", [
      ["300x300 Ceramic Tile", "$95.00", "Builder Range"],
      ["450x450 Ceramic Tile", "$105.00", "Popular Upgrade"],
      ["600x600 Ceramic Tile", "$185.00", "Premium Grade"],
    ]],
    ["PORCELAIN TILES", [
      ["600x600 Porcelain Tile", "$125.00", "Premium"],
      ["600x1200 Porcelain Tile", "$155.00", "Large Format"],
      ["Rectified Porcelain Tile", "$165.00", "Premium Rectified"],
    ]],
    ["LAMINATED FLOORING", [
      ["Entry Level Laminate", "$75.00", "Builder Range"],
      ["Premium Laminate", "$95.00", "Upgrade"],
    ]],
    ["VINYL FLOORING", [
      ["Vinyl Plank Standard", "$85.00", "Water Resistant"],
      ["Vinyl Plank Premium", "$110.00", "Premium"],
      ["Commercial Vinyl Sheet", "$95.00", "Commercial Grade"],
    ]],
    ["HYBRID FLOORING", [
      ["Hybrid Standard", "$95.00", "Popular Choice"],
      ["Hybrid Premium", "$125.00", "Premium Hybrid"],
    ]],
    ["ENGEINEERED TIMBER", [
      ["Standard Oak", "$175.00", "European Oak"],
      ["Premium Oak", "$225.00", "Wide Board"],
      ["Australian Hardwood", "$245.00", "Premium Hardwood"],
    ]],
    ["SOLID TIMBER FLOORING", [
      ["Blackbutt", "$295.00", "Australian Species"],
      ["Spotted Gum", "$315.00", "Premium Species"],
    ]],
    ["CARPETS", [
      ["Builder Range Carpet", "$75.00", "Polypropylene"],
      ["Mid Range Carpet", "$95.00", "Solution Dyed"],
      ["Premium Nylon Carpet", "$125.00", "High Traffic"],
      ["Wool Blend Carpet", "$165.00", "Luxury"],
    ]],
  ];
  return sections.map(([sectionName, rows], sectionIndex) => [sectionName, {
    collapsed: true,
    columns: [],
    rows: rows.map(([item, rate, notes], rowIndex) => floorcoveringImportedQuoteRow(sectionName, item, rate, notes, sectionIndex, rowIndex)),
  }]);
}

function floorcoveringImportedQuoteRow(sectionName, item, rate, notes, sectionIndex, rowIndex) {
  const sourceRow = 201101 + (sectionIndex * 10) + rowIndex;
  return {
    id: `quote-floorcovering-${normalizeQuoteSectionName(sectionName).replace(/[^a-z0-9]+/g, "-")}-${rowIndex + 1}`,
    excelRow: sourceRow,
    importedWorkbookRow: false,
    section: sectionName,
    values: [item, "", "", "M2", "", rate, ""],
    formulas: { G: `B${sourceRow}*F${sourceRow}` },
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "M2",
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes,
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function orderMirrorsShowerScreensSubsections(entries = []) {
  return moveDefaultSectionsAfter(entries, [
    "mirrors",
    "softline - framed 1870 high",
    "grange -semi frameless",
  ], "mirrors & shower screens");
}

function moveDefaultSectionsAfter(entries = [], sectionBaseNames = [], afterBaseName = "") {
  const nextEntries = [...entries];
  const moving = [];
  sectionBaseNames.forEach((sectionBaseName) => {
    const sectionIndex = nextEntries.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === sectionBaseName);
    if (sectionIndex >= 0) moving.push(nextEntries.splice(sectionIndex, 1)[0]);
  });
  if (!moving.length) return nextEntries;
  const afterIndex = nextEntries.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === afterBaseName);
  if (afterIndex < 0) return [...nextEntries, ...moving];
  return [...nextEntries.slice(0, afterIndex + 1), ...moving, ...nextEntries.slice(afterIndex + 1)];
}

function insertStandardThreeDoorRobeSection(entries = []) {
  if (entries.some(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(STANDARD_THREE_DOOR_ROBE_SECTION))) return entries;
  const section = [STANDARD_THREE_DOOR_ROBE_SECTION, {
    collapsed: true,
    columns: [],
    rows: standardThreeDoorRobeRows(),
  }];
  const wardrobeIndex = entries.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "standard wardrobes complete (2.4m wide)");
  if (wardrobeIndex < 0) return [...entries, section];
  return [...entries.slice(0, wardrobeIndex + 1), section, ...entries.slice(wardrobeIndex + 1)];
}

function insertManualLinenSections(entries = []) {
  const filtered = entries.filter(([sectionName]) => !OLD_LINEN_AND_ROBE_DOOR_SECTIONS.has(normalizeQuoteSectionName(sectionName)));
  const withoutNew = filtered.filter(([sectionName]) => ![
    normalizeQuoteSectionName(STANDARD_TWO_DOOR_LINEN_SECTION),
    normalizeQuoteSectionName(STANDARD_THREE_DOOR_LINEN_SECTION),
  ].includes(normalizeQuoteSectionName(sectionName)));
  const sections = [
    [STANDARD_TWO_DOOR_LINEN_SECTION, { collapsed: true, columns: [], rows: standardTwoDoorLinenRows() }],
    [STANDARD_THREE_DOOR_LINEN_SECTION, { collapsed: true, columns: [], rows: standardThreeDoorLinenRows() }],
  ];
  const robeIndex = withoutNew.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(STANDARD_THREE_DOOR_ROBE_SECTION));
  if (robeIndex >= 0) return [...withoutNew.slice(0, robeIndex + 1), ...sections, ...withoutNew.slice(robeIndex + 1)];
  const wardrobeIndex = withoutNew.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "standard wardrobes complete (2.4m wide)");
  if (wardrobeIndex >= 0) return [...withoutNew.slice(0, wardrobeIndex + 1), ...sections, ...withoutNew.slice(wardrobeIndex + 1)];
  return [...withoutNew, ...sections];
}

function insertCabinetMakerSection(entries = []) {
  const childBaseNames = [
    normalizeQuoteSectionName(CABINET_MAKER_BUTLERS_PANTRY_SECTION),
    normalizeQuoteSectionName(CABINET_MAKER_LAUNDRY_SECTION),
    normalizeQuoteSectionName(CABINET_MAKER_BATHROOMS_SECTION),
    normalizeQuoteSectionName(CABINET_MAKER_WARDROBES_SECTION),
  ];
  const existingCabinet = entries.find(([sectionName, section]) => normalizeQuoteSectionName(sectionName) === "cabinet maker" && isNewCabinetMakerSection(section));
  const existingButlersPantry = entries.find(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(CABINET_MAKER_BUTLERS_PANTRY_SECTION));
  const existingLaundry = entries.find(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(CABINET_MAKER_LAUNDRY_SECTION));
  const existingBathrooms = entries.find(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(CABINET_MAKER_BATHROOMS_SECTION));
  const existingWardrobes = entries.find(([sectionName]) => normalizeQuoteSectionName(sectionName) === normalizeQuoteSectionName(CABINET_MAKER_WARDROBES_SECTION));
  const filtered = entries.filter(([sectionName]) => {
    const baseName = normalizeQuoteSectionName(sectionName);
    if (baseName === "cabinet maker" || childBaseNames.includes(baseName)) return false;
    return !OLD_CABINET_MAKER_SECTIONS.has(baseName);
  });
  const section = [CABINET_MAKER_SECTION, existingCabinet?.[1]
    ? { ...existingCabinet[1], rows: cabinetMakerRows(existingCabinet[1].rows || [], CABINET_MAKER_SECTION) }
    : {
        collapsed: true,
        columns: [],
        rows: cabinetMakerRows(),
      }];
  const sections = [
    section,
    [CABINET_MAKER_BUTLERS_PANTRY_SECTION, existingButlersPantry?.[1] || { collapsed: true, columns: [], rows: cabinetMakerButlersPantryRows() }],
    [CABINET_MAKER_LAUNDRY_SECTION, existingLaundry?.[1] || { collapsed: true, columns: [], rows: cabinetMakerLaundryRows() }],
    [CABINET_MAKER_BATHROOMS_SECTION, existingBathrooms?.[1] || { collapsed: true, columns: [], rows: cabinetMakerBathroomRows() }],
    [CABINET_MAKER_WARDROBES_SECTION, existingWardrobes?.[1] || { collapsed: true, columns: [], rows: cabinetMakerWardrobeRows() }],
  ];
  const groupEndIndex = filtered.findLastIndex(([sectionName]) => [
    "fix out materials",
    "shelving",
    "standard wardrobes complete (2.4m wide)",
    "standard 3 door robe up to 3.6m wide",
    "standard 2 door linen up to 2.4m wide",
    "standard 3 door linen up to 3.6m wide",
  ].includes(normalizeQuoteSectionName(sectionName)));
  if (groupEndIndex >= 0) return [...filtered.slice(0, groupEndIndex + 1), ...sections, ...filtered.slice(groupEndIndex + 1)];
  return [...filtered, ...sections];
}

function isNewCabinetMakerSection(section) {
  return (section?.rows || []).some((row) => {
    const rowNumber = quoteRowSourceNumber(row);
    return rowNumber >= 1424 && rowNumber < 1425;
  });
}

function movePlastererQuoteRowToSupplyInstall(entries = []) {
  return entries.map(([sectionName, section]) => {
    if (normalizeQuoteSectionName(sectionName) !== "plasterer - supply and install") return [sectionName, section];
    return [sectionName, {
      ...section,
      rows: insertRowsBefore(
        (section.rows || []).filter((row) => row?.id !== "quote-plaster-supply-install"),
        [plasterSupplyInstallQuoteRow()],
        "quote-1269"
      ),
    }];
  });
}

function plasterSupplyInstallQuoteRow() {
  return {
    id: "quote-plaster-supply-install",
    excelRow: 1268.9,
    importedWorkbookRow: false,
    section: "PLASTERER - SUPPLY AND INSTALL",
    values: ["PLASTER - SUPPLY AND INSTALL", "", "", "QUOTE", "", "", ""],
    formulas: {},
    item: "PLASTER - SUPPLY AND INSTALL",
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "QUOTE",
    excelRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "manual",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "PLASTER - SUPPLY AND INSTALL",
    notes: "",
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function normalizeDefaultQuoteSectionRows(sectionName, rows = []) {
  rows = removeRemovedImportedQuoteRows(rows);
  rows = orderQuoteRows(rows).map((row) => normalizeDefaultCleaningQuoteRow(normalizeDefaultPainterQuoteRow(normalizeDefaultSkirtingLmQuoteRow(normalizeDefaultArchitraveLmQuoteRow(normalizeDefaultWindowDoorArchitraveQuoteRow(normalizeDefaultQuoteRowsWithoutImportedData(row)))))));
  if (normalizeQuoteSectionName(sectionName) === "waterproofing") {
    return rows.map(normalizeDefaultQuoteRowWithoutImportedData);
  }
  if (normalizeQuoteSectionName(sectionName) === "doors" || normalizeQuoteSectionName(sectionName) === "entrance doors") {
    return [];
  }
  if (normalizeQuoteSectionName(sectionName) === "roofing materials") {
    return removeRoofingMaterialsRemovedRows(rows);
  }
  if (normalizeQuoteSectionName(sectionName) === "frame stage labour") {
    const withoutGeneratedRows = rows.filter((row) => !["quote-30039", "quote-30040", "quote-30041", "quote-30042"].includes(row.id));
    return insertRowsAfter(
      insertRowsAfter(
        insertRowsAfter(withoutGeneratedRows, [frameStageThirdStoreyWindowsRow()], "quote-74"),
        [frameStageThirdStoreyTrussesRow()],
        "quote-78"
      ),
      [frameStageThirdFloorJoistsRow(), frameStageThirdSheetFlooringRow()],
      "quote-99"
    );
  }
  if (normalizeQuoteSectionName(sectionName) === "painter") {
    return insertRowsAfter(
      insertRowsAfter(rows.filter((row) => !["quote-1963.1", "quote-1965.1"].includes(row.id)), [painterThirdLevelInteriorRow(rows)], "quote-1963"),
      [painterThirdLevelExteriorRow(rows)],
      "quote-1965"
    ).map(normalizeDefaultPainterQuoteRow);
  }
  if (normalizeQuoteSectionName(sectionName) === "concrete slab") {
    return insertRowsAfter(
      rows.filter((row) => row.id !== "quote-30044"),
      [concreteSlabGroundFloorAreaRow()],
      "quote-315"
    );
  }
  if (normalizeQuoteSectionName(sectionName) === "pre-fab wall frames") {
    return rows.map(normalizeDefaultWallFrameRow);
  }
  if (normalizeQuoteSectionName(sectionName) === "upper level timber flooring") {
    return insertRowsAfter(rows, floorFramingQuoteRows("UPPER LEVEL TIMBER FLOORING"), "quote-593");
  }
  if (normalizeQuoteSectionName(sectionName) === "framing timber") {
    return insertRowsBefore(rows, framingTimberTakeoffRows(rows), "quote-493");
  }
  if (normalizeQuoteSectionName(sectionName) === "standard wardrobes complete (2.4m wide)") {
    return standardWardrobesCompleteRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "cabinet maker") {
    return cabinetMakerRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "butlers pantry") {
    return cabinetMakerButlersPantryRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "laundry") {
    return cabinetMakerLaundryRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "bathrooms") {
    return cabinetMakerBathroomRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "wardrobes") {
    return cabinetMakerWardrobeRows(rows, sectionName);
  }
  if (normalizeQuoteSectionName(sectionName) === "plasterer - supply and install") {
    return rows.map(normalizeDefaultPlasterSupplyInstallRow);
  }
  if (normalizeQuoteSectionName(sectionName) !== "bulk earthworks") return rows;
  const header = rows.find((row) => row.sourceRow === 250) || importedQuoteRow({
    sourceRow: 250,
    section: "BULK EARTHWORKS",
    values: ["ITEM", "QTY", "", "UNIT", "", "RATE", "COST"],
    formulas: {},
  }, []);
  const bulkEarthworksRows = [
    { sourceRow: 30043, item: "CUT/FILL", unit: "M3", quantityKey: "cutFillM3", rate: "$30.00", afterId: "quote-250" },
    { sourceRow: 251, item: "BASIC SITE VEGETATION SCRAPE AND LEVEL", unit: "ITEM" },
    { sourceRow: 252, item: "EXCAVATOR HIRE", unit: "HR" },
    { sourceRow: 253, item: "BOBCAT HIRE", unit: "HR" },
    { sourceRow: 254, item: "BACKHOE HIRE", unit: "HR" },
    { sourceRow: 255, item: "TIP TRUCK HIRE", unit: "HR" },
    { sourceRow: 256, item: "DROTT HIRE", unit: "HR" },
    { sourceRow: 257, item: "BULLDOZER", unit: "HR" },
    { sourceRow: 258, item: "FLOAT COSTS", unit: "ITEM" },
    { sourceRow: 259, item: "BULLDOZER - MIN CHARGE", unit: "ITEM" },
    { sourceRow: 260, item: "REMOVAL OF ROCK", unit: "M3" },
    { sourceRow: 261, item: "SITE EXCAVATION", unit: "M3" },
    { sourceRow: 262, item: "SOIL REMOVAL - IMPORT FROM - TO SITE", unit: "M3" },
  ];
  return [header, ...bulkEarthworksRows.map((row) => manualQuoteRow(row))];
}

function normalizeDefaultPainterQuoteRow(row) {
  const formula = painterQuoteFormula(row);
  if (!formula) return row;
  const item = row.item || row.values?.[0] || "";
  const unit = formula === "eavesAreaM2" ? "M2" : (row.unit || row.values?.[3] || "M2");
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: `Formula: ${formula}`,
    formulas: { ...(row.formulas || {}), B: formula, G: `B${quoteRowSourceNumber(row)}*F${quoteRowSourceNumber(row)}` },
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function painterQuoteFormula(row) {
  if (normalizeQuoteSectionName(row?.section) !== "painter") return "";
  if (row?.id === "quote-1963.1") return "thirdLevelFloorAreaM2";
  if (row?.id === "quote-1965.1") return "thirdExternalWallAreaM2";
  const rowNumber = quoteRowSourceNumber(row);
  if (rowNumber === 1962) return "lowerSlabAreaM2";
  if (rowNumber === 1963) return "secondLevelFloorAreaM2";
  if (rowNumber === 1964) return "lowerExternalWallAreaM2";
  if (rowNumber === 1965) return "upperExternalWallAreaM2";
  if (rowNumber === 1967) return "eavesAreaM2";
  if (rowNumber === 1968) return "lowerAlfrescoAreaM2 + lowerPorchAreaM2";
  return "";
}

function painterThirdLevelInteriorRow(rows = []) {
  const upper = rows.find((row) => row.id === "quote-1963") || {};
  return painterGeneratedQuoteRow({
    id: "quote-1963.1",
    excelRow: 1963.1,
    item: "GENERAL PAINTING - INTERIOR THIRD",
    unit: "M2",
    rate: upper.excelRate || upper.values?.[5] || "$28.00",
  });
}

function painterThirdLevelExteriorRow(rows = []) {
  const upper = rows.find((row) => row.id === "quote-1965") || {};
  return painterGeneratedQuoteRow({
    id: "quote-1965.1",
    excelRow: 1965.1,
    item: "EXTERIOR CLADDING THIRD LEVEL",
    unit: "M2",
    rate: upper.excelRate || upper.values?.[5] || "$18.00",
  });
}

function painterGeneratedQuoteRow({ id, excelRow, item, unit, rate }) {
  return {
    id,
    excelRow,
    importedWorkbookRow: false,
    section: "PAINTER",
    values: [item, "", "", unit, "", rate, ""],
    formulas: { G: `B${excelRow}*F${excelRow}` },
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? "workbook" : "manual",
    quoteRequired: false,
    autoQuantity: false,
    quantityManualOverride: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes: "",
  };
}

function normalizeDefaultCleaningQuoteRow(row) {
  const formula = cleaningQuoteFormula(row);
  if (!formula) return row;
  const item = row.item || row.values?.[0] || "";
  const unit = row.unit || row.values?.[3] || "M2";
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: `Formula: ${formula}`,
    formulas: { ...(row.formulas || {}), B: formula, G: `B${quoteRowSourceNumber(row)}*F${quoteRowSourceNumber(row)}` },
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function cleaningQuoteFormula(row) {
  if (normalizeQuoteSectionName(row?.section) !== "cleaning") return "";
  const rowNumber = quoteRowSourceNumber(row);
  return rowNumber === 1978 || rowNumber === 1979 ? "slabFloorAreaM2" : "";
}

function standardWardrobesCompleteRows(existingRows = [], sectionName = "STANDARD WARDROBES COMPLETE (2.4M WIDE)") {
  const rows = [
    { sourceRow: 1371, item: "COMPLETE ROBE UP TO 2.4 WIDE", quantity: "", unit: "EACH", rate: "$723.47" },
    { sourceRow: 1372, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1373, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1374, item: "1 SHELF @ 1700 WITH HANGING RAIL", quantity: "", unit: "EACH", rate: "$89.10" },
    { sourceRow: 1375, item: "2 DOORS SPACE SAVER MIRROR DOORS", quantity: "", unit: "EACH", rate: "$389.00" },
    { sourceRow: 1376, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$199.00" },
    { sourceRow: 1377, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$247.00" },
    { sourceRow: 1378, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => standardWardrobesCompleteRow(existingRows, sectionName, row));
}

function standardWardrobesCompleteRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, row);
}

function cabinetMakerRows(existingRows = [], sectionName = CABINET_MAKER_SECTION) {
  const rows = [
    { sourceRow: 1424.01, item: "KITCHEN", heading: true },
    { sourceRow: 1424.02, item: "KITCHEN CABINETS BASE - STD COLOUR BOARD - LAMINATED TOPS", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.03, item: "1200mm SINK CUPBOARD - STD COLOUR BOARD", unit: "LM", rate: "$1,800.00" },
    { sourceRow: 1424.04, item: "600mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.05, item: "900mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,000.00" },
    { sourceRow: 1424.06, item: "ISLAND CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,700.00" },
    { sourceRow: 1424.07, item: "CORNER BASE CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.08, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.09, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.091, item: "STANDARD 600mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.092, item: "STANDARD 900mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.093, item: "SPECIALTY CANOPY RANGEHOOD CUPBOARD", unit: "ITEM", rate: "" },
    { sourceRow: 1424.094, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.095, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.096, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.1, item: "KITCHEN OVEN TOWER", unit: "ITEM", rate: "$1,700.00" },
    { sourceRow: 1424.11, item: "MICROWAVE UNDERBENCH CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,300.00" },
    { sourceRow: 1424.12, item: "POT DRAWS SET OF 2 - STD COLOURBOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.13, item: "900mm 3 DRAWER CUPBOARD 2 LGE & 1 SML - STD COLOUR BRD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.14, item: "4 DRAWER CUTLERY CUPBOARD - STD COLOURBOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.15, item: "600mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.16, item: "900mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.17, item: "1200mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.18, item: "1200mm CORNER WALK IN PANTRY - STD COLOURBOARD", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.19, item: "1500mm HIDE AWAY PANTRY - STD COLOURBOARD", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.2, item: "FRIDGE OVERHEAD CUPBOARD INC SIDE PANELS - STD COLOUR BRD", unit: "ITEM", rate: "$900.00" },
    { sourceRow: 1424.21, item: "RAISED SERVERY BACK PANEL AND TOP - STD COLOUR BOARD", unit: "LM", rate: "$200.00" },
    { sourceRow: 1424.22, item: "BASE CUPBOARD END PANELS", unit: "ITEM", rate: "$80.00" },
    { sourceRow: 1424.23, item: "TALL END PANELS", unit: "ITEM", rate: "$160.00" },
    { sourceRow: 1424.24, item: "UPGRADE TO SOFT CLOSE DRAWERS", unit: "EACH", rate: "$100.00" },
    { sourceRow: 1424.25, item: "UPGRADE TO 20mm STONE TOPS", unit: "ITEM", rate: "$120.00" },
    { sourceRow: 1424.26, item: "UPGRADE TO 40mm STONE TOPS", unit: "ITEM", rate: "$200.00" },
    { sourceRow: 1424.27, item: "UPGRADE TO SPECIALTY STONE FEATURE", unit: "ITEM", rate: "" },
    { sourceRow: 1424.28, item: "20mm WATERFALL ENDS", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.29, item: "40mm WATERFALL ENDS", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.3, item: "SPECIALTY ISLAND CUPBOARD FEATURES", unit: "ITEM", rate: "" },
    { sourceRow: 1424.31, item: "300mm DEEP 900mm BACK OF ISLAND BENCH CUPBOARDS", unit: "ITEM", rate: "$700.00" },
    { sourceRow: 1424.32, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.33, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.34, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.35, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.48, item: "BATHROOMS", heading: true }, { sourceRow: 1424.49, item: "VANITY UNITS 900mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,000.00" }, { sourceRow: 1424.5, item: "VANITY UNITS 1200mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,200.00" }, { sourceRow: 1424.51, item: "VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,500.00" }, { sourceRow: 1424.52, item: "DOUBLE VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,800.00" }, { sourceRow: 1424.53, item: "DOUBLE VANITY UNITS 1800mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,000.00" }, { sourceRow: 1424.54, item: "DOUBLE VANITY UNITS 2100mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,100.00" }, { sourceRow: 1424.55, item: "DOUBLE VANITY UNITS 2400mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,400.00" }, { sourceRow: 1424.56, item: "EXTEND VANITY TOP OVER BATH", unit: "ITEM", rate: "$80.00" }, { sourceRow: 1424.57, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" }, { sourceRow: 1424.58, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" }, { sourceRow: 1424.59, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" }, { sourceRow: 1424.6, item: "MISC CABINETRY", unit: "ITEM", rate: "" }, { sourceRow: 1424.61, item: "TOTAL BATHOOM COSTS", total: true },
    { sourceRow: 1424.62, item: "WARDROBES", heading: true }, { sourceRow: 1424.63, item: "MELAMINE TOP SHELF WITH HANGING RAIL", unit: "LM", rate: "$120.00" }, { sourceRow: 1424.64, item: "BANK OF 3 DRAWERS AND 3 SHELVES", unit: "ITEM", rate: "$800.00" }, { sourceRow: 1424.65, item: "WIR STD DOUBLE HANGING RAIL CUPBOAD (NO KICK)", unit: "LM", rate: "$150.00" }, { sourceRow: 1424.66, item: "WIR DOUBLE HANGING RAIL CUPBOAD w KICK AND BOTTOM SHELF", unit: "LM", rate: "$320.00" }, { sourceRow: 1424.67, item: "1700mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$1,500.00" }, { sourceRow: 1424.68, item: "2000mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$2,000.00" }, { sourceRow: 1424.69, item: "CORNER ROBE CUPBOARD", unit: "ITEM", rate: "$1,200.00" }, { sourceRow: 1424.7, item: "STAND ALONE DISPLAY CABINET - SOLID TOPS", unit: "ITEM", rate: "$2,500.00" }, { sourceRow: 1424.71, item: "STAND ALONE DISPLAY CABINET - GLASS CUT-OUT TOPS", unit: "ITEM", rate: "$3,000.00" }, { sourceRow: 1424.72, item: "ALLOWANCE FOR LED LIGHTING", unit: "LM", rate: "$90.00" }, { sourceRow: 1424.73, item: "MISC EXTRAS", unit: "ITEM", rate: "" }, { sourceRow: 1424.74, item: "TOTAL WARDROBES COSTS", total: true }, { sourceRow: 1424.75, item: "MISCELLANEOUS CABINETRY", heading: true }, { sourceRow: 1424.76, item: "EXTRA MISC CABINETRY - ALLOWANCE", unit: "ITEM", rate: "" }, { sourceRow: 1424.77, item: "TOTAL CABINET MAKER COSTS", total: true },
  ];
  const kitchenRows = rows.filter((row) => row.sourceRow < 1424.37 || row.sourceRow >= 1424.75);
  return kitchenRows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerButlersPantryRows(existingRows = [], sectionName = CABINET_MAKER_BUTLERS_PANTRY_SECTION) {
  const rows = [
    { sourceRow: 1424.36, item: "BUTLERS PANTRY", heading: true },
    { sourceRow: 1424.361, item: "KITCHEN CABINETS BASE - STD COLOUR BOARD - LAMINATED TOPS", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.362, item: "1200mm SINK CUPBOARD - STD COLOUR BOARD", unit: "LM", rate: "$1,800.00" },
    { sourceRow: 1424.363, item: "600mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.364, item: "900mm UB OVEN & COOKTOP CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,000.00" },
    { sourceRow: 1424.365, item: "CORNER BASE CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.366, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.367, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.368, item: "STANDARD 600mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.369, item: "STANDARD 900mm RANGEHOOD CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.3701, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.371, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.372, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.373, item: "MICROWAVE UNDERBENCH CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,300.00" },
    { sourceRow: 1424.374, item: "POT DRAWS SET OF 2 - STD COLOURBOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.375, item: "900mm 3 DRAWER CUPBOARD 2 LGE & 1 SML - STD COLOUR BRD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.376, item: "4 DRAWER CUTLERY CUPBOARD - STD COLOURBOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.377, item: "600mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.378, item: "900mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.379, item: "1200mm WIDE UPRIGHT PANTRY CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.3801, item: "5 SHELF OPEN SHELVES CABIENTRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.381, item: "5 SHELF MELAMINE OPEN SHELVES CLEATED", unit: "ITEM", rate: "" },
    { sourceRow: 1424.382, item: "UPGRADE TO SOFT CLOSE DRAWERS", unit: "EACH", rate: "$100.00" },
    { sourceRow: 1424.383, item: "UPGRADE TO 20mm STONE TOPS", unit: "ITEM", rate: "$120.00" },
    { sourceRow: 1424.384, item: "UPGRADE TO 40mm STONE TOPS", unit: "ITEM", rate: "$200.00" },
    { sourceRow: 1424.385, item: "UPGRADE TO SPECIALTY STONE FEATURE", unit: "ITEM", rate: "" },
    { sourceRow: 1424.386, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.387, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.388, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.389, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerLaundryRows(existingRows = [], sectionName = CABINET_MAKER_LAUNDRY_SECTION) {
  const rows = [
    { sourceRow: 1424.37, item: "LAUNDRY", heading: true },
    { sourceRow: 1424.38, item: "LAUNDRY CABINETS BASE - STD COLOUR BOARD", unit: "LM", rate: "$1,500.00" },
    { sourceRow: 1424.39, item: "1000mm TUB CUPBOARD - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.4, item: "LAUNDRY BROOM CLOSET 900mm - STD COLOUR BOARD", unit: "ITEM", rate: "$1,800.00" },
    { sourceRow: 1424.41, item: "LAUNDRY BROOM CLOSET 1200mm - STD COLOUR BOARD", unit: "ITEM", rate: "$2,200.00" },
    { sourceRow: 1424.42, item: "TOPS OVER UB WASHER AND DRYER", unit: "LM", rate: "$80.00" },
    { sourceRow: 1424.43, item: "OVERHEAD CUPBOARDS - STD COLOUR BOARD", unit: "LM", rate: "$1,000.00" },
    { sourceRow: 1424.44, item: "OVERHEAD CORNER CUPBOARDS -STD COLOUR BOARD", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.45, item: "UPGRADE TO EXTRA HEIGHT OVERHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.46, item: "ADD FOR 300mm CRAFTWOOD BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.47, item: "ADD EXTRA HEIGHT BULKHEADS", unit: "LM", rate: "" },
    { sourceRow: 1424.471, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.472, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.473, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.474, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerBathroomRows(existingRows = [], sectionName = CABINET_MAKER_BATHROOMS_SECTION) {
  const rows = [
    { sourceRow: 1424.48, item: "BATHROOMS", heading: true },
    { sourceRow: 1424.49, item: "VANITY UNITS 900mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,000.00" },
    { sourceRow: 1424.5, item: "VANITY UNITS 1200mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,200.00" },
    { sourceRow: 1424.51, item: "VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,500.00" },
    { sourceRow: 1424.52, item: "DOUBLE VANITY UNITS 1500mm - STD COLOUR BOARD", unit: "EACH", rate: "$1,800.00" },
    { sourceRow: 1424.53, item: "DOUBLE VANITY UNITS 1800mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,000.00" },
    { sourceRow: 1424.54, item: "DOUBLE VANITY UNITS 2100mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,100.00" },
    { sourceRow: 1424.55, item: "DOUBLE VANITY UNITS 2400mm - STD COLOUR BOARD", unit: "EACH", rate: "$2,400.00" },
    { sourceRow: 1424.56, item: "EXTEND VANITY TOP OVER BATH", unit: "ITEM", rate: "$80.00" },
    { sourceRow: 1424.57, item: "UPGRADE TO PREMIUM COLOUR BOARD DOORS AND PANELS", unit: "M2", rate: "$30.00" },
    { sourceRow: 1424.58, item: "UPGRADE TO CREATEC DOORS AND PANELS", unit: "M2", rate: "$50.00" },
    { sourceRow: 1424.59, item: "UPGRADE TO 2 PACK DOORS AND PANELS", unit: "M2", rate: "$120.00" },
    { sourceRow: 1424.6, item: "MISC CABINETRY", unit: "ITEM", rate: "" },
    { sourceRow: 1424.61, item: "TOTAL BATHOOM COSTS", total: true },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerWardrobeRows(existingRows = [], sectionName = CABINET_MAKER_WARDROBES_SECTION) {
  const rows = [
    { sourceRow: 1424.62, item: "WARDROBES", heading: true },
    { sourceRow: 1424.63, item: "MELAMINE TOP SHELF WITH HANGING RAIL", unit: "LM", rate: "$120.00" },
    { sourceRow: 1424.64, item: "BANK OF 3 DRAWERS AND 3 SHELVES", unit: "ITEM", rate: "$800.00" },
    { sourceRow: 1424.65, item: "WIR STD DOUBLE HANGING RAIL CUPBOAD (NO KICK)", unit: "LM", rate: "$150.00" },
    { sourceRow: 1424.66, item: "WIR DOUBLE HANGING RAIL CUPBOAD w KICK AND BOTTOM SHELF", unit: "LM", rate: "$320.00" },
    { sourceRow: 1424.67, item: "1700mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$1,500.00" },
    { sourceRow: 1424.68, item: "2000mm HIGH SHOE RACK 800mm WIDE", unit: "ITEM", rate: "$2,000.00" },
    { sourceRow: 1424.69, item: "CORNER ROBE CUPBOARD", unit: "ITEM", rate: "$1,200.00" },
    { sourceRow: 1424.7, item: "STAND ALONE DISPLAY CABINET - SOLID TOPS", unit: "ITEM", rate: "$2,500.00" },
    { sourceRow: 1424.71, item: "STAND ALONE DISPLAY CABINET - GLASS CUT-OUT TOPS", unit: "ITEM", rate: "$3,000.00" },
    { sourceRow: 1424.72, item: "ALLOWANCE FOR LED LIGHTING", unit: "LM", rate: "$90.00" },
    { sourceRow: 1424.73, item: "MISC EXTRAS", unit: "ITEM", rate: "" },
    { sourceRow: 1424.74, item: "TOTAL WARDROBES COSTS", total: true },
  ];
  return rows.map((row) => cabinetMakerRow(existingRows, sectionName, row));
}

function cabinetMakerRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, { ...row, quantity: "", unit: row.heading || row.total ? "" : row.unit, rate: row.heading || row.total ? "" : row.rate, forceItem: true, cabinetMakerTotalRow: Boolean(row.total) });
}

function normalizeDefaultPlasterSupplyInstallRow(row) {
  if (row.id === "quote-1270") {
    return defaultLinkedQuoteRow(row, "GYPROCK SUPPLY & FIX - INTERNAL WALLS", "plasterboardWallM2", "$14.00");
  }
  if (row.id === "quote-1271") {
    return defaultLinkedQuoteRow(row, "GYPROCK SUPPLY & FIX - CEILINGS", "totalCeilingAreasM2", "$14.00");
  }
  return row;
}

function normalizeDefaultWindowDoorArchitraveQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 1356) return row;
  const item = row.item || row.values?.[0] || "INSTALL EXTERIOR DOOR AND WINDOW ARCHITRAVES";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...row,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    autoQuantity: false,
    quantityManualOverride: false,
    notes: "IMPORTED DATA",
    formulas: {
      ...(row.formulas || {}),
      B: "architraveLengthsEach*5.4",
      G: "B1356*F1356",
    },
  };
}

function normalizeDefaultArchitraveLmQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 116) return row;
  const item = row.item || row.values?.[0] || "INSTALL WINDOW ARCHITRAVES";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...row,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    autoQuantity: false,
    quantityManualOverride: false,
    notes: "",
    formulas: {},
  };
}

function normalizeDefaultSkirtingLmQuoteRow(row) {
  if (quoteRowSourceNumber(row) !== 1363) return row;
  const item = row.item || row.values?.[0] || "SKIRTING";
  const unit = row.unit || row.values?.[3] || "LM";
  return {
    ...row,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", unit, row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit,
    autoQuantity: false,
    quantityManualOverride: false,
    notes: "IMPORTED DATA",
    formulas: {
      ...(row.formulas || {}),
      B: "skirtingLengthsEach*5.4",
      G: "B1363*F1363",
    },
  };
}

function standardTwoDoorLinenRows(existingRows = [], sectionName = STANDARD_TWO_DOOR_LINEN_SECTION) {
  const rows = [
    { sourceRow: 1379, item: "COMPLETE LINEN UP TO 2.4 WIDE", quantity: "", unit: "EACH", rate: "$730.35" },
    { sourceRow: 1380, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1381, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1382, item: "4 STANDARD SHELVES", quantity: "", unit: "EACH", rate: "$201.60" },
    { sourceRow: 1383, item: "VINYL", quantity: "", unit: "EACH", rate: "$389.00", forceItem: true },
    { sourceRow: 1384, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$199.00" },
    { sourceRow: 1385, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$247.00" },
    { sourceRow: 1386, item: "1 X EXTRA SHELF", quantity: "", unit: "EACH", rate: "$50.40" },
    { sourceRow: 1387, item: "BROOM PARTITION", quantity: "", unit: "EACH", rate: "$39.75" },
  ];
  return rows.map((row) => manualReplacementQuoteRow(existingRows, sectionName, row));
}

function standardThreeDoorLinenRows(existingRows = [], sectionName = STANDARD_THREE_DOOR_LINEN_SECTION) {
  const rows = [
    { sourceRow: 1388, item: "COMPLETE LINEN UP TO 3.6M WIDE", quantity: "", unit: "EACH", rate: "$1,004.27" },
    { sourceRow: 1389, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1390, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1391, item: "4 STANDARD SHELVES", quantity: "", unit: "EACH", rate: "$302.40" },
    { sourceRow: 1392, item: "VINYL", quantity: "", unit: "EACH", rate: "$583.50", forceItem: true },
    { sourceRow: 1393, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$298.50" },
    { sourceRow: 1394, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$370.50" },
    { sourceRow: 1395, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => manualReplacementQuoteRow(existingRows, sectionName, row));
}

function manualReplacementQuoteRow(existingRows, sectionName, row) {
  const existing = existingRows.find((candidate) => quoteRowSourceNumber(candidate) === row.sourceRow) || {};
  const preserve = canPreserveManualReplacement(existing);
  const item = row.forceItem ? row.item : (preserve ? (existing.item || existing.values?.[0] || row.item) : row.item);
  const quantity = preserve ? (existing.quantity ?? existing.values?.[1] ?? "") : row.quantity;
  const unit = preserve ? (existing.unit || existing.values?.[3] || row.unit) : row.unit;
  const excelRate = preserve ? (existing.excelRate || existing.values?.[5] || row.rate) : row.rate;
  const manualRate = preserve ? (existing.manualRate || "") : "";
  const supplierQuote = preserve ? (existing.supplierQuote || "") : "";
  const notes = preserve ? (existing.notes || "") : "";
  return {
    ...existing,
    id: `quote-${row.sourceRow}`,
    excelRow: row.sourceRow,
    importedWorkbookRow: false,
    section: sectionName,
    values: [item, quantity, "", unit, "", excelRate, ""],
    formulas: { G: `B${row.sourceRow}*F${row.sourceRow}` },
    item,
    quantity,
    importedQuantity: "",
    quantityKey: "",
    unit,
    excelRate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate,
    supplierQuote,
    sourceOfRate: manualRate ? "manual" : (excelRate ? "workbook" : "manual"),
    quoteRequired: false,
    autoQuantity: false,
    quantityManualOverride: false,
    cabinetMakerTotalRow: Boolean(row.cabinetMakerTotalRow),
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes,
  };
}

function canPreserveManualReplacement(existing) {
  return Boolean(
    existing?.id
    && existing.importedWorkbookRow === false
    && !existing.importedQuantity
    && !existing.quantityKey
    && !String(existing.notes || "").toUpperCase().includes("IMPORTED DATA")
  );
}

function standardThreeDoorRobeRows(existingRows = [], sectionName = STANDARD_THREE_DOOR_ROBE_SECTION) {
  const rows = [
    { sourceRow: 1378.1, item: "COMPLETE ROBE UP TO 3.6M WIDE", quantity: "", unit: "EACH", rate: "$943.55" },
    { sourceRow: 1378.2, item: "JAMB", quantity: "", unit: "LM", rate: "$8.98" },
    { sourceRow: 1378.3, item: "ARCHITRAVES", quantity: "", unit: "LM", rate: "$1.98" },
    { sourceRow: 1378.4, item: "1 SHELF @ 1700 WITH HANGING RAIL", quantity: "", unit: "EACH", rate: "$114.60" },
    { sourceRow: 1378.5, item: "3 DOORS SPACE SAVER MIRROR DOORS", quantity: "", unit: "EACH", rate: "$562.20" },
    { sourceRow: 1378.6, item: "UPGRADE TO MIRROR DOORS", quantity: "", unit: "EACH", rate: "$298.50" },
    { sourceRow: 1378.7, item: "UPGRADE TO FRAMELESS SUPERWHITE GLASS", quantity: "", unit: "EACH", rate: "$370.50" },
    { sourceRow: 1378.8, item: "1 X BANK OF SHELVES", quantity: "", unit: "EACH", rate: "$127.00" },
  ];
  return rows.map((row) => standardThreeDoorRobeRow(existingRows, sectionName, row));
}

function standardThreeDoorRobeRow(existingRows, sectionName, row) {
  return manualReplacementQuoteRow(existingRows, sectionName, row);
}

function normalizeDefaultQuoteRowsWithoutImportedData(row) {
  const rowNumber = quoteRowSourceNumber(row);
  if (!isNoImportedDataDefaultQuoteRow(row, rowNumber)) return row;
  return normalizeDefaultQuoteRowWithoutImportedData(row);
}

function isNoImportedDataDefaultQuoteRow(row, rowNumber = quoteRowSourceNumber(row)) {
  return normalizeQuoteSectionName(row?.section) === "hot water"
    || QUOTE_ROWS_WITHOUT_IMPORTED_DATA.has(rowNumber)
    || (rowNumber >= 1275 && rowNumber <= 1283)
    || (rowNumber >= 1357 && rowNumber <= 1362);
}

function normalizeDefaultQuoteRowWithoutImportedData(row) {
  const item = row.item || row.values?.[0] || "";
  return {
    ...row,
    item,
    rawText: item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    autoQuantity: false,
    quantityManualOverride: false,
    notes: removeImportedDataNote(row.notes),
    formulas: row.formulas?.B ? { ...row.formulas, B: "" } : row.formulas,
    values: Array.isArray(row.values) ? [item, "", row.values[2] || "", row.values[3] || row.unit || "", row.values[4] || "", row.values[5] || row.excelRate || "", row.values[6] || ""] : row.values,
  };
}

function removeImportedDataNote(notes) {
  return String(notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && part.toUpperCase() !== "IMPORTED DATA")
    .join(" | ");
}

function defaultLinkedQuoteRow(row, item, quantityKey, excelRate) {
  return {
    ...row,
    values: [item, "", "", "M2", "", excelRate, ""],
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit: "M2",
    excelRate,
    manualRate: "",
    sourceOfRate: "workbook",
    importedCost: "",
    rawText: item,
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function normalizeDefaultQuoteSectionLabel(section) {
  if (normalizeQuoteSectionName(section) === "entrance doors") return "DOORS";
  if (normalizeQuoteSectionName(section) === "skirting & architraves") return "FIX OUT MATERIALS";
  return section;
}

function removeRoofingMaterialsRemovedRows(rows = []) {
  return rows.filter((row) => {
    const rowNumber = quoteRowSourceNumber(row);
    return rowNumber < 1130 || rowNumber > 1266;
  });
}

function removeRemovedImportedQuoteRows(rows = []) {
  return rows.filter((row) => !REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(quoteRowSourceNumber(row)));
}

function orderQuoteRows(rows = []) {
  return moveQuoteRowsAfterSource(rows, [98, 99, 100], 73);
}

function moveQuoteRowsAfterSource(rows = [], sourceRowsToMove = [], anchorSourceRow) {
  const moveSet = new Set(sourceRowsToMove.map((row) => String(row)));
  const movingRows = [];
  const remainingRows = [];
  (rows || []).forEach((row) => {
    const sourceRow = String(row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow ?? "");
    if (moveSet.has(sourceRow)) movingRows.push(row);
    else remainingRows.push(row);
  });
  if (!movingRows.length) return rows;
  movingRows.sort((a, b) => sourceRowsToMove.indexOf(quoteRowSourceNumber(a)) - sourceRowsToMove.indexOf(quoteRowSourceNumber(b)));
  const anchorIndex = remainingRows.findIndex((row) => String(row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow ?? "") === String(anchorSourceRow));
  if (anchorIndex < 0) return [...remainingRows, ...movingRows];
  return [
    ...remainingRows.slice(0, anchorIndex + 1),
    ...movingRows,
    ...remainingRows.slice(anchorIndex + 1),
  ];
}

function quoteRowSourceNumber(row) {
  const direct = row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow;
  const idMatch = String(row?.id || "").match(/^quote-(\d+)$/);
  const value = direct ?? idMatch?.[1];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function insertRowsAfter(rows = [], rowsToInsert = [], afterId = "") {
  const index = rows.findIndex((row) => row?.id === afterId);
  if (index < 0) return [...rows, ...rowsToInsert];
  return [
    ...rows.slice(0, index + 1),
    ...rowsToInsert,
    ...rows.slice(index + 1),
  ];
}

function insertRowsBefore(rows = [], rowsToInsert = [], beforeId = "") {
  const index = rows.findIndex((row) => row?.id === beforeId);
  if (index < 0) return [...rowsToInsert, ...rows];
  return [
    ...rows.slice(0, index),
    ...rowsToInsert,
    ...rows.slice(index),
  ];
}

function frameStageThirdStoreyWindowsRow() {
  return {
    id: "quote-30039",
    excelRow: 74.1,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["ADD FOR THIRD STOREY WINDOWS", "", "", "EACH", "", "$10.00", ""],
    formulas: {},
    item: "ADD FOR THIRD STOREY WINDOWS",
    quantity: "",
    importedQuantity: "",
    quantityKey: "quoteFrameThirdStoreyWindows",
    unit: "EACH",
    excelRate: "$10.00",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "ADD FOR THIRD STOREY WINDOWS",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function concreteSlabGroundFloorAreaRow() {
  return {
    id: "quote-30044",
    excelRow: 315.1,
    importedWorkbookRow: false,
    section: "CONCRETE SLAB",
    values: ["TOTAL GROUND FLOOR AREA", "", "", "M2", "", "$125.00", ""],
    formulas: {},
    item: "TOTAL GROUND FLOOR AREA",
    quantity: "",
    importedQuantity: "",
    quantityKey: "lowerSlabAreaM2",
    unit: "M2",
    excelRate: "$125.00",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "TOTAL GROUND FLOOR AREA",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function floorFramingQuoteRows(section) {
  return [
    floorFramingQuoteRow({ sourceRow: 593.1, section, item: "GROUND FLOOR FRAMING QUOTE", unit: "QUOTE" }),
    floorFramingQuoteRow({ sourceRow: 593.2, section, item: "SECOND FLOOR FRAMING QUOTE", unit: "QUOTE" }),
    floorFramingQuoteRow({ sourceRow: 593.3, section, item: "THIRD FLOOR FRAMING QUOTE", unit: "QUOTE" }),
    floorFramingQuoteRow({ sourceRow: 593.4, section, item: "GROUND FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemGround300M2", rate: "$180.00" }),
    floorFramingQuoteRow({ sourceRow: 593.5, section, item: "GROUND FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemGround360M2", rate: "$220.00" }),
    floorFramingQuoteRow({ sourceRow: 593.6, section, item: "SECOND FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemSecond300M2", rate: "$180.00" }),
    floorFramingQuoteRow({ sourceRow: 593.7, section, item: "SECOND FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemSecond360M2", rate: "$220.00" }),
    floorFramingQuoteRow({ sourceRow: 593.8, section, item: "THIRD FLOOR 319mm Timber Floor System (300mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemThird300M2", rate: "$180.00" }),
    floorFramingQuoteRow({ sourceRow: 593.9, section, item: "THIRD FLOOR 379mm Timber Floor System (360mm I Beams & 19mm Sheet Flooring)", unit: "M2", quantityKey: "quoteFloorSystemThird360M2", rate: "$220.00" }),
  ];
}

function floorFramingQuoteRow({ sourceRow, section, item, unit, quantityKey = "", rate = "" }) {
  return {
    id: `quote-${sourceRow}`,
    excelRow: sourceRow,
    importedWorkbookRow: false,
    section,
    values: [item, "", "", unit, "", rate, ""],
    formulas: {},
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit,
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? "workbook" : "rate missing",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes: "IMPORTED DATA",
    autoQuantity: Boolean(quantityKey),
    quantityManualOverride: false,
  };
}

function normalizeDefaultWallFrameRow(row) {
  if (row.id === "quote-489") return defaultLinkedWallFrameRow(row, "70mm EXTERIOR WALLS FRAMES", "totalExternal70mmWallsLm", "$55.00");
  if (row.id === "quote-490") return defaultLinkedWallFrameRow(row, "90MM EXTERIOR WALLS FRAMES", "totalExternal90mmWallsLm", "$68.00");
  if (row.id === "quote-642") return defaultLinkedWallFrameRow(row, "70mm INTERNAL WALL FRAMES", "totalInternal70mmWallsLm", "$42.00");
  if (row.id === "quote-643") return defaultLinkedWallFrameRow(row, "90mm INTERNAL WALL FRAMES", "totalInternal90mmWallsLm", "$52.00");
  return row;
}

function defaultLinkedWallFrameRow(row, item, quantityKey, excelRate) {
  return {
    ...row,
    values: [item, "", "", "LM", "", excelRate, ""],
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit: "LM",
    excelRate,
    manualRate: "",
    sourceOfRate: "workbook",
    importedCost: "",
    rawText: item,
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function framingTimberTakeoffRows(rows = []) {
  const rate70 = "$35.65";
  const rate90 = "$45.90";
  return [
    framingTimberTakeoffRow({
      sourceRow: 492.1,
      item: "70 x 35 MPG 12 STUD MATERIAL 5.4 LENGTHS",
      quantityFormula: "ceil(TotalStudMaterial70mmLm / 5.4)",
      rate: rate70,
    }),
    framingTimberTakeoffRow({
      sourceRow: 492.2,
      item: "90 x 35 MPG 12 STUD MATERIAL 5.4 LENGTHS",
      quantityFormula: "ceil(TotalStudMaterial90mmLm / 5.4)",
      rate: rate90,
    }),
    framingTimberTakeoffRow({
      sourceRow: 492.3,
      item: "70 x 35 MPG 12 PLATE MATERIAL 5.4 LENGTHS",
      quantityFormula: "ceil(TotalPlatesNogginsMaterial70mmLm / 5.4)",
      rate: rate70,
    }),
    framingTimberTakeoffRow({
      sourceRow: 492.4,
      item: "90 x 35 MPG 12 PLATE MATERIAL 5.4 LENGTHS",
      quantityFormula: "ceil(TotalPlatesNogginsMaterial90mmLm / 5.4)",
      rate: rate90,
    }),
  ];
}

function framingTimberTakeoffRow({ sourceRow, item, quantityFormula, rate }) {
  return {
    id: `quote-${sourceRow}`,
    excelRow: sourceRow,
    importedWorkbookRow: false,
    section: "FRAMING TIMBER",
    values: [item, "", "", "LENGTHS", "", rate, ""],
    formulas: { B: quantityFormula },
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey: "",
    unit: "LENGTHS",
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes: "IMPORTED DATA",
    autoQuantity: false,
    quantityManualOverride: false,
  };
}

function quoteRateForItem(rows = [], item) {
  const target = normalizeQuoteItemText(item);
  const row = rows.find((candidate) => normalizeQuoteItemText(candidate?.item || candidate?.values?.[0]) === target);
  return row?.excelRate || row?.values?.[5] || "";
}

function normalizeQuoteItemText(item) {
  return String(item || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function frameStageThirdStoreyTrussesRow() {
  return {
    id: "quote-30040",
    excelRow: 78.1,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["ADD FOR THIRD STOREY TRUSSES", "", "", "M2", "", "$2.50", ""],
    formulas: {},
    item: "ADD FOR THIRD STOREY TRUSSES",
    quantity: "",
    importedQuantity: "",
    quantityKey: "quoteFrameThirdStoreyTrusses",
    unit: "M2",
    excelRate: "$2.50",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "ADD FOR THIRD STOREY TRUSSES",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function frameStageThirdFloorJoistsRow() {
  return {
    id: "quote-30041",
    excelRow: 99.1,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["LABOUR TO INSTALL FLOOR JOISTS THIRD LEVEL", "", "", "M2", "", "$15.00", ""],
    formulas: {},
    item: "LABOUR TO INSTALL FLOOR JOISTS THIRD LEVEL",
    quantity: "",
    importedQuantity: "",
    quantityKey: "quoteFrameFloorJoistsThirdM2",
    unit: "M2",
    excelRate: "$15.00",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "LABOUR TO INSTALL FLOOR JOISTS THIRD LEVEL",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function frameStageThirdSheetFlooringRow() {
  return {
    id: "quote-30042",
    excelRow: 99.2,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["LABOUR TO LAY SHEET FLOORING THIRD LEVEL", "", "", "M2", "", "$5.50", ""],
    formulas: {},
    item: "LABOUR TO LAY SHEET FLOORING THIRD LEVEL",
    quantity: "",
    importedQuantity: "",
    quantityKey: "quoteFrameSheetFlooringThirdM2",
    unit: "M2",
    excelRate: "$5.50",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "workbook",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "LABOUR TO LAY SHEET FLOORING THIRD LEVEL",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

function manualQuoteRow({ sourceRow, item, unit, quantityKey = "", rate = "" }) {
  return {
    id: `quote-${sourceRow}`,
    excelRow: sourceRow,
    importedWorkbookRow: false,
    section: "BULK EARTHWORKS",
    values: [item, "", "", unit, "", rate, ""],
    formulas: {},
    item,
    quantity: "",
    importedQuantity: "",
    quantityKey,
    unit,
    excelRate: rate,
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: rate ? "workbook" : "manual",
    quoteRequired: false,
    autoQuantity: Boolean(quantityKey),
    quantityManualOverride: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: item,
    notes: "",
  };
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

function isBlankValueQuoteSection(section) {
  return BLANK_VALUE_QUOTE_SECTION_NAMES.has(normalizeQuoteSectionName(section));
}

function normalizeQuoteSectionName(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quantityKeyForQuoteRow(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("face brickwork") && value.includes("face bricks - base range")) return "quoteFaceBricksBaseRange";
  if (value.includes("face brickwork") && value.includes("common single heights")) return "quoteCommonSingleHeights";
  if (value.includes("face brickwork") && value.includes("common twin heights")) return "quoteCommonTwinHeights";
  if (value.includes("face brickwork") && value.includes("add bricks for sills")) return "quoteBrickSillBricks";
  if (value.replace(/['’]/g, "").includes("bricklayers labour") && value.includes("bricklayer single height")) return "quoteBricklayerSingleHeight";
  if (value.replace(/['’]/g, "").includes("bricklayers labour") && value.includes("bricklayer double heights")) return "quoteBricklayerDoubleHeights";
  if (value.replace(/['’]/g, "").includes("bricklayers labour") && value.includes("brick window sills required")) return "quoteBricklayerSillsLm";
  if (value.replace(/['’]/g, "").includes("bricklayers labour") && value.includes("brick sills")) return "quoteBricklayerSillsLm";
  if (value.replace(/['’]/g, "").includes("bricklayers labour") && value.includes("bricklayer")) return "quoteBricklayerFaceBricks";
  if (value.includes("rendering") && value.includes("item")) return "quoteRenderingNetWallAreaM2";
  if (value.includes("rendering") && value.includes("add for sills")) return "quoteRenderingSillsLm";
  if (value.includes("frame stage labour") && value.includes("install windows")) return "quoteFrameInstallWindows";
  if (value.includes("frame stage labour") && value.includes("second storey windows")) return "quoteFrameSecondStoreyWindows";
  if (value.includes("frame stage labour") && value.includes("third storey windows")) return "quoteFrameThirdStoreyWindows";
  if (value.includes("frame stage labour") && value.includes("stand & install roof trusses")) return "quoteFrameRoofTrusses";
  if (value.includes("frame stage labour") && value.includes("second storey trusses")) return "quoteFrameSecondStoreyTrusses";
  if (value.includes("frame stage labour") && value.includes("third storey trusses")) return "quoteFrameThirdStoreyTrusses";
  if (value.includes("frame stage labour") && value.includes("install ceiling battens ground floor")) return "quoteFrameCeilingBattensGroundM2";
  if (value.includes("frame stage labour") && value.includes("install ceiling battens second level")) return "quoteFrameCeilingBattensSecondM2";
  if (value.includes("frame stage labour") && value.includes("install ceiling battens third level")) return "quoteFrameCeilingBattensThirdM2";
  if (value.includes("frame stage labour") && value.includes("install ceiling battens")) return "quoteFrameCeilingBattensGroundM2";
  if (value.includes("lock-up stage labour") && value.includes("line eaves")) return "totalEavesLm";
  if (value.includes("lock-up stage labour") && value.includes("install sisalation") && value.includes("ground")) return "quoteSisalationInstallGroundM2";
  if (value.includes("lock-up stage labour") && value.includes("install sisalation") && (value.includes("second") || value.includes("upper"))) return "quoteSisalationInstallSecondM2";
  if (value.includes("lock-up stage labour") && value.includes("install sisalation") && value.includes("third")) return "quoteSisalationInstallThirdM2";
  if (value.includes("lock-up stage labour") && value.includes("install wall insulation batts") && value.includes("ground")) return "quoteWallBattsInstallGroundM2";
  if (value.includes("lock-up stage labour") && value.includes("install wall insulation batts") && (value.includes("second") || value.includes("upper"))) return "quoteWallBattsInstallSecondM2";
  if (value.includes("lock-up stage labour") && value.includes("install wall insulation batts") && value.includes("third")) return "quoteWallBattsInstallThirdM2";
  if (value.includes("lock-up stage labour") && value.includes("install insulation ceiling batts")) return "quoteCeilingInsulationFlatM2";
  if (value.includes("lock-up stage labour") && value.includes("install lightweight cladding") && value.includes("ground")) return "quoteLightweightCladdingInstallGroundM2";
  if (value.includes("lock-up stage labour") && value.includes("install lightweight cladding") && (value.includes("second") || value.includes("upper"))) return "quoteLightweightCladdingInstallSecondM2";
  if (value.includes("lock-up stage labour") && value.includes("install lightweight cladding") && value.includes("third")) return "quoteLightweightCladdingInstallThirdM2";
  if (value.includes("insulation") && value.includes("batts to ceilings")) return "quoteCeilingInsulationFlatM2";
  if (value.includes("insulation") && (value.includes("sialation installed") || value.includes("sisalation installed") || value.includes("sisaltion installed")) && value.includes("ground level")) return "quoteSisalationInstallGroundM2";
  if (value.includes("insulation") && (value.includes("sialation installed") || value.includes("sisalation installed") || value.includes("sisaltion installed")) && value.includes("second level")) return "quoteSisalationInstallSecondM2";
  if (value.includes("insulation") && (value.includes("sialation installed") || value.includes("sisalation installed") || value.includes("sisaltion installed")) && value.includes("third level")) return "quoteSisalationInstallThirdM2";
  if (value.includes("insulation") && value.includes("install wall batts") && value.includes("ground level")) return "quoteWallBattsInstallGroundM2";
  if (value.includes("insulation") && value.includes("install wall batts") && value.includes("second level")) return "quoteWallBattsInstallSecondM2";
  if (value.includes("insulation") && value.includes("install wall batts") && value.includes("third level")) return "quoteWallBattsInstallThirdM2";
  if (value.includes("frame stage labour") && value.includes("tie down & sheet bracing ground level")) return "quoteFrameTieDownSheetBracingGroundM2";
  if (value.includes("frame stage labour") && value.includes("tie down & sheet bracing second level")) return "quoteFrameTieDownSheetBracingSecondM2";
  if (value.includes("frame stage labour") && value.includes("tie down & sheet bracing third level")) return "quoteFrameTieDownSheetBracingThirdM2";
  if (value.includes("frame stage labour") && value.includes("exterior walls - ground floor")) return "quoteFrameExteriorWallsGroundLm";
  if (value.includes("frame stage labour") && value.includes("exterior walls - second level")) return "quoteFrameExteriorWallsSecondLm";
  if (value.includes("frame stage labour") && value.includes("exterior walls - third level")) return "quoteFrameExteriorWallsThirdLm";
  if (value.includes("frame stage labour") && value.includes("interior walls - lower")) return "quoteFrameInteriorWallsGroundLm";
  if (value.includes("frame stage labour") && value.includes("interior walls - second level")) return "quoteFrameInteriorWallsSecondLm";
  if (value.includes("frame stage labour") && value.includes("interior walls - third level")) return "quoteFrameInteriorWallsThirdLm";
  if (value.includes("frame stage labour") && value.includes("install floor joists") && value.includes("third")) return "quoteFrameFloorJoistsThirdM2";
  if (value.includes("frame stage labour") && value.includes("install floor joists")) return "quoteFrameFloorJoistsSecondM2";
  if (value.includes("frame stage labour") && value.includes("lay sheet flooring") && value.includes("third")) return "quoteFrameSheetFlooringThirdM2";
  if (value.includes("frame stage labour") && value.includes("lay sheet flooring")) return "quoteFrameSheetFlooringSecondM2";
  if (value.includes("external cladding") && value.includes("150mm linea board")) return "quote150LineaBoardLengths";
  if (value.includes("external cladding") && value.includes("180mm linea board")) return "quote180LineaBoardLengths";
  if (value.includes("external cladding") && value.includes("stria")) return "quote405StriaCladdingLengths";
  if (value.includes("external cladding") && value.includes("matrix")) return "quoteLightweightCladdingM2";
  if (value.includes("prefab") || value.includes("prefabricated")) return "prefabricatedWallFrameLm";
  if (value.includes("batten") || value.includes("furring")) return "wallBattensLm";
  if (value.includes("wall studs")) return "studsEach";
  if (value.includes("tie down plates") || value.includes("plate joiners")) return "wallPlatesLm";
  if (value.includes("plaster")) return "plasterboardWallM2";
  if (value.includes("skirting")) return "skirtingLm";
  if (value.includes("architrave") || value.includes("archs")) return "architraveLm";
  if (value.includes("cornice")) return "corniceLm";
  if (value.includes("reveal")) return "revealLm";
  if (value.includes("roof")) return "roofAreaM2";
  if (value.includes("blockwork") || value.includes("block work")) return "blockworkAreaM2";
  if (value.includes("brick veneer")) return "brickVeneerAreaM2";
  if (value.includes("brick")) return "brickworkAreaM2";
  if (value.includes("hebel")) return "hebelAreaM2";
  if (value.includes("lightweight")) return "lightweightCladdingAreaM2";
  if (value.includes("rendered")) return "renderedCladdingAreaM2";
  if (value.includes("cladding")) return "externalCladdingAreaM2";
  if (value.includes("concrete")) return "concreteM3";
  if (value.includes("rolled window flashing")) return "lightweightCladdingWindowCount";
  if (value.includes("window")) return "windowCount";
  if (value.includes("garage door")) return "garageDoorCount";
  if (value.includes("entry door")) return "entryDoorCount";
  if (value.includes("internal door")) return "internalDoors";
  if (value.includes("driveway")) return "drivewayM2";
  if (value.includes("cut/fill") || value.includes("cut fill")) return "cutFillM3";
  if (value.includes("total ground floor area")) return "lowerSlabAreaM2";
  if (value.includes("concretor - prep, pour & dress")) return "lowerSlabAreaM2";
  if (value.includes("70mm exterior walls frames")) return "totalExternal70mmWallsLm";
  if (value.includes("90mm exterior walls frames")) return "totalExternal90mmWallsLm";
  if (value.includes("70mm internal wall frames")) return "totalInternal70mmWallsLm";
  if (value.includes("90mm internal wall frames")) return "totalInternal90mmWallsLm";
  if (value.includes("retaining")) return "retainingWallLm";
  return "";
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
