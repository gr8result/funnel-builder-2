// Client selection lines whose supplier price is not confirmed (no price, an estimating allowance or a
// "rate required" status) can be applied to the quotation only after the estimator explicitly keeps
// them pending. Applied, they remain PROVISIONAL: each quotation row is marked, and the Quotation page
// keeps a standing notice with their count and value until the price is confirmed. Rates are never
// changed here.

const PENDING_STATUS = /pending|quote required|rate required|unconfirmed/i;
const amount = (value) => {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value) => Math.round(value * 100) / 100;

// The quotation rows behind every price-pending selection decision in a reconciliation plan.
export function pendingPriceRowIds(plan = {}) {
  const pendingKeys = new Set((plan.priceProblems || []).map((problem) => problem.identityKey));
  const entries = (plan.canonicalAudit?.entries || []).filter((entry) => pendingKeys.has(entry.identityKey));
  const rowIds = new Set();
  for (const entry of entries) {
    for (const rowId of entry.quoteRowIds || []) if (rowId) rowIds.add(rowId);
    for (const change of entry.proposedQuotationMutations || []) if (change.rowId) rowIds.add(change.rowId);
  }
  // A changed line with no price at all is pending whoever owns it.
  for (const change of plan.changes || []) if (change.rowId && (change.priceMissing || PENDING_STATUS.test(String(change.rate?.status || "")))) rowIds.add(change.rowId);
  return rowIds;
}

// Marks (and, when the price has since been confirmed, clears) the provisional flag. Idempotent.
export function markSelectionPricePending(quotation = {}, rowIds = new Set(), at = new Date().toISOString()) {
  const ids = rowIds instanceof Set ? rowIds : new Set(rowIds);
  const next = {};
  for (const [section, group] of Object.entries(quotation || {})) {
    let changed = false;
    const rows = (group?.rows || []).map((row) => {
      const pending = ids.has(row.id);
      if (pending && !row.selectionPricePending) { changed = true; return { ...row, selectionPricePending: { since: at, rateAtMark: String(row.manualRate || row.excelRate || ""), reason: "Supplier price not confirmed - provisional until the builder confirms it" } }; }
      if (!pending && row.selectionPricePending) { changed = true; const { selectionPricePending, ...rest } = row; return rest; }
      return row;
    });
    next[section] = changed ? { ...group, rows } : group;
  }
  return next;
}

// Count and value (ex GST, before markup) of the provisional lines, for the Quotation page notice.
export function selectionPricePendingSummary(quotation = {}) {
  const lines = [];
  for (const [section, group] of Object.entries(quotation || {})) {
    for (const row of group?.rows || []) {
      if (!row?.selectionPricePending) continue;
      // The estimator entering a different rate on the line is the price being confirmed.
      const enteredRate = String(row.manualRate || row.excelRate || "");
      if (row.selectionPricePending.rateAtMark !== undefined && enteredRate !== row.selectionPricePending.rateAtMark) continue;
      const quantity = amount(row.qty ?? row.quantity);
      const rate = amount(row.finalRateUsed ?? (row.manualRate || row.excelRate || row.rate));
      // Calculated quotation rows carry their line cost as "cost"; saved rows only qty and rate.
      const total = row.cost != null && row.cost !== "" && Number.isFinite(Number(row.cost)) ? amount(row.cost) : round(quantity * rate);
      lines.push({ section, rowId: row.id, item: String(row.item || row.productName || row.id).trim(), quantity, rate, total: round(total) });
    }
  }
  return { count: lines.length, total: round(lines.reduce((sum, line) => sum + line.total, 0)), unpriced: lines.filter((line) => !line.rate).length, lines };
}
