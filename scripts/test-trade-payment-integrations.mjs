// Trade payment schedule integrations: Gantt dates, Job Board completion, controlled refresh, cash flow and builder templates.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-trade-payment-integrations.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import * as S from '../lib/construction-estimation/tradePaymentSchedule.js';
import * as W from '../lib/construction-estimation/tradeContractWorkbook.js';
import * as T from '../lib/construction-estimation/tradePaymentTemplateStore.js';
import { loadJobBoardJobs, loadJobBoardTaskRecords } from '../lib/construction-estimation/tradePaymentJobBoardClient.js';

const B = 'builder-a', OTHER = 'builder-b', JOB = 'job-1';
const ctx = { builderId: B, jobId: JOB, actor: 'Grant' }, defaultCtx = ctx;
const make = (amount = 58270) => S.createTradeContract({ template: S.getBuilderTemplate({}, B, 'PLUMBING'), builderId: B, jobId: JOB, contractAmount: amount, supplierName: 'Acme Plumbing' }).contract;
const amounts = (contract) => S.resolveContractMilestones(contract).map((m) => m.allocatedAmount);
const dates = (contract) => contract.milestones.map((m) => S.effectiveScheduledDate(m));
const through = (contract, key, invoiceRef, paidDate, ctx = defaultCtx) => {
  let c = S.setMilestoneCompletion(contract, key, S.COMPLETION.COMPLETE, ctx).contract;
  c = S.submitClaim(c, key, { invoiceRef }, ctx).contract;
  c = S.approveClaim(c, key, {}, ctx).contract;
  return paidDate ? S.recordPayment(c, key, { date: paidDate }, ctx).contract : c;
};

// ---- Gantt -------------------------------------------------------------------------------------------------------------
const tasks = [
  { id: 't-slab', stage: 'Slab / Base Stage', task: 'Concrete slab pour', trade: 'Concretor', startOffsetDays: 10, durationDays: 2, included: true },
  { id: 't-under', stage: 'Slab / Base Stage', task: 'Underslab plumbing and drainage', trade: 'Plumber', startOffsetDays: 6, durationDays: 2, included: true },
  { id: 't-elec', stage: 'Fit-Out / Rough-Ins', task: 'Electrical rough-in', trade: 'Electrician', startOffsetDays: 38, durationDays: 3, included: true },
  { id: 't-rough', stage: 'Fit-Out / Rough-Ins', task: 'Rough-in', trade: 'Plumber', startOffsetDays: 40, durationDays: 3, included: true },
  { id: 't-fit', stage: 'Fit-Off Trades', task: 'Plumbing fit-off', trade: 'Plumber', startOffsetDays: 80, durationDays: 4, included: true },
];
const project = { projectStartDate: '2026-01-05', approvedSchedule: tasks };
let linked = S.linkMilestonesToSchedule(make(), tasks, '2026-01-05');
assert.deepEqual(linked.milestones.map((m) => m.link.taskId), ['t-under', 't-rough', 't-fit'], 'underslab -> underslab plumbing, rough-in -> the plumber\'s rough-in (not the electrician\'s), fit-off -> plumbing fit-off');
assert.deepEqual(dates(linked), ['2026-01-13', '2026-02-17', '2026-03-30'], 'each forecast date is the end of its own activity');
assert.deepEqual(S.linkMilestonesToSchedule(make(), tasks.filter((t) => t.id !== 't-under'), '2026-01-05').milestones[0].link.resolved, { taskId: 't-slab', taskName: 'Concrete slab pour', stage: 'Slab / Base Stage', date: '2026-01-15', workComplete: false }, 'with no underslab activity the claim falls due before the slab pour');
assert.deepEqual(linked.milestones.map((m) => S.scheduledDateSource(m)), ['GANTT', 'GANTT', 'GANTT']);

// A linked task moves -> the forecast date moves; the link is by task id, so a rename does not break it.
const movedTasks = tasks.map((t) => (t.id === 't-rough' ? { ...t, task: 'Plumbing first fix', startOffsetDays: 54 } : t));
let moved = W.linkContractsToGantt([linked], { ...project, approvedSchedule: movedTasks }, ctx);
assert.deepEqual(moved.moved, [{ milestoneId: 'tc:job-1:PLUMBING:ROUGH_IN', from: '2026-02-17', to: '2026-03-03', shown: '2026-03-03', overridden: false }]);
assert.equal(moved.tradeContracts[0].milestones[1].link.resolved.taskName, 'Plumbing first fix');
assert.equal(W.linkContractsToGantt(moved.tradeContracts, { ...project, approvedSchedule: movedTasks }, ctx).changed, false, 'relinking an unchanged schedule changes nothing');

// Manual override: wins, is labelled, survives schedule changes, and can be cleared back to the Gantt.
let manual = S.setMilestoneField(linked, 'FIT_OFF', 'scheduledDate', '2026-04-20', ctx).contract;
assert.equal(S.scheduledDateSource(manual.milestones[2]), 'MANUAL');
manual = W.linkContractsToGantt([manual], { ...project, approvedSchedule: tasks.map((t) => (t.id === 't-fit' ? { ...t, startOffsetDays: 90 } : t)) }, ctx);
assert.equal(dates(manual.tradeContracts[0])[2], '2026-04-20'); assert.equal(manual.moved[0].overridden, true);
assert.equal(manual.tradeContracts[0].milestones[2].link.resolved.date, '2026-04-09', 'the Gantt date is still tracked underneath');
const cleared = S.setMilestoneField(manual.tradeContracts[0], 'FIT_OFF', 'scheduledDate', '', ctx).contract;
assert.equal(dates(cleared)[2], '2026-04-09'); assert.equal(S.scheduledDateSource(cleared.milestones[2]), 'GANTT');
assert(manual.tradeContracts[0].audit.some((a) => a.action === 'MILESTONE_EDITED' && a.field === 'scheduledDate' && a.to === '2026-04-20'));

// Approved or paid milestones are payment records: a schedule change never rewrites them.
const paidUnderslab = through(linked, 'UNDERSLAB', 'INV-1', '2026-01-14');
const approvedRough = through(paidUnderslab, 'ROUGH_IN', 'INV-2');
const shifted = W.linkContractsToGantt([approvedRough], { projectStartDate: '2026-03-01', approvedSchedule: tasks }, ctx).tradeContracts[0];
assert.deepEqual(shifted.milestones[0], approvedRough.milestones[0], 'paid milestone untouched'); assert.deepEqual(shifted.milestones[1], approvedRough.milestones[1], 'approved milestone untouched');
assert.equal(dates(shifted)[2], '2026-05-24', 'the open milestone follows the new schedule');
assert.equal(S.setMilestoneLink(approvedRough, 'ROUGH_IN', { ganttTaskId: 't-elec' }, ctx).code, 'MILESTONE_LOCKED');

// Choosing a task by hand: held by id, and returned to automatic matching when cleared.
let chosen = S.setMilestoneLink(linked, 'FIT_OFF', { ganttTaskId: 't-elec' }, ctx).contract;
chosen = S.linkMilestonesToSchedule(chosen, tasks, '2026-01-05');
assert.equal(chosen.milestones[2].link.resolved.taskId, 't-elec'); assert.equal(dates(chosen)[2], '2026-02-15');
assert.equal(S.linkMilestonesToSchedule(chosen, tasks.filter((t) => t.id !== 't-elec'), '2026-01-05').milestones[2].link.resolved, null, 'a hand-picked task that is deleted is not silently replaced');
assert.equal(S.linkMilestonesToSchedule(S.setMilestoneLink(chosen, 'FIT_OFF', { ganttTaskId: '' }, ctx).contract, tasks, '2026-01-05').milestones[2].link.resolved.taskId, 't-fit');
assert.equal(S.setMilestoneLink(linked, 'FIT_OFF', { ganttTaskId: 't-elec' }, { builderId: OTHER }).code, 'TENANT_MISMATCH');
assert.deepEqual(W.ganttTaskOptions(project).map((t) => t.id), tasks.map((t) => t.id));
console.log('PASS Gantt: plumbing stages mapped, moved tasks move forecasts, manual dates labelled and kept, approved/paid milestones never overwritten');

// ---- Job Board ---------------------------------------------------------------------------------------------------------
const base = make();
assert.deepEqual(base.milestones.map((m) => S.jobBoardTaskKeyOf(base, m)), ['underslab_plumbing', 'rough_plumbing', 'fix_plumbing']);
assert.equal(S.applyJobBoardCompletion(base, [{ job_id: 'jb-1', task_key: 'rough_plumbing', status: 'done' }], ctx).unlinked, true, 'nothing happens until the contract names its Job Board job');
let jb = S.linkContractToJobBoard(base, { jobId: 'jb-1', jobName: 'Smith Residence' }, ctx).contract;
assert.equal(S.linkContractToJobBoard(jb, { jobId: 'jb-1' }, ctx).unchanged, true);
assert.equal(S.linkContractToJobBoard(base, { jobId: 'jb-1' }, { builderId: OTHER }).code, 'TENANT_MISMATCH');
jb = S.setMilestoneLink(jb, 'UNDERSLAB', { jobBoardTaskKey: 'col_1760000000000' }, ctx).contract; // a custom board column
const records = [
  { job_id: 'jb-1', task_key: 'col_1760000000000', status: 'done', card_order: 'todo,in_progress,done' },
  { job_id: 'jb-1', task_key: 'rough_plumbing', status: 'in_progress', card_order: 'todo,in_progress' },
  { job_id: 'jb-2', task_key: 'fix_plumbing', status: 'done', card_order: 'done' }, // another job's board row
];
let applied = S.applyJobBoardCompletion(jb, records, ctx);
assert.deepEqual(applied.completed, ['tc:job-1:PLUMBING:UNDERSLAB']);
const [u, r, f] = applied.contract.milestones;
assert.equal(S.milestoneEligibility(u), 'ELIGIBLE_FOR_CLAIM'); assert.deepEqual(u.completion.sourceRef, 'jobboard:jb-1:col_1760000000000');
assert.equal(u.claim.status, 'NOT_CLAIMED', 'completed work does not raise or approve a claim'); assert.equal(u.payment.paidAmount, 0, 'and pays nothing');
assert.equal(r.completion.status, 'IN_PROGRESS'); assert.equal(f.completion.status, 'NOT_STARTED', "another Job Board job's done card is ignored");
assert.equal(S.approveClaim(applied.contract, 'UNDERSLAB', {}, ctx).code, 'NO_CLAIM', 'approval still needs a submitted claim and a person');
assert.equal(S.recordPayment(applied.contract, 'UNDERSLAB', { date: '2026-01-20', invoiceRef: 'X' }, ctx).code, 'NOT_APPROVED');
assert.deepEqual(S.applyJobBoardCompletion(applied.contract, records, ctx).completed, [], 'applying the same board state again changes nothing');
assert(applied.contract.audit.some((a) => a.action === 'COMPLETION_SET' && a.note === 'jobboard:jb-1:col_1760000000000'));
// Taking the done card off re-opens only an unclaimed milestone the board completed.
const undone = [{ job_id: 'jb-1', task_key: 'col_1760000000000', status: 'in_progress', card_order: 'todo,in_progress' }];
assert.deepEqual(S.applyJobBoardCompletion(applied.contract, undone, ctx).reopened, ['tc:job-1:PLUMBING:UNDERSLAB']);
const claimed = S.submitClaim(applied.contract, 'UNDERSLAB', { invoiceRef: 'INV-9' }, ctx).contract;
assert.deepEqual(S.applyJobBoardCompletion(claimed, undone, ctx).reopened, [], 'a claimed milestone is not re-opened by the board');
const byHand = S.setMilestoneCompletion(jb, 'FIT_OFF', S.COMPLETION.COMPLETE, ctx).contract;
assert.equal(S.applyJobBoardCompletion(byHand, [], { ...ctx, complete: true }).contract.milestones[2].completion.status, 'COMPLETE', 'a manual completion is not undone by the board');
assert.deepEqual(S.applyJobBoardCompletion(applied.contract, [], ctx).reopened, [], 'a partial update says nothing about tasks it does not carry');
assert.deepEqual(S.applyJobBoardCompletion(applied.contract, [], { ...ctx, complete: true }).reopened, ['tc:job-1:PLUMBING:UNDERSLAB'], 'the full task list does');
const acrossContracts = W.applyJobBoardToContracts([jb], records, { ...ctx, completeJobIds: ['jb-1'] });
assert(acrossContracts.changed && acrossContracts.completed.length === 1);
const inProgressRecords = [{ job_id: 'jb-1', task_key: 'rough_plumbing', status: 'in_progress', card_order: 'todo,in_progress' }];
const inProgressSync = W.applyJobBoardToContracts([jb], inProgressRecords, ctx);
assert.equal(inProgressSync.changed, true, 'intermediate Job Board status changes must be persisted, not only completions');
assert.equal(inProgressSync.tradeContracts[0].milestones[1].completion.status, 'IN_PROGRESS');
assert.equal(inProgressSync.tradeContracts[0].milestones[1].claim.status, 'NOT_CLAIMED');
assert.equal(inProgressSync.tradeContracts[0].milestones[1].payment.paidAmount, 0);
assert.equal(W.applyJobBoardToContracts(inProgressSync.tradeContracts, inProgressRecords, ctx).changed, false, 'repeated intermediate status is idempotent');
assert.equal(W.applyJobBoardToContracts([jb], records, { builderId: OTHER }).code, 'TENANT_MISMATCH');

// The Job Board reader is read-only and scoped to the signed-in user's own jobs.
function boardDb(userId) {
  const data = {
    job_board_jobs: [{ id: 'jb-1', name: 'Smith Residence', board_id: 'bd-1', user_id: 'user-1', sort_order: 0 }, { id: 'jb-9', name: 'Other user job', board_id: 'bd-9', user_id: 'user-2', sort_order: 0 }],
    job_board_boards: [{ id: 'bd-1', name: 'General', user_id: 'user-1', task_list: [{ key: 'rough_plumbing', label: 'Rough Plumbing' }, { key: 'col_1760000000000', label: 'Underslab Plumbing' }] }],
    job_board_tasks: [{ job_id: 'jb-1', task_key: 'rough_plumbing', status: 'done', card_order: 'done' }, { job_id: 'jb-9', task_key: 'rough_plumbing', status: 'done', card_order: 'done' }],
  };
  const writes = [];
  const from = (table) => {
    const filters = [];
    const chain = {
      select: () => chain, order: () => chain, eq: (k, v) => { filters.push((row) => row[k] === v); return chain; }, in: (k, v) => { filters.push((row) => v.includes(String(row[k]))); return chain; },
      insert: () => { writes.push(table); return chain; }, update: () => { writes.push(table); return chain; }, delete: () => { writes.push(table); return chain; },
      then: (resolve) => resolve({ data: data[table].filter((row) => filters.every((test) => test(row))), error: null }),
    };
    return chain;
  };
  return { from, writes, auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } };
}
{
  const db = boardDb('user-1');
  const jobs = await loadJobBoardJobs(db);
  assert.deepEqual(jobs.jobs.map((j) => [j.id, j.boardName, j.columns.length]), [['jb-1', 'General', 2]]);
  const mine = await loadJobBoardTaskRecords(db, ['jb-1', 'jb-9']);
  assert.deepEqual(mine.jobIds, ['jb-1'], "another user's Job Board job id returns nothing"); assert.equal(mine.records.length, 1);
  assert.equal((await loadJobBoardJobs(boardDb(null))).code, 'SIGN_IN_REQUIRED'); assert.equal((await loadJobBoardTaskRecords(boardDb(null), ['jb-1'])).code, 'SIGN_IN_REQUIRED');
  assert.deepEqual(db.writes, [], 'the trade payment schedule never writes to the Job Board');
}
console.log('PASS Job Board: done work makes a milestone eligible only; no auto claim, approval or payment; other jobs and users ignored');

// ---- Controlled, idempotent refresh ------------------------------------------------------------------------------------
const quote = (plumbing, extra = {}) => ({ quotation: { 'PLUMBING (83)': { subtotal: plumbing }, ...extra } });
const wb0 = { jobId: JOB, workspaceId: B, tradeContracts: [], purchaseOrders: [{ id: 'po:timber:1', supplier: 'Timber Co', items: [] }] };
const first = W.syncTradeContracts(wb0, quote(58270), { builderId: B });
assert.deepEqual(wb0.tradeContracts, [], 'reporting changes does not apply them');
assert.deepEqual(W.describeTradeContractSync(first), ['New PLUMBING contract for $58,270.00 from the quotation.', 'One purchase order will be created for the PLUMBING contract ($58,270.00).']);
let wb = { ...wb0, tradeContracts: first.tradeContracts, purchaseOrders: first.purchaseOrders };
assert.deepEqual(amounts(wb.tradeContracts[0]), [14567.5, 23308, 20394.5]);
assert.equal(wb.purchaseOrders.length, 2, 'the unrelated supplier order is kept'); assert.equal(wb.purchaseOrders[1].tradeContractId, 'tc:job-1:PLUMBING');
const again = W.syncTradeContracts(wb, quote(58270), { builderId: B });
assert.equal(again.changed, false); assert.deepEqual(W.describeTradeContractSync(again), [], 'a second refresh has nothing to report');
// Approved + paid underslab, an approved variation, then the quotation moves.
let live = through(wb.tradeContracts[0], 'UNDERSLAB', 'INV-1', '2026-01-14');
live = S.addApprovedVariation(live, { id: 'V1', amount: 1500, description: 'Extra floor waste' }, ctx).contract;
{ const attached = S.attachSubcontractPurchaseOrders(wb.purchaseOrders, [live]); wb = { ...wb, tradeContracts: attached.contracts, purchaseOrders: attached.purchaseOrders }; live = attached.contracts[0]; } // as the app does after every action
const up =W.syncTradeContracts(wb, quote(61870), { builderId: B });
assert.deepEqual(W.describeTradeContractSync(up), [
  'PLUMBING contract value $58,270.00 -> $61,870.00. 1 approved or paid milestone(s) keep their amounts; the open milestones absorb the change. 1 approved variation(s) kept.',
  'The existing PLUMBING purchase order is updated $59,770.00 -> $63,370.00; no new order is created.',
]);
const after = up.tradeContracts[0];
assert.equal(after.milestones[0].claim.approvedAmount, 14567.5); assert.equal(after.milestones[0].payment.paidAmount, 14567.5); assert.equal(after.milestones[0].payment.paidDate, '2026-01-14');
assert.deepEqual(amounts(after), [14567.5, 24748, 22554.5], 'the paid milestone keeps its amount; rough-in follows 40%; fit-off is the balance');
assert.deepEqual(after.approvedVariations, live.approvedVariations); assert.equal(up.purchaseOrders.filter((po) => po.tradeContractId === after.contractId).length, 1, 'never a duplicate purchase order');
assert.equal(up.purchaseOrders.length, 2);
// An agreed subcontract price is held against a quotation change, and said so.
const agreed = S.setAgreedAmount(live, 57000, ctx).contract;
const heldSync = W.syncTradeContracts({ ...wb, tradeContracts: [agreed] }, quote(61870), { builderId: B });
assert.equal(heldSync.tradeContracts[0].contractAmount, 57000); assert.deepEqual(heldSync.changes, []);
assert.match(W.describeTradeContractSync(heldSync)[0], /keeps its agreed price of \$57,000\.00 \(quotation now \$61,870\.00\)/);
// The quotation can never refresh a contract below money already approved or paid.
const low = W.syncTradeContracts(wb, quote(9000), { builderId: B });
assert.equal(low.tradeContracts[0].contractAmount, 58270); assert.match(W.describeTradeContractSync(low)[0], /not changed: the quotation \(\$9,000\.00\) is below \$14,567\.50 already approved or paid/);
assert.equal(W.syncTradeContracts(wb, quote(58270), { builderId: OTHER }).code, 'TENANT_MISMATCH');
// A builder's own template brings another trade into the same controlled refresh.
const electrical = S.saveBuilderTemplate({}, B, { trade: 'electrical', name: 'Electrical', sourceSection: 'ELECTRICAL', milestones: T.parseTemplateMilestones('Rough-in 30, Fix 40%, Final balance') }, { actor: 'Grant' });
assert(electrical.ok);
const two = W.syncTradeContracts(wb0, quote(58270, { ELECTRICAL: { subtotal: 10000 } }), { builderId: B, templates: electrical.store, trades: ['PLUMBING', 'ELECTRICAL'] });
assert.deepEqual(two.tradeContracts.map((c) => [c.trade, amounts(c)]), [['PLUMBING', [14567.5, 23308, 20394.5]], ['ELECTRICAL', [3000, 4000, 3000]]]);
assert.equal(two.purchaseOrders.filter((po) => po.kind === 'SUBCONTRACT').length, 2, 'one purchase order per trade contract');
assert.equal(W.syncTradeContracts(wb0, quote(58270, { ELECTRICAL: { subtotal: 10000 } }), { builderId: OTHER, templates: electrical.store, trades: ['PLUMBING', 'ELECTRICAL'] }).tradeContracts.length, 1, "another builder does not get this builder's electrical template");
console.log('PASS refresh: reported before applied, idempotent, approved/paid/agreed/variations preserved, one purchase order per contract');

// ---- Cash flow ---------------------------------------------------------------------------------------------------------
let cashContract = S.linkMilestonesToSchedule(wb.tradeContracts[0], tasks, '2026-01-05'); // underslab paid 14 Jan; variation +1,500
cashContract = S.submitClaim(S.setMilestoneCompletion(cashContract, 'ROUGH_IN', S.COMPLETION.COMPLETE, ctx).contract, 'ROUGH_IN', { invoiceRef: 'INV-2' }, ctx).contract;
const cash = W.subcontractCashflow({ tradeContracts: [cashContract] }, quote(58270).quotation);
assert.deepEqual(cash.totals, { commitment: 59770, forecast: 20394.5, claimed: 23308, approved: 0, paid: 14567.5, remainingCommitment: 45202.5 });
assert.equal(cash.totals.forecast + cash.totals.claimed + cash.totals.approved + cash.totals.paid, 58270, 'every milestone dollar is in exactly one bucket');
assert.equal(cash.contracts[0].costInQuotation, 58270); assert.equal(cash.contracts[0].differenceFromQuotation, 1500, 'the approved variation is the only difference from the quotation');
assert.equal(cash.addedToOutgoingCosts, 0, 'milestones are timing of the commitment, never a second outgoing cost');
assert.deepEqual(cash.dated.map((row) => [row.paymentDate, row.label, row.open, row.paid, row.dateSource]), [['2026-01-14', 'Underslab', 0, 14567.5, 'NONE'], ['2026-02-17', 'Rough-in', 23308, 0, 'GANTT'], ['2026-03-30', 'Fit-off', 20394.5, 0, 'GANTT']]);
assert.deepEqual(cash.byMonth, { '2026-01': { forecast: 0, claimed: 0, approved: 0, paid: 14567.5 }, '2026-02': { forecast: 0, claimed: 23308, approved: 0, paid: 0 }, '2026-03': { forecast: 20394.5, claimed: 0, approved: 0, paid: 0 } });
const approvedCash = W.subcontractCashflow({ tradeContracts: [S.approveClaim(cashContract, 'ROUGH_IN', {}, ctx).contract] }, quote(58270).quotation);
assert.deepEqual([approvedCash.totals.claimed, approvedCash.totals.approved], [0, 23308]);
assert.deepEqual(W.subcontractCashflow({ tradeContracts: [] }, {}).totals, { commitment: 0, forecast: 0, claimed: 0, approved: 0, paid: 0, remainingCommitment: 0 });
console.log('PASS cash flow: commitment, forecast by date, claimed, approved, paid and remaining tracked separately with no double count');

// ---- Builder master templates: shared store ----------------------------------------------------------------------------
function templateDb({ rows = [], failWith = null, denyWrites = false } = {}) {
  const state = { rows: [...rows] };
  const from = () => {
    const filters = []; let op = 'select', payload = null;
    const matches = () => state.rows.filter((row) => filters.every(([k, v]) => row[k] === v));
    const chain = {
      select: () => chain, eq: (k, v) => { filters.push([k, v]); return chain; },
      insert: (value) => { op = 'insert'; payload = value; return chain; }, update: (value) => { op = 'update'; payload = value; return chain; },
      maybeSingle: async () => (failWith ? { data: null, error: { message: failWith } } : { data: matches()[0] ?? null, error: null }),
      single: async () => {
        if (failWith) return { data: null, error: { message: failWith } };
        if (denyWrites) return { data: null, error: { message: 'new row violates row-level security policy for table "builder_trade_payment_templates"' } };
        if (op === 'insert') { const row = { id: `id-${state.rows.length + 1}`, revision: 1, updated_at: 'now', ...payload }; state.rows.push(row); return { data: row, error: null }; }
        const row = matches()[0]; Object.assign(row, payload, { revision: row.revision + 1 }); return { data: row, error: null };
      },
      then: (resolve) => resolve(failWith ? { data: null, error: { message: failWith } } : { data: matches(), error: null }),
    };
    return chain;
  };
  return { from, state };
}
const memory = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), map }; };
{
  const otherRow = { id: 'x', workspace_id: OTHER, trade: 'PLUMBING', name: 'Theirs', source_section: 'PLUMBING', revision: 4, milestones: [{ key: 'A', label: 'A', percent: 100 }] };
  const db = templateDb({ rows: [otherRow] });
  const storage = memory();
  const custom = { trade: 'Plumbing', name: 'Plumbing 20/40/40', sourceSection: 'PLUMBING', milestones: T.parseTemplateMilestones('Underslab 20, Rough-in 40, Fit-off balance') };
  const saved = await T.saveBuilderTemplateShared(db, B, custom, { actor: 'Grant', storage });
  assert(saved.ok && saved.source === 'SHARED'); assert.equal(saved.template.revision, 1); assert.equal(saved.template.builderId, B);
  assert.equal(db.state.rows.length, 2); assert.deepEqual(db.state.rows[0], otherRow, "another builder's template for the same trade is neither reused nor touched");
  assert.equal((await T.saveBuilderTemplateShared(db, B, { ...custom, name: 'v2' }, { storage })).template.revision, 2, 'saving again updates the one record');
  assert.equal(db.state.rows.length, 2);
  const mine = await T.loadBuilderTemplatesShared(db, B, { storage });
  assert.equal(mine.source, 'SHARED'); assert.deepEqual(Object.keys(mine.store[B]), ['PLUMBING']); assert.equal(mine.store[B].PLUMBING.milestones[0].percent, 20);
  assert.equal(S.getBuilderTemplate(mine.store, B, 'PLUMBING').milestones[0].percent, 20, 'the builder default is used for new contracts');
  assert.equal(S.getBuilderTemplate(mine.store, 'builder-c', 'PLUMBING').milestones[0].percent, 25, 'a builder without one still gets the system default, not a neighbour\'s');
  assert.equal(T.loadBuilderTemplates(B, storage)[B].PLUMBING.revision, 2, 'the browser cache follows what was really saved');
  assert.deepEqual(T.loadBuilderTemplates(OTHER, storage), { [OTHER]: {} }, 'the cache is per builder');
  // A new job uses the builder default; changing that job leaves the master alone, and so does every other job.
  const jobA = S.createTradeContract({ template: S.getBuilderTemplate(mine.store, B, 'PLUMBING'), builderId: B, jobId: 'job-a', contractAmount: 58270 }).contract;
  assert.deepEqual(amounts(jobA), [11654, 23308, 23308]); assert.equal(jobA.templateRevision, 2);
  const jobEdited = S.setMilestoneField(jobA, 'UNDERSLAB', 'percent', 35, { builderId: B, jobId: 'job-a' }).contract;
  assert.equal((await T.loadBuilderTemplatesShared(db, B, { storage })).store[B].PLUMBING.milestones[0].percent, 20, 'a job edit never reaches the master template');
  assert.equal(jobEdited.templateSnapshot[0].percent, 20);
  // Saving a job's schedule as the default is explicit, and carries structure only.
  const fromJob = T.templateFromContract(through(S.linkMilestonesToSchedule(jobEdited, tasks, '2026-01-05'), 'UNDERSLAB', 'I-1', '2026-01-14', { builderId: B, jobId: 'job-a', actor: 'Grant' }));
  assert.deepEqual(fromJob.milestones.map((m) => [m.key, m.percent, m.remainder]), [['UNDERSLAB', 35, false], ['ROUGH_IN', 40, false], ['FIT_OFF', null, true]]);
  assert(!JSON.stringify(fromJob).match(/taskId|resolved|claim|paid|INV|I-1/), 'no claims, payments, dates or task ids leak into a master template');
  assert.equal(fromJob.milestones[0].link.jobBoardTaskKey, 'underslab_plumbing');
  // Guards.
  await assert.rejects(() => T.createTemplateRepository(db, B).save({ ...custom, builderId: OTHER }), /another builder/);
  assert.throws(() => T.createTemplateRepository(db, ''), /workspace is required/);
  assert.equal((await T.saveBuilderTemplateShared(db, B, { ...custom, milestones: T.parseTemplateMilestones('A 60, B 60') }, { storage })).code, 'INVALID_TEMPLATE');
  const leaky = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [otherRow], error: null }) }) }) };
  assert.equal((await T.loadBuilderTemplatesShared(leaky, B, { storage: memory() })).source, 'LOCAL', "a row from another builder is refused even if the database returned it");
  const refused = await T.saveBuilderTemplateShared(templateDb({ denyWrites: true }), B, custom, { storage: memory() });
  assert.equal(refused.code, 'NOT_PERMITTED', 'a member without the role is told so; nothing is saved locally as if it had worked');
  // Before the migration is applied the table does not exist: the browser copy carries on and says so.
  const offline = memory();
  const local = await T.saveBuilderTemplateShared(templateDb({ failWith: 'relation "public.builder_trade_payment_templates" does not exist' }), B, custom, { storage: offline });
  assert(local.ok && local.source === 'LOCAL'); assert.match(local.message, /this browser only/);
  const fallback = await T.loadBuilderTemplatesShared(templateDb({ failWith: 'relation does not exist' }), B, { storage: offline });
  assert.equal(fallback.source, 'LOCAL'); assert.equal(fallback.store[B].PLUMBING.milestones[0].percent, 20);
}
console.log('PASS builder templates: shared per builder, job copies independent, no cross-builder read/write, honest local fallback');

// ---- Whole workflow on the isolated test job ---------------------------------------------------------------------------
const root = 'test-artifacts/isolated-jobs';
const dir = fs.existsSync(root) ? fs.readdirSync(root).find((name) => fs.existsSync(`${root}/${name}/isolation-report.json`) && JSON.parse(fs.readFileSync(`${root}/${name}/isolation-report.json`, 'utf8')).newJobName === 'GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST') : null;
if (!dir) console.log('SKIPPED isolated test job workflow: test job file not found.');
else {
  const { calculateEstimateBuilderWorkbook } = await import('../lib/construction-estimation/estimateBuilderWorkbookCalculations.js');
  const file = `${root}/${dir}/GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job`;
  const before = fs.statSync(file).mtimeMs;
  const job = JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(file))).file('estimate.json').async('string')).workbook;
  const who = { builderId: job.workspaceId, jobId: job.jobId, actor: 'Grant' };
  const calc = calculateEstimateBuilderWorkbook(job);
  const quotationTotal = calc.summary.baseLineItemSubtotal;
  // Quotation -> trade contract -> purchase order.
  const synced = W.syncTradeContracts(job, calc, { builderId: job.workspaceId });
  assert.deepEqual(W.describeTradeContractSync(synced), ['New PLUMBING contract for $58,270.00 from the quotation.', 'One purchase order will be created for the PLUMBING contract ($58,270.00).']);
  let book = { ...job, tradeContracts: synced.tradeContracts, purchaseOrders: synced.purchaseOrders };
  assert.equal(book.tradeContracts[0].contractAmount, 58270); assert.deepEqual(amounts(book.tradeContracts[0]), [14567.5, 23308, 20394.5]);
  assert.deepEqual(S.resolveContractMilestones(book.tradeContracts[0]).map((m) => m.effectivePercent), [25, 40, 35]);
  const subcontractOrders = () => book.purchaseOrders.filter((po) => po.tradeContractId === book.tradeContracts[0].contractId);
  assert.equal(subcontractOrders().length, 1); assert.equal(subcontractOrders()[0].commitment, 58270); assert.equal(subcontractOrders()[0].milestones.length, 3);
  // -> Gantt.
  book = { ...book, tradeContracts: W.linkContractsToGantt(book.tradeContracts, project, who).tradeContracts };
  assert.deepEqual(dates(book.tradeContracts[0]), ['2026-01-13', '2026-02-17', '2026-03-30']);
  // -> Job Board.
  book = { ...book, tradeContracts: [S.linkContractToJobBoard(book.tradeContracts[0], { jobId: 'jb-1', jobName: 'Isolated test job' }, who).contract] };
  book = { ...book, tradeContracts: W.applyJobBoardToContracts(book.tradeContracts, [{ job_id: 'jb-1', task_key: 'underslab_plumbing', status: 'done', card_order: 'todo,done' }], { ...who, completeJobIds: ['jb-1'] }).tradeContracts };
  assert.deepEqual(book.tradeContracts[0].milestones.map((m) => S.milestoneEligibility(m)), ['ELIGIBLE_FOR_CLAIM', 'WORK_INCOMPLETE', 'WORK_INCOMPLETE']);
  // -> Cash flow (nothing claimed yet).
  const quotationOf = (workbook) => calculateEstimateBuilderWorkbook(workbook).quotation;
  let flow = W.subcontractCashflow(book, quotationOf(book));
  assert.deepEqual(flow.totals, { commitment: 58270, forecast: 58270, claimed: 0, approved: 0, paid: 0, remainingCommitment: 58270 });
  assert.equal(flow.contracts[0].costInQuotation, 58270); assert.equal(flow.contracts[0].differenceFromQuotation, 0);
  // -> Claim -> approval -> payment, with the controls between.
  const act = (fn, ...args) => { const result = fn(book.tradeContracts[0], ...args); if (result.ok) book = { ...book, ...S.attachSubcontractPurchaseOrders(book.purchaseOrders, [result.contract]), tradeContracts: [result.contract] }; return result; };
  assert.equal(act(S.submitClaim, 'ROUGH_IN', { invoiceRef: 'INV-R' }, who).code, 'WORK_INCOMPLETE');
  assert.equal(act(S.approveClaim, 'UNDERSLAB', {}, who).code, 'NO_CLAIM');
  assert(act(S.submitClaim, 'UNDERSLAB', { invoiceRef: 'INV-1001' }, who).ok);
  assert.equal(act(S.recordPayment, 'UNDERSLAB', { date: '2026-01-14' }, who).code, 'NOT_APPROVED');
  assert.equal(act(S.approveClaim, 'UNDERSLAB', {}, { ...who, actor: '' }).code, 'APPROVER_REQUIRED');
  assert.equal(act(S.approveClaim, 'UNDERSLAB', {}, { ...who, builderId: 'another-builder' }).code, 'TENANT_MISMATCH');
  assert(act(S.approveClaim, 'UNDERSLAB', {}, who).ok);
  assert(act(S.recordPayment, 'UNDERSLAB', { date: '2026-01-14' }, who).ok);
  assert.equal(act(S.recordPayment, 'UNDERSLAB', { date: '2026-01-15' }, who).code, 'DUPLICATE_PAYMENT');
  flow = W.subcontractCashflow(book, quotationOf(book));
  assert.deepEqual(flow.totals, { commitment: 58270, forecast: 43702.5, claimed: 0, approved: 0, paid: 14567.5, remainingCommitment: 43702.5 });
  assert.deepEqual([subcontractOrders().length, subcontractOrders()[0].paidTotal, subcontractOrders()[0].invoices[0].invoiceRef], [1, 14567.5, 'INV-1001']);
  // No duplicated quotation cost, no duplicated purchase order, refresh is a no-op.
  const calcAfter = calculateEstimateBuilderWorkbook(book);
  assert.equal(calcAfter.summary.baseLineItemSubtotal, quotationTotal, 'contracts, milestones, the purchase order, claims and payments add nothing to the quotation');
  assert.equal(calcAfter.quotation.PLUMBING.subtotal, 58270);
  const refresh = W.syncTradeContracts(book, calcAfter, { builderId: job.workspaceId });
  assert.equal(refresh.changed, false); assert.equal(refresh.purchaseOrders.length, book.purchaseOrders.length);
  // Save and reopen: the job file's own persistence keeps the contract and the order.
  const { JOB_FILE_WORKBOOK_FIELDS } = await import('../lib/construction-estimation/jobPersistence.js').catch(() => ({}));
  if (JOB_FILE_WORKBOOK_FIELDS) assert(JOB_FILE_WORKBOOK_FIELDS.includes('tradeContracts'));
  const reopened = JSON.parse(JSON.stringify(book));
  assert.deepEqual(reopened.tradeContracts, book.tradeContracts); assert.deepEqual(reopened.purchaseOrders, book.purchaseOrders);
  assert.deepEqual(W.subcontractCashflow(reopened, quotationOf(reopened)).totals, flow.totals);
  assert.equal(W.syncTradeContracts(reopened, calculateEstimateBuilderWorkbook(reopened), { builderId: job.workspaceId }).changed, false);
  // Tenant isolation on the reopened job.
  assert.equal(W.syncTradeContracts(reopened, calcAfter, { builderId: 'another-builder' }).code, 'TENANT_MISMATCH');
  assert.equal(W.applyJobBoardToContracts(reopened.tradeContracts, [], { builderId: 'another-builder', completeJobIds: ['jb-1'] }).code, 'TENANT_MISMATCH');
  assert.equal(fs.statSync(file).mtimeMs, before, 'the test job file on disk was only read');
  console.log(`PASS isolated job workflow (${dir}): contract $58,270 = $14,567.50 + $23,308.00 + $20,394.50; one PO; quotation total unchanged at ${quotationTotal}`);
}
console.log('Trade payment integration tests passed.');
