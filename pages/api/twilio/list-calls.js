// /pages/api/twilio/list-calls.js
// FULL REPLACEMENT — uses API Key (no TWILIO_AUTH_TOKEN needed)
// Requires env:
//  TWILIO_ACCOUNT_SID
//  TWILIO_API_KEY_SID
//  TWILIO_API_KEY_SECRET

import twilio from "twilio";

export default async function handler(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    const missing = [];
    if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!apiKeySid) missing.push("TWILIO_API_KEY_SID");
    if (!apiKeySecret) missing.push("TWILIO_API_KEY_SECRET");
    if (missing.length) return res.status(500).json({ ok: false, error: "Missing Twilio env vars", missing });

    const client = twilio(apiKeySid, apiKeySecret, { accountSid });

    const limit = Math.min(Number(req.query.limit || 50) || 50, 200);
    const calls = await client.calls.list({ limit });

    // attach latest recording (if any)
    const out = [];
    for (const c of calls) {
      let recordingSid = null;
      let recordingUrl = null;

      try {
        const recs = await client.recordings.list({ callSid: c.sid, limit: 1 });
        if (recs && recs[0]) {
          recordingSid = recs[0].sid;
          recordingUrl = recs[0].mediaUrl || recs[0].uri || null;
        }
      } catch (_) {}

      out.push({
        sid: c.sid,
        startTime: c.startTime || c.dateCreated,
        direction: c.direction,
        from: c.from,
        to: c.to,
        duration: c.duration,
        status: c.status,
        recordingSid,
        recordingUrl,
      });
    }

    return res.status(200).json({ ok: true, calls: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
