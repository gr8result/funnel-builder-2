// /pages/api/twilio/voice-client.js
// TwiML for outgoing calls from the browser (Voice SDK)
// It dials To and RECORDS from answer.
// TwiML App Voice Request URL MUST point here (public ngrok URL).

import twilio from "twilio";

export default function handler(req, res) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const to = String((req.body?.To || req.query?.To || "")).trim();
  const leadId = String((req.body?.LeadId || req.query?.LeadId || "")).trim();

  if (!to) {
    response.say("Missing destination number.");
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(response.toString());
  }

  const callerId = process.env.TWILIO_CALLER_ID;
  const baseUrl = (process.env.TWILIO_WEBHOOK_URL || "").replace(/\/$/, "");

  // Recording callback (public!)
  // We pass leadId so we can store the recording into that lead's notes.
  const recordingCb =
    baseUrl
      ? `${baseUrl}/api/twilio/recording-status${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""}`
      : undefined;

  const dialOpts = {
    callerId: callerId || undefined,
    record: "record-from-answer",
    recordingStatusCallback: recordingCb,
    recordingStatusCallbackMethod: "POST",
  };

  const dial = response.dial(dialOpts);

  // Dial the phone number
  dial.number({}, to);

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(response.toString());
}
