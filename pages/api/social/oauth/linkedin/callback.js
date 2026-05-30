import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

async function saveSocialAccount(admin, payload) {
  const match = {
    user_id: payload.user_id,
    platform: payload.platform,
    account_id: payload.account_id,
  };

  const { data: existing, error: lookupError } = await admin
    .from("social_accounts")
    .select("id")
    .match(match)
    .limit(1);

  if (lookupError) {
    throw new Error(`Failed checking existing ${payload.platform} connection: ${lookupError.message}`);
  }

  if (existing?.length) {
    const { error: updateError } = await admin
      .from("social_accounts")
      .update(payload)
      .match(match);

    if (updateError) {
      throw new Error(`Failed updating ${payload.platform} connection: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await admin
    .from("social_accounts")
    .insert(payload);

  if (insertError) {
    throw new Error(`Failed creating ${payload.platform} connection: ${insertError.message}`);
  }
}

function getRequestOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${proto || (String(host).includes("localhost") ? "http" : "https")}://${host}`;
}

function getCanonicalAppOrigin(req) {
  const explicitBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicitBase) {
    try {
      return new URL(explicitBase).origin;
    } catch {
      return explicitBase.replace(/\/$/, "");
    }
  }
  return getRequestOrigin(req);
}

function getLinkedInRedirectUri(req) {
  return process.env.LINKEDIN_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/linkedin/callback`;
}

function doneRedirectUrl(req, path, status, message) {
  const site = getRequestOrigin(req);
  // Force same-origin: strip any absolute URL to its pathname only
  let safePath = path || "/modules/social_media/setup";
  if (/^https?:\/\//i.test(safePath)) {
    try { safePath = new URL(safePath).pathname; } catch { safePath = "/modules/social_media/setup"; }
  }
  if (!safePath.startsWith('/')) safePath = `/${safePath}`;
  const u = new URL(safePath, site);
  u.searchParams.set("connect", status);
  if (message) u.searchParams.set("message", message);
  return u.toString();
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_description) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media/setup", "error", error_description || error));
  }

  if (!code || !state) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media/setup", "error", "Missing OAuth code/state"));
  }

  const { data: oauthState, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("platform", "linkedin")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media/setup", "error", "OAuth state expired or invalid"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "linkedin");
    if (!creds?.appId) throw new Error("LinkedIn credentials not configured.");
    if (!creds?.appSecret) throw new Error("LinkedIn Client Secret not configured. Open Platform Setup to add your credentials.");

    // Exchange code for tokens
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: getLinkedInRedirectUri(req),
        client_id: creds.appId,
        client_secret: creds.appSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "LinkedIn token exchange failed");
    }

    // Get user profile (OpenID Connect userinfo)
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileRes.json();
    const accountId = profile.sub || String(Date.now());
    const accountName = [profile.given_name, profile.family_name].filter(Boolean).join(" ") || profile.email || "LinkedIn User";

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    await saveSocialAccount(admin, {
      user_id: oauthState.user_id,
      platform: "linkedin",
      account_id: String(accountId),
      account_name: accountName,
      access_token: tokenData.access_token,
      token_expires_at: expiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "ok", `LinkedIn connected as ${accountName}`));
  } catch (err) {
    console.error("[LinkedIn OAuth callback]", err);
    return res.redirect(doneRedirectUrl(req, oauthState?.redirect_path || "/modules/social_media/setup", "error", err.message || "LinkedIn connection failed"));
  }
}
