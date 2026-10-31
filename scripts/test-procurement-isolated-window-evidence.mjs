import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { after, test } from 'node:test';
import JSZip from 'jszip';
import { auditWindowScheduleQuotation } from '../lib/builders/selectionReconciliationReport.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { windowPriceListTakeoffQuantities } from '../lib/construction-estimation/windowsQuotePriceList.js';
import { planSelectionReconciliation } from '../lib/builders/selectionReconciliation.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { refreshSelectionProcurementRequirements } from '../lib/builders/selectionProcurementRequirements.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';

const file = new URL('../test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job', import.meta.url);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(file);
const expected = '821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46';
assert.equal(hash(bytes), expected);
const zip = await JSZip.loadAsync(bytes);
const workbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
assert.equal(workbook.jobId, 'gr8-reconcile-test-47c50983a480');
const commercialInputSignature = (source) => hash(JSON.stringify({
  jobId: source.jobId,
  quotation: source.quotation,
  quotationSectionOrder: source.quotationSectionOrder,
  clientSelectionsBook: source.clientSelectionsBook,
  procurement: source.procurement,
  cashflowPayments: source.cashflowPayments,
  purchaseOrders: source.purchaseOrders,
  jobInclusionSnapshot: source.jobInclusionSnapshot,
  summaryAdjustments: source.summaryAdjustments,
}));
const signature = commercialInputSignature(workbook);
const calculated = calculateEstimateBuilderWorkbook(structuredClone(workbook));
const audit = auditWindowScheduleQuotation(workbook, calculated);
const openings = windowPriceListTakeoffQuantities(workbook).outcomes.filter((opening) => opening.outcome !== 'elsewhere');
const selection = (workbook.clientSelectionsBook?.rooms ?? []).flatMap((room) => room.rows ?? []).find((row) => row.guidedSelection?.requirementKey === 'windows')?.guidedSelection ?? {};
const missingRfq = openings.filter((opening) => !(selection.procurementSchedule ?? []).some((item) => String(item.windowId) === String(opening.itemId)));

after(() => {
  assert.equal(commercialInputSignature(workbook), signature, 'No commercial input mutation');
  assert.equal(hash(fs.readFileSync(file)), expected, 'No isolated package write');
});

test('isolated calculation represents 26 windows and four glazed doors exactly once', () => {
  assert.equal(audit.selectedItems, 30);
  assert.equal(new Set(openings.map((opening) => opening.itemId)).size, 30);
  const glazed = audit.lines.filter((line) => line.type.startsWith('Glass Sliding Door')).reduce((total, line) => total + line.scheduleQuantity, 0);
  assert.equal(glazed, 4);
  assert.equal(audit.selectedItems - glazed, 26);
  assert.equal(audit.matchedItems, 30);
  assert.equal(audit.missingPriceItems, 2);
  assert.equal(audit.generatedUnsavedItems, 2);
  assert.equal(audit.pricedOpeningRows, 12);
  assert.equal(audit.duplicatedRows, 0);
});

test('two fixed-window prices remain explicitly unresolved', () => {
  const fixed = audit.lines.filter((line) => line.missingPrice);
  assert.deepEqual(fixed.map((line) => `${line.heightMm}x${line.widthMm}`).sort(), ['650x1800', '650x3000']);
  assert.equal(audit.flyscreenQuantity, 28);
  assert.equal(audit.flyscreenCost, 5252.85);
});

test('supplier RFQ remains incomplete and must not be reported as accepted', () => {
  assert.equal(openings.length - missingRfq.length, 28);
  assert.deepEqual(missingRfq.map((opening) => String(opening.itemId)).sort(), ['1789845033591.3105', '1789845050757.7505']);
});

test('explicit supplier refresh represents every selection and all thirty RFQ openings without repricing', () => {
  const refreshed = refreshSelectionProcurementRequirements(workbook, calculated);
  const repeated = refreshSelectionProcurementRequirements(refreshed, calculated);
  const windowSchedule = (source) => source.clientSelectionsBook.rooms.flatMap((room) => room.rows).find((row) => row.guidedSelection?.requirementKey === 'windows').guidedSelection.procurementSchedule;
  assert.equal(hash(JSON.stringify(repeated.quotation)), hash(JSON.stringify(refreshed.quotation)), 'Repeated refresh preserves the canonical quotation');
  assert.deepEqual(repeated.procurement.items, refreshed.procurement.items, 'Repeated refresh preserves procurement identities, values and order');
  assert.deepEqual(windowSchedule(repeated), windowSchedule(refreshed), 'Repeated refresh preserves the thirty-opening supplier schedule');
  const before = reconcileProductSelections({ workbook });
  const afterAudit = reconcileProductSelections({ workbook: refreshed });
  const windowIntegrity = afterAudit.entries.find((entry) => entry.requirementKey === 'windows');
  assert(windowIntegrity, 'the window schedule has an integrity entry');
  assert.equal(windowIntegrity.procurementRepresented, true, 'the complete 30-opening RFQ is represented');
  assert.equal(windowIntegrity.outcome, 'BLOCKED_MISSING_PRICE', 'unpriced fixed-glass openings keep the selection blocked');
  assert.deepEqual(windowIntegrity.unpricedOpeningIds?.sort(), ['1788819719715.5806', '1788819730420.5293']);
  assert.equal(before.procurementMissing.length, 27, 'the audit counts explicit, configured and schedule-owned requirements after canonical room matching');
  assert.deepEqual(afterAudit.procurementMissing.map((entry) => entry.requirementKey).sort(), [
    'architraves',
    'door-hardware',
    'exterior-paint',
    'internal-doors',
  ], 'only connector-owned quotation targets awaiting explicit approval remain absent from the unmodified quotation');
  const lightingIntegrity = afterAudit.entries.find((entry) => entry.requirementKey === 'external-lighting');
  assert.equal(lightingIntegrity.quantity, 4, 'supplier refresh represents all four lighting units across both SKUs');
  assert.equal(lightingIntegrity.procurementRepresented, true);
  assert.equal(lightingIntegrity.priceIncludesGst, null, 'supplier draft does not invent the missing GST basis');
  assert.notEqual(lightingIntegrity.outcome, 'PRICED_IN_QUOTE', 'representing the lighting requirement does not approve its price');
  assert.equal(afterAudit.counts.BLOCKED_DUPLICATE_ALLOCATION, 0, 'equal quantities in confirmed room aliases describe one physical allocation');
  assert.equal(afterAudit.procurementDuplicates.length, 0);
  const freshSelection = refreshed.clientSelectionsBook.rooms.flatMap((room) => room.rows).find((row) => row.guidedSelection?.requirementKey === 'windows').guidedSelection;
  assert.equal(freshSelection.procurementSchedule.length, 30);
  assert.equal(new Set(freshSelection.procurementSchedule.map((item) => String(item.windowId))).size, 30);
  assert.ok(freshSelection.supplier, 'the supplier RFQ retains the selected window supplier');
  assert(freshSelection.procurementSchedule.every((item) => item.supplier === freshSelection.supplier && item.room), 'every RFQ line retains its supplier and physical room');
  assert.equal(freshSelection.procurementSchedule.reduce((total, item) => total + Number(item.quantity || 0), 0), 30, 'RFQ quantity equals all physical window and glazed-door openings');
  const unpricedOpeningIds = new Set(openings.filter((opening) => opening.outcome === 'unpriced').map((opening) => String(opening.itemId)));
  const unpricedRfqs = freshSelection.procurementSchedule.filter((item) => unpricedOpeningIds.has(String(item.windowId)));
  assert.deepEqual(unpricedRfqs.map((item) => String(item.windowId)).sort(), ['1788819719715.5806', '1788819730420.5293']);
  assert(unpricedRfqs.every((item) => item.status === 'Quote Required' && item.priceRequired === true && item.approvedForOrdering !== true), 'unpriced fixed-glass RFQ items are explicitly quote-required and not order-approved');
  const internalDoor = before.entries.find((entry) => entry.requirementKey === 'internal-doors');
  const staleProcurementId = `procurement:selection:${encodeURIComponent(internalDoor.key)}`;
  const staleDraftWorkbook = {
    ...workbook,
    procurement: {
      ...workbook.procurement,
      items: [...workbook.procurement.items, { id: staleProcurementId, productId: internalDoor.productId, requirementKey: internalDoor.requirementKey, qty: 1, unit: internalDoor.unit, quantityManualOverride: false, orderStatus: 'Not Started', quoteRequired: true, estimatedRate: null, estimatedTotal: null }],
    },
  };
  const correctedProcurementWorkbook = refreshSelectionProcurementRequirements(staleDraftWorkbook, calculated);
  const correctedInternalDoorDraft = correctedProcurementWorkbook.procurement.items.find((item) => item.id === staleProcurementId);
  assert.equal(correctedInternalDoorDraft.qty, 16, 'stale editable internal-door procurement quantity refreshes from the existing measured quote rows rather than the selection-card count');
  assert.equal(correctedInternalDoorDraft.quantityPending, false);
  assert.equal(correctedInternalDoorDraft.quoteRequired, true);
  assert.equal(correctedInternalDoorDraft.estimatedRate, null);
  assert.equal(correctedInternalDoorDraft.approvedForOrdering, false);
  for (const field of ['quotation', 'quotationSectionOrder', 'cashflowPayments', 'purchaseOrders', 'jobInclusionSnapshot', 'summaryAdjustments']) {
    assert.deepEqual(refreshed[field], workbook[field], `${field} must remain unchanged`);
  }
  const originalIds = new Set(workbook.procurement.items.map((item) => item.id));
  const added = refreshed.procurement.items.filter((item) => !originalIds.has(item.id));
  assert.equal(added.length, 23, 'only requirements without a valid existing managed or connector-owned row get new drafts');
  const genericDrafts = added.filter((item) => item.id.startsWith('procurement:selection:'));
  assert(genericDrafts.every((item) => item.estimatedRate === null && item.estimatedTotal === null && item.approvedForOrdering === false && item.quoteRequired));
  assert(added.every((item) => item.approvedForOrdering !== true), 'connector-owned verified rates remain unapproved for ordering');
  const accessoryDrafts = refreshed.procurement.items.filter((item) => ['towel-rail', 'hand-towel', 'toilet-roll-holder', 'robe-hook'].includes(item.requirementKey));
  assert.equal(accessoryDrafts.length, 4);
  assert(accessoryDrafts.every((item) => item.qty === 3 && item.locationSchedule.length === 3), 'each alias-corrected accessory draft covers three physical locations exactly once');
  const entryDoorDraft = refreshed.procurement.items.find((item) => item.requirementKey === 'entry-door');
  assert(entryDoorDraft, 'the missing entry-door procurement link becomes an explicit supplier draft');
  assert.deepEqual([entryDoorDraft.qty, entryDoorDraft.estimatedRate, entryDoorDraft.estimatedTotal, entryDoorDraft.approvedForOrdering], [1, null, null, false], 'the entry-door supplier price stays unresolved and unapproved');
  const refreshedById = new Map(refreshed.procurement.items.map((item) => [item.id, item]));
  assert.equal(new Set(refreshed.procurement.items.map((item) => item.id)).size, refreshed.procurement.items.length, 'procurement identities remain unique');
  for (const original of workbook.procurement.items) {
    const protectedState = original.approvedForOrdering === true
      || original.quantityManualOverride === true
      || original.manualQuantity === true
      || !['', 'Not Started', 'Removed From Quote'].includes(original.orderStatus || '');
    if (!protectedState) continue;
    const current = refreshedById.get(original.id);
    assert(current, `commercially protected procurement item ${original.id} remains present`);
    if (original.approvedForOrdering === true) assert.equal(current.approvedForOrdering, true, `${original.id} remains approved`);
    if (original.quantityManualOverride === true || original.manualQuantity === true) assert.equal(current.qty, original.qty, `${original.id} keeps its manual quantity`);
    if (!['', 'Not Started', 'Removed From Quote'].includes(original.orderStatus || '')) assert.equal(current.orderStatus, original.orderStatus, `${original.id} keeps its order state`);
  }
});

test('static-catalogue proposal replay is financially idempotent without applying it', () => {
  const products = new Map(getMasterProducts(workbook.workspaceId).map((product) => [product.productId, product]));
  const productById = (id) => products.get(id) ?? null;
  const first = planSelectionReconciliation({ workbook: structuredClone(workbook), productById });
  const second = planSelectionReconciliation({ workbook: structuredClone(first.workbook), productById });
  const firstCalculation = calculateEstimateBuilderWorkbook(structuredClone(first.workbook));
  const secondCalculation = calculateEstimateBuilderWorkbook(structuredClone(second.workbook));
  const accessories = [
    ['towel-rail', 'master-PLB-HNC-NE0381241', 'pack:bathroom-accessory-pack:towel-rail'],
    ['hand-towel', 'master-PLB-HNC-NE03541', 'pack:bathroom-accessory-pack:hand-towel'],
    ['toilet-roll-holder', 'master-PLB-HNC-NE03641', 'pack:bathroom-accessory-pack:toilet-roll-holder'],
    ['robe-hook', 'master-PLB-HNC-NE02141', 'pack:bathroom-accessory-pack:robe-hook'],
  ];
  const originalRows = Object.entries(workbook.quotation).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
  const reconciledRows = Object.entries(first.workbook.quotation).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
  const reconciledSelections = reconcileProductSelections({ workbook: first.workbook, productById });
  for (const [requirementKey, productId, lineId] of accessories) {
    const rowId = `allocated-selection:${requirementKey}:${lineId}`;
    const beforeRow = originalRows.find(({ row }) => row.id === rowId)?.row;
    const afterRow = reconciledRows.find(({ row }) => row.id === rowId)?.row;
    assert(beforeRow && afterRow, `${requirementKey} keeps its single existing quotation row`);
    assert.equal(afterRow.productId, productId, `${requirementKey} maps the selected Product Library product onto its existing row`);
    assert.deepEqual([afterRow.qty, afterRow.excelRate, afterRow.manualRate, afterRow.allowancePerUnit], [beforeRow.qty, beforeRow.excelRate, beforeRow.manualRate, beforeRow.allowancePerUnit], `${requirementKey} retains quote quantity, rate and inclusion allowance before approval`);
    assert.equal(afterRow.variation, null, `${requirementKey} does not post an unapproved replacement variation`);
    const audited = reconciledSelections.entries.find((entry) => entry.requirementKey === requirementKey && entry.productId === productId);
    assert.equal(audited.targetStatus, 'VERIFIED_EXISTING_ROW', `${requirementKey} no longer has a missing target`);
    assert.equal(audited.outcome, 'BLOCKED_UNVERIFIED_BASELINE', `${requirementKey} remains blocked only for business approval of its retained inclusion baseline`);
  }
  assert.equal(firstCalculation.summary.finalQuoteTotal, secondCalculation.summary.finalQuoteTotal);
  assert.equal(second.changes.length, 0);
  for (const proposed of [first.workbook, second.workbook]) {
    for (const field of ['purchaseOrders', 'cashflowPayments', 'jobInclusionSnapshot', 'summaryAdjustments']) {
      assert.deepEqual(proposed[field], workbook[field], `${field} stays unchanged`);
    }
    const proposedAudit = auditWindowScheduleQuotation(proposed, calculateEstimateBuilderWorkbook(structuredClone(proposed)));
    assert.equal(proposedAudit.flyscreenCost, audit.flyscreenCost);
    assert.equal(proposedAudit.duplicatedRows, 0);
  }
});