export const SELECTION_STATUSES = Object.freeze(['INCLUDED', 'AWAITING_SELECTION', 'SELECTED', 'CLIENT_SUPPLIED', 'NOT_REQUIRED', 'UPGRADE', 'DOWNGRADE']);
const priority = { INCLUSION_SCHEDULE: 1, CLIENT_SELECTION: 2, MANUAL_OVERRIDE: 3 };
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
const amount = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function selectionVariation(row, quantity = row.qty ?? row.quantity) {
  const baseline = amount(row.baselineUnitPrice), active = amount(row.activeUnitPrice), qty = amount(quantity);
  const difference = baseline === null || active === null ? null : money(active - baseline);
  return { variationUnitDifference: difference, variationTotal: difference === null || qty === null ? null : money(difference * qty) };
}

// This function owns product fields only. Quantity, formulas, row IDs, order and baseline snapshots survive.
export function applySelectionProduct(record, event) {
  const source = event.source || 'CLIENT_SELECTION';
  if (!priority[source]) throw Error('Unknown selection source.');
  if (event.status && !SELECTION_STATUSES.includes(event.status)) throw Error('Unknown selection status.');
  const supplied = ['CLIENT_SUPPLIED', 'NOT_REQUIRED'].includes(event.status);
  const price = supplied ? 0 : amount(event.unitPrice);
  if (price !== null && price < 0) throw Error('Product unit price cannot be negative.');
  const next = { ...record };
  if (source === 'INCLUSION_SCHEDULE' && !record.selectionBaselineApplied) {
    if (next.baselineProductId == null) next.baselineProductId = event.productId || null;
    if (next.baselineUnitPrice == null) next.baselineUnitPrice = price;
    if (next.baselineProductName == null) next.baselineProductName = event.productName || event.productId || null;
    next.selectionBaselineApplied = true;
  }
  if ((priority[record.selectionSource] || (record.manualRate !== undefined && record.manualRate !== '' && record.manualRate !== null ? 3 : 0)) > priority[source]) {
    if (!next.selectionSource) { next.selectionSource = 'MANUAL_OVERRIDE'; next.activeUnitPrice = amount(record.manualRate); next.activeProductId = record.productId || null; }
    Object.assign(next, selectionVariation(next));
    if (!['CLIENT_SUPPLIED', 'NOT_REQUIRED'].includes(next.selectionStatus)) next.selectionStatus = !next.activeProductId ? 'AWAITING_SELECTION' : next.variationUnitDifference > 0 ? 'UPGRADE' : next.variationUnitDifference < 0 ? 'DOWNGRADE' : 'SELECTED';
    return next;
  }
  next.activeProductId = supplied ? null : (source === 'INCLUSION_SCHEDULE' ? next.baselineProductId : event.productId || null);
  next.activeProductName = supplied ? event.status : (source === 'INCLUSION_SCHEDULE' ? next.baselineProductName : event.productName || event.productId || null);
  next.activeUnitPrice = source === 'INCLUSION_SCHEDULE' ? next.baselineUnitPrice : price;
  if (source === 'CLIENT_SELECTION') next.selectedProductId = event.productId || null;
  next.selectionSource = source;
  Object.assign(next, selectionVariation(next));
  next.selectionStatus = supplied ? event.status : !next.activeProductId ? 'AWAITING_SELECTION'
    : source === 'INCLUSION_SCHEDULE' ? 'INCLUDED' : next.variationUnitDifference > 0 ? 'UPGRADE' : next.variationUnitDifference < 0 ? 'DOWNGRADE' : 'SELECTED';
  // Existing quote calculation consumes this explicit price; never substitute an old catalogue price for an unpriced selection.
  next.selectionPricePending = next.activeUnitPrice === null;
  return next;
}
