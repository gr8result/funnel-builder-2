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
    const { data: updated, error: updateError } = await admin
      .from("social_accounts")
      .update(payload)
      .match(match)
      .select("id")
      .single();

    if (updateError) {
      throw new Error(`Failed updating ${payload.platform} connection: ${updateError.message}`);
    }

    return updated;
  }

  const { data: inserted, error: insertError } = await admin
    .from("social_accounts")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed creating ${payload.platform} connection: ${insertError.message}`);
  }

  return inserted;
}

async function saveRefreshToken(admin, payload) {
  const match = {
    user_id: payload.user_id,
    platform: payload.platform,
    social_account_id: payload.social_account_id,
  };

  const { data: existing, error: lookupError } = await admin
    .from("social_oauth_tokens")
    .select("id")
    .match(match)
    .limit(1);

  if (lookupError) {
    throw new Error(`Failed checking existing ${payload.platform} refresh token: ${lookupError.message}`);
  }

  if (existing?.length) {
    const { error: updateError } = await admin
      .from("social_oauth_tokens")
      .update(payload)
      .match(match);

    if (updateError) {
      throw new Error(`Failed updating ${payload.platform} refresh token: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await admin
    .from("social_oauth_tokens")
    .insert(payload);

  if (insertError) {
    throw new Error(`Failed creating ${payload.platform} refresh token: ${insertError.message}`);
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

function getXRedirectUri(req) {
  return process.env.X_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/x/callback`;
}

function doneRedirectUrl(req, path, status, message) {
  const site = getRequestOrigin(req);
  const u = new URL(path || "/modules/social_media/setup", site);
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
    .eq("platform", "x")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media/setup", "error", "OAuth state expired or invalid"));
  }

  if (!oauthState.code_verifier) {
    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path || "/modules/social_media/setup", "error", "Missing PKCE verifier - please try connecting again"));
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
      redirect_uri: getXRedirectUri(req),
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

    const account = await saveSocialAccount(admin, {
      user_id: oauthState.user_id,
      platform: "x",
      account_id: String(accountId),
      account_name: accountName,
      access_token: tokenData.access_token,
      token_expires_at: expiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    // Store refresh token if provided
    if (tokenData.refresh_token && account?.id) {
      try {
        const { encryptToken } = await import("../../../../../lib/social/tokenCrypto.js");
        const encrypted = encryptToken(tokenData.refresh_token);
        const refreshExp = tokenData.refresh_token_expires_in
          ? new Date(Date.now() + Number(tokenData.refresh_token_expires_in) * 1000).toISOString()
          : null;

        await saveRefreshToken(admin, {
          user_id: oauthState.user_id,
          social_account_id: account.id,
          platform: "x",
          encrypted_refresh_token: encrypted.cipherText,
          refresh_token_iv: encrypted.iv,
          refresh_token_tag: encrypted.tag,
          refresh_expires_at: refreshExp,
          updated_at: new Date().toISOString(),
        });
      } catch (encErr) {
        console.error("[X OAuth] refresh token store failed:", encErr.message);
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "ok", `X connected as ${accountName}`));
  } catch (err) {
    console.error("[X OAuth callback]", err);
    return res.redirect(doneRedirectUrl(req, oauthState?.redirect_path || "/modules/social_media/setup", "error", err.message || "X connection failed"));
  }
}
