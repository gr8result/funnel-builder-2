import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getXRedirectUri() {
  return (
    process.env.X_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/x/callback`
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
    .eq("platform", "x")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "OAuth state expired or invalid"));
  }

  if (!oauthState.code_verifier) {
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "Missing PKCE verifier — please try connecting again"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "x");
    if (!creds?.appId) throw new Error("X credentials not configured.");

    const basicAuth = creds.appSecret
      ? `Basic ${Buffer.from(`${creds.appId}:${creds.appSecret}`).toString("base64")}`
      : null;

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: getXRedirectUri(),
      client_id: creds.appId,
      code_verifier: oauthState.code_verifier,
    });

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(basicAuth ? { Authorization: basicAuth } : {}),
      },
      body: tokenBody,
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "X token exchange failed");
    }

    // Get the authenticated user's info
    const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();
    const xUser = userData.data || {};
    const accountId = xUser.id || String(Date.now());
    const accountName = xUser.name ? `${xUser.name} (@${xUser.username})` : (xUser.username || "X Account");

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const { data: account, error: upsertErr } = await admin
      .from("social_accounts")
      .upsert(
        {
          user_id: oauthState.user_id,
          platform: "x",
          account_id: String(accountId),
          account_name: accountName,
          access_token: tokenData.access_token,
          token_expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_id" }
      )
      .select("id")
      .single();

    if (upsertErr) throw upsertErr;

    // Store refresh token if provided
    if (tokenData.refresh_token && account?.id) {
      try {
        const { encryptToken } = await import("../../../../../lib/social/tokenCrypto.js");
        const encrypted = encryptToken(tokenData.refresh_token);
        const refreshExp = tokenData.refresh_token_expires_in
          ? new Date(Date.now() + Number(tokenData.refresh_token_expires_in) * 1000).toISOString()
          : null;

        await admin.from("social_oauth_tokens").upsert(
          {
            user_id: oauthState.user_id,
            social_account_id: account.id,
            platform: "x",
            encrypted_refresh_token: encrypted.ciphertext,
            refresh_token_iv: encrypted.iv,
            refresh_token_tag: encrypted.tag,
            refresh_expires_at: refreshExp,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,social_account_id" }
        );
      } catch (encErr) {
        console.error("[X OAuth] refresh token store failed:", encErr.message);
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(oauthState.redirect_path, "ok", `X connected as ${accountName}`));
  } catch (err) {
    console.error("[X OAuth callback]", err);
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", err.message || "X connection failed"));
  }
}
