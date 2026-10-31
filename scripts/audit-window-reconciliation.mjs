import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';
import { auditWindowScheduleQuotation, selectionReconciliationReports } from '../lib/builders/selectionReconciliationReport.js';
import { planSelectionReconciliation } from '../lib/builders/selectionReconciliation.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quotationSectionsForFinalBoq, quoteQuantity, quoteRate, quoteLineTotal } from '../lib/construction-estimation/finalQuotationBoq.js';
import { windowPriceListTakeoffQuantities } from '../lib/construction-estimation/windowsQuotePriceList.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

const source = process.argv[2] || 'C:/Users/grant/Downloads/New Job 03 09.gr8job';
const output = path.resolve('artifacts/test-artifacts/window-reconciliation-audit');
const bytes = fs.readFileSync(source);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const zip = await JSZip.loadAsync(bytes);
const workbook = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
const initialSignature = hash(JSON.stringify(workbook));
const stages = [structuredClone(workbook)];
const first = planSelectionReconciliation({ workbook: structuredClone(workbook) });
stages.push(first.workbook);
const second = planSelectionReconciliation({ workbook: structuredClone(first.workbook) });
stages.push(second.workbook);
const products = new Map(getMasterProducts().map((product) => [product.productId, product]));
const applicationEquivalent = planSelectionReconciliation({ workbook: structuredClone(workbook), productById: (id) => products.get(id) || null });
stages.push(applicationEquivalent.workbook);
const snapshots = stages.map((stage) => {
  const calculated = calculateEstimateBuilderWorkbook(structuredClone(stage));
  const occurrences = new Map();
  const calculatedRows = Object.entries(calculated.quotation).flatMap(([section, group]) => {
    return group.rows.map((row) => {
      const occurrence = occurrences.get(row.id) || 0;
      occurrences.set(row.id, occurrence + 1);
      return { section, id: row.id, occurrence, item: row.item, productId: row.productId || row.activeProductId || '', quantityKey: row.quantityKey || '', quantity: quoteQuantity(row), unit: row.unit, rate: quoteRate(row), cost: quoteLineTotal(row), source: row.source || row.sourceOfRate || '', supplier: row.supplier || '', quoteRequired: row.quoteRequired === true, manualRate: row.manualRate, quantityManualOverride: row.quantityManualOverride === true };
    });
  });
  return { audit: auditWindowScheduleQuotation(stage, calculated), summary: calculated.summary, calculatedRows, reports: selectionReconciliationReports(stage, calculated), boq: quotationSectionsForFinalBoq(calculated.quotation).flatMap((section) => section.rows.filter((row) => String(row.quantityKey || '').startsWith('windowPriceList:')).map((row) => ({ section: section.sectionKey, id: row.id, quantity: row.qty, cost: row.cost }))) };
});
const financialSnapshot = (snapshot) => ({ lines: snapshot.audit.lines.map((line) => ({ key: line.quantityKey, quantity: line.quotationQuantity, cost: line.extendedCost, matches: line.matches.map((row) => ({ id: row.rowId, quantity: row.quantity, rate: row.rate, cost: row.cost })) })), boq: snapshot.boq, screens: { quantity: snapshot.audit.flyscreenQuantity, cost: snapshot.audit.flyscreenCost } });
assert.deepEqual(financialSnapshot(snapshots[1]), financialSnapshot(snapshots[0]), 'first reconciliation must not change window IDs, quantities, rates, costs or BOQ');
assert.deepEqual(financialSnapshot(snapshots[2]), financialSnapshot(snapshots[1]), 'second reconciliation must not change windows or BOQ');
for (const field of ['purchaseOrders', 'cashflowPayments', 'jobInclusionSnapshot', 'jobInclusionScheduleId', 'jobInclusionScheduleVersion']) {
  assert.deepEqual(stages[1][field], workbook[field], `${field} must remain unchanged`);
  assert.deepEqual(stages[2][field], workbook[field], `${field} must remain unchanged on replay`);
}
assert.equal(hash(JSON.stringify(workbook)), initialSignature, 'audit must not mutate the original workbook');
assert.equal(hash(fs.readFileSync(source)), hash(bytes), 'protected package bytes must remain unchanged');
assert.equal(snapshots[0].audit.duplicatedRows, 0, 'actual saved window rows must not be duplicated');
assert(snapshots[0].reports.every((report) => report.diagnostics.length <= 8), 'report diagnostics must be bounded');
if (workbook.jobId === 'recovered-03-09-123') {
  assert.equal(snapshots[0].audit.selectedItems, 30, 'actual window/glazed-door schedule contains 30 openings');
  assert.equal(snapshots[0].audit.matchedItems, 28, 'only 28 openings have saved quotation targets');
  assert.equal(snapshots[0].audit.generatedUnsavedItems, 2, 'two fixed-window calculation placeholders are not saved rows');
  assert.equal(snapshots[0].audit.pricedOpeningRows, 12, 'only twelve opening rows are charged');
}
const sample = snapshots[0].audit.lines.find((line) => line.extendedCost > 0);
const duplicateRow = { id: sample.matches[0].rowId, quantityKey: sample.quantityKey, quantity: sample.quotationQuantity, finalRateUsed: sample.matches[0].rate, cost: sample.extendedCost };
const duplicateProbe = auditWindowScheduleQuotation(workbook, { quotation: { Audit: { rows: [duplicateRow, { ...duplicateRow, id: 'isolated-duplicate-probe' }] } } }).lines.find((line) => line.quantityKey === sample.quantityKey);
assert.equal(duplicateProbe.duplicateCount, 1, 'report detects a second charged row for the same actual type/dimensions');
assert.equal(duplicateProbe.excessQuantity, sample.scheduleQuantity, 'report detects multiplied quantities independently of stable row IDs');
const savedBoq = JSON.parse(await zip.file('boq.json').async('string'));
const savedProcurement = JSON.parse(await zip.file('procurement.json').async('string'));
const round = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const selection = (workbook.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.requirementKey === 'windows')?.guidedSelection || {};
const inclusionEvidence = [];
function inclusionText(value, sourcePath) {
  if (typeof value === 'string' && value.length < 6000 && /flyscreen|fly screen|barrier screen/i.test(value)) inclusionEvidence.push({ sourcePath, text: value });
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) inclusionText(entry, `${sourcePath}.${key}`);
}
inclusionText(workbook.standardInclusions, 'workbook.standardInclusions');
inclusionText(workbook.estimateInclusions, 'workbook.estimateInclusions');
const flyscreenRows = snapshots[0].calculatedRows.filter((row) => row.quantityKey.startsWith('windowPriceList:flyscreen|') && row.quantity > 0).map((row) => {
  const openingKey = row.quantityKey.replace('windowPriceList:flyscreen|', 'windowPriceList:window|');
  const opening = snapshots[0].audit.lines.find((line) => line.quantityKey === openingKey);
  return { ...row, openingQuoteRows: opening?.matches.map((match) => match.rowId) || [], openingIds: opening?.openingIds || [], heightMm: opening?.heightMm, widthMm: opening?.widthMm, scope: opening?.type?.startsWith('Glass Sliding Door') ? 'GLAZED_DOOR_SCREEN_SPECIFICATION_REVIEW' : 'WINDOW_INSECT_SCREEN', selectedSupplier: selection.supplier || '', screenSelection: selection.screens || '', inclusionBasis: 'Saved standard-inclusions text and selected screen specification; supplier bundling unverified', supplierPackageIncludesScreens: null };
});
assert.equal(round(flyscreenRows.reduce((sum, row) => sum + row.cost, 0)), snapshots[0].audit.flyscreenCost, 'flyscreen ledger must reconcile exactly');
const fixedWindowBlockers = snapshots[0].audit.lines.filter((line) => line.missingPrice).map((line) => ({ code: 'WINDOW_PRICE_REQUIRED', quotationBlocked: true, type: line.type, heightMm: line.heightMm, widthMm: line.widthMm, quantity: line.scheduleQuantity, openingIds: line.openingIds, locations: line.locations, selectedSupplier: selection.supplier || null, verifiedRateSupplier: null, requiredUnitRate: null, quoteRows: line.matches.map((row) => ({ id: row.rowId, saved: row.saved, rate: null })) }));
const takeoff = windowPriceListTakeoffQuantities(workbook);
const browserReportPath = path.join(output, 'browser-report.json');
const browserEvidence = fs.existsSync(browserReportPath) ? JSON.parse(fs.readFileSync(browserReportPath, 'utf8')) : null;
const isolatedMappingEvidence = browserEvidence?.protectedSourceHash === hash(bytes) && browserEvidence?.saveResult?.ok === true ? browserEvidence : null;
const openingMappings = takeoff.outcomes.filter((opening) => opening.outcome !== 'elsewhere').map((opening) => {
  const line = snapshots[0].audit.lines.find((line) => line.openingIds.includes(opening.itemId));
  const quote = line.matches[0];
  const boq = snapshots[0].boq.filter((item) => item.id === quote?.rowId);
  const procurement = (workbook.procurement?.items || []).filter((item) => item.quoteRowId === quote?.rowId && !item.removedFromQuote);
  const supplierRows = (selection.procurementSchedule || []).filter((item) => String(item.windowId) === String(opening.itemId));
  const isolatedGroup = isolatedMappingEvidence?.procurementMapping?.find((item) => item.quoteRowId === quote?.rowId);
  return { openingId: opening.itemId, location: opening.location, kind: line.type.startsWith('Glass Sliding Door') ? 'GLAZED_DOOR' : 'WINDOW', type: line.type, heightMm: opening.heightMm, widthMm: opening.widthMm, quantity: opening.quantity, quoteRowId: quote?.rowId || null, quotationSaved: quote?.saved === true, sharedQuoteGroupQuantity: line.quotationQuantity, quotedUnitRate: line.missingPrice ? null : quote.rate, boqProjectionRowId: boq[0]?.id || null, boqProjectionGroupQuantity: boq[0]?.quantity || null, savedBoqIds: (savedBoq.items || []).filter((item) => [item.source_quote_row_id, item.quoteRowId].includes(quote?.rowId)).map((item) => item.id), savedProcurementIds: procurement.map((item) => item.id), isolatedCopyProcurement: isolatedGroup ? { jobId: isolatedMappingEvidence.jobId, savedRevision: isolatedMappingEvidence.saveResult.revision, items: isolatedGroup.procurement } : null, supplierRfqEntries: supplierRows.map((item) => ({ windowId: item.windowId, supplier: item.supplier, screen: item.screen, status: item.status })), procurementStatus: procurement.length ? 'SAVED_REQUIREMENT' : 'REFRESH_EXISTING_QUOTATION_PROCUREMENT_REQUIRED', duplicateSupplyRows: line.duplicateCount, quotationBlocker: line.missingPrice ? 'WINDOW_PRICE_REQUIRED' : null };
});
assert.equal(openingMappings.reduce((sum, item) => sum + item.quantity, 0), 30, 'all thirty opening quantities must be mapped once');
assert.equal(new Set(openingMappings.map((item) => item.openingId)).size, openingMappings.length, 'physical opening identity must never be duplicated');
assert.equal(openingMappings.filter((item) => item.kind === 'WINDOW').reduce((sum, item) => sum + item.quantity, 0), 26);
assert.equal(openingMappings.filter((item) => item.kind === 'GLAZED_DOOR').reduce((sum, item) => sum + item.quantity, 0), 4);
const rowKey = (row) => `${row.id}\u0000${row.occurrence}`;
const priorRows = new Map(snapshots[0].calculatedRows.map((row) => [rowKey(row), row]));
function explainChanges(snapshot, trackedChanges) {
  const proposedRows = new Map(snapshot.calculatedRows.map((row) => [rowKey(row), row]));
  return [...new Set([...priorRows.keys(), ...proposedRows.keys()])].flatMap((key) => {
  const before = priorRows.get(key), after = proposedRows.get(key);
  const financialFields = (row) => ({ quantity: row?.quantity || 0, rate: row?.rate || 0, cost: row?.cost || 0, productId: row?.productId || '' });
  if (JSON.stringify(financialFields(before)) === JSON.stringify(financialFields(after))) return [];
  if ((before?.quantityKey || after?.quantityKey || '').startsWith('windowPriceList:')) return [];
  const row = after || before;
  const trackedChange = trackedChanges.find((change) => change.rowId === row.id);
  const representation = snapshots[0].calculatedRows.filter((entry) => entry.cost > 0 && (entry.id === row.id || (row.productId && entry.productId === row.productId))).map((entry) => ({ id: entry.id, section: entry.section, quantity: entry.quantity, rate: entry.rate, cost: entry.cost }));
  return [{ id: row.id, occurrence: row.occurrence, product: row.item, productId: row.productId, section: row.section, before: before || null, proposed: after || null, currentQuotationRepresentation: representation, baseCostDifference: round((after?.cost || 0) - (before?.cost || 0)), reason: !before ? `Proposed connector row from ${row.source || 'quotation normalisation'}; not approved` : !after ? 'Connector removes or re-homes an existing quotation row occurrence; compare matching IDs across sections' : `${trackedChange?.kind || 'UPDATED'} by existing selection connector; ${before.quantity !== after.quantity ? 'quantity changed' : before.rate !== after.rate ? 'rate changed' : 'metadata or product mapping changed'}`, applied: false }];
  });
}
const nonWindowChanges = explainChanges(snapshots[1], first.changes);
const applicationEquivalentChanges = explainChanges(snapshots[3], applicationEquivalent.changes);
const baseDifference = round(snapshots[1].summary.baseLineItemSubtotal - snapshots[0].summary.baseLineItemSubtotal);
assert.equal(round(nonWindowChanges.reduce((sum, item) => sum + item.baseCostDifference, 0)), baseDifference, 'every cent of non-window base delta must be explained by actual calculated rows');
const adjustmentDifferences = Object.fromEntries(['baseLineItemSubtotal', 'preliminaryCostsAmount', 'overheadsAmount', 'marginAmount', 'profitAmount', 'gst', 'qbsaRegistration', 'qLeaveFees', 'salesCommissionAmount', 'finalQuoteTotal'].map((key) => [key, round((snapshots[1].summary[key] || 0) - (snapshots[0].summary[key] || 0))]));
const applicationEquivalentDifferences = Object.fromEntries(Object.keys(adjustmentDifferences).map((key) => [key, round((snapshots[3].summary[key] || 0) - (snapshots[0].summary[key] || 0))]));
assert.equal(round(applicationEquivalentChanges.reduce((sum, item) => sum + item.baseCostDifference, 0)), applicationEquivalentDifferences.baseLineItemSubtotal, 'Product Library-backed proposal must also reconcile to the cent');
assert.deepEqual(financialSnapshot(snapshots[3]), financialSnapshot(snapshots[0]), 'Product Library-backed proposal must not change windows or screens');
const preservation = Object.fromEntries(['quotation', 'quotationSectionOrder', 'cashflowPayments', 'purchaseOrders', 'jobInclusionSnapshot'].map((key) => [key, hash(JSON.stringify(workbook[key] ?? null))]));
fs.mkdirSync(output, { recursive: true });
const report = { source, jobId: workbook.jobId, sourceHash: hash(bytes), protectedUnchanged: true, preservation, inclusionEvidence, flyscreenRows, supplierPackageIncludesScreens: null, fixedWindowBlockers, openingMappings, selectedWindowProcurementSchedule: selection.procurementSchedule || [], nonWindowChanges, adjustmentDifferences, originalProposalProductLookup: 'NOT_SUPPLIED', applicationEquivalentProposal: { lookup: 'getMasterProducts() as used by workbook hook; no live private overrides fetched', applied: false, differences: applicationEquivalentDifferences, changes: applicationEquivalentChanges }, savedBoq, savedProcurement, snapshots, firstChanges: first.changes, secondChanges: second.changes, wholeQuotationDifference: adjustmentDifferences.finalQuoteTotal, windowDifference: Math.round((snapshots[1].audit.openingCost + snapshots[1].audit.flyscreenCost - snapshots[0].audit.openingCost - snapshots[0].audit.flyscreenCost) * 100) / 100, caveats: ['Calculated clone quantities are separate from blank persisted catalogue quantities.', 'BOQ data is the actual calculated saved-quotation projection, not a verified commercial snapshot.', 'Flyscreens have saved inclusion/specification evidence, but supplier bundling and glazed-door barrier-screen equivalence remain unverified.', 'The earlier 28,988.88 proposal omitted the Product Library lookup; use the separately reported application-equivalent proposal, not that artefact, for further review.'] };
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = ['id', 'occurrence', 'product', 'section', 'beforeQuantity', 'beforeRate', 'beforeCost', 'proposedQuantity', 'proposedRate', 'proposedCost', 'baseCostDifference', 'currentQuotationRepresentation', 'reason'];
function writeLedger(fileName, entries) {
  const csvRows = entries.map((entry) => ({ ...entry, currentQuotationRepresentation: JSON.stringify(entry.currentQuotationRepresentation), beforeQuantity: entry.before?.quantity, beforeRate: entry.before?.rate, beforeCost: entry.before?.cost, proposedQuantity: entry.proposed?.quantity, proposedRate: entry.proposed?.rate, proposedCost: entry.proposed?.cost }));
  fs.writeFileSync(path.join(output, fileName), [columns, ...csvRows.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvValue).join(',')).join('\n'));
}
writeLedger('non-window-proposed-changes.csv', nonWindowChanges);
writeLedger('non-window-application-equivalent-changes.csv', applicationEquivalentChanges);
const mappingColumns = ['openingId', 'location', 'kind', 'type', 'heightMm', 'widthMm', 'quantity', 'quoteRowId', 'quotationSaved', 'sharedQuoteGroupQuantity', 'quotedUnitRate', 'boqProjectionRowId', 'savedBoqIds', 'savedProcurementIds', 'isolatedCopyProcurement', 'quotationBlocker'];
fs.writeFileSync(path.join(output, 'thirty-opening-mapping.csv'), [mappingColumns, ...openingMappings.map((item) => mappingColumns.map((key) => typeof item[key] === 'object' ? JSON.stringify(item[key]) : item[key]))].map((row) => row.map(csvValue).join(',')).join('\n'));
console.log(JSON.stringify({ jobId: workbook.jobId, sourceHash: report.sourceHash, protectedUnchanged: true, audit: { ...snapshots[0].audit, lines: snapshots[0].audit.lines.map((line) => ({ ...line, openingIds: undefined, locations: undefined })) }, wholeQuotationDifference: report.wholeQuotationDifference, windowDifference: report.windowDifference, secondChangeCount: second.changes.length, reportPath: path.join(output, 'report.json') }, null, 2));