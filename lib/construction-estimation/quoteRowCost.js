// Canonical Quotation Builder row quantity + cost. Every quotation engine (the Estimate Builder
// workbook, the V4 worksheet) and every downstream total (section, stage, quote, BOQ,
// procurement) goes through these functions - there is no per-section cost logic.
//
//   STANDARD RATE-BASED ROW (EACH, M2, LM, M3, ITEM, QUOTE, BAG, ROLL, ...):   cost = quantity × rate
//
// In the source spreadsheet QUOTE rows are also B×F (qty × rate), so a QUOTE row with a blank
// quantity costs $0 there too. Rows whose cost is NOT qty × rate are marked explicitly by the
// engine that creates them (fee rows, cabinet-maker section total rows, the subcontractor quote
// allocation) - a row is never treated as fixed-price merely because it carries a cost value.
//
// Quantity ownership - the bug this replaces was `manualQty || formulaQty || linkedQty`: a cleared
// or zero quantity is falsy, so the old Takeoff / formula quantity silently came back and the old
// cost stayed on screen while the Qty cell showed blank.
//   * The user owns the quantity (they edited it, or it is a plain manual row):
//       blank / null / undefined -> 0,  "0" -> 0,  never falls back to another quantity.
//   * The quantity is linked (Takeoff / formula driven and not overridden):
//       the formula quantity, else the linked quantity.

export function parseQuoteQuantity(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).replace(/[,$\s]/g, "").trim();
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveQuoteRowQuantity({ userEntered = false, manualQuantity = 0, formulaQuantity = 0, linkedQuantity = 0 } = {}) {
  if (userEntered) return parseQuoteQuantity(manualQuantity);
  const formula = parseQuoteQuantity(formulaQuantity);
  return formula || parseQuoteQuantity(linkedQuantity);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function quoteRowCost({ quantity = 0, rate = 0, inactive = false } = {}) {
  if (inactive) return 0;
  const cost = parseQuoteQuantity(quantity) * parseQuoteQuantity(rate);
  return Number.isFinite(cost) && cost !== 0 ? roundMoney(cost) : 0;
}

// Section / stage / quote totals are the sum of the CURRENT canonical row costs.
export function sumQuoteRowCosts(rows = [], include = () => true) {
  return roundMoney((rows || []).reduce((total, row) => total + (include(row) ? parseQuoteQuantity(row?.cost) : 0), 0));
}
