import crypto from "crypto";

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

export default async function handler(req, res) {
  const appOrigin = getCanonicalAppOrigin(req);

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Meta data deletion callback endpoint is active.",
      callback_url: `${appOrigin}/api/webhooks/facebook-data-deletion`,
      status_url_example: `${appOrigin}/data-deletion-instructions`,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const confirmationCode = crypto.randomBytes(12).toString("hex");
  const statusUrl = `${appOrigin}/data-deletion-instructions?code=${confirmationCode}`;

  return res.status(200).json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
}