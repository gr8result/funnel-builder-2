import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import * as S from '../lib/construction-estimation/tradePaymentSchedule.js';

const B = 'builder-a', OTHER = 'builder-b', JOB = 'job-1';
const ctx = { builderId: B, jobId: JOB, actor: 'Grant' };
const template = S.getBuilderTemplate({}, B, 'plumbing');
const make = (amount = 58270) => S.createTradeContract({ template, builderId: B, jobId: JOB, contractAmount: amount, supplierName: 'Acme Plumbing' }).contract;
const amounts = (contract) => S.resolveContractMilestones(contract).map((m) => m.allocatedAmount);

// Default plumbing schedule: 25 / 40 / balance, 100% of the contract.
let contract = make();
assert.deepEqual(amounts(contract), [14567.5, 23308, 20394.5]);
assert.equal(S.validateTradeContract(contract).totalPercent, 100); assert(S.validateTradeContract(contract).ok);
assert.deepEqual(S.validateTradeContract(contract).issues, []);

// Contract change: percentages follow, a manual dollar override is preserved and the balance absorbs the difference.
contract = S.setMilestoneField(contract, 'ROUGH_IN', 'manualAmount', '$25,000.00', ctx).contract;
assert.deepEqual(amounts(contract), [14567.5, 25000, 18702.5]);
contract = S.setContractAmount(contract, 60000, ctx).contract;
assert.deepEqual(amounts(contract), [15000, 25000, 20000], 'underslab follows the contract; the override stays; fit-off is the balance');
assert.equal(S.setContractAmount(contract, 60000, ctx).unchanged, true);
contract = S.setMilestoneField(contract, 'ROUGH_IN', 'manualAmount', '', ctx).contract;
assert.deepEqual(amounts(contract), [15000, 24000, 21000]);
// Editing percentages; under / over allocation is flagged.
const noBalance = { ...contract, milestones: contract.milestones.map((m) => (m.key === 'FIT_OFF' ? { ...m, remainder: false, percent: 20 } : m)) };
assert.equal(S.validateTradeContract(noBalance).issues.find((i) => i.code === 'UNDER_ALLOCATED').by, 9000);
const over = S.setMilestoneField(contract, 'UNDERSLAB', 'percent', 80, ctx).contract;
assert(S.validateTradeContract(over).issues.some((i) => i.code === 'OVER_ALLOCATED' && i.by > 0)); assert.equal(S.validateTradeContract(over).ok, false);
assert.equal(S.setMilestoneField(contract, 'UNDERSLAB', 'percent', 140, ctx).code, 'INVALID_PERCENT');
assert.equal(S.setMilestoneField(contract, 'UNDERSLAB', 'manualAmount', 'abc', ctx).code, 'INVALID_OVERRIDE');

// Builder templates: a job edit never reaches the master; templates validate; tenants are isolated.
contract = make();
const job = S.setMilestoneField(contract, 'UNDERSLAB', 'percent', 30, ctx).contract;
assert.equal(S.getBuilderTemplate({}, B, 'PLUMBING').milestones[0].percent, 25, 'master template untouched');
assert.equal(job.templateSnapshot[0].percent, 25);
const custom = { trade: 'electrical', name: 'Electrical 30/40/30', sourceSection: 'ELECTRICAL', milestones: [{ key: 'ROUGH', label: 'Rough-in', percent: 30 }, { key: 'FIX', label: 'Fix', percent: 40 }, { key: 'FINAL', label: 'Final', remainder: true }] };
const saved = S.saveBuilderTemplate({}, B, custom, { actor: 'Grant' });
assert(saved.ok); assert.equal(saved.template.revision, 1);
assert.equal(S.getBuilderTemplate(saved.store, B, 'ELECTRICAL').milestones[0].percent, 30);
assert.equal(S.getBuilderTemplate(saved.store, OTHER, 'ELECTRICAL'), null, 'another builder does not see it');
assert.equal(S.saveBuilderTemplate(saved.store, B, { ...custom, milestones: [{ key: 'A', percent: 60 }, { key: 'B', percent: 60 }] }).code, 'INVALID_TEMPLATE');
assert.equal(S.saveBuilderTemplate(saved.store, B, { ...custom, milestones: [{ key: 'A', percent: 60 }] }).code, 'INVALID_TEMPLATE', 'no balance and not 100%');
assert.equal(S.saveBuilderTemplate(saved.store, B, custom).template.revision, 2);
const elec = S.createTradeContract({ template: S.getBuilderTemplate(saved.store, B, 'ELECTRICAL'), builderId: B, jobId: JOB, contractAmount: 10000 }).contract;
assert.deepEqual(amounts(elec), [3000, 4000, 3000], 'a second trade runs on the same engine');
assert.equal(S.createTradeContract({ template: S.getBuilderTemplate(saved.store, B, 'ELECTRICAL'), builderId: OTHER, jobId: JOB, contractAmount: 1 }).code, 'TENANT_MISMATCH');
for (const action of [() => S.setContractAmount(contract, 1, { builderId: OTHER }), () => S.setMilestoneField(contract, 'UNDERSLAB', 'percent', 1, { builderId: OTHER }), () => S.submitClaim(contract, 'UNDERSLAB', {}, { builderId: OTHER }), () => S.approveClaim(contract, 'UNDERSLAB', {}, { builderId: OTHER, actor: 'x' }), () => S.recordPayment(contract, 'UNDERSLAB', {}, { builderId: OTHER })]) assert.equal(action().code, 'TENANT_MISMATCH');
assert.equal(S.setContractAmount(contract, 1, { builderId: B, jobId: 'job-2' }).code, 'JOB_MISMATCH');

// Completion makes a milestone eligible but never claims, approves or pays.
let c = S.setMilestoneCompletion(contract, 'UNDERSLAB', S.COMPLETION.COMPLETE, { builderId: B, source: 'GANTT' }).contract;
let u = c.milestones[0];
assert.equal(S.milestoneEligibility(u), 'ELIGIBLE_FOR_CLAIM'); assert.equal(u.claim.status, 'NOT_CLAIMED'); assert.equal(u.payment.paidAmount, 0);
assert.equal(S.approveClaim(c, 'UNDERSLAB', {}, ctx).code, 'NO_CLAIM', 'completed work is not an approval');
assert.equal(S.recordPayment(c, 'UNDERSLAB', { date: '2026-11-01', invoiceRef: 'INV1' }, ctx).code, 'NOT_APPROVED');
// Claim -> approval (named person) -> payment, with the guards between them.
assert.equal(S.submitClaim(contract, 'ROUGH_IN', {}, ctx).code, 'WORK_INCOMPLETE');
assert.equal(S.submitClaim(c, 'UNDERSLAB', { amount: 20000 }, ctx).code, 'CLAIM_EXCEEDS_MILESTONE');
c = S.submitClaim(c, 'UNDERSLAB', { invoiceRef: 'INV-001' }, ctx).contract;
assert.equal(c.milestones[0].claim.claimedAmount, 14567.5); assert.equal(S.submitClaim(c, 'UNDERSLAB', {}, ctx).code, 'DUPLICATE_CLAIM');
assert.equal(S.approveClaim(c, 'UNDERSLAB', {}, { ...ctx, actor: 'system' }).code, 'APPROVER_REQUIRED');
assert.equal(S.setMilestoneField(S.approveClaim(c, 'UNDERSLAB', {}, ctx).contract, 'UNDERSLAB', 'percent', 50, ctx).code, 'MILESTONE_LOCKED');
c = S.approveClaim(c, 'UNDERSLAB', {}, ctx).contract;
assert.equal(c.milestones[0].claim.approvedBy, 'Grant');
assert.equal(S.recordPayment(c, 'UNDERSLAB', { date: '2026-11-01' , amount: 99999, invoiceRef: 'INV-001' }, ctx).code, 'PAYMENT_EXCEEDS_APPROVAL');
assert.equal(S.recordPayment(c, 'UNDERSLAB', { date: '' }, ctx).code, 'DATE_REQUIRED');
c = S.recordPayment(c, 'UNDERSLAB', { date: '2026-11-01' }, ctx).contract;
assert.equal(S.milestoneEligibility(c.milestones[0]), 'PAID');
assert.equal(S.recordPayment(c, 'UNDERSLAB', { date: '2026-11-02', invoiceRef: 'INV-001' }, ctx).code, 'DUPLICATE_PAYMENT', 'a milestone cannot be paid twice');
// Duplicate invoice reference across milestones.
let d = S.setMilestoneCompletion(c, 'ROUGH_IN', S.COMPLETION.COMPLETE, ctx).contract;
assert.equal(S.submitClaim(d, 'ROUGH_IN', { invoiceRef: 'inv-001' }, ctx).code, 'DUPLICATE_INVOICE_REFERENCE');
// Payment cannot exceed the contract without an approved variation.
let e = S.setMilestoneCompletion(make(), 'UNDERSLAB', S.COMPLETION.COMPLETE, ctx).contract;
e = S.approveClaim(S.submitClaim(e, 'UNDERSLAB', { invoiceRef: 'I1' }, ctx).contract, 'UNDERSLAB', {}, ctx).contract;
const shrunk = { ...e, contractAmount: 10000 };
assert.equal(S.recordPayment(shrunk, 'UNDERSLAB', { date: '2026-11-01' }, ctx).code, 'PAYMENT_EXCEEDS_CONTRACT');
assert.equal(S.recordPayment(S.addApprovedVariation(shrunk, { id: 'V1', amount: 5000 }, ctx).contract, 'UNDERSLAB', { date: '2026-11-01' }, ctx).ok, true, 'an approved variation lifts the ceiling');
assert.equal(S.addApprovedVariation(shrunk, { id: 'V1', amount: 5000 }, { builderId: B }).code, 'APPROVER_REQUIRED');
// Contract change after approval keeps the approved amount and says so.
const changed = S.setContractAmount(e, 70000, ctx);
assert.deepEqual(changed.approvedMilestonesAffected, ['tc:job-1:PLUMBING:UNDERSLAB']);
// Audit history.
assert(c.audit.some((a) => a.action === 'CLAIM_APPROVED' && a.actor === 'Grant') && c.audit.some((a) => a.action === 'PAYMENT_RECORDED') && c.audit[0].action === 'CONTRACT_CREATED');

// Schedule links: dates and completion come from linked activities; approval never does.
const tasks = [
  { id: 't1', stage: 'Slab / Base Stage', task: 'Concrete slab pour', trade: 'Concretor', startOffsetDays: 10, durationDays: 2, included: true },
  { id: 't2', stage: 'Fit-Out / Rough-Ins', task: 'Plumbing rough-in', trade: 'Plumber', startOffsetDays: 40, durationDays: 3, included: true, progressPercent: 100 },
  { id: 't3', stage: 'Fit-Off Trades', task: 'Plumbing fit-off', trade: 'Plumber', startOffsetDays: 80, durationDays: 4, included: true },
];
let linked = S.linkMilestonesToSchedule(make(), tasks, '2026-01-05');
assert.deepEqual(linked.milestones.map((m) => S.effectiveScheduledDate(m)), ['2026-01-15', '2026-02-17', '2026-03-30'], 'underslab is due before the slab; others at completion of their stage');
assert.deepEqual(linked.milestones.map((m) => m.link.taskId), ['t1', 't2', 't3']);
const synced = S.applyLinkedWorkCompletion(linked, { builderId: B });
assert.deepEqual(synced.completed, ['tc:job-1:PLUMBING:ROUGH_IN']); assert.equal(synced.contract.milestones[1].claim.status, 'NOT_CLAIMED'); assert.equal(S.milestoneEligibility(synced.contract.milestones[1]), 'ELIGIBLE_FOR_CLAIM');
const overridden = S.setMilestoneField(linked, 'UNDERSLAB', 'scheduledDate', '2026-01-20', ctx).contract;
assert.equal(S.effectiveScheduledDate(overridden.milestones[0]), '2026-01-20');

// Cash flow: one count of the commitment across forecast / claimed / approved / paid.
let flow = S.tradeCashflowForecast([linked]);
assert.deepEqual(flow.totals, { commitment: 58270, forecast: 58270, claimed: 0, approved: 0, paid: 0, remainingCommitment: 58270 });
let g = S.setMilestoneCompletion(linked, 'UNDERSLAB', S.COMPLETION.COMPLETE, ctx).contract;
g = S.submitClaim(g, 'UNDERSLAB', { invoiceRef: 'A1' }, ctx).contract; flow = S.tradeCashflowForecast([g]);
assert.deepEqual([flow.totals.forecast, flow.totals.claimed, flow.totals.approved, flow.totals.paid], [43702.5, 14567.5, 0, 0]);
g = S.approveClaim(g, 'UNDERSLAB', {}, ctx).contract; flow = S.tradeCashflowForecast([g]);
assert.deepEqual([flow.totals.forecast, flow.totals.claimed, flow.totals.approved], [43702.5, 0, 14567.5]);
g = S.recordPayment(g, 'UNDERSLAB', { date: '2026-01-16' }, ctx).contract; flow = S.tradeCashflowForecast([g]);
assert.deepEqual(flow.totals, { commitment: 58270, forecast: 43702.5, claimed: 0, approved: 0, paid: 14567.5, remainingCommitment: 43702.5 });
assert.equal(flow.totals.forecast + flow.totals.claimed + flow.totals.approved + flow.totals.paid, 58270, 'no double counting');
assert.deepEqual(Object.keys(flow.byMonth).sort(), ['2026-01', '2026-02', '2026-03']);
const moved = S.tradeCashflowForecast([S.setContractAmount(g, 64270, ctx).contract]);
assert.equal(moved.totals.commitment, 64270); assert.equal(moved.totals.forecast, 64270 - 14567.5, 'the paid milestone keeps its approved amount; the balance absorbs the change');
assert.equal(moved.totals.remainingCommitment, 64270 - 14567.5);

// One subcontract PO, milestones attached, idempotent, claims tracked on it.
let { purchaseOrders, contracts } = S.attachSubcontractPurchaseOrders([], [g]);
assert.equal(purchaseOrders.length, 1); assert.equal(purchaseOrders[0].commitment, 58270); assert.equal(purchaseOrders[0].milestones.length, 3);
assert.equal(purchaseOrders[0].items.length, 1); assert.equal(purchaseOrders[0].items[0].estimatedTotal, 58270);
assert.equal(contracts[0].poId, purchaseOrders[0].id); assert.deepEqual([purchaseOrders[0].paidTotal, purchaseOrders[0].invoices[0].invoiceRef], [14567.5, 'A1']);
const again = S.attachSubcontractPurchaseOrders(purchaseOrders, contracts);
assert.equal(again.purchaseOrders.length, 1, 'never one PO per stage'); assert.equal(again.purchaseOrders[0].id, purchaseOrders[0].id);
assert(S.sectionCoveredBySubcontract([g], 'PLUMBING (83)') && !S.sectionCoveredBySubcontract([g], 'PLUMBING FIXTURES & HOT WATER'));

// Isolated test job: the quotation's PLUMBING total establishes the contract; the allocation does not change the quotation total.
const root = 'test-artifacts/isolated-jobs';
const dir = fs.existsSync(root) ? fs.readdirSync(root).find((name) => fs.existsSync(`${root}/${name}/isolation-report.json`) && JSON.parse(fs.readFileSync(`${root}/${name}/isolation-report.json`, 'utf8')).newJobName === 'GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST') : null;
if (dir) {
  const { calculateEstimateBuilderWorkbook } = await import('../lib/construction-estimation/estimateBuilderWorkbookCalculations.js');
  const zip = await JSZip.loadAsync(fs.readFileSync(`${root}/${dir}/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job`));
  const wb = JSON.parse(await zip.file('estimate.json').async('string')).workbook;
  const calc = calculateEstimateBuilderWorkbook(wb);
  const plumbing = calc.quotation.PLUMBING.subtotal;
  assert.equal(plumbing, 58270);
  const real = S.createTradeContract({ template: S.getBuilderTemplate({}, wb.workspaceId, 'PLUMBING'), builderId: wb.workspaceId, jobId: wb.jobId, contractAmount: plumbing }).contract;
  assert.deepEqual(amounts(real), [14567.5, 23308, 20394.5]);
  const flowReal = S.tradeCashflowForecast([real]);
  const quotationTotal = calc.summary.baseLineItemSubtotal;
  const withContract = calculateEstimateBuilderWorkbook({ ...wb, tradeContracts: [real] });
  assert.equal(withContract.summary.baseLineItemSubtotal, quotationTotal, 'a payment schedule adds nothing to the quotation');
  const { syncTradeContracts } = await import('../lib/construction-estimation/tradeContractWorkbook.js');
  const synced = syncTradeContracts(wb, calc, { builderId: wb.workspaceId });
  assert(synced.ok && synced.tradeContracts.length === 1 && synced.purchaseOrders.length === 1, 'one contract and one subcontract PO');
  assert.equal(synced.tradeContracts[0].contractAmount, 58270); assert.deepEqual(amounts(synced.tradeContracts[0]), [14567.5, 23308, 20394.5]);
  assert.equal(synced.purchaseOrders[0].commitment, 58270); assert.equal(synced.purchaseOrders[0].milestones.length, 3);
  const wb2 = { ...wb, tradeContracts: synced.tradeContracts, purchaseOrders: synced.purchaseOrders };
  const calc2 = calculateEstimateBuilderWorkbook(wb2);
  const row = calc2.quotation['UNDERSLAB AND DRAINAGE'].rows[0];
  assert.equal(row.progressAllocationResult.managedBy, 'TRADE_PAYMENT_SCHEDULE'); assert.equal(row.progressAllocationResult.allocatedAmount, 14567.5); assert.equal(row.cost, 0);
  assert.equal(calc2.summary.baseLineItemSubtotal, quotationTotal, 'contract + PO + allocation row leave the quotation total unchanged');
  assert.equal(syncTradeContracts(wb2, calc2, { builderId: wb.workspaceId }).changed, false, 'syncing again changes nothing');
  assert.equal(syncTradeContracts(wb2, calc2, { builderId: 'builder-other' }).code, 'TENANT_MISMATCH');
  assert.equal(syncTradeContracts({ ...wb2, jobId: 'other-job' }, calc2, { builderId: wb.workspaceId }).code, 'TENANT_MISMATCH');
  // The contract is the single source for the quote row; a job edit moves both, and never the builder master.
  const edited = S.setMilestoneField(synced.tradeContracts[0], 'UNDERSLAB', 'percent', 30, { builderId: wb.workspaceId, jobId: wb.jobId }).contract;
  const calc3 = calculateEstimateBuilderWorkbook({ ...wb2, tradeContracts: [edited] });
  assert.equal(calc3.quotation['UNDERSLAB AND DRAINAGE'].rows[0].progressAllocationResult.allocatedAmount, 17481);
  assert.equal(calc3.summary.baseLineItemSubtotal, quotationTotal);
  assert.equal(S.getBuilderTemplate({}, wb.workspaceId, 'PLUMBING').milestones[0].percent, 25);
  // Quotation change -> contract amount, milestones and the single PO follow; a manual override survives.
  const withOverride = { ...synced.tradeContracts[0], milestones: S.setMilestoneField(synced.tradeContracts[0], 'ROUGH_IN', 'manualAmount', 25000, { builderId: wb.workspaceId, jobId: wb.jobId }).contract.milestones };
  const bumpedQuote = { ...wb2, tradeContracts: [withOverride], quotation: { ...wb2.quotation, PLUMBING: { ...wb2.quotation.PLUMBING, rows: wb2.quotation.PLUMBING.rows.map((r) => r.id === 'quote-1195' ? { ...r, manualRate: '$20,000.00', quantity: '2', quantityManualOverride: true } : r) } } };
  const calc4 = calculateEstimateBuilderWorkbook(bumpedQuote);
  const resynced = syncTradeContracts(bumpedQuote, calc4, { builderId: wb.workspaceId });
  assert.equal(resynced.tradeContracts[0].contractAmount, 61870); assert.equal(resynced.purchaseOrders.length, 1); assert.equal(resynced.purchaseOrders[0].commitment, 61870);
  assert.deepEqual(amounts(resynced.tradeContracts[0]), [15467.5, 25000, 21402.5]);
  // Save / reopen: the contract (percentages, overrides, claims, audit) is plain job data and round-trips unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(resynced.tradeContracts)), resynced.tradeContracts);
  // Procurement: contracted sections are not also ordered per supplier; fixtures (a different section) still are.
  assert(S.sectionCoveredBySubcontract(synced.tradeContracts, 'PLUMBING') && !S.sectionCoveredBySubcontract(synced.tradeContracts, 'PLUMBING FIXTURES & HOT WATER'));
  console.log(JSON.stringify({ contract: real.contractId, milestones: amounts(real), quotationTotal, commitment: flowReal.totals.commitment }));
}
console.log('Trade payment schedule tests passed.');
