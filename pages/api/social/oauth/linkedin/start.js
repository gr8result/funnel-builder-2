import crypto from "crypto";
import { requireUser } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getLinkedInRedirectUri() {
  return (
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/linkedin/callback`
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

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, "linkedin");
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: "LinkedIn Client ID not configured. Open Platform Setup to add your credentials." });
  }

  const state = crypto.randomUUID();
  const redirectPath = req.body?.redirectPath || "/modules/social_media";

  const { error } = await auth.admin.from("social_oauth_states").insert({
    state,
    user_id: auth.user.id,
    platform: "linkedin",
    redirect_path: redirectPath,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.appId,
    redirect_uri: getLinkedInRedirectUri(),
    state,
    scope: "openid profile email w_member_social",
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  });
}
