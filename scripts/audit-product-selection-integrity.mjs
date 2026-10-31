import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { getMasterProducts, isProductVisible } from '../lib/product-library/catalogueService.js';
import { classifyProductRequirements } from '../lib/builders/selectionRequirementTaxonomy.js';
import { reconcileProductSelections } from '../lib/builders/productSelectionIntegrity.js';

const [jobPath = 'test-artifacts/isolated-jobs/gr8-reconcile-test-47c50983a480/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job', reportPath = 'artifacts/test-artifacts/product-selection-integrity/isolated-job-report.json'] = process.argv.slice(2);
const bytes = fs.readFileSync(jobPath);
const zip = await JSZip.loadAsync(bytes);
const estimate = JSON.parse(await zip.file('estimate.json').async('string'));
const workbook = estimate.workbook;
const bookFile = zip.file('client-selections.json') ? JSON.parse(await zip.file('client-selections.json').async('string')) : {};
const book = workbook.clientSelectionsBook || bookFile.book || workbook.selectionsBook || { rooms: [] };
const products = getMasterProducts(workbook.workspaceId || '');
const selectable = products.filter(isProductVisible);
const catalogCategories = new Map();
for (const product of selectable) {
  const classification = classifyProductRequirements(product);
  const category = classification.requirementKeys.length === 1 ? classification.requirementKeys[0]
    : classification.requirementKeys.length > 1 ? 'REVIEW_REQUIRED' : 'UNCLASSIFIED';
  const record = catalogCategories.get(category) || { selectableProducts: 0, visibleClassifiedProducts: 0 };
  record.selectableProducts += 1;
  if (classification.status === 'CLASSIFIED') record.visibleClassifiedProducts += 1;
  catalogCategories.set(category, record);
}
const audit = reconcileProductSelections({ workbook, book });
const quoteRows = Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).map(row => ({ section, row })));
const selections = audit.entries;
const report = {
  jobPath: path.resolve(jobPath), jobId: workbook.jobId, workspaceId: workbook.workspaceId,
  catalogue: { totalProducts: products.length, selectableProducts: selectable.length, byRequirement: Object.fromEntries([...catalogCategories].sort(([a],[b]) => a.localeCompare(b))) },
  quotation: { sections: Object.keys(workbook.quotation || {}).length, rows: quoteRows.length, productTaggedRows: quoteRows.filter(({row}) => row.productId || row.activeProductId || row.selectedProductId).length },
  procurement: { items: (workbook.procurement?.items || []).length, productTaggedItems: (workbook.procurement?.items || []).filter(item => item.productId).length },
  selections: { total: selections.length, byCategory: audit.categories, outcomes: audit.counts, details: selections, duplicates: audit.duplicates,
    procurementMissing: audit.procurementMissing, procurementDuplicates: audit.procurementDuplicates,
    supportedUnresolvedExposureExGst: audit.supportedUnresolvedExposureExGst },
  caveats: [
    'The static master Product Library is counted from the checked-in catalogue; builder-private live overrides require an authenticated Product Library browser session.',
    'Outcome audit covers product/requirement identities represented in the persisted guided Client Selections book. Dedicated multi-product schedules are separately inspected by connector tests.',
    'Exposure is null unless selected price, quantity and GST basis are all explicit; no unsupported estimate is invented.',
  ],
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
assert.equal(fs.readFileSync(jobPath).length, bytes.length, 'Job source bytes were not modified');
console.log(JSON.stringify({ jobId: report.jobId, catalogue: report.catalogue, quotation: report.quotation, procurement: report.procurement,
  selectionOutcomes: report.selections.outcomes, selected: report.selections.total,
  missingProcurement: report.selections.procurementMissing.length, duplicateProcurement: report.selections.procurementDuplicates.length,
  duplicateCharges: report.selections.duplicates.length, unresolvedExposureExGst: report.selections.supportedUnresolvedExposureExGst, reportPath }, null, 2));
