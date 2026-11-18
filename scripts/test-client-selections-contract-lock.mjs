// Post-contract lock: after the Final Contract Schedule is issued, selection changes never rewrite the
// contracted quotation; an approved change becomes one formal variation record (never duplicated).
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-client-selections-contract-lock.mjs
import assert from "node:assert/strict";
import { bookWithContractLock, builderVariationPayload, createContractLock, jobContractLock, POST_CONTRACT_STATUS, postContractVariationRecord } from "../lib/builders/contractLock.js";
import { deferUnapprovedQuotationChanges } from "../lib/builders/selectionReconciliation.js";

const quotation = { "UNDERSLAB": { rows: [{ id: "underslab", item: "Underslab", qty: 1, manualRate: "3800" }] }, "APPLIANCES - CLIENT SELECTIONS": { rows: [{ id: "oven", item: "Oven", qty: 1, manualRate: "1200" }] } };
const proposed = { ...quotation, "APPLIANCES - CLIENT SELECTIONS": { rows: [{ id: "oven", item: "Oven", qty: 1, manualRate: "3298" }] } };
// $2,098 more cost; with a 20% margin and GST the quotation total rises by $2,769.36.
const impact = { before: 100000, after: 102769.36, delta: 2769.36, requiresApproval: true, signature: "sig-oven", rowChanges: [{ section: "APPLIANCES - CLIENT SELECTIONS", rowId: "oven", item: "Oven", before: { quantity: 1, rate: 1200, total: 1200 }, after: { quantity: 1, rate: 3298, total: 3298 }, delta: 2098 }] };

// No lock: the existing approval gate is unchanged.
assert.equal(jobContractLock({}), null);
const unlocked = deferUnapprovedQuotationChanges({ quotation, clientSelectionsBook: {} }, { quotation: proposed }, impact);
assert.equal(unlocked.selectionReconciliationPending.status, "FINANCIAL_APPROVAL_REQUIRED");
assert.deepEqual(unlocked.quotation, quotation);

// Lock recorded once; re-issuing never moves the baseline.
const lock = createContractLock({ lockedAt: "2026-11-09T02:00:00.000Z", lockedBy: "builder", scheduleDocumentId: "doc-1", quotationTotal: 100000 });
const book = bookWithContractLock({ rooms: [] }, lock);
assert.deepEqual(jobContractLock(book), lock);
assert.deepEqual(jobContractLock(bookWithContractLock(book, createContractLock({ lockedAt: "2026-12-01T00:00:00.000Z" }))), lock, "first lock stands");
const lockedWorkbook = { quotation, clientSelectionsBook: book };
assert.deepEqual(jobContractLock(lockedWorkbook), lock);

// Locked: the quotation is kept exactly, the change is marked as needing a variation.
const locked = deferUnapprovedQuotationChanges(lockedWorkbook, { quotation: proposed }, impact);
assert.deepEqual(locked.quotation, quotation, "contracted quotation never rewritten");
assert.equal(locked.quotation.UNDERSLAB.rows[0].manualRate, "3800", "underslab stays as entered");
assert.equal(locked.selectionReconciliationPending.status, POST_CONTRACT_STATUS);
// Even with no financial approval required (e.g. an approved signature), a locked job keeps its quotation.
const lockedNoApproval = deferUnapprovedQuotationChanges(lockedWorkbook, { quotation: proposed }, { ...impact, requiresApproval: false });
assert.deepEqual(lockedNoApproval.quotation, quotation);
assert.equal(lockedNoApproval.selectionReconciliationPending.status, POST_CONTRACT_STATUS);
// A locked job with no change has nothing pending.
assert.equal(deferUnapprovedQuotationChanges(lockedWorkbook, { quotation }, { ...impact, rowChanges: [], requiresApproval: false, delta: 0 }).selectionReconciliationPending, null);

// The approved change becomes one variation record, never two.
const record = postContractVariationRecord({ lock, financialImpact: impact, existing: [], createdAt: "2026-11-09T03:00:00.000Z", createdBy: "builder", selectionSummary: ["Oven"] });
assert.equal(record.source, "client_selection_post_contract");
assert.equal(record.status, "draft");
assert.equal(record.builderReviewStatus, "pending");
assert.equal(record.clientStatus, "not_issued");
// The client amount is the quotation total change (margin + GST), not the bare cost difference.
assert.equal(record.totalIncGst, 2769.36);
assert.equal(record.gst, 251.76);
assert.equal(record.subtotalExGst, 2517.6);
assert.equal(record.costSubtotalExGst, 2098);
assert.equal(record.number, "SV-001");
assert.equal(record.lines[0].rowId, "oven");
assert.match(record.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(postContractVariationRecord({ lock, financialImpact: impact, existing: [record] }), record, "re-applying the same change returns the same variation");
assert.equal(postContractVariationRecord({ lock, financialImpact: { ...impact, rowChanges: [] }, existing: [] }), null);
assert.throws(() => postContractVariationRecord({ lock: null, financialImpact: impact }), /not under contract/);
const payload = builderVariationPayload(record, { workspaceId: "ws", projectId: "pr", userId: "u" });
assert.equal(payload.id, record.uuid);
assert.equal(payload.status, "draft");
assert.equal(payload.metadata.source, "client_selection_post_contract");
assert.equal(payload.total, 2769.36);
assert.equal(payload.margin_total, 419.6, "builder margin recorded on the internal record");

console.log("client selections contract lock: quotation preserved after contract; one variation per approved change");
