import assert from 'node:assert/strict';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { plumbingLineWithTotals } from '../lib/builders/plumbingFixtureAllocation.js';
import { PRODUCT_SELECTION_OUTCOME as O, blockedSelectionsForPurchaseOrderIssue, reconcileProductSelections, validateProductSelectionIntegrityForExport } from '../lib/builders/productSelectionIntegrity.js';
import { refreshSelectionProcurementRequirements } from '../lib/builders/selectionProcurementRequirements.js';
import { groupQuotationRateReviewRows, quotationRateReviewRows } from '../lib/builders/quotationRateReview.js';
import { commercialPriceProposalFor, proposalRateExGst } from '../lib/builders/commercialPriceProposals.js';
import { EXTERNAL_LIGHTING_SOURCE } from '../lib/builders/selectionSources.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
function fixture({ id = 'product-a', requirement = 'sink-mixer', price = 100, gst = false, quantity = 2, row = {}, procurement = true, mappings = 1 } = {}) {
  const quoteRow = { id: 'quote-row-a', item: 'Kitchen mixer', productId: id, productName: 'Kitchen mixer', qty: quantity ?? '', excelRate: price ?? '', priceStatus: price ? 'Current Price' : 'PRICE REQUIRED', quoteRequired: !price, ...row };
  const mapping = Array.from({ length: mappings }, (_, index) => ({ status: 'MAPPED', workspace_id: workspaceId, template_id: 'template-a', requirement_key: requirement, quote_section_id: 'KITCHEN', quote_row_id: `quote-row-${String.fromCharCode(97 + index)}` }));
  const quotationRows = [quoteRow, ...mapping.slice(1).map((entry) => ({ ...quoteRow, id: entry.quote_row_id }))];
  const workbook = {
    jobId: 'isolated-job-a', workspaceId, templateKey: 'template-a', quoteTargetMappings: mapping,
    quotation: { KITCHEN: { rows: quotationRows } },
    procurement: { items: procurement ? [{ id: `allocated-selection:${requirement}:${id}`, productId: id, qty: quantity, unit: 'EACH' }] : [] },
  };
  const book = { rooms: [{ id: 'kitchen', name: 'Kitchen', rows: [{ id: `selection:${requirement}`, guidedSelection: { requirementKey: requirement, productId: id, productName: 'Kitchen mixer', quantity, unit: 'EACH', selectedPrice: price, priceIncludesGst: gst } }] }] };
  return { workbook, book };
}
const status = (options) => reconcileProductSelections(fixture(options)).entries[0];
assert.equal(status({}).outcome, O.PRICED_IN_QUOTE);
assert.equal(status({ row: { selectionSpecProductId: 'product-a', selectionSpecificationOnly: true, selectedProductId: 'product-a' } }).outcome, O.VERIFIED_INCLUDED_IN_PACKAGE);
assert.equal(status({ row: { activeProductId: 'product-a', selectedProductId: 'product-a', selectionBaselineApplied: true, variationBasis: { status: 'BASELINE_VERIFIED' } } }).outcome, O.VERIFIED_REPLACEMENT);
assert.equal(status({ row: { activeProductId: 'product-a', selectedProductId: 'product-a', variationBasis: { status: 'BASELINE_UNVERIFIED' } } }).outcome, O.BLOCKED_UNVERIFIED_BASELINE);
assert.equal(status({ price: null }).outcome, O.BLOCKED_MISSING_PRICE);
assert.equal(status({ quantity: null }).outcome, O.BLOCKED_MISSING_QUANTITY);
assert.equal(status({ mappings: 2 }).outcome, O.BLOCKED_AMBIGUOUS_MAPPING);
const supplierQuotePending = fixture({ price: null, procurement: false });
const beforeProcurementDraft = reconcileProductSelections(supplierQuotePending);
assert.equal(beforeProcurementDraft.entries[0].outcome, O.BLOCKED_MISSING_PRICE, 'missing price is the primary outcome when both price and procurement are absent');
assert.equal(beforeProcurementDraft.entries[0].procurementStatus, 'REQUIRED_BUT_UNPRICED', 'the separate procurement status still reports the missing requirement');
assert.equal(beforeProcurementDraft.entries[0].procurementRepresented, false);
const withProcurementDraft = refreshSelectionProcurementRequirements(
  { ...supplierQuotePending.workbook, clientSelectionsBook: supplierQuotePending.book },
  { quotation: supplierQuotePending.workbook.quotation },
).procurement.items;
const afterProcurementDraft = reconcileProductSelections({
  workbook: { ...supplierQuotePending.workbook, procurement: { items: withProcurementDraft } },
  book: supplierQuotePending.book,
});
assert.equal(afterProcurementDraft.entries[0].procurementRepresented, true, 'the RFQ draft represents the procurement requirement');
assert.equal(afterProcurementDraft.entries[0].priceVerified, false, 'an RFQ draft does not supply or approve a supplier price');
assert.equal(afterProcurementDraft.entries[0].outcome, O.BLOCKED_MISSING_PRICE, 'represented procurement remains distinctly blocked on supplier price');
const scheduleSelection = fixture({ id: 'external-lighting-schedule', requirement: 'external-lighting', price: null, procurement: false });
scheduleSelection.workbook.quoteTargetMappings = [];
scheduleSelection.workbook.quotation = { LIGHTFITTINGS: { rows: [{ id: 'external-lighting:SKU-1', source: 'client-selections-external-lighting', requirementKey: 'external-lighting', item: 'Entry wall light', qty: 2, unit: 'EACH', excelRate: '', quoteRequired: true }] } };
const scheduleAudit = reconcileProductSelections(scheduleSelection);
assert.equal(scheduleAudit.entries[0].targetStatus, 'VERIFIED_SCHEDULE_ROWS');
assert.equal(scheduleAudit.entries[0].productRepresented, true, 'verified schedule rows represent schedule-owned products without requiring the schedule key as a product ID');
assert.equal(scheduleAudit.entries[0].outcome, O.BLOCKED_MISSING_PRICE, 'verified target does not clear a missing supplier price');
assert.equal(scheduleAudit.entries[0].procurementStatus, 'REQUIRED_BUT_UNPRICED', 'verified target does not clear the separate missing-procurement blocker');
for (const requirement of ['interior-paint', 'exterior-paint']) {
  const paintSchedule = fixture({ id: `${requirement}-schedule`, requirement, price: null, procurement: false, mappings: 0 });
  paintSchedule.workbook.quoteTargetMappings = [];
  paintSchedule.workbook.quotation = { PAINTER: { rows: [{
    id: `paint-${requirement}`,
    item: `${requirement} existing painting scope`,
    qty: 120,
    unit: 'M2',
    excelRate: 35,
    ...(requirement === 'interior-paint'
      ? { paintColourSpecification: { walls: 'Builder White' } }
      : { exteriorColourSpecification: { cladding: 'Surfmist' } }),
  }] } };
  const paintAudit = reconcileProductSelections(paintSchedule).entries[0];
  assert.equal(paintAudit.targetStatus, 'VERIFIED_SCHEDULE_ROWS');
  assert.equal(paintAudit.outcome, O.VERIFIED_INCLUDED_IN_PACKAGE, `${requirement} is a specification on existing painting scope, not a separately priced product`);
  assert.equal(paintAudit.procurementStatus, 'INCLUDED_IN_EXISTING_SUBCONTRACT');
}
const missingTarget = fixture({ mappings: 0 });
missingTarget.workbook.quotation = {};
assert.equal(reconcileProductSelections(missingTarget).entries[0].outcome, O.BLOCKED_MISSING_TARGET);
const generatedDoorTarget = fixture({ requirement: 'door-hardware', price: null, procurement: false, mappings: 0 });
generatedDoorTarget.workbook.quotation = { 'FIX OUT': { rows: [{
  id: 'takeoff-door-quotation:door-furniture:0:product-a',
  source: 'takeoff-door-quotation',
  productIds: ['product-a'],
  item: 'CHOICE BAILEY PASSAGE LEVER SET IN SATIN CHROME',
  qty: 12,
  unit: 'EACH',
  excelRate: '',
  priceStatus: 'PRODUCT / PRICE REQUIRED',
  quoteRequired: true,
}] } };
const generatedDoorAudit = reconcileProductSelections(generatedDoorTarget);
assert.equal(generatedDoorAudit.entries[0].targetStatus, 'VERIFIED_EXISTING_ROW', 'a deterministic takeoff-generated quotation row is a valid target');
assert.equal(generatedDoorAudit.entries[0].priceVerified, false, 'a generated target does not clear its missing supplier price');
assert.equal(generatedDoorAudit.entries[0].procurementRepresented, false, 'a generated target does not clear its missing procurement requirement');
const measuredDoorSchedule = fixture({ id: 'master-door', requirement: 'internal-doors', price: 108.9, gst: true, quantity: 1 });
measuredDoorSchedule.workbook.quoteTargetMappings = [];
measuredDoorSchedule.workbook.quotation = { 'FIX OUT': { rows: [
  { id: 'takeoff-door-quotation:internal-door:standard:720x2040', productIds: ['master-door'], item: '720 X 2040 FLUSH INTERIOR INTERNAL DOOR', qty: 8, unit: 'EACH', excelRate: 99, priceStatus: 'Current Price' },
  { id: 'takeoff-door-quotation:internal-door:standard:820x2040', productIds: ['master-door'], item: '820 X 2040 FLUSH INTERIOR INTERNAL DOOR', qty: 6, unit: 'EACH', excelRate: 99, priceStatus: 'Current Price' },
] } };
measuredDoorSchedule.workbook.procurement.items[0].requirementKey = 'internal-doors';
measuredDoorSchedule.workbook.procurement.items[0].qty = 14;
measuredDoorSchedule.workbook.procurement.items[0].locationSchedule = [{ location: 'Kitchen', quantity: 14 }];
const measuredDoorAudit = reconcileProductSelections(measuredDoorSchedule).entries[0];
assert.equal(measuredDoorAudit.targetStatus, 'VERIFIED_SCHEDULE_ROWS');
assert.equal(measuredDoorAudit.quantity, 14, 'all measured door-size rows own the supply requirement quantity');
assert.equal(measuredDoorAudit.procurementRepresented, true);
const missingCanonicalId = fixture();
missingCanonicalId.book.rooms[0].rows.push({ id: 'missing-product-id', guidedSelection: { requirementKey: 'sink-mixer', productName: 'Unidentified mixer', quantity: 1 } });
const idlessEntry = reconcileProductSelections(missingCanonicalId).entries.find(entry => entry.productName === 'Unidentified mixer');
assert(idlessEntry, 'selected products without canonical IDs are included in the audit');
assert.equal(idlessEntry.outcome, O.BLOCKED_MISSING_TARGET);
const legacySelectedDetails = fixture();
legacySelectedDetails.book.rooms[0].rows = [{ id: 'legacy-selected-row', guidedRequirementKey: 'sink-mixer', selected_details: { requirementKey: 'sink-mixer', productId: 'product-a', productName: 'Kitchen mixer', quantity: 2, unit: 'EACH', selectedPrice: 100, priceIncludesGst: false } }];
assert.equal(reconcileProductSelections(legacySelectedDetails).entries[0].productId, 'product-a', 'legacy selected_details identities remain included in the audit');
const unappliedMapping = fixture();
unappliedMapping.workbook.quotation.KITCHEN.rows[0].productId = 'old-product';
assert.equal(reconcileProductSelections(unappliedMapping).entries[0].outcome, O.BLOCKED_MISSING_TARGET, 'a mapped row without selected canonical ID is not treated as reconciled');
const noProcurement = reconcileProductSelections(fixture({ procurement: false }));
assert.equal(noProcurement.entries[0].procurementStatus, 'PRICED_NOT_APPROVED');
assert.equal(noProcurement.entries[0].procurementRepresented, false);
const externalLighting = fixture({ id: 'external-lighting-schedule', requirement: 'external-lighting', price: null, quantity: 4, procurement: false, mappings: 0 });
externalLighting.book.rooms[0].rows[0].guidedSelection.lightingSchedule = [
  { sku: '2303181', quantity: 3, exactLocation: 'Front entry' },
  { sku: '2461141', quantity: 1, exactLocation: 'Front entry' },
];
externalLighting.workbook.quotation = { LIGHTFITTINGS: { rows: [
  { id: 'external-lighting:2303181', source: EXTERNAL_LIGHTING_SOURCE, productCode: '2303181', item: 'Entry wall light', qty: 3, quoteRequired: true },
  { id: 'external-lighting:2461141', source: EXTERNAL_LIGHTING_SOURCE, productCode: '2461141', item: 'Second entry light', qty: 1, quoteRequired: true },
] } };
assert.equal(reconcileProductSelections(externalLighting).entries[0].quantity, 4, 'multi-SKU external-lighting quantity comes from all saved schedule lines, not the first quote row');
const duplicateProcurement = fixture();
duplicateProcurement.workbook.procurement.items.push({ id: 'second-order', productId: 'product-a', qty: 2, unit: 'EACH' });
assert.equal(reconcileProductSelections(duplicateProcurement).entries[0].procurementStatus, 'DUPLICATE_REQUIREMENT');
const aggregatedService = fixture({ id: 'light-a', requirement: 'interior-lighting', quantity: 2, mappings: 0 });
aggregatedService.book.rooms[0].rows.push({ id: 'selection-light-b', guidedSelection: { requirementKey: 'interior-lighting', productId: 'light-b', productName: 'Pendant', quantity: 1, unit: 'EACH', selectedPrice: 200, priceIncludesGst: false } });
aggregatedService.workbook.quotation = { LIGHTING: { rows: [{
  id: 'lighting-supply-row', item: 'Light fittings supply', qty: 3, unit: 'EACH', excelRate: 150,
  selectedProducts: [{ productId: 'light-a', requirementKey: 'interior-lighting' }, { productId: 'light-b', requirementKey: 'interior-lighting' }],
}] } };
aggregatedService.workbook.quoteTargetMappings = ['light-a', 'light-b'].map((productId) => ({
  status: 'MAPPED', workspace_id: workspaceId, template_id: 'template-a', requirement_key: 'interior-lighting',
  product_id: productId, quote_section_id: 'LIGHTING', quote_row_id: 'lighting-supply-row',
}));
assert.equal(reconcileProductSelections(aggregatedService).duplicates.length, 0, 'one service row explicitly aggregating several selected products is not a duplicate charge');
aggregatedService.workbook.quotation.LIGHTING.rows[0].selectedProducts = [{ productId: 'light-a', requirementKey: 'interior-lighting' }];
assert.equal(reconcileProductSelections(aggregatedService).duplicates.length, 0, 'explicit mappings to one service aggregate remain non-duplicate while its deferred product snapshot catches up');
aggregatedService.workbook.quotation.LIGHTING.rows[0].selectedProducts = [];
assert.equal(reconcileProductSelections(aggregatedService).duplicates.length, 0, 'job-scoped mappings of several products to one service row prove one aggregate charge before its product snapshot is rebuilt');
const quantityMismatch = fixture();
quantityMismatch.workbook.procurement.items[0].qty = 1;
const mismatchedProcurement = reconcileProductSelections(quantityMismatch);
assert.equal(mismatchedProcurement.entries[0].procurementRepresented, false, 'a procurement row with a short quantity does not represent the selected requirement');
const excessProcurement = fixture();
excessProcurement.workbook.procurement.items[0].qty = 3;
assert.equal(reconcileProductSelections(excessProcurement).entries[0].procurementRepresented, false, 'an excess procurement quantity is not treated as an exact requirement match');
const duplicateSelection = fixture();
duplicateSelection.book.rooms[0].rows.push({ ...duplicateSelection.book.rooms[0].rows[0], id: 'duplicate-selection-row' });
const duplicateSelectionAudit = reconcileProductSelections(duplicateSelection);
assert.equal(duplicateSelectionAudit.duplicateSelectionIdentities.length, 1, 'repeated requirement/product/location identities remain visible to the integrity audit');
const missingAllocation = fixture();
missingAllocation.book.rooms[0].rows[0].guidedSelection.plumbingAllocation = { lines: [{ lineId: 'product-a', productId: 'product-a', productName: 'Kitchen mixer', unit: 'EACH', unitPrice: 100, priceIncludesGst: false, quantity: 2, allocations: [] }] };
assert.equal(reconcileProductSelections(missingAllocation).entries[0].outcome, O.BLOCKED_MISSING_ALLOCATION, 'an allocated fixture without a room quantity is blocked');
const duplicateAllocation = fixture();
duplicateAllocation.book.rooms[0].rows[0].guidedSelection.plumbingAllocation = { lines: [{ lineId: 'product-a', productId: 'product-a', productName: 'Kitchen mixer', unit: 'EACH', unitPrice: 100, priceIncludesGst: false, quantity: 2, allocations: [{ location: 'Bedroom 2 Ensuite', quantity: 1 }, { location: 'B2 Ensuite', quantity: 1 }] }] };
const aliasAudit = reconcileProductSelections(duplicateAllocation);
assert.equal(aliasAudit.entries[0].allocationDuplicate, false, 'an equal-quantity confirmed room alias is not a deliberate second fixture');
assert.equal(aliasAudit.entries[0].quantity, 1, 'the duplicate alias contributes one physical allocation');
assert.equal(aliasAudit.entries[0].outcome, O.BLOCKED_MISSING_PROCUREMENT, 'the old quantity-2 procurement row must be refreshed to the corrected quantity');
const aliasQuote = duplicateAllocation.workbook.quotation.KITCHEN.rows[0];
aliasQuote.qty = 1;
duplicateAllocation.workbook.procurement.items[0].qty = 1;
duplicateAllocation.workbook.procurement.items[0].locationSchedule = [{ location: 'Bedroom 2 Ensuite', quantity: 1 }];
assert.equal(reconcileProductSelections(duplicateAllocation).entries[0].outcome, O.PRICED_IN_QUOTE, 'quote and procurement agree with the single physical alias');
const intentionalAdditional = fixture();
intentionalAdditional.book.rooms[0].rows[0].guidedSelection.plumbingAllocation = { lines: [{ lineId: 'product-a', productId: 'product-a', productName: 'Kitchen mixer', unit: 'EACH', unitPrice: 100, priceIncludesGst: false, quantity: 2, allocations: [{ location: 'Bedroom 2 Ensuite', quantity: 1 }, { location: 'B2 Ensuite', quantity: 1, additional: true }] }] };
assert.equal(reconcileProductSelections(intentionalAdditional).entries[0].quantity, 2, 'explicit additional fixture markers preserve intentional same-room additions');
const packedAdditional = plumbingLineWithTotals({ unit: 'EACH', selectionPack: { packId: 'bathroom-pack', quantityPerPack: 1 }, allocations: [{ location: 'Bedroom 2 Ensuite', quantity: 1 }, { location: 'B2 Ensuite', quantity: 1, additional: true }] });
assert.equal(packedAdditional.quantity, 2, 'selection packs preserve an explicitly additional aliased fixture');
assert.equal(packedAdditional.allocations[0].additional, true);
const conflictingAllocation = fixture();
conflictingAllocation.book.rooms[0].rows[0].guidedSelection.plumbingAllocation = { lines: [{ lineId: 'product-a', productId: 'product-a', productName: 'Kitchen mixer', unit: 'EACH', unitPrice: 100, priceIncludesGst: false, quantity: 3, allocations: [{ location: 'Bedroom 2 Ensuite', quantity: 1 }, { location: 'B2 Ensuite', quantity: 2 }] }] };
assert.equal(reconcileProductSelections(conflictingAllocation).entries[0].outcome, O.BLOCKED_DUPLICATE_ALLOCATION, 'aliases with conflicting quantities remain blocked');
const mainBathroomAlias = fixture();
mainBathroomAlias.book = { rooms: [{ id: 'main-bathroom', name: 'Main Bathroom', rows: [{ id: 'allocated-mixer', guidedSelection: {
  requirementKey: 'basin-mixer', productId: 'product-a', productCode: 'MIX-001', productName: 'Basin Mixer', quantity: 1, unit: 'EACH', selectedPrice: 100, priceIncludesGst: false,
  plumbingAllocation: { lines: [{ lineId: 'product-a', productId: 'product-a', productCode: 'MIX-001', productName: 'Basin Mixer', supplier: 'Test Supplier', unit: 'EACH', quantity: 1, unitPrice: 100, priceIncludesGst: false, allocations: [{ location: 'Main Bathroom', quantity: 1 }] }] },
} }] }] };
mainBathroomAlias.workbook.quotation = { PLUMBING: { rows: [{ id: 'mixer-row', productId: 'product-a', productCode: 'MIX-001', item: 'Basin Mixer', qty: 1, excelRate: 100, priceStatus: 'Current Price', priceIncludesGst: false }] } };
mainBathroomAlias.workbook.procurement.items = [{ id: 'mixer-order', productId: 'product-a', productCode: 'MIX-001', supplier: 'Test Supplier', requirementKey: 'basin-mixer', qty: 1, unit: 'EACH', locationSchedule: [{ location: 'Bathroom', quantity: 1 }] }];
assert.equal(reconcileProductSelections(mainBathroomAlias).entries[0].procurementRepresented, true, 'legacy Bathroom procurement matches the sole Main Bathroom project location');
const separateBathroom = structuredClone(mainBathroomAlias);
separateBathroom.book.rooms.push({ id: 'bathroom', name: 'Bathroom', rows: [] });
assert.equal(reconcileProductSelections(separateBathroom).entries[0].procurementRepresented, false, 'a separately confirmed Bathroom is not collapsed into Main Bathroom');
const invalidProductReference = fixture();
assert.equal(reconcileProductSelections({ ...invalidProductReference, productById: () => null }).entries[0].outcome, O.BLOCKED_INVALID_PRODUCT_REFERENCE, 'an unresolved canonical product ID is blocked when the scoped catalogue lookup is available');
const compositeRoofingPackage = fixture({ id: 'fascia-gutter-package', requirement: 'roofing', price: null, procurement: false, mappings: 0 });
compositeRoofingPackage.book.rooms[0].rows[0].guidedSelection.roofPackage = { fascia: { productId: 'fascia-a' }, gutters: { productId: 'gutter-a' } };
compositeRoofingPackage.workbook.quotation = { ROOFING: { rows: [{ id: 'roofing-all-in', item: 'M2 RATE (BATTENS, FASCIA, GUTTER, ROOF & INS)', qty: 100, unit: 'M2', excelRate: 150 }] } };
const compositeRoofingAudit = reconcileProductSelections({ ...compositeRoofingPackage, productById: () => null }).entries[0];
assert.notEqual(compositeRoofingAudit.outcome, O.BLOCKED_INVALID_PRODUCT_REFERENCE, 'a configured composite roofing package is not misclassified as a missing Product Library record');
assert.equal(status({ row: { activeProductId: 'product-a', selectedProductId: 'product-a', retainedBaseline: { productId: 'contracted-product' }, variationBasis: { status: 'BASELINE_UNVERIFIED' } } }).outcome, O.BLOCKED_UNVERIFIED_BASELINE, 'a replacement cannot affect contracted values before approval');
const duplicateCharge = fixture();
duplicateCharge.book.rooms.push({ id: 'kitchen-2', name: 'Kitchen 2', rows: [{ id: 'second-selection', guidedSelection: { requirementKey: 'sink-mixer', productId: 'product-b', productName: 'Kitchen mixer', quantity: 2, unit: 'EACH', selectedPrice: 100, priceIncludesGst: false } }] });
duplicateCharge.workbook.quotation.KITCHEN.rows.push({ ...duplicateCharge.workbook.quotation.KITCHEN.rows[0], id: 'quote-row-b', productId: 'product-b' });
duplicateCharge.workbook.quoteTargetMappings.push({ status: 'MAPPED', workspace_id: workspaceId, template_id: 'template-a', requirement_key: 'sink-mixer', quote_section_id: 'KITCHEN', quote_row_id: 'quote-row-b' });
assert.equal(reconcileProductSelections(duplicateCharge).duplicates.length, 0, 'distinct rows for distinct locations are not duplicate charge claims');
const ambiguous = fixture({ mappings: 2 });
const before = JSON.stringify(ambiguous);
reconcileProductSelections(ambiguous);
assert.equal(JSON.stringify(ambiguous), before, 'audit is read-only');
const gst = reconcileProductSelections(fixture({ price: 110, gst: true }));
assert.equal(gst.entries[0].estimatedExposureExGst, 200);
assert.equal(gst.selected, 1);
assert.equal(gst.unresolvedCount, 0);
const catalogueMatched = fixture({ price: 100, gst: null, row: { excelRate: "", priceStatus: "PRICE REQUIRED", quoteRequired: true } });
const catalogueWorkbook = { ...catalogueMatched.workbook, clientSelectionsBook: catalogueMatched.book };
const catalogueInputBefore = JSON.stringify(catalogueWorkbook);
const catalogueQuoteBefore = calculateEstimateBuilderWorkbook(structuredClone(catalogueWorkbook)).summary.finalQuoteTotal;
const catalogueAudit = reconcileProductSelections({ workbook: catalogueWorkbook, productById: (id) => ({ productId: id, clientPrice: 100, priceUnit: "EACH", priceStatus: "current", priceSource: "supplier_price", gstIncluded: true }) });
assert.equal(catalogueAudit.entries[0].priceVerified, true, "exact current supplier price evidence supplies only the missing saved-selection GST basis");
assert.equal(catalogueAudit.entries[0].priceIncludesGst, true);
assert.equal(catalogueAudit.entries[0].priceEvidenceSource, "supplier_price");
assert.equal(catalogueAudit.entries[0].outcome, O.BLOCKED_MISSING_PRICE, 'corroborating the saved price and GST does not make an explicitly quote-required quotation row payable');
assert.equal(catalogueAudit.entries[0].estimatedExposureExGst, Math.round((100 / 1.1) * 2 * 100) / 100);
assert.equal(JSON.stringify(catalogueWorkbook), catalogueInputBefore, "price corroboration is read-only");
assert.equal(calculateEstimateBuilderWorkbook(structuredClone(catalogueWorkbook)).summary.finalQuoteTotal, catalogueQuoteBefore, "price corroboration cannot alter the quote total");
const catalogueMismatch = reconcileProductSelections({ ...catalogueMatched, productById: (id) => ({ productId: id, clientPrice: 101, priceUnit: "EACH", priceStatus: "current", priceSource: "supplier_price", gstIncluded: true }) });
assert.equal(catalogueMismatch.entries[0].outcome, O.BLOCKED_MISSING_PRICE, "a changed catalogue price cannot replace the saved selection price");
const catalogueQuoteRequired = reconcileProductSelections({ ...catalogueMatched, productById: (id) => ({ productId: id, priceUnit: "EACH", priceStatus: "quote_required", priceSource: "supplier_price", gstIncluded: true }) });
assert.equal(catalogueQuoteRequired.entries[0].outcome, O.BLOCKED_MISSING_PRICE, "a quote-required product remains blocked");
const selectionPricePending = fixture({ price: 100, row: { priceStatus: "price_pending" } });
selectionPricePending.book.rooms[0].rows[0].guidedSelection.priceStatus = "price_pending";
const pendingAudit = reconcileProductSelections({ ...selectionPricePending, productById: (id) => ({ productId: id, clientPrice: 100, priceUnit: "EACH", priceStatus: "current", priceSource: "supplier_price", gstIncluded: true }) });
assert.equal(pendingAudit.entries[0].priceVerified, true, "a pending selection is corroborated only by an exact current supplier price and GST basis");
const selectionQuoteRequired = fixture({ price: 100 });
selectionQuoteRequired.book.rooms[0].rows[0].guidedSelection.priceStatus = "quote_required";
const quoteRequiredAudit = reconcileProductSelections({ ...selectionQuoteRequired, productById: (id) => ({ productId: id, clientPrice: 100, priceUnit: "EACH", priceStatus: "current", priceSource: "supplier_price", gstIncluded: true }) });
assert.equal(quoteRequiredAudit.entries[0].outcome, O.BLOCKED_MISSING_PRICE, "explicit quote-required selection status remains blocked despite a coincidental catalogue amount");
assert.equal(blockedSelectionsForPurchaseOrderIssue(gst, [{ productId: 'product-a' }]).length, 1, 'priced but unapproved procurement cannot be issued');
const approvedForOrdering = { ...gst, entries: gst.entries.map(entry => ({ ...entry, procurementStatus: 'APPROVED_FOR_ORDERING' })) };
assert.equal(blockedSelectionsForPurchaseOrderIssue(approvedForOrdering, [{ productId: 'product-a' }]).length, 0);
assert.equal(blockedSelectionsForPurchaseOrderIssue(noProcurement, [{ productId: 'product-a' }]).length, 1, 'a missing procurement requirement may be drafted but not issued');
assert.equal(validateProductSelectionIntegrityForExport(null, { jobId: 'isolated-job-a', workspaceId }).code, 'SELECTION_AUDIT_REQUIRED');
assert.equal(validateProductSelectionIntegrityForExport(gst, { jobId: 'other-job', workspaceId }).code, 'SELECTION_AUDIT_IDENTITY_MISMATCH');
assert.equal(validateProductSelectionIntegrityForExport({ ...gst, entries: [] }, { jobId: 'isolated-job-a', workspaceId }).code, 'SELECTION_AUDIT_INCOMPLETE');
const exportReady = { ...gst, jobId: 'isolated-job-a', workspaceId, selected: 1, entries: [{ ...gst.entries[0], procurementStatus: 'PRICED_NOT_APPROVED', procurementRepresented: true }], duplicates: [], procurementDuplicates: [] };
assert.equal(validateProductSelectionIntegrityForExport(exportReady, { jobId: 'isolated-job-a', workspaceId }).ok, true);
assert.equal(validateProductSelectionIntegrityForExport({ ...exportReady, entries: [{ ...exportReady.entries[0], outcome: O.BLOCKED_MISSING_PRICE }] }, { jobId: 'isolated-job-a', workspaceId }).code, 'SELECTION_INTEGRITY_BLOCKED');
assert.equal(validateProductSelectionIntegrityForExport({ ...exportReady, entries: [{ ...exportReady.entries[0], priceVerified: false }] }, { jobId: 'isolated-job-a', workspaceId }).code, 'SELECTION_INTEGRITY_BLOCKED', 'claimed priced status requires corroborating price evidence');
const forgedDuplicate = { ...exportReady, selected: 2, entries: [exportReady.entries[0], { ...exportReady.entries[0], key: 'other-selection', productId: 'product-b' }] };
assert.equal(validateProductSelectionIntegrityForExport(forgedDuplicate, { jobId: 'isolated-job-a', workspaceId }).code, 'SELECTION_INTEGRITY_BLOCKED', 'export boundary recomputes duplicate row claims');
const rateReview = quotationRateReviewRows({
  ELECTRICAL: { rows: [
    { id: 'inactive-template-rate', item: 'Unused option', qty: 0, sourceOfRate: 'rate missing' },
    { id: 'active-missing-rate', item: 'Active schedule point', qty: 2, sourceOfRate: 'rate missing' },
    { id: 'linked-missing-rate', item: 'Selected product', qty: 0, productId: 'product-a', quoteRequired: true },
    { id: 'inactive-linked-rate', item: 'Inactive selection', qty: 1, productId: 'product-b', quoteRequired: true, active: false },
  ] },
});
assert.deepEqual(rateReview.map(row => row.id), ['active-missing-rate', 'linked-missing-rate'], 'rate review excludes zero-quantity template noise but retains active and commercially linked missing rates');
assert.equal(rateReview[0].section, 'ELECTRICAL');
assert.equal(quotationRateReviewRows({}).length, 0);
const groupedRates = groupQuotationRateReviewRows([
  { id: 'electrical-schedule:kitchen:data', section: 'ELECTRICAL', item: 'Data Point - Kitchen', qty: 1, unit: 'EACH' },
  { id: 'electrical-schedule:study:data', section: 'ELECTRICAL', item: 'Data Point - Study', qty: 2, unit: 'EACH' },
  { id: 'tiling:room-a:labour-floorM2', section: 'TILING', item: 'Labour - floor tiling', qty: 4, unit: 'M2' },
  { id: 'tiling:room-b:labour-floorM2', section: 'TILING', item: 'Labour - floor tiling', qty: 6, unit: 'M2' },
]);
assert.deepEqual(groupedRates.map(group => [group.key, group.rows.length, group.quantity]), [
  ['electrical:data', 2, 3],
  ['tiling:labour-floorM2', 2, 10],
], 'repeated room rows are one commercial rate decision with line-level traceability');
const baileyProposal = commercialPriceProposalFor({ productId: 'master-INT-GAINSBOROUGH-105BAISC' });
assert.equal(baileyProposal?.price, 47.04);
assert.equal(baileyProposal?.gstBasis, 'UNSTATED', 'a retail listing does not silently claim a GST basis');
assert.equal(proposalRateExGst(baileyProposal, true), 42.7636);
assert.equal(proposalRateExGst(baileyProposal, false), 47.04);
assert.throws(() => proposalRateExGst(baileyProposal, null), /Confirm whether/);
console.log('Product selection integrity: 47 checks passed; outcomes, missing canonical IDs, legacy selection shapes, export evidence, PO issue gates, packages, replacements, allocation, procurement parity, duplicate detection, root-cause rate grouping, retail-reference approval evidence, tenant identity and read-only behavior verified.');
