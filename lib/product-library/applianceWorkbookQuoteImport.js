const REQUIRED_BRANDS = ["ARISTON", "BLANCO", "EUROMAID", "OMEGA", "SMEG", "WESTINGHOUSE"];
const ACCEPTED_BASELINE_EXCLUSIONS = [
  {
    pattern: /\bOMEGA\b.*\bOCG95FFX\b/i,
    reason: "workbook-only product not present in accepted 83-product Checkpoint A baseline",
  },
  {
    pattern: /\bBLANCO PACK\b.*\b600MM GAS COOKTOP PACK\b/i,
    reason: "workbook-only package not present in accepted 35-package Checkpoint A baseline",
  },
  {
    sourceRowIds: new Set(["121", "122"]),
    pattern: /\bOMEGA\b/i,
    reason: "workbook-only duplicate component relationship not present in accepted 159-relationship Checkpoint A baseline",
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function brandFromText(value = "") {
  const text = clean(value).toUpperCase();
  return REQUIRED_BRANDS.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(text)) || "";
}

export function workbookQuoteImportRowsToLegacyRows(rows = []) {
  const legacyRows = [];
  let currentBrand = "";
  const blocks = [];
  let currentBlock = null;

  rows.forEach((row, index) => {
    const category = clean(row[0]);
    const item = clean(row[1]);
    const unit = clean(row[3]).toUpperCase();
    const rate = Number(row[4] || 0);
    const source = clean(row[6]) || "workbook";
    const notes = clean(row[7]);
    const detectedBrand = brandFromText(item) || brandFromText(category);
    const sourceRowId = String(index + 9);

    if (detectedBrand) currentBrand = detectedBrand;
    if (!["EACH", "PACK"].includes(unit) || !item || !Number.isFinite(rate) || rate <= 0) {
      if (category || item) {
        currentBlock = { heading: category || item, rows: [] };
        blocks.push(currentBlock);
      }
      return;
    }
    if (baselineExclusionForItem(item, sourceRowId)) return;

    const brand = detectedBrand || currentBrand;
    if (!brand) return;

    const legacyDescription = [category, item, unit, String(rate), source, notes].filter(Boolean).join(" | ");
    const legacyRow = [
      sourceRowId,
      brand,
      brand,
      "",
      "",
      item,
      legacyDescription,
      unit,
      "",
      String(rate),
      String(rate),
      "",
      "",
      brand,
      "",
      "TRUE",
      "appliance",
      "TRUE",
      notes,
    ];
    if (!currentBlock) {
      currentBlock = { heading: "", rows: [] };
      blocks.push(currentBlock);
    }
    currentBlock.rows.push({ unit, legacyRow });
  });

  blocks.forEach((block) => {
    const packIndexes = block.rows.map((row, index) => row.unit === "PACK" ? index : -1).filter((index) => index >= 0);
    if (packIndexes.length === 1) {
      const packIndex = packIndexes[0];
      const beforePack = block.rows.slice(0, packIndex);
      const afterPack = block.rows.slice(packIndex + 1);
      if (packIndex === block.rows.length - 1 && beforePack.length) {
        legacyRows.push(block.rows[packIndex].legacyRow, ...beforePack.map((row) => row.legacyRow));
      } else {
        legacyRows.push(...beforePack.map((row) => row.legacyRow), block.rows[packIndex].legacyRow, ...afterPack.map((row) => row.legacyRow));
      }
    } else {
      legacyRows.push(...block.rows.map((row) => row.legacyRow));
    }
  });

  return legacyRows;
}

export function workbookQuoteImportRowsToLegacyCsv(rows = []) {
  return workbookQuoteImportRowsToLegacyRows(rows).map((row) => row.map(csvCell).join(",")).join("\n");
}

export function workbookQuoteImportSummary(rows = []) {
  const legacyRows = workbookQuoteImportRowsToLegacyRows(rows);
  const sourceRows = Array.isArray(rows) ? rows : [];
  const categoryCounts = {};
  const unitCounts = {};
  const brandCounts = {};
  let pricedRows = 0;
  let headingRows = 0;
  let ignoredRows = 0;
  const excludedRows = [];

  let currentBrand = "";
  sourceRows.forEach((row) => {
    const category = clean(row[0]);
    const item = clean(row[1]);
    const unit = clean(row[3]).toUpperCase();
    const rate = Number(row[4] || 0);
    const detectedBrand = brandFromText(item) || brandFromText(category);
    if (detectedBrand) currentBrand = detectedBrand;
    if (category) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (unit) unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    const brand = detectedBrand || currentBrand;
    if (brand) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    if (["EACH", "PACK"].includes(unit) && item && Number.isFinite(rate) && rate > 0) {
      const exclusion = baselineExclusionForItem(item, String(sourceRows.indexOf(row) + 9));
      if (exclusion) {
        excludedRows.push({
          source_row_id: String(sourceRows.indexOf(row) + 9),
          item,
          unit,
          rate,
          reason: exclusion.reason,
        });
      } else {
        pricedRows += 1;
      }
    } else if (category || item) {
      headingRows += 1;
    } else {
      ignoredRows += 1;
    }
  });

  return {
    sheetRows: sourceRows.length,
    transformedLegacyRows: legacyRows.length,
    pricedRows,
    headingRows,
    ignoredRows,
    excludedRows,
    categoryCounts,
    unitCounts,
    brandCounts,
  };
}

function baselineExclusionForItem(item, sourceRowId = "") {
  return ACCEPTED_BASELINE_EXCLUSIONS.find((exclusion) => (
    exclusion.pattern.test(item) && (!exclusion.sourceRowIds || exclusion.sourceRowIds.has(sourceRowId))
  )) || null;
}
