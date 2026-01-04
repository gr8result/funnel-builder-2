// /pages/api/twilio/voice-inbound.js
// Twilio voice webhook – play greeting + record voicemail

export default function handler(req, res) {
  try {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-AU">
    Hello. Thanks for calling Great Result Digital Solutions. I'm sorry but we can't take your call at this time, but do please leave a message after the tone, and we will respond to you as soon as possible.
  </Say>
  <Record action="/api/twilio/voice-complete"
          method="POST"
          maxLength="120"
          playBeep="true"
          trim="trim-silence" />
  <Say voice="alice" language="en-AU">
    We did not receive a recording. Goodbye.
  </Say>
  <Hangup/>
</Response>`;

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err) {
    console.error("[twilio/voice-inbound] error:", err);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-AU">
    Sorry, an error occurred handling your call. Goodbye.
  </Say>
  <Hangup/>
</Response>`);
  }
}
