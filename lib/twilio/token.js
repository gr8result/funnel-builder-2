// ============================================
// /lib/twilio/token.js
// FULL REPLACEMENT — Correct Twilio AccessToken + VoiceGrant
// Exports: createVoiceToken(identity)
// Requires env:
//   TWILIO_ACCOUNT_SID (ACxxxx)
//   TWILIO_API_KEY (SKxxxx)
//   TWILIO_API_SECRET
//   TWILIO_TWIML_APP_SID (APxxxx)  <-- REQUIRED for outbound browser calls
// ============================================

import twilio from "twilio";

export function createVoiceToken(identity) {
  const missing = [];

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!apiKey) missing.push("TWILIO_API_KEY");
  if (!apiSecret) missing.push("TWILIO_API_SECRET");
  if (!twimlAppSid) missing.push("TWILIO_TWIML_APP_SID");

  if (missing.length) {
    const err = new Error(`Missing Twilio env vars: ${missing.join(", ")}`);
    err.missing = missing;
    throw err;
  }

  const id = String(identity || "").trim() || `gr8-browser-${Date.now()}`;

  // Twilio JWT Access Token
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity: id,
    ttl: 3600, // 1 hour
  });

  // Voice grant (outgoing via TwiML app)
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true, // safe; lets device register
  });

  token.addGrant(voiceGrant);

  return token.toJwt();
}
