// /pages/api/twilio/make-call.js

// Calls your agent first, then bridges to the destination.
// FIX: blocks calling your own agent number (prevents voicemail loop).
// FIX: derives a public base URL safely (Twilio must hit a public URL, not localhost).

import twilio from "twilio";

function getPublicBase(req) {
  const envBase = (process.env.TWILIO_WEBHOOK_URL || "")
    .replace(/\/api\/twilio\/voice-client\/?$/, "")
    .replace(/\/$/, "");
  if (envBase) return envBase;

  // Fallback: try to build from request headers (works if deployed behind HTTPS proxy)
  const proto = (req.headers["x-forwarded-proto"] || "http").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  if (!host) return "";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const callerId = process.env.TWILIO_CALLER_ID;       // your Twilio number (+E.164)
  const agentNumber = process.env.TWILIO_AGENT_NUMBER; // your mobile (rings first)
  const publicBase = getPublicBase(req);

  const { to } = req.body || {};
  const toNumber = (to || "").toString().trim();

  if (!accountSid || !authToken || !callerId || !agentNumber || !publicBase) {
    return res.status(500).json({
      ok: false,
      error:
        "Phone not configured. Need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_ID, TWILIO_AGENT_NUMBER, and TWILIO_WEBHOOK_URL (or a deployable public host).",
    });
  }

  if (!toNumber) return res.status(400).json({ ok: false, error: "Missing 'to' number." });

  // ✅ Prevent the classic loop: agent == destination (this causes voicemail / weirdness)
  const norm = (v) => (v || "").replace(/\s+/g, "");
  if (norm(toNumber) === norm(agentNumber)) {
    return res.status(400).json({
      ok: false,
      error:
        "You are trying to call your own agent number. This creates a call loop and goes to voicemail. Call a different number.",
    });
  }

  try {
    const client = twilio(accountSid, authToken);

    // Twilio must be able to fetch this URL publicly
    const bridgeUrl = `${publicBase}/api/twilio/bridge?to=${encodeURIComponent(toNumber)}`;

    const call = await client.calls.create({
      to: agentNumber,
      from: callerId,
      url: bridgeUrl,
      timeout: 30,
    });

    return res.status(200).json({ ok: true, sid: call.sid });
  } catch (err) {
    console.error("[twilio/make-call] error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Twilio call failed." });
  }
}
