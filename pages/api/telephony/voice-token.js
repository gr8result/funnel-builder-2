// /pages/api/telephony/voice-token.js
// FULL REPLACEMENT — supports POST body identity (what your modal sends)
// Requires env:
//  TWILIO_ACCOUNT_SID
//  TWILIO_API_KEY_SID
//  TWILIO_API_KEY_SECRET
//  TWILIO_TWIML_APP_SID

import twilio from "twilio";

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const appSid = process.env.TWILIO_TWIML_APP_SID;

    const missing = [];
    if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!apiKeySid) missing.push("TWILIO_API_KEY_SID");
    if (!apiKeySecret) missing.push("TWILIO_API_KEY_SECRET");
    if (!appSid) missing.push("TWILIO_TWIML_APP_SID");

    if (missing.length) {
      return res.status(500).json({ ok: false, error: "Missing Twilio env vars", missing });
    }

    let identity = "browser-user";
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      identity = String(body.identity || req.query.identity || "browser-user");
    } else {
      identity = String(req.query.identity || "browser-user");
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });

    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: appSid,
        incomingAllow: false,
      })
    );

    return res.status(200).json({ ok: true, identity, token: token.toJwt() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
