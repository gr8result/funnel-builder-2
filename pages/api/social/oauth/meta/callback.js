import { createSupabaseAdmin } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getMetaRedirectUri() {
  return (
    process.env.META_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/meta/callback`
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
  const { code, state, error, error_reason, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_reason || error_description) {
    const msg = error_description || error_reason || error || 'Facebook returned an error';
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", msg));
  }

  if (!code || !state) {
    // Log all query params to help debug
    const params = JSON.stringify(req.query);
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", `Missing OAuth code/state. Received: ${params}`));
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
    return res.redirect(doneRedirectUrl("/modules/social_media", "error", "OAuth state expired"));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, "meta");
    if (!creds?.appId) throw new Error("Meta credentials not configured.");

    const params = new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      redirect_uri: getMetaRedirectUri(),
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
    for (const page of accounts) {
      const exp = expiresIn
        ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
        : null;

      await admin.from("social_accounts").upsert(
        {
          user_id: oauthState.user_id,
          platform: "facebook",
          account_id: String(page.id),
          account_name: page.name || "Facebook Page",
          access_token: page.access_token,
          token_expires_at: exp,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_id" }
      );

      if (page.instagram_business_account?.id) {
        await admin.from("social_accounts").upsert(
          {
            user_id: oauthState.user_id,
            platform: "instagram",
            account_id: String(page.instagram_business_account.id),
            account_name: page.instagram_business_account.name || page.name || "Instagram",
            access_token: page.access_token,
            token_expires_at: exp,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,account_id" }
        );
      }
    }

    await admin
      .from("social_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    return res.redirect(doneRedirectUrl(oauthState.redirect_path, "ok", "Meta connected"));
  } catch (err) {
    return res.redirect(doneRedirectUrl(oauthState.redirect_path, "error", err.message));
  }
}
