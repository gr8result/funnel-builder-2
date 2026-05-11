import crypto from "crypto";
import { requireUser } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

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

function getMetaRedirectUri(req) {
  return `${getCanonicalAppOrigin(req)}/api/social/oauth/meta/callback`;
}

function getPostAuthRedirectUrl(req, redirectPath) {
  const fallbackPath = redirectPath || "/modules/social_media/setup";
  try {
    return new URL(fallbackPath, getRequestOrigin(req)).toString();
  } catch {
    return `${getRequestOrigin(req)}/modules/social_media/setup`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, "meta");
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: "Meta App ID not configured. Open Platform Setup to add your credentials." });
  }
  if (!creds?.configId) {
    return res.status(400).json({ ok: false, error: "Meta Configuration ID not configured. Add your Facebook Login for Business Configuration ID in Platform Setup." });
  }

  const state = crypto.randomUUID();
  const redirectPath = getPostAuthRedirectUrl(req, req.body?.redirectPath);

  const { error } = await auth.admin.from("social_oauth_states").insert({
    state,
    user_id: auth.user.id,
    platform: "meta",
    redirect_path: redirectPath,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  const params = new URLSearchParams({
    client_id: creds.appId,
    redirect_uri: getMetaRedirectUri(req),
    state,
    response_type: "code",
    config_id: creds.configId,
    scope: "public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata,pages_read_user_content,instagram_basic,instagram_content_publish",
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
  });
}
