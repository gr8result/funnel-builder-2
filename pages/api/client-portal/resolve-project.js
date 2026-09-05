import { getAuthenticatedUser, supabaseAdmin, normaliseEmail } from "../../../Client Portal/serverShared";

export default async function resolveClientPortalProjectHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const email = String(auth.user.email || "").trim().toLowerCase();
  const userId = String(auth.user.id || "").trim();

  const { data: clientRows, error } = await supabaseAdmin
    .from("client_portal_clients")
    .select("id, workspace_id, project_id, client_email, user_id, status, accepted_at")
    .or(`user_id.eq.${userId},client_email.eq.${email}`)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message || "Could not resolve your portal access." });

  const activeClient = (clientRows || []).find((row) => {
    if (row.status !== "active") return false;
    if (row.user_id && row.user_id === userId) return true;
    return normaliseEmail(row.client_email) === normaliseEmail(email);
  });

  if (!activeClient) {
    return res.status(403).json({ ok: false, error: "No active client portal project is assigned to this account." });
  }

  const { data: settings } = await supabaseAdmin
    .from("client_portal_settings")
    .select("portal_enabled, access_suspended")
    .eq("workspace_id", activeClient.workspace_id)
    .eq("project_id", activeClient.project_id)
    .maybeSingle();

  if (!settings || settings.portal_enabled !== true || settings.access_suspended === true) {
    return res.status(403).json({ ok: false, error: "This client portal is not active for the assigned project." });
  }

  return res.status(200).json({ ok: true, projectId: activeClient.project_id, workspaceId: activeClient.workspace_id });
}
