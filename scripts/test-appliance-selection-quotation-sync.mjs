import assert from 'node:assert/strict';
import { APPLIANCE_SELECTION_QUOTE_SOURCE, connectApplianceSelectionsToQuotation } from '../lib/builders/applianceClientSelectionFlow.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

const masterAppliances = new Map(getMasterProducts().map((product) => [product.productId, product]));
assert.equal(masterAppliances.get('product:cooktops:bosch:pcr9a5i90a')?.gstIncluded, true, 'explicit inclusive appliance GST status reaches the master catalogue');
assert.equal(masterAppliances.get('product:rangehoods:bosch:dbb93bc60a')?.gstIncluded, true, 'inc-gst appliance status reaches the master catalogue');
assert.equal(masterAppliances.get('product:dishwashers:bosch:sms2iti02a')?.gstIncluded, true, 'nested supplier price evidence reaches the master catalogue');
assert.equal(masterAppliances.get('product:ovens:bosch:vbc5540s0')?.gstIncluded, null, 'missing appliance GST evidence remains unknown');

const selection = (overrides = {}) => ({
  source: 'guided_client_selections',
  sourceCatalogue: 'AU-APPLIANCE-CATALOGUE',
  canonicalProductId: 'product:ovens:bosch:vbc5540s0',
  productCode: 'VBC5540S0',
  applianceFamily: 'ovens',
  requirementKey: 'oven',
  requirementLabel: 'Oven',
  productName: 'Bosch Series 4 Built-In Oven',
  selectedProduct: 'Bosch Series 4 Built-In Oven',
  brand: 'Bosch',
  model: 'VBC5540S0',
  supplier: 'Bosch',
  unit: 'EACH',
  quantity: 1,
  selectedPrice: 3298,
  priceIncludesGst: false,
  allowance: 1200,
  variation: 2098,
  priceStatus: 'current',
  priceState: 'Current Price',
  ...overrides,
});
const book = (rows) => ({ rooms: [{ id: 'appliances', name: 'Appliances', rows: rows.map((guidedSelection, index) => ({ id: `selection-${index}`, guidedSelection })) }] });
const base = {
  quotation: {
    'APPLIANCES & WHITE GOODS': { collapsed: true, rows: [{ id: 'existing-appliance-option', item: 'Oven option', excelRate: '$900.00' }] },
    'APPLIANCES & WHITE GOODS - BOSCH': { collapsed: true, rows: [{ id: 'bosch-library-option', item: 'Bosch catalogue option', excelRate: '$3,000.00' }] },
  },
  procurement: { items: [{ id: 'unrelated', itemDescription: 'Other product' }] },
};
const sourceSnapshot = structuredClone(base);
const pendingOven = selection({ priceStatus: 'price_pending', priceState: 'Quote Required' });
const cooktop = selection({ requirementKey: 'cooktop', applianceFamily: 'cooktops', canonicalProductId: 'product:cooktops:bosch:pcr9a5i90a', productCode: 'PCR9A5I90A', productName: 'Bosch Gas Cooktop', selectedProduct: 'Bosch Gas Cooktop', model: 'PCR9A5I90A', selectedPrice: 2098, allowance: 950, variation: 2296, quantity: 2, priceStatus: 'fixed' });
const synced = connectApplianceSelectionsToQuotation(base, book([pendingOven, cooktop]));
const rows = synced.quotation['APPLIANCES & WHITE GOODS'].rows;
const ovenRow = rows.find((row) => row.productId === pendingOven.canonicalProductId);
const cooktopRow = rows.find((row) => row.productId === cooktop.canonicalProductId);
assert.equal(rows.filter((row) => row.source === APPLIANCE_SELECTION_QUOTE_SOURCE).length, 2);
assert.equal(ovenRow.quantity, 1);
assert.equal(ovenRow.excelRate, '');
assert.equal(ovenRow.quoteRequired, true);
assert.equal(ovenRow.priceStatus, 'Supplier Quote Required');
assert.equal(cooktopRow.quantity, 2);
assert.equal(cooktopRow.excelRate, 2098);
assert.equal(cooktopRow.allowanceTotal, 1900);
assert.equal(cooktopRow.variation, 2296);
assert.deepEqual(synced.procurement.items.find((item) => item.productId === pendingOven.canonicalProductId).estimatedTotal, null);
assert.equal(synced.procurement.items.find((item) => item.productId === cooktop.canonicalProductId).estimatedTotal, 4196);
assert.deepEqual(base, sourceSnapshot, 'connector leaves its input workbook unchanged');
assert.equal(synced.quotation['APPLIANCES & WHITE GOODS - BOSCH'].rows[0].id, 'bosch-library-option');

const dryer = selection({
  canonicalProductId: 'product:appliances:dryers:whirlpool:hwec8002iw',
  productCode: 'product:appliances:dryers:whirlpool:hwec8002iw',
  applianceFamily: 'dryers',
  requirementKey: 'clothes-dryer',
  requirementLabel: 'Clothes Dryer',
  productName: 'Whirlpool SaniCare 8kg Heat Pump Clothes Dryer',
  selectedProduct: 'Whirlpool SaniCare 8kg Heat Pump Clothes Dryer',
  brand: 'Whirlpool',
  supplier: 'Whirlpool',
  model: 'HWEC8002IW',
  selectedPrice: 1286,
  allowance: 0,
  allowanceStatus: 'not_set',
  variation: null,
  variationPending: true,
  priceIncludesGst: true,
  priceStatus: 'fixed',
});
const dryerSynced = connectApplianceSelectionsToQuotation(base, book([dryer]));
const dryerRow = dryerSynced.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === dryer.canonicalProductId);
assert.equal(dryerRow.excelRate, 1169.09, 'the SRP inc GST is converted to an ex-GST quotation rate');
assert.equal(dryerRow.priceIncludesGst, true);
assert.equal(dryerRow.variation, null, 'a supplier price is not compared against an invented allowance');
assert.equal(dryerRow.variationPending, true, 'variation waits for a configured builder baseline');
assert.equal(dryerSynced.procurement.items.find((item) => item.productId === dryer.canonicalProductId).estimatedRate, 1286, 'procurement retains the sourced GST-inclusive SRP');
assert.equal(dryerSynced.procurement.items.find((item) => item.productId === dryer.canonicalProductId).estimatedTotal, 1286);

const unknownGst = selection({ priceIncludesGst: null });
const unknownSynced = connectApplianceSelectionsToQuotation(base, book([unknownGst]));
const unknownRow = unknownSynced.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === unknownGst.canonicalProductId);
assert.equal(unknownRow.excelRate, '', 'a legacy retail amount with unknown GST is not silently treated as exclusive');
assert.equal(unknownRow.quoteRequired, true);
assert.equal(unknownRow.priceStatus, 'GST basis to confirm');
assert.equal(unknownRow.variation, null);
assert.equal(unknownRow.variationPending, true);
assert.equal(unknownRow.productLibrarySnapshot.selectedUnitPrice, 3298, 'the original sourced amount remains available for review');
assert.equal(unknownRow.productLibrarySnapshot.priceIncludesGst, null);
assert.equal(unknownSynced.procurement.items.find((item) => item.productId === unknownGst.canonicalProductId).priceIncludesGst, null);
assert.equal(dryerRow.productLibrarySnapshot.priceIncludesGst, true);
assert.equal(cooktopRow.productLibrarySnapshot.priceIncludesGst, false);

const catalogueOven = {
  productId: pendingOven.canonicalProductId,
  productName: pendingOven.productName,
  productCode: pendingOven.productCode,
  supplier: 'Bosch',
  priceUnit: 'EACH',
  clientPrice: 3298,
  gstIncluded: true,
  priceStatus: 'current',
  priceSource: 'supplier_price',
  priceSourceUrl: 'https://supplier.example.test/VBC5540S0',
  priceVerifiedAt: '2026-09-10',
};
const legacyMissingGst = selection({ priceIncludesGst: null });
const legacyInput = structuredClone(legacyMissingGst);
const corroborated = connectApplianceSelectionsToQuotation(base, book([legacyMissingGst]), { productById: (id) => id === catalogueOven.productId ? catalogueOven : null });
const corroboratedRow = corroborated.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === catalogueOven.productId);
assert.equal(corroboratedRow.priceIncludesGst, true, 'an exact current supplier match supplies a missing GST basis');
assert.equal(corroboratedRow.excelRate, 2998.18, 'GST-inclusive supplier price is converted and rounded to cents for the ex-GST quote rate');
assert.equal(corroboratedRow.quoteRequired, false);
assert.equal(corroboratedRow.productLibrarySnapshot.priceEvidenceSource, 'supplier_price');
assert.equal(corroboratedRow.productLibrarySnapshot.priceSourceUrl, catalogueOven.priceSourceUrl);
const corroboratedProcurement = corroborated.procurement.items.find((item) => item.productId === catalogueOven.productId);
assert.equal(corroboratedProcurement.priceIncludesGst, true, 'corroborated GST basis also reaches procurement');
assert.equal(corroboratedProcurement.rateStatus, 'Current Product Library price');
assert.deepEqual(legacyMissingGst, legacyInput, 'GST corroboration does not mutate the saved selection payload');

const explicitExclusive = selection({ priceIncludesGst: false });
const explicitBasis = connectApplianceSelectionsToQuotation(base, book([explicitExclusive]), { productById: () => catalogueOven });
assert.equal(explicitBasis.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === catalogueOven.productId).excelRate, 3298, 'an explicit selected GST basis is not overridden by the catalogue');
const priceMismatch = connectApplianceSelectionsToQuotation(base, book([selection({ priceIncludesGst: null, selectedPrice: 3299 })]), { productById: () => catalogueOven });
assert.equal(priceMismatch.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === catalogueOven.productId).quoteRequired, true, 'a different current catalogue amount cannot corroborate the selection');
const quoteRequiredCatalogue = { ...catalogueOven, priceStatus: 'quote_required' };
const quoteRequired = connectApplianceSelectionsToQuotation(base, book([legacyMissingGst]), { productById: () => quoteRequiredCatalogue });
assert.equal(quoteRequired.quotation['APPLIANCES & WHITE GOODS'].rows.find((row) => row.productId === catalogueOven.productId).quoteRequired, true, 'a quote-required catalogue record remains blocked');

const manualWorkbook = structuredClone(synced);
manualWorkbook.quotation['APPLIANCES & WHITE GOODS'].rows = rows.map((row) => row.id === cooktopRow.id ? { ...row, quantity: 3, quantityManualOverride: true, manualRate: '$1,999.00' } : row);
const refreshed = connectApplianceSelectionsToQuotation(manualWorkbook, book([pendingOven, cooktop]));
const refreshedRows = refreshed.quotation['APPLIANCES & WHITE GOODS'].rows.filter((row) => row.source === APPLIANCE_SELECTION_QUOTE_SOURCE);
assert.equal(refreshedRows.length, 2);
assert.equal(refreshedRows.find((row) => row.id === cooktopRow.id).quantity, 3);
assert.equal(refreshedRows.find((row) => row.id === cooktopRow.id).manualRate, '$1,999.00');
const reduced = connectApplianceSelectionsToQuotation(refreshed, book([pendingOven]));
assert.equal(reduced.quotation['APPLIANCES & WHITE GOODS'].rows.filter((row) => row.source === APPLIANCE_SELECTION_QUOTE_SOURCE).length, 1);
assert.equal(reduced.procurement.items.filter((item) => item.source === APPLIANCE_SELECTION_QUOTE_SOURCE).length, 1);

console.log('Appliance selection quote sync: products, quantities, price-pending state, manual overrides, and procurement passed.');