import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { canvaAuthorizationUrl, canvaConfig, canvaDatabaseStatus, canvaMissingConfigMessage, canvaSetupError, createCanvaOauthState } from "../../../../lib/standard-inclusions/canvaConnect";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const cfg = canvaConfig(req);
  const database = await canvaDatabaseStatus();
  const setupError = canvaSetupError({ config: cfg, database });
  if (setupError) {
    return res.status(501).json({
      ok: false,
      code: setupError.code,
      error: setupError.message || canvaMissingConfigMessage(),
      missing: setupError.missing || [],
      diagnostics: { redirectUri: cfg.redirectUri, database },
    });
  }
  const oauth = createCanvaOauthState({
    workspaceId: req.workspaceId,
    userId: req.user.id,
    returnTo: req.body?.returnTo || "",
  });
  const { error } = await supabaseAdmin.from("canva_oauth_states").insert({
    state: oauth.state,
    organisation_id: req.workspaceId,
    user_id: req.user.id,
    code_verifier: oauth.verifier,
    return_to: oauth.record.returnTo,
    expires_at: new Date(oauth.record.expiresAt).toISOString(),
  });
  if (error) throw error;
  return res.status(200).json({ ok: true, authorizationUrl: canvaAuthorizationUrl({ req, state: oauth.state, challenge: oauth.challenge }) });
}

export default withWorkspace(handler);
