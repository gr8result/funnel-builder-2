import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getLinkedInRedirectUri() {
  return (
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/linkedin/callback`
  );
}

function doneRedirectUrl(path, status, message) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const u = new URL(path || "/modules/social_media", site);
  u.searchParams.set("connect", status);
  if (message) u.searchParams.set("message", message);
  return u.toString();
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_description) {
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", error_description || error));
  }

  if (!code || !state) {
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "Missing OAuth code/state"));
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
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "OAuth state expired or invalid"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "linkedin");
    if (!creds?.appId) throw new Error("LinkedIn credentials not configured.");

    // Exchange code for tokens
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: getLinkedInRedirectUri(),
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

    const { error: upsertErr } = await admin.from("social_accounts").upsert(
      {
        user_id: oauthState.user_id,
        platform: "linkedin",
        account_id: String(accountId),
        account_name: accountName,
        access_token: tokenData.access_token,
        token_expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,account_id" }
    );

    if (upsertErr) throw upsertErr;

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(oauthState.redirect_path, "ok", `LinkedIn connected as ${accountName}`));
  } catch (err) {
    console.error("[LinkedIn OAuth callback]", err);
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", err.message || "LinkedIn connection failed"));
  }
}
