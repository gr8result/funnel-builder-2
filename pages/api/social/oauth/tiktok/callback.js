import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { encryptToken } from "../../../../../lib/social/tokenCrypto";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getTikTokRedirectUri() {
  return (
    process.env.TIKTOK_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/tiktok/callback`
  );
}

function getRequestOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${proto || (String(host).includes("localhost") ? "http" : "https")}://${host}`;
}

function doneRedirectUrl(req, path, status, message) {
  const site = getRequestOrigin(req);
  const u = new URL(path || "/modules/social_media", site);
  u.searchParams.set("connect", status);
  if (message) u.searchParams.set("message", message);
  return u.toString();
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_description) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", error_description || error));
  }

  if (!code || !state) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", "Missing OAuth code/state"));
  }

  const { data: oauthState, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("platform", "tiktok")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", "OAuth state expired"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "tiktok");
    if (!creds?.appId) throw new Error("TikTok credentials not configured.");

    const body = new URLSearchParams({
      client_key: creds.appId,
      client_secret: creds.appSecret,
      code: String(code),
      grant_type: "authorization_code",
      redirect_uri: getTikTokRedirectUri(),
    });

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData?.error) {
      throw new Error(tokenData?.error_description || tokenData?.error?.message || "TikTok token exchange failed");
    }

    const accessExp = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const { data: account, error: accountErr } = await admin
      .from("social_accounts")
      .upsert(
        {
          user_id: oauthState.user_id,
          platform: "tiktok",
          account_id: tokenData.open_id,
          account_name: "TikTok Account",
          access_token: tokenData.access_token,
          token_expires_at: accessExp,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_id" }
      )
      .select("id")
      .single();

    if (accountErr) {
      throw accountErr;
    }

    if (tokenData.refresh_token) {
      const encrypted = encryptToken(tokenData.refresh_token);
      const refreshExp = tokenData.refresh_expires_in
        ? new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000).toISOString()
        : null;

      const { error: tokenErr } = await admin.from("social_oauth_tokens").upsert(
        {
          user_id: oauthState.user_id,
          social_account_id: account.id,
          platform: "tiktok",
          encrypted_refresh_token: encrypted.cipherText,
          refresh_token_iv: encrypted.iv,
          refresh_token_tag: encrypted.tag,
          refresh_expires_at: refreshExp,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,social_account_id" }
      );

      if (tokenErr) {
        throw tokenErr;
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "ok", "TikTok connected"));
  } catch (err) {
    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "error", err.message));
  }
}
