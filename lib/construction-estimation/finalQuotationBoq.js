export function quotationSectionsForFinalBoq(quotation = {}) {
  return Object.entries(plainObject(quotation))
    .map(([sectionKey, section]) => ({
      sectionKey,
      section,
      rows: (Array.isArray(section?.rows) ? section.rows : []).filter(shouldIncludeQuoteRowInFinalBoq),
    }))
    .filter((entry) => entry.rows.length > 0);
}

export function shouldIncludeQuoteRowInFinalBoq(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (row.applianceHeading === true || row.lineType === "Appliance heading") return false;
  if (quoteFeeType(row)) return false;
  if (isHiddenQuoteRow(row)) return false;
  if (isExcludedQuoteRow(row)) return false;
  if (isUnselectedAlternativeQuoteRow(row)) return false;
  if (isTemplateOnlyQuoteRow(row)) return false;

  const quantity = quoteQuantity(row);
  const total = quoteLineTotal(row);
  const hasQuantity = quantity > 0;
  const hasTotal = total > 0;
  const hasNoQuantityField = !hasAnyValue(row.qty, row.quantity, row.importedQuantity, row.values?.[1]);
  const explicitUse = row.included === true
    || row.used === true
    || row.useInQuote === true
    || row.active === true
    || row.quoteRequired === true
    || Boolean(text(row.supplierQuote))
    || Boolean(text(row.quotedSupplierRate));
  const manualRow = isManualQuoteRow(row);

  if (hasQuantity || hasTotal) return true;
  if ((explicitUse || manualRow) && hasNoQuantityField && quoteRate(row) > 0) return true;
  return false;
}

export function quoteQuantity(row = {}) {
  return numberFromInput(row.qty ?? row.quantity ?? row.importedQuantity ?? row.values?.[1]);
}

export function quoteRate(row = {}) {
  return numberFromInput(row.finalRateUsed ?? row.manualRate ?? row.supplierQuote ?? row.quotedSupplierRate ?? row.supplierCatalogueRate ?? row.excelRate ?? row.values?.[5]);
}

export function quoteLineTotal(row = {}) {
  const direct = numberFromInput(row.cost ?? row.importedCost ?? row.total ?? row.values?.[6]);
  if (direct > 0) return direct;
  return quoteQuantity(row) * quoteRate(row);
}

export function isFinalBoqExcludedText(row = {}) {
  const value = `${row.item || ""} ${row.description || ""} ${row.lineType || ""} ${row.rawText || ""}`.toLowerCase();
  return value.includes("subtotal")
    || value.includes("total ")
    || value.includes("margin")
    || value.includes("gst")
    || value.includes("profit")
    || value.includes("overhead")
    || value.includes("sales commission")
    || value.includes("qbcc")
    || value.includes("qbsa")
    || value.includes("q leave");
}

function isExcludedQuoteRow(row = {}) {
  const activeText = text(row.active).toLowerCase();
  return row.active === false
    || row.included === false
    || row.used === false
    || row.useInQuote === false
    || ["false", "no", "n", "0", "inactive", "excluded"].includes(activeText)
    || String(row.lineType || "").toLowerCase() === "excluded item"
    || String(row.status || "").toLowerCase() === "excluded";
}

function isHiddenQuoteRow(row = {}) {
  return row.hiddenQuoteRow === true
    || row.hidden === true
    || row.catalogueHidden === true
    || row.catalogHidden === true
    || String(row.inactiveReason || "").trim();
}

function isUnselectedAlternativeQuoteRow(row = {}) {
  const textValue = `${row.status || ""} ${row.selectionStatus || ""} ${row.optionStatus || ""} ${row.lineType || ""}`.toLowerCase();
  return row.selected === false
    || row.optionSelected === false
    || textValue.includes("unselected")
    || textValue.includes("alternative not chosen")
    || textValue.includes("not chosen");
}

function isTemplateOnlyQuoteRow(row = {}) {
  const lineType = String(row.lineType || "").toLowerCase();
  const status = String(row.status || "").toLowerCase();
  return row.templateOnly === true
    || row.placeholder === true
    || lineType.includes("template")
    || status === "template";
}

function isManualQuoteRow(row = {}) {
  const id = String(row.id || "").toLowerCase();
  const source = String(row.sourceOfRate || row.source || row.lineType || "").toLowerCase();
  return id.includes("-custom-")
    || id.includes("-copy-")
    || source.includes("manual")
    || source.includes("client csv");
}

function quoteFeeType(row = {}) {
  return Boolean(row.feeType) || isFinalBoqExcludedText(row);
}

function hasAnyValue(...values) {
  return values.some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function numberFromInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}
