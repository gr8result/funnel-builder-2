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

function getMetaRedirectUri(req) {
  return `${getRequestOrigin(req)}/api/social/oauth/meta/callback`;
}

function doneRedirectUrl(req, path, status, message) {
  const site = getRequestOrigin(req);
  const u = new URL(path || "/modules/social_media", site);
  u.searchParams.set("connect", status);
  if (message) u.searchParams.set("message", message);
  return u.toString();
}

export default async function handler(req, res) {
  const { code, state, error, error_reason, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_reason || error_description) {
    const msg = error_description || error_reason || error || 'Facebook returned an error';
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", msg));
  }

  if (!code || !state) {
    // Log all query params to help debug
    const params = JSON.stringify(req.query);
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", `Missing OAuth code/state. Received: ${params}`));
  }

  const { data: oauthState, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("platform", "meta")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl(req, "/modules/social_media", "error", "OAuth state expired"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "meta");
    if (!creds?.appId) throw new Error("Meta credentials not configured.");

    const params = new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      redirect_uri: getMetaRedirectUri(req),
      code: String(code),
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error?.message || "Meta token exchange failed");
    }

    const longTokenParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: creds.appId,
      client_secret: creds.appSecret,
      fb_exchange_token: tokenData.access_token,
    });

    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${longTokenParams.toString()}`
    );
    const longData = await longRes.json();
    const userAccessToken = longRes.ok ? longData.access_token : tokenData.access_token;
    const expiresIn = longRes.ok ? longData.expires_in : tokenData.expires_in;

    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,name}&access_token=${encodeURIComponent(userAccessToken)}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesRes.ok) {
      throw new Error(pagesData.error?.message || "Unable to fetch Meta pages");
    }

    const accounts = pagesData.data || [];
    if (accounts.length === 0) {
      throw new Error(
        "Meta login succeeded, but no Facebook Pages were returned. Reconnect and use Edit settings to select your Page and linked Instagram account."
      );
    }

    for (const page of accounts) {
      const exp = expiresIn
        ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
        : null;

      await saveSocialAccount(admin, {
        user_id: oauthState.user_id,
        platform: "facebook",
        account_id: String(page.id),
        account_name: page.name || "Facebook Page",
        access_token: page.access_token,
        token_expires_at: exp,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      if (page.instagram_business_account?.id) {
        await saveSocialAccount(admin, {
          user_id: oauthState.user_id,
          platform: "instagram",
          account_id: String(page.instagram_business_account.id),
          account_name: page.instagram_business_account.name || page.name || "Instagram",
          access_token: page.access_token,
          token_expires_at: exp,
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "ok", "Meta connected"));
  } catch (err) {
    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, "error", err.message));
  }
}
