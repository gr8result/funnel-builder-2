// /pages/api/twilio/voice-complete.js
// Twilio <Record action> webhook: save voicemail into crm_calls and say thanks.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const db =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY)
    : null;

// Twilio posts x-www-form-urlencoded
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "text/xml");
    return res.status(405).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Method not allowed.</Say>
  <Hangup/>
</Response>`);
  }

  try {
    if (!db) {
      console.error("[voice-complete] Supabase not configured");
    }

    const payload = req.body || {};

    const {
      From,
      To,
      CallSid,
      RecordingUrl,
      RecordingDuration,
      Caller,
      CallerName,
    } = payload;

    const fromNumber = From || Caller || "";
    const toNumber = To || "";
    const recordingUrl = RecordingUrl || "";
    const recordingDuration = RecordingDuration
      ? parseInt(RecordingDuration, 10)
      : null;
    const callerName = CallerName || null;

    let leadId = null;

    // Try to match caller to a lead based on phone number
    if (db && fromNumber) {
      try {
        const last6 = fromNumber.slice(-6);
        const { data: lead, error: leadErr } = await db
          .from("leads")
          .select("id, phone")
          .ilike("phone", `%${last6}%`)
          .limit(1)
          .maybeSingle();

        if (!leadErr && lead) {
          leadId = lead.id;
        }
      } catch (e) {
        console.error("[voice-complete] lead lookup error:", e);
      }
    }

    if (db) {
      const now = new Date().toISOString();

      const insertPayload = {
        direction: "inbound",
        from_number: fromNumber,
        to_number: toNumber,
        caller_name: callerName,
        recording_url: recordingUrl,
        recording_duration,
        twilio_sid: CallSid || null,
        raw_payload: payload,
        lead_id: leadId,
        unread: true,
        created_at: now,
      };

      const { error: insertErr } = await db
        .from("crm_calls")
        .insert([insertPayload]);

      if (insertErr) {
        console.error("[voice-complete] insert error:", insertErr);
      }
    }

    // Respond to the caller
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-AU">
    Thank you, your message has been recorded. Goodbye.
  </Say>
  <Hangup/>
</Response>`);
  } catch (err) {
    console.error("[twilio/voice-complete] error:", err);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-AU">
    Sorry, an error occurred saving your message. Goodbye.
  </Say>
  <Hangup/>
</Response>`);
  }
}
