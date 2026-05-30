import { requireUser } from "../../../lib/social/auth";
import { getPlatformCredentials } from "../../../lib/social/platformCredentials";
import withAdmin from "../../../lib/withAdmin";

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

function getLinkedInRedirectUri(req) {
  return process.env.LINKEDIN_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/linkedin/callback`;
}

function getMetaRedirectUri(req) {
  return process.env.META_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/meta/callback`;
}

function getTikTokRedirectUri(req) {
  return process.env.TIKTOK_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/tiktok/callback`;
}

const TIKTOK_REQUESTED_SCOPES = "user.info.basic,video.publish,video.upload";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  const linkedin = await getPlatformCredentials(auth.admin, auth.user.id, "linkedin");
  const meta = await getPlatformCredentials(auth.admin, auth.user.id, "meta");
  const tiktok = await getPlatformCredentials(auth.admin, auth.user.id, "tiktok");

  return res.status(200).json({
    ok: true,
    runtime: {
      requestOrigin: getRequestOrigin(req),
      canonicalAppOrigin: getCanonicalAppOrigin(req),
      linkedin: {
        clientId: linkedin?.appId || "",
        redirectUri: getLinkedInRedirectUri(req),
        credentialSource: linkedin?.source || null,
        credentialOwnerUserId: linkedin?.ownerUserId || "",
        credentialUpdatedAt: linkedin?.updatedAt || "",
      },
      meta: {
        appId: meta?.appId || "",
        redirectUri: getMetaRedirectUri(req),
        credentialSource: meta?.source || null,
        credentialOwnerUserId: meta?.ownerUserId || "",
        credentialUpdatedAt: meta?.updatedAt || "",
      },
      tiktok: {
        clientKey: tiktok?.appId || "",
        redirectUri: getTikTokRedirectUri(req),
        requestedScopes: TIKTOK_REQUESTED_SCOPES,
        credentialSource: tiktok?.source || null,
        credentialOwnerUserId: tiktok?.ownerUserId || "",
        credentialUpdatedAt: tiktok?.updatedAt || "",
      },
    },
  });
}

export default withAdmin(handler);
