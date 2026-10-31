// Shared trade payment schedule: one subcontract commitment per trade contract, paid in milestones.
//
// The quotation prices the trade once; a contract records that amount, the subcontractor, and how it is paid. Milestones are the
// payment schedule of that same amount, so they never add to a quotation, BOQ, purchase order or cash-flow total on their own.
// Amounts reuse resolveProgressAllocations (percent / manual dollar override / remainder / over-allocation) from progressAllocation.js.
//
// Every state change is a pure function returning { ok, contract } or { ok: false, code, message }, appends an audit entry, and
// refuses a contract that belongs to another builder (tenant) or job.

import { resolveProgressAllocations } from "./progressAllocation.js";

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const text = (value) => String(value ?? "").trim();
const money = (value) => { const n = Number(String(value ?? "").replace(/[$,\s]/g, "")); return text(value) === "" || !Number.isFinite(n) ? null : n; };
const clone = (value) => JSON.parse(JSON.stringify(value));
export const normalizeTradeKey = (value) => text(value).toUpperCase().replace(/\s*\(\d+\)\s*$/, "").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export const COMPLETION = Object.freeze({ NOT_STARTED: "NOT_STARTED", IN_PROGRESS: "IN_PROGRESS", COMPLETE: "COMPLETE" });
export const CLAIM = Object.freeze({ NOT_CLAIMED: "NOT_CLAIMED", CLAIMED: "CLAIMED", APPROVED: "APPROVED", REJECTED: "REJECTED" });

// A system default only: builders replace it per trade with their own template (saveBuilderTemplate).
export const SYSTEM_TRADE_TEMPLATES = Object.freeze({
  PLUMBING: Object.freeze({
    templateId: "system:PLUMBING", builderId: "", trade: "PLUMBING", name: "Plumbing - underslab / rough-in / fit-off", revision: 1,
    sourceSection: "PLUMBING",
    milestones: Object.freeze([
      Object.freeze({ key: "UNDERSLAB", label: "Underslab", percent: 25, remainder: false, constructionStage: "Slab / Base Stage", link: Object.freeze({ source: "GANTT", stage: "Slab / Base Stage", taskMatch: "slab|concrete", relation: "BEFORE", jobBoardTaskKey: "underslab_plumbing", prefer: Object.freeze([Object.freeze({ taskMatch: "under.?slab|drain", relation: "AT_COMPLETION" })]) }) }),
      Object.freeze({ key: "ROUGH_IN", label: "Rough-in", percent: 40, remainder: false, constructionStage: "Fit-Out / Rough-Ins", link: Object.freeze({ source: "GANTT", stage: "Fit-Out / Rough-Ins", taskMatch: "plumb|rough", relation: "AT_COMPLETION", jobBoardTaskKey: "rough_plumbing", fallback: Object.freeze([Object.freeze({ taskMatch: "rough", relation: "AT_COMPLETION" })]) }) }),
      Object.freeze({ key: "FIT_OFF", label: "Fit-off", percent: null, remainder: true, constructionStage: "Fit-Off Trades", link: Object.freeze({ source: "GANTT", stage: "Fit-Off Trades", taskMatch: "plumb|fit", relation: "AT_COMPLETION", jobBoardTaskKey: "fix_plumbing", fallback: Object.freeze([Object.freeze({ taskMatch: "fit.?off|fix.?out|final fix", relation: "AT_COMPLETION" })]) }) }),
    ]),
  }),
});

// ---- Builder templates (master, per tenant) -------------------------------------------------------------------------

export function validateTemplateMilestones(milestones = []) {
  const issues = [];
  const keys = new Set();
  let fixed = 0, remainders = 0;
  for (const milestone of milestones) {
    if (!text(milestone.key)) issues.push({ code: "MILESTONE_KEY_REQUIRED" });
    if (keys.has(milestone.key)) issues.push({ code: "DUPLICATE_MILESTONE_KEY", key: milestone.key });
    keys.add(milestone.key);
    if (milestone.remainder) { remainders += 1; continue; }
    const percent = money(milestone.percent);
    if (percent === null || percent < 0 || percent > 100) issues.push({ code: "INVALID_PERCENT", key: milestone.key });
    else fixed += percent;
  }
  if (remainders > 1) issues.push({ code: "MULTIPLE_REMAINDER_MILESTONES" });
  if (fixed > 100 + 0.005) issues.push({ code: "PERCENT_OVER_100", total: roundMoney(fixed) });
  if (!remainders && Math.abs(fixed - 100) > 0.005) issues.push({ code: "PERCENT_TOTAL_NOT_100", total: roundMoney(fixed) });
  return issues;
}

// templates: { [builderId]: { [TRADE]: template } } - the builder master store. Never mutated; every change returns a new store.
export function getBuilderTemplate(store = {}, builderId, trade) {
  const key = normalizeTradeKey(trade);
  const own = store?.[builderId]?.[key];
  if (own) return own;
  const system = SYSTEM_TRADE_TEMPLATES[key];
  return system ? { ...clone(system), builderId } : null;
}

export function saveBuilderTemplate(store = {}, builderId, template, { actor = "" } = {}) {
  if (!text(builderId)) return { ok: false, code: "BUILDER_REQUIRED", message: "A builder id is required." };
  const trade = normalizeTradeKey(template?.trade);
  if (!trade) return { ok: false, code: "TRADE_REQUIRED", message: "A trade is required." };
  const issues = validateTemplateMilestones(template.milestones || []);
  if (issues.length) return { ok: false, code: "INVALID_TEMPLATE", message: "Template milestones are invalid.", issues };
  const previous = store?.[builderId]?.[trade];
  const saved = { ...clone(template), templateId: `builder:${builderId}:${trade}`, builderId, trade, revision: (previous?.revision || 0) + 1, updatedBy: actor, updatedAt: new Date().toISOString() };
  return { ok: true, template: saved, store: { ...store, [builderId]: { ...(store?.[builderId] || {}), [trade]: saved } } };
}

// ---- Contracts -------------------------------------------------------------------------------------------------------

const newMilestone = (contractId, templateMilestone, order) => ({
  milestoneId: `${contractId}:${templateMilestone.key}`, key: templateMilestone.key, label: templateMilestone.label, order,
  percent: templateMilestone.remainder ? null : templateMilestone.percent, remainder: Boolean(templateMilestone.remainder), manualAmount: "",
  constructionStage: templateMilestone.constructionStage || "", link: { ...(templateMilestone.link || {}), taskId: "" }, scheduledDate: "",
  completion: { status: COMPLETION.NOT_STARTED, completedAt: "", source: "" },
  claim: { status: CLAIM.NOT_CLAIMED, claimedAmount: null, claimedAt: "", approvedAmount: null, approvedBy: "", approvedAt: "", rejectedReason: "" },
  invoiceRef: "", payment: { paidAmount: 0, paidDate: "" },
});

// The job gets a deep copy: editing the job can never reach the builder's master template.
export function createTradeContract({ template, builderId, jobId, contractAmount = 0, supplierId = "", supplierName = "", actor = "", now = new Date().toISOString() }) {
  if (!text(builderId) || !text(jobId)) return { ok: false, code: "IDENTITY_REQUIRED", message: "Builder and job ids are required." };
  if (!template) return { ok: false, code: "TEMPLATE_REQUIRED", message: "No payment template exists for this trade." };
  if (template.builderId && template.builderId !== builderId) return { ok: false, code: "TENANT_MISMATCH", message: "Template belongs to another builder." };
  const issues = validateTemplateMilestones(template.milestones);
  if (issues.length) return { ok: false, code: "INVALID_TEMPLATE", message: "Template milestones are invalid.", issues };
  const contractId = `tc:${jobId}:${normalizeTradeKey(template.trade)}`;
  const contract = {
    contractId, builderId, jobId, trade: normalizeTradeKey(template.trade), sourceSection: template.sourceSection || template.trade,
    supplierId, supplierName, contractAmount: roundMoney(contractAmount), amountMode: "QUOTATION", agreedAmount: "", poId: "",
    templateId: template.templateId, templateRevision: template.revision || 1, templateSnapshot: clone(template.milestones),
    // A builder template that only sets percentages keeps the system's schedule links for the milestones it shares by key.
    milestones: template.milestones.map((milestone, index) => newMilestone(contractId, milestone.link?.taskMatch ? milestone : { ...milestone, link: { ...(SYSTEM_TRADE_TEMPLATES[normalizeTradeKey(template.trade)]?.milestones.find((entry) => entry.key === milestone.key)?.link || {}), ...(milestone.link || {}) } }, index + 1)),
    approvedVariations: [], audit: [], createdAt: now,
  };
  return { ok: true, contract: withAudit(contract, { actor, action: "CONTRACT_CREATED", note: `From template ${template.templateId} r${contract.templateRevision}`, to: contract.contractAmount }, now) };
}

const withAudit = (contract, entry, now = new Date().toISOString()) => ({ ...contract, audit: [...(contract.audit || []), { at: now, actor: entry.actor || "", action: entry.action, milestoneId: entry.milestoneId || "", field: entry.field || "", from: entry.from ?? null, to: entry.to ?? null, note: entry.note || "" }] });
const fail = (code, message) => ({ ok: false, code, message });
const guard = (contract, ctx = {}) => {
  if (!contract) return fail("CONTRACT_REQUIRED", "Contract not found.");
  if (!ctx.builderId || ctx.builderId !== contract.builderId) return fail("TENANT_MISMATCH", "This contract belongs to another builder.");
  if (ctx.jobId && ctx.jobId !== contract.jobId) return fail("JOB_MISMATCH", "This contract belongs to another job.");
  return null;
};
const approvedVariationTotal = (contract) => roundMoney((contract.approvedVariations || []).reduce((sum, variation) => sum + (Number(variation.amount) || 0), 0));
export const commitmentOf = (contract) => roundMoney(contract.contractAmount + approvedVariationTotal(contract));

// Percent / override / remainder amounts for every milestone, from the one contract amount.
export function resolveContractMilestones(contract) {
  const results = resolveProgressAllocations(contract.contractAmount, contract.milestones.map((milestone) => ({
    key: milestone.milestoneId, allocation: { stage: milestone.key, percent: milestone.percent ?? 0, manualAmount: locked(milestone) ? milestone.claim.approvedAmount ?? milestone.payment.paidAmount : milestone.manualAmount, remainder: milestone.remainder },
  })));
  return contract.milestones.map((milestone) => {
    const result = results.get(milestone.milestoneId);
    const effectivePercent = contract.contractAmount > 0 ? roundMoney((result.allocatedAmount / contract.contractAmount) * 10000) / 100 : 0;
    return { ...milestone, allocatedAmount: result.allocatedAmount, calculatedAmount: result.calculatedAmount, mode: result.mode, effectivePercent, flags: result.flags, groupAllocated: result.groupAllocated, remaining: result.remaining, overAllocatedBy: result.overAllocatedBy };
  });
}

export function validateTradeContract(contract) {
  const issues = [];
  const resolved = resolveContractMilestones(contract);
  const keys = new Set();
  for (const milestone of contract.milestones) { if (keys.has(milestone.key)) issues.push({ severity: "error", code: "DUPLICATE_MILESTONE", milestoneId: milestone.milestoneId }); keys.add(milestone.key); }
  const total = resolved.reduce((sum, milestone) => sum + milestone.allocatedAmount, 0);
  const totalPercent = contract.contractAmount > 0 ? roundMoney((total / contract.contractAmount) * 10000) / 100 : 0;
  if (resolved[0]?.overAllocatedBy) issues.push({ severity: "error", code: "OVER_ALLOCATED", by: resolved[0].overAllocatedBy });
  else if (contract.contractAmount > 0 && Math.abs(total - contract.contractAmount) > 0.005) issues.push({ severity: "warning", code: "UNDER_ALLOCATED", by: roundMoney(contract.contractAmount - total) });
  for (const milestone of resolved) for (const flag of milestone.flags) if (flag.startsWith("INVALID")) issues.push({ severity: "error", code: flag, milestoneId: milestone.milestoneId });
  const refs = new Map();
  for (const milestone of contract.milestones) { const ref = text(milestone.invoiceRef).toLowerCase(); if (ref) refs.set(ref, [...(refs.get(ref) || []), milestone.milestoneId]); }
  for (const [ref, ids] of refs) if (ids.length > 1) issues.push({ severity: "error", code: "DUPLICATE_INVOICE_REFERENCE", invoiceRef: ref, milestones: ids });
  const paid = roundMoney(contract.milestones.reduce((sum, milestone) => sum + (Number(milestone.payment.paidAmount) || 0), 0));
  const approved = roundMoney(contract.milestones.reduce((sum, milestone) => sum + (milestone.claim.status === CLAIM.APPROVED ? Number(milestone.claim.approvedAmount) || 0 : 0), 0));
  if (paid - commitmentOf(contract) > 0.005) issues.push({ severity: "error", code: "PAYMENT_EXCEEDS_CONTRACT", by: roundMoney(paid - commitmentOf(contract)) });
  if (approved - commitmentOf(contract) > 0.005) issues.push({ severity: "error", code: "APPROVALS_EXCEED_CONTRACT", by: roundMoney(approved - commitmentOf(contract)) });
  if (!(contract.contractAmount > 0)) issues.push({ severity: "warning", code: "NO_CONTRACT_AMOUNT" });
  if (!text(contract.supplierName) && !text(contract.supplierId)) issues.push({ severity: "warning", code: "SUPPLIER_REQUIRED" });
  return { ok: !issues.some((issue) => issue.severity === "error"), issues, milestones: resolved, totalAllocated: roundMoney(total), totalPercent, commitment: commitmentOf(contract), paid, approved };
}

const findMilestone = (contract, key) => contract.milestones.find((milestone) => milestone.key === key || milestone.milestoneId === key);
const replaceMilestone = (contract, milestone) => ({ ...contract, milestones: contract.milestones.map((entry) => (entry.milestoneId === milestone.milestoneId ? milestone : entry)) });
const locked = (milestone) => milestone.claim.status === CLAIM.APPROVED || (Number(milestone.payment.paidAmount) || 0) > 0;

// The quotation amount (or an agreed amount) changed. Percentage milestones follow; manual dollar overrides are kept.
export function setContractAmount(contract, amount, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const value = money(amount);
  if (value === null || value < 0) return fail("INVALID_AMOUNT", "Contract amount must be 0 or more.");
  const next = roundMoney(value);
  if (next === contract.contractAmount) return { ok: true, contract, unchanged: true };
  const changedAfterApproval = contract.milestones.filter((milestone) => locked(milestone)).map((milestone) => milestone.milestoneId);
  const updated = withAudit({ ...contract, contractAmount: next }, { actor: ctx.actor, action: "CONTRACT_AMOUNT_CHANGED", field: "contractAmount", from: contract.contractAmount, to: next, note: changedAfterApproval.length ? `Approved or paid milestones keep their approved amounts: ${changedAfterApproval.join(", ")}` : "Percentage milestones recalculated; manual overrides preserved" });
  return { ok: true, contract: updated, approvedMilestonesAffected: changedAfterApproval };
}

export function setAgreedAmount(contract, amount, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const value = money(amount);
  if (text(amount) !== "" && (value === null || value < 0)) return fail("INVALID_AMOUNT", "Agreed amount must be 0 or more.");
  const next = text(amount) === "" ? { ...contract, amountMode: "QUOTATION", agreedAmount: "" } : { ...contract, amountMode: "AGREED", agreedAmount: roundMoney(value), contractAmount: roundMoney(value) };
  return { ok: true, contract: withAudit(next, { actor: ctx.actor, action: "AGREED_AMOUNT_SET", field: "agreedAmount", from: contract.agreedAmount || null, to: text(amount) === "" ? null : roundMoney(value) }) };
}

// The quotation is the source unless an agreed amount is held. Called whenever the quotation total for the trade is recalculated.
export function syncContractToQuotation(contract, quotationTotal, ctx = {}) {
  if (contract.amountMode === "AGREED") return { ok: true, contract, unchanged: true, held: "AGREED_AMOUNT" };
  return setContractAmount(contract, quotationTotal, ctx);
}

export function setMilestoneField(contract, key, field, value, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  const allocationFields = ["percent", "manualAmount", "remainder"];
  if (allocationFields.includes(field) && locked(milestone)) return fail("MILESTONE_LOCKED", "An approved or paid milestone cannot be re-allocated; reject or reverse the claim first.");
  let next;
  if (field === "percent") {
    const percent = money(value);
    if (percent === null || percent < 0 || percent > 100) return fail("INVALID_PERCENT", "Percentage must be between 0 and 100.");
    next = { ...milestone, percent, remainder: false };
  } else if (field === "manualAmount") {
    const amount = money(value);
    if (text(value) !== "" && (amount === null || amount < 0)) return fail("INVALID_OVERRIDE", "Override must be a dollar amount of 0 or more.");
    next = { ...milestone, manualAmount: text(value) === "" ? "" : roundMoney(amount) };
  } else if (["scheduledDate", "constructionStage"].includes(field)) next = { ...milestone, [field]: text(value) };
  else return fail("FIELD_NOT_EDITABLE", `${field} cannot be edited here.`);
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor, action: "MILESTONE_EDITED", milestoneId: milestone.milestoneId, field, from: milestone[field] ?? null, to: next[field] ?? null }) };
}

// Linked work finished. This makes the milestone eligible; it never claims, approves or pays.
export function setMilestoneCompletion(contract, key, status, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  if (!Object.values(COMPLETION).includes(status)) return fail("INVALID_STATUS", "Unknown completion status.");
  const next = { ...milestone, completion: { status, completedAt: status === COMPLETION.COMPLETE ? (ctx.at || new Date().toISOString()) : "", source: ctx.source || "MANUAL", sourceRef: ctx.sourceRef || "" } };
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor || ctx.source, action: "COMPLETION_SET", milestoneId: milestone.milestoneId, field: "completion", from: milestone.completion.status, to: status, note: ctx.sourceRef || "" }) };
}

export function milestoneEligibility(milestone) {
  if (milestone.claim.status === CLAIM.APPROVED && Number(milestone.payment.paidAmount) >= Number(milestone.claim.approvedAmount || 0) && Number(milestone.payment.paidAmount) > 0) return "PAID";
  if (milestone.claim.status === CLAIM.APPROVED) return "APPROVED_UNPAID";
  if (milestone.claim.status === CLAIM.CLAIMED) return "AWAITING_APPROVAL";
  return milestone.completion.status === COMPLETION.COMPLETE ? "ELIGIBLE_FOR_CLAIM" : "WORK_INCOMPLETE";
}

export function submitClaim(contract, key, { amount, invoiceRef = "" } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const resolved = resolveContractMilestones(contract).find((milestone) => milestone.key === key || milestone.milestoneId === key);
  if (!resolved) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  if (resolved.claim.status === CLAIM.CLAIMED || resolved.claim.status === CLAIM.APPROVED) return fail("DUPLICATE_CLAIM", "This milestone has already been claimed.");
  if (resolved.completion.status !== COMPLETION.COMPLETE && !ctx.allowEarly) return fail("WORK_INCOMPLETE", "The linked work is not complete.");
  const claimed = money(amount ?? resolved.allocatedAmount);
  if (claimed === null || claimed <= 0) return fail("INVALID_AMOUNT", "Claim amount must be greater than 0.");
  if (claimed - resolved.allocatedAmount > 0.005) return fail("CLAIM_EXCEEDS_MILESTONE", `Claim exceeds the milestone amount of ${resolved.allocatedAmount}.`);
  const ref = text(invoiceRef);
  if (ref && contract.milestones.some((entry) => entry.milestoneId !== resolved.milestoneId && text(entry.invoiceRef).toLowerCase() === ref.toLowerCase())) return fail("DUPLICATE_INVOICE_REFERENCE", "That invoice reference is already used on this contract.");
  const next = { ...findMilestone(contract, key), invoiceRef: ref, claim: { ...resolved.claim, status: CLAIM.CLAIMED, claimedAmount: roundMoney(claimed), claimedAt: ctx.at || new Date().toISOString(), rejectedReason: "" } };
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor, action: "CLAIM_SUBMITTED", milestoneId: resolved.milestoneId, field: "claimedAmount", to: roundMoney(claimed), note: ref }) };
}

// Approval is a person's decision. A named approver is mandatory; completion alone can never approve.
export function approveClaim(contract, key, { amount } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  if (!text(ctx.actor) || /^(system|automation|auto)$/i.test(ctx.actor)) return fail("APPROVER_REQUIRED", "Approval needs a named person.");
  if (milestone.claim.status !== CLAIM.CLAIMED) return fail("NO_CLAIM", "There is no submitted claim to approve.");
  if (milestone.completion.status !== COMPLETION.COMPLETE && !ctx.allowEarly) return fail("WORK_INCOMPLETE", "The linked work is not complete.");
  const approved = money(amount ?? milestone.claim.claimedAmount);
  if (approved === null || approved <= 0 || approved - milestone.claim.claimedAmount > 0.005) return fail("INVALID_AMOUNT", "Approved amount must be above 0 and no more than the claim.");
  const otherApproved = contract.milestones.reduce((sum, entry) => sum + (entry.milestoneId !== milestone.milestoneId && entry.claim.status === CLAIM.APPROVED ? Number(entry.claim.approvedAmount) || 0 : 0), 0);
  if (otherApproved + approved - commitmentOf(contract) > 0.005) return fail("APPROVALS_EXCEED_CONTRACT", "Approvals would exceed the contract plus approved variations.");
  const next = { ...milestone, claim: { ...milestone.claim, status: CLAIM.APPROVED, approvedAmount: roundMoney(approved), approvedBy: ctx.actor, approvedAt: ctx.at || new Date().toISOString() } };
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor, action: "CLAIM_APPROVED", milestoneId: milestone.milestoneId, field: "approvedAmount", from: milestone.claim.claimedAmount, to: roundMoney(approved) }) };
}

export function rejectClaim(contract, key, { reason = "" } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  if (milestone.claim.status !== CLAIM.CLAIMED) return fail("NO_CLAIM", "There is no submitted claim to reject.");
  if (!text(ctx.actor)) return fail("APPROVER_REQUIRED", "Rejection needs a named person.");
  const next = { ...milestone, claim: { ...milestone.claim, status: CLAIM.REJECTED, rejectedReason: text(reason) }, invoiceRef: "" };
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor, action: "CLAIM_REJECTED", milestoneId: milestone.milestoneId, note: text(reason) }) };
}

export function recordPayment(contract, key, { amount, date, invoiceRef } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  if (milestone.claim.status !== CLAIM.APPROVED) return fail("NOT_APPROVED", "Only an approved claim can be paid.");
  const open = roundMoney(milestone.claim.approvedAmount - (Number(milestone.payment.paidAmount) || 0));
  if (open <= 0.005) return fail("DUPLICATE_PAYMENT", "This milestone has already been paid in full.");
  const paid = money(amount ?? open);
  if (paid === null || paid <= 0) return fail("INVALID_AMOUNT", "Payment must be greater than 0.");
  if (paid - open > 0.005) return fail("PAYMENT_EXCEEDS_APPROVAL", `Payment exceeds the approved balance of ${open}.`);
  const totalPaid = roundMoney(contract.milestones.reduce((sum, entry) => sum + (Number(entry.payment.paidAmount) || 0), 0) + paid);
  if (totalPaid - commitmentOf(contract) > 0.005) return fail("PAYMENT_EXCEEDS_CONTRACT", "Payments would exceed the contract. An approved variation is required first.");
  const ref = text(invoiceRef) || text(milestone.invoiceRef);
  if (!ref) return fail("INVOICE_REQUIRED", "An invoice reference is required to record a payment.");
  if (contract.milestones.some((entry) => entry.milestoneId !== milestone.milestoneId && text(entry.invoiceRef).toLowerCase() === ref.toLowerCase())) return fail("DUPLICATE_INVOICE_REFERENCE", "That invoice reference is already used on this contract.");
  if (!text(date)) return fail("DATE_REQUIRED", "A payment date is required.");
  const next = { ...milestone, invoiceRef: ref, payment: { paidAmount: roundMoney((Number(milestone.payment.paidAmount) || 0) + paid), paidDate: text(date) } };
  return { ok: true, contract: withAudit(replaceMilestone(contract, next), { actor: ctx.actor, action: "PAYMENT_RECORDED", milestoneId: milestone.milestoneId, field: "paidAmount", to: roundMoney(paid), note: ref }) };
}

export function addApprovedVariation(contract, { id, amount, description = "" } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const value = money(amount);
  if (!text(id) || value === null) return fail("INVALID_VARIATION", "A variation id and amount are required.");
  if (!text(ctx.actor)) return fail("APPROVER_REQUIRED", "A variation needs a named approver.");
  if ((contract.approvedVariations || []).some((variation) => variation.id === id)) return fail("DUPLICATE_VARIATION", "That variation is already on the contract.");
  const variation = { id, amount: roundMoney(value), description, approvedBy: ctx.actor, approvedAt: ctx.at || new Date().toISOString() };
  return { ok: true, contract: withAudit({ ...contract, approvedVariations: [...(contract.approvedVariations || []), variation] }, { actor: ctx.actor, action: "VARIATION_APPROVED", to: variation.amount, note: id }) };
}

export function assignSupplier(contract, { supplierId = "", supplierName = "" } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  return { ok: true, contract: withAudit({ ...contract, supplierId, supplierName }, { actor: ctx.actor, action: "SUPPLIER_ASSIGNED", from: contract.supplierName || null, to: supplierName }) };
}

// ---- Schedule (Gantt) -------------------------------------------------------------------------------------------------

const isoDate = (date) => { const d = new Date(date); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };
const addDays = (date, days) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d; };
const tradeStem = (trade) => text(trade).replace(/_/g, " ").replace(/(ing|er|al|ian)$/i, "");

// The Gantt activity for a milestone: the task it is already linked to (stable id), else the template's rules in order -
// preferred activity, the stage activity, then a named fallback. Only the "before the slab" rule may sit on another trade's task.
function findScheduleTask(contract, link, usable) {
  const linked = link.taskId && usable.find((entry) => entry.id === link.taskId);
  if (linked) return { task: linked, relation: link.taskRelation || link.relation || "AT_COMPLETION" };
  if (link.manualTask) return null;
  const trade = contract.trade ? new RegExp(tradeStem(contract.trade), "i") : null;
  const rules = [...(link.prefer || []), { stage: link.stage, taskMatch: link.taskMatch, relation: link.relation }, ...(link.fallback || [])];
  for (const rule of rules) {
    if (!rule.taskMatch) continue;
    const pattern = new RegExp(rule.taskMatch, "i");
    const task = usable.find((entry) => (!rule.stage || entry.stage === rule.stage) && pattern.test(`${entry.task} ${entry.trade}`) && (rule.relation === "BEFORE" || !trade || trade.test(`${entry.trade} ${entry.task}`)));
    if (task) return { task, relation: rule.relation || "AT_COMPLETION" };
  }
  return null;
}

// tasks: Gantt tasks { id, stage, task, trade, startOffsetDays, durationDays, included, progressPercent?, status? }.
// Each open milestone takes its forecast date from its activity, so a moved task moves the forecast. An approved or paid
// milestone is a payment record: it is returned untouched, whatever the schedule now says.
export function linkMilestonesToSchedule(contract, tasks = [], projectStartDate) {
  const start = new Date(projectStartDate);
  const usable = tasks.filter((task) => task.included !== false);
  const milestones = contract.milestones.map((milestone) => {
    if (locked(milestone)) return milestone;
    const link = milestone.link || {};
    const found = Number.isNaN(start.getTime()) ? null : findScheduleTask(contract, link, usable);
    if (!found) return { ...milestone, link: { ...link, resolved: null } };
    const { task, relation } = found;
    const taskStart = addDays(start, task.startOffsetDays || 0);
    const date = isoDate(relation === "BEFORE" ? taskStart : addDays(taskStart, task.durationDays || 1));
    const complete = Number(task.progressPercent) >= 100 || /^(complete|completed|done)$/i.test(task.status || "");
    return { ...milestone, link: { ...link, taskId: task.id, taskRelation: relation, resolved: { taskId: task.id, taskName: task.task, stage: task.stage, date, workComplete: complete } } };
  });
  return { ...contract, milestones };
}

// A manual date wins over the Gantt until it is cleared; the source says which one is showing.
export const effectiveScheduledDate = (milestone) => milestone.scheduledDate || milestone.link?.resolved?.date || "";
export const scheduledDateSource = (milestone) => (milestone.scheduledDate ? "MANUAL" : milestone.link?.resolved?.date ? "GANTT" : "NONE");

// Point a milestone at a chosen Gantt task and/or Job Board task by stable id. An empty Gantt task id returns it to automatic matching.
export function setMilestoneLink(contract, key, { ganttTaskId, jobBoardTaskKey } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const milestone = findMilestone(contract, key);
  if (!milestone) return fail("MILESTONE_NOT_FOUND", `No milestone ${key}.`);
  let link = { ...(milestone.link || {}) };
  if (ganttTaskId !== undefined) {
    if (locked(milestone)) return fail("MILESTONE_LOCKED", "An approved or paid milestone keeps its schedule link.");
    link = { ...link, taskId: text(ganttTaskId), manualTask: Boolean(text(ganttTaskId)), taskRelation: text(ganttTaskId) ? "AT_COMPLETION" : "", resolved: null };
  }
  if (jobBoardTaskKey !== undefined) link = { ...link, jobBoardTaskKey: text(jobBoardTaskKey) };
  const field = ganttTaskId !== undefined ? "ganttTaskId" : "jobBoardTaskKey";
  const before = field === "ganttTaskId" ? milestone.link?.taskId : milestone.link?.jobBoardTaskKey;
  return { ok: true, contract: withAudit(replaceMilestone(contract, { ...milestone, link }), { actor: ctx.actor, action: "MILESTONE_LINKED", milestoneId: milestone.milestoneId, field, from: before || null, to: (field === "ganttTaskId" ? link.taskId : link.jobBoardTaskKey) || null }) };
}

// Completion follows finished linked work. Claim and approval are never touched.
export function applyLinkedWorkCompletion(contract, ctx = {}) {
  let next = contract;
  const changed = [];
  for (const milestone of contract.milestones) {
    if (milestone.link?.resolved?.workComplete && milestone.completion.status !== COMPLETION.COMPLETE) {
      const result = setMilestoneCompletion(next, milestone.milestoneId, COMPLETION.COMPLETE, { ...ctx, source: milestone.link.source || "SCHEDULE", sourceRef: `gantt:${milestone.link.resolved.taskId}`, actor: ctx.actor || "schedule" });
      if (result.ok) { next = result.contract; changed.push(milestone.milestoneId); }
    }
  }
  return { ok: true, contract: next, completed: changed };
}

// ---- Job Board ---------------------------------------------------------------------------------------------------------

// The existing Job Board (job_board_jobs / job_board_tasks) is the record of site work. A contract names its Job Board job by id,
// and each milestone names the board column (task key) whose "done" card means the milestone's work is finished.
export const jobBoardTaskKeyOf = (contract, milestone) => text(milestone.link?.jobBoardTaskKey) || text(SYSTEM_TRADE_TEMPLATES[contract.trade]?.milestones.find((entry) => entry.key === milestone.key)?.link?.jobBoardTaskKey);

export function linkContractToJobBoard(contract, { jobId = "", jobName = "" } = {}, ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const next = text(jobId) ? { jobId: text(jobId), jobName: text(jobName) } : null;
  if ((contract.jobBoard?.jobId || "") === (next?.jobId || "")) return { ok: true, contract, unchanged: true };
  return { ok: true, contract: withAudit({ ...contract, jobBoard: next }, { actor: ctx.actor, action: "JOB_BOARD_LINKED", field: "jobBoard.jobId", from: contract.jobBoard?.jobId || null, to: next?.jobId || null, note: next?.jobName || "" }) };
}

const jobBoardStatus = (record) => {
  if (!record) return COMPLETION.NOT_STARTED;
  if (/(^|,)done(,|$)/.test(text(record.card_order)) || record.status === "done") return COMPLETION.COMPLETE;
  return record.status && record.status !== "none" ? COMPLETION.IN_PROGRESS : COMPLETION.NOT_STARTED;
};

// records: job_board_tasks rows { job_id, task_key, status, card_order }. A done card makes the milestone eligible for review and
// nothing more: no claim is raised, nothing is approved, nothing is paid. Taking the done card off re-opens a milestone only while
// it is unclaimed and only if the Job Board was what completed it. Pass ctx.complete when records is the job's full task list.
export function applyJobBoardCompletion(contract, records = [], ctx = {}) {
  const denied = guard(contract, ctx); if (denied) return denied;
  const jobId = contract.jobBoard?.jobId;
  if (!jobId) return { ok: true, contract, completed: [], reopened: [], unlinked: true };
  let next = contract;
  const completed = [], reopened = [];
  for (const milestone of contract.milestones) {
    const taskKey = jobBoardTaskKeyOf(contract, milestone);
    if (!taskKey) continue;
    const record = records.find((entry) => String(entry.job_id) === String(jobId) && entry.task_key === taskKey);
    if (!record && !ctx.complete) continue;
    const status = jobBoardStatus(record);
    const current = milestone.completion;
    if (status === current.status) continue;
    const unclaimed = milestone.claim.status === CLAIM.NOT_CLAIMED || milestone.claim.status === CLAIM.REJECTED;
    const ownedByBoard = current.source === "JOB_BOARD" || current.status === COMPLETION.NOT_STARTED;
    if (status !== COMPLETION.COMPLETE && !(ownedByBoard && unclaimed && !locked(milestone))) continue;
    const result = setMilestoneCompletion(next, milestone.milestoneId, status, { builderId: ctx.builderId, jobId: ctx.jobId, at: ctx.at, source: "JOB_BOARD", sourceRef: `jobboard:${jobId}:${taskKey}`, actor: ctx.actor || "Job Board" });
    if (!result.ok) return result;
    next = result.contract;
    if (status === COMPLETION.COMPLETE) completed.push(milestone.milestoneId);
    else if (current.status === COMPLETION.COMPLETE) reopened.push(milestone.milestoneId);
  }
  return { ok: true, contract: next, completed, reopened };
}

// ---- Cash flow -------------------------------------------------------------------------------------------------------

// Each milestone's amount sits in exactly one open bucket (forecast / claimed / approved) plus what has been paid, so the commitment is
// never counted a second time. Remaining commitment is a contract-level figure, not a sum of milestones.
export function tradeCashflowForecast(contracts = []) {
  const rows = [];
  const perContract = [];
  for (const contract of contracts) {
    const resolved = resolveContractMilestones(contract);
    let forecast = 0, claimed = 0, approved = 0, paid = 0;
    for (const milestone of resolved) {
      const paidAmount = Number(milestone.payment.paidAmount) || 0;
      const approvedOpen = milestone.claim.status === CLAIM.APPROVED ? Math.max(0, (Number(milestone.claim.approvedAmount) || 0) - paidAmount) : 0;
      const claimedOpen = milestone.claim.status === CLAIM.CLAIMED ? Number(milestone.claim.claimedAmount) || 0 : 0;
      const forecastOpen = Math.max(0, roundMoney(milestone.allocatedAmount - paidAmount - approvedOpen - claimedOpen));
      forecast += forecastOpen; claimed += claimedOpen; approved += approvedOpen; paid += paidAmount;
      rows.push({ contractId: contract.contractId, milestoneId: milestone.milestoneId, trade: contract.trade, label: milestone.label, date: effectiveScheduledDate(milestone), dateSource: scheduledDateSource(milestone), paidDate: milestone.payment.paidDate || "", forecast: roundMoney(forecastOpen), claimed: roundMoney(claimedOpen), approved: roundMoney(approvedOpen), paid: roundMoney(paidAmount), allocated: milestone.allocatedAmount, status: milestoneEligibility(milestone) });
    }
    perContract.push({ contractId: contract.contractId, trade: contract.trade, commitment: commitmentOf(contract), forecast: roundMoney(forecast), claimed: roundMoney(claimed), approved: roundMoney(approved), paid: roundMoney(paid), remainingCommitment: roundMoney(commitmentOf(contract) - paid) });
  }
  const sum = (field) => roundMoney(perContract.reduce((total, entry) => total + entry[field], 0));
  const byMonth = {};
  const monthOf = (date) => (date ? date.slice(0, 7) : "UNSCHEDULED");
  for (const row of rows) for (const field of ["forecast", "claimed", "approved", "paid"]) {
    if (!row[field]) continue;
    const entry = (byMonth[monthOf(field === "paid" ? row.paidDate || row.date : row.date)] ||= { forecast: 0, claimed: 0, approved: 0, paid: 0 });
    entry[field] = roundMoney(entry[field] + row[field]);
  }
  return { rows, contracts: perContract, byMonth, totals: { commitment: sum("commitment"), forecast: sum("forecast"), claimed: sum("claimed"), approved: sum("approved"), paid: sum("paid"), remainingCommitment: sum("remainingCommitment") } };
}

// ---- Purchase order ---------------------------------------------------------------------------------------------------

// One subcontract PO per contract for the whole commitment. Milestones are attached to it, not raised as orders of their own.
export function subcontractPurchaseOrder(contract, existing = null) {
  const resolved = resolveContractMilestones(contract);
  return {
    ...(existing || {}),
    id: existing?.id || `po:subcontract:${contract.contractId}`, kind: "SUBCONTRACT", tradeContractId: contract.contractId, trade: contract.trade,
    supplier: contract.supplierName || existing?.supplier || "", supplierId: contract.supplierId || existing?.supplierId || "",
    status: existing?.status || "Draft", createdAt: existing?.createdAt || new Date().toISOString(), linkedEstimateJobId: contract.jobId, builderId: contract.builderId,
    commitment: commitmentOf(contract), contractAmount: contract.contractAmount, approvedVariations: approvedVariationTotal(contract),
    items: [{ description: `${contract.trade.replace(/_/g, " ")} subcontract`, qty: 1, unit: "LS", estimatedRate: commitmentOf(contract), estimatedTotal: commitmentOf(contract), quoteRowId: "", procurementItemId: "" }],
    milestones: resolved.map((milestone) => ({ milestoneId: milestone.milestoneId, label: milestone.label, amount: milestone.allocatedAmount, claimStatus: milestone.claim.status, claimedAmount: milestone.claim.claimedAmount, approvedAmount: milestone.claim.approvedAmount, invoiceRef: milestone.invoiceRef, paidAmount: milestone.payment.paidAmount, paidDate: milestone.payment.paidDate })),
    invoices: contract.milestones.filter((milestone) => text(milestone.invoiceRef)).map((milestone) => ({ invoiceRef: milestone.invoiceRef, milestoneId: milestone.milestoneId, amount: milestone.claim.claimedAmount, paidAmount: milestone.payment.paidAmount })),
    claimedTotal: roundMoney(contract.milestones.reduce((sum, milestone) => sum + (milestone.claim.status === CLAIM.CLAIMED || milestone.claim.status === CLAIM.APPROVED ? Number(milestone.claim.claimedAmount) || 0 : 0), 0)),
    approvedTotal: roundMoney(contract.milestones.reduce((sum, milestone) => sum + (milestone.claim.status === CLAIM.APPROVED ? Number(milestone.claim.approvedAmount) || 0 : 0), 0)),
    paidTotal: roundMoney(contract.milestones.reduce((sum, milestone) => sum + (Number(milestone.payment.paidAmount) || 0), 0)),
  };
}

// Idempotent: exactly one PO per contract id, however often this runs.
export function attachSubcontractPurchaseOrders(purchaseOrders = [], contracts = []) {
  let orders = [...purchaseOrders];
  const contractList = contracts.map((contract) => {
    const index = orders.findIndex((order) => order.tradeContractId === contract.contractId);
    const order = subcontractPurchaseOrder(contract, index >= 0 ? orders[index] : null);
    orders = index >= 0 ? orders.map((entry, i) => (i === index ? order : entry)) : [...orders, order];
    return contract.poId === order.id ? contract : { ...contract, poId: order.id };
  });
  return { purchaseOrders: orders, contracts: contractList };
}

// Procurement lines from a contracted section are covered by the subcontract PO and must not also be ordered separately.
export function sectionCoveredBySubcontract(contracts = [], sectionName = "") {
  const base = normalizeTradeKey(sectionName);
  return contracts.some((contract) => normalizeTradeKey(contract.sourceSection) === base);
}
