// Regression: a second sync must not report canonical location relabels as procurement
// mismatches, and connector-owned procurement rows (whose supplier comes from catalogue
// evidence) must count as the product's procurement so no duplicate draft is created.
import assert from 'node:assert/strict';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';
import { canonicalSelectionLocation } from '../lib/builders/plumbingFixtureAllocation.js';

const FAN = 'master-PLB-HNC-42222W';
const book = (allocations) => ({ rooms: [{ id: 'services', name: 'Electrical', rows: [{
  id: 'fan-row', guidedSelection: { requirementKey: 'ceiling-fan', plumbingAllocation: { lines: [{
    lineId: FAN, productId: FAN, requirementKey: 'ceiling-fan', productName: 'AeroFlow Winglide Ceiling Fan',
    supplier: 'Harvey Norman Commercial', unit: 'EACH', unitPrice: 299, priceBasis: 'inc GST', allocations,
  }] } },
}] }] });
const workbook = (locationSchedule, procurementOverrides = {}) => ({
  jobId: 'job-test', workspaceId: 'ws-test',
  quotation: { ELECTRICAL: { rows: [{ id: `allocated-selection:ceiling-fan:${FAN}`, productId: FAN, item: 'Ceiling fan', qty: 7, unit: 'EACH', excelRate: 271.82, priceStatus: 'Current Price', productLibrarySnapshot: { productId: FAN, priceIncludesGst: true } }] } },
  procurement: { items: [{ id: `allocated-selection:ceiling-fan:${FAN}`, productId: FAN, requirementKey: 'ceiling-fan', supplier: 'Harvey Norman Commercial', unit: 'EACH', qty: 7, locationSchedule, ...procurementOverrides }] },
});
const entryFor = (audit) => audit.entries.find((entry) => entry.productId === FAN);
const saved = [{ location: 'DOWNSTAIRS', quantity: 2 }, { location: 'UPSTAIRS', quantity: 5 }];

// Only meaningful while the canonical location helper exists (it relabels level names).
if (typeof canonicalSelectionLocation === 'function' && canonicalSelectionLocation('DOWNSTAIRS').location !== 'DOWNSTAIRS') {
  const relabelled = saved.map(({ location, quantity }) => ({ location: canonicalSelectionLocation(location).location, quantity }));
  const audit = reconcileProductSelections({ workbook: workbook(relabelled), book: book(saved) });
  const entry = entryFor(audit);
  assert.equal(entry.procurementRepresented, true, 'canonical relabel (DOWNSTAIRS -> Ground Floor) is the same location');
  assert.notEqual(entry.procurementStatus, 'QUANTITY_OR_LOCATION_MISMATCH');
  const stairs = reconcileProductSelections({
    workbook: workbook([{ location: 'Staircase', quantity: 7 }]),
    book: book([{ location: 'Internal stairs', quantity: 7 }]),
  });
  assert.equal(entryFor(stairs).procurementRepresented, true, '"Internal stairs" and "Staircase" are the same location');
}

const wrongQuantity = reconcileProductSelections({ workbook: workbook([{ location: 'DOWNSTAIRS', quantity: 3 }, { location: 'UPSTAIRS', quantity: 5 }]), book: book(saved) });
assert.equal(entryFor(wrongQuantity).procurementRepresented, false, 'a real quantity difference is still a mismatch');

const differentRoom = reconcileProductSelections({ workbook: workbook([{ location: 'Garage', quantity: 2 }, { location: 'UPSTAIRS', quantity: 5 }]), book: book(saved) });
assert.equal(entryFor(differentRoom).procurementRepresented, false, 'a different location is still a mismatch');

const correctedSupplier = reconcileProductSelections({ workbook: workbook(saved), book: { rooms: [{ id: 'services', name: 'Electrical', rows: [{
  id: 'fan-row', guidedSelection: { requirementKey: 'ceiling-fan', plumbingAllocation: { lines: [{
    lineId: FAN, productId: FAN, requirementKey: 'ceiling-fan', productName: 'AeroFlow Winglide Ceiling Fan',
    supplier: 'AeroFlow', unit: 'EACH', unitPrice: 299, priceBasis: 'inc GST', allocations: saved,
  }] } },
}] }] } });
assert.equal(entryFor(correctedSupplier).procurementRepresented, true, 'a connector row with a catalogue-corrected supplier still represents the product');

const draftOnly = reconcileProductSelections({ workbook: workbook(saved, { id: 'manual-po-line', supplier: 'Someone Else' }), book: book(saved) });
assert.equal(entryFor(draftOnly).procurementRepresented, false, 'a non-connector row from another supplier does not represent the product');

console.log('selection reconciliation resync stability regression: PASS');
