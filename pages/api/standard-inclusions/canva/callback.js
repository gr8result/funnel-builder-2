import { supabaseAdmin } from "../../../../utils/supabase-admin";
import { canvaConfig, canvaDatabaseStatus, canvaSetupError, exchangeCanvaToken } from "../../../../lib/standard-inclusions/canvaConnect";

export default async function handler(req, res) {
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const errorParam = String(req.query?.error || "");
  if (errorParam) return sendCallbackResponse(res, `Canva OAuth cancelled or rejected: ${errorParam}`, { ok: false });
  if (!code || !state) return sendCallbackResponse(res, "Canva OAuth callback is missing code or state.", { ok: false });
  try {
    const setupError = canvaSetupError({ config: canvaConfig(req), database: await canvaDatabaseStatus() });
    if (setupError) return sendCallbackResponse(res, setupError.message, { ok: false });
    const { data: savedState, error } = await supabaseAdmin
      .from("canva_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (error) throw error;
    if (!savedState || Date.parse(savedState.expires_at) < Date.now()) {
      return sendCallbackResponse(res, "Canva OAuth state expired or is invalid.", { ok: false });
    }
    const token = await exchangeCanvaToken({ req, code, verifier: savedState.code_verifier });
    const expiresAt = new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString();
    const connectionSave = await supabaseAdmin.from("canva_connections").upsert({
      organisation_id: savedState.organisation_id,
      user_id: savedState.user_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scopes: String(token.scope || "").split(/\s+/).filter(Boolean),
      expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "organisation_id,user_id" });
    if (connectionSave.error) throw new Error(`Canva token storage failed: ${connectionSave.error.message}`);
    const cleanup = await supabaseAdmin.from("canva_oauth_states").delete().eq("state", state);
    if (cleanup.error) console.warn("[standard-inclusions/canva/callback] state cleanup failed", cleanup.error.message);
    return sendCallbackResponse(res, "Canva connected", { ok: true, returnTo: savedState.return_to });
  } catch (error) {
    console.error("[standard-inclusions/canva/callback]", error);
    return sendCallbackResponse(res, error?.message || "Canva OAuth failed.", { ok: false });
  }
}

function sendCallbackResponse(res, message, { ok = false, returnTo = "" } = {}) {
  const target = canvaCallbackReturnUrl(returnTo, { ok, message });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html><body><script>
    const message = ${JSON.stringify(message)};
    const target = ${JSON.stringify(target)};
    if (window.opener) {
      window.opener.postMessage({ type: "gr8-canva-oauth", ok: ${JSON.stringify(ok)}, message }, window.location.origin);
      window.close();
    } else {
      window.location.replace(target);
    }
  </script><p>${escapeHtml(message)}</p></body></html>`);
}

function canvaCallbackReturnUrl(returnTo = "", { ok = false, message = "" } = {}) {
  const fallback = "http://127.0.0.1:3000/modules/estimate-builder";
  let target = fallback;
  const value = String(returnTo || "").trim();
  if (value.startsWith("http://127.0.0.1:3000/modules/estimate-builder")) target = value;
  if (value.startsWith("/modules/estimate-builder")) target = `http://127.0.0.1:3000${value}`;
  const url = new URL(target);
  if (ok) url.searchParams.set("canva_connected", "1");
  if (!ok && message) url.searchParams.set("canva_error", message.slice(0, 240));
  return url.toString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
