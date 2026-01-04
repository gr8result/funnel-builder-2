// ============================================
// /pages/api/smsglobal/smsglobal-config.js
// ============================================
// FULL REPLACEMENT — Supports BOTH SMSGlobal auth methods
//
// ✅ REST v2 (preferred): SMSGLOBAL_API_KEY + SMSGLOBAL_API_SECRET
// ✅ Legacy HTTP fallback: SMSGLOBAL_USERNAME + SMSGLOBAL_PASSWORD
//
// Fixes your current error:
// "Authorization header is empty or format is incorrect."
// ============================================

export const SMSGLOBAL_API_KEY =
  process.env.SMSGLOBAL_API_KEY ||
  process.env.SMSGLOBAL_KEY ||
  process.env.SMSGLOBAL_REST_KEY ||
  "";

export const SMSGLOBAL_API_SECRET =
  process.env.SMSGLOBAL_API_SECRET ||
  process.env.SMSGLOBAL_SECRET ||
  process.env.SMSGLOBAL_REST_SECRET ||
  "";

export const SMSGLOBAL_USERNAME = process.env.SMSGLOBAL_USERNAME || "";
export const SMSGLOBAL_PASSWORD = process.env.SMSGLOBAL_PASSWORD || "";

export const SMSGLOBAL_FROM = process.env.SMSGLOBAL_FROM || "";
export const SMSGLOBAL_ORIGIN = process.env.SMSGLOBAL_ORIGIN || "";

function b64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

export function normalizePhone(v) {
  const s0 = String(v || "").trim();
  if (!s0) return "";
  let s = s0.replace(/[^\d+]/g, "");

  if (s.startsWith("+")) return s;

  // AU: 0XXXXXXXXX -> +61XXXXXXXXX
  if (s.startsWith("0") && s.length >= 9) return "+61" + s.slice(1);

  // AU: 61XXXXXXXXX -> +61XXXXXXXXX
  if (s.startsWith("61")) return "+" + s;

  return s;
}

function normalizeOrigin(v) {
  let s = String(v || "").trim();
  if (!s) return "";

  s = s.replace(/[^\d+]/g, "");

  if (!s.startsWith("+") && s.startsWith("0") && s.length >= 9) {
    s = "+61" + s.slice(1);
  } else if (!s.startsWith("+") && s.startsWith("61")) {
    s = "+" + s;
  }

  const digits = s.replace(/[^\d]/g, "");
  const ok =
    (s.startsWith("+") && digits.length >= 8 && digits.length <= 15) ||
    (!s.startsWith("+") && digits.length >= 8 && digits.length <= 15);

  return ok ? s : "";
}

function pickOrigin(originOverride) {
  const candidate =
    String(originOverride || "").trim() ||
    String(SMSGLOBAL_FROM || "").trim() ||
    String(SMSGLOBAL_ORIGIN || "").trim();

  const origin = normalizeOrigin(candidate);
  return origin || "";
}

function extractError(text, data, status) {
  const msg =
    data?.message ||
    data?.error ||
    data?.errors?.[0]?.message ||
    data?.errors?.[0]?.description ||
    data?.messages?.[0]?.status?.description ||
    data?.messages?.[0]?.status?.name ||
    null;

  if (msg) return String(msg);
  if (text) return String(text).slice(0, 900);
  return `SMSGlobal error (${status})`;
}

async function readJsonOrText(resp) {
  const text = await resp.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

// -------------------------------
// REST v2 sender (Basic key:secret)
// -------------------------------
async function sendRestV2({ to, message, origin }) {
  if (!SMSGLOBAL_API_KEY || !SMSGLOBAL_API_SECRET) {
    throw new Error("Missing SMSGLOBAL_API_KEY / SMSGLOBAL_API_SECRET");
  }

  const destination = normalizePhone(to);
  const msg = String(message || "").trim();
  if (!destination) throw new Error("Missing destination");
  if (!msg) throw new Error("Missing message");

  const o = pickOrigin(origin);

  const resp = await fetch("https://api.smsglobal.com/v2/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${b64(`${SMSGLOBAL_API_KEY}:${SMSGLOBAL_API_SECRET}`)}`,
    },
    body: JSON.stringify({
      ...(o ? { origin: o } : {}),
      destination,
      message: msg,
    }),
  });

  const { json, text } = await readJsonOrText(resp);

  if (!resp.ok) {
    throw new Error(extractError(text, json, resp.status));
  }

  const providerId =
    json?.messages?.[0]?.id || json?.id || json?.messageId || null;

  return { providerId, raw: json || text, method: "rest_v2" };
}

// --------------------------------------
// Legacy HTTP sender (Basic user:pass)
// Endpoint used by older SMSGlobal setups
// --------------------------------------
async function sendLegacyHttp({ to, message, origin }) {
  if (!SMSGLOBAL_USERNAME || !SMSGLOBAL_PASSWORD) {
    throw new Error("Missing SMSGLOBAL_USERNAME / SMSGLOBAL_PASSWORD");
  }

  const destination = normalizePhone(to);
  const msg = String(message || "").trim();
  if (!destination) throw new Error("Missing destination");
  if (!msg) throw new Error("Missing message");

  const o = pickOrigin(origin);

  // Legacy endpoint (works for many existing accounts)
  const url = "https://api.smsglobal.com/http-api.php";

  const params = new URLSearchParams();
  params.set("action", "sendsms");
  params.set("user", SMSGLOBAL_USERNAME);
  params.set("password", SMSGLOBAL_PASSWORD);
  params.set("to", destination);
  params.set("text", msg);
  if (o) params.set("from", o);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const { json, text } = await readJsonOrText(resp);

  // Legacy may return plain text like: "OK: 12345" or error text
  const bodyText = (text || "").trim();

  if (!resp.ok) {
    throw new Error(extractError(bodyText, json, resp.status));
  }

  // crude parse for ID if present
  let providerId = null;
  const m = bodyText.match(/OK:\s*([A-Za-z0-9_-]+)/i);
  if (m && m[1]) providerId = m[1];

  // Some accounts return "ERROR: ...."
  if (/^ERROR/i.test(bodyText)) {
    throw new Error(bodyText);
  }

  return { providerId, raw: json || bodyText, method: "legacy_http" };
}

// --------------------------------------
// Public helper used by your API routes
// Tries REST v2 first, then legacy fallback
// --------------------------------------
export async function smsGlobalSend({ to, message, origin }) {
  const hasRest = !!(SMSGLOBAL_API_KEY && SMSGLOBAL_API_SECRET);
  const hasLegacy = !!(SMSGLOBAL_USERNAME && SMSGLOBAL_PASSWORD);

  if (!hasRest && !hasLegacy) {
    throw new Error(
      "No SMSGlobal credentials found. Set SMSGLOBAL_API_KEY+SMSGLOBAL_API_SECRET OR SMSGLOBAL_USERNAME+SMSGLOBAL_PASSWORD."
    );
  }

  if (hasRest) {
    return await sendRestV2({ to, message, origin });
  }

  return await sendLegacyHttp({ to, message, origin });
}
