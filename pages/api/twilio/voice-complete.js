// /pages/api/twilio/voice-complete.js
// ✅ DISABLED for pooled numbers (no inbound voicemail support)
// 
// This webhook is called when a caller leaves a voicemail.
// Currently disabled because your users are on pooled numbers.
// 
// When/if you support dedicated inbound numbers, re-enable this:
// 1. Check if account has_dedicated_number = true
// 2. Then save voicemail to crm_calls with direction: "inbound"
//
// For now, just return 200 to Twilio.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "text/xml");
    return res.status(405).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Method not allowed.</Say>
  <Hangup/>
</Response>`);
  }

  // ✅ Inbound voicemail disabled for pooled numbers
  // Return success to Twilio so it stops retrying
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Inbound calls are not supported on this number. Goodbye.</Say>
  <Hangup/>
</Response>`);
}
