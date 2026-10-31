function positiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function hasCommercialLink(row = {}) {
  return Boolean(
    row.productId
    || row.activeProductId
    || row.selectedProductId
    || row.selectionSpecProductId
    || row.requirementKey
    || row.selectionPricePending
    || row.selectedProducts?.length
  );
}

export function isQuotationRateUnresolved(row = {}) {
  const priceStatus = `${row.priceStatus || ""} ${row.rateStatus || ""}`.trim();
  return row.quoteRequired === true
    || row.lineType === "Quote required"
    || String(row.sourceOfRate || "").trim().toLowerCase() === "rate missing"
    || /(?:quote|rate|price).*(?:required|pending|missing|unconfirmed)/i.test(priceStatus)
    || Boolean(row.discontinuedWarning);
}

export function quotationBoqStatus(row = {}) {
  if (row.active === false || row.lineType === "Excluded item") return "excluded";
  return isQuotationRateUnresolved(row) ? "quote_required" : "active";
}

export function quotationRateReviewRows(quotation = {}) {
  return Object.entries(quotation).flatMap(([section, group]) => (group?.rows || [])
    .filter((row) => isQuotationRateUnresolved(row)
      && row.active !== false && (
      positiveNumber(row.qty ?? row.quantity)
      || hasCommercialLink(row)
      ))
    .map((row) => ({ ...row, section })));
}

function normalizedRateType(row = {}) {
  const id = String(row.id || "");
  if (id.startsWith("electrical-schedule:")) return `electrical:${id.split(":").pop()}`;
  if (id.startsWith("tiling:")) return `tiling:${id.split(":").pop()}`;
  if (row.windowScheduleUnpricedRow) return "windows:custom-opening-supplier-quote";
  if (/90\s*x\s*19.*(?:door\s*)?jamb/i.test(row.item || "")) return "doors:jamb-90x19-5.4m";
  if (/cavity\s+(?:sliding\s+door\s+)?cage/i.test(row.item || "")) {
    const size = String(row.item || "").match(/\b(\d{3,4})(?:\s*x\s*(\d{3,4}))?.*?(\d{2,3})\s*mm\s*wall/i);
    return `doors:cavity-cage:${size ? size.slice(1).filter(Boolean).join("x") : id}`;
  }
  return `quotation:${row.section || ""}:${id}`;
}

function rateGroupLabel(key, rows) {
  if (key.startsWith("electrical:")) return `${rows[0]?.item?.replace(/\s+-\s+.+$/, "") || "Electrical point"} builder rate`;
  if (key.startsWith("tiling:")) return `${rows[0]?.item || "Tiling labour"} builder rate`;
  if (key === "windows:custom-opening-supplier-quote") return "Custom fixed-glass window supplier quotation";
  if (key === "doors:jamb-90x19-5.4m") return "90 x 19 mm internal-door jamb supplier or builder rate";
  if (key.startsWith("doors:cavity-cage:")) return rows[0]?.item || "Cavity cage supplier rate";
  return rows[0]?.item || "Quotation rate";
}

export function groupQuotationRateReviewRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = normalizedRateType(row);
    const group = groups.get(key) || { key, rows: [], section: row.section || "", quantity: 0, units: new Set() };
    group.rows.push(row);
    group.quantity += Number(row.qty ?? row.quantity) || 0;
    if (row.unit) group.units.add(String(row.unit));
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    key: group.key,
    label: rateGroupLabel(group.key, group.rows),
    section: group.section,
    quantity: group.quantity,
    unit: group.units.size === 1 ? [...group.units][0] : "mixed",
    rows: group.rows,
    requiresSupplierQuote: group.key.startsWith("windows:") || group.key.startsWith("doors:"),
    requiresBuilderRate: group.key.startsWith("electrical:") || group.key.startsWith("tiling:"),
  }));
}
