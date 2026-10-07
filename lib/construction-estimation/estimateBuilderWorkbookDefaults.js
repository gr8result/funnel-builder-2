import { V4_DATA_SECTIONS } from "./estimateWorksheetV4Schema.js";
import { browserWorkspaceId } from '../builders/browserTenantStorage.js';
import { CURRENT_BUILDER_WORKSPACE_ID } from '../builders/currentBuilderSeed.js';
import { V4_DEFAULT_FORMULAS } from "./estimateBuilderWorkbookCalculations.js";
import importedWorkbook from "./importedExcelWorkbookTemplate.json";
import windowsWorkbook from "./windowsDoorsWorkbookRows.json";
import { withWindowDoorApproximateRate } from "./windowDoorApproximatePricing.js";
import { humeEntryDoorRows, isLegacyEntryDoorScheduleRow, supplementalEntryDoorRows } from "./humeEntryDoorPricing.js";
import { createDefaultStandardInclusions } from "../builders/standardInclusions.js";
import { getEffectiveApplianceCatalogue } from "../product-library/catalogueService.js";
import { resolveProductLibraryImage } from "../product-library/catalogueModel.js";
import { withEntryDoorLibraryQuotation } from "./entryDoorLibraryQuotation.js";
import { withWallLiningMappings } from './quotationWallLinings.js';
import { replaceCabinetryTemplate, isCabinetrySection } from './finalCabinetryQuotation.js';

const REMOVED_QUOTE_SECTION_NAMES = new Set(["upper level framing", "lock up materials", "quick render estimate", "project management", "entry doors", "entry doors - complete", "standard 820 entrace door", "plasterer", "fixout", "specials", "internal door complete", "internal cavity sliding door complete", "internal doors", "plumber's fit off costs", "electrician's fit off costs"]);
const REMOVED_IMPORTED_QUOTE_SOURCE_ROWS = new Set([161, 162, 163, 30076, 30077, 30080, 1248, 1250, 1251, 1350, 1351]);
const REMOVED_QUOTE_ROW_IDS = new Set(["quote-161", "quote-162", "quote-30076", "quote-30077", "quote-30080"]);
const QUOTE_ROWS_WITHOUT_IMPORTED_DATA = new Set([1272, 1373, 1374, 1380, 1381, 1382]);
const STANDARD_THREE_DOOR_ROBE_SECTION = "STANDARD 3 DOOR ROBE UP TO 3.6M WIDE";
const STANDARD_TWO_DOOR_LINEN_SECTION = "STANDARD 2 DOOR LINEN UP TO 2.4M WIDE";
const STANDARD_THREE_DOOR_LINEN_SECTION = "STANDARD 3 DOOR LINEN UP TO 3.6M WIDE";

const APPLIANCE_PACKAGE_SECTION = "APPLIANCES & WHITE GOODS";
const CONCRETE_LANDSCAPING_SECTION = "CONCRETE AND LANDSCAPING";
const UNDERSLAB_DRAINAGE_SECTION = "UNDERSLAB AND DRAINAGE";
const ROUGH_INS_SECTION = "ROUGH-INS";
const PLUMBERS_FIT_OFF_SECTION = "PLUMBER'S FIT OFF COSTS";
const ELECTRICIANS_FIT_OFF_SECTION = "ELECTRICIAN'S FIT OFF COSTS";




const OLD_LINEN_AND_ROBE_DOOR_SECTIONS = new Set([
  "space saver sling robe doors",
  "standard linen complete (2.4m wide)",
  "1800 wide 2 door x 2100 high",
  "3000 wide 3 door x 2100 high",
  "1800 wide 2 door x 2400 high",
  "3000 wide 3 door x 2400 high",
]);
const SUPERSEDED_APPLIANCE_SECTIONS = new Set([
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
const BLANK_QTY_QUOTE_SECTION_NAMES = new Set(["demolition works", "base brickwork", "face brickwork", "bricklayers labour", "entry doors", "double entry doors", "windows", "couplings", "misc", "materials", "roofing materials", "roofing labour", "renderers labour", "misc rendering"]);
const BLANK_VALUE_QUOTE_SECTION_NAMES = new Set(["hourly rate"]);
const TILING_MANUAL_QUOTE_SECTION_NAMES = new Set(["tiling", "toilet", "other room/s", "kitchen", "tile layer", "plumbing fittings & tapwear", "kitchen sinks", "kitchen taps", "vanity basins"]);

export function createEstimateBuilderWorkbookDefaults(plannerAnswers = {}, { workspaceId = browserWorkspaceId() } = {}) {
  const legacyBuilder = workspaceId === CURRENT_BUILDER_WORKSPACE_ID || (!workspaceId && typeof window === 'undefined');
  const values = { ...(legacyBuilder ? templateValues() : {}), ...defaultValues(plannerAnswers) };
  const windowsSource = legacyBuilder ? (windowsWorkbook?.rows?.length ? windowsWorkbook : importedWorkbook.windows) : null;
  const quotation = legacyBuilder ? replaceCabinetryTemplate(withWallLiningMappings(withEntryDoorLibraryQuotation(buildWorkbookQuoteSections(importedWorkbook.quotation))), workspaceId) : {};
  return {
    ...(workspaceId ? { workspaceId } : {}),
    jobInclusionScheduleId: null,
    jobInclusionScheduleName: null,
    jobInclusionScheduleVersion: null,
    jobInclusionSnapshot: null,
    appliedAt: null,
    page: "projectDashboard",
    activeSection: "inputDataSheet",
    formulas: { ...(legacyBuilder ? templateFormulas() : {}), ...V4_DEFAULT_FORMULAS },
    importedWorkbook: legacyBuilder ? importedWorkbook : null,
    data: Object.fromEntries(V4_DATA_SECTIONS.map((section) => [section.key, {
      collapsed: false,
      rows: Object.fromEntries(section.rows.map((row) => [row.key, {
        value: values[row.key] ?? "",
        notes: "",
      }])),
    }])),
    importedSheets: {
      dataInput: null,
      quotation: legacyBuilder ? importedWorkbook.quotation : null,
      windows: windowsSource,
    },
    importReport: legacyBuilder ? importedWorkbook.importReport || {} : {},
    windowsDoors: normalizeDefaultWindowsDoors((windowsSource?.rows || []).map((row) => importedOpening(row, windowsSource?.columns || []))),
    formulaRows: legacyBuilder ? flooringQuoteFormulaRows() : [],
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
    cashflowPayments: {
      1: "5%",
      2: "15%",
      3: "15%",
      4: "20%",
      5: "18%",
      6: "17%",
      7: "10%",
    },
    standardInclusions: createDefaultStandardInclusions(workspaceId || (legacyBuilder ? 'local-builder' : 'unconfigured-builder')),
    selected_standard_inclusions_package_id: legacyBuilder ? 'std-premier-range-inclusions' : '',
    productLibrary: {
      products: [],
      importedAt: "",
      updatedAt: "",
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
  const opening = {
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
  };
  return withWindowDoorApproximateRate({
    ...opening,
    sizeCode: windowDoorSizeCodeForRow(opening),
  });
}

export function windowDoorSizeCodeForRow(row = {}) {
  if (isEntryDoorSizeCodeExcluded(row)) return "";
  const heightCode = dimensionCode(row.height, row.code, 0);
  const widthCode = dimensionCode(row.width, row.code, 1);
  if (!heightCode || !widthCode) return "";
  const suffix = windowDoorSizeCodeSuffix(row);
  return `${heightCode}${widthCode}${suffix ? ` ${suffix}` : ""}`;
}

function isEntryDoorSizeCodeExcluded(row = {}) {
  const text = `${row.section || ""} ${row.type || ""} ${row.code || ""}`.toLowerCase();
  return text.includes("entry door");
}

function dimensionCode(value, code, index) {
  const fromValue = numericDimensionCode(value);
  if (fromValue) return fromValue;
  const parts = String(code || "").match(/\d+(?:\.\d+)?/g) || [];
  return numericDimensionCode(parts[index]);
}

function numericDimensionCode(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const hundreds = numeric > 20 ? Math.round(numeric / 100) : Math.round(numeric * 10);
  return String(hundreds).padStart(2, "0");
}

function windowDoorSizeCodeSuffix(row = {}) {
  const text = `${row.section || ""} ${row.type || ""}`.toLowerCase();
  if (text.includes("doors") && text.includes("sliding")) return "GSD";
  if (text.includes("awning")) return "AW";
  if (text.includes("double hung")) return "DH";
  if (text.includes("louvre")) return "LV";
  if (text.includes("casement")) return "CA";
  if (text.includes("fixed")) return "FG";
  return "";
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
  return Object.fromEntries(orderTilingSubsections(
    insertFitOffCostSections(
      insertUnderslabDrainageSection(
        insertRoughInsSection(
          insertConcreteLandscapingSection(
            insertFloorcoveringQuoteSections(
              insertAppliancePackageSection(
                insertManualLinenSections(
                  insertCabinetrySection(entries),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ));
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
  const cabinetIndex = withoutGenerated.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "cabinetry");
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
  const catalogue = getEffectiveApplianceCatalogue({ organisationId: "" });
  const packsByBrand = new Map(catalogue.brands.map((brand) => [brand, []]));
  const packagedProductIds = new Set(catalogue.packs.flatMap((pack) => pack.componentProductIds || []));
  catalogue.packs.forEach((pack) => {
    const brand = String(pack.brand || pack.brandName || "GENERAL").trim() || "GENERAL";
    packsByBrand.set(brand, [...(packsByBrand.get(brand) || []), pack]);
  });
  Array.from(packsByBrand.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([brand, packs]) => {
      const sectionName = applianceBrandSectionName(brand);
      const section = {
        collapsed: true,
        columns: ["Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"],
        rows: [],
      };
      packs
        .sort((left, right) => (left.name || left.packName || "").localeCompare(right.name || right.packName || ""))
        .forEach((pack) => {
          section.rows.push(appliancePackageQuoteRow(appliancePackHeadingQuoteSource(pack), section.rows.length, sectionName));
          appliancePackComponentQuoteSources(pack).forEach((row) => {
            section.rows.push(appliancePackageQuoteRow(row, section.rows.length, sectionName));
          });
        });
      catalogue.records
        .filter((record) => record.brand === brand && !packagedProductIds.has(record.productId))
        .sort((left, right) => (left.name || "").localeCompare(right.name || ""))
        .forEach((record) => section.rows.push(applianceIndividualQuoteRow(record, sectionName)));
      sections.push([sectionName, section]);
    });
  return sections;
}

function applianceIndividualQuoteRow(record, sectionName) {
  const row = appliancePackageQuoteRow({
    item: record.name || record.productName,
    productName: record.name || record.productName,
    productDescription: record.description || "",
    unit: record.unit || "EACH",
    rate: record.price ?? "",
    cost: "",
    source: "Product Library",
    brand: record.brand,
    manufacturer: record.brand,
    supplier: record.supplier || record.brand,
    model: record.model,
    sku: record.sku || record.model,
    canonicalProductId: record.productId,
    productCode: record.productCode || record.productId,
    productImageUrl: productLibraryImageReference(record),
    productLibrarySnapshot: productLibraryQuoteSnapshot(record),
  }, 0, sectionName);
  return {
    ...row,
    id: `quote-appliance-product-${record.productId}`,
    formulas: {},
    sourceOfRate: "Product Library",
    quoteRequired: record.price == null,
  };
}

function appliancePackHeadingQuoteSource(pack = {}) {
  return {
    sourceRow: Number(pack.sourceRowIds?.[0]) || 0,
    section: pack.name || pack.packName || "",
    item: pack.name || pack.packName || "",
    qty: "",
    unit: "",
    rate: "",
    cost: "",
    source: "Product Library",
    notes: pack.description || "",
    heading: true,
    headingLevel: 2,
    brand: pack.brand || pack.brandName || "",
    package: pack.name || pack.packName || "",
    canonicalProductId: pack.productId || pack.packId || "",
    productCode: pack.productCode || pack.productId || pack.packId || "",
  };
}

function appliancePackComponentQuoteSources(pack = {}) {
  const componentsById = new Map((pack.components || []).map((component) => [component.productId, component]));
  const relationships = Array.isArray(pack.componentRelationships) && pack.componentRelationships.length
    ? pack.componentRelationships
    : (pack.componentProductIds || []).map((componentProductId, index) => ({ componentProductId, sourceRowId: String(index + 1) }));
  return relationships.map((relationship) => {
    const component = componentsById.get(relationship.componentProductId) || {};
    const item = [component.brand, component.name || component.productName || relationship.componentProductId].filter(Boolean).join(" ");
    return {
      sourceRow: Number(relationship.sourceRowId) || 0,
      section: "APPLIANCES",
      item: `- ${item}`.trim(),
      qty: "",
      unit: component.unit || "EACH",
      rate: component.price ?? "",
      cost: 0,
      source: "Product Library",
      notes: "Component item for pack above. Use EACH rate only if pricing separately.",
      heading: false,
      headingLevel: 0,
      productName: component.productName || component.name || item,
      productDescription: component.description || "",
      supplier: component.supplier || pack.supplier || "",
      brand: pack.brand || pack.brandName || component.brand || "",
      manufacturer: component.manufacturer || component.brand || pack.brand || pack.brandName || "",
      sku: component.sku || component.model || component.productCode || component.productId || relationship.componentProductId || "",
      model: component.model || component.sku || "",
      productImageUrl: productLibraryImageReference(component),
      thumbnailUrl: component.thumbnailUrl || component.primaryImageUrl || component.imageUrl || "",
      package: pack.name || pack.packName || "",
      canonicalProductId: component.productId || relationship.componentProductId || "",
      productCode: component.productCode || component.productId || relationship.componentProductId || "",
      productLibrarySnapshot: productLibraryQuoteSnapshot(component),
    };
  });
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
    canonicalProductId: row.canonicalProductId || "",
    productCode: row.productCode || row.canonicalProductId || "",
    productName: row.productName || "",
    productDescription: row.productDescription || "",
    supplier: row.supplier || "",
    brand: row.brand || "",
    manufacturer: row.manufacturer || row.brand || "",
    sku: row.sku || row.model || row.productCode || row.canonicalProductId || "",
    model: row.model || "",
    productImageUrl: row.productImageUrl || "",
    thumbnailUrl: row.thumbnailUrl || row.productImageUrl || "",
    productLibrarySnapshot: row.productLibrarySnapshot || null,
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

function insertConcreteLandscapingSection(entries = []) {
  const withoutExisting = entries.filter(([sectionName]) => normalizeQuoteSectionName(sectionName) !== normalizeQuoteSectionName(CONCRETE_LANDSCAPING_SECTION));
  const section = [CONCRETE_LANDSCAPING_SECTION, {
    collapsed: true,
    columns: ["Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"],
    rows: concreteLandscapingRows(),
  }];
  const miscellaneousIndex = withoutExisting.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "miscellaneous");
  if (miscellaneousIndex < 0) return [...withoutExisting, section];
  return [
    ...withoutExisting.slice(0, miscellaneousIndex + 1),
    section,
    ...withoutExisting.slice(miscellaneousIndex + 1),
  ];
}

function insertUnderslabDrainageSection(entries = []) {
  const withoutExisting = entries.filter(([sectionName]) => normalizeQuoteSectionName(sectionName) !== normalizeQuoteSectionName(UNDERSLAB_DRAINAGE_SECTION));
  const section = [UNDERSLAB_DRAINAGE_SECTION, {
    collapsed: true,
    columns: ["Item", "Qty", "Unit", "Rate", "Cost", "Source", "Notes"],
    rows: underslabDrainageRows(),
  }];
  const bulkIndex = withoutExisting.findIndex(([sectionName]) => normalizeQuoteSectionName(sectionName) === "bulk earthworks");
  if (bulkIndex < 0) return [...withoutExisting, section];
  return [
    ...withoutExisting.slice(0, bulkIndex + 1),
    section,
    ...withoutExisting.slice(bulkIndex + 1),
  ];
}

function insertRoughInsSection(entries = []) {
  const withoutExisting = entries.filter(([sectionName]) => normalizeQuoteSectionName(sectionName) !== normalizeQuoteSectionName(ROUGH_INS_SECTION));
  return withoutExisting;
}

function insertFitOffCostSections(entries = []) {
  const sectionNames = new Set([PLUMBERS_FIT_OFF_SECTION, ELECTRICIANS_FIT_OFF_SECTION].map(normalizeQuoteSectionName));
  return entries.filter(([sectionName]) => !sectionNames.has(normalizeQuoteSectionName(sectionName)));
}

function underslabDrainageRows() {
  return [
    { sourceRow: 30075, item: "Plumbers costs for undersslab and drainage", unit: "ITEM", rate: "" },
  ].map((row) => manualQuoteRow({ ...row, section: UNDERSLAB_DRAINAGE_SECTION }));
}

function roughInsRows() {
  return [];
}

function concreteLandscapingRows() {
  return [
    { sourceRow: 30060, item: "PLAIN CONCRETE DRIVEWAY", unit: "M2", rate: "$110.00" },
    { sourceRow: 30061, item: "EXPOSED AGG CONCRETE DRIVEWAY", unit: "M2", rate: "$160.00" },
    { sourceRow: 30062, item: "CONCRETE CLOTHESLINE PAD", unit: "M2", rate: "$110.00" },
    { sourceRow: 30063, item: "CONCRETE PATHS 1 M WIDE", unit: "M2", rate: "$110.00" },
    { sourceRow: 30064, item: "CONCRETE CLOTHESLINE PAD - EXPOSED AGG", unit: "M2", rate: "$160.00" },
    { sourceRow: 30065, item: "CONCRETE PATHS 1 M WIDE - EXPOSED AGG", unit: "M2", rate: "$160.00" },
    { sourceRow: 30066, item: "TIMBER SLEEPER RETAINER WALLS > 1.0m HIGH", unit: "LM", rate: "$260.00" },
    { sourceRow: 30067, item: "TIMBER SLEEPER RETAINER WALLS > 1.5.0m HIGH - ENGINEERED", unit: "LM", rate: "$480.00" },
    { sourceRow: 30068, item: "CONCRETE SLEEP RETAININER WALL > 1.0m HIGH", unit: "LM", rate: "$380.00" },
    { sourceRow: 30069, item: "CONCRETE SLEEP RETAININER WALL > 1.5m HIGH", unit: "LM", rate: "$550.00" },
    { sourceRow: 30070, item: "CONCRETE SLEEP RETAININER WALL > 2.0m HIGH", unit: "LM", rate: "$1,050.00" },
    { sourceRow: 30071, item: "IMPORT PREMIUM TOP SOIL", unit: "M3", rate: "$260.00" },
    { sourceRow: 30072, item: "PREARATION OF GROUND FOR TURF", unit: "ITEM", rate: "" },
    { sourceRow: 30073, item: "BASIC TURF - SUPPLY AND LAY", unit: "M2", rate: "$24.00" },
    { sourceRow: 30074, item: "PREMIUM TURF - SUPPLY AND LAY", unit: "M2", rate: "$45.00" },
  ].map((row) => manualQuoteRow({ ...row, section: CONCRETE_LANDSCAPING_SECTION }));
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
    ["ENGINEERED TIMBER", [
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





function movePlastererQuoteRowToSupplyInstall(entries = []) {
  const corniceRowsToMove = [];
  const entriesWithoutCorniceRows = entries.map(([sectionName, section]) => {
    if (normalizeQuoteSectionName(sectionName) !== "plastering extras") return [sectionName, section];
    const rows = [];
    (section.rows || []).forEach((row) => {
      if ([1279, 1280].includes(quoteRowSourceNumber(row))) {
        corniceRowsToMove.push({ ...row, section: "PLASTERER - SUPPLY AND INSTALL" });
      } else {
        rows.push(row);
      }
    });
    return [sectionName, { ...section, rows }];
  });
  return entriesWithoutCorniceRows.map(([sectionName, section]) => {
    if (normalizeQuoteSectionName(sectionName) !== "plasterer - supply and install") return [sectionName, section];
    const targetCorniceRows = (section.rows || []).filter((row) => [1279, 1280].includes(quoteRowSourceNumber(row)));
    const existingRows = (section.rows || []).filter((row) => ![1279, 1280].includes(quoteRowSourceNumber(row)));
    const movedRows = [1279, 1280]
      .map((sourceRow) =>
        targetCorniceRows.find((row) => quoteRowSourceNumber(row) === sourceRow)
        || corniceRowsToMove.find((row) => quoteRowSourceNumber(row) === sourceRow)
        || defaultCorniceQuoteRow(sourceRow)
      )
      .filter(Boolean)
      .map(normalizeDefaultPlasterSupplyInstallRow);
    return [sectionName, {
      ...section,
      rows: insertRowsAfter(
        insertRowsBefore(
          existingRows.filter((row) => row?.id !== "quote-plaster-supply-install"),
          [plasterSupplyInstallQuoteRow()],
          "quote-1269"
        ),
        movedRows,
        "quote-1271"
      ),
    }];
  });
}

function defaultCorniceQuoteRow(sourceRow) {
  if (sourceRow === 1279) {
    return {
      id: "quote-1279",
      excelRow: 1279,
      importedWorkbookRow: true,
      section: "PLASTERER - SUPPLY AND INSTALL",
      values: ["55mm COVE CORNICE", "", "", "LM", "", "$8.71", ""],
      formulas: { F: "6.6*1.1*1.2", G: "B1279*F1279" },
      item: "55mm COVE CORNICE",
      quantity: "",
      importedQuantity: "",
      quantityKey: "",
      unit: "LM",
      excelRate: "$8.71",
      sourceOfRate: "workbook",
      rawText: "55mm COVE CORNICE",
      notes: "",
    };
  }
  if (sourceRow === 1280) {
    return {
      id: "quote-1280",
      excelRow: 1280,
      importedWorkbookRow: true,
      section: "PLASTERER - SUPPLY AND INSTALL",
      values: ["90mm COVE CORNICE", "", "", "LM", "", "$11.22", ""],
      formulas: { F: "8.5*1.1*1.2", G: "B1280*F1280" },
      item: "90mm COVE CORNICE",
      quantity: "",
      importedQuantity: "",
      quantityKey: "corniceLm",
      unit: "LM",
      excelRate: "$11.22",
      sourceOfRate: "workbook",
      rawText: "90mm COVE CORNICE",
      notes: "IMPORTED DATA",
      autoQuantity: true,
      quantityManualOverride: false,
    };
  }
  return null;
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
    const withoutGeneratedRows = rows.filter((row) => !["quote-30039", "quote-30040", "quote-30041", "quote-30042", "quote-30043", "quote-30045", "quote-30046"].includes(row.id));
    return insertRowsAfter(
      insertRowsAfter(
        insertRowsAfter(
          insertRowsAfter(
            insertRowsAfter(withoutGeneratedRows, [frameStageThirdStoreyWindowsRow()], "quote-74"),
            [frameStageThirdStoreyTrussesRow()],
            "quote-78"
          ),
          [frameStageThirdFloorJoistsRow(), frameStageThirdSheetFlooringRow()],
          "quote-99"
        ),
        [frameStageCavityCagesRow()],
        "quote-68"
      ),
      [frameStageRobeDoorsRow(), frameStageLinenDoorsRow()],
      "quote-30043"
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



















function productLibraryImageReference(product = {}) {
  return product.primaryImageUrl
    || product.thumbnailUrl
    || product.imageUrl
    || product.image
    || product.thumbnail
    || resolveProductLibraryImage({
    product,
    familyKey: product.familyKey || product.familyId || product.categoryKey || "",
    categoryKey: product.categoryKey || product.familyName || "",
    areaKey: product.topLevelArea || "",
  });
}

function productLibraryQuoteSnapshot(product = {}) {
  if (!product || (!product.productCode && !product.productId)) return null;
  const productId = product.productCode || product.productId;
  const imageReference = productLibraryImageReference(product);
  return {
    productId,
    productCode: product.productCode || product.productId || "",
    productName: product.productName || product.name || "",
    brand: product.brand || product.manufacturer || "",
    manufacturer: product.manufacturer || product.brand || "",
    supplier: product.supplier || "",
    sku: product.sku || product.model || product.productCode || product.productId || "",
    model: product.model || product.sku || "",
    description: product.description || "",
    imageReference,
    productImageUrl: imageReference,
    thumbnailUrl: product.thumbnailUrl || imageReference,
    familyKey: product.familyKey || product.familyId || "",
    canonicalType: product.attributes?.canonicalType || "",
    priceStatus: product.priceStatus || "quote_required",
  };
}







function normalizeDefaultPlasterSupplyInstallRow(row) {
  if (row.id === "quote-1269") {
    return defaultLinkedQuoteRow(row, "GYPROCK SUPPLY & FIX - EXTERIOR WALLS", "totalExternalPlasterboardWallM2", "$22.00");
  }
  if (row.id === "quote-1270") {
    return defaultLinkedQuoteRow(row, "GYPROCK SUPPLY & FIX - INTERNAL WALLS", "totalInternalPlasterboardWallM2", "$22.00");
  }
  if (row.id === "quote-1271") {
    return defaultLinkedQuoteRow(row, "GYPROCK SUPPLY & FIX - CEILINGS", "totalCeilingAreasM2", "$22.00");
  }
  if (row.id === "quote-1279") {
    return {
      ...row,
      item: "55mm COVE CORNICE",
      rawText: "55mm COVE CORNICE",
      quantity: "",
      importedQuantity: "",
      quantityKey: "",
      autoQuantity: false,
      quantityManualOverride: false,
      unit: "LM",
      values: ["55mm COVE CORNICE", "", "", "LM", "", row.excelRate || "$8.71", ""],
    };
  }
  if (row.id === "quote-1280") {
    return {
      ...defaultLinkedQuoteRow(row, "90mm COVE CORNICE", "corniceLm", row.excelRate || "$11.22"),
      unit: "LM",
      values: ["90mm COVE CORNICE", "", "", "LM", "", row.excelRate || "$11.22", ""],
    };
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
  const canonicalProductId = row.canonicalProductId || existing.canonicalProductId || "";
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
    canonicalProductId,
    productCode: row.productCode || existing.productCode || canonicalProductId,
    productName: row.productName || existing.productName || row.productLibrarySnapshot?.productName || "",
    productDescription: row.productDescription || existing.productDescription || row.productLibrarySnapshot?.description || "",
    supplier: row.supplier || existing.supplier || row.productLibrarySnapshot?.supplier || "",
    brand: row.brand || existing.brand || row.productLibrarySnapshot?.brand || "",
    manufacturer: row.manufacturer || existing.manufacturer || row.productLibrarySnapshot?.manufacturer || "",
    sku: row.sku || existing.sku || row.productLibrarySnapshot?.sku || "",
    model: row.model || existing.model || row.productLibrarySnapshot?.model || "",
    productImageUrl: row.productImageUrl || existing.productImageUrl || row.productLibrarySnapshot?.productImageUrl || row.productLibrarySnapshot?.imageReference || "",
    thumbnailUrl: row.thumbnailUrl || existing.thumbnailUrl || row.productLibrarySnapshot?.thumbnailUrl || row.productLibrarySnapshot?.imageReference || "",
    productLibraryFamilyKey: row.productLibraryFamilyKey || existing.productLibraryFamilyKey || "",
    productLibraryCatalogueOwner: row.productLibraryCatalogueOwner || existing.productLibraryCatalogueOwner || "",
    productLibrarySnapshot: row.productLibrarySnapshot || existing.productLibrarySnapshot || null,
    canonicalMappingStatus: row.canonicalMappingStatus || existing.canonicalMappingStatus || "",
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
  );
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
  if (normalizeQuoteSectionName(section) === "skirting & architraves") return "FIX OUT";
  return section;
}

function removeRoofingMaterialsRemovedRows(rows = []) {
  return rows.filter((row) => {
    const rowNumber = quoteRowSourceNumber(row);
    return rowNumber < 1130 || rowNumber > 1266;
  });
}

function removeRemovedImportedQuoteRows(rows = []) {
  return rows.filter((row) => !isRemovedQuoteRow(row));
}

function isRemovedQuoteSourceRow(row = {}) {
  const sourceRow = Number(row?.sourceRow ?? row?.excelRow ?? row?.importedWorkbookRow ?? 0);
  return Number.isFinite(sourceRow) && REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(sourceRow);
}

function isRemovedQuoteRow(row = {}) {
  if (REMOVED_QUOTE_ROW_IDS.has(String(row?.id || ""))) return true;
  if (REMOVED_IMPORTED_QUOTE_SOURCE_ROWS.has(quoteRowSourceNumber(row))) return true;
  if (isRemovedQuoteSection(row?.section)) return true;
  const text = `${row?.item || ""} ${row?.rawText || ""} ${Array.isArray(row?.values) ? row.values.join(" ") : ""}`.toLowerCase();
  return (text.includes("plumber") || text.includes("electrician")) && text.includes("fit off");
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

// Cavity slider cage supply/install did not previously exist as a Quote Sheet line - only as a
// Job Setup materials-cost input (inputDataSheetTemplate "totalCavitySliderCagesEach", "90mm
// Cavity Slider Cages", EACH, $119.03) and as a separate fix-out labour item for hanging the door
// itself. This mirrors that existing rate rather than inventing a new one; quantityKey links it to
// the same field (also promoted into estimateBuilderWorkbookCalculations.js's `quantities`), so it
// tracks the number of cavity sliding doors Apply Takeoff has measured.
function frameStageCavityCagesRow() {
  return {
    id: "quote-30043",
    excelRow: 68.1,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["INSTALL CAVITY CAGES", "", "", "EACH", "", "$119.03", ""],
    formulas: {},
    item: "INSTALL CAVITY CAGES",
    quantity: "",
    importedQuantity: "",
    quantityKey: "totalCavitySliderCagesEach",
    unit: "EACH",
    excelRate: "$119.03",
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
    rawText: "INSTALL CAVITY CAGES",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

// ROBE DOORS did not previously exist as a Quote Sheet line. Its quantity is a genuine per-project
// count with no reliable takeoff signal to derive it from automatically (a takeoff opening's
// subType 'Robe' only flags a SLIDING wardrobe door, never a hinged one - counting it alone would
// silently under-count), so it is captured once in Job Setup (inputDataSheet.robeDoorCount) and
// linked here exactly like totalCavitySliderCagesEach/quote-30043 above. No standalone per-door
// rate exists anywhere in the imported catalogue (only bundled complete-robe-unit prices, e.g.
// "COMPLETE ROBE UP TO 2.4 WIDE"), so every rate field below is deliberately left blank rather than
// invented - finalRate() in estimateBuilderWorkbookCalculations.js resolves that to sourceOfRate
// "rate missing", not a fabricated $0 price.
function frameStageRobeDoorsRow() {
  return {
    id: "quote-30045",
    excelRow: 68.2,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["ROBE DOORS", "", "", "EACH", "", "", ""],
    formulas: {},
    item: "ROBE DOORS",
    quantity: "",
    importedQuantity: "",
    quantityKey: "robeDoorCount",
    unit: "EACH",
    excelRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "ROBE DOORS",
    notes: "IMPORTED DATA",
    autoQuantity: true,
    quantityManualOverride: false,
  };
}

// LINEN DOORS - same treatment as ROBE DOORS above, an entirely separate quantity/count
// (inputDataSheet.linenDoorCount) never combined with robe doors. No 'linen' room or door-type
// classification exists anywhere in the AI Plan Takeoff, so there is no takeoff signal at all to
// derive this from automatically - Job Setup is the sole source. Same "rate missing" treatment:
// no standalone per-door rate exists in the catalogue (only bundled complete-linen-unit prices,
// e.g. "COMPLETE LINEN UP TO 2.4 WIDE"), so the rate is left unresolved, not invented.
function frameStageLinenDoorsRow() {
  return {
    id: "quote-30046",
    excelRow: 68.3,
    importedWorkbookRow: false,
    section: "Frame Stage Labour",
    values: ["LINEN DOORS", "", "", "EACH", "", "", ""],
    formulas: {},
    item: "LINEN DOORS",
    quantity: "",
    importedQuantity: "",
    quantityKey: "linenDoorCount",
    unit: "EACH",
    excelRate: "",
    supplierCatalogueRate: "",
    quotedSupplierRate: "",
    manualRate: "",
    supplierQuote: "",
    sourceOfRate: "",
    quoteRequired: false,
    lineType: "Standard rate item",
    discontinuedWarning: false,
    active: true,
    importedCost: "",
    rawText: "LINEN DOORS",
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

function manualQuoteRow({ sourceRow, item, unit, quantityKey = "", rate = "", section = "BULK EARTHWORKS" }) {
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
  if (value.includes("quote-1587") || value.includes("source row 1587") || value.includes("bathroom skirting tiles")) return "";
  if (value.includes("quote-1600") || value.includes("source row 1600") || value.includes("ensuite skirting tiles")) return "";
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
  if (isManualCeilingBattInsulationText(value)) return "";
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
  if (value.includes("external cladding") && value.includes("180mm jh linea board planks")) return "quote180LineaBoardPlankQty";
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
  if (value.includes("55mm cove cornice")) return "";
  if (value.includes("90mm cove cornice")) return "corniceLm";
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

function isManualCeilingBattInsulationText(value) {
  const text = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  return text.includes("insulation")
    && (
      text.includes("r 1.5 batts to ceilings")
      || text.includes("r1.5 batts to ceilings")
      || text.includes("r4.8 batts to ceilings")
      || text.includes("r 4.8 batts to ceilings")
    );
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

function insertCabinetrySection(entries) {
  const filtered = entries.filter(([name])=>!isCabinetrySection(name) && !SUPERSEDED_APPLIANCE_SECTIONS.has(normalizeQuoteSectionName(name)));
  const index = filtered.findLastIndex(([name])=>['fix out materials','shelving','standard 2 door linen up to 2.4m wide','standard 3 door linen up to 3.6m wide'].includes(normalizeQuoteSectionName(name)));
  filtered.splice(index < 0 ? filtered.length : index+1,0,['CABINETRY',{collapsed:false,rows:[]}]);
  return filtered;
}
