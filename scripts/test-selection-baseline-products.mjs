import assert from 'node:assert/strict';
import { resolveInclusionBaselineItems } from '../lib/builders/selectionBaselineProducts.js';
import { applyInclusionScheduleToQuote } from '../lib/builders/selectionQuoteEngine.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { masterProductToClientSelectionProduct } from '../lib/product-library/catalogueModel.js';

const workspaceId = 'builder-a';
const privateProducts = [
  { id: 'private-cooktop', workspace_id: workspaceId, product_name: 'Builder Cooktop', upgrade_cost: 990, active: true, metadata: { productEntity: { gstIncluded: true, priceStatus: 'current' } } },
  { id: 'foreign-oven', workspace_id: 'builder-b', product_name: 'Foreign Oven', upgrade_cost: 500, active: true },
];
const catalogueProducts = [
  { productId: 'master-oven', productName: 'Master Oven', clientPrice: 1100, gstIncluded: true, priceStatus: 'current' },
  { productId: 'master-dishwasher', productName: 'Price Pending Dishwasher', clientPrice: null, priceStatus: 'quote_required' },
  { productId: 'master-mirror', productName: 'Basis Unknown Mirror', clientPrice: 300, gstIncluded: null, priceStatus: 'current' },
];
const items = resolveInclusionBaselineItems([
  { id: 'baseline-oven', workspace_id: workspaceId, selection_slot_id: 'oven', default_catalogue_product_id: 'master-oven', allowance: null },
  { id: 'baseline-cooktop', workspace_id: workspaceId, selection_slot_id: 'cooktop', default_product_id: 'private-cooktop', allowance: { unitPrice: 700 } },
  { id: 'baseline-dishwasher', workspace_id: workspaceId, selection_slot_id: 'dishwasher', default_catalogue_product_id: 'master-dishwasher', allowance: null },
  { id: 'baseline-mirror', workspace_id: workspaceId, selection_slot_id: 'mirror', default_catalogue_product_id: 'master-mirror', allowance: null },
], { workspaceId, privateProducts, catalogueProducts });
assert.deepEqual(items.map(item => [item.baselineProductName, item.baselineUnitPrice, item.baselineProductSource]), [
  ['Master Oven', 1000, 'PRODUCT_LIBRARY'],
  ['Builder Cooktop', 700, 'INCLUSION_ALLOWANCE'],
  ['Price Pending Dishwasher', null, 'PRODUCT_LIBRARY'],
  ['Basis Unknown Mirror', null, 'PRODUCT_LIBRARY'],
]);
assert.equal(items[0].baselinePriceIncludesGst, true);
assert.equal(items[1].baselinePriceIncludesGst, null, 'an explicit allowance retains its stored basis and is not silently converted');
assert.equal(items[3].baselinePriceIncludesGst, null, 'a product price with unknown GST basis is not applied as if it were ex GST');
assert.equal(resolveInclusionBaselineItems([{ selection_slot_id: 'oven', allowance: { amount: 1100, gstIncluded: true } }], { workspaceId })[0].baselineUnitPrice, 1000);
assert.equal(resolveInclusionBaselineItems([{ default_product_id: 'foreign-oven' }], { workspaceId, privateProducts })[0].baselineProductSource, 'UNRESOLVED', 'foreign-workspace product IDs do not resolve as baselines');
const option = masterProductToClientSelectionProduct(catalogueProducts[0], { organisationId: workspaceId, requirement: { requirementKey: 'oven' } });
assert.equal(option.priceIncludesGst, true, 'Product Library option carries GST basis into Client Selections');

const quotation = {
  'APPLIANCES & WHITE GOODS': { id: 'appliances', rows: [
    { id: 'oven-row', selectionSlotId: 'oven', item: 'OVEN ALLOWANCE', quantity: '2', quantityKey: '', manualRate: '', excelRate: 850, formulas: { custom: 'keep' }, sortOrder: 1 },
    { id: 'cooktop-row', selectionSlotId: 'cooktop', item: 'COOKTOP ALLOWANCE', quantity: '1', manualRate: '$900', excelRate: 800, formulas: { B: 'cooktopQty' }, sortOrder: 2 },
    { id: 'dishwasher-row', selectionSlotId: 'dishwasher', item: 'DISHWASHER ALLOWANCE', quantity: '1', manualRate: '', excelRate: 500, sortOrder: 3 },
    { id: 'mirror-row', selectionSlotId: 'mirror', item: 'MIRROR ALLOWANCE', quantity: '1', manualRate: '', excelRate: 50, sortOrder: 4 },
  ] },
  Untouched: { id: 'other', rows: [{ id: 'labour', item: 'Labour', quantity: 7, excelRate: 33 }] },
};
const foundation = { workspace_id: workspaceId, configurations: ['oven', 'cooktop', 'dishwasher', 'mirror'].map(selection_slot_id => ({ workspace_id: workspaceId, selection_slot_id, enabled: true })), mappings: [
  ['oven', 'oven-row'], ['cooktop', 'cooktop-row'], ['dishwasher', 'dishwasher-row'], ['mirror', 'mirror-row'],
].map(([selection_slot_id, quote_row_id]) => ({ workspace_id: workspaceId, template_id: 'template-a', selection_slot_id, quote_section_id: 'appliances', quote_row_id, status: 'MAPPED' })) };
const workbook = { workspaceId, templateKey: 'template-a', quotation, cashflowPayments: { 1: 1234 } };
const snapshot = { schedule: { id: 'schedule-a', workspace_id: workspaceId, display_name: 'Premier' }, items };
const applied = applyInclusionScheduleToQuote(workbook, snapshot, foundation);
const rows = applied.quotation['APPLIANCES & WHITE GOODS'].rows;
assert.deepEqual(applied.selectionMappingReport.map(item => item.status), ['MAPPED', 'PRESERVED', 'MAPPED', 'MAPPED']);
assert.deepEqual([rows[0].baselineProductId, rows[0].baselineUnitPrice, rows[0].quantity, rows[0].quantityKey, rows[0].formulas], ['master-oven', 1000, '2', '', { custom: 'keep' }]);
assert.deepEqual([rows[1].baselineProductId, rows[1].baselineUnitPrice, rows[1].manualRate, rows[1].formulas], ['private-cooktop', 700, '$900', { B: 'cooktopQty' }]);
assert.equal(rows[2].baselineProductId, 'master-dishwasher');
assert.equal(rows[2].baselineUnitPrice, null, 'missing inclusion price stays unresolved, not zero');
assert.strictEqual(applied.quotation.Untouched, quotation.Untouched);
assert.deepEqual(applied.cashflowPayments, workbook.cashflowPayments);
assert.equal(applied.jobInclusionSnapshot.items.length, 4);
const calculated = calculateEstimateBuilderWorkbook(applied);
assert.equal(calculated.quotation['APPLIANCES & WHITE GOODS'].rows[0].finalRateUsed, 1000);
assert.equal(calculated.quotation['APPLIANCES & WHITE GOODS'].rows[0].qty, 2);
console.log('PASS inclusion baseline resolves master and builder products by stable ID, preserves allowance/manual fields, applies known GST basis, and blocks missing/foreign products');
