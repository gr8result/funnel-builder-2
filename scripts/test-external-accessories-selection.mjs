import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { clientSelectionCategoryProducts } from '../lib/product-library/plumbingFixtureCatalogue.js';
import { plumbingLineFromProduct, plumbingLocationsForRequirement } from '../lib/builders/plumbingFixtureAllocation.js';

// The client is offered a suggested outdoor location even when the project rooms record none.
for (const key of ['clothesline', 'letterbox', 'house-numbers']) {
  const offered = plumbingLocationsForRequirement(key, ['Kitchen', 'Living', 'Laundry', 'Main Bathroom']);
  assert(offered.some((location) => location.label === 'Exterior' && location.suggested), `${key}: Exterior is a suggested location`);
  assert(!offered.some((location) => location.suggested && /kitchen|living|bathroom/i.test(location.label)), `${key}: indoor living rooms are not suggested`);
}
assert(plumbingLocationsForRequirement('clothesline', ['Laundry']).find((location) => location.label === 'Laundry')?.suggested, 'an indoor clothesline can go in the Laundry');
import { connectAllocatedSelectionsToQuotation } from '../lib/builders/allocatedSelectionQuotation.js';

const products = getMasterProducts('accessory-test');
const rows = [];
for (const requirementKey of ['clothesline', 'letterbox']) {
  const offered = clientSelectionCategoryProducts({ requirementKey }, { products });
  assert(offered.length >= 2, `${requirementKey}: actual colour variants are offered`);
  assert.equal(new Set(offered.map(p => p.productId)).size, offered.length);
  for (const product of offered) {
    assert(product.colour && product.model && product.officialProductUrl);
    assert(fs.existsSync(`public${product.primaryImageUrl}`));
    assert.equal(product.priceStatus, 'quote_required');
  }
  const product = offered[0];
  const line = plumbingLineFromProduct(product, { allocations: [{ locationKey: 'outside', location: 'Outside', quantity: 1 }] });
  rows.push({ guidedSelection: { requirementKey, requirementLabel: requirementKey, confirmed: true, plumbingAllocation: { lines: [line] } } });
}
const book = JSON.parse(JSON.stringify({ rooms: [{ id: 'outside', name: 'Outside', rows }] }));
const first = connectAllocatedSelectionsToQuotation({ workspaceId: 'accessory-test', quotation: {} }, book);
const again = connectAllocatedSelectionsToQuotation(first, book);
const quoteRows = Object.values(again.quotation).flatMap(s => s.rows || []);
assert.equal(quoteRows.length, 2, 'reimport never duplicates accessory charges');
for (const { guidedSelection } of rows) {
  const line = guidedSelection.plumbingAllocation.lines[0];
  const quote = quoteRows.find(row => row.productId === line.productId);
  assert(quote, 'actual product reaches quotation');
  assert.equal(Number(quote.quantity), 1);
  assert(again.procurement.items.some(item => item.productId === line.productId), 'actual product reaches procurement');
}
assert.deepEqual(again.quotation, first.quotation, 'repeat import preserves quotation');
// The quotation line carries the client's decision: confirmed here; a builder default is only "proposed".
for (const row of quoteRows) {
  assert.equal(row.clientSelectionStatus, 'confirmed');
  assert.equal(row.clientSelectionConfirmed, true);
}
const proposedBook = structuredClone(book);
for (const row of proposedBook.rooms[0].rows) delete row.guidedSelection.confirmed;
const proposed = Object.values(connectAllocatedSelectionsToQuotation(first, proposedBook).quotation).flatMap(s => s.rows || []);
assert(proposed.every(row => row.clientSelectionStatus === 'proposed' && row.clientSelectionConfirmed === false), 'an unconfirmed default is never reported as a client confirmation');
assert.equal(proposed.length, 2, 'status change does not add or drop a charge');
console.log('PASS verified accessory variants, images, persisted identities, quotation and procurement; no duplicate charges');
