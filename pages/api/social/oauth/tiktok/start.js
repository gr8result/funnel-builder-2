import crypto from "crypto";
import { requireUser } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getTikTokRedirectUri() {
  return (
    process.env.TIKTOK_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/tiktok/callback`
  );
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

  const state = crypto.randomUUID();
  const redirectPath = req.body?.redirectPath || "/modules/social_media";

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
    redirect_uri: getTikTokRedirectUri(),
    state,
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
  });
}
