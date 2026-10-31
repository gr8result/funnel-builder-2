import assert from 'node:assert/strict';
import { plumbingLineFromProduct, plumbingAllocationSummary } from '../lib/builders/plumbingFixtureAllocation.js';
import { connectAllocatedSelectionsToQuotation } from '../lib/builders/allocatedSelectionQuotation.js';

const product = {
  productId: 'master-sink-gst-fixture', productCode: 'SINK-GST', productName: 'GST Inclusive Sink',
  clientPrice: 547, gstIncluded: true, priceStatus: 'current', familyKey: 'kitchen-sinks',
  unit: 'EACH', workspace_id: 'builder-a',
};
const line = plumbingLineFromProduct(product, {
  unitPrice: 547, unitAllowance: 650, priceState: 'Current Price',
  allocations: [{ locationKey: 'kitchen', location: 'Kitchen', quantity: 1 }, { locationKey: 'laundry', location: 'Laundry', quantity: 1 }],
});
assert.equal(line.priceIncludesGst, true);
assert.equal(line.quantity, 2);
assert.equal(line.variation, -305.45, 'two sinks use the ex-GST unit price against the $650 ex-GST allowance per sink');
assert.equal(plumbingAllocationSummary([line]).variation, -305.45);
const book = { rooms: [{ rows: [{ guidedSelection: { requirementKey: 'sink', requirementLabel: 'Sink', plumbingAllocation: { lines: [line] } } }] }] };
const connected = connectAllocatedSelectionsToQuotation({ workspaceId: 'builder-a', quotation: { 'PLUMBING FIT OFF': { id: 'plumbing', rows: [] } }, jobInclusionSnapshot: { items: [{ selection_slot_id: 'sink' }] } }, book);
const quote = connected.quotation['PLUMBING FIT OFF - CLIENT SELECTIONS'].rows.find(row => row.productId === product.productId);
assert(quote);
assert.equal(Number(quote.excelRate), 497.2727, 'quotation uses ex-GST unit rate');
assert.equal(Number(quote.quantity), 2);
console.log('PASS plumbing allocations keep gross catalogue display while quote rate and variation use ex-GST amounts.');
