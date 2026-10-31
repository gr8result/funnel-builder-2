import { createHash, timingSafeEqual } from "node:crypto";

export function normalizeAustralianPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9) digits = `61${digits.slice(1)}`;
  else if (digits.startsWith("610") && digits.length >= 12) digits = `61${digits.slice(3)}`;
  return digits;
}

export function isSmsOptOutKeyword(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[.!\s]+$/g, "");
  return new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]).has(normalized);
}

function equalSecret(expected, actual) {
  const left = Buffer.from(String(expected || ""));
  const right = Buffer.from(String(actual || ""));
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function authenticateSmsGlobalWebhook(req, env = process.env) {
  const expected = String(env.SMSGLOBAL_WEBHOOK_SECRET || "");
  if (!expected) return { configured: false, authorized: false };

  const authHeader = String(req.headers?.authorization || "");
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const suppliedHeader = String(req.headers?.["x-smsglobal-webhook-secret"] || "");
  const suppliedQuery = env.SMSGLOBAL_WEBHOOK_QUERY_TOKEN_ENABLED === "true"
    ? String(req.query?.webhook_token || "")
    : "";

  return {
    configured: true,
    authorized: equalSecret(expected, suppliedHeader)
      || equalSecret(expected, bearer)
      || equalSecret(expected, suppliedQuery),
  };
}

export function normalizeSmsDeliveryStatus(value) {
  const status = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["delivered", "deliverysuccess", "success"].includes(status)) return "delivered";
  if (["failed", "undelivered", "rejected", "expired", "deliveryfailed"].includes(status)) return "failed";
  if (["sent", "submitted", "accepted", "queued", "pending"].includes(status)) return "sent";
  return null;
}

export function makeSmsWebhookEventHash({ kind, providerId, status, timestamp, from, to, text }) {
  const normalized = [kind, providerId, status, timestamp, from, to, String(text || "").trim().toUpperCase()].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}
