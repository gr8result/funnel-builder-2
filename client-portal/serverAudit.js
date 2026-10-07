import {
  authorizePortalRequest,
  getAuthenticatedUser,
  getProject,
  supabaseAdmin,
} from "./serverShared";

export default async function clientPortalAuditHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const projectId = String(req.query.projectId || "").trim();
  const workspaceId = String(req.query.workspace_id || "").trim();
  const { project, error: projectError } = await getProject(projectId);
  if (projectError) return res.status(500).json({ ok: false, error: projectError.message });
  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId: workspaceId, requestedMode: "preview", requireBuilder: true });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });

  const { data, error } = await supabaseAdmin
    .from("client_portal_audit_events")
    .select("id, user_id, user_role, action, related_table, related_record_id, metadata, created_at")
    .eq("workspace_id", project.workspace_id)
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, events: data || [] });
}

