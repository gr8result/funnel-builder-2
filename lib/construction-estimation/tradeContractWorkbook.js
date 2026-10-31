// Connects the trade payment schedule to a workbook: contracts persist in workbook.tradeContracts, the quotation supplies each
// contract amount, one subcontract PO per contract lives in workbook.purchaseOrders, and the Gantt supplies dates and completion.
import {
  SYSTEM_TRADE_TEMPLATES, applyJobBoardCompletion, applyLinkedWorkCompletion, attachSubcontractPurchaseOrders, createTradeContract, effectiveScheduledDate, getBuilderTemplate,
  linkMilestonesToSchedule, normalizeTradeKey, resolveContractMilestones, syncContractToQuotation, tradeCashflowForecast,
} from "./tradePaymentSchedule.js";

export const sectionKeyOf = (name) => normalizeTradeKey(name);

// The quotation's total for the trade's source section, counted once. Allocation rows cost nothing, so they are never part of it.
export function quotationTotalForTrade(quotation = {}, sourceSection = "") {
  const key = sectionKeyOf(sourceSection);
  const name = Object.keys(quotation).find((entry) => sectionKeyOf(entry) === key);
  return name ? Math.round((Number(quotation[name].subtotal) || 0) * 100) / 100 : 0;
}

// Create missing contracts (one per trade with a template and a quoted amount) and keep each amount in step with the quotation.
// templates is the builder's master store; trades without a builder template fall back to the system defaults.
export function syncTradeContracts(workbook = {}, calc = {}, { builderId, templates = {}, actor = "system", trades = Object.keys(SYSTEM_TRADE_TEMPLATES) } = {}) {
  if (!builderId) return { ok: false, code: "BUILDER_REQUIRED", message: "No builder (workspace) id; contracts are not created." };
  const jobId = workbook.jobId;
  if (!jobId) return { ok: false, code: "JOB_REQUIRED", message: "No job id." };
  const existing = Array.isArray(workbook.tradeContracts) ? workbook.tradeContracts : [];
  const foreign = existing.filter((contract) => contract.builderId !== builderId || contract.jobId !== jobId);
  if (foreign.length) return { ok: false, code: "TENANT_MISMATCH", message: "The job holds a contract from another builder or job; nothing was changed." };
  let contracts = [...existing];
  const changes = [], held = [];
  for (const trade of trades) {
    const template = getBuilderTemplate(templates, builderId, trade);
    if (!template) continue;
    const total = quotationTotalForTrade(calc.quotation, template.sourceSection || trade);
    const index = contracts.findIndex((contract) => contract.trade === normalizeTradeKey(trade));
    if (index < 0) {
      if (!(total > 0)) continue;
      const created = createTradeContract({ template, builderId, jobId, contractAmount: total, actor });
      if (!created.ok) return created;
      contracts.push(created.contract); changes.push({ contractId: created.contract.contractId, change: "CREATED", amount: total });
      continue;
    }
    const before = contracts[index];
    // An agreed subcontract price is the builder's decision; the quotation moving does not move it.
    if (before.amountMode === "AGREED") { if (total !== before.contractAmount) held.push({ contractId: before.contractId, reason: "AGREED_AMOUNT", contractAmount: before.contractAmount, quotationTotal: total }); continue; }
    // Money already approved or paid stays as recorded, so the contract is never refreshed below it.
    const settled = settledAmount(before);
    if (total < settled && total !== before.contractAmount) { held.push({ contractId: before.contractId, reason: "BELOW_APPROVED_OR_PAID", contractAmount: before.contractAmount, quotationTotal: total, settled }); continue; }
    const result = syncContractToQuotation(before, total, { builderId, jobId, actor });
    if (!result.ok) return result;
    if (!result.unchanged) { contracts[index] = result.contract; changes.push({ contractId: result.contract.contractId, change: "AMOUNT_UPDATED", from: before.contractAmount, amount: total, preservedMilestones: result.approvedMilestonesAffected || [], approvedVariations: (before.approvedVariations || []).length }); }
  }
  const existingOrders = Array.isArray(workbook.purchaseOrders) ? workbook.purchaseOrders : [];
  const attached = attachSubcontractPurchaseOrders(existingOrders, contracts);
  const poChanged = JSON.stringify(attached.purchaseOrders) !== JSON.stringify(workbook.purchaseOrders || []);
  // One order per contract, before and after: a refresh updates the order it finds and only ever adds one for a new contract.
  const purchaseOrders = attached.contracts.map((contract) => {
    const previous = existingOrders.find((order) => order.tradeContractId === contract.contractId);
    const next = attached.purchaseOrders.find((order) => order.tradeContractId === contract.contractId);
    return { contractId: contract.contractId, purchaseOrderId: next.id, change: !previous ? "CREATED" : previous.commitment !== next.commitment ? "VALUE_UPDATED" : "UNCHANGED", from: previous?.commitment ?? null, to: next.commitment };
  });
  return { ok: true, tradeContracts: attached.contracts, purchaseOrders: attached.purchaseOrders, changes, held, purchaseOrderChanges: purchaseOrders, changed: changes.length > 0 || poChanged };
}

const settledAmount = (contract) => Math.round(contract.milestones.reduce((sum, milestone) => sum + Math.max(milestone.claim.status === "APPROVED" ? Number(milestone.claim.approvedAmount) || 0 : 0, Number(milestone.payment.paidAmount) || 0), 0) * 100) / 100;

// What "Create / Refresh Contracts from Quotation" would do, in words, without doing it. The caller shows this, then applies the
// same result only on confirmation.
export function describeTradeContractSync(result) {
  if (!result?.ok) return [];
  const dollars = (value) => `$${(Number(value) || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tradeOf = (contractId) => String(contractId).split(":").pop().replace(/_/g, " ");
  const lines = [];
  for (const change of result.changes) {
    if (change.change === "CREATED") lines.push(`New ${tradeOf(change.contractId)} contract for ${dollars(change.amount)} from the quotation.`);
    else lines.push(`${tradeOf(change.contractId)} contract value ${dollars(change.from)} -> ${dollars(change.amount)}.${change.preservedMilestones.length ? ` ${change.preservedMilestones.length} approved or paid milestone(s) keep their amounts; the open milestones absorb the change.` : ""}${change.approvedVariations ? ` ${change.approvedVariations} approved variation(s) kept.` : ""}`);
  }
  for (const entry of result.held) lines.push(entry.reason === "AGREED_AMOUNT"
    ? `${tradeOf(entry.contractId)} keeps its agreed price of ${dollars(entry.contractAmount)} (quotation now ${dollars(entry.quotationTotal)}).`
    : `${tradeOf(entry.contractId)} not changed: the quotation (${dollars(entry.quotationTotal)}) is below ${dollars(entry.settled)} already approved or paid.`);
  for (const order of result.purchaseOrderChanges) {
    if (order.change === "CREATED") lines.push(`One purchase order will be created for the ${tradeOf(order.contractId)} contract (${dollars(order.to)}).`);
    else if (order.change === "VALUE_UPDATED") lines.push(`The existing ${tradeOf(order.contractId)} purchase order is updated ${dollars(order.from)} -> ${dollars(order.to)}; no new order is created.`);
  }
  return lines;
}

// Dates and finished work from the Gantt (approved schedule first, else the draft). Completion makes a milestone eligible only.
export function linkContractsToGantt(contracts = [], project = null, ctx = {}) {
  const tasks = project?.approvedSchedule?.length ? project.approvedSchedule : project?.draftSchedule || [];
  if (!tasks.length || !project?.projectStartDate) return { ok: true, tradeContracts: contracts, linked: 0, completed: [], moved: [], changed: false };
  const completed = [], moved = [];
  const next = contracts.map((contract) => {
    const linked = linkMilestonesToSchedule(contract, tasks, project.projectStartDate);
    linked.milestones.forEach((milestone, index) => {
      const from = contract.milestones[index].link?.resolved?.date || "", to = milestone.link?.resolved?.date || "";
      if (from !== to) moved.push({ milestoneId: milestone.milestoneId, from, to, shown: effectiveScheduledDate(milestone), overridden: Boolean(milestone.scheduledDate) });
    });
    const done = applyLinkedWorkCompletion(linked, ctx);
    completed.push(...done.completed);
    return done.contract;
  });
  return { ok: true, tradeContracts: next, linked: next.reduce((sum, contract) => sum + contract.milestones.filter((milestone) => milestone.link?.resolved).length, 0), completed, moved, changed: JSON.stringify(next) !== JSON.stringify(contracts) };
}

// The Gantt tasks a milestone can be pointed at, for the job's schedule (approved first, else the draft).
export function ganttTaskOptions(project = null) {
  const tasks = project?.approvedSchedule?.length ? project.approvedSchedule : project?.draftSchedule || [];
  return tasks.filter((task) => task.included !== false).map((task) => ({ id: task.id, label: `${task.stage ? `${task.stage} - ` : ""}${task.task}` }));
}

// Job Board task records -> completion on the contracts linked to that Job Board job. Eligibility only; see applyJobBoardCompletion.
export function applyJobBoardToContracts(contracts = [], records = [], ctx = {}) {
  const completed = [], reopened = [];
  const next = [];
  for (const contract of contracts) {
    // records is the full task list only for the Job Board jobs named in ctx.completeJobIds.
    const result = applyJobBoardCompletion(contract, records, { ...ctx, complete: (ctx.completeJobIds || []).map(String).includes(String(contract.jobBoard?.jobId)) });
    if (!result.ok) return result;
    completed.push(...result.completed); reopened.push(...result.reopened);
    next.push(result.contract);
  }
  return { ok: true, tradeContracts: next, completed, reopened, changed: JSON.stringify(next) !== JSON.stringify(contracts) };
}

// What the quotation's allocation row shows when it is driven by a contract milestone (live against the current quotation total).
export function contractMilestoneAllocation(workbook = {}, allocation = {}, quotationTotal = 0) {
  const trade = normalizeTradeKey(allocation.sourceSection);
  const contract = (workbook.tradeContracts || []).find((entry) => entry.trade === trade);
  const milestoneKey = allocation.milestoneKey || allocation.stage;
  if (!contract || !milestoneKey) return null;
  const live = { ...contract, contractAmount: contract.amountMode === "AGREED" ? contract.contractAmount : quotationTotal };
  const milestone = resolveContractMilestones(live).find((entry) => entry.key === milestoneKey);
  if (!milestone) return null;
  const flags = milestone.flags;
  return {
    stage: milestone.key, contractTotal: live.contractAmount, percent: milestone.effectivePercent, calculatedAmount: milestone.calculatedAmount,
    manualOverride: milestone.mode === "MANUAL_OVERRIDE" ? milestone.allocatedAmount : null, allocatedAmount: milestone.allocatedAmount, mode: milestone.mode,
    formula: "Trade payment schedule", working: `${milestone.label}: ${milestone.effectivePercent}% of the ${contract.trade} contract = ${milestone.allocatedAmount}`,
    flags, status: flags[0] || "OK", groupAllocated: milestone.groupAllocated, remaining: milestone.remaining, overAllocatedBy: milestone.overAllocatedBy,
    managedBy: "TRADE_PAYMENT_SCHEDULE", contractId: contract.contractId, claimStatus: milestone.claim.status,
  };
}

export function outgoingCashflow(workbook = {}) {
  return tradeCashflowForecast(workbook.tradeContracts || []);
}

// The Cashflow page's subcontract view. The quotation already carries each contracted section once in the stage "Outgoing costs";
// the milestones are the payment timing of that same money, so nothing here is added to the page's outgoing total.
// costInQuotation is what the stage table holds for the section, and covered says whether the contract accounts for all of it.
export function subcontractCashflow(workbook = {}, quotation = {}) {
  const flow = tradeCashflowForecast(workbook.tradeContracts || []);
  const contracts = flow.contracts.map((entry) => {
    const contract = workbook.tradeContracts.find((candidate) => candidate.contractId === entry.contractId);
    const costInQuotation = quotationTotalForTrade(quotation, contract.sourceSection);
    return { ...entry, sourceSection: contract.sourceSection, supplierName: contract.supplierName || "", amountMode: contract.amountMode, costInQuotation, differenceFromQuotation: Math.round((entry.commitment - costInQuotation) * 100) / 100 };
  });
  const dated = flow.rows.filter((row) => row.forecast + row.claimed + row.approved + row.paid > 0)
    .map((row) => ({ ...row, open: Math.round((row.forecast + row.claimed + row.approved) * 100) / 100, paymentDate: row.paid && !(row.forecast + row.claimed + row.approved) ? row.paidDate || row.date : row.date }))
    .sort((a, b) => (a.paymentDate || "9999").localeCompare(b.paymentDate || "9999"));
  return { ...flow, contracts, dated, addedToOutgoingCosts: 0 };
}
