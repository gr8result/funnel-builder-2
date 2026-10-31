import { calculateEstimateBuilderWorkbook } from "../construction-estimation/estimateBuilderWorkbookCalculations.js";
import { quoteLineTotal, quoteQuantity, quoteRate } from "../construction-estimation/finalQuotationBoq.js";
import { normalizeQuotationStructure } from "../construction-estimation/quotationStructure.js";

export function selectionReconciliationFinancialImpact(beforeWorkbook, afterWorkbook) {
  const normalized = (workbook) => ({
    ...structuredClone(workbook),
    quotation: normalizeQuotationStructure(structuredClone(workbook?.quotation || {}), { migrateDerivedRows: false }),
  });
  const beforeCalculation = calculateEstimateBuilderWorkbook(normalized(beforeWorkbook));
  const afterCalculation = calculateEstimateBuilderWorkbook(normalized(afterWorkbook));
  const before = beforeCalculation.summary.finalQuoteTotal;
  const after = afterCalculation.summary.finalQuoteTotal;
  const delta = Math.round((after - before + Number.EPSILON) * 100) / 100;
  const rows = (calculation) => Object.entries(calculation.quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row) => [
    `${section}\u0000${row.id}`,
    { section, row, quantity: quoteQuantity(row), rate: quoteRate(row), total: quoteLineTotal(row) },
  ]));
  const beforeRows = new Map(rows(beforeCalculation));
  const afterRows = new Map(rows(afterCalculation));
  const rowChanges = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].flatMap((key) => {
    const beforeRow = beforeRows.get(key);
    const afterRow = afterRows.get(key);
    const prior = beforeRow ? [beforeRow.quantity, beforeRow.rate, beforeRow.row.active, beforeRow.row.included, beforeRow.row.quoteRequired, beforeRow.row.lineType, beforeRow.row.productId, beforeRow.row.activeProductId, beforeRow.row.selectedProductId, beforeRow.row.selectionSpecProductId] : null;
    const next = afterRow ? [afterRow.quantity, afterRow.rate, afterRow.row.active, afterRow.row.included, afterRow.row.quoteRequired, afterRow.row.lineType, afterRow.row.productId, afterRow.row.activeProductId, afterRow.row.selectedProductId, afterRow.row.selectionSpecProductId] : null;
    if (JSON.stringify(prior) === JSON.stringify(next) && (beforeRow?.total || 0) === (afterRow?.total || 0)) return [];
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
  return { before, after, delta, rowChanges, signature, requiresApproval: delta !== 0 || rowChanges.length > 0 };
}