import { CLIENT_APPROVED_SOURCE } from "./contractLock.js";

const conflict = () => new Error("This variation changed or was signed off. Reload before continuing.");

// Compare-and-set the version read from PostgreSQL. A status check alone cannot detect
// another client's edit to an amount while the variation is still submitted.
export async function persistSelectionVariationDecision(db, payload, decision = "accepted") {
  if (!["accepted", "pending", "declined"].includes(decision)) throw new Error("Unsupported selection decision.");
  if (!payload?.id || !payload.workspace_id || !payload.project_id || payload.metadata?.source !== CLIENT_APPROVED_SOURCE) {
    throw new Error("A job-scoped selection variation is required.");
  }
  const scoped = () => db.from("builder_variations");
  const scope = (query) => query.eq("workspace_id", payload.workspace_id).eq("project_id", payload.project_id).eq("id", payload.id);
  const { data: existing, error } = await scope(scoped().select("id, status, updated_at, metadata")).maybeSingle();
  if (error) throw error;
  if (!existing) {
    if (decision !== "accepted") return null;
    // Insert, never upsert: a competing insert must not overwrite an approval.
    const inserted = await scoped().insert(payload).select("*").maybeSingle();
    if (inserted.error?.code === "23505") throw conflict();
    if (inserted.error) throw inserted.error;
    if (!inserted.data) throw conflict();
    return inserted.data;
  }
  // "rejected": the builder rejected it; the client may resubmit (approve again) or withdraw.
  if (existing.metadata?.source !== CLIENT_APPROVED_SOURCE || !["submitted", "void", "rejected"].includes(existing.status) || !existing.updated_at) throw conflict();
  const { id, workspace_id, project_id, created_by, ...changes } = payload;
  // A resubmission after a builder rejection keeps every earlier rejection on the record.
  const rejectionHistory = [...(existing.metadata?.rejectionHistory || []), ...(existing.metadata?.builderRejection ? [{ ...existing.metadata.builderRejection, amountIncGst: existing.metadata?.approvalFigures?.currentIncGst ?? null }] : [])];
  const history = rejectionHistory.length ? { rejectionHistory } : {};
  const patch = decision === "accepted" ? { ...changes, metadata: { ...(changes.metadata || {}), ...history, ...(existing.status === "rejected" ? { resubmittedAt: changes.metadata?.clientApprovedAt || null } : {}) } } : {
    status: "void", client_status: decision === "declined" ? "declined" : "not_issued",
    approved_at: null, approved_by_name: null, approved_by_email: null,
    requires_client_approval: true, updated_by: payload.updated_by,
    metadata: { ...existing.metadata, ...history, builderRejection: null, uiStatus: "cancelled", builderReviewStatus: "pending", clientApprovedAt: null, approvalFigures: null, paymentStatus: "not_requested" },
  };
  const updated = await scope(scoped().update(patch)).eq("status", existing.status).eq("updated_at", existing.updated_at).select("*").maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) throw conflict();
  return updated.data;
}
