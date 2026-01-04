// /pages/api/smsglobal/SMSGlobalSMSSend.js
// FULL REPLACEMENT — single SMS send via SMSGlobal MAC auth
// Returns { ok:true, raw, provider_id } or { ok:false, error, detail }

import crypto from "crypto";

const SMSGLOBAL_API_KEY = process.env.SMSGLOBAL_API_KEY;
const SMSGLOBAL_API_SECRET = process.env.SMSGLOBAL_API_SECRET;
const SMSGLOBAL_FROM = process.env.SMSGLOBAL_FROM || process.env.SMSGLOBAL_ORIGIN || "";

function s(v) {
  return String(v ?? "").trim();
}
function digitsOnly(v) {
  return s(v).replace(/[^\d]/g, "");
}
function normalizeToDigitsOrFail(v) {
  // accept +61..., 0417..., 61...
  const raw = s(v);
  if (!raw) return "";
  let x = raw.replace(/[^\d+]/g, "");
  if (x.startsWith("+")) x = x.slice(1);
  if (x.startsWith("0") && x.length >= 9) x = "61" + x.slice(1);
  return digitsOnly(x);
}

function macAuthHeader({ method, url }) {
  const apiKey = s(SMSGLOBAL_API_KEY);
  const secret = s(SMSGLOBAL_API_SECRET);

  if (!apiKey || !secret) {
    const e = new Error("Missing SMSGLOBAL_API_KEY or SMSGLOBAL_API_SECRET");
    e.missing = ["SMSGLOBAL_API_KEY", "SMSGLOBAL_API_SECRET"].filter((k) => !process.env[k]);
    throw e;
  }

  const ts = Math.floor(Date.now() / 1000);
  const nonce = Math.floor(Math.random() * 10000000);

  const u = new URL(url);
  const host = u.hostname;
  const port = u.port ? Number(u.port) : u.protocol === "http:" ? 80 : 443;
  const pathPlusQuery = u.pathname + (u.search || "");

  const auth =
    ts +
    "\n" +
    nonce +
    "\n" +
    method.toUpperCase() +
    "\n" +
    pathPlusQuery +
    "\n" +
    host +
    "\n" +
    port +
    "\n" +
    "\n";

  const mac = crypto.createHmac("sha256", secret).update(auth).digest("base64");
  return `MAC id="${apiKey}", ts="${ts}", nonce="${nonce}", mac="${mac}"`;
}

async function sendViaSmsGlobal({ to, message }) {
  const url = "https://api.smsglobal.com/v2/sms";

  const headers = {
    "Content-Type": "application/json",
    Authorization: macAuthHeader({ method: "POST", url }),
  };

  const body = {
    destination: s(to),
    message: s(message),
  };

  if (s(SMSGLOBAL_FROM)) body.origin = s(SMSGLOBAL_FROM);

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  if (!r.ok) return { ok: false, status: r.status, raw: text, json };
  return { ok: true, status: r.status, raw: text, json };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const toRaw = s(req.body?.to);
    const message = s(req.body?.message);

    const to = normalizeToDigitsOrFail(toRaw);
    if (!to || !/^\d{8,15}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "Invalid destination number." });
    }
    if (!message) {
      return res.status(400).json({ ok: false, error: "Message is empty." });
    }

    const r = await sendViaSmsGlobal({ to, message });

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        error: "SMS failed.",
        detail: r.raw || "",
        status: r.status,
      });
    }

    const provider_id = r.json?.messages?.[0]?.id || r.json?.id || null;

    return res.status(200).json({
      ok: true,
      provider: "smsglobal",
      provider_id,
      raw: r.raw || "",
    });
  } catch (err) {
    console.error("SMSGlobalSMSSend error:", err);
    return res.status(500).json({
      ok: false,
      error: "SMS failed.",
      detail: err?.message || String(err),
      missing: err?.missing || null,
    });
  }
}
