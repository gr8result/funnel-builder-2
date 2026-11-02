import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 5 * 60;

function getSecret() {
  const secret = process.env.FUNNEL_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!secret) throw Object.assign(new Error("Funnel preview signing is not configured"), { status: 503 });
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createFunnelPreviewToken({ funnelId, workspaceId }) {
  const payload = encode(JSON.stringify({
    funnelId,
    workspaceId,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
  }));
  return `${payload}.${signature(payload, getSecret())}`;
}

export function verifyFunnelPreviewToken(token, funnelId) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  let expectedSignature;
  try { expectedSignature = signature(payload, getSecret()); }
  catch { return null; }
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (data.funnelId !== funnelId || !data.workspaceId || !Number.isInteger(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + TOKEN_LIFETIME_SECONDS) return null;
    return data;
  } catch {
    return null;
  }
}
