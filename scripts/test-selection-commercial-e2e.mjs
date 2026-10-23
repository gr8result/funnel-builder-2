import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyInclusionScheduleToQuote } from '../lib/builders/selectionQuoteEngine.js';
import { connectTenantSelectionMetadata } from '../lib/builders/tenantSelectionQuotation.js';
import { resolveInclusionBaselineItems } from '../lib/builders/selectionBaselineProducts.js';
import { calculateEstimateBuilderWorkbook } from '../lib/construction-estimation/estimateBuilderWorkbookCalculations.js';
import { quoteLineTotal, quoteQuantity, quoteRate, quotationSectionsForFinalBoq } from '../lib/construction-estimation/finalQuotationBoq.js';
import { createProjectInclusionsSnapshot, FINAL_INCLUSIONS_STATUS } from '../lib/builders/finalInclusionsSchedule.js';
import { readJob, writeJob } from '../lib/jobFile.ts';

const workspaceId = 'builder-e2e-a';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://offline.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'offline';
const { __doorTakeoffTestUtils } = await import('../hooks/estimate-builder/useEstimateBuilderWorkbook.js');
const templateKey = 'master-estimate-template';
const includedProduct = { productId: 'master-oven-included', productName: 'Included Oven', clientPrice: 1100, gstIncluded: true, priceStatus: 'current' };
const privateReplacement = { id: 'builder-oven-upgrade', workspace_id: workspaceId, product_name: 'Builder Upgrade Oven', upgrade_cost: 1760, active: true, metadata: { productEntity: { gstTreatment: 'GST inclusive', priceStatus: 'current' } } };
const replacement = resolveInclusionBaselineItems([
  { id: 'item-oven', workspace_id: workspaceId, inclusion_schedule_id: 'schedule-premier', selection_slot_id: 'oven', default_catalogue_product_id: includedProduct.productId, allowance: { unitPrice: 1000 } },
], { workspaceId, catalogueProducts: [includedProduct], privateProducts: [privateReplacement] })[0];
assert.equal(replacement.baselineProductName, includedProduct.productName);
assert.equal(replacement.baselineUnitPrice, 1000, 'explicit ex-GST inclusion allowance is authoritative');

const quotation = {
  'APPLIANCES & WHITE GOODS': { id: 'appliances', sortOrder: 1, rows: [
    { id: 'quote-oven', selectionSlotId: 'oven', item: 'OVEN ALLOWANCE', quantity: '2', quantityKey: '', unit: 'EACH', excelRate: 1000, manualRate: '', formulas: { custom: 'preserve-this' }, sortOrder: 1 },
    { id: 'quote-cooktop-manual', item: 'COOKTOP MANUAL', quantity: 1, unit: 'EACH', excelRate: 900, manualRate: '$875.00', quantityManualOverride: true, formulas: { B: 'cooktopQty' }, sortOrder: 2 },
  ] },
  'UNRELATED LABOUR': { id: 'labour', sortOrder: 2, rows: [{ id: 'labour-1', item: 'INSTALLATION LABOUR', quantity: 5, excelRate: 55, manualRate: '$50', formulas: { custom: 'untouched' }, sortOrder: 1 }] },
};
const original = { workspaceId, templateKey, jobId: 'selection-commercial-e2e', quotation, quotationSectionOrder: Object.keys(quotation), cashflowPayments: { 1: 1000 }, purchaseOrders: [{ id: 'po-protected', status: 'draft' }], jobInclusionSnapshot: null };
const originalUnrelated = structuredClone(quotation['UNRELATED LABOUR']);
const foundation = {
  workspace_id: workspaceId,
  configurations: [{ workspace_id: workspaceId, selection_slot_id: 'oven', enabled: true, allow_apply_to_all: true, allow_room_override: true }],
  aliases: [],
  mappings: [{ workspace_id: workspaceId, template_id: templateKey, selection_slot_id: 'oven', status: 'MAPPED', quote_section_id: 'appliances', quote_row_id: 'quote-oven' }],
};
const inclusion = {
  schedule: { id: 'schedule-premier', workspace_id: workspaceId, display_name: 'Premier Inclusions', version: 3 },
  items: [replacement],
};
const included = applyInclusionScheduleToQuote(original, inclusion, foundation);
const includedRow = included.quotation['APPLIANCES & WHITE GOODS'].rows[0];
assert.deepEqual([includedRow.baselineProductId, includedRow.baselineUnitPrice, includedRow.activeProductId, includedRow.activeUnitPrice, includedRow.selectionStatus], [includedProduct.productId, 1000, includedProduct.productId, 1000, 'INCLUDED']);

const clientSelectionsBook = { workspace_id: workspaceId, rooms: [{ id: 'main-kitchen', name: 'Kitchen', rows: [{ id: 'selection-oven', guidedSelection: {
  selectionSlotId: 'oven', requirementKey: 'oven', productId: privateReplacement.id, productName: privateReplacement.product_name,
  selectedPrice: 1760, priceIncludesGst: true, quantity: 2, unit: 'EACH', selectionStatus: 'SELECTED', allowance: 1000,
} }] }] };
const replaced = connectTenantSelectionMetadata({ ...included, clientSelectionsBook }, clientSelectionsBook, foundation);
const replacedRow = replaced.quotation['APPLIANCES & WHITE GOODS'].rows[0];
assert.deepEqual([replacedRow.baselineProductId, replacedRow.baselineUnitPrice, replacedRow.activeProductId, replacedRow.activeUnitPrice], [includedProduct.productId, 1000, privateReplacement.id, 1600]);
assert.equal(replacedRow.variationUnitDifference, 600);
assert.equal(replacedRow.variationTotal, 1200);
assert.equal(replacedRow.quantity, '2');
assert.deepEqual(replacedRow.formulas, { custom: 'preserve-this' });
assert.deepEqual(replaced.quotation['UNRELATED LABOUR'], originalUnrelated);
assert.deepEqual(replaced.quotationSectionOrder, original.quotationSectionOrder);
assert.deepEqual(replaced.cashflowPayments, original.cashflowPayments);
assert.deepEqual(replaced.purchaseOrders, original.purchaseOrders);

const calculated = calculateEstimateBuilderWorkbook(replaced);
const calculatedOven = calculated.quotation['APPLIANCES & WHITE GOODS'].rows[0];
assert.equal(quoteRate(calculatedOven), 1600);
assert.equal(quoteQuantity(calculatedOven), 2);
assert.equal(quoteLineTotal(calculatedOven), 3200);
assert.equal(calculatedOven.variationTotal, 1200);
const boq = quotationSectionsForFinalBoq(calculated.quotation).flatMap(section => section.rows.map(row => ({ section: section.sectionKey, id: row.id, quantity: quoteQuantity(row), rate: quoteRate(row), total: quoteLineTotal(row) })));
assert.deepEqual(boq.filter(row => row.id === 'quote-oven'), [{ section: 'APPLIANCES & WHITE GOODS', id: 'quote-oven', quantity: 2, rate: 1600, total: 3200 }]);
const procurement = __doorTakeoffTestUtils.buildProcurementItemsFromQuote(replaced, calculated, []);
const ovenRequirements = procurement.filter(item => item.quoteRowId === 'quote-oven');
assert.equal(ovenRequirements.length, 1);
assert.deepEqual([ovenRequirements[0].qty, ovenRequirements[0].estimatedRate, ovenRequirements[0].estimatedTotal], [2, 1600, 3200]);
const procurementReplay = __doorTakeoffTestUtils.buildProcurementItemsFromQuote(replaced, calculated, procurement);
assert.equal(procurementReplay.filter(item => item.quoteRowId === 'quote-oven').length, 1, 'refresh reuses the existing canonical requirement ID');

const finalSchedule = createProjectInclusionsSnapshot({
  project: { id: 'project-e2e', currency: 'AUD' }, workspaceId,
  selections: [{ ...clientSelectionsBook.rooms[0].rows[0], id: 'selection-oven', is_active: true, included_allowance: 1000,
    client_selection_price: 1760, variation_amount: 1200, selection_status: 'confirmed', metadata: { selectionScope: 'client_choice' } }],
  session: { original_estimate_total: 500000 }, documentStatus: FINAL_INCLUSIONS_STATUS.DRAFT,
});
assert.equal(finalSchedule.summary.currentNetSelectionVariation, 1200);
assert.equal(finalSchedule.selections[0].variationAmount, 1200);

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'selection-commercial-e2e-'));
try {
  const filePath = path.join(directory, 'selection-e2e.gr8job');
  let bytes;
  const handle = { name: 'selection-e2e.gr8job', getFile: async () => new File(bytes ? [bytes] : [], 'selection-e2e.gr8job'), createWritable: async () => ({ write: async blob => { bytes = await blob.arrayBuffer(); }, close: async () => {} }) };
  assert.equal((await writeJob(handle, { jobId: replaced.jobId, jobName: 'Selection Commercial E2E', workbook: replaced })).ok, true);
  const reopened = await readJob(handle);
  assert.deepEqual(reopened.workbook.quotation, replaced.quotation);
  assert.deepEqual(reopened.workbook.jobInclusionSnapshot, replaced.jobInclusionSnapshot);
  assert.deepEqual(reopened.workbook.purchaseOrders, replaced.purchaseOrders);
  assert.deepEqual(reopened.workbook.cashflowPayments, replaced.cashflowPayments);
  assert.equal(reopened.workbook.quotation['APPLIANCES & WHITE GOODS'].rows[0].variationTotal, 1200);
  assert.equal(reopened.workbook.quotation['UNRELATED LABOUR'].rows[0].manualRate, '$50');
  console.log('PASS isolated Standard Inclusion -> replacement -> $1,200 ex-GST variation -> one quotation row -> one BOQ row -> one procurement requirement -> .gr8job export/import');
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
