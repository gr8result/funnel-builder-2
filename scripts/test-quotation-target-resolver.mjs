import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TARGET_STATUS, REVIEW_REASON, selectionIdentity, resolveQuotationTarget, reconcileSelectionTargets, applyResolvedSelectionTargets, resolvedBaseRate,
} from '../lib/builders/quotationTargetResolver.js';
import { resolveTradeSection } from '../lib/builders/quotationTradeSections.js';
import { deferUnapprovedQuotationChanges, planSelectionReconciliation, locationFingerprint } from '../lib/builders/selectionReconciliation.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quoteLineTotal, shouldIncludeQuoteRowInFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';
import { connectTenantSelectionMetadata } from '../lib/builders/tenantSelectionQuotation.js';
import { getEffectiveProductCatalogue, hydrateBuilderCatalogue, setCatalogueStorage } from '../lib/product-library/catalogueService.js';
import { selectionReconciliationFinancialImpact } from '../lib/builders/quotationFinancialImpact.js';

const ws = 'ws-1';
const selectionRow = (requirementKey, guided = {}) => ({ id: `row-${requirementKey}`, item: requirementKey, guidedRequirementKey: requirementKey, selectedOptionId: 'x', guidedSelection: { requirementKey, productId: `p-${requirementKey}`, productName: `Product ${requirementKey}`, quantity: 1, unit: 'EACH', selectedPrice: 110, priceIncludesGst: true, priceStatus: 'Current Price', ...guided } });
const book = (...rows) => ({ rooms: [{ id: 'room-1', name: 'Kitchen', rows }] });
const workbook = (quotation, extra = {}) => ({ workspaceId: ws, templateKey: 'tpl-builder-a', quotation, ...extra });
const section = (rows) => ({ collapsed: false, columns: [], rows });
const ident = (key, guided) => selectionIdentity(selectionRow(key, guided), 'Kitchen');

// Import-cycle regression: the pure modules load from any entry point.
await import('../lib/builders/selectionRegistry.js');
await import('../lib/builders/selectionQuoteEngine.js');
await import('../lib/builders/selectionRequirementTaxonomy.js');
console.log('PASS pure resolver, registry, engine and taxonomy load in any order (no import cycle)');

{
  const roofingIdentity = {
    ...ident("roofing", {
      productId: "fascia-gutter-package",
      productName: "Fascia gutter and downpipe package",
      selectedPrice: null,
      priceStatus: "quote_required",
    }),
    searchText: "fascia gutter downpipe",
  };
  const source = workbook({
    ROOFING: section([
      { id: "roofing-all-in", item: "M2 RATE (BATTENS, FASCIA, GUTTER, ROOF & INS)", qty: 220, unit: "M2", excelRate: 95 },
      { id: "roofing-brackets", item: "GUTTER & FASCIA BRACKETS", qty: 0, unit: "EACH", excelRate: 4 },
    ]),
  });
  const target = resolveQuotationTarget({ workbook: source, identity: roofingIdentity });
  assert.equal(target.status, TARGET_STATUS.VERIFIED_SPECIFICATION_ROW);
  assert.equal(target.rowId, "roofing-all-in");
  const first = applyResolvedSelectionTargets(source, reconcileSelectionTargets({ workbook: source, book: book(selectionRow("roofing", roofingIdentity)) }));
  const tagged = first.workbook.quotation.ROOFING.rows.find((row) => row.id === "roofing-all-in");
  assert.equal(tagged.selectionSpecificationOnly, true);
  assert.equal(resolveQuotationTarget({ workbook: first.workbook, identity: roofingIdentity }).status, TARGET_STATUS.VERIFIED_SPECIFICATION_ROW);
}

// Financial approval detects offsetting line changes even when the final total is unchanged.
{
  const before = workbook({ KITCHEN: section([
    { id: 'line-a', item: 'Sink', qty: 1, unit: 'EACH', excelRate: 100 },
    { id: 'line-b', item: 'Mixer', qty: 1, unit: 'EACH', excelRate: 100 },
  ]) });
  const offsetting = { ...before, quotation: { KITCHEN: { ...before.quotation.KITCHEN, rows: [
    { ...before.quotation.KITCHEN.rows[0], excelRate: 110 },
    { ...before.quotation.KITCHEN.rows[1], excelRate: 90 },
  ] } } };
  const change = selectionReconciliationFinancialImpact(before, offsetting);
  assert.equal(change.delta, 0, 'equal and opposite line changes preserve the final total');
  assert.equal(change.rowChanges.length, 2, 'both changed lines remain visible for approval');
  assert.equal(change.requiresApproval, true, 'a zero net delta does not waive row-level approval');
  const unchanged = selectionReconciliationFinancialImpact(before, structuredClone(before));
  assert.equal(unchanged.requiresApproval, false);
  assert.equal(unchanged.rowChanges.length, 0);
  const editedSelections = { ...before, clientSelectionsBook: { rooms: [{ id: 'kitchen', name: 'Kitchen', rows: [] }] }, quotation: { KITCHEN: { rows: [{ id: 'line-a', item: 'Sink', qty: 2, unit: 'EACH', excelRate: 110 }, { id: 'line-b', item: 'Mixer', qty: 1, unit: 'EACH', excelRate: 90 }] } } };
  const pendingImpact = selectionReconciliationFinancialImpact(before, editedSelections);
  const deferred = deferUnapprovedQuotationChanges(before, editedSelections, pendingImpact);
  assert.deepEqual(deferred.quotation, before.quotation, 'selection save defers every unapproved quotation row change');
  assert.deepEqual(deferred.clientSelectionsBook, editedSelections.clientSelectionsBook, 'selection save retains the client’s updated selections');
  assert.equal(deferred.selectionReconciliationPending.status, 'FINANCIAL_APPROVAL_REQUIRED');
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(deferred)).summary.finalQuoteTotal, calculateEstimateBuilderWorkbook(structuredClone(before)).summary.finalQuoteTotal);
  const existingPending = { ...before, selectionReconciliationPending: { status: 'FINANCIAL_APPROVAL_REQUIRED', approvalSignature: 'pending-signature' } };
  const stillPending = deferUnapprovedQuotationChanges(existingPending, existingPending, selectionReconciliationFinancialImpact(before, before));
  assert.equal(stillPending.selectionReconciliationPending.approvalSignature, 'pending-signature', 'an unrelated no-delta selection save cannot clear an existing pending approval');
}

// A recognised requirement is not a verified target; trade sections are found, never created.
{
  const wb = workbook({ 'APPLIANCES & WHITE GOODS': section([]) });
  const proposedLine = resolveQuotationTarget({ workbook: wb, identity: ident('oven') });
  assert.equal(proposedLine.status, TARGET_STATUS.VERIFIED_NEW_ROW);
  assert.equal(proposedLine.requirementStatus, 'REQUIREMENT_RECOGNISED');
  assert.equal(proposedLine.resolutionStatus, 'TARGET_MISSING', 'a planned row is not resolved until it exists in the active quotation');
  const productBook = book(selectionRow('oven', { productId: 'oven-product', productName: 'Built-in oven', selectedPrice: 110, priceIncludesGst: true }));
  const productWorkbook = workbook({ 'APPLIANCES & WHITE GOODS': section([]) }, { clientSelectionsBook: productBook });
  const productPlan = reconcileSelectionTargets({ workbook: productWorkbook, book: productBook });
  const productIdentity = productPlan.results[0].identity;
  const productTarget = productPlan.results[0].target;
  const unconfirmedProduct = applyResolvedSelectionTargets(productWorkbook, productPlan);
  assert.equal(unconfirmedProduct.workbook.quotation['APPLIANCES & WHITE GOODS'].rows.length, 0, 'a priced new quote row is not added without explicit per-selection approval');
  assert.equal(unconfirmedProduct.applied.length, 0);
  const confirmedProduct = applyResolvedSelectionTargets(productWorkbook, productPlan, { confirmed: { [productIdentity.key]: productTarget.rowId } });
  assert(confirmedProduct.workbook.quotation['APPLIANCES & WHITE GOODS'].rows.some(row => row.id === productTarget.rowId), 'an explicitly selected new row can be added');
  assert.equal(confirmedProduct.applied[0].action, 'ADDED_ROW');
  const unpriced = resolveQuotationTarget({ workbook: wb, identity: ident('oven', { selectedPrice: null, priceStatus: 'quote_required' }) });
  assert(unpriced.resolutionStatuses.includes('PRICE_REQUIRED'), 'known destination still reports an unpriced selection separately');
  const none = resolveQuotationTarget({ workbook: workbook({}), identity: ident('oven') });
  assert.equal(none.reason, REVIEW_REASON.TRADE_SECTION_MISSING);
  assert.equal(none.requirementStatus, 'REQUIREMENT_RECOGNISED');
  assert.equal(none.resolutionStatus, 'TARGET_MISSING', 'a known trade is not reported as a mapped quotation target');
  const noQuantity = resolveQuotationTarget({ workbook: wb, identity: ident('oven', { quantity: null }) });
  assert.equal(noQuantity.resolutionStatus, 'QUANTITY_REQUIRED');
  assert(noQuantity.resolutionStatuses.includes('TARGET_MISSING'));
  assert(noQuantity.resolutionStatuses.includes('QUANTITY_REQUIRED'));
  const ambiguous = resolveQuotationTarget({ workbook: workbook({ 'GARAGE DOORS - SECTIONAL PANEL LIFT': section([]), 'GARAGE DOORS - MANUAL ROLL-A-DOOR': section([]) }), identity: ident('garage-door', { productName: 'Unknown door' }) });
  assert.equal(ambiguous.resolutionStatus, 'TARGET_AMBIGUOUS');
  assert(ambiguous.resolutionStatuses.includes('REQUIREMENT_RECOGNISED'));
  assert.equal(resolveQuotationTarget({ workbook: wb, identity: ident('not-a-requirement') }).reason, REVIEW_REASON.UNKNOWN_REQUIREMENT);
  assert.equal(resolveQuotationTarget({ workbook: wb, identity: ident('not-a-requirement') }).requirementStatus, 'REQUIREMENT_UNRECOGNISED');
  const doorId = 'master-INT-CORINTHIAN-DOORS-PMDF-HONEYCOMB-PRIMED-NONE';
  const doorBook = book(selectionRow('internal-doors', { productId: doorId, productName: 'Flush Interior PMDF', quantity: 1, unit: 'EACH' }));
  const doorWorkbook = workbook({ FIXOUT: section([
    { id: 'takeoff-door-quotation:internal-door:standard:720x2040', productIds: [doorId], item: '720 X 2040 FLUSH INTERIOR INTERNAL DOOR', qty: 8, unit: 'EACH', excelRate: 99, priceStatus: 'Current Price' },
    { id: 'takeoff-door-quotation:internal-door:standard:820x2040', productIds: [doorId], item: '820 X 2040 FLUSH INTERIOR INTERNAL DOOR', qty: 6, unit: 'EACH', excelRate: 99, priceStatus: 'Current Price' },
  ]) }, { clientSelectionsBook: doorBook });
  const doorTarget = resolveQuotationTarget({ workbook: doorWorkbook, identity: selectionIdentity(doorBook.rooms[0].rows[0], 'Kitchen') });
  assert.equal(doorTarget.status, TARGET_STATUS.VERIFIED_SCHEDULE_ROWS, 'measured internal-door rows with the exact product ID resolve as one schedule target');
  assert.equal(doorTarget.rowIds.length, 2, 'all existing measured door sizes remain associated without selecting one size');
  const evidenceOnlyDoorWorkbook = workbook({ FIXOUT: section([]) }, { clientSelectionsBook: doorBook });
  const evidenceOnlyPlan = planSelectionReconciliation({
    workbook: evidenceOnlyDoorWorkbook,
    quotationEvidence: doorWorkbook.quotation,
    productById: () => null,
  });
  assert.equal(evidenceOnlyPlan.targetResults.find((result) => result.requirementKey === 'internal-doors')?.status, 'TARGET_RESOLVED', 'calculated takeoff rows are valid target evidence after browser hydration');
  assert.equal(Object.values(evidenceOnlyPlan.workbook.quotation).flatMap((group) => group.rows || []).filter((row) => String(row.id || '').startsWith('takeoff-door-quotation:')).length, 0, 'calculated takeoff rows remain preview-only and are not persisted by reconciliation');
  const before = JSON.stringify(wb);
  applyResolvedSelectionTargets({ ...wb, clientSelectionsBook: book(selectionRow('garage-door')) });
  assert.equal(JSON.stringify(wb), before);
  console.log('PASS recognised requirement without a trade section is REVIEW_REQUIRED; no section is created');
}

// Existing trade sections by canonical trade identity, not obsolete names.
{
  const wb = workbook({ 'GARAGE DOORS - SECTIONAL PANEL LIFT (74)': section([]), 'GARAGE DOORS - MANUAL ROLL-A-DOOR (75)': section([]), 'CONCRETE AND LANDSCAPING': section([]), 'EXTERNAL CLADDING (55)': section([]), 'ROOFING MATERIALS (53)': section([]),
    'FIX OUT': section([]), 'DOOR FURNITURE (72)': section([]), CABINETRY: section([]), 'SHOWER SCREENS, MIRRORS & SLIDING DOORS': section([]), 'LIGHTFITTINGS (138)': section([]), 'CEILING FANS (139)': section([]) });
  const trade = (key, guided) => resolveTradeSection({ workbook: wb, identity: { requirementKey: key, ...ident(key, guided) } });
  assert.equal(trade('garage-door', { productName: 'Standard sectional door' }).section, 'GARAGE DOORS - SECTIONAL PANEL LIFT (74)');
  assert.equal(trade('garage-door', { productName: 'Unknown door' }).status, 'AMBIGUOUS', 'two garage door trades are never guessed');
  assert.equal(trade('driveway').section, 'CONCRETE AND LANDSCAPING');
  assert.equal(trade('cladding').section, 'EXTERNAL CLADDING (55)');
  assert.equal(trade('roofing').section, 'ROOFING MATERIALS (53)');
  assert.equal(trade('internal-doors').section, 'FIX OUT');
  assert.equal(trade('door-hardware').section, 'DOOR FURNITURE (72)');
  assert.equal(trade('robes', { productName: 'Wardrobe shelf unit' }).section, 'CABINETRY');
  assert.equal(trade('robes', { productName: 'Mirror sliding robe doors' }).section, 'SHOWER SCREENS, MIRRORS & SLIDING DOORS');
  assert.equal(trade('interior-lighting').section, 'LIGHTFITTINGS (138)');
  assert.equal(trade('ceiling-fan').section, 'CEILING FANS (139)');
  const configured = resolveTradeSection({ workbook: { ...wb, builderTradeSections: { driveway: 'FIX OUT' } }, identity: { requirementKey: 'driveway' } });
  assert.equal(configured.source, 'builder-template-config');
  assert.equal(resolveTradeSection({ workbook: workbook({ ROOFING: section([]) }), identity: { requirementKey: 'garage-door' } }).status, 'MISSING');
  console.log('PASS trade sections resolve by canonical trade identity and builder configuration; missing trades are reported');
}

// Quantity ownership, GST and price.
{
  const wb = workbook({ 'APPLIANCES & WHITE GOODS': section([]) });
  assert.equal(resolveQuotationTarget({ workbook: wb, identity: ident('oven', { quantity: null }) }).reason, REVIEW_REASON.QUANTITY_REQUIRED);
  assert.deepEqual(resolvedBaseRate({ unitPrice: 110, priceIncludesGst: null }), { rate: null, status: 'Price basis to confirm', gst: 'UNCONFIRMED' });
  assert.equal(resolvedBaseRate({ unitPrice: 110, priceIncludesGst: true }).rate, 100);
  assert.equal(resolvedBaseRate({ unitPrice: 3298, pricePending: true, priceIncludesGst: true }).status, 'Price pending');
  // Option rows: the selection supplies the product, the row's measured / manual quantity is never replaced.
  const cladding = workbook({ 'EXTERNAL CLADDING (55)': section([{ id: 'quote-1', item: '180mm LINEA BOARD', qty: 212.4, unit: 'M2', quantityKey: 'claddingArea', manualRate: '41', excelRate: 38 }]) });
  const identity = ident('cladding', { productName: '180mm Linea Board', model: '180mm Linea', quantity: 1, unit: 'EACH' });
  const target = resolveQuotationTarget({ workbook: cladding, identity });
  assert.equal(target.status, TARGET_STATUS.PROPOSED_MAPPING);
  assert.equal(target.candidates[0].rowId, 'quote-1');
  const plan = reconcileSelectionTargets({ workbook: { ...cladding, clientSelectionsBook: book(selectionRow('cladding', { productName: '180mm Linea Board', model: '180mm Linea' })) } });
  assert.equal(applyResolvedSelectionTargets(cladding, plan).applied.length, 0, 'a proposal is not applied without confirmation');
  const confirmed = applyResolvedSelectionTargets({ ...cladding, clientSelectionsBook: book() }, plan, { confirmed: { [identity.key]: 'quote-1' } });
  const row = confirmed.workbook.quotation['EXTERNAL CLADDING (55)'].rows[0];
  assert.equal(row.qty, 212.4); assert.equal(row.quantityKey, 'claddingArea'); assert.equal(row.manualRate, '41');
  assert.equal(row.selectedProductId, 'p-cladding'); assert.equal(row.selectionManualOverrideRetained, true); assert.equal(confirmed.workbook.quoteTargetMappings.length, 1);
  const again = reconcileSelectionTargets({ workbook: confirmed.workbook, book: plan && book(selectionRow('cladding', { productName: '180mm Linea Board', model: '180mm Linea' })) });
  assert.equal(again.results[0].target.status, TARGET_STATUS.VERIFIED_EXISTING_ROW, 'a confirmed mapping is remembered and not re-applied');
  const pendingIdentity = ident('cladding', { productId: 'p-cladding', productName: '180mm Linea Board', model: '180mm Linea', selectedPrice: null, priceIncludesGst: null, priceStatus: 'quote_required' });
  const pendingBook = book(selectionRow('cladding', { productId: 'p-cladding', productName: '180mm Linea Board', model: '180mm Linea', selectedPrice: null, priceIncludesGst: null, priceStatus: 'quote_required' }));
  const pendingWorkbook = workbook({ 'EXTERNAL CLADDING (55)': section([{ id: 'pending-linea', item: '180mm LINEA BOARD', qty: 212.4, quantity: 212.4, unit: 'M2', quantityKey: 'claddingArea', excelRate: '$38.00', manualRate: '' }]) }, { clientSelectionsBook: pendingBook });
  const pendingBefore = calculateEstimateBuilderWorkbook(structuredClone(pendingWorkbook)).summary.finalQuoteTotal;
  const pendingPlan = reconcileSelectionTargets({ workbook: pendingWorkbook, book: pendingBook });
  const pendingTarget = pendingPlan.results.find(entry => entry.identity.key === pendingIdentity.key)?.target;
  const pendingApplied = applyResolvedSelectionTargets(pendingWorkbook, pendingPlan, { confirmed: { [pendingIdentity.key]: pendingTarget.recommended.rowId } });
  const pendingRow = pendingApplied.workbook.quotation['EXTERNAL CLADDING (55)'].rows[0];
  assert.deepEqual([pendingRow.qty, pendingRow.quantity, pendingRow.excelRate, pendingRow.manualRate], [212.4, 212.4, '$38.00', ''], 'pending supplier data preserves the existing quoted amount and measured quantity');
  assert.equal(pendingRow.selectionPricePending, true);
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(pendingApplied.workbook)).summary.finalQuoteTotal, pendingBefore, 'a pending selection link cannot change the existing quote total');
  console.log('PASS option rows keep measured quantity and manual rate; proposals need confirmation; confirmed mapping persists');
}

// Exact or unique existing-row recommendations may link selection identity without changing charge or quantity.
{
  const claddingRow = { id: 'quote-180', item: '180mm LINEA BOARD', qty: 12, quantity: 12, unit: 'M2', excelRate: '$38.00', quantityKey: 'claddingArea' };
  const claddingBook = book(selectionRow('cladding', { productId: 'master-CLADDING-JAMES-HARDIE-LINEA-180', productName: 'James Hardie 180mm Linea Board', selectedPrice: null, priceStatus: 'quote_required' }));
  const claddingWb = workbook({ 'EXTERNAL CLADDING (55)': section([claddingRow]) }, { jobId: 'exact-cladding-target', clientSelectionsBook: claddingBook });
  const claddingBefore = calculateEstimateBuilderWorkbook(structuredClone(claddingWb)).summary.finalQuoteTotal;
  const claddingPlan = planSelectionReconciliation({ workbook: claddingWb, book: claddingBook });
  const linkedCladding = claddingPlan.workbook.quotation['EXTERNAL CLADDING (55)'].rows.find(row => row.id === claddingRow.id);
  assert.equal(claddingPlan.automaticMappings.length, 1);
  assert.equal(linkedCladding.selectedProductId, 'master-CLADDING-JAMES-HARDIE-LINEA-180');
  assert.deepEqual([linkedCladding.qty, linkedCladding.quantity, linkedCladding.excelRate, linkedCladding.manualRate], [claddingRow.qty, claddingRow.quantity, claddingRow.excelRate, claddingRow.manualRate]);
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(claddingPlan.workbook)).summary.finalQuoteTotal, claddingBefore, 'exact pending-price mapping cannot change the existing quote total');

  const drivewayRow = { id: 'quote-driveway', item: 'EXPOSED AGG CONCRETE DRIVEWAY', qty: '', quantity: '', unit: 'M2', excelRate: '$160.00' };
  const drivewayBook = book(selectionRow('driveway', { productId: 'master-DRIVEWAY-GENERIC-EXPOSED-AGGREGATE', productName: 'Exposed aggregate driveway finish', quantity: 60, drivewayAreaM2: 60, selectedPrice: null, priceStatus: 'quote_required' }));
  const drivewayWb = workbook({ 'CONCRETE AND LANDSCAPING': section([drivewayRow]) }, { jobId: 'unique-driveway-target', clientSelectionsBook: drivewayBook });
  const drivewayBefore = calculateEstimateBuilderWorkbook(structuredClone(drivewayWb)).summary.finalQuoteTotal;
  const drivewayPlan = planSelectionReconciliation({ workbook: drivewayWb, book: drivewayBook });
  const linkedDriveway = drivewayPlan.workbook.quotation['CONCRETE AND LANDSCAPING'].rows.find(row => row.id === drivewayRow.id);
  assert.equal(linkedDriveway.selectedProductId, 'master-DRIVEWAY-GENERIC-EXPOSED-AGGREGATE');
  assert.deepEqual([linkedDriveway.qty, linkedDriveway.quantity, linkedDriveway.excelRate], [drivewayRow.qty, drivewayRow.quantity, drivewayRow.excelRate], 'the saved 60m2 selection does not overwrite an existing quote quantity without approval');
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(drivewayPlan.workbook)).summary.finalQuoteTotal, drivewayBefore, 'unique pending-price target link cannot add a charge');
}

// Mapping / tags / duplicates.
{
  const baseline = { id: 'quote-10', item: 'OVEN ALLOWANCE', qty: 1, baselineUnitPrice: 800, manualRate: '' };
  const wb = workbook({ 'APPLIANCES & WHITE GOODS': section([baseline]) });
  const identity = ident('oven');
  const mapping = { status: 'MAPPED', template_id: 'tpl-builder-a', workspace_id: ws, quote_section_id: 'APPLIANCES & WHITE GOODS', quote_row_id: 'quote-10', metadata: { requirementKey: 'oven' } };
  assert.equal(resolveQuotationTarget({ workbook: wb, identity, mappings: [mapping] }).status, TARGET_STATUS.VERIFIED_MAPPED_ROW);
  assert.equal(resolveQuotationTarget({ workbook: wb, identity, mappings: [{ ...mapping, quote_row_id: 'gone' }] }).reason, REVIEW_REASON.STALE_MAPPING);
  assert.equal(resolveQuotationTarget({ workbook: wb, identity, mappings: [{ ...mapping, template_id: 'other-builder' }] }).status, TARGET_STATUS.VERIFIED_NEW_ROW);
  const result = applyResolvedSelectionTargets(wb, reconcileSelectionTargets({ workbook: { ...wb, clientSelectionsBook: book(selectionRow('oven')) }, mappings: [mapping] }));
  const row = result.workbook.quotation['APPLIANCES & WHITE GOODS'].rows[0];
  assert.equal(row.qty, 1); assert.equal(row.baselineUnitPrice, null); assert.equal(row.unverifiedBaseline.unitPrice, 800); assert.equal(row.variationUnitDifference, null, 'a quote rate is not an approved inclusion baseline');
  assert.equal(row.variationBasis.status, 'BASELINE_UNVERIFIED');
  const verifiedWb = workbook({ 'APPLIANCES & WHITE GOODS': section([{ ...baseline, selectionBaselineApplied: true }]) });
  const verified = applyResolvedSelectionTargets(verifiedWb, reconcileSelectionTargets({ workbook: { ...verifiedWb, clientSelectionsBook: book(selectionRow('oven')) }, mappings: [mapping] })).workbook.quotation['APPLIANCES & WHITE GOODS'].rows[0];
  assert.equal(verified.selectionStatus, 'DOWNGRADE'); assert.equal(verified.variationUnitDifference, -700);
  // Reusable builder mapping: applies to another job of the same template, is snapshotted into the job, and job mappings win.
  const otherJob = workbook({ 'APPLIANCES & WHITE GOODS': section([{ ...baseline, id: 'quote-10' }]) }, { clientSelectionsBook: book(selectionRow('oven')) });
  const reused = applyResolvedSelectionTargets(otherJob, reconcileSelectionTargets({ workbook: otherJob, mappings: [{ ...mapping, id: 'b1', version: 3 }] }));
  assert.equal(reused.workbook.quoteTargetMappings[0].metadata.snapshotOf, 'builder-template-mapping');
  assert.equal(reused.workbook.quoteTargetMappings[0].metadata.builderMappingVersion, 3);
  const changed = reconcileSelectionTargets({ workbook: { ...reused.workbook, quotation: { ...reused.workbook.quotation } }, mappings: [{ ...mapping, quote_row_id: 'quote-99', version: 4 }] });
  assert.equal(changed.results[0].target.status === 'REVIEW_REQUIRED', false, 'the job keeps its own snapshot when the builder later changes the template mapping');
  const otherBuilder = workbook({ 'APPLIANCES & WHITE GOODS': section([baseline]) }, { workspaceId: 'ws-2', clientSelectionsBook: book(selectionRow('oven')) });
  assert.notEqual(reconcileSelectionTargets({ workbook: otherBuilder, mappings: [mapping] }).results[0].target.status, TARGET_STATUS.VERIFIED_MAPPED_ROW, 'another builder never inherits this builder\'s mapping');
  const existing = { id: 'allocated-selection:oven:p-oven', source: 'client-selections-allocated-product', productId: 'p-oven' };
  assert.equal(resolveQuotationTarget({ workbook: workbook({ 'APPLIANCES & WHITE GOODS': section([existing]) }), identity }).status, TARGET_STATUS.VERIFIED_EXISTING_ROW);
  assert.equal(resolveQuotationTarget({ workbook: workbook({ 'APPLIANCES & WHITE GOODS': section([{ ...existing, id: 'allocated-selection:oven:other', productId: 'other' }]) }), identity }).reason, REVIEW_REASON.CONFLICTING_PRODUCT_ON_ROW);
  console.log('PASS builder mapping resolves with baseline kept; foreign/stale mappings untrusted; existing products never charged twice');
}

// New standalone rows: existing trade section, idempotent, no variation, unconfirmed GST flagged.
{
  const manual = { id: 'quote-5', item: 'PATIO CEILING', qty: 37.13, manualRate: '12.5', quantityManualOverride: true };
  const wb = workbook({ 'LIGHTFITTINGS (138)': section([manual]), 'CEILING FANS (139)': section([]) }, { clientSelectionsBook: book(selectionRow('interior-lighting', { priceIncludesGst: null, quantity: 56 }), selectionRow('ceiling-fan', { quantity: 17, priceIncludesGst: true })) });
  const first = applyResolvedSelectionTargets(wb);
  assert.deepEqual(first.applied, [], 'fixture schedules cannot fall through to aggregate standalone quote lines');
  const lights = first.workbook.quotation['LIGHTFITTINGS (138)'].rows;
  assert.deepEqual(lights[0], manual); assert.equal(lights[0].qty, 37.13);
  assert.equal(lights.some((row) => row.requirementKey === 'interior-lighting' || row.requirementKey === 'ceiling-fan'), false);
  const fixtureReview = reconcileSelectionTargets({ workbook: wb });
  assert(fixtureReview.results.filter(({ identity }) => ['interior-lighting', 'ceiling-fan'].includes(identity.requirementKey)).every(({ target }) => target.status === TARGET_STATUS.REVIEW_REQUIRED), 'unmapped fixture schedules require reconciliation');
  assert.equal(lights.some((row) => row.lineType === 'Heading'), false, 'no selection heading is created before fixture rows are mapped');
  assert.equal(Object.keys(first.workbook.quotation).length, 2, 'no section was created');
  const second = applyResolvedSelectionTargets(first.workbook);
  assert.deepEqual(second.applied, []); assert.equal(second.workbook, first.workbook);
  console.log('PASS unmapped fixture selections remain held and do not create duplicate quote rows');
}

// The ordinary Client Selections save plans connectors before persistence; duplicate managed
// allocations must fail before a workbook with repeated quote/procurement identities is returned.
{
  const line = { lineId: "duplicate-sink", productId: "duplicate-sink", productCode: "SINK-DUP", productName: "Duplicate Sink", supplier: "Test Supplier", unit: "EACH", unitPrice: 110, unitAllowance: 80, priceIncludesGst: true, allocations: [{ location: "Kitchen", quantity: 1 }] };
  const selection = (id, requirementKey = "sink", allocation = line.allocations[0]) => ({ id, guidedSelection: { ...selectionRow(requirementKey).guidedSelection, productId: line.productId, productName: line.productName, plumbingAllocation: { lines: [{ ...line, allocations: [allocation] }] } } });
  const duplicateBook = { rooms: [{ id: "kitchen-a", name: "Kitchen", rows: [selection("selection-a")] }, { id: "kitchen-b", name: "Kitchen", rows: [selection("selection-b")] }] };
  assert.throws(() => planSelectionReconciliation({ workbook: workbook({ "PLUMBING FIT OFF": section([]) }), book: duplicateBook }), error => error.code === "ALLOCATED_SELECTION_CONFLICT", "ordinary save planner blocks duplicate allocations before persistence");
  const priceConflictBook = { rooms: [
    { id: "kitchen", name: "Kitchen", rows: [selection("selection-current", "sink-mixer", { location: "Kitchen", quantity: 1 })] },
    { id: "laundry", name: "Laundry", rows: [selection("selection-conflict", "sink-mixer", { location: "Laundry", quantity: 1 })] },
  ] };
  priceConflictBook.rooms[1].rows[0].guidedSelection.plumbingAllocation.lines[0].unitPrice = 111;
  priceConflictBook.rooms[1].rows[0].guidedSelection.plumbingAllocation.lines[0].lineId = "alternate-sink-mixer-line";
  assert.throws(() => planSelectionReconciliation({ workbook: workbook({ "PLUMBING FIT OFF - CLIENT SELECTIONS": section([]) }), book: priceConflictBook }), error => error.code === "ALLOCATED_SELECTION_CONFLICT", "conflicting prices cannot be silently combined across locations");

  const compatibleBook = { rooms: [
    { id: "kitchen", name: "Kitchen", rows: [selection("selection-kitchen", "sink-mixer", { location: "Kitchen", quantity: 1 })] },
    { id: "laundry", name: "Laundry", rows: [selection("selection-laundry", "sink-mixer", { location: "Laundry", quantity: 2 })] },
  ] };
  const compatible = planSelectionReconciliation({ workbook: workbook({ "PLUMBING FIT OFF - CLIENT SELECTIONS": section([]) }), book: compatibleBook });
  const managedRowId = "allocated-selection:sink-mixer:duplicate-sink";
  const managedRows = Object.values(compatible.workbook.quotation).flatMap(group => group.rows || []).filter(row => row.id === managedRowId);
  assert.equal(managedRows.length, 1, "compatible allocations make one managed quotation row");
  assert.equal(managedRows[0].qty, 3, "compatible allocation quantities are summed");
  assert.deepEqual(managedRows[0].locationSchedule, [{ location: "Kitchen", quantity: 1 }, { location: "Laundry", quantity: 2 }], "the combined quote retains location traceability");
  assert.equal(compatible.workbook.procurement.items.filter(item => item.id === managedRowId).length, 1, "compatible allocations make one procurement requirement");
  assert.equal(compatible.duplicates.length, 0, "one aggregated row claimed by its own locations is not a duplicate charge");

  const duplicateTargetBook = { rooms: [
    { id: "kitchen", name: "Kitchen", rows: [{ guidedSelection: { ...selectionRow("sink-mixer").guidedSelection, productId: "duplicate-sink" } }] },
    { id: "laundry", name: "Laundry", rows: [{ guidedSelection: { ...selectionRow("sink-mixer").guidedSelection, productId: "duplicate-sink" } }] },
  ] };
  const duplicateTarget = planSelectionReconciliation({ workbook: workbook({ "PLUMBING FIT OFF": section([{ id: "manual-sink-row", requirementKey: "sink-mixer", productId: "duplicate-sink", qty: 1 }]) }), book: duplicateTargetBook });
  assert.equal(duplicateTarget.duplicates.length, 1, "two location selections claiming a non-aggregated quote row are blocked at ordinary save");
}

// A replaced allocated product compares a confirmed inclusive price on an ex-GST basis and
// retains the original variation as history without posting an unapproved variation.
{
  const selectedLine = { lineId: "shared-sink", productId: "new-sink", productCode: "NEW-SINK", productName: "New Sink", supplier: "Test Supplier", unit: "EACH", unitPrice: 121, unitAllowance: 100, priceIncludesGst: true, allocations: [{ locationKey: "kitchen", location: "Kitchen", quantity: 1 }] };
  const selectionBook = book(selectionRow("sink", { productId: "new-sink", productName: "New Sink", plumbingAllocation: { lines: [selectedLine] } }));
  const before = workbook({ "PLUMBING FIT OFF - CLIENT SELECTIONS": section([{
    id: "allocated-selection:sink:shared-sink", source: "client-selections-allocated-product", productId: "old-sink", productName: "Original Sink",
    item: "Sinks / Original Sink", unit: "EACH", qty: 1, quantity: 1, excelRate: 100, allowancePerUnit: 100, allowanceTotal: 100,
    variation: 23, historicalVariation: 23, manualRate: "", productLibrarySnapshot: { unitPrice: 110, priceIncludesGst: false },
  }]) }, { jobId: "gst-replacement-test", clientSelectionsBook: selectionBook });
  const beforeTotal = calculateEstimateBuilderWorkbook(structuredClone(before)).summary.finalQuoteTotal;
  const plan = planSelectionReconciliation({ workbook: before, book: selectionBook });
  assert.equal(plan.replacements.length, 1);
  assert.equal(plan.replacements[0].to.rateExGst, 110, "inclusive selected price is converted before comparison");
  assert.equal(plan.replacements[0].proposedVariation, 10, "inclusive selected price is compared to the ex-GST baseline");
  const row = Object.values(plan.workbook.quotation).flatMap(group => group.rows || []).find(item => item.id === "allocated-selection:sink:shared-sink");
  assert.equal(row.variation, null, "proposed variation remains blocked until baseline approval");
  assert.equal(row.activeUnitPrice, 100, "the existing quoted rate remains active until replacement approval");
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(plan.workbook)).summary.finalQuoteTotal, beforeTotal, "an unapproved replacement cannot change the quotation total");
  assert.equal(row.historicalVariation, 23, "the original variation remains available for reference");
  const approved = planSelectionReconciliation({ workbook: before, book: selectionBook, approvedBaselines: { "allocated-selection:sink:shared-sink": true } });
  const approvedRow = Object.values(approved.workbook.quotation).flatMap(group => group.rows || []).find(item => item.id === "allocated-selection:sink:shared-sink");
  assert.equal(approvedRow.variation, 10, "approved replacement posts only the verified ex-GST variation");
  const exclusiveLine = { ...selectedLine, unitPrice: 110, priceIncludesGst: false };
  const exclusiveBook = book(selectionRow("sink", { productId: "new-sink", productName: "New Sink", plumbingAllocation: { lines: [exclusiveLine] } }));
  const exclusive = planSelectionReconciliation({ workbook: before, book: exclusiveBook, approvedBaselines: { "allocated-selection:sink:shared-sink": true } });
  assert.equal(exclusive.replacements[0].proposedVariation, 10, "exclusive selected price stays on the ex-GST baseline basis");
  assert.equal(Object.values(exclusive.workbook.quotation).flatMap(group => group.rows || []).find(item => item.id === "allocated-selection:sink:shared-sink").variation, 10, "approved ex-GST replacement amount is retained");
  const unconfirmed = planSelectionReconciliation({ workbook: before, book: book(selectionRow("sink", { productId: "new-sink", productName: "New Sink", plumbingAllocation: { lines: [{ ...selectedLine, priceIncludesGst: null }] } })) });
  assert.equal(unconfirmed.replacements[0].proposedVariation, null, "an unknown GST basis never creates a calculated variation");
}

// Exact bathroom-accessory room aliases replace one managed row, preserve its current quote, and wait for baseline approval.
{
  const accessorySpecs = [
    { requirement: "towel-rail", prior: "master-PLB-HNC-129801000", product: "master-PLB-HNC-NE0381241", name: "Linfa 600mm Single Towel Rail", price: 159, allowance: 147.16, priorRate: 214.5455, priorAllowance: 203.71 },
    { requirement: "hand-towel", prior: "master-PLB-HNC-RA893CHR", product: "master-PLB-HNC-NE03541", name: "Linfa Towel Ring", price: 135, allowance: 124.94, priorRate: 54.5455, priorAllowance: 51.79 },
    { requirement: "toilet-roll-holder", prior: "master-PLB-HNC-129820000", product: "master-PLB-HNC-NE03641", name: "Linfa Toilet Roll Holder", price: 100, allowance: 92.55, priorRate: 112.7273, priorAllowance: 107.03 },
    { requirement: "robe-hook", prior: "master-PLB-HNC-129840000", product: "master-PLB-HNC-NE02141", name: "L'Hotel Robe Hook", price: 49, allowance: 45.35, priorRate: 50, priorAllowance: 47.47 },
  ];
  const rooms = [{ id: "bathroom-accessories", name: "Bathroom Accessories", rows: accessorySpecs.map((spec) => ({
    id: `selection-${spec.requirement}`,
    guidedSelection: {
      requirementKey: spec.requirement,
      plumbingAllocation: { lines: [{
        lineId: `pack:bathroom-accessory-pack:${spec.requirement}`,
        productId: spec.product,
        productName: spec.name,
        supplier: "Harvey Norman Commercial",
        unit: "EACH",
        unitPrice: spec.price,
        unitAllowance: spec.allowance,
        priceIncludesGst: true,
        priceBasis: "Harvey Norman Commercial SRP inc GST",
        quantity: 4,
        allocations: [
          { location: "Main Bathroom", quantity: 1 },
          { location: "Ensuite", quantity: 1 },
          { location: "2nd BEDROOM ENSUITE", quantity: 1 },
          { location: "B2 Ensuite", quantity: 1 },
        ],
      }] },
    },
  })) }];
  const oldLocations = [
    { location: "Main Bathroom", quantity: 1 },
    { location: "Ensuite", quantity: 1 },
    { location: "2nd BEDROOM ENSUITE", quantity: 1 },
  ];
  const oldRows = accessorySpecs.map((spec) => ({
    id: `allocated-selection:${spec.requirement}:pack:bathroom-accessory-pack:${spec.requirement}`,
    source: "client-selections-allocated-product",
    productId: spec.prior,
    productName: "Existing included accessory",
    item: "Existing bathroom accessory",
    unit: "EACH",
    qty: 3,
    quantity: 3,
    excelRate: spec.priorRate,
    manualRate: spec.requirement === "hand-towel" ? "$54.55" : "",
    allowancePerUnit: spec.priorAllowance,
    allowanceTotal: spec.priorAllowance * 3,
    variation: 0,
    variationBasis: { status: "BASELINE_UNVERIFIED" },
    locationSchedule: oldLocations,
  }));
  const source = workbook({ "FIX OUT": section(oldRows) }, {
    jobId: "accessory-alias-replacement-test",
    clientSelectionsBook: { rooms },
    procurement: { items: accessorySpecs.map((spec) => ({
      id: `allocated-selection:${spec.requirement}:pack:bathroom-accessory-pack:${spec.requirement}`,
      source: "client-selections-allocated-product",
      productId: spec.prior,
      qty: 3,
      unit: "EACH",
      locationSchedule: oldLocations,
      orderStatus: "not_started",
    })) },
  });
  const beforeTotal = calculateEstimateBuilderWorkbook(structuredClone(source)).summary.finalQuoteTotal;
  const first = planSelectionReconciliation({ workbook: structuredClone(source) });
  const second = planSelectionReconciliation({ workbook: structuredClone(first.workbook) });
  assert.equal(first.replacements.length, 4);
  assert.equal(first.changes.filter((change) => change.kind === "ADDED" || change.kind === "REMOVED").length, 0, "replacement reuses existing quote rows");
  assert.equal(second.changes.length, 0, "alias replacement is idempotent after reopening the job");
  const afterRows = Object.values(first.workbook.quotation).flatMap((group) => group.rows || []);
  for (const spec of accessorySpecs) {
    const id = `allocated-selection:${spec.requirement}:pack:bathroom-accessory-pack:${spec.requirement}`;
    const row = afterRows.find((item) => item.id === id);
    assert.equal(row.productId, spec.product);
    assert.equal(row.qty, 3);
    assert.equal(row.excelRate, spec.priorRate, "unapproved replacement retains the existing quote rate");
    assert.equal(row.manualRate, spec.requirement === "hand-towel" ? "$54.55" : "", "manual overrides remain unchanged");
    assert.equal(row.variation, null, "no variation posts before baseline approval");
    assert.equal(row.retainedBaseline.productId, spec.prior);
    const procurement = first.workbook.procurement.items.find((item) => item.productId === spec.product);
    assert.equal(procurement.qty, 3);
    assert.equal(procurement.locationSchedule.length, 3);
    assert.equal(procurement.estimatedRate, Math.round((spec.price / 1.1) * 10000) / 10000);
    assert.equal(procurement.approvedForOrdering, false);
  }
  assert.equal(calculateEstimateBuilderWorkbook(structuredClone(first.workbook)).summary.finalQuoteTotal, beforeTotal, "unapproved alias replacements preserve the existing quotation total");
}

// Private tile selection prices remain frozen across catalogue updates and job reopen.
{
  const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const productRow = (price, gstIncluded) => ({
    id: productId, workspace_id: ws, sku: "PRIVATE-TILE-1", product_name: "Builder private floor tile", unit: "M2",
    upgrade_cost: price, base_allowance: 80, active: true,
    metadata: { productEntity: { familyKey: "floor-tiles", category: "Floor Tiles", gstIncluded, priceStatus: "verified" } },
  });
  const storage = new Map();
  setCatalogueStorage({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  hydrateBuilderCatalogue(ws, { products: [productRow(121, true)] });
  const products = () => getEffectiveProductCatalogue({ organisationId: ws, includeDisabled: true }).products;
  const productById = id => products().find(product => product.productId === id) || null;
  assert.equal(productById(productId).clientPrice, 121, "private imported product resolves by UUID in its workspace");
  assert(!getEffectiveProductCatalogue({ organisationId: "ws-2", includeDisabled: true }).products.some(product => product.productId === productId), "another builder cannot resolve the private product");

  const savedSelection = { rooms: [{ id: "kitchen", name: "Kitchen", rows: [{ guidedSelection: { requirementKey: "tiling-rooms", tilingRooms: [{ id: "tile-room", products: { floor: productId }, productSnapshots: { floor: { productId, productName: "Builder private floor tile", clientPrice: 100, gstIncluded: false } } }] } }] }] };
  const foundation = { workspace_id: ws, aliases: [], configurations: [{ workspace_id: ws, selection_slot_id: "floor_tile", enabled: true, allow_room_override: true }], mappings: [{ workspace_id: ws, selection_slot_id: "floor_tile", template_id: "tpl-builder-a", status: "MAPPED", quote_section_id: "TILES", quote_row_id: "tile-option", metadata: { locationTargets: [{ sectionId: "TILES", rowId: "tile-option", locationId: "tile-room" }] } }] };
  const original = workbook({ TILES: section([{ id: "tile-option", selectionSlotId: "floor_tile", locationId: "tile-room", qty: 12, unit: "M2", excelRate: 90, manualRate: "" }]) });
  const first = connectTenantSelectionMetadata(original, savedSelection, foundation, { productById });
  const firstRow = first.quotation.TILES.rows[0];
  assert.equal(firstRow.activeProductId, productId, "private product identity reaches the mapped quotation row");
  assert.equal(firstRow.activeUnitPrice, 100, "quotation uses the selection's saved price snapshot, not the live catalogue price");
  assert.equal(firstRow.selectionPricePending, false);

  hydrateBuilderCatalogue(ws, { products: [productRow(150, true)] });
  const reopened = JSON.parse(JSON.stringify(first));
  const savedBook = JSON.parse(JSON.stringify(savedSelection));
  const second = connectTenantSelectionMetadata(reopened, savedBook, foundation, { productById });
  assert.equal(second.quotation.TILES.rows[0].activeProductId, productId, "private identity survives save/reopen");
  assert.equal(second.quotation.TILES.rows[0].activeUnitPrice, 100, "catalogue price changes do not silently reprice the approved selection snapshot");
  assert.equal(savedBook.rooms[0].rows[0].guidedSelection.tilingRooms[0].productSnapshots.floor.gstIncluded, false, "exclusive GST basis remains in the saved selection snapshot");
  assert.equal(savedBook.rooms[0].rows[0].guidedSelection.tilingRooms[0].productSnapshots.floor.clientPrice, 100, "saved selected price remains unchanged after catalogue edits");
}

// One selected requirement must not change an unrelated quotation section.
{
  const unrelated = section([{ id: "manual-electrical", item: "Electrical allowance", qty: 8, manualRate: "42.50", formulas: { B: "=2*4" } }]);
  const source = workbook(normalizeQuotationStructure({ "APPLIANCES & WHITE GOODS": section([]), ELECTRICAL: unrelated }));
  const selection = book(selectionRow("oven", { productId: "private-oven", quantity: 1, selectedPrice: 110, priceIncludesGst: false }));
  const plan = planSelectionReconciliation({ workbook: source, book: selection });
  assert.deepEqual(plan.workbook.quotation.ELECTRICAL, source.quotation.ELECTRICAL, "unrelated quote sections remain unchanged after ordinary normalization");
}

// Whole workflow on an isolated copy of the recovered job (in memory only).
const copyPath = 'artifacts/test-artifacts/client-selections-repair-verification/job-copy.json';
if (fs.existsSync(copyPath)) {
  const find = (o, depth = 0) => { if (!o || typeof o !== 'object' || depth > 4) return null; if (o.quotation && typeof o.quotation === 'object' && !Array.isArray(o.quotation)) return o; for (const v of Object.values(o)) { const r = find(v, depth + 1); if (r) return r; } return null; };
  const original = find(JSON.parse(fs.readFileSync(copyPath)));
  const originalFingerprint = JSON.stringify(original.quotation).length;
  const index = new Map(getMasterProducts().map((p) => [p.productId, p]));
  const productById = (id) => index.get(id) || null;
  const plan = planSelectionReconciliation({ workbook: original, productById });
  assert.equal(JSON.stringify(original.quotation).length, originalFingerprint, 'the source job is never mutated');
  assert.equal(plan.totals.sectionsAfter, Object.keys(normalizeQuotationStructure(original.quotation)).length, 'reconciliation never adds or removes sections');
  assert.equal(plan.duplicates.length, 0);
  assert.equal(plan.replacements.length, 4);
  assert(plan.replacements.every((r) => r.baselineStatus === 'BASELINE_UNVERIFIED' && r.retainedBaseline.allowancePerUnit > 0));
  assert(plan.replacements.every((r) => r.to.priceIncludesGst === true && r.to.rateExGst === Math.round((r.to.unitIncGst / 1.1) * 10000) / 10000 && r.proposedVariation !== null), 'known inclusive prices are converted to ex-GST before proposing replacement variations');
  const replaced = plan.changes.filter((c) => c.kind === 'REPLACED');
  assert.equal(replaced.length, 4);
  const aliasChecks = plan.quantityChecks.filter((q) => q.status === 'DUPLICATE_LOCATION_ALIAS');
  assert.equal(aliasChecks.length, 0, 'the two numbered-ensuite aliases resolve before pack quantities are calculated');
  assert.equal(plan.quantityChecks.length, 0, 'canonical room identity prevents a false 3 -> 4 accessory increase');
  assert.equal(plan.blocking.length, 0, 'no quantity approval is needed for a duplicate room alias');
  assert.equal(locationFingerprint('2nd BEDROOM ENSUITE'), locationFingerprint('B2 Ensuite'));
  assert.notEqual(locationFingerprint('Main Bathroom'), locationFingerprint('Ensuite'));
  const rows = Object.values(plan.workbook.quotation).flatMap((g) => g.rows);
  for (const r of plan.replacements) assert.equal(rows.find((row) => row.id === r.rowId).variation, null, 'no variation until the baseline is approved');
  const managedRows = rows.filter((row) => row.source === 'client-selections-allocated-product' && row.productId);
  assert(managedRows.length > 20);
  assert(managedRows.every((row) => row.variation === null && row.variationBasis?.status === 'BASELINE_UNVERIFIED'), 'no client variation is posted without a verified baseline');
  assert(managedRows.some((row) => row.historicalVariation !== null && row.historicalVariation !== undefined), 'the original variation figure is kept for reference');
  // Quantity / manual ownership preserved.
  const originalRows = Object.values(original.quotation).flatMap((g) => g.rows);
  const patioBefore = originalRows.find((row) => /PATIO CEILING/i.test(row.item));
  const patio = patioBefore && rows.find((row) => row.id === patioBefore.id);
  if (patio) assert.deepEqual([patio.qty, patio.quantity, patio.manualRate, patio.formulas], [patioBefore.qty, patioBefore.quantity, patioBefore.manualRate, patioBefore.formulas], 'painter patio ceiling row is untouched');
  // Every manual rate and manual quantity in the source survives reconciliation.
  const afterById = new Map(rows.map((row) => [row.id, row]));
  for (const row of originalRows.filter((r) => String(r.manualRate ?? '').trim() || r.quantityManualOverride === true)) {
    const next = afterById.get(row.id);
    if (!next || next.productId !== row.productId) continue;
    if (next.progressAllocation) { assert.equal(next.progressAllocationHistory[0].value, row.manualRate, 'the superseded manual rate is recorded, not lost'); continue; }
    assert.equal(next.manualRate, row.manualRate, `${row.id} manual rate`);
    if (row.quantityManualOverride === true) assert.equal(next.qty, row.qty, `${row.id} manual quantity`);
  }
  for (const id of ['quote-1027', 'quote-30061']) {
    assert(rows.find((row) => row.id === id)?.selectedProductId, `${id} receives its deterministic, unambiguous existing-row identity`);
  }
  assert.equal(rows.filter((row) => row.source === 'client-selections-new-product').length, 0, 'deterministic existing-row links do not create duplicate quotation charges');
  // Preserve the already deterministic cladding target while approving one baseline.
  const claddingProductId = rows.find((row) => row.id === 'quote-1027').selectedProductId;
  const towel = plan.replacements.find((r) => r.requirementKey === 'towel-rail');
  const confirmedPlan = planSelectionReconciliation({ workbook: original, productById, approvedBaselines: { [towel.rowId]: true } });
  const confirmedRows = Object.values(confirmedPlan.workbook.quotation).flatMap((g) => g.rows);
  const linea = confirmedRows.find((row) => row.id === 'quote-1027');
  assert.equal(linea.selectedProductId, claddingProductId);
  assert.equal(linea.qty ?? linea.quantity ?? '', rows.find((row) => row.id === 'quote-1027').qty ?? rows.find((row) => row.id === 'quote-1027').quantity ?? '', 'cladding quantity stays with its owner');
  assert.equal(confirmedRows.find((row) => row.id === towel.rowId).variation, towel.proposedVariation);
  // Save / reopen equivalent: the very first completed pass must already be stable.
  const reopened = JSON.parse(JSON.stringify(confirmedPlan.workbook));
  const second = planSelectionReconciliation({ workbook: reopened, productById });
  assert.equal(second.changes.length, 0, `second pass changed ${second.changes.map((c) => c.rowId).join(', ')}`);
  const floorFraming = Object.values(second.workbook.quotation).flatMap((g) => g.rows).find((row) => row.quantityKey === 'quoteFloorSystemSecond300M2');
  const floorFramingBefore = originalRows.find((row) => row.quantityKey === 'quoteFloorSystemSecond300M2');
  assert.deepEqual([floorFraming.qty, floorFraming.quantityManualOverride, floorFraming.autoQuantity], [floorFramingBefore.qty, floorFramingBefore.quantityManualOverride, floorFramingBefore.autoQuantity], 'floor framing quantity is never consumed by carpet allocation');
  assert.equal(second.changes.filter((c) => c.kind === 'ADDED' || c.kind === 'REMOVED').length, 0, 'second reconcile adds or removes nothing');
  assert.equal(second.totals.rowsAfter, second.totals.rowsBefore);
  assert.equal(second.duplicates.length, 0);
  const secondRows = Object.values(second.workbook.quotation).flatMap((g) => g.rows);
  assert.equal(secondRows.find((row) => row.id === towel.rowId).variation, towel.proposedVariation, 'approved baseline survives re-reconcile');
  assert.equal(secondRows.find((row) => row.id === plan.replacements.find((r) => r.requirementKey === 'robe-hook').rowId).variation, null, 'unapproved baseline stays unverified after re-reconcile');
  // BOQ: new priced rows move the total only by their own line total.
  const before = calculateEstimateBuilderWorkbook(reopened);
  const after = calculateEstimateBuilderWorkbook(second.workbook);
  assert.equal(after.summary.baseLineItemSubtotal, before.summary.baseLineItemSubtotal);
  assert(Object.values(after.quotation).flatMap((g) => g.rows).filter((row) => row.requirementKey && row.quoteRequired && Number(row.qty) > 0).every((row) => shouldIncludeQuoteRowInFinalBoq(row) && quoteLineTotal(row) === 0));
  console.log(`PASS isolated job copy: ${plan.totals.sectionsBefore}->${plan.totals.sectionsAfter} sections, ${plan.totals.rowsBefore}->${plan.totals.rowsAfter} rows; 4 replacements retain baselines; reconcile is idempotent after reopen`);
}

// External lighting and exterior paint syncs (existing trade sections, schedule counts, no guessed prices).
{
  const { connectExternalLightingToQuotation } = await import('../lib/builders/externalLightingQuotation.js');
  const { linkExteriorPaintToQuotation } = await import('../lib/builders/exteriorPaintQuotation.js');
  const lighting = { rooms: [{ id: 'r', name: 'Exterior', rows: [{ id: 'x', guidedSelection: { requirementKey: 'external-lighting', lightingSchedule: [
    { sku: 'A1', productName: 'Wall light', quantity: 1, exactLocation: 'Front entry' }, { sku: 'A1', productName: 'Wall light', quantity: 2, exactLocation: 'Rear' }, { sku: 'B2', productName: 'Pendant', quantity: 1, exactLocation: 'Porch' }],
    procurementSchedule: [{ sku: 'A1', unitPrice: 87.2, supplier: 'Beacon' }, { sku: 'B2', unitPrice: 50, priceIncludesGst: true }] } }] }] };
  const wb = workbook({ 'LIGHTFITTINGS (138)': section([{ id: 'quote-1', item: 'WALL LIGHTS', qty: 5, manualRate: '9' }]), ELECTRICAL: section([]) });
  const synced = connectExternalLightingToQuotation(wb, lighting);
  const rows = synced.quotation['LIGHTFITTINGS (138)'].rows;
  assert.deepEqual(rows[0], wb.quotation['LIGHTFITTINGS (138)'].rows[0], 'existing rows and quantities are untouched');
  const a1 = rows.find((row) => row.id === 'external-lighting:A1'), b2 = rows.find((row) => row.id === 'external-lighting:B2');
  assert.equal(a1.qty, 3); assert.equal(a1.excelRate, ''); assert.equal(a1.priceStatus, 'Price basis to confirm'); assert.equal(b2.excelRate, 45.4545);
  assert.equal(Object.keys(synced.quotation).length, 2, 'no section created');
  const manual = { ...synced, quotation: { ...synced.quotation, 'LIGHTFITTINGS (138)': { ...synced.quotation['LIGHTFITTINGS (138)'], rows: rows.map((row) => row.id === 'external-lighting:A1' ? { ...row, manualRate: '80', quantityManualOverride: true, quantity: 4, qty: 4 } : row) } } };
  const again = connectExternalLightingToQuotation(manual, lighting);
  const kept = again.quotation['LIGHTFITTINGS (138)'].rows.find((row) => row.id === 'external-lighting:A1');
  assert.deepEqual([kept.manualRate, kept.qty], ['80', 4], 'manual rate and manual quantity win');
  assert.deepEqual(connectExternalLightingToQuotation(again, lighting).quotation, again.quotation, 'idempotent');
  assert.equal(connectExternalLightingToQuotation({ ...wb, quotation: { ROOFING: section([]) } }, lighting).externalLightingSyncReport.status === 'TRADE_SECTION_UNRESOLVED', true, 'a missing trade section is reported, not created');
  const resolved = reconcileSelectionTargets({ workbook: { ...synced, clientSelectionsBook: book(selectionRow('external-lighting', { productId: 'external-lighting-schedule', quantity: 4 })) } });
  assert.equal(resolved.results[0].target.status, TARGET_STATUS.VERIFIED_SCHEDULE_ROWS);
  const lightingProducts = new Map([
    ['A1', { productId: 'master-BEACON-EXT-A1', productName: 'Wall light', supplier: 'Beacon', clientPrice: 87.2, priceUnit: 'EACH', priceStatus: 'current', priceSource: 'supplier_price', gstIncluded: true }],
    ['B2', { productId: 'master-BEACON-EXT-B2', productName: 'Pendant', supplier: 'Beacon', clientPrice: 50, priceUnit: 'EACH', priceStatus: 'current', priceSource: 'supplier_price', gstIncluded: true }],
  ]);
  const verifiedLighting = connectExternalLightingToQuotation(wb, lighting, { productByCode: code => lightingProducts.get(code) || null });
  const verifiedA1 = verifiedLighting.quotation['LIGHTFITTINGS (138)'].rows.find(row => row.id === 'external-lighting:A1');
  const verifiedB2 = verifiedLighting.quotation['LIGHTFITTINGS (138)'].rows.find(row => row.id === 'external-lighting:B2');
  assert.equal(verifiedA1.productId, 'master-BEACON-EXT-A1');
  assert.equal(verifiedA1.excelRate, 79.2727, 'exact current supplier inclusive price converts to ex GST');
  assert.equal(verifiedB2.excelRate, 45.4545, 'a verified inclusive Product Library price fills a missing saved GST basis');
  const mismatchedLighting = structuredClone(lighting);
  mismatchedLighting.rooms[0].rows[0].guidedSelection.procurementSchedule[0].unitPrice = 90;
  const mismatchSync = connectExternalLightingToQuotation(wb, mismatchedLighting, { productByCode: code => lightingProducts.get(code) || null });
  const mismatchA1 = mismatchSync.quotation['LIGHTFITTINGS (138)'].rows.find(row => row.id === 'external-lighting:A1');
  assert.equal(mismatchA1.excelRate, '', 'a conflicting saved supplier price is never overwritten from the catalogue');
  assert.equal(mismatchA1.quoteRequired, true);

  const paintBook = { rooms: [{ id: 'r', name: 'Exterior', rows: [{ id: 'p', guidedSelection: { requirementKey: 'exterior-paint', status: 'confirmed', clientColourSchedule: [
    { areaId: 'walls', areaName: 'Main rendered walls', areaGroup: 'Walls', material: 'Render', supplier: 'Dulux', colourName: 'Dune' },
    { areaId: 'eaves', areaName: 'Eaves/soffits', areaGroup: 'Roofline', material: 'Fibre cement', supplier: 'Dulux', colourName: 'Surfmist' },
    { areaId: 'roof', areaName: 'Roof', areaGroup: 'Roofline', material: 'COLORBOND roofing', supplier: 'COLORBOND', colourName: 'Basalt' },
    { areaId: 'surrounds', areaName: 'Window surrounds', areaGroup: 'Openings and surrounds', material: 'Painted trim', supplier: 'Dulux', colourName: 'Monument' }] } }] }] };
  const painter = workbook({ 'PAINTER (146)': section([{ id: 'q1', item: 'EXTERIOR CLADDING LOWER LEVEL', qty: 120.5, unit: 'M2', manualRate: '40' }, { id: 'q2', item: 'EAVES', qty: 30, unit: 'LM' }, { id: 'q3', item: 'MISC PAINT WORK', qty: 5 }]) });
  const painted = linkExteriorPaintToQuotation(painter, paintBook);
  const paintRows = painted.quotation['PAINTER (146)'].rows;
  assert.equal(paintRows[0].qty, 120.5); assert.equal(paintRows[0].manualRate, '40'); assert.match(paintRows[0].selectionSpec, /Dune/); assert.match(paintRows[1].selectionSpec, /Surfmist/);
  assert.equal(paintRows[2].exteriorColourSpecification, undefined);
  assert.deepEqual(painted.exteriorPaintSyncReport.unlinked.map((entry) => [entry.areaId, entry.reason]), [['roof', 'FACTORY_FINISH_NOT_PAINTED'], ['surrounds', 'NO_PAINTER_ROW_FOR_AREA']]);
  assert.equal(linkExteriorPaintToQuotation(painted, paintBook), painted, 'idempotent');
  assert.equal(Object.keys(painted.quotation).length, 1);

  const fixtureLine = (productId, productName, quantity, allocations) => ({ lineId: productId, productId, productName, quantity, unit: 'EACH', unitPrice: 40, unitAllowance: 0, allocations });
  const fixtureBook = { rooms: [
    { name: 'Interior', rows: [{ guidedSelection: { requirementKey: 'interior-lighting', quantity: 56, unit: 'EACH', plumbingAllocation: { lines: [
      fixtureLine('downlight-product', 'Selected downlight', 53, [{ locationKey: 'bedroom-1', location: 'Bedroom 1', quantity: 4 }, { locationKey: 'bedroom-2', location: 'Bedroom 2', quantity: 49 }]),
      fixtureLine('pendant-product', 'Selected pendant', 3, [{ locationKey: 'kitchen', location: 'Kitchen', quantity: 3 }]),
    ] } } }] },
    { name: 'Lighting & Ceiling Fans', rows: [{ guidedSelection: { requirementKey: 'ceiling-fan', quantity: 18, unit: 'EACH', plumbingAllocation: { lines: [
      fixtureLine('fan-a', 'Fan A', 7, [{ locationKey: 'upstairs', location: 'Upstairs', quantity: 7 }]),
      fixtureLine('fan-b', 'Fan B', 2, [{ locationKey: 'alfresco', location: 'Alfresco', quantity: 2 }]),
      fixtureLine('fan-c', 'Fan C', 9, [{ locationKey: 'bedrooms', location: 'Bedrooms', quantity: 9 }]),
    ] } } }] },
  ] };
  const fixtureWorkbook = workbook({ ELECTRICAL: section([
    { id: 'downlights', item: 'SUPPLY AND INSTALL DOWNLIGHTS', qty: 55, quantity: 55, unit: 'EACH', excelRate: 12, manualRate: '$85.00', materialRate: 12, quantityManualOverride: true },
    { id: 'pendants', item: 'MISC LIGHT FITTINGS', qty: '', quantity: '', unit: 'EACH', excelRate: 30, manualRate: '', materialRate: 0 },
    { id: 'fans', item: 'CEILING FAN AND INSTALL', qty: 8, quantity: 8, unit: 'EACH', excelRate: 55, manualRate: '', materialRate: 50, quantityManualOverride: true },
    { id: 'fan-light', item: 'CEILING FAN AND LIGHT AND INSTALL', qty: '', quantity: '', unit: 'EACH', excelRate: 75, manualRate: '', materialRate: 65 },
  ]) }, { clientSelectionsBook: fixtureBook });
  const targetFor = (requirementKey, productId, rowId) => ({ [`${requirementKey}|${productId}`]: { rowId, section: 'ELECTRICAL' } });
  const fixtureTargets = {
    ...targetFor('interior-lighting', 'downlight-product', 'downlights'),
    ...targetFor('interior-lighting', 'pendant-product', 'pendants'),
    ...targetFor('ceiling-fan', 'fan-a', 'fans'),
    ...targetFor('ceiling-fan', 'fan-b', 'fans'),
    ...targetFor('ceiling-fan', 'fan-c', 'fans'),
  };
  const fixturePlan = planSelectionReconciliation({ workbook: fixtureWorkbook, book: fixtureBook, confirmedFixtureTargets: fixtureTargets });
  const downlights = fixturePlan.fixtures.find((entry) => entry.productId === 'downlight-product');
  const fan = fixturePlan.fixtures.find((entry) => entry.productId === 'fan-a');
  assert.equal(downlights.targetSummary.selectedQuantity, 53);
  assert.equal(downlights.targetSummary.existingQuantity, 55);
  assert.equal(downlights.difference, -2);
  assert.deepEqual(downlights.unmatchedLocations, ['Bedroom 1', 'Bedroom 2'], 'aggregate quote rows do not imply room reconciliation');
  assert.equal(fan.targetSummary.selectedQuantity, 18, 'three fan products compare collectively to one install row');
  assert.equal(fan.targetSummary.existingQuantity, 8);
  assert.equal(fan.difference, 10);
  const reconciledElectrical = fixturePlan.workbook.quotation.ELECTRICAL.rows;
  assert.equal(reconciledElectrical.find((row) => row.id === 'downlights').qty, 55, 'manual lighting quantity is not overwritten');
  assert.equal(reconciledElectrical.find((row) => row.id === 'downlights').manualRate, '$85.00', 'manual lighting rate is preserved');
  assert.equal(reconciledElectrical.find((row) => row.id === 'fans').qty, 8, 'fan quote quantity is not silently adjusted');
  assert.equal(reconciledElectrical.some((row) => row.source === 'client-selections-resolved-target' && ['interior-lighting', 'ceiling-fan'].includes(row.requirementKey)), false, 'fixture mapping does not create a second aggregate charge');
  assert.equal(fixturePlan.fixtureMappings.length, 5, 'each selected product receives its own stable builder mapping');
  console.log('PASS external lighting and exterior paint sync into existing trade sections without invented prices, quantities or rows');
}

console.log('Quotation target resolver tests passed.');