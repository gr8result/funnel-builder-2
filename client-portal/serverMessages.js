import {
  authorizePortalRequest,
  getAuthenticatedUser,
  getProject,
  recordPortalAudit,
  supabaseAdmin,
} from "./serverShared";

export default async function clientPortalMessagesHandler(req, res) {
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const projectId = String(req.query.projectId || req.body?.projectId || "").trim();
  const workspaceId = String(req.query.workspace_id || req.body?.workspace_id || "").trim();
  const { project, error: projectError } = await getProject(projectId);
  if (projectError) return res.status(500).json({ ok: false, error: projectError.message });
  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId: workspaceId, requestedMode: req.query.mode || "client" });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("client_portal_messages")
      .select("id, parent_message_id, sender_user_id, sender_name, sender_role, body, attachments, read_by, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .eq("status", "sent")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, messages: data || [] });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "Message cannot be empty." });
  const senderRole = access.access === "builder" ? "builder" : "client";
  const senderName = String(req.body?.senderName || auth.user.user_metadata?.full_name || auth.user.email || "").trim();
  const { data, error } = await supabaseAdmin
    .from("client_portal_messages")
    .insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      parent_message_id: req.body?.parentMessageId || null,
      sender_user_id: auth.user.id,
      sender_name: senderName,
      sender_role: senderRole,
      body,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      read_by: { [auth.user.id]: new Date().toISOString() },
    })
    .select("*")
    .single();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  await recordPortalAudit({
    workspaceId: project.workspace_id,
    projectId: project.id,
    userId: auth.user.id,
    userRole: senderRole,
    action: "message_sent",
    relatedTable: "client_portal_messages",
    relatedRecordId: data.id,
  });
  return res.status(200).json({ ok: true, message: data });
}

