// Regression: appliance selections saved before the catalogue had a supplier stored the brand
// in `supplier` and had no GST basis. When the catalogue now holds a current, GST-known supplier
// price for the same product, price and unit, the connector must:
//   - corroborate the GST basis (ex-GST quote rate, no "GST basis to confirm" block),
//   - use the catalogue supplier for the quote line and procurement,
//   - recalculate the variation on the ex-GST rate (the saved one treated the price as ex GST),
//   - still reject a genuinely different supplier or brand,
//   - stay stable when synced again.
import assert from 'node:assert/strict';
import { APPLIANCE_SELECTION_QUOTE_SOURCE, connectApplianceSelectionsToQuotation } from '../lib/builders/applianceClientSelectionFlow.js';

const PRODUCT_ID = 'product:rangehoods:bosch:dbb93bc60a';
const catalogue = {
  productId: PRODUCT_ID, productName: 'Bosch Series 2 900mm Integrated Rangehood', productCode: PRODUCT_ID,
  brand: 'Bosch', supplier: 'Harvey Norman Commercial', priceUnit: 'EACH', clientPrice: 1199, gstIncluded: true,
  priceStatus: 'current', priceSource: 'supplier_price',
  priceSourceUrl: 'https://supplier.example.test/DBB93BC60A', priceVerifiedAt: '2026-09-12',
};
const legacySelection = (overrides = {}) => ({
  source: 'guided_client_selections', sourceCatalogue: 'AU-APPLIANCE-CATALOGUE',
  canonicalProductId: PRODUCT_ID, productCode: PRODUCT_ID, applianceFamily: 'rangehoods',
  requirementKey: 'rangehood', productName: catalogue.productName, selectedProduct: catalogue.productName,
  brand: 'Bosch', supplier: 'Bosch', model: 'DBB93BC60A', unit: 'EACH', quantity: 1,
  selectedPrice: 1199, priceIncludesGst: null, allowance: 650,
  variation: 549, // saved while GST basis was unknown: 1199 - 650, treating 1199 as ex GST
  priceStatus: 'current', priceState: 'Current Price', ...overrides,
});
const book = (selection) => ({ rooms: [{ id: 'appliances', name: 'Appliances', rows: [{ id: 'row-1', guidedSelection: selection }] }] });
const workbook = () => ({ quotation: {}, procurement: { items: [{ id: 'unrelated', itemDescription: 'Keep this row' }] } });
const productById = (id) => (id === PRODUCT_ID ? catalogue : null);
const quoteRow = (result) => result.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === PRODUCT_ID);
const procurementRow = (result) => result.procurement.items.find((item) => item.productId === PRODUCT_ID);

const selection = legacySelection();
const before = structuredClone(selection);
const synced = connectApplianceSelectionsToQuotation(workbook(), book(selection), { productById });
const row = quoteRow(synced);
assert.equal(row.quoteRequired, false, 'legacy brand-as-supplier selection is corroborated');
assert.equal(row.priceIncludesGst, true);
assert.equal(row.excelRate, 1090, 'quote rate is ex GST: 1199 / 1.1');
assert.equal(row.priceStatus, 'Current Price');
assert.equal(row.supplier, 'Harvey Norman Commercial', 'quote line uses the catalogue supplier');
assert.equal(row.variation, 440, 'variation recalculated on ex-GST rate: 1090 - 650');
assert.equal(row.productLibrarySnapshot.priceEvidenceSource, 'supplier_price');
const procurement = procurementRow(synced);
assert.equal(procurement.supplier, 'Harvey Norman Commercial', 'procurement goes to the catalogue supplier');
assert.equal(procurement.estimatedRate, 1199, 'procurement keeps the sourced GST-inclusive amount');
assert.equal(procurement.priceIncludesGst, true);
assert.deepEqual(selection, before, 'the saved selection snapshot is never mutated');
assert(synced.procurement.items.some((item) => item.id === 'unrelated'), 'unrelated procurement is preserved');

const resynced = connectApplianceSelectionsToQuotation(synced, book(selection), { productById });
assert.equal(resynced.quotation['APPLIANCES & WHITE GOODS'].rows.filter((item) => item.source === APPLIANCE_SELECTION_QUOTE_SOURCE).length, 1, 'second sync adds no quote line');
assert.equal(resynced.procurement.items.filter((item) => item.productId === PRODUCT_ID).length, 1, 'second sync adds no procurement requirement');
assert.deepEqual(quoteRow(resynced), row, 'second sync leaves the quote line unchanged');
assert.deepEqual(procurementRow(resynced), procurement, 'second sync leaves procurement unchanged');

const otherSupplier = quoteRow(connectApplianceSelectionsToQuotation(workbook(), book(legacySelection({ supplier: 'Other Supplier' })), { productById }));
assert.equal(otherSupplier.quoteRequired, true, 'a different supplier is still not corroborated');
assert.equal(otherSupplier.supplier, 'Other Supplier');
assert.equal(otherSupplier.excelRate, '');

const otherBrand = quoteRow(connectApplianceSelectionsToQuotation(workbook(), book(legacySelection({ brand: 'Smeg', supplier: 'Smeg' })), { productById }));
assert.equal(otherBrand.quoteRequired, true, 'brand-as-supplier only corroborates when the catalogue brand matches');

const differentPrice = quoteRow(connectApplianceSelectionsToQuotation(workbook(), book(legacySelection({ selectedPrice: 1149 })), { productById }));
assert.equal(differentPrice.quoteRequired, true, 'a different amount is never silently replaced by the catalogue price');

const explicit = quoteRow(connectApplianceSelectionsToQuotation(workbook(), book(legacySelection({ priceIncludesGst: false, variation: 549 })), { productById }));
assert.equal(explicit.excelRate, 1199, 'an explicit saved GST basis wins');
assert.equal(explicit.supplier, 'Bosch', 'an uncorroborated selection keeps its saved supplier');
assert.equal(explicit.variation, 549, 'an uncorroborated selection keeps its saved variation');

console.log('appliance legacy supplier / GST corroboration regression: PASS (16 checks)');
