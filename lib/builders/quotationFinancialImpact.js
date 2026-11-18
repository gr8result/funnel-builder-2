import { calculateEstimateBuilderWorkbook } from "../construction-estimation/estimateBuilderWorkbookCalculations.js";
import { quoteLineTotal, quoteQuantity, quoteRate } from "../construction-estimation/finalQuotationBoq.js";
import { snapshotJob } from "../construction-estimation/jobSerialization.js";
import { preserveQuotationStructure } from "../construction-estimation/quotationStructure.js";

export function selectionReconciliationFinancialImpact(beforeWorkbook, afterWorkbook) {
  const normalized = (workbook) => {
    // The proposal document is never priced. Share immutable strings while isolating mutable calculation data.
    const priced = snapshotJob(withoutProposalDocument(workbook));
    return { ...priced, quotation: preserveQuotationStructure(priced.quotation || {}) };
  };
  const beforeCalculation = calculateEstimateBuilderWorkbook(normalized(beforeWorkbook));
  const afterCalculation = calculateEstimateBuilderWorkbook(normalized(afterWorkbook));
  const before = beforeCalculation.summary.finalQuoteTotal;
  const after = afterCalculation.summary.finalQuoteTotal;
  const delta = Math.round((after - before + Number.EPSILON) * 100) / 100;
  // Rows are compared by their stable id ACROSS sections: moving a row to another section (trade
  // consolidation, generated subheadings) is not a financial change when its quantity, rate and total
  // are unchanged. An id repeated within one side (e.g. appliance package options under several brand
  // sections) is matched by id + item text + occurrence order - never by section, which made a moved
  // row look removed and re-added.
  const entries = (calculation) => Object.entries(calculation.quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => (
    { section, row, quantity: quoteQuantity(row), rate: quoteRate(row), total: quoteLineTotal(row) }
  )));
  const beforeEntries = entries(beforeCalculation);
  const afterEntries = entries(afterCalculation);
  const idCounts = (list) => list.reduce((counts, entry) => counts.set(entry.row.id, (counts.get(entry.row.id) || 0) + 1), new Map());
  const beforeIds = idCounts(beforeEntries);
  const afterIds = idCounts(afterEntries);
  const keyed = (list) => {
    const seen = new Map();
    return list.map((entry) => {
      const id = entry.row.id;
      if (id && (beforeIds.get(id) || 0) <= 1 && (afterIds.get(id) || 0) <= 1) return [`id\u0000${id}`, entry];
      const base = `${id}\u0000${String(entry.row.item || entry.row.description || "").trim().toLowerCase()}`;
      const occurrence = seen.get(base) || 0;
      seen.set(base, occurrence + 1);
      return [`${base}\u0000${occurrence}`, entry];
    });
  };
  const beforeRows = new Map(keyed(beforeEntries));
  const afterRows = new Map(keyed(afterEntries));
  // A row still unmatched on one side pairs with an unmatched row on the other side that is the same
  // row - same id, or the consolidation's renamed copy (legacyRowId, and legacySectionName when
  // recorded) - with the same quantity, rate and total: unchanged.
  const sameRow = (other, entry) => other.row.id === entry.row.id
    || (other.row.legacyRowId === entry.row.id && (!other.row.legacySectionName || other.row.legacySectionName === entry.section));
  const unmatchedAfter = [...afterRows.entries()].filter(([key]) => !beforeRows.has(key));
  for (const [beforeKey, entry] of [...beforeRows.entries()].filter(([key]) => !afterRows.has(key))) {
    const index = unmatchedAfter.findIndex(([, other]) => sameRow(other, entry)
      && other.quantity === entry.quantity && other.rate === entry.rate && other.total === entry.total);
    if (index < 0) continue;
    const [afterKey, other] = unmatchedAfter.splice(index, 1)[0];
    afterRows.delete(afterKey);
    afterRows.set(beforeKey, other);
  }
  const rowChanges = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].flatMap((key) => {
    const beforeRow = beforeRows.get(key);
    const afterRow = afterRows.get(key);
    const prior = beforeRow ? [beforeRow.quantity, beforeRow.rate, beforeRow.row.active, beforeRow.row.included, beforeRow.row.quoteRequired, beforeRow.row.lineType, beforeRow.row.productId, beforeRow.row.activeProductId, beforeRow.row.selectedProductId, beforeRow.row.selectionSpecProductId] : null;
    const next = afterRow ? [afterRow.quantity, afterRow.rate, afterRow.row.active, afterRow.row.included, afterRow.row.quoteRequired, afterRow.row.lineType, afterRow.row.productId, afterRow.row.activeProductId, afterRow.row.selectedProductId, afterRow.row.selectionSpecProductId] : null;
    if (JSON.stringify(prior) === JSON.stringify(next) && (beforeRow?.total || 0) === (afterRow?.total || 0)) return [];
    // A row with no quantity, rate or total on either side (a generated subheading) charges nothing
    // before or after: not a financial change. A rate change is always shown, even at quantity 0.
    if ([beforeRow?.quantity, afterRow?.quantity, beforeRow?.rate, afterRow?.rate, beforeRow?.total, afterRow?.total].every((value) => !Number(value))) return [];
    const record = afterRow || beforeRow;
    return [{
      section: record.section,
      rowId: record.row.id,
      item: record.row.item || record.row.description || record.row.id,
      before: beforeRow ? { quantity: beforeRow.quantity, rate: beforeRow.rate, total: beforeRow.total } : { quantity: 0, rate: 0, total: 0 },
      after: afterRow ? { quantity: afterRow.quantity, rate: afterRow.rate, total: afterRow.total } : { quantity: 0, rate: 0, total: 0 },
      delta: Math.round(((afterRow?.total || 0) - (beforeRow?.total || 0) + Number.EPSILON) * 100) / 100,
    }];
  }).sort((left, right) => `${left.section}:${left.rowId}`.localeCompare(`${right.section}:${right.rowId}`));
  const signature = JSON.stringify(rowChanges.map((change) => [change.section, change.rowId, change.before, change.after, change.delta]));
  return { before, after, delta, rowChanges, changedLineCount: rowChanges.length, signature, requiresApproval: delta !== 0 || rowChanges.length > 0 };
}

function withoutProposalDocument(workbook = {}) {
  const { projectEstimateBuilder: _projectEstimateBuilder, ...priced } = workbook || {};
  return priced;
}
