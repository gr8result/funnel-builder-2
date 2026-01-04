// /pages/api/twilio/bridge.js
// TwiML that bridges the answered agent call to the destination number.

import twilio from "twilio";

export default function handler(req, res) {
  const VoiceResponse = twilio.twiml.VoiceResponse;

  const callerId = process.env.TWILIO_CALLER_ID;
  const to = (req.query.to || "").toString().trim();

  const twiml = new VoiceResponse();

  if (!to) {
    twiml.say("Missing destination number.");
    twiml.hangup();
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml.toString());
  }

  const dial = twiml.dial({
    callerId: callerId || undefined,
    answerOnBridge: true,
  });

  dial.number(to);

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
}
