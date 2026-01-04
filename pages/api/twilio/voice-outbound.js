// /pages/api/twilio/voice-outbound.js
// TwiML webhook used by your TwiML App "Voice Request URL".
// Twilio POSTs here when the browser starts an outbound call.

import twilio from "twilio";

export default function handler(req, res) {
  // Twilio sends POST, but allow GET for quick testing
  const params = req.method === "POST" ? req.body : req.query;

  const to = (params?.To || params?.to || "").toString().trim();

  // Build TwiML
  const twiml = new twilio.twiml.VoiceResponse();

  if (!to) {
    twiml.say("No destination number provided.");
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml.toString());
  }

  const callerId =
    process.env.TWILIO_CALLER_ID ||
    process.env.NEXT_PUBLIC_TWILIO_CALLER_ID ||
    "";

  if (!callerId) {
    twiml.say("Caller ID is not configured.");
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml.toString());
  }

  // Dial PSTN
  const dial = twiml.dial({ callerId });
  dial.number(to);

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
}
