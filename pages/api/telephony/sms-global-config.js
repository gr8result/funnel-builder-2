// /pages/api/telephony/sms-global-config.js
// FULL REPLACEMENT — Fixes "Authorization header is empty or format is incorrect."
// Uses REST v2 if SMSGLOBAL_API_KEY + SMSGLOBAL_API_SECRET exist (Basic base64(key:secret))
// Falls back to legacy HTTP if SMSGLOBAL_USERNAME + SMSGLOBAL_PASSWORD exist

function must(v, name) {
  const s = String(v || "").trim();
  if (!s) throw new Error(`Missing env var: ${name}`);
  return s;
}

function basicAuthHeader(user, pass) {
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

async function readJsonOrText(resp) {
  const text = await resp.text().catch(() => "");
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function extractError(bodyText, json, status) {
  if (json) {
    if (json.message) return `${json.message} (${status})`;
    if (json.error) return `${json.error} (${status})`;
    if (json.errors && Array.isArray(json.errors) && json.errors[0]?.message) {
      return `${json.errors[0].message} (${status})`;
    }
  }
  if (bodyText) return `${bodyText} (${status})`;
  return `SMSGlobal error (${status})`;
}

async function sendRestV2({ to, message, origin }) {
  const apiKey = must(process.env.SMSGLOBAL_API_KEY, "SMSGLOBAL_API_KEY");
  const apiSecret = must(process.env.SMSGLOBAL_API_SECRET, "SMSGLOBAL_API_SECRET");

  const auth = basicAuthHeader(apiKey, apiSecret);

  // SMSGlobal v2
  const url = "https://api.smsglobal.com/v2/sms/";
  const payload = {
    destination: String(to),
    message: String(message),
  };

  // origin is optional
  const from = String(origin || process.env.SMSGLOBAL_FROM || process.env.SMSGLOBAL_ORIGIN || "").trim();
  if (from) payload.origin = from;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const { json, text } = await readJsonOrText(resp);

  if (!resp.ok) {
    throw new Error(extractError(text, json, resp.status));
  }

  // provider id if present
  const providerId =
    json?.messages?.[0]?.id ||
    json?.id ||
    json?.message_id ||
    null;

  return { providerId, raw: json || text, method: "rest_v2" };
}

async function sendLegacyHttp({ to, message, origin }) {
  const username = must(process.env.SMSGLOBAL_USERNAME, "SMSGLOBAL_USERNAME");
  const password = must(process.env.SMSGLOBAL_PASSWORD, "SMSGLOBAL_PASSWORD");

  const from = String(origin || process.env.SMSGLOBAL_FROM || process.env.SMSGLOBAL_ORIGIN || "").trim();

  // Legacy endpoint uses query/form params (varies by account config)
  const url = "https://www.smsglobal.com/http-api.php";

  const params = new URLSearchParams();
  params.set("action", "sendsms");
  params.set("user", username);
  params.set("password", password);
  params.set("to", String(to));
  params.set("text", String(message));
  if (from) params.set("from", from);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const { json, text } = await readJsonOrText(resp);

  if (!resp.ok) throw new Error(extractError(text, json, resp.status));
  if (/ERROR/i.test(text || "")) throw new Error(text.trim());

  return { providerId: null, raw: json || text, method: "legacy_http" };
}

export async function smsGlobalSend({ to, message, origin }) {
  const hasRest = String(process.env.SMSGLOBAL_API_KEY || "").trim() && String(process.env.SMSGLOBAL_API_SECRET || "").trim();
  const hasLegacy = String(process.env.SMSGLOBAL_USERNAME || "").trim() && String(process.env.SMSGLOBAL_PASSWORD || "").trim();

  if (!hasRest && !hasLegacy) {
    throw new Error(
      "No SMSGlobal credentials found. Set SMSGLOBAL_API_KEY+SMSGLOBAL_API_SECRET OR SMSGLOBAL_USERNAME+SMSGLOBAL_PASSWORD."
    );
  }

  // Prefer REST if present
  if (hasRest) return await sendRestV2({ to, message, origin });
  return await sendLegacyHttp({ to, message, origin });
}
