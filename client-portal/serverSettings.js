import {
  authorizePortalRequest,
  DEFAULT_PORTAL_SECTIONS,
  DEFAULT_VISIBILITY,
  ensurePortalSettings,
  getAuthenticatedUser,
  getPortalClients,
  getPortalSettings,
  getProject,
  recordPortalAudit,
  supabaseAdmin,
} from "./serverShared";

function cleanClient(input = {}) {
  return {
    id: String(input.id || "").trim(),
    client_name: String(input.name || input.client_name || "").trim(),
    client_email: String(input.email || input.client_email || "").trim().toLowerCase(),
    status: String(input.status || "invitation_not_sent").trim(),
  };
}

async function saveClients({ workspaceId, projectId, clients, userId }) {
  const existing = await getPortalClients(workspaceId, projectId);
  const existingById = new Map((existing.clients || []).map((client) => [client.id, client]));
  const keptIds = new Set();

  for (const raw of clients) {
    const client = cleanClient(raw);
    if (!client.client_email) continue;
    if (client.id && existingById.has(client.id)) {
      keptIds.add(client.id);
      await supabaseAdmin
        .from("client_portal_clients")
        .update({
          client_name: client.client_name,
          client_email: client.client_email,
          status: client.status,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id)
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId);
    } else {
      const { data } = await supabaseAdmin
        .from("client_portal_clients")
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          client_name: client.client_name,
          client_email: client.client_email,
          status: client.status,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (data?.id) keptIds.add(data.id);
    }
  }

  const removeIds = [...existingById.keys()].filter((id) => !keptIds.has(id));
  if (removeIds.length) {
    await supabaseAdmin
      .from("client_portal_clients")
      .update({ status: "revoked", updated_by: userId, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .in("id", removeIds);
  }
}

async function ensureDefaultClient({ project, userId }) {
  if (!project?.client_email) return;
  const { clients } = await getPortalClients(project.workspace_id, project.id);
  if (clients.length) return;
  await supabaseAdmin.from("client_portal_clients").insert({
    workspace_id: project.workspace_id,
    project_id: project.id,
    client_name: project.client_name || "",
    client_email: String(project.client_email || "").trim().toLowerCase(),
    status: "invitation_not_sent",
    created_by: userId,
    updated_by: userId,
  });
}

export default async function clientPortalSettingsHandler(req, res) {
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const projectId = String(req.query.projectId || req.body?.projectId || "").trim();
  const workspaceId = String(req.query.workspace_id || req.body?.workspace_id || "").trim();
  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

  const { project, error: projectError } = await getProject(projectId);
  if (projectError) return res.status(500).json({ ok: false, error: projectError.message });
  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId: workspaceId, requestedMode: "preview", requireBuilder: true });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });

  if (req.method === "GET") {
    await ensureDefaultClient({ project, userId: auth.user.id });
    const [{ settings }, { clients }] = await Promise.all([
      ensurePortalSettings({ workspaceId: project.workspace_id, projectId: project.id, userId: auth.user.id }),
      getPortalClients(project.workspace_id, project.id),
    ]);
    return res.status(200).json({ ok: true, settings, clients });
  }

  if (req.method !== "PATCH") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body = req.body || {};
  const existing = await ensurePortalSettings({ workspaceId: project.workspace_id, projectId: project.id, userId: auth.user.id });
  if (existing.error) return res.status(500).json({ ok: false, error: existing.error.message });

  const current = existing.settings || {};
  const portalEnabled = body.portalEnabled === true;
  const accessSuspended = body.accessSuspended === true;
  const status = accessSuspended
    ? "access_suspended"
    : portalEnabled
      ? body.status || current.status || "invitation_not_sent"
      : "not_set_up";

  const update = {
    portal_enabled: portalEnabled,
    access_suspended: accessSuspended,
    status,
    enabled_sections: { ...DEFAULT_PORTAL_SECTIONS, ...(body.enabledSections || {}) },
    visibility: { ...DEFAULT_VISIBILITY, ...(body.visibility || {}) },
    branding: body.branding || current.branding || {},
    content: body.content || current.content || {},
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("client_portal_settings")
    .update(update)
    .eq("workspace_id", project.workspace_id)
    .eq("project_id", project.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ ok: false, error: error.message });

  await saveClients({
    workspaceId: project.workspace_id,
    projectId: project.id,
    clients: Array.isArray(body.clients) ? body.clients : [],
    userId: auth.user.id,
  });

  await recordPortalAudit({
    workspaceId: project.workspace_id,
    projectId: project.id,
    userId: auth.user.id,
    userRole: "builder",
    action: portalEnabled ? "portal_settings_saved" : "portal_disabled",
    metadata: { portalEnabled, accessSuspended, status },
  });

  const clients = await getPortalClients(project.workspace_id, project.id);
  return res.status(200).json({ ok: true, settings: data, clients: clients.clients || [] });
}
