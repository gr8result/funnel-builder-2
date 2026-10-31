import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { selectionIdentitiesFromBook } from '../lib/builders/quotationTargetResolver.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quoteLineTotal, quoteQuantity, quoteRate } from '../lib/construction-estimation/finalQuotationBoq.js';

const [beforePath, afterPath] = process.argv.slice(2);
assert(beforePath && afterPath, 'Pass the original isolated .gr8job and reconciled-copy .gr8job paths.');
const reportPath = process.argv[4] ? path.resolve(process.argv[4]) : '';
const read = async (filePath) => {
  const bytes = fs.readFileSync(filePath);
  const archive = await JSZip.loadAsync(bytes);
  const estimate = JSON.parse(await archive.file('estimate.json').async('string'));
  const selectionFile = archive.file('client-selections.json');
  const selectionPayload = selectionFile ? JSON.parse(await selectionFile.async('string')) : {};
  const workbook = estimate.workbook;
  const book = workbook.clientSelectionsBook || selectionPayload.book || workbook.selectionsBook || { rooms: [] };
  return { bytes, archive, estimate, workbook, book };
};
const before = await read(beforePath);
const after = await read(afterPath);
const rows = (workbook) => Object.entries(workbook.quotation || {}).flatMap(([section, group]) =>
  (group.rows || []).map((row) => ({ section, row })));
const beforeRows = rows(before.workbook);
const afterRows = rows(after.workbook);
const afterRowIds = new Set(afterRows.map(({ row }) => row.id));
const beforeRowIds = new Set(beforeRows.map(({ row }) => row.id));
const addedRows = afterRows.filter(({ row }) => !beforeRowIds.has(row.id));
const removedRows = beforeRows.filter(({ row }) => !afterRowIds.has(row.id));
const retainedRows = beforeRows.filter(({ row }) => afterRowIds.has(row.id));
const changedRows = retainedRows.filter(({ section, row }) => {
  const match = afterRows.find((candidate) => candidate.section === section && candidate.row.id === row.id)?.row;
  return JSON.stringify(row) !== JSON.stringify(match);
});
const connectorOwned = (row = {}) => /^(client-selections-|allocated-selection:|tiling:|electrical-schedule:|external-lighting:|flooring:|appliance-selection:)/.test(String(row.source || row.id || ''))
  || /^quotation-subheading:tiling:/.test(String(row.id || ''));
const unrelatedRowsBefore = beforeRows.filter(({ row }) => !connectorOwned(row));
const unrelatedRowsAfter = afterRows.filter(({ row }) => !connectorOwned(row));
const unrelatedAfterById = new Map(unrelatedRowsAfter.map(({ section, row }) => [`${section}|${row.id}`, row]));
const unrelatedMissing = unrelatedRowsBefore.filter(({ section, row }) => !unrelatedAfterById.has(`${section}|${row.id}`));
const unrelatedChanged = unrelatedRowsBefore.filter(({ section, row }) => {
  const next = unrelatedAfterById.get(`${section}|${row.id}`);
  return next && JSON.stringify(row) !== JSON.stringify(next);
});
const selectedBefore = selectionIdentitiesFromBook(before.book);
const selectedAfter = selectionIdentitiesFromBook(after.book);
const fullAuditBefore = reconcileProductSelections({ workbook: before.workbook, book: before.book });
const fullAuditAfter = reconcileProductSelections({ workbook: after.workbook, book: after.book });
const fullSelectionSignature = (audit) => audit.entries.map((entry) => ({
  productId: entry.productId, productName: entry.productName, requirementKey: entry.requirementKey,
  location: entry.location, quantity: entry.quantity, unit: entry.unit,
})).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const fullBefore = fullSelectionSignature(fullAuditBefore);
const fullAfter = fullSelectionSignature(fullAuditAfter);
const identityKey = (item) => [item.requirementKey, item.productId, item.productName, item.location].join('|');
const beforeIdentityMap = new Map(fullBefore.map((item) => [identityKey(item), item]));
const afterIdentityMap = new Map(fullAfter.map((item) => [identityKey(item), item]));
const identityDiff = {
  removed: fullBefore.filter((item) => !afterIdentityMap.has(identityKey(item))),
  added: fullAfter.filter((item) => !beforeIdentityMap.has(identityKey(item))),
  changedQuantityOrUnit: fullBefore.filter((item) => {
    const next = afterIdentityMap.get(identityKey(item));
    return next && (next.quantity !== item.quantity || next.unit !== item.unit);
  }).map((item) => ({ before: item, after: afterIdentityMap.get(identityKey(item)) })),
};
const selectionSignature = (identities) => identities.map((item) => ({
  requirementKey: item.requirementKey, productId: item.productId, productName: item.productName,
  location: item.location, quantity: item.quantity, unit: item.unit,
})).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const rowRate = (row) => row.manualRate || row.excelRate || '';
const replacedLegacyRows = removedRows.map(({ section, row }) => {
  const match = afterRows.filter(({ row: candidate }) => {
    if (row.legacyRowId && candidate.id === row.legacyRowId) return true;
    if (row.lineType === 'Heading' && candidate.lineType === 'Heading') return candidate.item === row.item;
    if (row.source === 'client-selections-tiling-room' && candidate.source === 'client-selections-tiling-room') {
      return candidate.tilingRoomId === row.tilingRoomId
        && candidate.productId === row.productId
        && candidate.item === row.item
        && String(candidate.qty ?? candidate.quantity ?? '') === String(row.qty ?? row.quantity ?? '')
        && String(rowRate(candidate)) === String(rowRate(row));
    }
    return false;
  });
  const related = afterRows.filter(({ row: candidate }) =>
    (row.productId && candidate.productId === row.productId)
    || (row.productCode && candidate.productCode === row.productCode)
    || (row.source === 'client-selections-tiling-room' && candidate.source === 'client-selections-tiling-room' && candidate.tilingRoomId === row.tilingRoomId));
  const describe = (candidate) => ({ id: candidate.id, source: candidate.source || null, productId: candidate.productId || null,
    productCode: candidate.productCode || null, item: candidate.item || null,
    quantity: candidate.qty ?? candidate.quantity ?? null, rate: rowRate(candidate), priceStatus: candidate.priceStatus || null });
  return { section, oldId: row.id, source: row.source || null, oldRow: describe(row), matchCount: match.length,
    replacementIds: match.map(({ row: candidate }) => candidate.id), relatedRows: related.map(({ row: candidate }) => describe(candidate)) };
});
const protectedFields = [
  'jobInclusionSnapshot', 'jobInclusionScheduleId', 'jobInclusionScheduleName',
  'jobInclusionScheduleVersion', 'inclusionAppliedAt', 'cashflowPayments',
  'paymentHistory', 'payments', 'purchaseOrders', 'variationRegister',
];
const preserved = Object.fromEntries(protectedFields.map((field) => [field,
  JSON.stringify(before.workbook[field] ?? null) === JSON.stringify(after.workbook[field] ?? null)]));
const beforeSummary = calculateEstimateBuilderWorkbook(before.workbook).summary;
const afterSummary = calculateEstimateBuilderWorkbook(after.workbook).summary;
const describeLine = (row) => ({ id: row.id, source: row.source || null, productId: row.productId || null,
  item: row.item || null, quantity: row.qty ?? row.quantity ?? null,
  rate: row.manualRate || row.excelRate || '', total: quoteLineTotal(row),
  effectiveQuantity: quoteQuantity(row), effectiveRate: quoteRate(row) });
const describeFieldChanges = (section, row) => {
  const next = afterRows.find((candidate) => candidate.section === section && candidate.row.id === row.id)?.row || {};
  const keys = new Set([...Object.keys(row), ...Object.keys(next)]);
  const fields = [...keys].filter((key) => JSON.stringify(row[key]) !== JSON.stringify(next[key]));
  return { section, rowId: row.id, fields: fields.map((field) => ({ field, before: row[field] ?? null, after: next[field] ?? null })) };
};

assert.equal(after.workbook.jobId, before.workbook.jobId, 'isolated copy retains job identity');
assert.equal(after.workbook.workspaceId, before.workbook.workspaceId, 'isolated copy retains workspace identity');
assert.deepEqual(selectionSignature(selectedAfter), selectionSignature(selectedBefore), 'selection identities, product IDs, quantities and locations are unchanged');
assert(Object.values(preserved).every(Boolean), 'approved baselines, payments, POs and variations remain unchanged');

const report = {
  evidenceType: 'local isolated .gr8job save/reopen integrity check; not authenticated tenant acceptance',
  acceptedForCustomerUse: false,
  acceptanceBlockers: ['Planner output changes the commercial estimate and has not received builder approval.', 'Database/authenticated browser acceptance has not been performed.', 'Generated archive has not been verified through the full application job-file importer.'],
  jobId: before.workbook.jobId,
  workspaceId: before.workbook.workspaceId,
  sourcePath: beforePath,
  sourceSha256: crypto.createHash('sha256').update(before.bytes).digest('hex'),
  reconciledCopyPath: afterPath,
  reconciledCopySha256: crypto.createHash('sha256').update(after.bytes).digest('hex'),
  originalSourceUnchanged: crypto.createHash('sha256').update(fs.readFileSync(beforePath)).digest('hex') === crypto.createHash('sha256').update(before.bytes).digest('hex'),
  resolverSelectionCount: selectedBefore.length,
  selectionCount: fullAuditBefore.entries.length,
  selectionIdentitiesAndQuantitiesPreserved: true,
  fullAuditSelectionCountBefore: fullBefore.length,
  fullAuditSelectionCountAfter: fullAfter.length,
  fullAuditIdentityDiff: identityDiff,
  quotationRowsBefore: beforeRows.length,
  quotationRowsAfter: afterRows.length,
  addedQuotationRows: addedRows.map(({ section, row }) => ({
    section, ...describeLine(row), priceStatus: row.priceStatus || null, quoteRequired: row.quoteRequired === true,
    gstIncluded: row.productLibrarySnapshot?.priceIncludesGst ?? null,
    selectedUnitPrice: row.productLibrarySnapshot?.selectedUnitPrice ?? null,
  })),
  originalRowsRetained: retainedRows.length,
  legacyRowsRekeyedByConnector: replacedLegacyRows.length,
  originalRowsRemovedWithoutEquivalent: replacedLegacyRows.filter((row) => row.matchCount !== 1),
  legacyRowReplacementEvidence: replacedLegacyRows,
  originalRowsChangedByConnector: changedRows.length,
  changedOriginalRowIds: changedRows.map(({ section, row }) => ({ section, rowId: row.id, source: row.source || null, beforeProductId: row.productId || null, afterProductId: afterRows.find((candidate) => candidate.section === section && candidate.row.id === row.id)?.row.productId || null })),
  changedOriginalRowFieldDiffs: changedRows.map(({ section, row }) => describeFieldChanges(section, row)),
  changedOriginalRowsDetailed: changedRows.map(({ section, row }) => ({
    section, before: describeLine(row), after: describeLine(afterRows.find((candidate) => candidate.section === section && candidate.row.id === row.id)?.row || {}),
  })),
  quoteLineTotalBefore: beforeSummary.finalQuoteTotal,
  quoteLineTotalAfter: afterSummary.finalQuoteTotal,
  protectedFieldsPreserved: preserved,
  quoteSummaryBefore: { finalQuoteTotal: beforeSummary.finalQuoteTotal, contractTotal: beforeSummary.contractTotal },
  quoteSummaryAfter: { finalQuoteTotal: afterSummary.finalQuoteTotal, contractTotal: afterSummary.contractTotal },
  fullEstimateSummaryBefore: beforeSummary,
  fullEstimateSummaryAfter: afterSummary,
  unrelatedQuotationRowsBefore: unrelatedRowsBefore.length,
  unrelatedQuotationRowsAfter: unrelatedRowsAfter.length,
  unrelatedQuotationRowsMissing: unrelatedMissing.map(({ section, row }) => ({ section, id: row.id, item: row.item })),
  unrelatedQuotationRowsChanged: unrelatedChanged.map(({ section, row }) => ({ section, id: row.id, item: row.item })),
};
const json = JSON.stringify(report, null, 2);
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, json);
}
console.log(json);