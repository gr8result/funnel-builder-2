import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';
import { planSelectionReconciliation } from '../lib/builders/selectionReconciliation.js';
import { refreshSelectionProcurementRequirements } from '../lib/builders/selectionProcurementRequirements.js';
import { SCHEDULE_REQUIREMENTS } from '../lib/builders/quotationTargetResolver.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';

const jobPath = path.resolve(process.argv[2] || 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job');
const reportPath = path.resolve(process.argv[3] || 'artifacts/test-artifacts/product-selection-integrity/product-blockers-before.json');
const planReportPath = process.argv[4] ? path.resolve(process.argv[4]) : '';
const copyPath = process.argv[5] ? path.resolve(process.argv[5]) : '';
assert(!copyPath || copyPath !== jobPath, 'The proposal copy must never overwrite the source job.');
const sourceBytes = fs.readFileSync(jobPath);
const sourceSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
const archive = await JSZip.loadAsync(sourceBytes);
const estimate = JSON.parse(await archive.file('estimate.json').async('string'));
const workbook = estimate.workbook;
const selectionsFile = archive.file('client-selections.json');
const selectionsPayload = selectionsFile ? JSON.parse(await selectionsFile.async('string')) : {};
const book = workbook.clientSelectionsBook || selectionsPayload.book || workbook.selectionsBook || { rooms: [] };
const selectionRowsById = new Map((book.rooms || []).flatMap((room) => (room.rows || []).map((row) => [row.id, row])));
const masterProducts = getMasterProducts(workbook.workspaceId || '');
const productsByIdentity = new Map();
for (const product of masterProducts) {
  for (const key of [product.productId, product.productCode, product.stableProductId, product.productCodeStable]) {
    if (key) productsByIdentity.set(String(key), product);
  }
}
const productById = (id) => productsByIdentity.get(String(id || '')) || null;
const quotationEvidence = calculateEstimateBuilderWorkbook(structuredClone(workbook)).quotation;
const workbookWithQuotationEvidence = { ...workbook, quotation: quotationEvidence };
const audit = reconcileProductSelections({ workbook: workbookWithQuotationEvidence, book, productById });
const quotationRows = Object.entries(quotationEvidence || {}).flatMap(([section, group]) =>
  (group.rows || []).map((row) => ({ section, row })));
const procurementRows = workbook.procurement?.items || [];
const accepted = new Set(['PRICED_IN_QUOTE', 'VERIFIED_INCLUDED_IN_PACKAGE', 'VERIFIED_REPLACEMENT']);

function rowProductIds(row) {
  return [row.productId, row.activeProductId, row.selectedProductId, row.selectionSpecProductId,
    row.productLibrarySnapshot?.productId, ...(row.productIds || []),
    ...(row.selectedProducts || []).map((item) => item.productId || item.id)].filter(Boolean).map(String);
}

function classify(entry, catalogueProduct) {
  if (!entry.productId) return { cause: 'MISSING_CANONICAL_PRODUCT_ID', confidence: 'confirmed' };
  if (entry.outcome === 'BLOCKED_UNVERIFIED_BASELINE') return { cause: 'REPLACEMENT_BASELINE_UNVERIFIED', confidence: 'confirmed' };
  if (entry.targetReason === 'CONFLICTING_PRODUCT_ON_ROW') return { cause: 'QUOTATION_ROW_CONTAINS_DIFFERENT_PRODUCT', confidence: 'confirmed' };
  if (entry.targetStatus === 'VERIFIED_NEW_ROW' && entry.outcome === 'BLOCKED_MISSING_TARGET') return { cause: 'NEW_QUOTATION_ROW_REQUIRES_CONFIRMATION', confidence: 'confirmed' };
  if (!catalogueProduct && (SCHEDULE_REQUIREMENTS.has(entry.requirementKey) || /(?:^|[-_:])schedule(?:$|[-_:])/i.test(entry.productId))) {
    return { cause: 'LEGACY_SCHEDULE_SENTINEL_NOT_MASTER_PRODUCT', confidence: 'confirmed', caveat: 'Schedule sentinel identity; resolve by synchronizing its owning schedule, not by inventing a catalogue product.' };
  }
  if (!catalogueProduct && (/package|bundle/i.test(entry.productId) || entry.procurementStatus === 'INCLUDED_IN_EXISTING_SUBCONTRACT')) {
    return { cause: 'COMPOSITE_OR_SUBCONTRACT_BUNDLE_IDENTITY', confidence: 'confirmed', caveat: 'Composite identity is represented by a specification/subcontract; it is not expected to be a single master SKU.' };
  }
  if (!catalogueProduct) return { cause: 'IDENTITY_NOT_IN_SHIPPED_MASTER_CATALOGUE', confidence: 'unresolved', caveat: 'Could be a tenant-private product or stale legacy identity; tenant ownership cannot be proven from this offline package.' };
  if (entry.outcome === 'BLOCKED_AMBIGUOUS_MAPPING' || ['AMBIGUOUS_TARGETS', 'TRADE_SECTION_AMBIGUOUS'].includes(entry.targetReason)) {
    return { cause: 'AMBIGUOUS_QUOTATION_MAPPING', confidence: 'confirmed' };
  }
  if (entry.outcome === 'BLOCKED_MISSING_PRICE') return { cause: 'MISSING_VERIFIED_PRICE_OR_GST_BASIS', confidence: 'confirmed' };
  if (entry.targetReason === 'STALE_MAPPING') return { cause: 'STALE_QUOTATION_MAPPING', confidence: 'confirmed' };
  if (entry.targetReason === 'TRADE_SECTION_MISSING') return { cause: 'REQUIRED_QUOTATION_SECTION_MISSING', confidence: 'confirmed' };
  if (entry.targetReason === 'NO_OPTION_ROW') return { cause: 'NO_MATCHING_QUOTATION_OPTION_ROW', confidence: 'confirmed' };
  if (entry.targetReason === 'QUANTITY_REQUIRED') return { cause: 'QUOTATION_QUANTITY_REQUIRED', confidence: 'confirmed' };
  if (entry.targetReason === 'SCHEDULE_NOT_SYNCED' || entry.targetReason === 'NO_EXISTING_SYNC') {
    return { cause: 'REQUIRED_SELECTION_SCHEDULE_NOT_SYNCED', confidence: 'confirmed' };
  }
  if (entry.procurementStatus === 'PRICED_NOT_APPROVED') return { cause: 'PROCUREMENT_APPROVAL_OR_REPRESENTATION_REQUIRED', confidence: 'confirmed' };
  if (entry.targetStatus === 'PROPOSED_MAPPING') return { cause: 'SUGGESTED_QUOTATION_TARGET_NOT_CONFIRMED', confidence: 'confirmed' };
  if (entry.targetStatus === 'REVIEW_REQUIRED') return { cause: `QUOTATION_TARGET_REVIEW_REQUIRED:${entry.targetReason || 'UNSPECIFIED'}`, confidence: 'confirmed' };
  return { cause: `UNRESOLVED:${entry.outcome}`, confidence: 'confirmed' };
}

const unresolved = audit.entries.filter((entry) => !accepted.has(entry.outcome)).map((entry) => {
  const catalogueProduct = productsByIdentity.get(String(entry.productId || '')) || null;
  const sourceRow = selectionRowsById.get(entry.rowId) || null;
  const savedSelection = sourceRow?.guidedSelection || sourceRow?.selected_details || sourceRow?.selectedDetails || {};
  const relatedQuoteRows = quotationRows.filter(({ row }) => rowProductIds(row).includes(String(entry.productId || ''))
    || (entry.quoteRowIds || []).includes(row.id));
  const relevantMappings = (workbook.quoteTargetMappings || []).filter((mapping) =>
    (mapping.product_id || mapping.metadata?.productId) === entry.productId
    || (mapping.requirement_key || mapping.metadata?.requirementKey) === entry.requirementKey);
  const procurement = procurementRows.filter((item) => item.productId === entry.productId
    || relatedQuoteRows.some(({ row }) => item.id === row.id || item.quoteRowId === row.id || item.sourceQuoteRowId === row.id));
  return {
    productId: entry.productId || null,
    productCode: entry.productCode || null,
    productName: entry.productName || null,
    requirementKey: entry.requirementKey || null,
    location: entry.location || null,
    quantity: entry.quantity ?? null,
    selectedUnitPrice: entry.selectedUnitPrice ?? null,
    priceIncludesGst: entry.priceIncludesGst ?? null,
    outcome: entry.outcome,
    targetStatus: entry.targetStatus,
    targetReason: entry.targetReason || null,
    procurementStatus: entry.procurementStatus,
    secondaryBlockers: {
      priceVerified: entry.priceVerified,
      quantityVerified: entry.quantityVerified,
      procurementRepresented: entry.procurementRepresented,
      procurementIssue: entry.procurementIssue,
      baselineVerified: entry.baselineVerified,
      productReferenceInvalid: entry.productReferenceInvalid,
    },
    savedSelection: {
      rowId: sourceRow?.id || null,
      quantity: savedSelection.quantity ?? null,
      selectedPrice: savedSelection.selectedPrice ?? null,
      priceIncludesGst: savedSelection.priceIncludesGst ?? null,
      lightingSchedule: (savedSelection.lightingSchedule || []).map((line) => ({
        sku: line.sku || null, quantity: line.quantity ?? null,
        location: line.exactLocation || line.roomOrExteriorArea || null, productName: line.productName || null,
      })),
      procurementSchedule: (savedSelection.procurementSchedule || []).map((line) => ({
        sku: line.sku || null, quantity: line.quantity ?? null,
        unitPrice: line.unitPrice ?? null, priceIncludesGst: line.priceIncludesGst ?? null,
        supplier: line.supplier || null,
      })),
    },
    catalogueIdentity: catalogueProduct ? {
      productId: catalogueProduct.productId || null,
      productCode: catalogueProduct.productCode || null,
      name: catalogueProduct.productName || catalogueProduct.name || null,
      sourceType: catalogueProduct.sourceType || null,
      priceStatus: catalogueProduct.priceStatus || null,
      clientPrice: catalogueProduct.clientPrice ?? null,
      gstIncluded: catalogueProduct.gstIncluded ?? null,
    } : null,
    quotationRows: relatedQuoteRows.map(({ section, row }) => ({
      section, rowId: row.id || null, productIds: rowProductIds(row), item: row.item || null,
      quantity: row.qty ?? row.quantity ?? null, rate: row.finalRateUsed ?? row.excelRate ?? null,
      priceStatus: row.priceStatus || null, quoteRequired: row.quoteRequired === true,
    })),
    mappings: relevantMappings.map((mapping) => ({
      status: mapping.status, requirement: mapping.requirement_key || mapping.metadata?.requirementKey || null,
      productId: mapping.product_id || mapping.metadata?.productId || null,
      section: mapping.quote_section_id || null, rowId: mapping.quote_row_id || null,
      workspaceId: mapping.workspace_id || null,
    })),
    procurementRows: procurement.map((item) => ({
      id: item.id || null, productId: item.productId || null, supplier: item.supplier || null,
      quantity: item.qty ?? item.quantity ?? null, unit: item.unit || null,
      status: item.orderStatus || item.deliveryStatus || item.status || null,
    })),
    ...classify(entry, catalogueProduct),
  };
});

const causeCounts = Object.fromEntries([...unresolved.reduce((counts, entry) => counts.set(entry.cause, (counts.get(entry.cause) || 0) + 1), new Map())].sort());
const afterSha256 = crypto.createHash('sha256').update(fs.readFileSync(jobPath)).digest('hex');
assert.equal(afterSha256, sourceSha256, 'the isolated job source bytes must remain unchanged');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  evidenceType: 'offline isolated saved-job reconciliation; not live tenant acceptance',
  jobPath, jobId: workbook.jobId, workspaceId: workbook.workspaceId,
  sourceSha256, sourceUnchanged: true,
  selectedCount: audit.entries.length, unresolvedCount: unresolved.length, causeCounts,
  duplicateCounts: {
    selectionIdentities: audit.duplicateSelectionIdentities?.length || 0,
    quoteClaims: audit.duplicates.length,
    procurementRequirements: audit.procurementDuplicates.length,
  },
  tenantMismatchStatus: 'NOT_PROVABLE_FROM_OFFLINE_PACKAGE',
  unresolved,
}, null, 2));
let plannedAfter = null;
if (planReportPath) {
  const plan = planSelectionReconciliation({ workbook, book, productById, quotationEvidence });
  let afterWorkbook = plan.workbook;
  const afterCalculation = calculateEstimateBuilderWorkbook(structuredClone(afterWorkbook));
  afterWorkbook = { ...afterWorkbook, quotation: afterCalculation.quotation };
  afterWorkbook = refreshSelectionProcurementRequirements(
    afterWorkbook,
    afterCalculation,
    afterWorkbook.procurement?.items || [],
    { productById, productByCode: productById },
  );
  const afterBook = afterWorkbook.clientSelectionsBook || book;
  const afterAudit = reconcileProductSelections({ workbook: afterWorkbook, book: afterBook, productById });
  const afterUnresolved = afterAudit.entries.filter((entry) => !accepted.has(entry.outcome));
  const afterCauses = afterUnresolved.map((entry) => ({
    productId: entry.productId || null, productName: entry.productName || null,
    requirementKey: entry.requirementKey || null, outcome: entry.outcome,
    targetStatus: entry.targetStatus, targetReason: entry.targetReason || null,
    procurementStatus: entry.procurementStatus,
    ...classify(entry, productById(entry.productId)),
  }));
  plannedAfter = {
    evidenceType: 'in-memory planner dry-run only; no builder confirmation or job persistence',
    jobId: workbook.jobId, sourceSha256, sourceUnchanged: true,
    selectedCount: afterAudit.entries.length, unresolvedCount: afterUnresolved.length,
    duplicateCounts: {
      selectionIdentities: afterAudit.duplicateSelectionIdentities?.length || 0,
      quoteClaims: afterAudit.duplicates.length,
      procurementRequirements: afterAudit.procurementDuplicates.length,
    },
    causeCounts: Object.fromEntries([...afterCauses.reduce((counts, entry) => counts.set(entry.cause, (counts.get(entry.cause) || 0) + 1), new Map())].sort()),
    quotationRowsBefore: quotationRows.length,
    quotationRowsAfter: Object.values(afterWorkbook.quotation || {}).reduce((sum, section) => sum + (section.rows || []).length, 0),
    procurementRowsBefore: procurementRows.length,
    procurementRowsAfter: (afterWorkbook.procurement?.items || []).length,
    automaticChanges: plan.changes || [],
    pendingProposals: plan.proposals || [],
    unresolved: afterCauses,
  };
  if (copyPath) {
    const afterEstimate = { ...estimate, workbook: afterWorkbook };
    archive.file('estimate.json', JSON.stringify(afterEstimate));
    if (selectionsFile) archive.file('client-selections.json', JSON.stringify({ ...selectionsPayload, book: afterBook }));
    fs.mkdirSync(path.dirname(copyPath), { recursive: true });
    const copyBytes = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    fs.writeFileSync(copyPath, copyBytes);
    plannedAfter.evidenceType = 'isolated reconciled job copy; source untouched; generated by existing selection connectors and current catalogue evidence; no human confirmation supplied';
    plannedAfter.copyPath = copyPath;
    plannedAfter.copySha256 = crypto.createHash('sha256').update(copyBytes).digest('hex');
    fs.writeFileSync(planReportPath, JSON.stringify(plannedAfter, null, 2));
  }
  fs.mkdirSync(path.dirname(planReportPath), { recursive: true });
  fs.writeFileSync(planReportPath, JSON.stringify(plannedAfter, null, 2));
}
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(jobPath)).digest('hex'), sourceSha256, 'Planner and proposal output must leave source bytes unchanged');
console.log(JSON.stringify({ jobId: workbook.jobId, selected: audit.entries.length, unresolved: unresolved.length, causeCounts, reportPath, plannedAfter: plannedAfter ? { unresolved: plannedAfter.unresolvedCount, quotationRowsBefore: plannedAfter.quotationRowsBefore, quotationRowsAfter: plannedAfter.quotationRowsAfter, procurementRowsBefore: plannedAfter.procurementRowsBefore, procurementRowsAfter: plannedAfter.procurementRowsAfter, reportPath: planReportPath, copyPath: plannedAfter.copyPath || null } : null }, null, 2));