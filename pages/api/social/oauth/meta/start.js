import crypto from "crypto";
import { requireUser } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getMetaRedirectUri() {
  return (
    process.env.META_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/meta/callback`
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

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, "meta");
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: "Meta App ID not configured. Open Platform Setup to add your credentials." });
  }

  const state = crypto.randomUUID();
  const redirectPath = req.body?.redirectPath || "/modules/social_media";

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

  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    // "pages_messaging",  // Advanced permission — requires Meta App Review to use publicly.
    //                     // Re-enable after App Review approval in Meta dashboard.
  ].join(",");

  const params = new URLSearchParams({
    client_id: creds.appId,
    redirect_uri: getMetaRedirectUri(),
    state,
    response_type: "code",
    scope,
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
  });
}
