// Post-contract lock for Client Selections.
//
// Issuing the Final Contract Schedule records a contract lock on the job (book.metadata.contractLock,
// saved with the Selections Book). From then on the contracted quotation is the baseline:
//   - selection changes are never written into existing quotation lines;
//   - an approved selection change becomes a formal VARIATION record (stored on the job, and as a
//     builder_variations draft for a cloud-linked job), built from the quotation lines it would have
//     changed (quotationFinancialImpact.js rowChanges).
// Only the Variations workflow (builder approval -> client acceptance) changes the contract price.

const text = (value) => String(value ?? "").trim();
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const GST = 0.1;

export const POST_CONTRACT_STATUS = "POST_CONTRACT_VARIATION_REQUIRED";

export function jobContractLock(workbookOrBook = {}) {
  const lock = workbookOrBook?.contractLock || workbookOrBook?.clientSelectionsBook?.metadata?.contractLock || workbookOrBook?.metadata?.contractLock || null;
  return lock && lock.lockedAt ? lock : null;
}

export function createContractLock({ lockedAt = new Date().toISOString(), lockedBy = "", scheduleDocumentId = "", quotationTotal = null, quotationSignature = "" } = {}) {
  return { lockedAt, lockedBy: text(lockedBy), scheduleDocumentId: text(scheduleDocumentId), quotationTotal: quotationTotal == null ? null : round(quotationTotal), quotationSignature: text(quotationSignature) };
}

export function bookWithContractLock(book = {}, lock) {
  if (jobContractLock(book)) return book; // the first lock stands; re-issuing never moves the baseline
  return { ...book, metadata: { ...(book.metadata || {}), contractLock: lock }, updatedAt: new Date().toISOString() };
}

// Stable id for one set of proposed line changes, so re-applying the same change never creates a
// second variation.
function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function postContractVariationId(lock, financialImpact = {}) {
  return `selvar-${hash(`${lock?.lockedAt}|${financialImpact.signature || JSON.stringify(financialImpact.rowChanges || [])}`)}`;
}
// A uuid-shaped id derived from the same key, for builder_variations (uuid primary key).
export function postContractVariationUuid(id) {
  const parts = [hash(`${id}:a`), hash(`${id}:b`), hash(`${id}:c`), hash(`${id}:d`)].join("");
  return `${parts.slice(0, 8)}-${parts.slice(8, 12)}-4${parts.slice(13, 16)}-8${parts.slice(17, 20)}-${parts.slice(20, 32)}`;
}

// The variation for an approved post-contract selection change. Amounts are ex GST quotation line
// totals (sell), as calculated by the quotation engine; nothing is re-priced here.
export function postContractVariationRecord({ lock, financialImpact = {}, existing = [], createdAt = new Date().toISOString(), createdBy = "", selectionSummary = [] } = {}) {
  if (!lock) throw new Error("The job is not under contract.");
  const rowChanges = Array.isArray(financialImpact.rowChanges) ? financialImpact.rowChanges : [];
  if (!rowChanges.length) return null;
  const id = postContractVariationId(lock, financialImpact);
  const already = existing.find((record) => record.id === id);
  if (already) return already;
  const subtotal = round(rowChanges.reduce((total, change) => total + (Number(change.delta) || 0), 0));
  const number = `SV-${String(existing.filter((record) => record.source === "client_selection_post_contract").length + 1).padStart(3, "0")}`;
  return {
    id, uuid: postContractVariationUuid(id), number, source: "client_selection_post_contract",
    title: selectionSummary.length ? `Client selection change: ${selectionSummary.slice(0, 3).join(", ")}${selectionSummary.length > 3 ? ` and ${selectionSummary.length - 3} more` : ""}` : `Client selection change (${rowChanges.length} line${rowChanges.length === 1 ? "" : "s"})`,
    reason: "Client selection changed after contract", status: "draft", builderReviewStatus: "pending", clientStatus: "not_issued",
    // The client amount is the change in the quotation's final total (margin, GST and commission
    // included, as the quotation calculator works them out); the line deltas are the builder's cost.
    ...variationAmounts(financialImpact, subtotal),
    contractQuotationTotal: lock.quotationTotal, proposedQuotationTotal: financialImpact.after ?? null,
    lines: rowChanges.map((change) => ({ section: change.section, rowId: change.rowId, item: change.item, before: change.before, after: change.after, deltaExGst: round(change.delta) })),
    signature: financialImpact.signature || "", createdAt, createdBy: text(createdBy),
  };
}

function variationAmounts(financialImpact = {}, costSubtotal = 0) {
  const delta = Number(financialImpact.delta);
  if (!Number.isFinite(delta)) return { subtotalExGst: costSubtotal, gst: round(costSubtotal * GST), totalIncGst: round(costSubtotal * (1 + GST)), costSubtotalExGst: costSubtotal, marginApplied: false };
  const gstDelta = Number(financialImpact.gstDelta);
  const gst = Number.isFinite(gstDelta) ? round(gstDelta) : round(delta * GST / (1 + GST));
  return { subtotalExGst: round(delta - gst), gst, totalIncGst: round(delta), costSubtotalExGst: costSubtotal, marginApplied: true };
}

// The builder_variations draft for a cloud-linked job (same columns the Variations module writes).
export function builderVariationPayload(record, { workspaceId, projectId, userId = null } = {}) {
  return {
    id: record.uuid, workspace_id: workspaceId, project_id: projectId, variation_number: record.number, title: record.title, reason: record.reason,
    status: "draft", subtotal: record.subtotalExGst, gst_total: record.gst, total: record.totalIncGst, margin_total: Number.isFinite(record.costSubtotalExGst) ? round(record.subtotalExGst - record.costSubtotalExGst) : 0, submitted_at: null, approved_at: null,
    client_visible: false, requires_client_approval: true, client_status: "not_issued",
    metadata: { uiStatus: "draft", source: record.source, selectionVariationId: record.id, lines: record.lines, builderReviewStatus: "pending", quoteTreatment: "separate_variation", contractQuotationTotal: record.contractQuotationTotal },
    created_by: userId, updated_by: userId,
  };
}

// ---- Client-approved selection variations -> Variations module ----------------------------------
// After contract, a variation the client approves in Client Selections goes straight to the
// Variations module, awaiting the builder's sign-off. One record per selection change (the row id
// names job + room + selection + product), so re-approving updates it rather than adding another.
// Only client-safe amounts (inc / ex GST) and the description are client-visible; the builder's
// cost difference and margin stay on the internal record.
export const CLIENT_APPROVED_SOURCE = "client_selection_approval";

export function clientApprovedVariationPayload(row = {}, { workspaceId, projectId, userId = null, approvedAt, clientName = "", costDifferenceExGst = null, figures = null } = {}) {
  if (!row.id || !Number.isFinite(row.amountIncGst)) throw new Error("A client-approved variation needs an amount.");
  if (!workspaceId || !projectId) throw new Error("A cloud-linked job is required to send the variation to the Variations module.");
  const description = `${text(row.requirementLabel) || "Selection"} — ${text(row.room) || "Whole home"}: ${text(row.standard) || "standard inclusion"} replaced by ${text(row.selected) || "the selected product"}`;
  const subtotal = Number.isFinite(row.amountExGst) ? round(row.amountExGst) : round(row.amountIncGst / (1 + GST));
  return {
    id: postContractVariationUuid(`client-approval:${projectId}:${row.id}`), workspace_id: workspaceId, project_id: projectId,
    variation_number: `CS-${hash(`${projectId}:${row.id}`).slice(0, 6).toUpperCase()}`,
    title: `${text(row.requirementLabel) || "Selection"} — ${text(row.room) || "Whole home"}`, reason: "Client selection change approved by the client",
    status: "submitted", subtotal, gst_total: round(row.amountIncGst - subtotal), total: round(row.amountIncGst),
    margin_total: Number.isFinite(costDifferenceExGst) ? round(subtotal - costDifferenceExGst) : 0,
    submitted_at: approvedAt || null, approved_at: approvedAt || null, approved_by_name: text(clientName) || null,
    client_visible: true, requires_client_approval: false, client_status: "approved",
    metadata: { source: CLIENT_APPROVED_SOURCE, uiStatus: "client_approved", builderReviewStatus: "pending", paymentStatus: "not_requested", quoteTreatment: "separate_variation",
      selectionTaskId: row.id, room: text(row.room), requirementLabel: text(row.requirementLabel), standard: text(row.standard), selected: text(row.selected),
      quantity: row.quantity ?? null, unit: text(row.unit), clientDescription: description, clientApprovedAt: approvedAt || null,
      approvalFigures: figures ? { previousTotalIncGst: figures.previousTotalIncGst, currentIncGst: figures.currentIncGst, newTotalIncGst: figures.newTotalIncGst } : null,
      costDifferenceExGst: Number.isFinite(costDifferenceExGst) ? round(costDifferenceExGst) : null },
    created_by: userId, updated_by: userId,
  };
}

// Builder sign-off, then invoicing, for a client-approved selection variation (Variations module).
// The builder may instead reject it, with a reason the client sees in Client Selections; the client
// then revises the selection (a new product is a new variation) or approves again (resubmission
// reuses this record, keeping the rejection history).
export function planClientApprovedVariationTransition(variation = {}, action, { userId = null, now = new Date().toISOString(), invoiceNumber = "", reason = "" } = {}) {
  const metadata = variation.metadata || {};
  if (metadata.source !== CLIENT_APPROVED_SOURCE) throw new Error("This record is not a client-approved selection variation.");
  if (action === "sign_off") {
    if (variation.status !== "submitted" || variation.client_status !== "approved") throw new Error("Only a client-approved variation awaiting sign-off can be signed off.");
    return { status: "approved", metadata: { ...metadata, uiStatus: "approved", builderReviewStatus: "approved", builderSignedOffBy: userId, builderSignedOffAt: now, paymentStatus: "ready_to_invoice" } };
  }
  if (action === "reject") {
    if (variation.status !== "submitted" || variation.client_status !== "approved") throw new Error("Only a client-approved variation awaiting sign-off can be rejected.");
    if (!text(reason)) throw new Error("A reason is required: the client sees it in Client Selections.");
    return { status: "rejected", metadata: { ...metadata, uiStatus: "builder_rejected", builderReviewStatus: "rejected", builderRejection: { reason: text(reason).slice(0, 1000), by: userId, at: now } } };
  }
  if (action === "invoice") {
    if (variation.status !== "approved" || metadata.builderReviewStatus !== "approved") throw new Error("The builder must sign off the variation before it is invoiced.");
    if (!text(invoiceNumber)) throw new Error("An invoice number is required.");
    return { status: "invoiced", metadata: { ...metadata, uiStatus: "invoiced", paymentStatus: "outstanding", invoice: { number: text(invoiceNumber), preparedAt: now, preparedBy: userId } } };
  }
  throw new Error("Unsupported variation action.");
}
