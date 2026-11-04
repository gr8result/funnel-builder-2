// Quotation V1 issue gate.
// A quotation that still has rows without a confirmed price must not become a commercial
// snapshot (the snapshot supersedes the previous one and sets the contract total that
// Quote Approvals and the Client Portal use). Only rows that are actually charged in the
// final quotation are checked, using the same inclusion rule as the final BOQ.
import { quoteLineTotal, quoteQuantity, shouldIncludeQuoteRowInFinalBoq } from "./finalQuotationBoq.js";

const MISSING_PRICE_STATUS = /quote required|price pending|supplier quote required|awaiting (supplier )?price/i;
// A $0 charged row is only acceptable when it is explicitly a no-charge item.
const NO_CHARGE_STATUS = /included|no charge|nil|allowance only|standard inclusion/i;
const explicitlyNoCharge = (row) => row.noCharge === true || row.includedAtNoCost === true || NO_CHARGE_STATUS.test(String(row.priceStatus || ""));

const positive = (value) => Number(String(value ?? "").replace(/[$,\s]/g, "")) > 0;
// A price the builder entered by hand (manual rate or supplier quote) resolves a quote-required row,
// but only once it has actually priced the row. Some rows are recalculated from other inputs (window
// schedule, takeoff) and ignore a typed rate; those still total $0 and must keep blocking.
const builderEnteredPrice = (row) => positive(row.manualRate) || positive(row.supplierQuote) || positive(row.quotedSupplierRate);

export function quotationRowMissingPrice(row = {}) {
  if (builderEnteredPrice(row) && quoteLineTotal(row) > 0) return "";
  if (row.quoteRequired === true) return "quote required";
  if (String(row.sourceOfRate || "").trim().toLowerCase() === "rate missing") return "rate missing";
  if (MISSING_PRICE_STATUS.test(String(row.priceStatus || ""))) return String(row.priceStatus).trim();
  if (quoteQuantity(row) > 0 && quoteLineTotal(row) === 0 && !explicitlyNoCharge(row)) return "no price ($0 for a charged quantity)";
  return "";
}

// Only charged rows count. Catalogue rows listed without a quantity (e.g. the door library)
// are not part of the price, so they never block.
// An exact clone (same id, item, quantity and rate in one section) is the same charge twice,
// e.g. a floor waste appended twice by the selections editor. Rows that only share an id but
// describe different items are a separate, known id-collision issue and are not flagged here.
const cloneKey = (row) => [row.id || row.rowId || "", String(row.item || row.description || "").trim().toLowerCase(), quoteQuantity(row), quoteLineTotal(row)].join("|");

export function quotationIssueBlockers(quotation = {}) {
  const sections = Object.entries(quotation && typeof quotation === "object" ? quotation : {});
  return sections.flatMap(([sectionKey, section]) => {
    const seen = new Set();
    return (Array.isArray(section?.rows) ? section.rows : [])
    .filter(shouldIncludeQuoteRowInFinalBoq)
    .map((row) => {
      const key = cloneKey(row);
      const duplicate = Boolean(row.id || row.rowId) && seen.has(key);
      seen.add(key);
      return { row, reason: duplicate ? "duplicate charge (identical row already in this section)" : quotationRowMissingPrice(row) };
    })
    .filter((entry) => entry.reason)
    .map(({ row, reason }) => ({
      sectionKey,
      section: section?.title || section?.label || sectionKey,
      rowId: row.id || row.rowId || "",
      item: String(row.item || row.description || "Unnamed row").trim(),
      location: String(row.location || "").trim(),
      reason,
    }));
  });
}

export function quotationIssueCheck(quotation = {}) {
  const blockers = quotationIssueBlockers(quotation);
  return {
    ok: blockers.length === 0,
    blockers,
    message: blockers.length
      ? `This quotation cannot be issued: ${blockers.length} charged row${blockers.length === 1 ? " needs" : "s need"} attention - no confirmed price or a duplicate charge (${blockers.slice(0, 5).map((b) => b.item).join("; ")}${blockers.length > 5 ? "; ..." : ""}). Enter the prices, remove duplicates or exclude the rows, then try again.`
      : "",
  };
}
