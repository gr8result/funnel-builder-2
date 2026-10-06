import {
  getAuthenticatedUser,
  hashToken,
  recordPortalAudit,
  supabaseAdmin,
} from "./serverShared";

export default async function clientPortalActivationHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "Invitation token is required." });
  const { data: invitation, error } = await supabaseAdmin
    .from("client_portal_invitations")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!invitation) return res.status(404).json({ ok: false, error: "Invitation not found." });
  if (["revoked", "accepted"].includes(invitation.status)) return res.status(403).json({ ok: false, error: "This invitation is no longer active." });
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("client_portal_invitations").update({ status: "expired" }).eq("id", invitation.id);
    return res.status(403).json({ ok: false, error: "This invitation has expired." });
  }
  if (String(invitation.recipient_email || "").toLowerCase() !== String(auth.user.email || "").toLowerCase()) {
    return res.status(403).json({ ok: false, error: "Sign in with the invited email address to activate this portal." });
  }

  const now = new Date().toISOString();
  await supabaseAdmin.from("client_portal_invitations").update({ status: "accepted", accepted_at: now, accepted_user_id: auth.user.id }).eq("id", invitation.id);
  await supabaseAdmin.from("client_portal_clients").update({ user_id: auth.user.id, status: "active", accepted_at: now, last_login_at: now }).eq("id", invitation.client_id);
  await supabaseAdmin.from("client_portal_settings").update({ status: "client_activated", portal_enabled: true, last_client_login_at: now }).eq("workspace_id", invitation.workspace_id).eq("project_id", invitation.project_id);
  await recordPortalAudit({
    workspaceId: invitation.workspace_id,
    projectId: invitation.project_id,
    userId: auth.user.id,
    userRole: "client",
    action: "invitation_accepted",
    relatedTable: "client_portal_invitations",
    relatedRecordId: invitation.id,
  });
  return res.status(200).json({ ok: true, projectId: invitation.project_id });
}

