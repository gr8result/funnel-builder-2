import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { canvaConfig, canvaDatabaseStatus, canvaSetupError, exchangeCanvaToken } from "../../../../lib/standard-inclusions/canvaConnect";

export default async function handler(req, res) {
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const errorParam = String(req.query?.error || "");
  if (errorParam) return sendClose(res, `Canva OAuth rejected: ${errorParam}`);
  if (!code || !state) return sendClose(res, "Canva OAuth callback is missing code or state.");
  try {
    const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
    if (setupError) return sendClose(res, setupError.message);
    const { data: savedState, error } = await supabaseAdmin
      .from("canva_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (error) throw error;
    if (!savedState || Date.parse(savedState.expires_at) < Date.now()) {
      return sendClose(res, "Canva OAuth state expired or is invalid.");
    }
    const token = await exchangeCanvaToken({ req, code, verifier: savedState.code_verifier });
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString();
    await supabaseAdmin.from("canva_connections").upsert({
      organisation_id: savedState.organisation_id,
      user_id: savedState.user_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scopes: String(token.scope || "").split(/\s+/).filter(Boolean),
      expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "organisation_id,user_id" });
    await supabaseAdmin.from("canva_oauth_states").delete().eq("state", state);
    return sendClose(res, "Canva connected. Return to Gr8 Result.");
  } catch (error) {
    console.error("[standard-inclusions/canva/callback]", error);
    return sendClose(res, error?.message || "Canva OAuth failed.");
  }
}

function sendClose(res, message) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html><body><script>
    if (window.opener) window.opener.postMessage({ type: "gr8-canva-oauth", message: ${JSON.stringify(message)} }, window.location.origin);
    window.close();
  </script><p>${escapeHtml(message)}</p></body></html>`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
