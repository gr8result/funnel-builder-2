import assert from 'node:assert/strict';
import { markSelectionPricePending, pendingPriceRowIds, selectionPricePendingSummary } from '../lib/builders/selectionPricePending.js';
import { quotationNotifications } from '../lib/construction-estimation/quotationNotifications.js';

// Applied client selections whose supplier price is still pending stay provisional in the quotation.
const quotation = {
  'APPLIANCES & WHITE GOODS': { rows: [
    { id: 'appliance-selection:oven', item: 'Bosch Series 4 Oven', qty: 1, manualRate: '' },
    { id: 'appliance-selection:cooktop', item: 'Bosch Series 6 Cooktop', qty: 1, manualRate: '1907.27' },
  ] },
  FLOORCOVERINGS: { rows: [{ id: 'flooring:carpet', item: 'Highland Park Twilight carpet', qty: 86.35, manualRate: '30' }] },
  ELECTRICAL: { rows: [{ id: 'electrical-schedule:microwave', item: 'Microwave Point', qty: 1, manualRate: '' }] },
};
const plan = {
  priceProblems: [{ identityKey: 'oven' }, { identityKey: 'carpet' }],
  canonicalAudit: { entries: [
    { identityKey: 'oven', quoteRowIds: [], proposedQuotationMutations: [{ rowId: 'appliance-selection:oven' }] },
    { identityKey: 'carpet', quoteRowIds: ['flooring:carpet'], proposedQuotationMutations: [] },
    { identityKey: 'cooktop', quoteRowIds: ['appliance-selection:cooktop'], proposedQuotationMutations: [] },
  ] },
  changes: [{ rowId: 'electrical-schedule:microwave', priceMissing: false, rate: { status: 'Rate required in Quotation Builder' } }],
};
const ids = pendingPriceRowIds(plan);
assert.deepEqual([...ids].sort(), ['appliance-selection:oven', 'electrical-schedule:microwave', 'flooring:carpet'], 'pending rows = price problems + unpriced changed lines; the priced cooktop is not pending');
const marked = markSelectionPricePending(quotation, ids, '2026-11-01T00:00:00.000Z');
const summary = selectionPricePendingSummary(marked);
assert.equal(summary.count, 3);
assert.equal(summary.total, 2590.5, 'carpet 86.35 m² × $30 = $2,590.50; the oven and microwave point have no price');
assert.equal(summary.unpriced, 2);
assert.equal(marked['APPLIANCES & WHITE GOODS'].rows[1].selectionPricePending, undefined, 'a priced selection is not marked');
assert.equal(marked.FLOORCOVERINGS.rows[0].manualRate, '30', 'rates are never changed');
// Idempotent; and a confirmed price clears the mark on the next reconciliation.
assert.deepEqual(markSelectionPricePending(marked, ids, 'later'), marked, 'marking twice changes nothing');
const cleared = markSelectionPricePending(marked, new Set(['appliance-selection:oven']), 'later');
assert.equal(selectionPricePendingSummary(cleared).count, 1);
// Entering a different rate on the line confirms it.
const confirmed = structuredClone(marked); confirmed.FLOORCOVERINGS.rows[0].manualRate = '41.50';
assert.equal(selectionPricePendingSummary(confirmed).count, 2);
// The Quotation page shows a standing (not dismissable) notice with the value.
const notice = quotationNotifications({}, { quotation: marked }).find((item) => item.key === 'selection-price-pending');
assert(notice && notice.requiresAcknowledgement === false && !notice.ok, 'standing warning');
assert(/3 client selection lines/.test(notice.message) && /\$2,590\.50/.test(notice.message) && /2 with no price yet/.test(notice.message), notice.message);
assert.equal(quotationNotifications({}, { quotation }).find((item) => item.key === 'selection-price-pending'), undefined, 'no notice when nothing is provisional');
console.log('PASS provisional selection prices: marked, idempotent, cleared when confirmed, standing notice with value');
