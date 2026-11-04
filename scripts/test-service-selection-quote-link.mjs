// Service selections (ceiling fans, lighting) with no saved quotation row: linked only on unambiguous evidence.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-service-selection-quote-link.mjs
import assert from 'node:assert/strict';
import { connectAllocatedSelectionsToQuotation } from '../lib/builders/allocatedSelectionQuotation.js';
import { plumbingLineWithTotals } from '../lib/builders/plumbingFixtureAllocation.js';

const fan = (quantity = 18) => plumbingLineWithTotals({ lineId: 'fan-a', productId: 'master-FAN-A', productCode: 'FAN-A', productName: 'Winglide 52"', brand: 'AeroFlow', supplier: 'Beacon', unit: 'EACH', quantity, unitPrice: 330, priceBasis: 'Retail inc GST', unitAllowance: 100,
  allocations: [{ locationKey: 'living', location: 'Living', quantity }] });
const book = (line) => ({ rooms: [{ rows: [{ guidedSelection: { requirementKey: 'ceiling-fan', plumbingAllocation: { lines: [line] } } }] }] });
const workbook = rows => ({ quotation: { ELECTRICAL: { rows } }, procurement: { items: [] } });
const rowsOf = result => result.quotation.ELECTRICAL.rows;
const base = [{ id: 'quote-1', item: 'CEILING FAN AND INSTALL', qty: 8, unit: 'EACH', excelRate: 250, manualRate: '', materialRate: 100 }, { id: 'quote-2', item: 'CEILING FAN AND LIGHT AND INSTALL', qty: 0, unit: 'EACH', excelRate: 300, manualRate: '', materialRate: 120 }];

// One quantified row: the project's fan requirement. The unquantified alternative is untouched.
let result = connectAllocatedSelectionsToQuotation(workbook(base), book(fan()));
assert.equal(rowsOf(result).length, 2, 'no duplicate quotation line');
assert(rowsOf(result)[0].selectedProducts?.length === 1, 'the quantified row carries the selection');
assert.equal(rowsOf(result)[1].selectedProducts, undefined, 'the unquantified row is untouched');
assert.deepEqual(result.residentialSelectionReview, []);
// Allocated 18 against a quoted 8: the rate and original allowance are not recalculated; it is flagged.
assert.equal(rowsOf(result)[0].excelRate, 250); assert.equal(rowsOf(result)[0].manualRate, '');
assert.match(rowsOf(result)[0].serviceSelectionStatus, /Allocate the full project quantity/);
// Re-running changes nothing (idempotent).
const again = connectAllocatedSelectionsToQuotation(result, book(fan()));
assert.deepEqual(rowsOf(again), rowsOf(result));
// Removing the selection restores the original row.
const removed = connectAllocatedSelectionsToQuotation(result, { rooms: [] });
assert.equal(rowsOf(removed)[0].selectedProducts, undefined); assert.equal(rowsOf(removed)[0].excelRate, 250);

// Matching quantity prices the row from the original allowance: material swapped, labour kept.
result = connectAllocatedSelectionsToQuotation(workbook(base.map(row => row.id === 'quote-1' ? { ...row, materialAllowance: 100 } : row)), book(fan(8)));
assert.equal(rowsOf(result)[0].selectedProducts.length, 1);

// Two quantified rows are ambiguous: nothing is linked and the builder is asked.
const ambiguous = connectAllocatedSelectionsToQuotation(workbook(base.map(row => ({ ...row, qty: 4 }))), book(fan()));
assert.equal(rowsOf(ambiguous).filter(row => row.selectedProducts).length, 0);
assert.equal(ambiguous.residentialSelectionReview.length, 1);
assert.match(ambiguous.residentialSelectionReview[0].reason, /Choose the existing quotation requirement/);

// A line that names its row keeps that row, whatever the quantities.
const named = connectAllocatedSelectionsToQuotation(workbook(base.map(row => ({ ...row, qty: 4 }))), book({ ...fan(), quotationRowId: 'quote-2', quotationSection: 'ELECTRICAL' }));
assert.equal(rowsOf(named).find(row => row.id === 'quote-2').selectedProducts.length, 1);
assert.equal(rowsOf(named).find(row => row.id === 'quote-1').selectedProducts, undefined);
console.log('Service selection quote link: single-quantified-row, ambiguity, explicit target, idempotence and rate preservation passed.');
