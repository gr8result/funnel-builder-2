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

function getTikTokRedirectUri(req) {
  return process.env.TIKTOK_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/tiktok/callback`;
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

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, "tiktok");
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: "TikTok Client Key not configured. Open Platform Setup to add your credentials." });
  }
  if (!creds?.appSecret) {
    return res.status(400).json({ ok: false, error: "TikTok Client Secret not configured. Open Platform Setup to add your credentials." });
  }

  const state = crypto.randomUUID();
  const redirectPath = getPostAuthRedirectUrl(req, req.body?.redirectPath);

  const { error } = await auth.admin.from("social_oauth_states").insert({
    state,
    user_id: auth.user.id,
    platform: "tiktok",
    redirect_path: redirectPath,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  const params = new URLSearchParams({
    client_key: creds.appId,
    scope: "user.info.basic,video.publish",
    response_type: "code",
    redirect_uri: getTikTokRedirectUri(req),
    state,
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
  });
}
