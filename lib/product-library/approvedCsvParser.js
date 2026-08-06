import Papa from "papaparse";

const HEADER_LABELS = new Set(["CODE", "ITEM", "UNIT", "QTY", "RATE", "TOTAL"]);

export function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isBlankRow(cells) {
  return cells.every((cell) => !normalizeCell(cell));
}

function isSectionHeader(cells) {
  const normalized = cells.map((cell) => normalizeCell(cell).toUpperCase());
  return normalized[0] === "CODE" && normalized.includes("ITEM") && normalized.includes("UNIT");
}

function looksLikeGenuineCode(value) {
  const code = normalizeCell(value);
  if (!code || HEADER_LABELS.has(code.toUpperCase())) return false;
  return /^[A-Z]{1,8}[-_/]?[A-Z0-9]{1,12}([-_/][A-Z0-9]{1,12})*$/i.test(code) && /\d/.test(code);
}

export function stableSelectionCodeForItem(item, reserved = new Set()) {
  if (looksLikeGenuineCode(item.quotationItemCode)) return item.quotationItemCode;
  const section = normalizeCell(item.section).toUpperCase();
  const text = normalizeCell([item.category, item.subcategory, item.description].filter(Boolean).join(" ")).toUpperCase();
  let base = "SEL-GEN-ITEM";
  if (/ENTRY DOOR FURNITURE/.test(section)) base = "SEL-EXT-ENTRY-DOOR-HARDWARE";
  else if (/ENTRY DOORS/.test(section)) base = "SEL-EXT-ENTRY-DOOR";
  else if (/ROOF/.test(section + " " + text) && /COLORBOND|METAL|IRON/.test(text)) base = "SEL-EXT-ROOF-METAL";
  else if (/ROOF/.test(section + " " + text) && /TILE/.test(text)) base = "SEL-EXT-ROOF-TILE";
  else if (/BRICK/.test(section + " " + text) && /PREMIER/.test(text)) base = "SEL-EXT-BRICK-PREMIER";
  else if (/BRICK/.test(section + " " + text) && /PREMIUM/.test(text)) base = "SEL-EXT-BRICK-PREMIUM";
  else if (/BRICK/.test(section + " " + text)) base = "SEL-EXT-BRICK";
  else if (/GARAGE/.test(section + " " + text) && /DOOR/.test(text)) base = "SEL-EXT-GARAGE-DOOR";
  else if (/20MM/.test(text) && /STONE/.test(text) && /PREMIUM/.test(text)) base = "SEL-KIT-BENCH-20-PREMIUM";
  else if (/20MM/.test(text) && /STONE/.test(text)) base = "SEL-KIT-BENCH-20-STANDARD";
  else if (/40MM/.test(text) && /STONE/.test(text) && /PREMIUM/.test(text)) base = "SEL-KIT-BENCH-40-PREMIUM";
  else if (/40MM/.test(text) && /STONE/.test(text)) base = "SEL-KIT-BENCH-40-STANDARD";
  else if (/OVEN/.test(text)) base = "SEL-KIT-OVEN";
  else if (/BASIN MIXER/.test(text)) base = "SEL-BATH-BASIN-MIXER";
  else if (/INTERNAL|HUME/.test(text) && /DOOR/.test(text) && /PREMIUM/.test(text)) base = "SEL-INT-DOOR-PREMIUM";
  else if (/INTERNAL|HUME|DOOR/.test(section + " " + text) && /DOOR/.test(text)) base = "SEL-INT-DOOR-STANDARD";
  else {
    const area = /KITCHEN|APPLIANCE|CABINET|STONE/.test(section + " " + text) ? "KIT"
      : /BATH|PLUMB|TAP|TOILET|BASIN/.test(section + " " + text) ? "BATH"
        : /ROOF|BRICK|CLADDING|ENTRY|GARAGE/.test(section + " " + text) ? "EXT"
          : /FIX OUT|FLOOR|PAINT|DOOR/.test(section + " " + text) ? "INT"
            : "GEN";
    const slug = normalizeCell(item.description || item.subcategory || item.category)
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .split("-")
      .filter(Boolean)
      .slice(0, 5)
      .join("-");
    base = `SEL-${area}-${slug || "ITEM"}`;
  }
  let code = base;
  let suffix = 2;
  while (reserved.has(code)) code = `${base}-${suffix++}`;
  reserved.add(code);
  return code;
}

export function parseApprovedProductLibraryCsv(csvText) {
  const parsed = Papa.parse(csvText, { skipEmptyLines: false });
  const rows = parsed.data;
  let currentSection = "";
  const items = [];
  const ignoredRows = [];

  rows.forEach((row, index) => {
    const cells = Array.isArray(row) ? row : [];
    const sourceRow = index + 1;
    if (isBlankRow(cells)) {
      ignoredRows.push({ sourceRow, reason: "blank" });
      return;
    }
    if (isSectionHeader(cells)) {
      currentSection = normalizeCell(cells[1] || cells[2]);
      ignoredRows.push({ sourceRow, reason: "section_header", section: currentSection, sourceText: cells.join(",") });
      return;
    }
    const [code, category, subcategory, description, unit, quantity, rate, total] = cells.map(normalizeCell);
    if (!description && !unit && !rate && !total) {
      ignoredRows.push({ sourceRow, reason: "group_heading", section: currentSection, sourceText: cells.join(",") });
      return;
    }
    items.push({
      sourceRow,
      section: currentSection || category || subcategory,
      category,
      subcategory,
      description,
      unit,
      quantity,
      rate,
      total,
      quotationItemCode: looksLikeGenuineCode(code) ? code : "",
      sourceText: cells.join(","),
    });
  });

  const reserved = new Set(items.map((item) => item.quotationItemCode).filter(Boolean));
  const withCodes = items.map((item) => ({ ...item, stableQuotationItemCode: stableSelectionCodeForItem(item, reserved) }));
  return { physicalRows: rows.length, items: withCodes, ignoredRows };
}

export function auditApprovedProductLibraryCsv(csvText) {
  const parsed = parseApprovedProductLibraryCsv(csvText);
  const descriptions = new Map();
  parsed.items.forEach((item) => {
    const key = normalizeCell(item.description).toUpperCase();
    if (!key) return;
    descriptions.set(key, [...(descriptions.get(key) || []), item.sourceRow]);
  });
  const duplicateDescriptions = [...descriptions.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([description, rows]) => ({ description, rows }));
  const supplierSpecificPattern = /\b(COLORBOND|HUME|GAINSBOROUGH|CAESARSTONE|SMARTSTONE|PGH|AUSTRAL|MONIER|DULUX|CAROMA|PHOENIX|REECE|SMEG|WESTINGHOUSE|BOSCH|POLYTEC)\b/i;
  const familyPattern = /\b(RANGE|COLOUR|COLOR|STONE TOPS|ROOFING|BRICKS?|DOORS? AS PER PLANS|TAPWARE|FITTINGS|FLOORCOVERINGS)\b/i;
  const sections = [...new Set(parsed.items.map((item) => item.section).filter(Boolean))];
  return {
    ...parsed,
    validItemRows: parsed.items.length,
    sections,
    duplicateDescriptions,
    missingItemCodes: parsed.items.filter((item) => !item.quotationItemCode),
    missingPrices: parsed.items.filter((item) => !item.rate && !item.total),
    rowsRequiringFamilyConversion: parsed.items.filter((item) => familyPattern.test(`${item.category} ${item.subcategory} ${item.description}`)),
    supplierSpecificRows: parsed.items.filter((item) => supplierSpecificPattern.test(`${item.category} ${item.subcategory} ${item.description}`)),
    manualReviewRows: parsed.items.filter((item) => !item.description || !item.unit || supplierSpecificPattern.test(`${item.description}`)),
  };
}
