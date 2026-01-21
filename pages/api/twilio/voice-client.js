// /pages/api/twilio/voice-client.js
// FULL REPLACEMENT
//
// ✅ TwiML webhook for outgoing calls from Twilio Voice SDK
// ✅ Always returns valid TwiML (prevents 31005 "gateway hangup")
//
// Required env:
//  TWILIO_CALLER_ID=+61...

import twilio from "twilio";

function s(v) {
  return String(v ?? "").trim();
}

function getParam(req, key) {
  const b = req.body || {};
  const q = req.query || {};
  return s(b[key] ?? q[key]);
}

function looksLikeE164(num) {
  return /^\+\d{8,15}$/.test(num);
}

export default async function handler(req, res) {
  try {
    const callerId = s(process.env.TWILIO_CALLER_ID);
    const To = getParam(req, "To") || getParam(req, "to");
    const record = getParam(req, "record");

    const vr = new twilio.twiml.VoiceResponse();

    if (!callerId || !looksLikeE164(callerId)) {
      vr.say({ voice: "alice" }, "Missing caller I D.");
      vr.hangup();
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(vr.toString());
    }

    if (!To || !looksLikeE164(To)) {
      vr.say({ voice: "alice" }, "Invalid destination number.");
      vr.hangup();
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(vr.toString());
    }

    const dial = vr.dial({ callerId });

    const wantRecord =
      record === "1" || record === "true" || record === "yes";

    if (wantRecord) dial.number({ record: "record-from-answer" }, To);
    else dial.number(To);

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(vr.toString());
  } catch (e) {
    console.error("[/api/twilio/voice-client] error:", e);
    const vr = new twilio.twiml.VoiceResponse();
    vr.say({ voice: "alice" }, "Application error.");
    vr.hangup();
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(vr.toString());
  }
}
