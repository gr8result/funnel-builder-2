import sendEmail from "../lib/sendEmail";
import {
  authorizePortalRequest,
  createInvitationToken,
  ensurePortalSettings,
  getAuthenticatedUser,
  getPortalClients,
  getProject,
  hashToken,
  recordPortalAudit,
  supabaseAdmin,
} from "./serverShared";

export default async function clientPortalInvitationsHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const { projectId, workspace_id: workspaceId, clientId } = req.body || {};
  const { project, error: projectError } = await getProject(String(projectId || ""));
  if (projectError) return res.status(500).json({ ok: false, error: projectError.message });
  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId: String(workspaceId || ""), requestedMode: "preview", requireBuilder: true });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });

  const { clients } = await getPortalClients(project.workspace_id, project.id);
  let client = clients.find((row) => row.id === clientId) || clients[0];
  if (!client && project.client_email) {
    const { data } = await supabaseAdmin
      .from("client_portal_clients")
      .insert({
        workspace_id: project.workspace_id,
        project_id: project.id,
        client_name: project.client_name || "",
        client_email: String(project.client_email || "").trim().toLowerCase(),
        status: "invitation_not_sent",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("*")
      .single();
    client = data;
  }
  if (!client?.client_email) return res.status(400).json({ ok: false, error: "Add a client email before sending an invitation." });
  await ensurePortalSettings({ workspaceId: project.workspace_id, projectId: project.id, userId: auth.user.id });

  const token = createInvitationToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  const activationUrl = `${siteUrl}/client-portal/activate?token=${encodeURIComponent(token)}`;
  const subject = `Your client portal invitation for ${project.project_name || "your project"}`;
  const text = `You have been invited to access your client portal for ${project.project_name || "your project"}.\n\nActivate your access: ${activationUrl}\n\nThis invitation expires on ${expiresAt}.`;
  const html = `<p>You have been invited to access your client portal for <strong>${escapeHtml(project.project_name || "your project")}</strong>.</p><p><a href="${activationUrl}">Activate your access</a></p><p>This invitation expires on ${escapeHtml(expiresAt)}.</p>`;

  const emailResult = await sendEmail({
    to: client.client_email,
    from: process.env.SENDGRID_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL || "no-reply@gr8result.com",
    subject,
    text,
    html,
    workspaceId: project.workspace_id,
    userId: auth.user.id,
  });
  const sent = emailResult?.ok === true;
  const now = new Date().toISOString();
  const preview = { to: client.client_email, subject, text, activationUrl, skipped: !sent, providerMessage: emailResult?.error || emailResult?.message || "" };

  const { data: invitation, error } = await supabaseAdmin
    .from("client_portal_invitations")
    .insert({
      workspace_id: project.workspace_id,
      project_id: project.id,
      client_id: client.id,
      recipient_name: client.client_name || project.client_name || "",
      recipient_email: client.client_email,
      token_hash: hashToken(token),
      status: sent ? "sent" : "created",
      sent_at: sent ? now : null,
      expires_at: expiresAt,
      sent_by: auth.user.id,
      email_preview: preview,
    })
    .select("*")
    .single();
  if (error) return res.status(500).json({ ok: false, error: error.message });

  await supabaseAdmin
    .from("client_portal_clients")
    .update({ status: "invited", last_invitation_sent_at: now, updated_by: auth.user.id, updated_at: now })
    .eq("id", client.id);
  await supabaseAdmin
    .from("client_portal_settings")
    .update({ status: "invitation_sent", last_invitation_sent_at: now, updated_by: auth.user.id, updated_at: now })
    .eq("workspace_id", project.workspace_id)
    .eq("project_id", project.id);
  await recordPortalAudit({
    workspaceId: project.workspace_id,
    projectId: project.id,
    userId: auth.user.id,
    userRole: "builder",
    action: sent ? "invitation_sent" : "invitation_created",
    relatedTable: "client_portal_invitations",
    relatedRecordId: invitation.id,
    metadata: { email: client.client_email, emailSent: sent },
  });

  return res.status(200).json({ ok: true, invitation, emailSent: sent, emailPreview: sent ? null : preview });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
