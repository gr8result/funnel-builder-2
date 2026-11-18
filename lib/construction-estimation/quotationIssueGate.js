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

// A made-to-measure selection (shower screen, mirror) saved before 11 Nov 2026 carries its allowance
// as a "supplier quote" with no quote reference. That is a placeholder, not a supplier price: the
// owner's decision (12 Nov 2026) is that these stay Supplier Quote Required until a real quote exists.
export function isAllowancePlaceholderQuote(row = {}) {
  if (!row.configuration?.madeToMeasure || builderEnteredPrice(row)) return false;
  if (!/supplier quote/i.test(String(row.priceStatus || "")) || String(row.quoteReference || "").trim()) return false;
  const allowance = Number(String(row.allowancePerUnit ?? "").replace(/[$,\s]/g, ""));
  const rate = Number(String(row.excelRate ?? "").replace(/[$,\s]/g, ""));
  if (!(allowance > 0) || !(rate > 0)) return false;
  return Math.abs(rate - allowance) < 0.01 || Math.abs(rate * 1.1 - allowance) < 0.01;
}

export function quotationRowMissingPrice(row = {}) {
  if (builderEnteredPrice(row) && quoteLineTotal(row) > 0) return "";
  if (isAllowancePlaceholderQuote(row)) return "Supplier Quote Required (allowance placeholder, no supplier quote reference)";
  if (row.quoteRequired === true) return "quote required";
  // A line generated as "Quote required" (e.g. a cavity cage for a non-standard wall) carrying only a
  // substitute catalogue price or an allowance is not a supplier price: the customer PDF already blocks
  // it (quotationRateReview.js); issue now does too (owner rule 16 Nov 2026).
  if (row.lineType === "Quote required") return "supplier quote required";
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

// Owner rule (16 Nov 2026): a quotation is not issued while a selected product is unpriced. The
// product-selection audit (productSelectionIntegrity.js, the same audit the customer PDF uses) marks a
// selected product BLOCKED_MISSING_PRICE when it has no confirmed price ($0 / blank / quote required).
// Products included in a package, excluded or not selected are not in that state and never block.
// Priced products still awaiting builder approval are a customer-PDF check, not a pricing one.
// A builder can mark an optional item "not required" with an auditable reason in Commercial Issue
// Review (commercialIssueResolution.js, issue id "selection:<audit key>"); that item no longer blocks.
const notRequired = (resolutions, key) => (Array.isArray(resolutions) ? resolutions : []).some((entry) =>
  entry?.issueId === `selection:${key}` && entry.type === "NOT_REQUIRED" && entry.status === "APPLIED");

export function selectionPriceBlockers(selectionAudit = null, { resolutions = [] } = {}) {
  const entries = Array.isArray(selectionAudit?.entries) ? selectionAudit.entries : [];
  const seen = new Set();
  return entries
    .filter((entry) => entry?.outcome === "BLOCKED_MISSING_PRICE")
    .filter((entry) => !notRequired(resolutions, entry.key))
    .filter((entry) => { const key = entry.key || `${entry.requirementKey}|${entry.productId}|${entry.location}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map((entry) => ({
      sectionKey: entry.section || "CLIENT SELECTIONS",
      section: entry.section || "Client Selections",
      rowId: (entry.quoteRowIds || [])[0] || "",
      item: String(entry.productName || entry.productId || entry.requirementKey || "Selected product").trim(),
      location: String(entry.location || "").trim(),
      reason: "selected product has no confirmed price",
      selection: true,
    }));
}

// Cabinetry measurements the builder still has to enter (benchtop lengths, bulkhead runs) leave those
// lines without a quantity, so the quotation is not complete (cabinetryRequirements.js
// cabinetryQuotationBriefs; requested by Client Selections 16 Nov 2026). Client selection is not blocked.
export function cabinetryMeasurementBlockers(cabinetryBriefs = []) {
  return (Array.isArray(cabinetryBriefs) ? cabinetryBriefs : [])
    .filter((brief) => Number(brief?.outstanding) > 0)
    .flatMap((brief) => (brief.measurements || []).filter((m) => m?.status === "required").map((m) => ({
      sectionKey: "CABINETRY",
      section: `${brief.room || "Cabinetry"} cabinetry`,
      rowId: m.requirementId || "",
      item: String(m.label || "Measurement").trim(),
      location: String(brief.room || "").trim(),
      reason: "builder measurement required (LM)",
      cabinetry: true,
    })));
}

export function quotationIssueCheck(quotation = {}, { selectionAudit = null, resolutions = [], cabinetryBriefs = [] } = {}) {
  const rowBlockers = quotationIssueBlockers(quotation);
  const productBlockers = selectionPriceBlockers(selectionAudit, { resolutions });
  const cabinetryBlockers = cabinetryMeasurementBlockers(cabinetryBriefs);
  const blockers = [...rowBlockers, ...productBlockers, ...cabinetryBlockers];
  const cabinetryRooms = [...new Set(cabinetryBlockers.map((b) => b.location))];
  const parts = [
    rowBlockers.length ? `${rowBlockers.length} charged row${rowBlockers.length === 1 ? "" : "s"} without a confirmed price or charged twice` : "",
    productBlockers.length ? `${productBlockers.length} selected product${productBlockers.length === 1 ? "" : "s"} without a confirmed price` : "",
    cabinetryBlockers.length ? `outstanding cabinetry measurements: ${cabinetryRooms.map((room) => `${room} (${cabinetryBlockers.filter((b) => b.location === room).map((b) => b.item).join(", ")})`).join("; ")}` : "",
  ].filter(Boolean);
  return {
    ok: blockers.length === 0,
    blockers,
    message: blockers.length
      ? `This quotation cannot be issued: ${parts.join(" and ")} (${blockers.slice(0, 5).map((b) => b.item).join("; ")}${blockers.length > 5 ? "; ..." : ""}). Enter the prices, remove duplicates, or mark items not required / excluded, then try again.`
      : "",
  };
}
