import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getGoogleRedirectUri() {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/youtube/callback`
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
    .eq("platform", "youtube")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "OAuth state expired or invalid"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "youtube");
    if (!creds?.appId) throw new Error("Google/YouTube credentials not configured.");

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: creds.appId,
        client_secret: creds.appSecret,
        redirect_uri: getGoogleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed");
    }

    // Get Google user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    // Get YouTube channel info
    let channelId = googleUser.id || String(Date.now());
    let channelName = googleUser.name || googleUser.email || "YouTube Channel";

    try {
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const channelData = await channelRes.json();
      const channel = channelData.items?.[0];
      if (channel) {
        channelId = channel.id;
        channelName = channel.snippet?.title || channelName;
      }
    } catch {
      // fallback to Google user identity
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const { data: account, error: upsertErr } = await admin
      .from("social_accounts")
      .upsert(
        {
          user_id: oauthState.user_id,
          platform: "youtube",
          account_id: String(channelId),
          account_name: channelName,
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

    // Store refresh token
    if (tokenData.refresh_token && account?.id) {
      try {
        const { encryptToken } = await import("../../../../../lib/social/tokenCrypto.js");
        const encrypted = encryptToken(tokenData.refresh_token);

        await admin.from("social_oauth_tokens").upsert(
          {
            user_id: oauthState.user_id,
            social_account_id: account.id,
            platform: "youtube",
            encrypted_refresh_token: encrypted.ciphertext,
            refresh_token_iv: encrypted.iv,
            refresh_token_tag: encrypted.tag,
            refresh_expires_at: null, // Google refresh tokens don't expire unless revoked
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,social_account_id" }
        );
      } catch (encErr) {
        console.error("[YouTube OAuth] refresh token store failed:", encErr.message);
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(oauthState.redirect_path, "ok", `YouTube connected: ${channelName}`));
  } catch (err) {
    console.error("[YouTube OAuth callback]", err);
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", err.message || "YouTube connection failed"));
  }
}
