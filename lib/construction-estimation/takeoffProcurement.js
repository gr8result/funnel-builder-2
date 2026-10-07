import { quotationSectionsForFinalBoq, quoteQuantity, quoteRate, quoteLineTotal } from './finalQuotationBoq.js';

const JAMBS = [
  ['jamb90x19StockLengthsEach', '90 x 19 door jamb — 5.4m stock length'],
  ['jamb110x19StockLengthsEach', '110 x 19 door jamb — 5.4m stock length'],
];

export function withTakeoffJambQuoteRows(quotation = {}, inputRows = {}) {
  const result = { ...quotation };
  for (const [key, item] of JAMBS) {
    if (!(Number(inputRows[key]?.value) > 0)) continue;
    if (Object.values(result).some((section) => (section.rows || []).some((row) => row.quantityKey === key || row.id === `takeoff-${key}`))) continue;
    const sectionName = Object.keys(result).find((name) => /internal.*door|fix.*material/i.test(name)) || 'DOOR JAMB MATERIALS';
    const section = result[sectionName] || { label: sectionName, stageNumber: 5, rows: [] };
    result[sectionName] = { ...section, rows: [...section.rows, {
      id: `takeoff-${key}`, section: sectionName, item, quantityKey: key,
      quantity: '', unit: 'EACH', autoQuantity: true, lineType: 'Quote required', quoteRequired: true,
      excelRate: '', manualRate: '', supplierQuote: '', formulas: {},
      notes: 'Measured door jamb stock. Each unit is one 5.4m length.',
    }] };
  }
  return Object.keys(result).length === Object.keys(quotation).length && Object.keys(result).every((key) => result[key] === quotation[key]) ? quotation : result;
}

const BRICK_KEYS = {
  quoteFaceBricksBaseRange: 'faceBrickOrderEach',
  quoteCommonTwinHeights: 'renderedTwinOrderEach',
  quoteCommonSingleHeights: 'renderedSingleOrderEach',
};

export function takeoffProcurementDetails(row, quantities = {}) {
  const canonicalKey = BRICK_KEYS[row.quantityKey];
  const text = `${row.item || row.itemDescription || ''} ${row.section || row.sectionName || ''}`.toLowerCase();
  const supplierGroup = /cornice|plasterboard|plasterer.*supply/.test(text) || ['corniceLm', 'totalPlasterboardM2', 'plasterboardWallM2'].includes(row.quantityKey)
    ? 'Plasterboard' : '';
  const details = { supplierGroup, canonicalQuantityKey: canonicalKey || row.quantityKey || '' };
  if (canonicalKey && quantities[canonicalKey] !== undefined && !row.quantityManualOverride) {
    details.qty = quantities[canonicalKey];
    details.unit = 'EACH';
    details.rateDivisor = 1000;
  }
  return details;
}

export function assignPlasterboardSupplier(items) {
  const supplier = items.find((item) => !item.removedFromQuote && item.supplierGroup === 'Plasterboard' && item.supplier)?.supplier;
  return items.map((item) => item.supplierGroup === 'Plasterboard' && !item.supplier && supplier ? { ...item, supplier } : item);
}

export function procurementSupplierKey(item) {
  return String(item.supplier || (item.supplierGroup ? `${item.supplierGroup} supplier (unassigned)` : 'Unassigned Supplier')).trim();
}

// Commercial snapshots may be synced before the legacy procurement list has been generated.
// Refresh measured material lines from the final quote, retaining purchasing metadata and IDs.
export function refreshTakeoffProcurementItems(calculated, existingItems = []) {
  const items = new Map(existingItems.map((item) => [item.quoteRowId || item.id, item]));
  const activeQuoteIds = new Set(quotationSectionsForFinalBoq(calculated?.quotation).flatMap(({ rows }) => rows.map((row) => row.id)));
  for (const { sectionKey, rows } of quotationSectionsForFinalBoq(calculated?.quotation)) {
    for (const row of rows) {
      const details = takeoffProcurementDetails(row, calculated.quantities);
      if (!details.supplierGroup && !BRICK_KEYS[row.quantityKey] && !/jamb.*StockLengthsEach|(?:stud|timber|plate|noggin|plasterboard|brick.*sill)/i.test(row.quantityKey || '')) continue;
      const previous = items.get(row.id) || {};
      items.set(row.id, {
        ...previous, id: previous.id || `procurement:${row.id}`, quoteRowId: row.id,
        sectionName: sectionKey, itemDescription: row.item || row.description,
        qty: details.qty ?? quoteQuantity(row), unit: details.unit || row.unit,
        estimatedRate: quoteRate(row) / (details.rateDivisor || 1), estimatedTotal: quoteLineTotal(row),
        canonicalQuantityKey: details.canonicalQuantityKey, supplierGroup: details.supplierGroup,
        supplier: previous.supplier || row.supplier || '',
        procurementCategory: previous.procurementCategory || details.supplierGroup || 'Materials',
        removedFromQuote: false,
      });
    }
  }
  return assignPlasterboardSupplier([...items.values()].map((item) => item.canonicalQuantityKey && item.quoteRowId && !activeQuoteIds.has(item.quoteRowId) ? { ...item, removedFromQuote: true } : item));
}
