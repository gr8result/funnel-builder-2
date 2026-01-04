// ============================================
// /lib/smsglobal.js
// SMSGlobal sender (supports BOTH:
//  - SMSGlobal HTTP API (user/password)
//  - SMSGlobal REST API (key/secret) if you have it
// ============================================

function s(v) {
  return String(v ?? "").trim();
}

function normalizeToDigitsE164NoPlus(raw) {
  // SMSGlobal/Clickatell-style APIs often want international digits WITHOUT "+"
  // e.g. +61417004315 -> 61417004315
  let v = s(raw);
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");

  // Convert common AU formats
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);

  // Strip "+"
  v = v.replace(/^\+/, "");
  return v.replace(/[^\d]/g, "");
}

function getOrigin() {
  return (
    process.env.SMSGLOBAL_ORIGIN ||
    process.env.NEXT_PUBLIC_SMSGLOBAL_ORIGIN ||
    "GR8RESULT"
  );
}

async function sendViaHttpApi({ toDigits, message, origin }) {
  // Classic SMSGlobal HTTP API (common)
  // Needs:
  //  SMSGLOBAL_USER
  //  SMSGLOBAL_PASSWORD
  const user = s(process.env.SMSGLOBAL_USER);
  const pass = s(process.env.SMSGLOBAL_PASSWORD);

  if (!user || !pass) {
    const err = new Error("Missing SMSGLOBAL_USER or SMSGLOBAL_PASSWORD");
    err.code = "MISSING_HTTP_API_CREDS";
    throw err;
  }

  const params = new URLSearchParams();
  params.set("action", "sendsms");
  params.set("user", user);
  params.set("password", pass);
  params.set("from", origin);
  params.set("to", toDigits);
  params.set("text", message);

  const url = `https://api.smsglobal.com/http-api.php?${params.toString()}`;

  const r = await fetch(url, { method: "GET" });
  const bodyText = await r.text().catch(() => "");

  if (!r.ok) {
    const err = new Error(`SMSGlobal HTTP API failed (${r.status})`);
    err.status = r.status;
    err.provider_body = bodyText;
    throw err;
  }

  // Some accounts return "ERROR:" in a 200 response
  if (/^\s*error\b/i.test(bodyText) || /\berror\b/i.test(bodyText)) {
    const err = new Error("SMSGlobal HTTP API returned an error");
    err.status = 400;
    err.provider_body = bodyText;
    throw err;
  }

  return { ok: true, mode: "http_api", provider_body: bodyText };
}

async function sendViaRestApi({ toDigits, message, origin }) {
  // SMSGlobal REST (if you have API key/secret)
  // Needs:
  //  SMSGLOBAL_API_KEY
  //  SMSGLOBAL_API_SECRET
  const key = s(process.env.SMSGLOBAL_API_KEY);
  const secret = s(process.env.SMSGLOBAL_API_SECRET);

  if (!key || !secret) {
    const err = new Error("Missing SMSGLOBAL_API_KEY or SMSGLOBAL_API_SECRET");
    err.code = "MISSING_REST_CREDS";
    throw err;
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  const r = await fetch("https://api.smsglobal.com/v2/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      origin,
      destination: toDigits,
      message,
    }),
  });

  const json = await r.json().catch(() => null);

  if (!r.ok) {
    const err = new Error(`SMSGlobal REST API failed (${r.status})`);
    err.status = r.status;
    err.provider_body = json;
    throw err;
  }

  return { ok: true, mode: "rest_api", provider_body: json };
}

export async function sendSmsGlobal({ to, message, origin }) {
  const toDigits = normalizeToDigitsE164NoPlus(to);
  const msg = s(message);
  const from = s(origin) || getOrigin();

  if (!toDigits) throw new Error("Missing/invalid destination number.");
  if (!msg) throw new Error("Missing message.");

 const hasHttp = s(process.env.SMSGLOBAL_USER) && s(process.env.SMSGLOBAL_PASSWORD);

if (hasHttp) {
  return await sendViaHttpApi({ toDigits, message: msg, origin: from });
}

const err = new Error(
  "SMSGlobal HTTP API credentials missing. Set SMSGLOBAL_USER and SMSGLOBAL_PASSWORD."
);
err.code = "NO_HTTP_CREDS";
throw err;
}