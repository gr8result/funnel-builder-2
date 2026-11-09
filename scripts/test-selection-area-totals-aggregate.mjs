import assert from 'node:assert/strict';
import { areaTotals } from '../lib/builders/clientSelectionWorkflow.js';

// Flooring stores whole-job totals (sum of its lines), not per-m² rates: the budget must not multiply
// them by the area again (a real job showed $6,062,680 of allowances for $27,963.10).
const flooring = { requirementKey: 'interior-flooring', defaultQuantity: 1 };
const sink = { requirementKey: 'sink', defaultQuantity: 1 };
const map = new Map([
  ['interior-flooring', { selected_details: { allowance: 27963.1, selectedPrice: 20230.49, quantity: 216.81, flooringLines: [{ allowanceTotal: 25113.55 }, { allowanceTotal: 2849.55 }] } }],
  ['sink', { selected_details: { allowance: 650, selectedPrice: 415, quantity: 2, priceIncludesGst: true } }],
]);
const totals = areaTotals([flooring, sink], map);
assert.equal(totals.allowance, 27963.1 + 1300, 'flooring total once + sink 2 × $650');
assert.equal(totals.selected, 20230.49 + 830, 'flooring total once + sink 2 × $415');
console.log('PASS area totals: aggregate flooring counted once, per-unit items scale with quantity');
