import {
  authorizePortalRequest,
  getAuthenticatedUser,
  getProject,
  recordPortalAudit,
  supabaseAdmin,
} from "./serverShared";

const ALLOWED_ACTIONS = new Set(["approved", "changes_requested", "rejected"]);

export default async function clientPortalApprovalsHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const { projectId, workspace_id: workspaceId, approvalId, action, comment, clientName, confirmed } = req.body || {};
  if (!ALLOWED_ACTIONS.has(action)) return res.status(400).json({ ok: false, error: "Invalid approval response." });
  if (!confirmed) return res.status(400).json({ ok: false, error: "Please confirm before submitting this response." });

  const { project, error: projectError } = await getProject(String(projectId || ""));
  if (projectError) return res.status(500).json({ ok: false, error: projectError.message });
  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId: String(workspaceId || ""), requestedMode: "client" });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });

  const { data: approval, error: approvalError } = await supabaseAdmin
    .from("client_portal_approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("workspace_id", project.workspace_id)
    .eq("project_id", project.id)
    .maybeSingle();
  if (approvalError) return res.status(500).json({ ok: false, error: approvalError.message });
  if (!approval) return res.status(404).json({ ok: false, error: "Approval item not found." });
  if (!["awaiting_client", "viewed"].includes(approval.status)) {
    return res.status(409).json({ ok: false, error: "This approval has already been responded to." });
  }
  if (action === "rejected" && approval.allow_reject === false) {
    return res.status(400).json({ ok: false, error: "This item cannot be rejected." });
  }

  const now = new Date().toISOString();
  const responseSnapshot = {
    action,
    comment: String(comment || "").trim(),
    clientName: String(clientName || auth.user.email || "").trim(),
    confirmedAt: now,
    itemTitle: approval.item_title,
    approvalType: approval.approval_type,
  };
  const { data, error } = await supabaseAdmin
    .from("client_portal_approvals")
    .update({
      status: action,
      response_comment: responseSnapshot.comment,
      response_name: responseSnapshot.clientName,
      response_user_id: auth.user.id,
      responded_at: now,
      response_snapshot: responseSnapshot,
      updated_at: now,
    })
    .eq("id", approval.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  await recordPortalAudit({
    workspaceId: project.workspace_id,
    projectId: project.id,
    userId: auth.user.id,
    userRole: access.access,
    action: action === "approved" ? "approval_submitted" : action,
    relatedTable: "client_portal_approvals",
    relatedRecordId: approval.id,
    metadata: responseSnapshot,
  });
  return res.status(200).json({ ok: true, approval: data });
}

