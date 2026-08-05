export const QUOTATION_TEMPLATE_CSV_COLUMNS = [
  "quote_item_code",
  "category",
  "subcategory",
  "item_name",
  "description",
  "unit",
  "cost_rate",
  "sell_rate",
  "allowance",
  "supplier",
  "active_status",
  "quotation_stage",
  "selection_area",
  "selection_category",
  "selection_item_name",
  "quantity_rule",
  "include_in_selections",
  "notes",
];

const APPROVED_MAPPING_STORAGE_PREFIX = "gr8:selections:approved-quote-mapping:v1";

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function normaliseHeader(value) {
  return text(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function csvCell(value) {
  const raw = text(value);
  if (!/[",\r\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function parseCsvObjects(textInput) {
  const source = text(textInput).replace(/^\uFEFF/, "");
  if (!source.trim()) throw new Error("CSV file is empty.");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => text(cell).trim())) rows.push(row);
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  const [headers, ...body] = rows.filter((candidate) => candidate.some((cell) => text(cell).trim()));
  if (!headers?.length) throw new Error("CSV headers are missing.");
  const keys = headers.map(normaliseHeader);
  return body
    .filter((cells) => cells.some((cell) => text(cell).trim()))
    .map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? ""])));
}

function sectionsFromWorkbook(workbook, quoteSections) {
  const quotation = workbook?.quotation || {};
  const order = Array.isArray(quoteSections) && quoteSections.length ? quoteSections : Object.keys(quotation);
  const seen = new Set();
  return [...order, ...Object.keys(quotation)]
    .filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(quotation[key]);
    })
    .map((key) => ({ key, section: quotation[key] }));
}

export function quotationTemplateItemsFromWorkbook(workbook, quoteSections = []) {
  return sectionsFromWorkbook(workbook, quoteSections).flatMap(({ key, section }) => {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    return rows.map((row) => {
      const code = text(row.id || (row.excelRow ? `quote-${row.excelRow}` : ""));
      return {
        quote_item_code: code,
        category: text(row.section || key),
        subcategory: key === row.section ? "" : text(key),
        item_name: text(row.item || row.label || row.rawText || code),
        description: text(row.rawText || row.notes || row.item || ""),
        unit: text(row.unit),
        cost_rate: text(row.importedCost),
        sell_rate: text(row.excelRate || row.manualRate || row.quotedSupplierRate || row.supplierCatalogueRate),
        allowance: text(row.allowance || ""),
        supplier: text(row.supplierQuote || ""),
        active_status: row.active === false ? "inactive" : "active",
        quotation_stage: text(row.section || key),
        selection_area: "",
        selection_category: "",
        selection_item_name: "",
        quantity_rule: "",
        include_in_selections: "yes",
        notes: "",
      };
    });
  });
}

export function quotationTemplateCsvFromWorkbook(workbook, quoteSections = []) {
  const items = quotationTemplateItemsFromWorkbook(workbook, quoteSections);
  return rowsToCsv([QUOTATION_TEMPLATE_CSV_COLUMNS, ...items.map((item) => QUOTATION_TEMPLATE_CSV_COLUMNS.map((field) => item[field] ?? ""))]);
}

export function approvedMappingsCsv(mappings = []) {
  const rows = mappings.map((mapping) => QUOTATION_TEMPLATE_CSV_COLUMNS.map((field) => {
    if (field === "quote_item_code") return mapping.quoteItemCode;
    if (field === "selection_area") return mapping.selectionArea;
    if (field === "selection_category") return mapping.selectionCategory;
    if (field === "selection_item_name") return mapping.selectionItemName;
    if (field === "quantity_rule") return mapping.quantityRule;
    if (field === "include_in_selections") return mapping.approvedForSelections ? "yes" : "no";
    if (field === "notes") return mapping.notes;
    return mapping.quoteItem?.[field] ?? "";
  }));
  return rowsToCsv([QUOTATION_TEMPLATE_CSV_COLUMNS, ...rows]);
}

function value(row, field) {
  return text(row[normaliseHeader(field)] ?? row[field]).trim();
}

function validateHeaders(row) {
  const present = new Set(Object.keys(row || {}).map(normaliseHeader));
  return QUOTATION_TEMPLATE_CSV_COLUMNS.filter((header) => !present.has(header));
}

export function previewApprovedSelectionsCsv(csvText, quoteItems, existingMappings = [], sourceFilename = "") {
  const rows = parseCsvObjects(csvText);
  const missingHeaders = validateHeaders(rows[0] || {});
  if (missingHeaders.length) throw new Error(`CSV headers are missing: ${missingHeaders.join(", ")}.`);
  const quoteByCode = new Map(quoteItems.map((item) => [text(item.quote_item_code), item]));
  const seen = new Map();
  const validRows = [];
  const invalidRows = [];
  const duplicateItemCodes = [];
  const missingItemCodes = [];
  const unknownItemCodes = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const code = value(row, "quote_item_code");
    if (!code) {
      missingItemCodes.push(rowNumber);
      invalidRows.push({ rowNumber, quoteItemCode: "", reason: "Missing quote_item_code" });
      return;
    }
    if (seen.has(code)) {
      duplicateItemCodes.push(code);
      invalidRows.push({ rowNumber, quoteItemCode: code, reason: "Duplicate quote_item_code" });
      return;
    }
    seen.set(code, rowNumber);
    const quoteItem = quoteByCode.get(code);
    if (!quoteItem) {
      unknownItemCodes.push(code);
      invalidRows.push({ rowNumber, quoteItemCode: code, reason: "Quote item code not found in current Quotation Builder source" });
      return;
    }
    const selectionArea = value(row, "selection_area");
    const selectionItemName = value(row, "selection_item_name");
    if (!selectionArea || !selectionItemName) {
      invalidRows.push({ rowNumber, quoteItemCode: code, reason: "selection_area and selection_item_name are required for approved selections" });
      return;
    }
    validRows.push({
      quoteItemCode: code,
      selectionArea,
      selectionCategory: value(row, "selection_category"),
      selectionItemName,
      quantityRule: value(row, "quantity_rule"),
      approvedForSelections: value(row, "include_in_selections").toLowerCase() !== "no",
      importedAt: new Date().toISOString(),
      sourceFilename,
      notes: value(row, "notes"),
      quoteItem,
    });
  });

  const uploadedCodes = new Set(validRows.map((row) => row.quoteItemCode));
  const removedMappings = existingMappings.filter((mapping) => mapping.approvedForSelections !== false && !uploadedCodes.has(mapping.quoteItemCode));
  return {
    filename: sourceFilename,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateItemCodes: [...new Set(duplicateItemCodes)],
    missingItemCodes,
    unknownItemCodes: [...new Set(unknownItemCodes)],
    removedMappings,
    retainedSelectionAreas: [...new Set(validRows.map((row) => row.selectionArea).filter(Boolean))].sort(),
    retainedCategories: [...new Set(validRows.map((row) => row.selectionCategory).filter(Boolean))].sort(),
    retainedSelectionItemNames: [...new Set(validRows.map((row) => row.selectionItemName).filter(Boolean))].sort(),
    quantityRules: [...new Set(validRows.map((row) => row.quantityRule).filter(Boolean))].sort(),
    warnings: removedMappings.length ? [`${removedMappings.length} previously approved mapping(s) are not present in this upload.`] : [],
    canImport: invalidRows.length === 0,
  };
}

export function applyApprovedSelectionsImport(existingMappings, preview, removedAction = "remove") {
  const incomingByCode = new Map(preview.validRows.map((row) => [row.quoteItemCode, row]));
  const next = existingMappings
    .filter((mapping) => {
      if (incomingByCode.has(mapping.quoteItemCode)) return false;
      const removed = preview.removedMappings.some((item) => item.quoteItemCode === mapping.quoteItemCode);
      return removed ? removedAction === "remain" : true;
    })
    .map((mapping) => {
      const removed = preview.removedMappings.some((item) => item.quoteItemCode === mapping.quoteItemCode);
      return removed && removedAction === "remain" ? { ...mapping, approvedForSelections: true } : mapping;
    });
  return [...next, ...preview.validRows].map((mapping) => ({
    quoteItemCode: mapping.quoteItemCode,
    selectionArea: mapping.selectionArea,
    selectionCategory: mapping.selectionCategory,
    selectionItemName: mapping.selectionItemName,
    quantityRule: mapping.quantityRule,
    approvedForSelections: mapping.approvedForSelections !== false,
    importedAt: mapping.importedAt,
    sourceFilename: mapping.sourceFilename,
    notes: mapping.notes,
    quoteItem: mapping.quoteItem,
  }));
}

function storageKey(context = {}) {
  const org = text(context.organisationId || "local_builder");
  const project = text(context.projectId || "global");
  return `${APPROVED_MAPPING_STORAGE_PREFIX}:${org}:${project}`;
}

export function loadApprovedSelectionMappings(context = {}) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(context));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveApprovedSelectionMappings(context = {}, mappings = []) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(context), JSON.stringify(mappings));
  window.dispatchEvent(new CustomEvent("gr8:approved-selection-mappings-updated", { detail: { context, count: mappings.length } }));
}

export function approvedMappingsForArea(mappings = [], areaLabel = "") {
  const area = text(areaLabel).toLowerCase();
  return mappings.filter((mapping) => mapping.approvedForSelections !== false && text(mapping.selectionArea).toLowerCase() === area);
}

export function approvedSelectionAreas(mappings = []) {
  return [...new Set(mappings.filter((mapping) => mapping.approvedForSelections !== false).map((mapping) => mapping.selectionArea).filter(Boolean))].sort();
}

export function approvedSelectionItemsForArea(mappings = [], areaLabel = "") {
  return [...new Map(approvedMappingsForArea(mappings, areaLabel).map((mapping) => [
    mapping.selectionItemName,
    {
      key: normaliseHeader(mapping.selectionItemName) || mapping.quoteItemCode,
      label: mapping.selectionItemName,
      category: mapping.selectionCategory,
    },
  ])).values()].sort((a, b) => a.label.localeCompare(b.label));
}
