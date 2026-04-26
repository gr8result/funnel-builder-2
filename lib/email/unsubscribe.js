import crypto from "crypto";

const TOKEN_VERSION = "v1";

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getSecret() {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

export function normalizeUnsubscribeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function createUnsubscribeToken({ userId, email }) {
  const secret = getSecret();
  const normalizedEmail = normalizeUnsubscribeEmail(email);
  const normalizedUserId = String(userId || "").trim();

  if (!secret || !normalizedUserId || !normalizedEmail) return "";

  return crypto
    .createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}:${normalizedUserId}:${normalizedEmail}`)
    .digest("base64url");
}

export function verifyUnsubscribeToken({ userId, email, token }) {
  const expected = createUnsubscribeToken({ userId, email });
  const actual = String(token || "").trim();

  if (!expected || !actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function getUnsubscribeBaseUrl(req) {
  const explicitBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "";

  if (explicitBase) return explicitBase.replace(/\/$/, "");

  const host = req?.headers?.host ? String(req.headers.host) : "localhost:3000";
  const protoHeader = req?.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader || (host.includes("localhost") ? "http" : "https");

  return `${proto}://${host}`.replace(/\/$/, "");
}

export function buildUnsubscribeUrls({ req, userId, email }) {
  const normalizedEmail = normalizeUnsubscribeEmail(email);
  const normalizedUserId = String(userId || "").trim();
  const token = createUnsubscribeToken({ userId: normalizedUserId, email: normalizedEmail });
  const baseUrl = getUnsubscribeBaseUrl(req);

  if (!normalizedEmail || !normalizedUserId || !token) {
    return { apiUrl: "", pageUrl: "", token: "" };
  }

  const query = new URLSearchParams({
    email: normalizedEmail,
    user: normalizedUserId,
    token,
  }).toString();

  return {
    token,
    apiUrl: `${baseUrl}/api/email/unsubscribe?${query}`,
    pageUrl: `${baseUrl}/unsubscribe?${query}`,
  };
}

export function injectUnsubscribeUrl(html, unsubscribeUrl) {
  const source = String(html || "");
  const target = String(unsubscribeUrl || "").trim();

  if (!source || !target) return source;

  let next = source
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, target)
    .replace(/%unsubscribe_url%/gi, target);

  next = next.replace(
    /<a\b([^>]*?)href=(['"])(#|)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, beforeHref, quote, hrefValue, afterHref, innerHtml) => {
      if (!/unsubscribe/i.test(innerHtml)) return match;
      return `<a${beforeHref}href=${quote}${target}${quote}${afterHref}>${innerHtml}</a>`;
    }
  );

  return next;
}

export function uniqEmails(values = []) {
  return [...new Set(values.map((value) => normalizeUnsubscribeEmail(value)).filter(Boolean))];
}