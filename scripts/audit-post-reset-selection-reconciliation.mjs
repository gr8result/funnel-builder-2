import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { mapDbProductToEntity } from '../lib/product-library/productLibraryDbMapper.js';
import { resolveProductPrice } from '../lib/product-library/catalogueModel.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';
import { planSelectionReconciliation } from '../lib/builders/selectionReconciliation.js';
import { resolveQuotationTarget } from '../lib/builders/quotationTargetResolver.js';
import { auditWindowScheduleQuotation } from '../lib/builders/selectionReconciliationReport.js';
import { windowPriceListTakeoffQuantities } from '../lib/construction-estimation/windowsQuotePriceList.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { canonicalQuotationSectionName } from '../lib/construction-estimation/quotationStructure.js';
import { quotationSectionsForFinalBoq, quoteQuantity, quoteRate, quoteLineTotal } from '../lib/construction-estimation/finalQuotationBoq.js';

dotenv.config({ path: '.env.local', quiet: true });
const output = path.resolve('artifacts/test-artifacts/post-reset-selection-reconciliation-20261015');
const protectedPath = 'C:/Users/grant/Downloads/New Job 03 09.gr8job';
const isolatedPath = 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const round = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const productIds = (row) => [row.productId, row.activeProductId, row.selectedProductId, row.selectionSpecProductId, row.productLibrarySnapshot?.productId, ...(row.productIds || [])].filter(Boolean);
const flatten = (quotation) => Object.entries(quotation || {}).flatMap(([section, group]) => (group.rows || []).map((row, index) => ({ section, index, row })));
const line = ({ section, index, row }) => ({ section, index, id: row.id, item: row.item, productIds: productIds(row), quantity: quoteQuantity(row), unit: row.unit || '', unitRateExGst: quoteRate(row), costExGst: quoteLineTotal(row), quantityKey: row.quantityKey || '', quantityManualOverride: row.quantityManualOverride === true, manualRate: row.manualRate || '', allowancePerUnit: row.allowancePerUnit ?? null, allowanceTotal: row.allowanceTotal ?? null, baselineStatus: row.variationBasis?.status || '', priceStatus: row.priceStatus || '', quoteRequired: row.quoteRequired === true });

async function readPackage(file, expected) {
  const bytes = fs.readFileSync(file);
  const sha256 = hash(bytes);
  assert.equal(sha256, expected, `Source hash mismatch: ${file}`);
  const zip = await JSZip.loadAsync(bytes);
  const workbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
  return { file, sha256, workbook, originalWorkbookHash: hash(JSON.stringify(workbook)), savedBoq: zip.file('boq.json') ? JSON.parse(await zip.file('boq.json').async('string')) : null };
}

const original = await readPackage(protectedPath, '72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088');
const isolated = await readPackage(isolatedPath, '821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46');
assert.equal(original.workbook.jobId, 'recovered-03-09-123');
assert.notEqual(isolated.workbook.jobId, original.workbook.jobId);
assert.equal(isolated.workbook.workspaceId, original.workbook.workspaceId);
const workspaceId = isolated.workbook.workspaceId;
const master = getMasterProducts(workspaceId);
const masterById = new Map(master.map((product) => [product.productId, product]));
const privateProducts = [];
const live = { workspaceId, table: 'builder_products', method: 'SELECT_ONLY', checkedAt: new Date().toISOString(), status: 'BLOCKED', count: null };
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (serviceKey) {
  const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options = {}) => {
    assert(['GET', 'HEAD'].includes(String(options.method || 'GET').toUpperCase()), 'Audit database access must be read-only');
    return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  } } });
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await database.from('builder_products').select('*').eq('workspace_id', workspaceId).order('id').range(offset, offset + 999);
      if (error) throw error;
      for (const product of data || []) {
        assert.equal(product.workspace_id, workspaceId, 'Cross-workspace product rejected');
        privateProducts.push(mapDbProductToEntity(product));
      }
      if ((data || []).length < 1000) break;
    }
    live.status = 'VERIFIED_READ';
    live.count = privateProducts.length;
  } catch (error) {
    live.error = error.message;
    privateProducts.length = 0;
  }
} else live.error = 'Server read credential unavailable; no live private prices assumed';
const privateById = new Map(privateProducts.map((product) => [product.productId, product]));
const productById = (id) => privateById.get(id) || masterById.get(id) || null;

function sourceEvidence(workbook, entry) {
  const evidence = [];
  for (const [roomIndex, room] of (workbook.clientSelectionsBook?.rooms || []).entries()) {
    for (const [rowIndex, row] of (room.rows || []).entries()) {
      const selectionKey = row.guidedSelection ? 'guidedSelection' : row.selected_details ? 'selected_details' : 'selectedDetails';
      const selection = row[selectionKey] || {};
      const base = `clientSelectionsBook.rooms[${roomIndex}].rows[${rowIndex}].${selectionKey}`;
      if ([selection.productId, selection.canonicalProductId, row.productId].includes(entry.productId)) {
        evidence.push({ path: base, room: room.name, quantity: selection.quantity ?? null, enteredArea: selection.drivewayAreaM2 ?? selection.drivewaySelection?.areaM2 ?? null, unit: selection.unit || '', price: selection.selectedPrice ?? selection.unitPrice ?? null, priceIncludesGst: selection.priceIncludesGst ?? null, allowance: selection.allowance ?? null, priceStatus: selection.priceStatus || selection.priceState || '', quantitySource: selection.quantitySource || selection.drivewaySelection?.areaSource || 'SAVED_SELECTION_NOT_AUTOMATICALLY_A_MEASURED_QUANTITY', dimensions: { height: selection.heightMm ?? selection.height ?? null, width: selection.widthMm ?? selection.width ?? null } });
      }
      for (const [index, selected] of (selection.plumbingAllocation?.lines || []).entries()) if (selected.productId === entry.productId) evidence.push({ path: `${base}.plumbingAllocation.lines[${index}]`, room: room.name, quantity: selected.quantity, unit: selected.unit, price: selected.unitPrice, priceIncludesGst: selected.priceIncludesGst ?? null, priceBasis: selected.priceBasis || '', allocations: selected.allocations || [], quantitySource: 'SAVED_PLUMBING_LOCATION_ALLOCATIONS' });
      for (const [index, selected] of (selection.selectedProducts || []).entries()) if ([selected.productId, selected.id].includes(entry.productId)) evidence.push({ path: `${base}.selectedProducts[${index}]`, quantity: selected.quantity ?? selection.quantity ?? null, price: selected.selectedPrice ?? selected.unitPrice ?? selected.clientPrice ?? null, priceIncludesGst: selected.priceIncludesGst ?? selection.priceIncludesGst ?? null, quantitySource: 'SAVED_PRODUCT_SCHEDULE' });
      for (const [index, selected] of (selection.entryDoors || []).entries()) if ([selected.entryDoorFurniture?.productId, selected.entryDoorFurniture?.id].includes(entry.productId)) evidence.push({ path: `${base}.entryDoors[${index}].entryDoorFurniture`, quantity: selected.door?.quantity ?? selected.quantity ?? selection.quantity ?? null, quantitySource: 'SAVED_ENTRY_DOOR_SCHEDULE' });
    }
  }
  return evidence;
}

function catalogueEvidence(product) {
  if (!product) return null;
  const resolvedPrice = resolveProductPrice(product);
  const basis = typeof product.gstIncluded === 'boolean' ? product.gstIncluded : typeof product.priceIncludesGst === 'boolean' ? product.priceIncludesGst : null;
  return { productId: product.productId, productName: product.productName, productCode: product.productCode || product.supplierSku || '', supplier: product.supplier || '', resolvedPrice, clientPrice: product.clientPrice ?? product.client_price ?? null, builderCost: product.builderCost ?? null, gstIncluded: basis, gstTreatment: product.gstTreatment || '', priceStatus: product.priceStatus || '', priceSource: product.priceSource || '', priceSourceURL: product.priceSourceURL || product.officialProductURL || '', priceEffectiveDate: product.priceEffectiveDate || '', quantityUnit: product.unit || product.priceUnit || '', active: product.active !== false, archived: product.archived === true, source: privateById.has(product.productId) ? 'LIVE_WORKSPACE_PRODUCT' : 'CURRENT_STATIC_MASTER' };
}

function buildSnapshot(source) {
  const workbook = source.workbook;
  const audit = reconcileProductSelections({ workbook: structuredClone(workbook) });
  assert.equal(audit.selected, 52, 'The audit must cover all 52 saved selected identities');
  const calculated = calculateEstimateBuilderWorkbook(structuredClone(workbook));
  const rows = flatten(calculated.quotation);
  const savedRows = flatten(workbook.quotation);
  const boqRows = quotationSectionsForFinalBoq(calculated.quotation).flatMap((section) => section.rows.map((row, index) => ({ section: section.sectionKey, index, row })));
  const savedBoqRows = Array.isArray(source.savedBoq?.items) ? source.savedBoq.items : [];
  const entries = audit.entries.map((entry) => {
    const product = productById(entry.productId);
    const evidence = sourceEvidence(workbook, entry);
    const target = resolveQuotationTarget({ workbook, identity: { ...entry, unitPrice: entry.selectedUnitPrice } });
    const exact = rows.filter(({ row }) => productIds(row).includes(entry.productId));
    const savedMatches = savedRows.filter(({ section, row }) => productIds(row).includes(entry.productId) || (entry.quoteRowIds.includes(row.id) && (!entry.section || entry.section === section)));
    const candidates = rows.filter(({ section, row }) => quoteLineTotal(row) > 0 && (entry.quoteRowIds.includes(row.id) || productIds(row).includes(entry.productId) || (entry.section && canonicalQuotationSectionName(section) === canonicalQuotationSectionName(entry.section))));
    const boq = boqRows.filter(({ row }) => productIds(row).includes(entry.productId) || entry.quoteRowIds.includes(row.id));
    const savedBoq = savedBoqRows.filter((row) => [row.product_id, row.productId].includes(entry.productId) || entry.quoteRowIds.includes(row.source_quote_row_id || row.quoteRowId));
    const procurement = (workbook.procurement?.items || []).filter((item) => entry.procurementIds.includes(item.id));
    const positiveExact = exact.filter(({ row }) => quoteQuantity(row) > 0 && quoteRate(row) > 0 && quoteLineTotal(row) > 0);
    const knownGross = typeof entry.priceIncludesGst === 'boolean' && entry.selectedUnitPrice > 0 && entry.quantity > 0 ? round(entry.quantity * entry.selectedUnitPrice / (entry.priceIncludesGst ? 1.1 : 1)) : null;
    const existingProductCost = round(positiveExact.reduce((sum, current) => sum + quoteLineTotal(current.row), 0));
    const outcomeVerified = !entry.outcome.startsWith('BLOCKED_');
    const supplyOnly = candidates.filter(({ row }) => !productIds(row).includes(entry.productId));
    const reasons = [];
    if (!product) reasons.push('No exact current Product Library product ID match; schedule/brand identity is not a priced physical product');
    if (!evidence.length) reasons.push('Saved selection source path unresolved');
    if (entry.outcome.startsWith('BLOCKED_')) reasons.push(entry.outcome);
    if (entry.targetReason) reasons.push(entry.targetReason);
    if (!positiveExact.length && outcomeVerified) reasons.push('Audit says priced, but no positive calculated canonical-product charge was found');
    if (!entry.procurementRepresented) reasons.push('Missing saved procurement requirement');
    if (!savedBoq.length) reasons.push('Missing persisted commercial BOQ evidence');
    if (entry.priceIncludesGst === null || entry.priceIncludesGst === undefined) reasons.push('Saved selected price GST basis is unknown');
    if (supplyOnly.length) reasons.push('Other charged rows in target trade require scope/allowance overlap review; not automatically deductible');
    return {
      ...entry, sourcePackage: source.file, sourcePackageHash: source.sha256,
      productLibrary: catalogueEvidence(product), quantityEvidence: evidence,
      requiredQuantity: { savedAuditQuantity: entry.quantity, unit: entry.unit, sourcePaths: evidence.map((item) => item.path), verifiedMeasurementNotAssumed: true, calculatedProductQuantities: positiveExact.map((current) => ({ rowId: current.row.id, quantity: quoteQuantity(current.row), unit: current.row.unit || '', quantityKey: current.row.quantityKey || '' })) },
      savedQuotationRows: savedMatches.map(line), calculatedCanonicalRows: exact.map(line),
      existingAllowancesAndPossibleOverlaps: supplyOnly.map(line), targetCandidates: target.candidates || [],
      boqProjection: boq.map(line), savedCommercialBoq: savedBoq,
      procurementRequirements: procurement.map((item) => ({ id: item.id, quoteRowId: item.quoteRowId || item.sourceQuoteRowId || '', productId: item.productId || '', quantity: item.qty ?? item.quantity ?? null, unit: item.unit || '', status: item.status || '', estimatedRate: item.estimatedRate ?? null, estimatedTotal: item.estimatedTotal ?? null })),
      requiredDownstreamTreatment: { boq: 'One quantity-owned requirement per physical supply scope; retain unpriced requirements and source identity', procurement: 'One canonical supply requirement per quantity/location scope, without duplicating existing subcontract, material or labour scope', supplierRfq: 'Verified supplier/product/specification and all physical schedule quantities; no quote issued by this audit' },
      financial: { knownSelectedGrossValueExGst: knownGross, calculatedExistingCanonicalCostExGst: existingProductCost, verifiedIncrementalCostExGst: null, netImpactStatus: positiveExact.length ? 'EXISTING_CANONICAL_CHARGE_REPRESENTED; VERIFY_SAVED_TARGET_AND_PRICE_BEFORE_ANY_ADDITION' : supplyOnly.length ? 'ALLOWANCE_OR_SCOPE_OVERLAP_REVIEW_REQUIRED' : knownGross !== null ? 'KNOWN_SELECTED_VALUE_ONLY; QUANTITY_MAPPING_AND_NET_CHANGE_NOT_APPROVED' : 'UNKNOWN_PRICE_GST_OR_QUANTITY; DO_NOT_ESTIMATE', allowanceCreditExGst: null },
      blockers: reasons, strictPositiveQuoteEvidence: outcomeVerified && positiveExact.length > 0,
    };
  });
  return { source: source.file, sha256: source.sha256, jobId: workbook.jobId, rows: savedRows.length, calculatedTotal: calculated.summary.finalQuoteTotal, selected: audit.selected, outcomes: audit.counts, auditVerifiedPriced: audit.counts.PRICED_IN_QUOTE, strictPositiveQuoteEvidence: entries.filter((entry) => entry.strictPositiveQuoteEvidence).length, blocked: audit.unresolvedCount, missingProcurement: audit.procurementMissing.length, missingSavedCommercialBoq: entries.filter((entry) => !entry.savedCommercialBoq.length).length, duplicateQuoteClaims: audit.duplicates, duplicateProcurement: audit.procurementDuplicates, knownGrossBlockedSelectedValueExGst: round(audit.supportedUnresolvedExposureExGst), entries };
}

const protectedSnapshot = buildSnapshot(original);
const isolatedSnapshot = buildSnapshot(isolated);
const proposal = planSelectionReconciliation({ workbook: structuredClone(original.workbook), productById });
const proposalAgain = planSelectionReconciliation({ workbook: structuredClone(proposal.workbook), productById });
const beforeCalculated = calculateEstimateBuilderWorkbook(structuredClone(original.workbook));
const afterCalculated = calculateEstimateBuilderWorkbook(structuredClone(proposal.workbook));
const twiceCalculated = calculateEstimateBuilderWorkbook(structuredClone(proposalAgain.workbook));
assert.equal(afterCalculated.summary.finalQuoteTotal, twiceCalculated.summary.finalQuoteTotal, 'Repeated isolated proposal calculation must be financially idempotent');
const beforeRows = flatten(beforeCalculated.quotation);
const afterRows = flatten(afterCalculated.quotation);
const available = new Set(beforeRows.map((_, index) => index));
const proposalRows = [];
for (const next of afterRows) {
  let matches = [...available].filter((index) => beforeRows[index].row.id === next.row.id && beforeRows[index].section === next.section && beforeRows[index].row.item === next.row.item);
  if (matches.length !== 1) matches = [...available].filter((index) => beforeRows[index].row.id === next.row.id && beforeRows[index].row.item === next.row.item);
  if (matches.length !== 1) matches = [...available].filter((index) => beforeRows[index].row.id === next.row.id);
  const previousIndex = matches.length === 1 ? matches[0] : null;
  const previous = previousIndex === null ? null : beforeRows[previousIndex];
  if (previousIndex !== null) available.delete(previousIndex);
  const delta = round(quoteLineTotal(next.row) - (previous ? quoteLineTotal(previous.row) : 0));
  const changed = delta !== 0 || JSON.stringify([productIds(next.row), quoteQuantity(next.row), quoteRate(next.row)]) !== JSON.stringify([previous ? productIds(previous.row) : [], previous ? quoteQuantity(previous.row) : 0, previous ? quoteRate(previous.row) : 0]);
  if (changed) proposalRows.push({ before: previous ? line(previous) : null, proposed: line(next), deltaExGst: delta, classification: !previous ? 'PROPOSED_NEW_ROW_NOT_APPROVED' : productIds(previous.row).join('|') !== productIds(next.row).join('|') ? 'PRODUCT_REPLACEMENT_OR_IDENTITY_CHANGE' : delta < 0 ? 'EXISTING_CHARGE_REDUCTION_REQUIRES_SCOPE_APPROVAL' : delta > 0 ? 'EXISTING_SCOPE_QUANTITY_OR_PRICE_INCREASE' : 'NON_FINANCIAL_CHANGE', applied: false });
}
for (const index of available) {
  const previous = beforeRows[index];
  if (quoteLineTotal(previous.row) || quoteQuantity(previous.row)) proposalRows.push({ before: line(previous), proposed: null, deltaExGst: -quoteLineTotal(previous.row), classification: 'REMOVED_OR_AMBIGUOUS_IDENTITY_REVIEW', applied: false });
}
const adjustmentFields = ['baseLineItemSubtotal', 'preliminaryCostsAmount', 'overheadsAmount', 'marginAmount', 'profitAmount', 'gst', 'qbsaRegistration', 'qLeaveFees', 'salesCommissionAmount', 'finalQuoteTotal'];
const differences = Object.fromEntries(adjustmentFields.map((field) => [field, round((afterCalculated.summary[field] || 0) - (beforeCalculated.summary[field] || 0))]));
assert.equal(round(proposalRows.reduce((sum, row) => sum + row.deltaExGst, 0)), differences.baseLineItemSubtotal, 'Proposal row ledger must reconcile every cent of the base difference');
for (const [index, row] of proposalRows.entries()) {
  row.changeId = `proposal-${index + 1}`;
  const ids = new Set([...(row.before?.productIds || []), ...(row.proposed?.productIds || [])]);
  const quoteIds = [row.before?.id, row.proposed?.id].filter(Boolean);
  row.selectedIdentityKeys = protectedSnapshot.entries.filter((entry) => ids.has(entry.productId) || entry.quoteRowIds.some((id) => quoteIds.includes(id))).map((entry) => entry.key);
  row.attribution = row.selectedIdentityKeys.length === 1 ? 'EXACT_PRODUCT_OR_EXISTING_ROW' : row.selectedIdentityKeys.length > 1 ? 'SHARED_SCOPE_DO_NOT_SUM_PER_IDENTITY' : 'NO_EXACT_SELECTED_IDENTITY_ATTRIBUTION; REVIEW_TRADE_SCOPE';
}
for (const snapshot of [protectedSnapshot, isolatedSnapshot]) for (const entry of snapshot.entries) {
  const changes = proposalRows.filter((row) => row.selectedIdentityKeys.includes(entry.key));
  entry.proposalChangeIds = changes.map((row) => row.changeId);
  entry.financial.proposedChangeEvidence = changes.map((row) => ({ changeId: row.changeId, deltaExGst: row.deltaExGst, classification: row.classification, attribution: row.attribution }));
  entry.financial.exclusiveProposedDeltaExGst = changes.length && changes.every((row) => row.selectedIdentityKeys.length === 1) ? round(changes.reduce((sum, row) => sum + row.deltaExGst, 0)) : null;
}
const classificationTotals = {};
for (const row of proposalRows) classificationTotals[row.classification] = round((classificationTotals[row.classification] || 0) + row.deltaExGst);

const windowAudits = [
  auditWindowScheduleQuotation(original.workbook, beforeCalculated),
  auditWindowScheduleQuotation(proposal.workbook, afterCalculated),
  auditWindowScheduleQuotation(proposalAgain.workbook, twiceCalculated),
];
const windowSignature = (audit) => ({ selected: audit.selectedItems, pricedRows: audit.pricedOpeningRows, openingCost: audit.openingCost, screenQuantity: audit.flyscreenQuantity, screenCost: audit.flyscreenCost, lines: audit.lines.map((current) => ({ key: current.quantityKey, openingIds: current.openingIds, quantity: current.quotationQuantity, cost: current.extendedCost, duplicateCount: current.duplicateCount, missingPrice: current.missingPrice })) });
assert.deepEqual(windowSignature(windowAudits[0]), windowSignature(windowAudits[1]), 'Proposal must not change opening or screen charges');
assert.deepEqual(windowSignature(windowAudits[1]), windowSignature(windowAudits[2]), 'Repeated proposal must not duplicate opening or screen charges');
assert.equal(windowAudits[0].selectedItems, 30);
assert.equal(windowAudits[0].matchedItems, 28);
assert.equal(windowAudits[0].generatedUnsavedItems, 2);
assert.equal(windowAudits[0].flyscreenCost, 5252.85);
assert.equal(windowAudits[0].duplicatedRows, 0);
const takeoff = windowPriceListTakeoffQuantities(original.workbook);
const selectedWindowRow = (original.workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).find((row) => (row.guidedSelection || row.selected_details || {}).requirementKey === 'windows');
const windowSelection = selectedWindowRow?.guidedSelection || selectedWindowRow?.selected_details || {};
const projectedBoq = quotationSectionsForFinalBoq(beforeCalculated.quotation).flatMap((group) => group.rows);
const windowMappings = takeoff.outcomes.filter((opening) => opening.outcome !== 'elsewhere').map((opening) => {
  const group = windowAudits[0].lines.find((current) => current.openingIds.includes(opening.itemId));
  const quoteIds = new Set(group.matches.map((row) => row.rowId));
  const requirement = (original.workbook.procurement?.items || []).filter((item) => quoteIds.has(item.quoteRowId || item.sourceQuoteRowId));
  const rfq = (windowSelection.procurementSchedule || []).filter((item) => String(item.windowId) === String(opening.itemId));
  return { openingId: opening.itemId, location: opening.location, kind: group.type.startsWith('Glass Sliding Door') ? 'GLAZED_DOOR' : 'WINDOW', type: group.type, heightMm: opening.heightMm, widthMm: opening.widthMm, quantity: opening.quantity, quotation: group.matches, missingPrice: group.missingPrice, boqProjection: projectedBoq.filter((row) => quoteIds.has(row.id)).map((row) => ({ id: row.id, sharedGroupQuantity: quoteQuantity(row) })), savedBoq: (original.savedBoq?.items || []).filter((row) => quoteIds.has(row.source_quote_row_id || row.quoteRowId)), procurement: requirement.map((item) => ({ id: item.id, sharedGroupQuantity: item.qty ?? item.quantity })), supplierRfq: rfq.map((item) => ({ windowId: item.windowId, type: item.type || item.windowType || '', status: item.status || '', supplier: item.supplier || '' })) };
});
assert.equal(new Set(windowMappings.map((opening) => opening.openingId)).size, 30);
assert.equal(windowMappings.filter((opening) => opening.kind === 'WINDOW').length, 26);
assert.equal(windowMappings.filter((opening) => opening.kind === 'GLAZED_DOOR').length, 4);
const windowAcceptance = { status: 'BLOCKED', conventionalWindows: 26, glazedDoors: 4, savedTargetOpenings: 28, unpricedFixedWindows: 2, duplicateChargedGroups: 0, screens: { quantity: windowAudits[0].flyscreenQuantity, costExGst: windowAudits[0].flyscreenCost, changed: false, supplierBundlingApproved: false }, proposalReplayPreservesWindowFinancials: true, savedBoqOpenings: windowMappings.filter((opening) => opening.savedBoq.length).length, projectedBoqOpenings: windowMappings.filter((opening) => opening.boqProjection.length).length, savedProcurementOpenings: windowMappings.filter((opening) => opening.procurement.length).length, supplierRfqOpenings: windowMappings.filter((opening) => opening.supplierRfq.length).length, supplierRfqMissing: windowMappings.filter((opening) => !opening.supplierRfq.length).map(({ openingId, location, type, heightMm, widthMm }) => ({ openingId, location, type, heightMm, widthMm })), source: 'READ_ONLY_PROTECTED_EXPORT; ISOLATED_BROWSER_DOWNSTREAM_SAVE_NOT_REVALIDATED', mappings: windowMappings };

const protectedFiles = [original, isolated, ...await Promise.all([
  'recovery/master-quotation-reconstruction-2026-10-09/fresh-export-20261009-131929/New Job 03 09.gr8job',
  'recovery/master-quotation-reconstruction-2026-10-09/job-file/New Job 03 09.gr8job',
  'recovery/master-quotation-reconstruction-2026-10-09/working-copy/New Job 03 09 - working.gr8job',
].map(async (file) => ({ file, sha256: original.sha256 })))];
for (const source of protectedFiles) assert.equal(hash(fs.readFileSync(source.file)), source.sha256, `Source or backup modified: ${source.file}`);
for (const source of [original, isolated]) assert.equal(hash(JSON.stringify(source.workbook)), source.originalWorkbookHash, 'Input workbook mutated');
const report = { createdAt: new Date().toISOString(), financialAcceptance: 'BLOCKED', sourcesUnchanged: true, sources: protectedFiles.map(({ file, sha256 }) => ({ file, sha256 })), liveProductLibrary: live, masterProducts: master.length, protectedSnapshot, isolatedSnapshot, windowAcceptance, historicalBrowserRevision: { revision: 10, selected: 52, verifiedPriced: 17, blocked: 35, missingProcurement: 15, knownGrossBlockedSelectedValueExGst: 5561.64, status: 'OCTOBER_14_NARRATIVE_EVIDENCE_ONLY; NOT_REVALIDATED_IN_BROWSER', evidence: 'docs/product-library-quotation-integrity-2026-10-14.md' }, proposal: { applied: false, productLookup: 'CURRENT_STATIC_MASTER_AND_TENANT_FILTERED_LIVE_PRODUCT_RECORDS', expectedHistoricalFinalDifference: 49034.12, differences, matchesHistoricalProposal: differences.finalQuoteTotal === 49034.12, rowCount: proposalRows.length, classificationTotals, changes: proposalRows, repeatFinanciallyIdempotent: true, secondPlannerChangeCount: proposalAgain.changes.length }, caveats: ['The protected export, isolated package and historical browser revision are different snapshots; their counts must not be combined.', 'Known selected value is gross required value, not verified missing cost or an approved upgrade; existing allowances and scope need review.', 'No incremental total is approved or certified. Unknown prices and GST remain unknown; no job, BOQ, supplier RFQ or procurement record was issued or updated.', 'Saved BOQ is separate from the calculated quote projection; a local job without a linked commercial snapshot cannot prove a persisted commercial BOQ.', 'Selection schedule identities such as Dowell are not individual priced physical products. The separate 30-opening ledger owns window quantities.', 'Proposal row deltas are totaled once, never summed again across identities with shared scope.'] };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const csv = (value) => `"${String(typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? '').replaceAll('"', '""')}"`;
const columns = ['key', 'productId', 'productName', 'category', 'location', 'outcome', 'quantity', 'unit', 'quantityEvidence', 'productLibrary', 'selectedUnitPrice', 'priceIncludesGst', 'quoteRowIds', 'savedQuotationRows', 'calculatedCanonicalRows', 'existingAllowancesAndPossibleOverlaps', 'boqProjection', 'savedCommercialBoq', 'procurementRequirements', 'blockers', 'financial', 'proposalChangeIds'];
for (const [name, snapshot] of [['protected', protectedSnapshot], ['isolated', isolatedSnapshot]]) fs.writeFileSync(path.join(output, `${name}-52-identities.csv`), [columns.map(csv).join(','), ...snapshot.entries.map((entry) => columns.map((column) => csv(entry[column])).join(','))].join('\n'));
const changeColumns = ['changeId', 'classification', 'before', 'proposed', 'deltaExGst', 'selectedIdentityKeys', 'attribution', 'applied'];
fs.writeFileSync(path.join(output, 'proposal-row-changes.csv'), [changeColumns.map(csv).join(','), ...proposalRows.map((entry) => changeColumns.map((column) => csv(entry[column])).join(','))].join('\n'));
const windowColumns = ['openingId', 'location', 'kind', 'type', 'heightMm', 'widthMm', 'quantity', 'quotation', 'missingPrice', 'boqProjection', 'savedBoq', 'procurement', 'supplierRfq'];
fs.writeFileSync(path.join(output, 'thirty-opening-downstream.csv'), [windowColumns.map(csv).join(','), ...windowMappings.map((entry) => windowColumns.map((column) => csv(entry[column])).join(','))].join('\n'));
console.log(JSON.stringify({ report: path.join(output, 'report.json'), liveProductLibrary: live, snapshots: [protectedSnapshot, isolatedSnapshot].map(({ jobId, rows, selected, auditVerifiedPriced, strictPositiveQuoteEvidence, blocked, missingProcurement, missingSavedCommercialBoq, knownGrossBlockedSelectedValueExGst }) => ({ jobId, rows, selected, auditVerifiedPriced, strictPositiveQuoteEvidence, blocked, missingProcurement, missingSavedCommercialBoq, knownGrossBlockedSelectedValueExGst })), proposal: { differences, classificationTotals, rows: proposalRows.length, applied: false }, sourcesUnchanged: true }, null, 2));