// /pages/api/twilio/test-call.js
// Simple test endpoint to make Twilio call your mobile

import twilio from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_CALLER_ID; // your Twilio number

// 👇 for now hard-code your ngrok URL so Twilio knows what to play
// (update this when ngrok URL changes, or move into an env var)
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  "https://nonfat-ungored-buford.ngrok-free.dev";

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
  console.error(
    "[twilio/test-call] Missing env vars TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_CALLER_ID"
  );
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

export default async function handler(req, res) {
  // --- CORS / preflight so tools don’t explode ---
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Use GET or POST for this endpoint." });
  }

  // --- get destination number ---
  let to = "";

  if (req.method === "GET") {
    // e.g. /api/twilio/test-call?to=+61417004315
    to = (req.query.to || "").toString();
  } else {
    // POST { "to": "+61417004315" }
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      to = (body.to || "").toString();
    } catch {
      to = "";
    }
  }

  // fallback: your mobile
  if (!to) {
    to = "+61417004315";
  }

  if (!to.startsWith("+")) {
    return res
      .status(400)
      .json({ error: "Destination number must be in +E164 format." });
  }

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    return res.status(500).json({ error: "Twilio env vars not configured." });
  }

  try {
    const call = await client.calls.create({
      to,
      from: FROM_NUMBER,
      // Twilio will fetch instructions for the call from this URL
      url: `${PUBLIC_BASE_URL}/api/twilio/voice-inbound`,
    });

    return res.status(200).json({ ok: true, sid: call.sid, to, from: FROM_NUMBER });
  } catch (err) {
    console.error("[twilio/test-call] error:", err);
    return res.status(500).json({ error: err.message || "Call failed." });
  }
}
