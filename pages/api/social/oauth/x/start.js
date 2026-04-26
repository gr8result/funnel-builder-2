import crypto from "crypto";
import { requireUser } from "../../../../../lib/social/auth";
import { getPlatformCredentials } from "../../../../../lib/social/platformCredentials";

function getXRedirectUri() {
  return (
    process.env.X_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/social/oauth/x/callback`
  );
}

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, "x");
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: "X Client ID not configured. Open Platform Setup to add your credentials." });
  }

  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomUUID();
  const redirectPath = req.body?.redirectPath || "/modules/social_media";

  const { error } = await auth.admin.from("social_oauth_states").insert({
    state,
    user_id: auth.user.id,
    platform: "x",
    redirect_path: redirectPath,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    code_verifier: verifier,
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.appId,
    redirect_uri: getXRedirectUri(),
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return res.status(200).json({
    ok: true,
    authUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  });
}

